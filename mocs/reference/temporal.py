"""Authoritative Reference Temporal Semantics Evaluator."""

from typing import Tuple, List
import numpy as np
from mocs.types import TruthValue, ResolutionStatus

def reference_temporal_for(
    boolean_series: np.ndarray,
    min_duration_ps: float,
    dt_ps: float,
    mode: str = "sampled_frames"
) -> Tuple[str, str]:
    """
    Authoritative reference evaluator for FOR(P, min_duration_ps).
    Under sampled_frames semantics, tau <= dt_ps requires ceil(tau / dt_ps) = 1 frame.
    If mode == 'continuous_physical' and tau < dt_ps, returns UNKNOWN + UNSUPPORTED_SEMANTICS.
    Returns: Tuple[truth_value, resolution_status]
    """
    if mode == "continuous_physical" and min_duration_ps < dt_ps:
        return (TruthValue.UNKNOWN.value, ResolutionStatus.UNSUPPORTED_SEMANTICS.value)

    if dt_ps <= 0.0 or not np.isfinite(dt_ps):
        return (TruthValue.UNKNOWN.value, ResolutionStatus.UNRESOLVABLE_SAMPLING.value)

    required_consecutive_frames = max(1, int(np.ceil(min_duration_ps / dt_ps)))

    max_run = 0
    current_run = 0
    for val in boolean_series:
        if val:
            current_run += 1
            if current_run > max_run:
                max_run = current_run
        else:
            current_run = 0

    if max_run >= required_consecutive_frames:
        return (TruthValue.TRUE.value, ResolutionStatus.COMPLETE.value)
    else:
        return (TruthValue.FALSE.value, ResolutionStatus.COMPLETE.value)

def extract_half_open_intervals(boolean_series: np.ndarray) -> List[Tuple[int, int]]:
    """Extracts contiguous episodes of True into half-open intervals [k_s, k_e)."""
    intervals = []
    in_event = False
    start_idx = 0
    for k, val in enumerate(boolean_series):
        if val and not in_event:
            in_event = True
            start_idx = k
        elif not val and in_event:
            in_event = False
            intervals.append((start_idx, k))
    if in_event:
        intervals.append((start_idx, len(boolean_series)))
    return intervals
