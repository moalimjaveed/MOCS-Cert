# PROJECT_SCOPE.md

## MOCS-Cert V0.1 — Scope Definition

**Document version:** 0.1.0 / Research Baseline  
**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Canonical Owner:** `PROJECT_SCOPE.md` defines normative scope boundaries and feature exclusions for V0.1. Tracked in [`DOC_MANIFEST.yaml`](../DOC_MANIFEST.yaml).  
**Cross-references:** [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md), [LIMITATIONS.md](LIMITATIONS.md), [ROADMAP.md](ROADMAP.md), [DECISION_LOG.md](DECISION_LOG.md)

---

## 1. Purpose of This Document

This document defines precisely what MOCS-Cert V0.1 is and is not. It exists to prevent scope creep during the research prototype phase and to establish an unambiguous boundary against which implementation, benchmarking, and publication claims can be evaluated.

Every capability, assumption, file format, operator, and deployment target that is not listed in the In Scope section of this document is Out of Scope for V0.1 unless explicitly promoted by a documented decision in [DECISION_LOG.md](DECISION_LOG.md).

The primary use of this document is:

- To tell developers what to build.
- To tell benchmarkers what to test.
- To tell reviewers what claims can and cannot be made.
- To protect the research timeline from feature additions that have not been justified by experimental evidence.

---

## 2. Intended Users

MOCS-Cert V0.1 targets researchers and developers in the following categories:

| User Category | Description |
|---------------|-------------|
| Computational biophysicists | Researchers running or analyzing MD simulations of proteins, protein-ligand systems, and membrane systems |
| Structural biologists | Researchers interpreting simulation data alongside experimental structural information |
| MD simulation researchers | Developers of simulation methodologies who need to efficiently query large trajectory archives |
| Scientific software developers | Developers of molecular analysis pipelines who need reproducible, provenance-rich query results |

MOCS-Cert V0.1 is **not** designed for:

- Experimental biologists with no simulation background.
- Production laboratory information management systems.
- Clinical or regulatory environments.
- Non-molecular data domains.

---

## 3. Intended Deployment Environments

| Environment | Supported in V0.1 |
|-------------|-------------------|
| Local workstation (Linux, macOS, Windows) | Yes |
| Single-node HPC node | Yes |
| Multi-node cluster or distributed computing | No |
| Cloud computing (AWS, GCP, Azure, etc.) | Not explicitly supported; may work if dependencies are installed |
| Web application or browser-based interface | No |
| GPU-enabled workstation | Yes (Accelerated via CuPy / JAX GPU with automatic CPU fallback) |
| Container environment (Docker, Singularity) | Not explicitly tested in V0.1 |

**Python requirement:** Python 3.9 or higher.

---

## 4. In Scope for V0.1

### 4.1 Trajectory File Formats

| Format | Reader | Notes |
|--------|--------|-------|
| XTC | MDAnalysis | GROMACS compressed trajectory |
| DCD | MDAnalysis | CHARMM/NAMD trajectory |
| TRR | MDAnalysis | GROMACS full-precision trajectory |

No new trajectory file format is introduced. The source trajectory file remains the authoritative data. The MOCS sidecar is a derived accelerator, not a replacement format.

### 4.2 Topology File Formats

| Format | Reader | Notes |
|--------|--------|-------|
| PDB | MDAnalysis | Protein Data Bank structure file |
| GRO | MDAnalysis | GROMACS coordinate/topology file |
| TPR | MDAnalysis | GROMACS portable binary run input file |

Topology files provide atom identity, residue assignments, and chemical role information required for HBOND evaluation. Topology is assumed to be static throughout the trajectory (see Assumptions).

### 4.3 Spatial Observables

| Observable | Certification Strategy | Exact Evaluation |
|------------|----------------------|-----------------|
| `DISTANCE` | AABB distance bounds per block — sound lower bound L and upper bound U derived from axis-aligned bounding boxes; L = sqrt(dx_min^2 + dy_min^2 + dz_min^2), U = sqrt(dx_max^2 + dy_max^2 + dz_max^2) | MDAnalysis + NumPy minimum-image distance |
| `CONTACT` | Inherits DISTANCE bounds; CONTACT(A, B, cutoff) iff DISTANCE(A, B) < cutoff | Same as DISTANCE with threshold comparison |
| `HBOND` | Distance bounds prune blocks where donor-acceptor distance exceeds cutoff; angular evaluation performed on surviving candidate frames | MDAnalysis donor/acceptor + angle evaluation |

### 4.4 Temporal Operators

| Operator | Certification | Notes |
|----------|--------------|-------|
| `FOR` | Certified TRUE if a contiguous run of TRUE blocks spans the required duration | Duration measured in declared frame dt units |
| `BEFORE` | Certified when $k_{e, A} \le k_{s, B}$ for half-open event intervals $A=[k_{s, A}, k_{e, A})$ and $B=[k_{s, B}, k_{e, B})$ | Formal definition in [FORMAL_SEMANTICS.md](FORMAL_SEMANTICS.md) |
| `AFTER` | Certified when $k_{s, A} \ge k_{e, B}$ | Symmetric to BEFORE |
| `FOLLOWED_BY` | Certified when BEFORE holds and maximum window constraint $\le W$ is satisfied | Window measured in trajectory time units |
| `WITHIN` | Certified when temporal separation $\max(0, k_{s, B} - k_{e, A}, k_{s, A} - k_{e, B})\Delta t \le W$ | Under sampled-frame semantics |

### 4.5 Periodic Boundary Conditions

- **Supported:** Fixed orthorhombic simulation boxes with minimum-image distance semantics.
- **Implementation:** Box dimensions Lx, Ly, Lz are read from trajectory metadata. The AABB distance bound computation accounts for periodic image relationships.
- **Boundary-crossing blocks:** When an atomic envelope straddles a periodic cell boundary, the computation is split into periodic patches; distance bounds are evaluated over relevant image combinations and the tightest valid bound is used.
- **Failure mode:** If a geometry is encountered that cannot be safely evaluated under orthorhombic minimum-image semantics, the system returns `UNSUPPORTED_GEOMETRY` rather than silently applying an incorrect bound.

### 4.6 Block Sizes

V0.1 supports the following configurable block sizes (frames per block):

| Block Size | Notes |
|------------|-------|
| 10 frames | Fine granularity; higher index cost, tighter bounds |
| 25 frames | |
| 50 frames | |
| 100 frames | Default starting point for benchmarks |
| 250 frames | |
| 500 frames | Coarse granularity; lower index cost, looser bounds |

The optimal block size is trajectory-dependent and must be determined empirically. The primary benchmark experiment measures bound tightness and pruning rate as a function of block size. A fixed block size must not be assumed universally optimal.

### 4.7 Reference Engine

The reference engine (`mocs-reference`) is an intentionally simple, exact implementation using MDAnalysis and NumPy. It defines the authoritative V0.1 semantics, produces ground-truth results for differential testing, and is deliberately not optimized. See [REFERENCE_SEMANTICS.md](REFERENCE_SEMANTICS.md).

### 4.8 AABB Envelope Indexing

For each selected atom and temporal block, an axis-aligned bounding box (AABB) is constructed that conservatively contains every stored position of that atom within the block:

```
B_i = [x_min, x_max] x [y_min, y_max] x [z_min, z_max]
```

This is a deterministic data bound, not a statistical physical model. Every stored position of atom i in the block is guaranteed to lie inside B_i, provided the source, topology, coordinate units, and PBC policy match the index metadata.

The Molecular Certificate Index (MCI) stores these envelopes at two levels:
- **Level 0:** Trajectory-global metadata (frame count, block boundaries, PBC type, source hashes).
- **Level 1:** Lazy, selection-specific motion summaries. Summaries are materialized on first query and reused by subsequent queries referencing the same selection.

### 4.9 Hierarchical Refinement

When a block returns `UNKNOWN`, MOCS-Cert subdivides it recursively:

```
Block N  (UNKNOWN)
    |-- Block N.a  -> evaluate
    |-- Block N.b  -> evaluate
    |-- Block N.c  -> evaluate
    +-- Block N.d  -> evaluate
```

Subdivision continues until the sub-block is either certified or reduced to exact frame evaluation. The system stops as soon as the contract predicate is satisfied or definitively falsified. Only the ambiguous regions of the trajectory are read exactly.

### 4.10 Certificate Generation

Every query result carries a machine-readable certificate (JSON) recording:
- Query operator, parameters, and predicate
- Declared semantics (sampling mode, dt, PBC convention, numerical precision)
- Source hashes (trajectory SHA-256, topology SHA-256)
- Evidence (blocks total, blocks certified, blocks refined, frames exactly scanned)
- Resource usage (bytes read, source size)
- Software version and operator version

Certificates document computational soundness relative to declared semantics. They do not assert biological truth. See [CERTIFICATE_SPEC.md](CERTIFICATE_SPEC.md).

### 4.11 Python API

The public API for V0.1 consists of canonical session and verification interfaces:

```python
mocs.open(trajectory, topology)               # opens trajectory and sidecar
mocs.query(...)                               # executes a query with given contract
mocs.compile(selections)                      # pre-materializes Level 1 MCI motion envelopes
mocs.refine(result)                           # manually triggers refinement of UNKNOWN result
mocs.verify(certificate, trajectory, topology)# standalone offline certificate audit
mocs.diff_against_reference(...)              # differential verification against reference oracle
```

See [API_SPEC.md](API_SPEC.md) for full signatures and return types.

---

## 5. Out of Scope for V0.1

The following are explicitly deferred. Implementing any of these in V0.1 without a documented decision in [DECISION_LOG.md](DECISION_LOG.md) constitutes scope creep.

| Category | Deferred Item |
|----------|--------------|
| **PBC geometry** | Triclinic periodic cells |
| **PBC geometry** | Time-varying simulation cell dimensions |
| **PBC geometry** | Multiple periodic dimensions beyond standard 3D |
| **Spatial observables** | Pocket volumes |
| **Spatial observables** | Domain motion / rigid-body displacement |
| **Spatial observables** | Secondary structure (helix, sheet content) |
| **Spatial observables** | Dihedral angles |
| **Spatial observables** | RMSD / RMSF |
| **Spatial observables** | Radius of gyration |
| **Temporal operators** | Causal operators beyond the five defined |
| **Temporal operators** | Continuous-time interpolation semantics |
| **Bounding geometry** | Oriented bounding boxes |
| **Bounding geometry** | k-DOPs (k-discrete orientation polytopes) |
| **Bounding geometry** | Sphere envelopes |
| **Bounding geometry** | Affine arithmetic bounds |
| **Topology** | Changing topology within a trajectory |
| **Topology** | Reactive MD (atoms changing identity) |
| **Implementation** | Rust runtime |
| **Implementation** | Distributed multi-node cluster execution (local GPU via CuPy/JAX is supported) |
| **Implementation** | SIMD vectorization |
| **Planner** | Machine-learned query optimizer |
| **Interface** | Declarative query language (DSL / MolQL) |
| **File format** | New trajectory container format |
| **File format** | Formats beyond XTC, DCD, TRR |
| **Topology format** | Formats beyond PDB, GRO, TPR |
| **Deployment** | Multi-node distributed execution |
| **Deployment** | Web application / browser interface |
| **Deployment** | Real-time streaming trajectory analysis |
| **Benchmark** | Biological claims about protein function |
| **Research** | Observable algebra (compositional soundness propagation) |
| **Research** | Molecular Transition Representation (MTR) |
| **Research** | Cross-protein transition motif mining |

---

## 6. Assumptions

The following assumptions must hold for MOCS-Cert V0.1 to operate correctly. Violations are detected where possible and result in `ERROR` or `UNSUPPORTED_GEOMETRY`; they are never silently ignored.

| Assumption | Implication if violated |
|------------|------------------------|
| **Static topology.** Atom identities, residue assignments, and bonding topology do not change during the trajectory. | If topology changes are detected or suspected, the query returns `ERROR`. |
| **Fixed orthorhombic box.** Simulation cell vectors are orthogonal (a || x, b || y, c || z) and remain constant throughout the trajectory. | Time-varying or non-orthorhombic boxes result in `UNSUPPORTED_GEOMETRY`. |
| **Atom identity does not change.** Each atom index refers to the same physical atom at every frame. | Reactive MD or topology-altering simulations are not supported. |
| **Source trajectory is authoritative.** The MOCS sidecar is a derived accelerator. If the source trajectory changes, the sidecar must be invalidated and rebuilt. | Sidecar is invalidated when source hash changes. A stale sidecar must never produce a certified answer. |
| **Sidecars are derived, disposable, and rebuildable.** No information exists exclusively in the sidecar that cannot be recomputed from the source and topology. | Users may safely delete the sidecar directory; all sidecar data is regenerable. |
| **Coordinate units are Angstroms.** All distance predicates and thresholds are interpreted in Angstroms. Readers (such as MDAnalysis) automatically normalize trajectory coordinates (e.g. from nm in XTC/GRO to Å). The MOCS contract explicitly enforces and records unit contracts. | Mismatched units produce an explicit error at contract validation. |
| **Frame timestamps are monotonically increasing.** The declared dt (timestep) is uniform across the trajectory. | Non-uniform sampling is not supported in V0.1 temporal operators. |
| **Float64 numerical precision.** All distance calculations use 64-bit floating point. | Enforced across NumPy, JAX, and CuPy array backends. Results may differ from analyses using float32. |

---

## 7. Supported Input Formats

### Trajectory Formats

| Format | Extension | Reader | Notes |
|--------|-----------|--------|-------|
| GROMACS XTC | `.xtc` | MDAnalysis | Compressed, single-precision coordinates |
| CHARMM/NAMD DCD | `.dcd` | MDAnalysis | Binary, may contain velocity |
| GROMACS TRR | `.trr` | MDAnalysis | Full precision; may contain velocities and forces |

### Topology Formats

| Format | Extension | Reader | Notes |
|--------|-----------|--------|-------|
| Protein Data Bank | `.pdb` | MDAnalysis | Must include CONECT records for HBOND |
| GROMACS coordinate | `.gro` | MDAnalysis | GROMACS structure file |
| GROMACS run input | `.tpr` | MDAnalysis | Portable binary run input; preferred for GROMACS data |

---

## 8. Unsupported Cases That Must Be Rejected

The following inputs must produce an explicit error or `UNSUPPORTED_GEOMETRY` result. Silent fallback to an incorrect result is a correctness bug.

| Case | Required Response |
|------|-----------------|
| Triclinic cell (non-orthorhombic box vectors) | `UNSUPPORTED_GEOMETRY` |
| Time-varying box dimensions | `UNSUPPORTED_GEOMETRY` |
| Missing topology atoms referenced in query | `ERROR` with descriptive message |
| Ambiguous atom selection (zero atoms matched) | `ERROR` with descriptive message |
| Ambiguous atom selection (multiple atoms when single expected) | `ERROR` or warning, depending on operator |
| Corrupted or truncated trajectory file | `ERROR` |
| Sidecar content hash mismatch with source | `ERROR`; sidecar must be rebuilt |
| Query predicate with unrecognized operator | `ERROR` at contract validation |
| Query referencing topology atoms absent from trajectory | `ERROR` |
| Non-orthorhombic periodic image request | `UNSUPPORTED_GEOMETRY` |
| Empty trajectory (zero frames) | `ERROR` |
| Block size configuration producing zero frames per block | `ERROR` |

---

## 9. Version Feature Breakdown

This section defines what is committed, planned, hypothetical, or out of scope for each major version. Entries in V0.2 and beyond are planning targets, not commitments; they are subject to revision based on experimental results.

| Capability | V0.1 | V0.2 | V1.0 | Later / Research | Explicitly Out |
|------------|------|------|------|-----------------|----------------|
| DISTANCE observable | Yes | Yes | Yes | — | — |
| CONTACT observable | Yes | Yes | Yes | — | — |
| HBOND observable | Yes | Yes | Yes | — | — |
| FOR temporal operator | Yes | Yes | Yes | — | — |
| BEFORE temporal operator | Yes | Yes | Yes | — | — |
| AFTER temporal operator | Yes | Yes | Yes | — | — |
| FOLLOWED_BY temporal operator | Yes | Yes | Yes | — | — |
| WITHIN temporal operator | Yes | Yes | Yes | — | — |
| Fixed orthorhombic PBC | Yes | Yes | Yes | — | — |
| AABB spatial envelopes | Yes | Yes | Yes | — | — |
| Hierarchical block refinement | Yes | Yes | Yes | — | — |
| Certificate generation (JSON) | Yes | Yes | Yes | — | — |
| Python API | Yes | Yes | Yes | — | — |
| Reference engine (mocs-reference) | Yes | Yes | Yes | — | — |
| Differential testing (mocs-fuzz) | Yes | Yes | Yes | — | — |
| XTC / DCD / TRR trajectory formats | Yes | Yes | Yes | — | — |
| PDB / GRO / TPR topology formats | Yes | Yes | Yes | — | — |
| Block sizes 10/25/50/100/250/500 | Yes | Yes | Yes | — | — |
| MCI Level 0 (trajectory-global metadata) | Yes | Yes | Yes | — | — |
| MCI Level 1 (lazy selection summaries) | Yes | Yes | Yes | — | — |
| Triclinic PBC | No | Planned | Yes | — | — |
| Time-varying simulation cell | No | Planned | Yes | — | — |
| Dihedral angle observable | No | Planned | Yes | — | — |
| RMSD / RMSF observable | No | No | Planned | — | — |
| Radius of gyration observable | No | No | Planned | — | — |
| Secondary structure observable | No | No | Planned | — | — |
| Oriented bounding boxes (OBB) | No | Research | Research | Research | — |
| Affine arithmetic bounds | No | No | Research | Research | — |
| Declarative query language (DSL) | No | Planned | Yes | — | — |
| Observable dependency DAG (compiler IR) | Partial | Yes | Yes | — | — |
| Cost-based planner with measured weights | Partial | Yes | Yes | — | — |
| Adaptive observable materialization | No | Planned | Yes | — | — |
| Multi-query workload reuse | No | Planned | Yes | — | — |
| Rust runtime for hot paths | No | Planned | Yes | — | — |
| GPU acceleration (CuPy / JAX) | Yes (Hybrid) | Yes | Yes | — | — |
| SIMD vectorization | No | Planned | Yes | — | — |
| Machine-learned query optimizer | No | No | No | Research | — |
| Causal temporal operators | No | No | Research | Research | — |
| Observable algebra (compositional soundness) | No | No | No | Research | — |
| Molecular Transition Representation (MTR) | No | No | No | Research | — |
| Cross-protein transition motif mining | No | No | No | Research | — |
| Web platform / UI Studio Workstation | Partial | Yes | Yes | — | — |
| New trajectory container format | No | No | No | No | Explicitly Out |
| Continuous-time interpolation semantics | No | No | No | Research | — |
| Pocket volume certification | No | No | Research | Research | — |
| Domain motion certification | No | No | Research | Research | — |
| Distributed multi-node cluster execution | No | No | No | Research | — |
| Universal molecular language (MolQL equivalent) | No | No | No | No | Explicitly Out |

---

## 10. Non-Goals

MOCS-Cert is explicitly **not** any of the following, and documentation must not imply otherwise.

**Not a trajectory compression format.**
MOCS does not compress or replace the source trajectory. The `.mocs/` sidecar is a derived index that can be deleted and rebuilt from the source file. Users who want compressed trajectory storage should use MDCompress or similar tools.

**Not an experimental biology validator.**
A `TRUE` or `FALSE` result with `COMPLETE` resolution status means the computation is sound relative to the declared source data, topology, and semantics. It does not mean the simulated molecule experimentally behaves that way. Simulation accuracy is determined by the force field, simulation parameters, and sampling quality — all of which are entirely outside MOCS-Cert's scope.

**Not a continuous-time simulator.**
MOCS-Cert reasons about stored frames under sampled-frame semantics. It makes no claim about what happens between frames. The result status `UNRESOLVABLE_SAMPLING` (with truth value `UNKNOWN`) is the explicit mechanism for communicating that a question cannot be answered from the available frame data.

**Not a universal MD language.**
MOCS-Cert does not introduce a new universal molecular query language in V0.1. The Python API is the interface. A declarative language is deferred to V0.2 at the earliest, and only after the Python model is validated.

**Not a replacement for MDAnalysis or MDTraj.**
MOCS-Cert is designed to work alongside these libraries, not replace them. The reference engine uses MDAnalysis internally. Users who prefer direct analysis should continue to use established tools.

**Not a production pipeline tool.**
MOCS-Cert is a research prototype. Its API, certificate format, file layout, and behavior may change between versions. It should not be used as a dependency in production analysis pipelines in V0.1.

---

## 11. Capability Table

See Section 9 for the complete version-stratified capability table covering 50 rows. The table uses the following column conventions:

| Column | Meaning |
|--------|---------|
| **V0.1** | Committed for initial research prototype |
| **V0.2** | Planned for second research prototype, contingent on V0.1 kill-test passage |
| **V1.0** | Planned for first stable release, contingent on V0.2 validation |
| **Later / Research** | A research hypothesis or long-term extension; not on the committed roadmap |
| **Explicitly Out** | Deliberately excluded from all versions of MOCS-Cert as currently conceived |

All V0.2 and later entries are planning targets subject to revision based on experimental evidence and kill-test results. See [ROADMAP.md](ROADMAP.md) for the full development timeline and [DECISION_LOG.md](DECISION_LOG.md) for the rationale behind major scope decisions.

---

*This document is normative for V0.1. Any feature addition or scope change requires an entry in [DECISION_LOG.md](DECISION_LOG.md) citing the experimental evidence or design rationale justifying the change.*
