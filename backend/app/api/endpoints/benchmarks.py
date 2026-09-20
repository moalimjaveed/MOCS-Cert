"""MOBench benchmarking endpoints."""

from fastapi import APIRouter
from backend.app.schemas.benchmark import BenchmarkResponse
from backend.app.core.benchmark_service import benchmark_service

router = APIRouter()

@router.get("", response_model=BenchmarkResponse)
def get_benchmarks(query_id: str = "q1"):
    """Returns comparative baseline wall times, speedups, and I/O reduction metrics."""
    return benchmark_service.get_baselines(query_id)
