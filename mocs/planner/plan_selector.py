"""Cost Model & Plan Selection Optimizer."""

from dataclasses import dataclass
from typing import Dict

@dataclass
class HardwareCostWeights:
    alpha_io: float = 1.0       # $/byte read
    beta_cpu: float = 0.05      # $/FLOP
    gamma_mem: float = 0.01     # $/byte resident
    delta_refine: float = 2.0   # $/seek penalty
    eta_compile: float = 0.1    # $/compile overhead

def select_execution_plan(
    query_id: str,
    workload_remaining: int,
    is_cached: bool,
    index_available: bool,
    estimated_prune_rate: float,
    weights: HardwareCostWeights = HardwareCostWeights()
) -> str:
    """
    Cost-Based Plan Selection (J(P)):
      Plan A: Direct Scan
      Plan B: Indexed Pruning (single level)
      Plan C: Observable Cache (incurs non-zero lookup + read cost)
      Plan D: Hierarchical Refinement
    Enumerates candidate plans and selects argmin J(P).
    """
    if is_cached:
        return "Plan-C"

    candidates: Dict[str, float] = {}

    # Plan A: Direct scan
    cost_A = weights.alpha_io * 100.0 + weights.beta_cpu * 50.0
    candidates["Plan-A"] = cost_A

    # Build cost share if index not available (building index reads entire file + computes AABB)
    build_time_share = (weights.alpha_io * 110.0 + weights.beta_cpu * 80.0) / max(1, workload_remaining) if not index_available else 0.0

    # Plan B: Single-level indexed scan
    uncertified_fraction = 1.0 - estimated_prune_rate
    cost_B = (
        weights.eta_compile * 2.0
        + build_time_share
        + weights.alpha_io * (5.0 + uncertified_fraction * 95.0)
        + weights.beta_cpu * (5.0 + uncertified_fraction * 45.0)
    )
    candidates["Plan-B"] = cost_B

    # Plan D: Hierarchical refinement
    cost_D = (
        weights.eta_compile * 5.0
        + build_time_share
        + weights.alpha_io * (2.0 + uncertified_fraction * 30.0)
        + weights.delta_refine * (uncertified_fraction * 10.0)
    )
    candidates["Plan-D"] = cost_D

    return min(candidates, key=candidates.get)
