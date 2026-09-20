"""MOBench benchmarking schemas."""

from pydantic import BaseModel, Field
from typing import List, Optional

class BenchmarkBaseline(BaseModel):
    name: str
    status: str = "MEASURED"
    wall_time_seconds: Optional[float] = None
    relative_speed: Optional[float] = None
    data_read_pct: Optional[float] = None
    atoms_analyzed_pct: Optional[float] = None
    index_bytes_mb: Optional[float] = None

class BenchmarkResponse(BaseModel):
    query_id: str
    speedup_vs_mdanalysis: float
    io_reduction_pct: float
    data_read_pct: float
    atoms_analyzed_pct: float
    index_bytes_mb: float
    baselines: List[BenchmarkBaseline]
