# MOCS-Cert

**Molecular Observability Compiler for Certified Query Execution**

![Status: Design Baseline](https://img.shields.io/badge/status-design%20baseline%20(audit%20revisions)-orange)
![Version: 0.1](https://img.shields.io/badge/version-0.1-blue)
![Python: 3.9+](https://img.shields.io/badge/python-3.9%2B-blue)
![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue)

> **Design Baseline (V0.1.0 — Audit Revisions Applied) — research prototype, not production software.**
> Results, APIs, and performance characteristics are subject to change.
> See [§ Project Status](#project-status) and [§ Research vs Production](#research-vs-production-distinction).

---

## One-Sentence Definition

MOCS-Cert is a contract-driven molecular trajectory query system that compiles scientific questions into cost-efficient execution plans, uses conservative indexed bounds to certify predicates without scanning every frame, and selectively reads only unresolved trajectory regions.

---

## Table of Contents

1. [The Problem](#the-problem)
2. [Why Conventional Workflows Are Inefficient](#why-conventional-workflows-are-inefficient)
3. [Conceptual Architecture](#conceptual-architecture)
4. [Simple Example](#simple-example)
5. [Supported Operators](#supported-operators)
6. [Result Semantics](#result-semantics)
7. [Installation](#installation)
8. [Usage Examples](#usage-examples)
9. [Current Limitations (V0.1)](#current-limitations-v01)
10. [Project Status](#project-status)
11. [Research vs Production Distinction](#research-vs-production-distinction)
12. [Documentation Suite](#documentation-suite)

---

## The Problem

Molecular dynamics (MD) trajectories are increasingly large — multi-gigabyte files representing systems of millions of atoms over tens of thousands of stored timesteps. Many scientific questions, however, concern only a small fraction of that information: whether two atoms were ever closer than 4.0 Å during a specific time window, whether a hydrogen bond persisted for at least 100 ps, or whether one contact formed before another.

A conventional analysis workflow works **forward from coordinates**:

```
trajectory
    |
load frames
    |
select atoms
    |
compute distances / contacts / H-bonds
    |
construct event series
    |
filter or visualize
```

This workflow works correctly. The problem is that **the system does not know before execution which parts of the trajectory are actually needed to answer the scientific question.** It therefore reads and processes all frames, selecting after the fact.

MOCS-Cert inverts this direction. It starts from the scientific question and works **backward**:

```
question
    |
what information is actually needed?
    |
what can be ruled out cheaply using precomputed bounds?
    |
what must be read exactly?
    |
what can be cached for future related questions?
```

The primary research question is:

> *"Can a restricted but useful class of molecular trajectory questions be compiled into sound, workload-aware execution plans that inspect much less coordinate data than a full scan while preserving explicit semantics and reproducibility?"*

The secondary research question is:

> *"Can related molecular questions share intermediate observables and certificates sufficiently well that adaptive materialization beats both independent analysis and indiscriminate precomputation on exploratory workloads?"*

**MOCS-Cert does not claim to be the first trajectory database, the first compressed trajectory format, or the first molecular query language.** Prior systems including Dynameomics/MDX, MDAnalysis, MDTraj, MDCompress, and KATE have established the state of the art. The defensible contribution of MOCS-Cert is the integrated system of: declarative observable contracts, dependency-aware compilation, conservative block-level certification, three-valued predicate evaluation with an explicit unresolvable state, and selective source refinement.

---

## Why Conventional Workflows Are Inefficient

### The Conventional Forward Loop

A typical scripted analysis looks approximately like:

```python
import MDAnalysis as mda

u = mda.Universe("system.tpr", "run.xtc")
atom_a = u.select_atoms("resid 155 and name CA")
atom_b = u.select_atoms("resname LIG and name O2")

events = []
for ts in u.trajectory:                  # reads every frame in order
    d = distance(atom_a.positions[0],    # computes distance every frame
                 atom_b.positions[0],
                 box=ts.dimensions)
    if d < 4.0:
        events.append(ts.time)
```

Four inefficiencies arise at workload scale:

1. **No advance knowledge of relevance.** The loop cannot skip a frame without reading it, because it does not know which frames satisfy the predicate before evaluating them.

2. **Repeated atomic coordinate loading.** The same atoms are re-read and re-selected from disk at every timestep regardless of whether their block is geometrically capable of satisfying the predicate.

3. **No dependency reuse across queries.** If a researcher subsequently asks about `CONTACT(A:155, LIG:O2)` with a different threshold, or `HBOND(A:155, LIG:O2)`, the same coordinate scan is repeated from scratch. The structural relationship between DISTANCE, CONTACT, and HBOND — each depending on the same pairwise geometry — is not exploited.

4. **No result provenance.** The output contains no machine-readable record of the precise semantics (PBC convention, numerical precision, sampling assumptions) under which the answer was computed, making reproducibility dependent on the surrounding script.

### The Workload Target

MOCS-Cert is **not** intended to accelerate a single perfectly cached observable. If a researcher will ask exactly one question about a trajectory, computing that observable once and saving the result remains optimal.

MOCS-Cert targets **exploratory workloads**: scenarios where a researcher investigates many candidate atom pairs, thresholds, and time windows and will explore only a fraction of the combinatorial space. In that regime, computing every query independently wastes work because shared dependencies are not reused, and precomputing every possible observable wastes work because most observables are never queried. MOCS-Cert is useful if adaptive materialization of shared dependencies achieves lower total cost than either extreme, while preserving sound semantics.

---

## Conceptual Architecture

The full pipeline from question to certified result:

```
   SCIENTIFIC QUESTION
           |
           v
  +---------------------+
  |  Observable Contract |   C = (Q, epsilon, tau, policy)
  |  Q: query            |
  |  epsilon: tolerance  |
  |  tau: sampling policy|
  |  policy: PBC, units  |
  +----------+----------+
             |
             v
  +---------------------+
  |  Parser / Type-Check |   validates operator types,
  |                      |   units, atom references
  +----------+----------+
             |
             v
  +---------------------+
  |  Dependency Analyzer |   builds observable DAG:
  |                      |   HBOND -> DISTANCE + ANGLE
  |                      |   CONTACT -> DISTANCE
  +----------+----------+
             |
             v
  +---------------------+
  |  Cost-Based Planner  |   J(P) = a*C_IO + b*C_CPU
  |                      |         + g*C_mem + d*C_refine
  |                      |         + n*C_compile
  +----------+----------+
             |
     +-------+--------+----------+
     v       v                   v
  direct   certificate         cache /
   scan      index           materialized
     |         |             observable
     +----+----+-----------+
          |
          v
  +---------------------+
  |  Certified Runtime   |   evaluates blocks;
  |                      |   applies AABB distance bounds;
  |                      |   evaluates temporal operators
  +----------+----------+
             |
    +--------+---------+--------+
    v        v                  v
CERTIFIED  CERTIFIED         UNKNOWN
  TRUE      FALSE               |
                                v
                  +-------------------+
                  | Selective Refine   |  subdivides ambiguous
                  |                   |  blocks only; re-evaluates
                  +--------+----------+
                           |
                           v
                   +--------------+
                   | Final Result  |
                   +------+-------+
                          |
                          v
                   +--------------+
                   |  Certificate  |  machine-readable execution
                   |  (JSON)       |  proof relative to declared
                   +--------------+  semantics
```

The **sidecar** (`.mocs/` directory) holds the Molecular Certificate Index (MCI):

```
trajectory.xtc
system.tpr
trajectory.mocs/
    manifest.json        <- trajectory-global metadata (MCI Level 0)
    blocks/              <- block boundary definitions
    selections/          <- lazy per-selection motion summaries (MCI Level 1)
    bounds/              <- AABB envelopes per selection per block
    events/              <- materialized event intervals
    cache/               <- reusable observable values
    certificates/        <- stored execution certificates
    source-map/          <- block -> source byte-offset mapping
```

The source trajectory remains the authoritative data. The sidecar is derived, disposable, and fully rebuildable from the source.

---

## Simple Example

### Python API Call

```python
import mocs

# Open trajectory session (lazy Level-1 index construction with eager Level-0 validation)
session = mocs.open("run.xtc", topology_path="system.tpr")

# Execute certified query
result = session.query(
    observable="DISTANCE",
    atoms=("A:155:CA", "LIG:1:O2"),
    predicate="< 4.0 A"
)

print(result.truth_value)        # 'TRUE'
print(result.resolution_status)  # 'COMPLETE'
print(result.certificate)
```

### What the Result Looks Like

```json
{
  "query_id": "q-155-dist",
  "result": {
    "truth_value": "TRUE",
    "resolution": "COMPLETE"
  },
  "query": {
    "operator": "DISTANCE",
    "atoms": ["A:155:CA", "LIG:1:O2"],
    "predicate": "< 4.0 A"
  },
  "semantics": {
    "sampling": "sampled_frames",
    "dt_ps": 10,
    "pbc": "orthorhombic_minimum_image",
    "numerical_precision": "float64"
  },
  "source": {
    "trajectory_sha256": "a3f8...",
    "topology_sha256":   "7c2d..."
  },
  "evidence": {
    "blocks_total":           240,
    "blocks_certified":       231,
    "blocks_refined":           7,
    "frames_exactly_scanned":  43
  },
  "resources": {
    "bytes_read":   41800000,
    "source_bytes": 8100000000
  },
  "software": {
    "mocs_version":     "0.1.0",
    "operator_version": "DISTANCE-v1"
  }
}
```

**What the certificate guarantees:** Given this source trajectory, topology, declared sampling semantics, PBC convention, and numerical precision policy, the returned answer is sound. The certificate does **not** assert that the real molecule experimentally behaved this way, nor that no event occurred between stored frames.

---

## Supported Operators

### Spatial Observables

| Operator   | Description |
|------------|-------------|
| `DISTANCE` | Minimum-image Euclidean distance between two atom references across stored frames. Sound AABB distance bounds are computed per block and used to certify or prune without frame access. |
| `CONTACT`  | Boolean distance-derived predicate: `CONTACT(A, B, cutoff)` is equivalent to `DISTANCE(A, B) < cutoff`. Shares distance certificates with any `DISTANCE` query on the same atom pair. |
| `HBOND`    | Hydrogen-bond evaluation requiring donor-acceptor distance, donor-hydrogen-acceptor angle, and chemical topology. Two-stage architecture: distance bounds prune impossible blocks; exact donor, hydrogen, and acceptor coordinates are evaluated only on surviving candidate frames (no angular AABB certification). |

### Temporal Operators (Sampled-Frame Semantics)

All temporal operators operate on half-open event intervals $E = [k_s, k_e)$ where $k_s$ is the first frame index of the event, $k_e$ is the frame index strictly after the event, and $\operatorname{Duration}(E) = (k_e - k_s)\Delta t$. Claims are strictly relative to stored frame samples; no continuous-time interpolation is performed.

| Operator      | Definition & Semantics |
|---------------|------------------------|
| `FOR`         | Asserts that a spatial predicate holds for an unbroken run of sampled frames spanning at least elapsed duration $\tau$: $\operatorname{Duration}(E) \ge \tau$. |
| `BEFORE`      | Asserts temporal precedence: an occurrence of event $A$ finishes before an occurrence of event $B$ begins ($a_e \le b_s$). |
| `AFTER`       | Asserts temporal succession: an occurrence of event $A$ begins after an occurrence of event $B$ ends ($a_s \ge b_e$). |
| `FOLLOWED_BY` | Asserts temporal ordering ($a_e \le b_s$) within a maximum allowable gap $W_{\max}$ ($b_s - a_e \le W_{\max}/\Delta t$). Evaluates to `UNKNOWN` when intervals overlap ambiguously. |
| `WITHIN`      | Asserts temporal proximity: the interval separation $\operatorname{dist}(A, B) = \max(0, b_s - a_e, a_s - b_e) \cdot \Delta t \le W$. Separation is identically 0 if events overlap. |

---

## Result Semantics

MOCS-Cert explicitly separates **Logical Truth** from **Execution Resolution Status**, rejecting conflated "six-valued logic" formulations:

### 1. Logical Truth Domain ($\mathbb{T}$)

$$\mathbb{T} = \{\text{TRUE},\, \text{FALSE},\, \text{UNKNOWN}\}$$

- **`TRUE`**: The query condition has been certified to hold under the query's declared quantifier.
- **`FALSE`**: The query condition has been certified to be impossible under the query's declared quantifier.
- **`UNKNOWN`**: Available conservative bounds cannot prove truth or falsity without further refinement.

### 2. Execution Resolution Status ($\mathbb{R}$)

$$\mathbb{R} = \{\text{COMPLETE},\, \text{NEEDS\_REFINEMENT},\, \text{UNRESOLVABLE\_SAMPLING},\, \text{UNSUPPORTED\_GEOMETRY},\, \text{UNSUPPORTED\_SEMANTICS},\, \text{ERROR}\}$$

- **`COMPLETE`**: Query terminated with definitive logical truth (`TRUE` or `FALSE`).
- **`NEEDS_REFINEMENT`**: Logical truth is `UNKNOWN`, but selective refinement of ambiguous blocks can resolve the query.
- **`UNRESOLVABLE_SAMPLING`**: Trajectory timestamps are missing, irregular, or corrupt, preventing sound temporal frame mapping.
- **`UNSUPPORTED_GEOMETRY`**: The simulation cell geometry (e.g. triclinic, variable cell) or boundary conditions are outside V0.1 capability boundaries.
- **`UNSUPPORTED_SEMANTICS`**: The query requests continuous physical interpolation or semantic features unsupported in V0.1 sampled-frame execution.
- **`ERROR`**: Runtime execution error (I/O corruption, missing topology files, unparseable query, numerical singularity).

### 3. Block Certification vs. Query Quantifiers

- **Block-Level Certification**: A conservative bound over block $B_m$ certifies whether a predicate holds for *all* frames in the block ($\forall k \in B_m$).
- **Query-Level Aggregation**: Scientific queries explicitly declare their quantifier:
  - **Existential ($\exists k : P(k)$)**: Certified `TRUE` as soon as any block or frame satisfies $P$; certified `FALSE` only when *all* blocks are certified $\neg P$.
  - **Universal ($\forall k : P(k)$)**: Certified `TRUE` only when *all* blocks satisfy $P$; certified `FALSE` as soon as any block or frame satisfies $\neg P$.
  - **Duration ($\exists E : \operatorname{Duration}(E) \ge \tau$)**: Evaluated over contiguous runs of verified sampled frames.

---

## Installation

> **Not yet available on PyPI.**

MOCS-Cert V0.1 is a research prototype under active development. The package is not yet published. When available:

```bash
pip install mocs-cert
```

To install from source (when the repository is public):

```bash
git clone https://github.com/mocs-cert/mocs-cert.git
cd mocs-cert
pip install -e ".[dev]"
```

**Dependencies:** Python >= 3.11, MDAnalysis >= 2.0, NumPy >= 1.24, JAX >= 0.4.20, CuPy >= 12.0 (optional GPU acceleration), SciPy.

---

## Usage Examples

### Example 1: Distance Threshold Query

Ask whether the distance between atom A:155 and ligand atom LIG:O2 was ever less than 4.0 Angstroms anywhere in the trajectory.

```python
import mocs

result = mocs.query(
    trajectory="run.xtc",
    topology="system.tpr",
    observable="distance",
    atoms=("A:155:CA", "LIG:1:O2"),
    predicate="< 4.0 A"
)

print(result.truth_value)        # e.g. 'TRUE'
print(result.resolution_status)  # e.g. 'COMPLETE'
print(result.certificate)        # full JSON provenance record
print(result.blocks_refined)     # number of blocks that required exact scan
print(result.bytes_read_decompressed) # decompressed bytes accessed
print(result.bytes_read_os)           # OS-level raw bytes accessed
```

### Example 2: Contact Query

Ask whether residue A:155 was ever in contact with the ligand (cutoff 3.5 Angstroms). CONTACT shares distance bounds with any prior DISTANCE query on the same atom pair.

```python
result = mocs.query(
    trajectory="run.xtc",
    topology="system.tpr",
    observable="contact",
    atoms=("A:155:CA", "LIG:1:C1"),
    cutoff_angstrom=3.5
)

print(result.truth_value)        # 'TRUE' / 'FALSE' / 'UNKNOWN'
print(result.resolution_status)  # 'COMPLETE' / 'NEEDS_REFINEMENT' / ...
```

### Example 3: H-bond with Minimum Duration (FOR)

Ask whether a hydrogen bond from A:155 (donor) to LIG:O2 (acceptor) was present continuously for at least 100 ps.

```python
result = mocs.query(
    trajectory="run.xtc",
    topology="system.tpr",
    observable="hbond",
    operands={
        "donor": "A:155:NE2",
        "hydrogen": "A:155:HE2",
        "acceptor": "LIG:1:O2"
    },
    temporal={"operator": "FOR", "min_duration_ps": 100.0}
)

print(f"Truth: {result.truth_value}, Resolution: {result.resolution_status}")
# TRUE  + COMPLETE                -- a 100+ ps H-bond episode is confirmed
# FALSE + COMPLETE                -- distance bounds rule it out entirely
# UNKNOWN + NEEDS_REFINEMENT      -- boundary blocks require refinement
# UNKNOWN + UNRESOLVABLE_SAMPLING -- dt is missing, irregular, or corrupt
# UNKNOWN + UNSUPPORTED_SEMANTICS -- continuous-time physical persistence requested

print(result.certificate["evidence"]["blocks_refined"])
```

---

## Current Limitations (V0.1)

V0.1 is a deliberately narrow research prototype. The following constraints are **by design**, not oversights. See [PROJECT_SCOPE.md](PROJECT_SCOPE.md) for the full scope definition and [LIMITATIONS.md](LIMITATIONS.md) for detailed technical discussion.

| Area | V0.1 Constraint |
|------|----------------|
| **PBC geometry** | Fixed orthorhombic boxes only. Minimum-image semantics. Triclinic cells are explicitly rejected with `UNSUPPORTED_GEOMETRY`. |
| **Changing box** | Time-varying simulation cell dimensions are not supported and will be rejected at contract validation. |
| **Spatial envelope** | Axis-aligned bounding boxes (AABB) only. Oriented bounding boxes, k-DOPs, and sphere envelopes are out of scope for V0.1. |
| **Observables** | DISTANCE, CONTACT, HBOND only. No pocket volumes, domain motion, secondary structure, dihedral angles, or RMSD. |
| **Temporal operators** | FOR, BEFORE, AFTER, FOLLOWED_BY, WITHIN only. No causal operators. |
| **Topology** | Static topology within a trajectory. Atom identity must not change between frames. |
| **Implementation language** | Modern Python (3.11+) prototype using MDAnalysis and mixed array computing (NumPy, JAX, CuPy). No Rust port until Python prototype passes kill tests. |
| **Accelerators** | Hybrid array acceleration: CuPy (CUDA/ROCm GPU) and JAX (OpenXLA JIT compiler) with fallback to NumPy CPU. |
| **Query interface** | Python API only. No declarative query language (DSL / MolQL) in V0.1. |
| **Trajectory formats** | XTC, DCD, TRR via MDAnalysis readers. No new trajectory file format is introduced. |
| **Topology formats** | PDB, GRO, TPR. |
| **Deployment** | Local workstation or single-node HPC. No distributed execution. No web platform. |
| **Continuous-time claims** | None. All semantics are sampled-frame-exact. No interpolation between stored frames is performed or claimed. |

---

## Project Status

MOCS-Cert is a **research prototype** at version 0.1. It is being developed to investigate whether contract-driven molecular observable compilation with conservative certification and selective refinement provides meaningful computational leverage over conventional trajectory scanning on exploratory workloads.

### Development Phases

The project gates itself against non-negotiable kill criteria before advancing. The most important first experiment — bound tightness versus block size on one real trajectory — must demonstrate real pruning leverage before further compiler infrastructure is built. See [ROADMAP.md](ROADMAP.md) for the full phase plan.

### Kill Criteria (Non-Negotiable)

The project will be redesigned or abandoned if any of the following are demonstrated on real trajectories:

- AABB bounds are too loose to prune meaningful proportions of trajectory blocks.
- Most queries require reading nearly the entire trajectory even with indexing.
- A simple exact precomputed observable table beats MOCS across realistic exploratory workloads.
- Sidecar construction and storage costs exceed the benefit.
- Any soundness failure persists after debugging (any certified TRUE/FALSE that disagrees with the reference engine).
- PBC handling cannot be made conservative and correct in practice.
- Scientists find the query model harder to use than ordinary MDAnalysis scripts.

See [DECISION_LOG.md](DECISION_LOG.md) for rationale on major design decisions.

---

## Research vs Production Distinction

MOCS-Cert is **scientific research software**, not a production analysis platform. This distinction has concrete implications:

**What MOCS-Cert is:**
- A research vehicle for investigating whether contract-driven compilation and conservative certification are useful for molecular trajectory querying.
- A prototype designed to be killed, redesigned, or extended based on experimental evidence.
- Software that makes explicit, machine-verifiable claims about computation relative to declared semantics.

**What MOCS-Cert is not:**
- A replacement for MDAnalysis, MDTraj, or other established molecular analysis libraries.
- A trajectory compression format (MOCS sidecars are derived accelerators, not replacement formats).
- A validator of experimental biology. A `TRUE` result with `COMPLETE` resolution means the computation is sound relative to the declared semantics and source data — not that the molecule actually behaved that way under experimental conditions.
- A continuous-time simulation system. No claim is made about what happened between stored trajectory frames.
- A production-ready tool for analysis pipelines.

All performance figures in documentation are labeled as TARGET (design goal), HYPOTHESIS (experimentally untested), or MEASURED (empirically demonstrated on specific hardware and trajectories). No unconditional performance claims are made.

Any claim that MOCS-Cert is "first" in any category must be supported by a systematic literature, software, and patent review before publication.

---

## Documentation Suite

The following 35 canonical documents constitute the authoritative MOCS-Cert specification suite. All documents are located in the `docs/` directory and formally tracked in [`DOC_MANIFEST.yaml`](../DOC_MANIFEST.yaml).

| # | Document | Purpose & Authority |
|:---:|----------|----------------------|
| 01 | [README.md](README.md) | Public Introduction & Architecture Overview |
| 02 | [PROJECT_SCOPE.md](PROJECT_SCOPE.md) | Scope Boundaries & Capability Matrix |
| 03 | [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md) | Mathematical Problem Formulation & Workload Economics |
| 04 | [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) | Technical Subsystems & Execution Plans |
| 05 | [FORMAL_SEMANTICS.md](FORMAL_SEMANTICS.md) | Authoritative Epistemic & Operational Semantics |
| 06 | [MATHEMATICAL_MODEL.md](MATHEMATICAL_MODEL.md) | AABB Bounds, PBC Derivations & Cost Objectives |
| 07 | [CERTIFICATE_SPEC.md](CERTIFICATE_SPEC.md) | JSON-Schema & Offline Verification Algorithm |
| 08 | [OBSERVABLE_OPERATOR_SPEC.md](OBSERVABLE_OPERATOR_SPEC.md) | YAML Operator Contracts & Capabilities |
| 09 | [QUERY_LANGUAGE_SPEC.md](QUERY_LANGUAGE_SPEC.md) | MolQL-Cert EBNF Grammar & AST Dataclasses |
| 10 | [QUERY_IR_AND_COMPILER.md](QUERY_IR_AND_COMPILER.md) | IR Tiers, Dependency DAG & Optimization Passes |
| 11 | [CERTIFICATE_INDEX_SPEC.md](CERTIFICATE_INDEX_SPEC.md) | MCI Level 0/1 Architecture & Seek Tables |
| 12 | [REFERENCE_SEMANTICS.md](REFERENCE_SEMANTICS.md) | Authoritative Reference Oracle (mocs-reference) |
| 13 | [CORRECTNESS_AND_VALIDATION.md](CORRECTNESS_AND_VALIDATION.md) | Soundness Invariants & Property-Based Verification |
| 14 | [FUZZING_AND_ADVERSARIAL_TESTING.md](FUZZING_AND_ADVERSARIAL_TESTING.md) | Adversarial Singularities & mocs-fuzz Harness |
| 15 | [PBC_SEMANTICS.md](PBC_SEMANTICS.md) | Periodic Boundary Conditions & Minimum-Image Convention |
| 16 | [TEMPORAL_SEMANTICS.md](TEMPORAL_SEMANTICS.md) | Discrete Event Algebra & Sampled-Frame Grounding |
| 17 | [PERFORMANCE_MODEL.md](PERFORMANCE_MODEL.md) | Quantitative Cost Model J(P) & N_break-even |
| 18 | [BENCHMARK_SPEC.md](BENCHMARK_SPEC.md) | Dataset Stratification & 10-Baseline Protocols |
| 19 | [MOBENCH_SPEC.md](MOBENCH_SPEC.md) | Molecular Observability Benchmark Suite Schemas |
| 20 | [RESEARCH_PLAN.md](RESEARCH_PLAN.md) | Eight-Phase Research Program & Kill Gates |
| 21 | [KILL_CRITERIA.md](KILL_CRITERIA.md) | Brutally Honest Project Termination Triggers |
| 22 | [LIMITATIONS.md](LIMITATIONS.md) | Known Epistemic, Physical & Systems Limitations |
| 23 | [PRIOR_ART_AND_NOVELTY.md](PRIOR_ART_AND_NOVELTY.md) | Literature Map & Strict Novelty Ceilings |
| 24 | [THREAT_MODEL.md](THREAT_MODEL.md) | Scientific-Computing Threat & Failure Model |
| 25 | [DATA_PROVENANCE.md](DATA_PROVENANCE.md) | Cryptographic Digests & Unit Audit Tracking |
| 26 | [API_SPEC.md](API_SPEC.md) | Python API Specification (mocs.open/query/verify) |
| 27 | [DEVELOPER_ARCHITECTURE.md](DEVELOPER_ARCHITECTURE.md) | Repository Layout & Unidirectional Dependency Rules |
| 28 | [CONTRIBUTING.md](CONTRIBUTING.md) | Scientific Correctness & Community Guidelines |
| 29 | [TESTING_STRATEGY.md](TESTING_STRATEGY.md) | Test Pyramid & Pre-Release Quality Gates |
| 30 | [ROADMAP.md](ROADMAP.md) | Staged Development Roadmap (V0.1 -> V1.0 -> MTR) |
| 31 | [DECISION_LOG.md](DECISION_LOG.md) | Architecture Decision Records (ADRs 001-010) |
| 32 | [EXPERIMENT_LOG_TEMPLATE.md](EXPERIMENT_LOG_TEMPLATE.md) | Standardized Scientific Experiment Logging |
| 33 | [PAPER_BLUEPRINT.md](PAPER_BLUEPRINT.md) | Primary Research Paper Plan & Reviewer Rebuttals |
| 34 | [RESEARCH_FIGURES.md](RESEARCH_FIGURES.md) | Visual Specifications for Publication Figures 1-8 |
| 35 | [EXAMPLES.md](EXAMPLES.md) | Seven Traced End-to-End Execution Walkthroughs |

---

*MOCS-Cert is developed as open-source research software. Contributions, critiques, and benchmark data are welcome. The project is designed to be killed by its own experiments before wasting years on a mechanism that does not provide real computational leverage.*
