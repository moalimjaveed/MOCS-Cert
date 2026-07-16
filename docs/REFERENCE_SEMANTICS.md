# REFERENCE_SEMANTICS.md — MOCS-Cert Reference Semantics Engine

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Research Baseline  
**Canonical Owner:** `REFERENCE_SEMANTICS.md` is the authoritative ground truth for all operator semantics and differential testing oracles in MOCS-Cert. Tracked in [`DOC_MANIFEST.yaml`](../DOC_MANIFEST.yaml).  
**Cross-References:** [`OBSERVABLE_OPERATOR_SPEC.md`](OBSERVABLE_OPERATOR_SPEC.md), [`CORRECTNESS_AND_VALIDATION.md`](CORRECTNESS_AND_VALIDATION.md), [`FUZZING_AND_ADVERSARIAL_TESTING.md`](FUZZING_AND_ADVERSARIAL_TESTING.md), [`KILL_CRITERIA.md`](KILL_CRITERIA.md).

---

## 1. Role and Philosophy of the Reference Engine

The MOCS Reference Engine (`mocs-reference`) is the authoritative ground truth for all operator semantics in MOCS-Cert. It is designed around the following non-negotiable principles:

1. **Simplicity Over Speed:** The reference engine deliberately contains zero indexing, zero geometric bounding envelopes, zero approximations, and zero pruning logic. It reads every single frame sequentially and calculates exact observables.
2. **Standard Library Grounding:** Implemented directly on trusted computational biology standards: [MDAnalysis](https://www.mdanalysis.org/), [MDTraj](https://mdtraj.org/), and [NumPy](https://numpy.org/).
3. **The Correctness Oracle:** An optimized execution plan is never judged correct merely because its output looks plausible or matches a published benchmark. The reference engine acts as the formal differential testing oracle.

```
                    Scientific Query Q
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
      [Reference Engine]        [Optimized Engine]
      • Brute-force scan        • MCI block bounds
      • MDAnalysis + NumPy      • Selective refinement
      • O(N) frames read        • O(Pruned) frames read
               │                         │
               ▼                         ▼
          Result R_ref              Result R_opt
               │                         │
               └────────────┬────────────┘
                            ▼
               [Differential Testing Check]
              • Does R_opt soundly match R_ref?
              • Any discrepancy -> Soundness Bug!
```

---

## 2. Complete Reference Python Implementations

The following Python code represents the normative reference implementation of the MOCS V0.1 operator suite:

### 2.1 Reference DISTANCE and CONTACT Evaluator

```python
import numpy as np
import MDAnalysis as mda
from typing import Tuple, Optional

def reference_distance(
    topology_path: str,
    trajectory_path: str,
    atom_a_sel: str,
    atom_b_sel: str,
    pbc_mode: str = "orthorhombic_minimum_image"
) -> np.ndarray:
    """
    Authoritative reference evaluator for DISTANCE observable.
    Iterates through all frames sequentially without indexing.
    Returns: 1D np.ndarray of shape (n_frames,) containing float64 distances in Angstroms.
    """
    if pbc_mode != "orthorhombic_minimum_image":
        raise NotImplementedError(f"Unsupported PBC mode in reference: {pbc_mode}")

    u = mda.Universe(topology_path, trajectory_path)
    ag_a = u.select_atoms(atom_a_sel)
    ag_b = u.select_atoms(atom_b_sel)

    if len(ag_a) != 1 or len(ag_b) != 1:
        raise ValueError(f"Selections must resolve to exactly 1 atom. Got {len(ag_a)} and {len(ag_b)}")

    idx_a = ag_a.indices[0]
    idx_b = ag_b.indices[0]

    n_frames = len(u.trajectory)
    distances = np.zeros(n_frames, dtype=np.float64)

    for k, ts in enumerate(u.trajectory):
        box = ts.dimensions[:3]  # [Lx, Ly, Lz]
        if box is None or np.any(box <= 0):
            raise ValueError(f"Frame {k} possesses invalid or non-orthorhombic simulation box.")

        pos_a = ts.positions[idx_a]
        pos_b = ts.positions[idx_b]

        # Explicit minimum-image displacement calculation
        delta = pos_b - pos_a
        delta -= box * np.round(delta / box)
        distances[k] = np.linalg.norm(delta)

    return distances

def reference_contact(
    topology_path: str,
    trajectory_path: str,
    atom_a_sel: str,
    atom_b_sel: str,
    cutoff: float
) -> np.ndarray:
    """
    Authoritative reference evaluator for CONTACT observable.
    Requires explicit cutoff parameter in Angstroms (no silent default).
    Returns: 1D np.ndarray of shape (n_frames,) containing booleans.
    """
    dist_series = reference_distance(topology_path, trajectory_path, atom_a_sel, atom_b_sel)
    return dist_series < cutoff
```

---

### 2.2 Reference HBOND Evaluator

```python
def reference_hbond(
    topology_path: str,
    trajectory_path: str,
    donor_sel: str,
    hydrogen_sel: str,
    acceptor_sel: str,
    d_cutoff: float = 3.5,
    angle_cutoff_deg: float = 120.0
) -> np.ndarray:
    """
    Authoritative reference evaluator for HBOND observable.
    Requires explicit hydrogen covalently bonded to donor.
    Returns: 1D np.ndarray of shape (n_frames,) of boolean states.
    """
    u = mda.Universe(topology_path, trajectory_path)
    d_atom = u.select_atoms(donor_sel)
    h_atom = u.select_atoms(hydrogen_sel)
    a_atom = u.select_atoms(acceptor_sel)

    if len(d_atom) != 1 or len(h_atom) != 1 or len(a_atom) != 1:
        raise ValueError("Donor, hydrogen, and acceptor selections must each resolve to 1 atom.")

    d_idx = d_atom.indices[0]
    h_idx = h_atom.indices[0]
    a_idx = a_atom.indices[0]

    # Verify covalent topology
    bonds = set(u.bonds.to_indices())
    if (min(d_idx, h_idx), max(d_idx, h_idx)) not in bonds:
        raise ValueError(f"Topology does not contain a covalent bond between donor {d_idx} and hydrogen {h_idx}")

    n_frames = len(u.trajectory)
    hbond_states = np.zeros(n_frames, dtype=bool)

    angle_cutoff_rad = np.deg2rad(angle_cutoff_deg)

    for k, ts in enumerate(u.trajectory):
        box = ts.dimensions[:3]
        pos_d = ts.positions[d_idx]
        pos_h = ts.positions[h_idx]
        pos_a = ts.positions[a_idx]

        # 1. Donor-Acceptor minimum-image distance
        delta_da = pos_a - pos_d
        delta_da -= box * np.round(delta_da / box)
        d_da = np.linalg.norm(delta_da)

        if d_da >= d_cutoff:
            hbond_states[k] = False
            continue

        # 2. Angle D - H ... A in common image frame centered on H
        v_hd = pos_d - pos_h
        v_hd -= box * np.round(v_hd / box)

        v_ha = pos_a - pos_h
        v_ha -= box * np.round(v_ha / box)

        norm_hd = np.linalg.norm(v_hd)
        norm_ha = np.linalg.norm(v_ha)
        if norm_hd < 1e-12 or norm_ha < 1e-12:
            raise ValueError("Zero-displacement coordinate singularity detected in HBOND triplet.")

        cos_theta = np.dot(v_hd, v_ha) / (norm_hd * norm_ha)
        cos_theta = np.clip(cos_theta, -1.0, 1.0)
        theta = np.arccos(cos_theta)

        hbond_states[k] = bool(theta >= angle_cutoff_rad)

    return hbond_states
```

---

### 2.3 Reference Temporal Operators

```python
def reference_temporal_for(
    boolean_series: np.ndarray,
    min_duration_ps: float,
    dt_ps: float,
    mode: str = "sampled_frames"
) -> Tuple[str, str]:
    """
    Authoritative reference evaluator for FOR(P, min_duration_ps).
    Under V0.1 sampled-frame semantics, each frame k occupies slot [t_k, t_{k+1}) of duration dt_ps.
    Returns: Tuple[truth_value, resolution_status]
    """
    if mode == "continuous_physical":
        # Continuous physical persistence cannot be proven from sampled frames without interpolation models
        return ("UNKNOWN", "UNSUPPORTED_SEMANTICS")

    if dt_ps <= 0:
        return ("UNKNOWN", "UNRESOLVABLE_SAMPLING")

    required_consecutive_frames = max(1, int(np.ceil(min_duration_ps / dt_ps)))

    # Find longest consecutive run of True
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
        return ("TRUE", "COMPLETE")
    else:
        return ("FALSE", "COMPLETE")
```

---

## 3. Disagreement Resolution and Soundness Policy

When the differential test suite compares the reference engine output against the optimized engine, the result matrix is strictly interpreted as follows:

| Reference Engine Truth ($R_{\text{ref}}$) | Optimized Truth ($\operatorname{truth\_value}$) | Optimized Resolution ($\operatorname{status}$) | Classification | Action Required |
|---|---|---|---|---|
| `TRUE` | `TRUE` | `COMPLETE` | **Sound Agreement** | None (Test Passes). |
| `FALSE` | `FALSE` | `COMPLETE` | **Sound Agreement** | None (Test Passes). |
| `TRUE` | `UNKNOWN` | `NEEDS_REFINEMENT` | **Incomplete but Sound** | Test Passes. Logged as refinement opportunity. |
| `FALSE` | `UNKNOWN` | `NEEDS_REFINEMENT` | **Incomplete but Sound** | Test Passes. Logged as refinement opportunity. |
| `TRUE` / `FALSE` | `UNKNOWN` | `UNRESOLVABLE_SAMPLING` | **Sampling Incomplete** | Test Passes (Sampling limit reached). |
| `TRUE` | `FALSE` | `COMPLETE` | **CRITICAL SOUNDNESS BUG** | **HARD STOP.** Pipeline halted; release blocked. |
| `FALSE` | `TRUE` | `COMPLETE` | **CRITICAL SOUNDNESS BUG** | **HARD STOP.** Pipeline halted; release blocked. |

### 3.1 Non-Negotiable Soundness Rule
Under no circumstances is the optimized engine assumed to be correct if it conflicts with the reference engine. In any disagreement between an exact brute-force scan and an indexed certificate, the optimized engine is treated as defective until mathematical or algorithmic inspection proves otherwise.
