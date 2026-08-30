"""
MOCS-Cert: Molecular Observability Compiler for Certified Query Execution.
V0.1.0 Design Baseline (Audit Revisions Applied).
"""

__version__ = "0.1.0"
__author__ = "MOCS-Cert Core Team"

# Epistemic domains & types
from mocs.types import (
    TruthValue,
    ResolutionStatus,
    MOCSResult,
    ObservabilityContract,
    kleene_and,
    kleene_or,
    kleene_not
)

# Structured Exceptions
from mocs.exceptions import (
    MOCSError,
    MOCSFileNotFoundError,
    MOCSDataIntegrityError,
    MOCSInvalidTopologyError,
    MOCSUnsupportedGeometryError,
    MOCSSelectionResolutionError,
    MOCSStaleIndexError,
    MOCSVerificationError
)

# Mathematical Bounds
from mocs.bounds.periodic_cell import PeriodicCell
from mocs.bounds.periodic_bounds import (
    validate_orthorhombic_box,
    minimum_image_displacement,
    compute_pbc_bounds,
    verify_refinement_non_expansion
)
from mocs.bounds.kdop import (
    KDOP14,
    KDOP14_DIRECTIONS,
    CANONICAL_DIRECTIONS_14,
    NUM_KDOP14_DIRECTIONS,
    NUM_KDOP14_HALF_SPACES,
    KDOP14_MODEL_VERSION
)

# Reference Oracle
from mocs.reference.distance import reference_distance
from mocs.reference.contact import reference_contact
from mocs.reference.hbond import reference_hbond
from mocs.reference.temporal import (
    reference_temporal_for,
    extract_half_open_intervals
)

# Certificate & Auditing
from mocs.certificates.auditor import (
    verify_certificate,
    diff_against_reference,
    audit_data_provenance,
    compute_file_sha256
)

# Planner & High-Level Session API (lazy loaded to decouple independent verification)
_LAZY_MODULE_EXPORTS = {
    "select_execution_plan": ("mocs.planner.plan_selector", "select_execution_plan"),
    "HardwareCostWeights": ("mocs.planner.plan_selector", "HardwareCostWeights"),
    "MOCSSession": ("mocs.session", "MOCSSession"),
    "open": ("mocs.session", "open_session"),
    "open_session": ("mocs.session", "open_session"),
    "verify": ("mocs.session", "verify_file"),
    "verify_file": ("mocs.session", "verify_file"),
}

def __getattr__(name: str):
    if name in _LAZY_MODULE_EXPORTS:
        mod_name, attr_name = _LAZY_MODULE_EXPORTS[name]
        import importlib
        mod = importlib.import_module(mod_name)
        val = getattr(mod, attr_name)
        globals()[name] = val
        return val
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")

# Hybrid Array Acceleration Layer (JAX + NumPy + CuPy)
from mocs.arrays import (
    BackendType,
    detect_optimal_backend,
    get_array_module,
    batch_compute_aabb,
    batch_derive_pairwise_bounds
)

__all__ = [
    "__version__",
    "TruthValue",
    "ResolutionStatus",
    "MOCSResult",
    "ObservabilityContract",
    "kleene_and",
    "kleene_or",
    "kleene_not",
    "MOCSError",
    "MOCSFileNotFoundError",
    "MOCSDataIntegrityError",
    "MOCSInvalidTopologyError",
    "MOCSUnsupportedGeometryError",
    "MOCSSelectionResolutionError",
    "MOCSStaleIndexError",
    "MOCSVerificationError",
    "PeriodicCell",
    "validate_orthorhombic_box",
    "minimum_image_displacement",
    "compute_pbc_bounds",
    "verify_refinement_non_expansion",
    "KDOP14",
    "KDOP14_DIRECTIONS",
    "CANONICAL_DIRECTIONS_14",
    "NUM_KDOP14_DIRECTIONS",
    "NUM_KDOP14_HALF_SPACES",
    "KDOP14_MODEL_VERSION",
    "reference_distance",
    "reference_contact",
    "reference_hbond",
    "reference_temporal_for",
    "extract_half_open_intervals",
    "verify_certificate",
    "diff_against_reference",
    "audit_data_provenance",
    "compute_file_sha256",
    "select_execution_plan",
    "HardwareCostWeights",
    "MOCSSession",
    "open",
    "verify",
    "BackendType",
    "detect_optimal_backend",
    "get_array_module",
    "batch_compute_aabb",
    "batch_derive_pairwise_bounds"
]
