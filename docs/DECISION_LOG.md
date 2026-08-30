# DECISION_LOG.md — MOCS-Cert Architecture Decision Records (ADRs)

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Research Baseline  
**Canonical Owner:** `DECISION_LOG.md` is the authoritative historical and architectural record of all normative decisions in MOCS-Cert. Tracked in [`DOC_MANIFEST.yaml`](../DOC_MANIFEST.yaml).  
**Cross-References:** [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md), [`PROJECT_SCOPE.md`](PROJECT_SCOPE.md), [`KILL_CRITERIA.md`](KILL_CRITERIA.md), [`LIMITATIONS.md`](LIMITATIONS.md).

---

## 1. Overview and Decision Framework

This document records the foundational architectural, mathematical, and systems design decisions made during the conception and development of MOCS-Cert. Every decision follows the canonical **Architecture Decision Record (ADR)** pattern, detailing the problem context, chosen decision, evaluated alternatives, rejection rationale, and architectural consequences.

---

## 2. Architecture Decision Records

### ADR-001: Sidecar Directory Architecture Rather Than Custom Trajectory Replacement Format
* **Date:** 2026-09-01
* **Status:** Accepted (Normative)
* **Context:** Molecular dynamics trajectory datasets are massive (tens to hundreds of gigabytes). Traditional database approaches advocate converting trajectories into custom database containers (e.g. HDF5, TileDB, SciDB) to enable indexing.
* **Decision:** MOCS-Cert leaves existing trajectory files (`.xtc`, `.dcd`, `.trr`) completely unmodified. It stores all Level 0 manifests, Level 1 binary AABB motion records, and execution certificates in a detached, disposable sidecar directory (`<trajectory_filename>.mocs/`).
* **Alternatives Considered:**
  1. *Custom Container Format:* Introduce a new proprietary or unified file format containing embedded coordinates, topology, and index blocks.
  2. *In-File Header Mutation:* Append index blocks directly to the end of existing binary trajectory files.
* **Rejected Because:**
  * Introducing a new file format breaks existing software ecosystems (VMD, PyMOL, GROMACS, MDAnalysis) and imposes a heavy format conversion barrier on researchers.
  * In-file modification mutates source trajectory byte digests, destroying cryptographic data provenance.
* **Consequences:** The source trajectory remains authoritative. If a sidecar becomes corrupted, stale, or deleted, the system cleanly falls back to direct unindexed scanning or automatically reconstructs the sidecar without data loss.

---

### ADR-002: Python 3.11+ Hybrid Array Prototype (JAX + NumPy + CuPy) Prior to Compiled Rust Core
* **Date:** 2026-09-02 (Updated 2026-09-12)
* **Status:** Accepted (Normative)
* **Context:** High-throughput trajectory analysis typically demands compiled native performance (C++, Rust, CUDA). However, early optimization with low-level native code can lock in immature mathematical models before semantics and bounding theorems are verified. Conversely, relying strictly on single-threaded CPU NumPy creates artificial compute bottlenecks during dense coordinate bounding.
* **Decision:** Implement MOCS-Cert V0.1 in Python 3.11+ utilizing a hybrid mixed array acceleration engine (`mocs.arrays` combining JAX, NumPy, and CuPy) with MDAnalysis format readers. NumPy serves as the host baseline and reader interface; CuPy accelerates massive GPU coordinate batches; and JAX fuses spatial reduction kernels via OpenXLA (`jax.jit`, `jax.vmap`). Defer custom native Rust/SIMD implementations to Phase 6.
* **Alternatives Considered:**
  1. *Rust Core from Day 1:* Build the parser, bounding math, and index engine in Rust, exposing Python bindings via PyO3.
  2. *Pure NumPy Alone:* Restrict all mathematical evaluation strictly to standard host NumPy arrays without hardware acceleration.
  3. *Cython / C-Extension Hybrids:* Accelerate inner loops with ad-hoc C snippets.
* **Rejected Because:**
  * Writing custom Rust kernels before the multi-resolution bounding algebra is fully verified introduces extreme development friction and brittle FFI overhead.
  * Restricting to pure NumPy alone wastes available hardware parallelism and creates avoidable CPU stalls during dense AABB envelope construction over large molecular systems.
  * A mixed JAX + NumPy + CuPy abstraction delivers near-native compiled GPU/CPU performance while maintaining Python productivity and rapid scientific validation.
* **Consequences:** Near-native throughput is achieved across diverse hardware through automatic dispatching without requiring C++ compilation. Performance evaluations in V0.1 measure both **I/O read fraction reduction** ($R_{\text{bytes}}$) and compute throughput ($T_{\text{compute}}$).

---

### ADR-003: Restriction to Fixed Orthorhombic Periodic Boundary Conditions in V0.1
* **Date:** 2026-09-03
* **Status:** Accepted (Normative)
* **Context:** MD simulations employ various periodic cell geometries, including triclinic cells (e.g., rhombic dodecahedron to minimize solvent volume) and barostat-driven variable volume cells (NPT ensemble).
* **Decision:** V0.1 supports exclusively fixed, time-invariant orthorhombic simulation cells ($\mathbf{B} = \operatorname{diag}(L_x, L_y, L_z)$ with $\partial \mathbf{B}/\partial t = 0$). All triclinic, non-orthogonal, or time-varying boxes are rejected with `UNSUPPORTED_GEOMETRY`.
* **Alternatives Considered:**
  1. *Support Triclinic PBC in V0.1:* Implement non-orthogonal lattice reduction in the AABB interval math.
  2. *Approximate Triclinic Cells via Circumscribed Cubes:* Envelop triclinic boundaries in an outer orthorhombic box.
* **Rejected Because:**
  * Triclinic minimum-image math involves non-orthogonal projections where Cartesian AABBs suffer extreme interval dilation, severely degrading pruning power.
  * Approximating triclinic cells with circumscribed boxes introduces subtle image leakage bugs, violating the non-negotiable soundness invariant.
* **Consequences:** Trajectories simulated in triclinic boxes or under NPT ensembles with fluctuating cell edges cannot be queried in V0.1.

---

### ADR-004: Deliberately Simple Reference Engine as the Authoritative Oracle
* **Date:** 2026-09-04
* **Status:** Accepted (Normative)
* **Context:** The optimized query engine uses multi-level indices, dyadic block splitting, and staged pruning filters. Verifying that this complex engine never emits an unsound result requires an independent, trusted source of ground truth.
* **Decision:** Maintain `mocs-reference`, a completely decoupled, slow, brute-force Python implementation built on MDAnalysis and NumPy that scans every frame without indexing. Any discrepancy on a certified state is treated as a P0 bug in the optimized engine.
* **Alternatives Considered:**
  1. *Self-Testing Invariants:* Rely solely on property-based tests and internal runtime assertions.
  2. *Formal Proof Assistant:* Formally verify the entire codebase in Coq or Lean.
* **Rejected Because:**
  * Internal assertions cannot catch conceptual omissions in the bounding mathematics.
  * Formal machine-checked verification of multi-gigabyte trajectory readers and floating-point geometry libraries is beyond the current engineering scope.
* **Consequences:** Maintainers must maintain two parallel implementations of every observable operator.

---

### ADR-005: Decoupled Truth Domain and Execution Resolution Status
* **Date:** 2026-09-05 (Updated 2026-09-12)
* **Status:** Accepted (Normative)
* **Context:** Conventional analysis tools either force binary boolean logic or conflate logical truth with runtime execution termination states.
* **Decision:** Decouple logical truth from execution resolution status into two orthogonal spaces:
  1. **Logical Truth Domain:** $\mathbb{T} = \{\text{TRUE}, \text{FALSE}, \text{UNKNOWN}\}$ governed by Kleene strong 3-valued logic.
  2. **Execution Resolution Status:** $\mathbb{R} = \{\text{COMPLETE}, \text{NEEDS\_REFINEMENT}, \text{UNRESOLVABLE\_SAMPLING}, \text{UNSUPPORTED\_GEOMETRY}, \text{ERROR}\}$.
* **Alternatives Considered:**
  1. *Single 6-State Enum:* Combining truth and status into `CERTIFIED_TRUE`, `CERTIFIED_FALSE`, `UNKNOWN`, etc.
  2. *Standard Binary Booleans:* `True` / `False` with exceptions.
* **Rejected Because:**
  * Conflating truth and resolution breaks compositional logic: e.g., $\text{FALSE} \land \text{UNKNOWN}$ mathematically evaluates to $\text{FALSE}$ under Kleene logic, regardless of whether the second term is unrefined or unresolvable.
  * Binary booleans force ungrounded guesses when sampling or bounding resolution is insufficient.
* **Consequences:** All result objects expose separate `truth_value` and `resolution_status` fields.

---

### ADR-006: Rejection of Continuous-Time Inferences from Sampled Trajectories
* **Date:** 2026-09-06
* **Status:** Accepted (Normative)
* **Context:** Trajectories are discrete snapshots recorded every $\Delta t$. Researchers often ask continuous questions (e.g. *"Did this contact persist unbroken throughout the 100 ns simulation?"*).
* **Decision:** MOCS-Cert adheres strictly to sampled-frame semantics. All duration, contact, and precedence assertions apply exclusively to the stored, observed snapshots. Sub-frame continuous behavior is explicitly uncertified.
* **Alternatives Considered:**
  1. *Spline / Linear Interpolation:* Connect frames with continuous curves.
  2. *Generic Nyquist Autocorrelation Rule:* Assume events are continuous if $\Delta t < \tau_{\text{corr}} / 2$.
* **Rejected Because:**
  * Molecular dynamics collisions and barrier crossings are stochastic, non-linear, and non-differentiable at atomic scales; geometric interpolation between frames can fabricate fictitious physical contacts.
  * The generic Nyquist rule is invalid for non-bandlimited molecular ensembles.
* **Consequences:** Queries specifying duration thresholds $\Delta\tau < \Delta t$ return `UNRESOLVABLE_SAMPLING`.

---

### ADR-007: Deterministic Soundness over Probabilistic / Statistical Certification
* **Date:** 2026-09-07
* **Status:** Accepted (Normative)
* **Context:** In data management, approximate query processing (AQP) provides statistical error bounds (e.g. $95\%$ confidence intervals) to avoid scanning large datasets.
* **Decision:** MOCS-Cert rejects probabilistic certification in V0.1. A certificate is strictly deductive: bounds must guarantee that $100\%$ of frames in a certified block satisfy the condition.
* **Alternatives Considered:**
  1. *Bootstrap Sampling:* Estimate observable distributions by randomly reading $5\%$ of frames.
  2. *Markov State Model Priors:* Use transition probabilities to guess uninspected frames.
* **Rejected Because:**
  * Rare, catastrophic structural transitions (e.g. drug unbinding or domain unfolding) are non-Gaussian outliers that statistical sampling routinely misses.
* **Consequences:** Pruning efficiency will be lower in highly mobile systems than approximate methods, but certificates remain mathematically infallible.

---

### ADR-008: Deterministic Cost-Based Planner Over Machine Learning Query Optimization
* **Date:** 2026-09-08
* **Status:** Accepted (Normative)
* **Context:** Modern databases increasingly deploy learned query optimizers using neural networks or reinforcement learning to predict disk access latencies and select join plans.
* **Decision:** Use a deterministic, empirical linear cost function $J(P) = \alpha C_{\text{IO}} + \beta C_{\text{CPU}} + \dots$ with weights calibrated via micro-benchmarks.
* **Alternatives Considered:**
  1. *Learned Cost Predictor:* Train a deep neural network on historical trajectory query traces.
* **Rejected Because:**
  * Learned models are black boxes that can fail unpredictably on novel protein topologies, selecting catastrophic plans.
  * Training requires massive multi-workload execution traces that do not yet exist in Phase A.
* **Consequences:** The cost model is predictable, transparent, and easy to tune or override.

---

### ADR-009: Hybrid Array Acceleration (JAX + NumPy + CuPy) with Hardware-Adaptive Dispatching over Distributed Cluster Runtimes
* **Date:** 2026-09-09 (Updated 2026-09-12)
* **Status:** Accepted (Normative)
* **Context:** High-performance trajectory querying benefits from hardware acceleration, but distributed cluster engines (e.g. Dask, Ray, Spark) introduce significant networking, serialization, and cluster orchestration overhead.
* **Decision:** Accelerate V0.1 locally via a unified hybrid array engine (`mocs.arrays`) combining JAX (OpenXLA JIT compiler), CuPy (CUDA/ROCm GPU parallelism), and NumPy (CPU baseline), while deferring multi-node distributed cluster execution to future versions. Array execution adapts dynamically to detected hardware (CUDA/ROCm $\to$ CuPy/JAX GPU, AVX $\to$ JAX CPU, fallback $\to$ NumPy).
* **Alternatives Considered:**
  1. *Distributed Cluster Execution (Dask / Ray):* Distribute temporal blocks across a multi-node compute cluster.
  2. *CPU-Only Pure NumPy Execution:* Ban all GPU and JIT acceleration to avoid optional dependencies.
* **Rejected Because:**
  * Multi-node distributed frameworks incur high serialization latency and network bandwidth bottlenecks that dwarf the query execution time of local temporal block scans.
  * CPU-only execution neglects readily available local GPU and AVX hardware capable of accelerating coordinate transformations by over $100\times$.
  * The hybrid `mocs.arrays` abstraction gracefully degrades to pure NumPy whenever GPU or JAX environments are absent, guaranteeing zero barrier to entry.
* **Consequences:** Single-node workstations and laptops run MOCS-Cert at peak hardware efficiency without requiring multi-node cluster setup or mandatory GPU hardware.

---

### ADR-010: Explicit Non-Goal: MOCS-Cert Is Not a Trajectory Compression Algorithm
* **Date:** 2026-09-10
* **Status:** Accepted (Normative)
* **Context:** Reducing trajectory disk footprint is an active area of research (MDCompress, KATE, SZ). Because MOCS-Cert builds spatial indices, it is frequently confused with compression software.
* **Decision:** Formally declare that MOCS-Cert is a **query compiler and certificate index**, not a compression format.
* **Alternatives Considered:**
  1. *Rebrand MOCS as Semantic Compression:* Market the index as a lossy semantic summary.
* **Rejected Because:**
  * Misrepresenting query compilation as compression confuses users, invites invalid comparisons against MDCompress, and obscures the true research contribution.
* **Consequences:** All project positioning strictly emphasizes query compilation, workload amortization, and deductive certification.
