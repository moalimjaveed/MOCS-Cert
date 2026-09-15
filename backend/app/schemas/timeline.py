"""Timeline lattice and dyadic refinement schemas."""

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class SubBlockItem(BaseModel):
    child_id: str
    parent_id: int
    frame_start: int
    frame_end_exclusive: int
    lower_bound: float
    upper_bound: float
    truth_value: str
    status: str

class BlockLatticeItem(BaseModel):
    block_id: int
    frame_start: int
    frame_end_exclusive: int
    time_start_ns: float
    time_end_ns: float
    lower_bound: float
    upper_bound: float
    truth_value: str  # 'TRUE', 'FALSE', 'UNKNOWN'
    status: str       # 'CERTIFIED_TRUE', 'CERTIFIED_FALSE', 'REFINED', 'EXACT', 'UNKNOWN'
    child_blocks: List[SubBlockItem] = Field(default_factory=list)
    exact_frames: int = 0
    refined_count: int = 0

class BlockRefineRequest(BaseModel):
    block_id: int
    trajectory_id: Optional[str] = "protein_ligand_traj.xtc"
    subdivision_factor: int = 2

class BlockRefineResponse(BaseModel):
    parent_block_id: int
    parent_bounds: Dict[str, float]
    child_blocks: List[SubBlockItem]
    monotonic_non_expansion_verified: bool
    summary: str
