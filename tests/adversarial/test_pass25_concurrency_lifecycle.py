"""
PASS 25 — CONCURRENCY, STALE-STATE, CANCELLATION & RESOURCE-LIFECYCLE FORENSIC ATTACK

Hostile test suite targeting:
- Multi-threaded shared reader pointer integrity (MDAnalysisTrajectorySource, MCIReader)
- Request-ID preservation and disambiguation over WebSocket streaming
- Concurrency isolation and result atomicity across simultaneous query executions
- Resource lifecycle, idempotent closure, and fail-closed checks on closed handles
- Non-overlapping dyadic block refinement under concurrent thread access
"""

import os
import json
import pytest
import threading
import concurrent.futures
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.core.compiler_service import compiler_service
from backend.app.core.trajectory_service import trajectory_service
from mocs.io import MDAnalysisTrajectorySource
from mocs.mci import MCIReader


@pytest.fixture
def client():
    return TestClient(app)


def test_concurrent_mda_source_reads():
    """
    Hostile Test 1: Concurrently read distinct frames on a shared MDAnalysisTrajectorySource
    to verify that internal seek pointers do not cross-talk or corrupt coordinates.
    """
    traj_path = os.path.join("tests", "data", "synth_500f.xtc")
    topo_path = os.path.join("tests", "data", "synth_500f.gro")
    
    with MDAnalysisTrajectorySource(topo_path, traj_path) as source:
        # Pre-record deterministic single-threaded ground truth
        ref_f0 = source.read_frame_coordinates(0)
        ref_f50 = source.read_frame_coordinates(50)
        ref_f100 = source.read_frame_coordinates(100)
        ref_f200 = source.read_frame_coordinates(200)

        results = {}

        def worker(frame_idx, key):
            # Rapid repeated reading to provoke any race condition in seeking
            coords = [source.read_frame_coordinates(frame_idx) for _ in range(10)]
            results[key] = coords

        threads = [
            threading.Thread(target=worker, args=(0, "f0")),
            threading.Thread(target=worker, args=(50, "f50")),
            threading.Thread(target=worker, args=(100, "f100")),
            threading.Thread(target=worker, args=(200, "f200")),
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        for c in results["f0"]:
            assert (c == ref_f0).all(), "Threaded read of frame 0 was corrupted by concurrent seek"
        for c in results["f50"]:
            assert (c == ref_f50).all(), "Threaded read of frame 50 was corrupted by concurrent seek"
        for c in results["f100"]:
            assert (c == ref_f100).all(), "Threaded read of frame 100 was corrupted by concurrent seek"
        for c in results["f200"]:
            assert (c == ref_f200).all(), "Threaded read of frame 200 was corrupted by concurrent seek"


def test_concurrent_mci_reader_reads():
    """
    Hostile Test 2: Concurrently read disparate binary AABB blocks on a shared MCIReader
    to verify that binary seeks and unpacking are strictly thread-safe.
    """
    index_dir = os.path.join("tests", "data", "synth_500f_mci")
    
    with MCIReader(index_dir, verify_on_open=False) as reader:
        ref_b0 = reader.read_block(0, 0)
        ref_b5 = reader.read_block(0, 5)
        ref_b10 = reader.read_block(1, 10)
        ref_b20 = reader.read_block(1, 20)

        def worker(gid, bid, expected):
            for _ in range(15):
                rec = reader.read_block(gid, bid)
                assert rec.block_id == expected.block_id
                assert rec.atom_group_id == expected.atom_group_id
                assert rec.x_min == expected.x_min
                assert rec.z_max == expected.z_max

        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            futures = [
                pool.submit(worker, 0, 0, ref_b0),
                pool.submit(worker, 0, 5, ref_b5),
                pool.submit(worker, 1, 10, ref_b10),
                pool.submit(worker, 1, 20, ref_b20),
                pool.submit(worker, 0, 0, ref_b0),
                pool.submit(worker, 0, 5, ref_b5),
            ]
            for f in concurrent.futures.as_completed(futures):
                f.result()


def test_websocket_query_stream_correlation(client):
    """
    Hostile Test 3: Verify WebSocket streaming echoes client-provided query_id across
    all stages (compile_plan, block_stream, execution_complete, error).
    """
    with client.websocket_connect("/ws/query") as ws:
        test_qid = "client-query-uuid-98765"
        ws.send_json({
            "action": "execute",
            "query_text": "FIND A:155:CA WITHIN 4.0 A OF LIG:1:O2",
            "query_id": test_qid
        })

        msg1 = ws.receive_json()
        assert msg1["type"] == "compile_plan"
        assert msg1.get("query_id") == test_qid, f"compile_plan omitted query_id: {msg1}"

        # Receive block streams
        has_block_stream = False
        while True:
            msg = ws.receive_json()
            if msg["type"] == "block_stream":
                has_block_stream = True
                assert msg.get("query_id") == test_qid, f"block_stream omitted query_id: {msg}"
            elif msg["type"] == "execution_complete":
                assert msg.get("query_id") == test_qid, f"execution_complete omitted query_id: {msg}"
                break
        assert has_block_stream, "Did not receive any block_stream frames"


def test_websocket_error_and_refine_correlation(client):
    """
    Hostile Test 4: Verify WebSocket error and refine_block frames echo query_id.
    """
    with client.websocket_connect("/ws/query") as ws:
        # 1. refine_block
        ws.send_json({
            "action": "refine_block",
            "block_id": 5,
            "query_id": "refine-req-123"
        })
        res1 = ws.receive_json()
        assert res1["type"] == "block_refined"
        assert res1.get("query_id") == "refine-req-123"

        # 2. error action
        ws.send_json({
            "action": "nonexistent_action",
            "query_id": "error-req-456"
        })
        res2 = ws.receive_json()
        assert res2["type"] == "error"
        assert res2.get("query_id") == "error-req-456"


def test_source_and_mci_fail_closed_on_close():
    """
    Hostile Test 5: Verify that closed MDAnalysisTrajectorySource and MCIReader fail-closed
    with RuntimeError on any subsequent read attempt, and that close() is idempotent.
    """
    traj_path = os.path.join("tests", "data", "synth_500f.xtc")
    topo_path = os.path.join("tests", "data", "synth_500f.gro")
    index_dir = os.path.join("tests", "data", "synth_500f_mci")

    source = MDAnalysisTrajectorySource(topo_path, traj_path)
    assert not source.is_closed
    source.close()
    assert source.is_closed
    # Idempotent double close
    source.close()
    assert source.is_closed

    with pytest.raises(RuntimeError, match="closed"):
        source.read_frame_coordinates(0)

    with pytest.raises(RuntimeError, match="closed"):
        source.read_block_coordinates(0, 10)

    reader = MCIReader(index_dir, verify_on_open=False)
    assert not reader.is_closed
    reader.close()
    assert reader.is_closed
    # Idempotent double close
    reader.close()
    assert reader.is_closed

    with pytest.raises(RuntimeError, match="closed"):
        reader.read_block(0, 0)


def test_concurrent_compiler_execution_isolation():
    """
    Hostile Test 6: Concurrently execute multiple queries with conflicting thresholds
    and verify that each returned certificate strictly matches its own query parameters
    without state leakage or coordinate pollution.
    """
    queries = [
        ("FIND A:155:CA WITHIN 2.0 A OF LIG:1:O2", 2.0, "EXISTS"),
        ("FIND A:155:CA WITHIN 4.0 A OF LIG:1:O2", 4.0, "EXISTS"),
        ("FIND A:155:CA WITHIN 6.0 A OF LIG:1:O2", 6.0, "EXISTS"),
        ("FIND A:155:CA WITHIN 8.0 A OF LIG:1:O2", 8.0, "EXISTS"),
    ]

    def run_query(q_tuple):
        q_text, thresh, quant = q_tuple
        res = compiler_service.execute(q_text)
        return q_text, thresh, res

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(run_query, queries))

    for q_text, thresh, res in results:
        cert = res.certificate
        assert cert["query"]["predicate"]["threshold_value"] == thresh
        assert cert["query"]["predicate"]["unit"] == "A"
        assert res.query_id.startswith("q_")
        assert res.certificate_hash == cert["certificate_hash"]


def test_concurrent_refine_block_monotonicity():
    """
    Hostile Test 7: Concurrently refine multiple blocks in TrajectoryService to ensure
    thread safety and monotonic non-expansion invariants hold under concurrent load.
    """
    block_ids = [0, 1, 2, 3, 4, 0, 1, 2]

    def refine_task(bid):
        return trajectory_service.refine_block(bid)

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(refine_task, block_ids))

    for res in results:
        assert res["monotonic_non_expansion_verified"] is True
        assert len(res["child_blocks"]) > 0
        p_bounds = res["parent_bounds"]
        for child in res["child_blocks"]:
            assert child["lower_bound"] >= p_bounds["L"] - 1e-6
            assert child["upper_bound"] <= p_bounds["U"] + 1e-6
