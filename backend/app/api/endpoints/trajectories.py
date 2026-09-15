"""Trajectory metadata and block endpoints."""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from backend.app.core.trajectory_service import trajectory_service
from backend.app.schemas.timeline import BlockLatticeItem

router = APIRouter()

@router.get("", response_model=Dict[str, Any])
def get_active_trajectory():
    """Returns active trajectory metadata, box dimensions, and accelerator info."""
    return trajectory_service.get_metadata()

@router.get("/blocks", response_model=List[BlockLatticeItem])
def get_trajectory_blocks():
    """Returns the 240 temporal block partitions with bounds and truth statuses."""
    return trajectory_service.get_blocks()

@router.get("/blocks/{block_id}", response_model=BlockLatticeItem)
def get_block_detail(block_id: int):
    """Returns detail for a single block including child sub-blocks if refined."""
    block = trajectory_service.get_block_by_id(block_id)
    if not block:
        raise HTTPException(status_code=404, detail=f"Block {block_id} not found.")
    return block
