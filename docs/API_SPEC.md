# API_SPEC.md — MOCS-Cert Python Application Programming Interface Specification

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Research Baseline  
**Canonical Owner:** `API_SPEC.md` is the authoritative specification for user-facing Python interfaces, session lifecycle, and result dataclasses in MOCS-Cert. Tracked in [`DOC_MANIFEST.yaml`](../DOC_MANIFEST.yaml).  
**Cross-References:** [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md), [`CERTIFICATE_SPEC.md`](CERTIFICATE_SPEC.md), [`OBSERVABLE_OPERATOR_SPEC.md`](OBSERVABLE_OPERATOR_SPEC.md), [`FORMAL_SEMANTICS.md`](FORMAL_SEMANTICS.md).

---

## 1. Architectural Philosophy and Scope

The MOCS-Cert Python API is the primary user-facing interface for V0.1. It is designed around the following developer and scientist requirements:
1. **Familiarity & Mixed Acceleration:** Native interoperation with standard scientific Python objects ([NumPy](https://numpy.org/), [MDAnalysis](https://www.mdanalysis.org/)), accelerated via hardware-adaptive mixed array execution using [CuPy](https://cupy.dev/) (CUDA/ROCm GPU parallelism) and [JAX](https://jax.readthedocs.io/) (OpenXLA JIT kernel fusion).
2. **Deterministic Typing:** Fully annotated Python 3.9+ type signatures.
3. **Transparent Execution:** Clear visibility into whether a query was resolved via Level 1 index bounds vs. exact coordinate scanning.
4. **Epistemic Rigor:** Structured result types that faithfully expose the 3-valued truth domain and execution resolution statuses defined in [`FORMAL_SEMANTICS.md`](FORMAL_SEMANTICS.md).

*(Notice: This document defines the API specification; actual implementation code resides in the `mocs/` package).*

---

## 2. Exception Hierarchy

MOCS-Cert implements a structured exception hierarchy to ensure distinct, non-conflated failure reporting:

```python
class MOCSError(Exception):
    """Base exception for all errors raised by MOCS-Cert."""
    pass

class MOCSFileNotFoundError(MOCSError, FileNotFoundError):
    """Raised when declared trajectory or topology files cannot be found on disk."""
    pass

class MOCSDataIntegrityError(MOCSError):
    """Raised when SHA-256 digests do not match recorded provenance manifests."""
    pass

class MOCSInvalidTopologyError(MOCSError):
    """Raised when atom selectors fail to resolve, or topology connectivity is missing."""
    pass

class MOCSUnsupportedGeometryError(MOCSError):
    """Raised when encountering non-orthorhombic, triclinic, or variable-volume simulation cells."""
    pass

class MOCSSelectionResolutionError(MOCSError):
    """Raised when an atom selection string matches 0 atoms or >1 atom in pairwise mode."""
    pass

class MOCSStaleIndexError(MOCSError):
    """Raised when sidecar index files fail cryptographic validity checks against source files."""
    pass

class MOCSVerificationError(MOCSError):
    """Raised when a certificate fails mathematical or provenance audit."""
    pass
```

---

## 3. Core Classes and Return Dataclasses

### 3.1 `MOCSResult`

The immutable return value emitted by all query and refinement methods:

```python
from dataclasses import dataclass
from typing import Dict, Any, Optional, List, Tuple
import numpy as np

@dataclass(frozen=True)
class MOCSResult:
    """
    Immutable result object representing the computational outcome of a query.
    Decouples mathematical truth value from execution resolution status.
    """
    truth_value: str
    # One of: 'TRUE', 'FALSE', 'UNKNOWN'

    resolution_status: str
    # One of: 'COMPLETE', 'NEEDS_REFINEMENT', 'UNRESOLVABLE_SAMPLING', 
    #         'UNSUPPORTED_GEOMETRY', 'UNSUPPORTED_SEMANTICS', 'ERROR'
    
    quantifier: str  # 'EXISTS', 'FORALL', 'DURATION'
    query_id: str
    plan_used: str   # 'Plan-A', 'Plan-B', 'Plan-C', 'Plan-D'
    
    # Quantitative Multi-Tier Execution Metrics
    source_compressed_bytes_fetched: int
    compressed_frames_decoded: int
    coordinates_materialized: int
    atoms_analyzed: int
    index_bytes_read: int
    wall_time_seconds: float
    peak_memory_bytes: int
    
    # Evidence Structure
    blocks_total: int
    blocks_certified: int
    blocks_refined: int
    frames_scanned_exact: int
    
    # Exact frame-level observations (populated if exact scan was triggered)
    frame_series: Optional[np.ndarray] = None
    
    # Satisfied event intervals under half-open notation [k_s, k_e)
    intervals: Optional[List[Tuple[int, int]]] = None
    
    # Complete content-addressed execution certificate
    certificate: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None

    def is_certified(self) -> bool:
        """Returns True if result is resolved with definitive truth value."""
        return self.resolution_status == "COMPLETE" and self.truth_value in ("TRUE", "FALSE")

    def to_json(self) -> str:
        """Serializes result and certificate to JSON string."""
        import json
        return json.dumps(self.certificate, indent=2)


---

## 4. Primary API Signatures

### 4.1 `mocs.open`

```python
def open(
    trajectory_path: str,
    topology_path: str,
    sidecar_dir: Optional[str] = None,
    pbc_mode: str = "orthorhombic_minimum_image",
    dt_ps: Optional[float] = None,
    force_dt: bool = False,
    enforce_hashes: bool = True,
    device: str = "auto",
    array_backend: str = "mixed"
) -> MOCSSession:
    """
    Initializes a certified molecular observation session over an existing trajectory
    (lazy Level-1 index construction with eager Level-0 validation).
    
    Parameters:
        trajectory_path: Path to existing .xtc, .dcd, or .trr trajectory file.
        topology_path: Path to matching .tpr, .gro, or .pdb topology file.
        sidecar_dir: Custom path for .mocs sidecar. Defaults to '<trajectory_path>.mocs/'.
        pbc_mode: Periodic boundary convention. Currently restricted to 'orthorhombic_minimum_image'.
        dt_ps: Optional sampling interval in picoseconds. If the trajectory contains authoritative
               timestamps, overriding dt_ps requires force_dt=True and logs 'user_override' in provenance.
        force_dt: Explicit authorization to override trajectory header timestamps.
        enforce_hashes: If True, computes and validates SHA-256 source file digests.
        
    Returns:
        MOCSSession object binding the trajectory to the compiler runtime.
    """
```

---

### 4.2 `MOCSSession.query`

```python
def query(
    self,
    observable: str,
    operands: Union[Tuple[str, str], Dict[str, str]],
    predicate: str,
    temporal: Optional[Dict[str, Any]] = None,
    block_size: int = 100,
    allow_refinement: bool = True
) -> MOCSResult:
    """
    Submits a declarative observable question to the certified compiler.
    """
```

---

### 4.3 `MOCSSession.compile`

```python
def compile(
    self,
    selections: List[str],
    block_size: int = 100,
    force_rebuild: bool = False
) -> None:
    """
    Pre-materializes Level 1 MCI motion summaries (AABB envelopes) for declared selections.
    """
```

---

### 4.4 `MOCSSession.refine`

```python
def refine(
    self,
    result: MOCSResult,
    target_block_size: int = 25,
    max_frames_to_read: Optional[int] = None
) -> MOCSResult:
    """
    Takes an UNKNOWN query result and performs selective hierarchical subdivision.
    
    Parameters:
        result: A previously returned MOCSResult with truth_value == 'UNKNOWN' and
                resolution_status == 'NEEDS_REFINEMENT'.
        target_block_size: Finer block granularity to subdivide into.
        max_frames_to_read: Optional resource budget limit.
        
    Returns:
        Updated MOCSResult with tightened bounds or definitive certification.
    """
```

---

### 4.5 Standalone Verification APIs

```python
def verify_certificate(
    certificate_path: str,
    trajectory_path: Optional[str] = None,
    topology_path: Optional[str] = None,
    mci_path: Optional[str] = None,
    forensic: bool = False
) -> bool:
    """
    Independently audits an emitted execution certificate without full re-execution.
    Validates schema, source digests, MCI commitments, coverage, and deductive inequalities.
    """

def diff_against_reference(
    session: MOCSSession,
    result: MOCSResult,
    observable: str,
    operands: Any,
    predicate: str,
    temporal: Optional[Dict[str, Any]] = None
) -> bool:
    Raises MOCSVerificationError on any truth value or resolution disagreement.
    """
```


---

## 5. End-to-End Practical Usage Examples

### 5.1 Example 1: Basic Contact Query with Sidecar Indexing

```python
import mocs

# 1. Open session over existing GROMACS simulation files
session = mocs.open(
    trajectory_path="trajectories/prod_1us.xtc",
    topology_path="topologies/system.tpr"
)

# 2. Execute spatial contact query
result = session.query(
    observable="contact",
    operands=("A:155:CA", "LIG:1:O2"),
    predicate="< 4.0 A",
    block_size=100
)

print(f"Truth Value:       {result.truth_value}")         # e.g. 'TRUE'
print(f"Resolution Status: {result.resolution_status}")   # e.g. 'COMPLETE'
print(f"Plan Executed:     {result.plan_used}")           # e.g. 'Plan-D'
print(f"Trajectory Read:   {result.read_fraction * 100:.2f}% of bytes")
print(f"Execution Time:    {result.wall_time_seconds:.3f} s")

# 3. Access verified certificate
certificate = result.certificate
print(f"Certificate Hash: {certificate['source']['trajectory_sha256']}")
```

---

### 5.2 Example 2: Complex Hydrogen Bond Precedence (BEFORE)

```python
import mocs

session = mocs.open("trajectories/run.xtc", "topologies/system.tpr")

# Execute temporal precedence query directly via contract
precedence_res = session.query(
    observable="hbond",
    operands={
        "donor": "A:155:NE2",
        "hydrogen": "A:155:HE2",
        "acceptor": "LIG:1:O1"
    },
    predicate="< 3.5 A",
    temporal={
        "operator": "BEFORE",
        "target_observable": "contact",
        "target_operands": ("A:200:CA", "LIG:1:C5"),
        "target_predicate": "< 4.5 A"
    }
)

print(f"Precedence Truth: {precedence_res.truth_value} (status: {precedence_res.resolution_status})")
```

---

### 5.3 Example 3: Offline Verification of Published Certificate

```python
import mocs

try:
    is_valid = mocs.verify(
        certificate_path="certificates/e7b8c381.json",
        trajectory_path="trajectories/run.xtc",
        topology_path="topologies/system.tpr"
    )
    print("Certificate Audit Passed: Deductively Sound.")
except mocs.MOCSVerificationError as err:
    print(f"AUDIT FAILED: {err}")
```
