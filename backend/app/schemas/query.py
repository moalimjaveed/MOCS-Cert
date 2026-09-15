"""Query compilation and execution schemas."""

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Union

class ExecutionPlanStep(BaseModel):
    step_id: int
    name: str
    description: str
    status: str = "completed"  # 'completed', 'in_progress', 'pending', 'skipped'
    metadata: Dict[str, Any] = Field(default_factory=dict)

class QueryCompileRequest(BaseModel):
    query_text: str = Field(..., description="MolQL scientific query string")
    trajectory_id: Optional[str] = "protein_ligand_traj.xtc"
    sampling_semantics: str = "sampled_frames"
    pbc_mode: str = "auto"
    precision: str = "float64"
    bounding_model: str = "AABB"

class QueryCompileResponse(BaseModel):
    query_id: str
    observable: str
    predicate_operator: str
    threshold_value: float
    unit: str
    threshold_value_angstrom: Optional[float] = None
    selection_a: str
    selection_b: str
    temporal_operator: Optional[str] = None
    min_duration_ps: Optional[float] = None
    quantifier: str = "EXISTS"
    chosen_plan: str = "Plan-B"
    estimated_prune_rate: float = 0.0
    estimated_speedup: float = 1.0
    plan_steps: List[ExecutionPlanStep]
    bounding_model: str = "AABB"

class QueryExecuteRequest(BaseModel):
    query_text: str
    trajectory_id: Optional[str] = "protein_ligand_traj.xtc"
    sampling_semantics: str = "sampled_frames"
    pbc_mode: str = "auto"
    precision: str = "float64"
    quantifier: str = "EXISTS"
    bounding_model: str = "AABB"


class QueryExecuteResponse(BaseModel):
    query_id: str
    truth_value: str  # 'TRUE', 'FALSE', 'UNKNOWN'
    resolution_status: str  # 'COMPLETE', 'NEEDS_REFINEMENT', ...
    quantifier: str
    certificate_id: str
    certificate_hash: str
    blocks_examined: int
    blocks_total: int = 0
    blocks_read: int = 0
    blocks_certified_true: int = 0
    blocks_certified_false: int = 0
    blocks_refined: int = 0
    blocks_exact_true: int = 0
    blocks_exact_false: int = 0
    blocks_exact_mixed: int = 0
    blocks_unknown: int = 0
    certified_blocks: int
    refined_blocks: int
    frames_total: int = 0
    frames_exact_requested: int = 0
    frames_decoded: int = 0
    frames_materialized: int = 0
    exact_frames_scanned: int
    total_frames_refined: int
    pruning_efficiency: float
    wall_time_seconds: float
    cpu_time_seconds: float
    source_compressed_bytes_fetched: Optional[int] = None
    compressed_bytes_fetched: Optional[int] = None
    coordinate_payload_bytes: int = 0
    coordinates_materialized: int
    atoms_analyzed: int = 0
    index_bytes_read: int
    index_size_bytes: int = 0
    peak_memory_bytes: int
    refinement_selectivity: Union[float, str] = "50:1"
    refinement_speed: Optional[float] = None
    io_prune_ratio: float = 0.0
    traversal_depth: int = 1
    certificate: Dict[str, Any]
    plan_steps: List[ExecutionPlanStep] = Field(default_factory=list)
    witness_intervals: List[List[int]] = Field(default_factory=list)
    evaluated_blocks: List[Dict[str, Any]] = Field(default_factory=list)
    execution_id: str = ""
    query_hash: str = ""
    bounding_model: str = "AABB"

class StructuredErrorResponse(BaseModel):
    error_code: str
    message: str
    location: Optional[str] = None
    action: Optional[str] = None
    detail: Optional[str] = None
    request_id: Optional[str] = None
