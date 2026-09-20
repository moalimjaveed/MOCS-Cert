"""MOCS-Cert Epistemic Types, Truth Values & Execution Statuses."""

from __future__ import annotations
import json
from enum import Enum
from dataclasses import dataclass
from typing import Dict, Any, Optional, List, Tuple
import numpy as np

# Truth Domain T (Kleene strong 3-valued logic)
class TruthValue(str, Enum):
    TRUE = "TRUE"
    FALSE = "FALSE"
    UNKNOWN = "UNKNOWN"

# Execution Resolution Status R
class ResolutionStatus(str, Enum):
    COMPLETE = "COMPLETE"
    NEEDS_REFINEMENT = "NEEDS_REFINEMENT"
    UNRESOLVABLE_SAMPLING = "UNRESOLVABLE_SAMPLING"
    UNSUPPORTED_GEOMETRY = "UNSUPPORTED_GEOMETRY"
    UNSUPPORTED_SEMANTICS = "UNSUPPORTED_SEMANTICS"
    ERROR = "ERROR"

# Canonical Numerical Constants
NUMERICAL_EPSILON_ANGSTROM: float = 1e-6       # Boundary ambiguity epsilon
MAX_DISPLACEMENT_RATIO: float = 0.25           # Algorithmic guard: L / 4 per frame
DEFAULT_BLOCK_SIZE: int = 100                  # Standard benchmark starting partition
VALID_BLOCK_SIZES: Tuple[int, ...] = (10, 25, 50, 100, 250, 500)

# Kleene 3-Valued Logic Algebra
def kleene_and(a: TruthValue, b: TruthValue) -> TruthValue:
    if a == TruthValue.FALSE or b == TruthValue.FALSE:
        return TruthValue.FALSE
    if a == TruthValue.TRUE and b == TruthValue.TRUE:
        return TruthValue.TRUE
    return TruthValue.UNKNOWN

def kleene_or(a: TruthValue, b: TruthValue) -> TruthValue:
    if a == TruthValue.TRUE or b == TruthValue.TRUE:
        return TruthValue.TRUE
    if a == TruthValue.FALSE and b == TruthValue.FALSE:
        return TruthValue.FALSE
    return TruthValue.UNKNOWN

def kleene_not(a: TruthValue) -> TruthValue:
    if a == TruthValue.TRUE:
        return TruthValue.FALSE
    if a == TruthValue.FALSE:
        return TruthValue.TRUE
    return TruthValue.UNKNOWN

@dataclass(frozen=True)
class MOCSResult:
    """
    Immutable result object representing the computational outcome of a query.
    Decouples mathematical truth value from execution resolution status.
    """
    truth_value: str          # 'TRUE', 'FALSE', 'UNKNOWN'
    resolution_status: str    # 'COMPLETE', 'NEEDS_REFINEMENT', 'UNRESOLVABLE_SAMPLING', 'UNSUPPORTED_GEOMETRY', 'UNSUPPORTED_SEMANTICS', 'ERROR'
    query_id: str
    plan_used: str            # 'Plan-A', 'Plan-B', 'Plan-C', 'Plan-D'

    # Quantitative Multi-Tier Execution Metrics
    bytes_read_os: int = 0
    bytes_read_decompressed: int = 0
    frames_decoded: int = 0
    frames_evaluated: int = 0
    coordinates_materialized: int = 0
    atoms_analyzed: int = 0
    index_bytes_read: int = 0

    # Backward-compatible summary metrics
    bytes_read: int = 0
    read_fraction: float = 1.0
    wall_time_seconds: float = 0.0
    peak_memory_bytes: int = 0

    # Evidence Structure
    blocks_total: int = 0
    blocks_certified: int = 0
    blocks_refined: int = 0
    frames_scanned_exact: int = 0

    # Scope and Quantifier
    scope: str = "FULL_TRAJECTORY"
    quantifier: str = "EXISTS"

    # Exact frame-level observations (populated if exact scan was triggered)
    frame_series: Optional[np.ndarray] = None

    # Satisfied event intervals under half-open notation [k_s, k_e)
    intervals: Optional[List[Tuple[int, int]]] = None

    # Complete machine-verifiable execution certificate
    certificate: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None

    def is_certified(self) -> bool:
        """Returns True if result is resolved with definitive truth value."""
        return self.resolution_status == ResolutionStatus.COMPLETE.value and self.truth_value in (
            TruthValue.TRUE.value, TruthValue.FALSE.value
        )

    def to_json(self) -> str:
        """Serializes result and certificate to JSON string."""
        return json.dumps(self.certificate, indent=2)

@dataclass(frozen=True)
class ObservabilityContract:
    """Formal observability contract C = (Q, epsilon, tau, policy)."""
    query_id: str
    observable: str
    operands: Dict[str, str]
    predicate_op: str
    threshold: float
    pbc_mode: str = "orthorhombic_minimum_image"
    dt_ps: float = 10.0
    epsilon_r: float = 1e-6
    tau_min_ps: float = 10.0
    allow_refinement: bool = True
