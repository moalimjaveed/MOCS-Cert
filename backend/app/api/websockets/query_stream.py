"""WebSocket streaming handler for live block discovery and dyadic refinement."""

import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.concurrency import run_in_threadpool
from backend.app.config import settings
from backend.app.core.trajectory_service import trajectory_service
from backend.app.core.compiler_service import compiler_service

router = APIRouter()

MAX_MESSAGE_BYTES = 65536

@router.websocket("/query")
async def websocket_query_stream(websocket: WebSocket):
    # P1-13: Validate origin against allowed CORS origins if origin header is provided
    origin = websocket.headers.get("origin")
    if origin and settings.CORS_ORIGINS:
        allowed = origin in settings.CORS_ORIGINS or "*" in settings.CORS_ORIGINS
        if not allowed:
            await websocket.close(code=1008, reason="CORS policy violation")
            return

    await websocket.accept()
    try:
        while True:
            data_text = await websocket.receive_text()

            # P1-13: Enforce message size limit
            if len(data_text.encode("utf-8")) > MAX_MESSAGE_BYTES:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Message payload exceeds maximum allowed size of {MAX_MESSAGE_BYTES} bytes."
                })
                continue

            # P1-13: Safe JSON decode without abruptly closing the connection on malformed payloads
            try:
                msg = json.loads(data_text)
                if not isinstance(msg, dict):
                    await websocket.send_json({"type": "error", "message": "Message payload must be a JSON object."})
                    continue
            except (json.JSONDecodeError, UnicodeDecodeError) as err:
                await websocket.send_json({"type": "error", "message": f"Invalid JSON payload: {str(err)}"})
                continue

            action = msg.get("action")
            query_id = msg.get("query_id") or msg.get("request_id")

            if action == "ping":
                resp = {"type": "pong"}
                if query_id is not None:
                    resp["query_id"] = query_id
                await websocket.send_json(resp)

            elif action == "refine_block":
                block_id = msg.get("block_id")
                if block_id is None or not isinstance(block_id, int):
                    resp = {
                        "type": "error",
                        "message": "Field 'block_id' (integer) is required for action 'refine_block'."
                    }
                    if query_id is not None:
                        resp["query_id"] = query_id
                    await websocket.send_json(resp)
                    continue

                sub_factor = msg.get("subdivision_factor", 2)
                try:
                    # P1-4: Non-blocking threadpool execution
                    refine_res = await run_in_threadpool(
                        trajectory_service.refine_block,
                        block_id,
                        subdivision_factor=sub_factor
                    )
                    resp = {
                        "type": "block_refined",
                        "data": refine_res
                    }
                except Exception as exc:
                    resp = {
                        "type": "error",
                        "message": f"Block refinement failed: {str(exc)}"
                    }
                if query_id is not None:
                    resp["query_id"] = query_id
                await websocket.send_json(resp)

            elif action == "execute":
                # P1-14: Require explicit query_text, reject canned demo fallbacks
                query_text = msg.get("query_text")
                if not query_text or not isinstance(query_text, str) or not query_text.strip():
                    resp = {
                        "type": "error",
                        "message": "Field 'query_text' (non-empty string) is required for action 'execute'."
                    }
                    if query_id is not None:
                        resp["query_id"] = query_id
                    await websocket.send_json(resp)
                    continue

                b_model = msg.get("bounding_model", "AABB")

                # P1-4: Non-blocking threadpool compilation
                try:
                    compile_res = await run_in_threadpool(
                        compiler_service.compile,
                        query_text,
                        bounding_model=b_model
                    )
                except Exception as exc:
                    resp = {
                        "type": "error",
                        "message": f"Query compilation failed: {str(exc)}"
                    }
                    if query_id is not None:
                        resp["query_id"] = query_id
                    await websocket.send_json(resp)
                    continue

                plan_resp = {
                    "type": "compile_plan",
                    "data": compile_res.model_dump() if hasattr(compile_res, "model_dump") else compile_res.dict()
                }
                if query_id is not None:
                    plan_resp["query_id"] = query_id
                await websocket.send_json(plan_resp)

                # Stream blocks in chunks of 20
                blocks = await run_in_threadpool(trajectory_service.get_blocks)
                chunk_size = 20
                for i in range(0, len(blocks), chunk_size):
                    chunk = blocks[i:i + chunk_size]
                    stream_resp = {
                        "type": "block_stream",
                        "blocks": chunk,
                        "progress": round((i + len(chunk)) / len(blocks), 3) if blocks else 1.0
                    }
                    if query_id is not None:
                        stream_resp["query_id"] = query_id
                    await websocket.send_json(stream_resp)
                    await asyncio.sleep(0.01)

                # Send final execution summary & certificate
                try:
                    exec_res = await run_in_threadpool(
                        compiler_service.execute,
                        query_text,
                        bounding_model=b_model
                    )
                    complete_resp = {
                        "type": "execution_complete",
                        "data": exec_res.model_dump() if hasattr(exec_res, "model_dump") else exec_res.dict()
                    }
                except Exception as exc:
                    complete_resp = {
                        "type": "error",
                        "message": f"Query execution failed: {str(exc)}"
                    }

                if query_id is not None:
                    complete_resp["query_id"] = query_id
                await websocket.send_json(complete_resp)

            else:
                err_resp = {"type": "error", "message": f"Unknown action: {action}"}
                if query_id is not None:
                    err_resp["query_id"] = query_id
                await websocket.send_json(err_resp)

    except WebSocketDisconnect:
        pass
