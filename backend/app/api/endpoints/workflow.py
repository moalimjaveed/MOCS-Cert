"""
backend.app.api.endpoints.workflow — FastAPI Scientific Workflow Engine Router.

Exposes REST endpoints for:
- Ecosystem backend discovery & live smoke tests
- Workflow template listing & instantiation
- Composable execution (4HHB, 1BNA, synth_500f)
- Full-lineage DAG retrieval
- Causal lineage queries ('Where did this value come from?')
- Reproducibility manifests (workflow.json) & re-execution verification
- Multi-format exports (JSON, CSV, Markdown)
"""

from __future__ import annotations
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel, Field

import mocs.workflow as mw

router = APIRouter()

# Global in-memory workflow engine singleton
engine = mw.WorkflowEngine()
_backends_cache: Optional[Dict[str, Any]] = None


class InstantiateWorkflowRequest(BaseModel):
    template_id: str
    name: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    mode: str = "DIFFERENTIAL"


class ExecuteWorkflowRequest(BaseModel):
    stride: Optional[int] = 1
    start_frame: Optional[int] = 0
    stop_frame: Optional[int] = 500


class ReproduceRequest(BaseModel):
    manifest: Dict[str, Any]


@router.get("/backends", summary="Discover Ecosystem Backends & Smoke Tests")
async def get_backends():
    """Discover installed ecosystem packages with license attribution and smoke test states (cached per process)."""
    global _backends_cache
    if _backends_cache is None:
        _backends_cache = mw.BackendDiscoveryService.discover_all()
    return {
        "status": "success",
        "backends": {bid: b.to_dict() for bid, b in _backends_cache.items()},
        "total_backends": len(_backends_cache),
    }


@router.get("/templates", summary="List Scientific Workflow Templates")
async def get_templates():
    """Return 7 reusable scientific workflow templates."""
    templates = mw.TemplateLibrary.get_all()
    return {
        "status": "success",
        "templates": [t.to_dict() for t in templates],
    }


@router.post("/instantiate", summary="Instantiate Workflow from Template")
async def instantiate_workflow(req: InstantiateWorkflowRequest):
    """Instantiate a new workflow from a registered scientific template."""
    try:
        mode_enum = mw.ExecutionMode(req.mode)
    except ValueError:
        valid_modes = [m.value for m in mw.ExecutionMode]
        raise HTTPException(
            status_code=422,
            detail=f"Invalid execution mode '{req.mode}'. Valid modes: {valid_modes}"
        )

    inst = engine.create_workflow(
        template_id=req.template_id,
        name=req.name,
        parameters=req.parameters,
        mode=mode_enum,
    )
    return {
        "status": "success",
        "workflow": inst.to_dict(),
    }


@router.post("/execute/{workflow_type}", summary="Execute Scientific Workflow")
async def execute_workflow(workflow_type: str, req: Optional[ExecuteWorkflowRequest] = None):
    """
    Execute a certified workflow:
    - 4hhb: Heme Fe–His NE2 coordination
    - 1bna: B-DNA Watson-Crick base pairing
    - synth_500f: 500-frame trajectory verification
    """
    w_type = workflow_type.lower()
    if "4hhb" in w_type:
        inst = engine.execute_4hhb_coordination_workflow()
    elif "1bna" in w_type:
        inst = engine.execute_1bna_duplex_workflow()
    elif "synth" in w_type or "traj" in w_type:
        stride = req.stride if req else 1
        start = req.start_frame if req else 0
        stop = req.stop_frame if req else 500
        inst = engine.execute_synth_500f_trajectory_workflow(stride=stride, start_frame=start, stop_frame=stop)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown workflow type: {workflow_type}. Choose '4hhb', '1bna', or 'synth_500f'.")

    return {
        "status": "success",
        "workflow": inst.to_dict(),
    }


@router.post("/{workflow_id}/execute", summary="Execute Instantiated Scientific Workflow")
async def execute_instantiated_workflow(workflow_id: str, req: Optional[ExecuteWorkflowRequest] = None):
    """Execute an instantiated scientific workflow using its configured parameters (F-053)."""
    inst = engine.get_workflow(workflow_id)
    if not inst:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found.")

    t_id = (inst.template_id or "").lower()
    w_name = (inst.name or "").lower()
    if "4hhb" in t_id or "4hhb" in w_name:
        executed_inst = engine.execute_4hhb_coordination_workflow(workflow_id=workflow_id)
    elif "1bna" in t_id or "1bna" in w_name:
        executed_inst = engine.execute_1bna_duplex_workflow(workflow_id=workflow_id)
    else:
        stride = req.stride if req else inst.parameters.get("stride", 1)
        start = req.start_frame if req else inst.parameters.get("start", 0)
        stop = req.stop_frame if req else inst.parameters.get("stop", 500)
        executed_inst = engine.execute_synth_500f_trajectory_workflow(
            stride=stride, start_frame=start, stop_frame=stop, workflow_id=workflow_id
        )

    return {
        "status": "success",
        "workflow": executed_inst.to_dict(),
    }


@router.get("/{workflow_id}", summary="Get Workflow Instance State")
async def get_workflow(workflow_id: str):
    inst = engine.get_workflow(workflow_id)
    if not inst:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found.")
    return {
        "status": "success",
        "workflow": inst.to_dict(),
    }


@router.get("/{workflow_id}/provenance", summary="Get Full Provenance DAG")
async def get_provenance_dag(workflow_id: str):
    """Retrieve complete provenance DAG for technical visualization."""
    inst = engine.get_workflow(workflow_id)
    if not inst:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found.")
    return {
        "status": "success",
        "dag": inst.provenance.to_dict(),
    }


@router.get("/{workflow_id}/lineage/{artifact_id}", summary="Query Causal Lineage ('Where did this value come from?')")
async def query_artifact_lineage(workflow_id: str, artifact_id: str):
    """Return exhaustive causal traceback for any specific scientific value."""
    inst = engine.get_workflow(workflow_id)
    if not inst:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found.")

    try:
        lineage = inst.provenance.query_lineage(artifact_id)
        return {
            "status": "success",
            "lineage": lineage.to_dict(),
        }
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/{workflow_id}/manifest", summary="Get Reproducibility Manifest (workflow.json)")
async def get_workflow_manifest(workflow_id: str):
    inst = engine.get_workflow(workflow_id)
    if not inst:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found.")

    if not inst.manifest:
        raise HTTPException(status_code=400, detail=f"Workflow '{workflow_id}' does not have a committed manifest yet.")

    return {
        "status": "success",
        "manifest": inst.manifest.to_dict(),
    }


@router.post("/reproduce", summary="Verify Reproducibility against Manifest")
async def reproduce_workflow(req: ReproduceRequest):
    """Re-run workflow from manifest and verify bit-level or tolerance reproducibility."""
    report = engine.reproduce_from_manifest(req.manifest)
    return {
        "status": "success",
        "reproduction_report": report,
    }


@router.get("/{workflow_id}/export/{export_format}", summary="Export Workflow in JSON, CSV, or Markdown")
async def export_workflow(workflow_id: str, export_format: str):
    inst = engine.get_workflow(workflow_id)
    if not inst:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found.")

    if not inst.manifest:
        raise HTTPException(status_code=400, detail="Workflow has no manifest to export.")

    fmt = export_format.lower()
    if fmt == "json":
        content = inst.manifest.to_json()
        return Response(content=content, media_type="application/json")
    elif fmt == "csv":
        content = inst.manifest.to_csv()
        return Response(content=content, media_type="text/csv")
    elif fmt in ("md", "markdown"):
        content = inst.manifest.to_markdown_report()
        return Response(content=content, media_type="text/markdown")
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format '{export_format}'. Choose 'json', 'csv', or 'md'.")
