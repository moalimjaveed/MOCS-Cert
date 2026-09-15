"""Hierarchical block refinement endpoints."""

from fastapi import APIRouter, HTTPException
from backend.app.schemas.timeline import BlockRefineRequest, BlockRefineResponse
from backend.app.core.trajectory_service import trajectory_service

router = APIRouter()

@router.post("/block", response_model=BlockRefineResponse)
def refine_block_endpoint(request: BlockRefineRequest):
    """Subdivides an UNKNOWN block dyadically and derives tighter child bounds."""
    try:
        res = trajectory_service.refine_block(
            request.block_id,
            subdivision_factor=request.subdivision_factor
        )
        return BlockRefineResponse(**res)
    except Exception as e:
        from mocs.exceptions import MOCSBlockNotFoundError, MOCSUnsupportedGeometryError
        if isinstance(e, MOCSBlockNotFoundError) or "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        if isinstance(e, MOCSUnsupportedGeometryError):
            raise HTTPException(status_code=400, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))
