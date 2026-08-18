# DATA_PROVENANCE.md — MOCS-Cert Data Provenance and Reproducibility Specification

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Research Baseline  
**Canonical Owner:** `DATA_PROVENANCE.md` is the authoritative specification for cryptographic digests, environment metadata, and two-tier provenance verification in MOCS-Cert. Tracked in [`DOC_MANIFEST.yaml`](../DOC_MANIFEST.yaml).  
**Cross-References:** [`CERTIFICATE_SPEC.md`](CERTIFICATE_SPEC.md), [`THREAT_MODEL.md`](THREAT_MODEL.md), [`MOBENCH_SPEC.md`](MOBENCH_SPEC.md), [`DECISION_LOG.md`](DECISION_LOG.md).

---

## 1. Provenance Philosophy

In computational biophysics, reproducibility failures routinely stem from untracked parameter drift: subtle differences in topology atom numbering, unit conversion ambiguities (nm vs. Å), undocumented trajectory frame slicing, or unrecorded library versions.

MOCS-Cert treats **data provenance as an active cryptographic invariant**. Every execution plan, intermediate cache record, sidecar index, and verified certificate contains an immutable provenance manifest.

```
                           THE PROVENANCE CHAIN
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       ▼                            ▼                            ▼
[Source Hashes]            [Physical Environment]       [Software Versions]
• Trajectory SHA-256       • Box vectors (Lx, Ly, Lz)   • MOCS-Cert semantic tag
• Topology SHA-256         • Sampling step dt (ps)      • MDAnalysis / NumPy
• Frame offset seek table  • Unit standard (A, ps)      • Operator version (v1)
       │                            │                            │
       └────────────────────────────┼────────────────────────────┘
                                    ▼
                     Immutable Execution Certificate
                  (Machine-Verifiable Proof of Provenance)
```

### 1.1 Two-Tier Identity Verification Architecture
To reconcile interactive developer ergonomics with forensic audit requirements:
* **Tier 1 (Fast Metadata Check):** For interactive runtime sessions, MOCS-Cert verifies file size, modification timestamp (`mtime`), and inode metadata ($< 1\ \text{ms}$) to rapidly detect file alterations without scanning multi-gigabyte files.
* **Tier 2 (Cryptographic SHA-256 Audit):** For forensic auditing, publication validation, cold verification (`mocs verify`), or when Tier 1 detects potential divergence, full cryptographic SHA-256 digests are computed over the source bytes.

---

## 2. Mandatory Provenance Attributes

Every MOCS-Cert Execution Certificate and Level 0 index manifest must capture the following eleven provenance dimensions:

### 2.1 Trajectory File Cryptographic Digest
* **Specification:** Standard SHA-256 computed over the complete raw binary contents of the trajectory file (`.xtc`, `.dcd`, `.trr`).
* **Format:** 64-character lowercase hexadecimal string.
* **Role:** Detects byte-level corruption, frame additions, or file replacement.

### 2.2 Topology File Cryptographic Digest
* **Specification:** Standard SHA-256 computed over the raw contents of the molecular topology file (`.tpr`, `.pbd`, `.gro`).
### 2.2 Molecular Topology Provenance
* **Topology File Format:** Standard formats supported in V0.1 are strictly **PDB**, **GRO**, and **TPR**.
* **Cryptographic Topology SHA-256:** Cryptographic digest computed over the raw topology file on disk.
* **Structural Metadata Verification:** To ensure semantic consistency beyond raw bytes, the manifest records:
  - `atom_count`: Total number of atoms defined in topology.
  - `bond_count`: Total number of covalent bonds registered in the connectivity graph.
  - `residue_count`: Total number of residues.
  - `selection_canonicalization_version`: Semantic version tag of atom selector parser.
* **Role:** Ensures that atom names, residue indices, and covalent bond graphs remain strictly identical across re-runs.

### 2.3 Trajectory Scale and Index Space
* **Total Frame Count ($N$):** Integer count of discrete temporal frames.
* **Atom Count ($n$):** Integer count of coordinates per frame.
* **Coordinate Precision:** Declared precision of source storage (e.g. 16-bit compressed integer, 32-bit float, 64-bit float).

### 2.4 Temporal Sampling Metadata
* **Timestep ($\Delta t$):** Elapsed physical simulation time between consecutive frames, expressed in picoseconds ($\text{ps}$).
* **Temporal Domain:** $[t_{\text{start}}, t_{\text{end}}]$ in picoseconds.
* **Uniformity Declaration:** Boolean flag indicating whether $\Delta t$ is strictly constant across all frame transitions.

### 2.5 Dimensional Units and Conversion Policy
* **Length Unit:** Canonical internal unit is strictly **Ångströms ($\text{Å}$)**. Trajectory readers (such as MDAnalysis) automatically normalize trajectory coordinates (e.g. converting nanometers to Ångströms). An explicit scale factor of $10.0$ is recorded when converting from nm.
* **Time Unit:** Canonical internal unit is strictly **picoseconds ($\text{ps}$)**.
* **Angle Unit:** Degrees ($^\circ$) for threshold input, converted internally to radians for trigonometric evaluation.

### 2.6 Simulation Cell and Boundary Conventions
* **Cell Tensor:** Diagonal lengths $(L_x, L_y, L_z)$ in Ångströms.
* **PBC Protocol:** `orthorhombic_minimum_image` (V0.1) or `none`.
* **Wrapping Status:** Documents whether source coordinates were stored wrapped in-cell or unwrapped.

### 2.7 Versioned Operator Identifiers
* Every operator evaluated in the query plan records an explicit semantic version tag (e.g. `DISTANCE-v1.0.0`, `CONTACT-v1.0.0`, `HBOND-v1.0.0`).
* If an operator's internal tie-breaking or numerical tolerance changes in a future release, the version tag increments, preventing stale index reuse.

### 2.8 Compiler and Execution Plan Provenance
* **MOCS Semantic Version:** e.g. `0.1.0`.
* **Git Commit Hash:** Full 40-character commit SHA of the running software.
* **Execution Plan ID:** The chosen plan archetype (`Plan-A`, `Plan-B`, `Plan-C`, `Plan-D`).

### 2.9 Execution Environment and Hardware Context
For benchmark and performance provenance:
* Host CPU model name and microarchitecture.
* Installed system RAM (GB) and storage media type (NVMe, SATA SSD, HDD).
* Operating System platform, kernel version, and Python interpreter build.

---

## 3. Two-Tier Identity Verification Architecture

MOCS-Cert strictly separates fast interactive caching checks from cryptographic verification:

### 3.1 Mode 1: Fast Interactive Integrity (`integrity-fast`)
To avoid hashing multi-gigabyte trajectory archives on every interactive query (which would negate all query acceleration), the runtime evaluates platform-specific metadata:
* **POSIX (Linux / macOS):** Fast identity tuple `(st_size, st_mtime_ns, st_ino)`.
* **Windows (NTFS):** Fast identity tuple `(file_size_bytes, mtime_ns, file_index)`.

*Explicit Semantic Caveat:* `integrity-fast` is an I/O bypass heuristic for local development. It does **not** cryptographically prove $H(T) = H(T_{\text{cert}})$ against adversarial file tampering or hash collision.

### 3.2 Mode 2: Forensic Cryptographic Audit (`integrity-forensic`)
Full SHA-256 byte streaming audit over the entire trajectory and topology files. This mode is mandatory during:
1. Initial Level 0 index generation (`mocs index build`).
2. Standalone offline verification (`mocs verify --forensic`).
3. Publication artifact certification.

```python
import os
import hashlib
from typing import Dict, Any

def audit_data_provenance(
    manifest: Dict[str, Any],
    traj_path: str,
    topo_path: str,
    mode: str = "integrity-fast"
) -> bool:
    """
    Verifies source trajectory and topology identity.
    mode='integrity-fast': Checks platform-specific metadata (size, mtime, inode).
    mode='integrity-forensic': Computes streaming SHA-256 digests.
    """
    if not os.path.exists(traj_path):
        raise FileNotFoundError(f"Trajectory missing: {traj_path}")
    if not os.path.exists(topo_path):
        raise FileNotFoundError(f"Topology missing: {topo_path}")

    # 1. Tier 1 Fast Metadata Check
    actual_size = os.path.getsize(traj_path)
    expected_size = manifest["source"].get("trajectory_size_bytes")
    if expected_size and actual_size != expected_size:
        raise ValueError(f"Trajectory size mismatch! Expected {expected_size}, got {actual_size}")

    if mode == "integrity-fast":
        return True

    # 2. Tier 2 Full Forensic SHA-256 Digest Audit
    hasher_traj = hashlib.sha256()
    with open(traj_path, "rb") as f:
        while chunk := f.read(1024 * 1024):
            hasher_traj.update(chunk)
    actual_traj_hash = hasher_traj.hexdigest()

    if actual_traj_hash != manifest["source"]["trajectory_sha256"]:
        raise ValueError(f"Forensic Error: Trajectory SHA-256 digest mismatch.")

    hasher_topo = hashlib.sha256()
    with open(topo_path, "rb") as f:
        while chunk := f.read(1024 * 1024):
            hasher_topo.update(chunk)
    actual_topo_hash = hasher_topo.hexdigest()

    if actual_topo_hash != manifest["source"]["topology_sha256"]:
        raise ValueError(f"Forensic Error: Topology SHA-256 digest mismatch.")

    return True

---

## 4. Benchmark Reproducibility Invariant

Any performance figure, speedup ratio, or break-even query count published in project documentation or academic papers must satisfy the **MOBench Reproducibility Standard**:

1. **Self-Contained Configuration:** A standalone JSON or YAML benchmark file containing the exact query list, dataset hashes, and random seeds must accompany the result.
2. **Deterministic Scripting:** Running the recorded CLI command (`mocs benchmark run --config <file>`) must re-execute the experiment identically.
3. **Automated Figure Generation:** No chart, plot, or LaTeX table may be manually edited; all visual artifacts must be automatically generated from raw CSV result logs via Python plotting scripts located in `mocs/benchmark/plots/`.
