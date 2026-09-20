"""Query compilation and certified execution endpoints."""

from fastapi import APIRouter
from backend.app.schemas.query import (
    QueryCompileRequest,
    QueryCompileResponse,
    QueryExecuteRequest,
    QueryExecuteResponse
)
from backend.app.core.compiler_service import compiler_service

router = APIRouter()

@router.post("/compile", response_model=QueryCompileResponse)
def compile_query(request: QueryCompileRequest):
    """Parses MolQL query and returns the 9-stage compiler execution plan."""
    return compiler_service.compile(
        request.query_text,
        request.trajectory_id or "synth_500f.xtc",
        sampling_semantics=request.sampling_semantics,
        pbc_mode=request.pbc_mode,
        precision=request.precision,
        bounding_model=request.bounding_model
    )

@router.post("/execute", response_model=QueryExecuteResponse)
def execute_query(request: QueryExecuteRequest):
    """Executes query with spatial pruning, producing a certified result and certificate."""
    return compiler_service.execute(
        request.query_text,
        request.trajectory_id or "synth_500f.xtc",
        sampling_semantics=request.sampling_semantics,
        pbc_mode=request.pbc_mode,
        precision=request.precision,
        quantifier_override=request.quantifier,
        bounding_model=request.bounding_model
    )
