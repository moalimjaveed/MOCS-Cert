# KILL_CRITERIA.md — MOCS-Cert Project Kill and Pivot Criteria

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Research Baseline  
**Cross-References:** [`RESEARCH_PLAN.md`](RESEARCH_PLAN.md), [`CORRECTNESS_AND_VALIDATION.md`](CORRECTNESS_AND_VALIDATION.md), [`PERFORMANCE_MODEL.md`](PERFORMANCE_MODEL.md), [`ROADMAP.md`](ROADMAP.md).

---

## 1. Purpose and Philosophy of Kill Criteria

Open-source computational software often suffers from "sunk-cost paralysis": continuing to build complex compiler and runtime abstractions on top of mechanisms whose foundational assumptions are empirically invalid.

This document establishes **non-negotiable, falsifiable kill criteria**. If an experimental milestone violates these thresholds, the project will **not** disguise the failure with marketing claims or move the goalposts. It will trigger a formal pivot or terminate development, publishing the negative results as an honest scientific contribution.

---

## 2. Scientific Kill Criteria

### Criterion K-S1: Bound Looseness Ineffectiveness
* **Threshold Condition:** If across 30 representative trajectories in MOBench Phase A, the conservative AABB distance bounds cannot certify at least $40\%$ of blocks (`CERTIFIED_TRUE` or `CERTIFIED_FALSE`) for standard contact cutoffs ($\theta \in [3.5, 4.5]\ \text{Å}$) across any tested block size $b \in [10, 500]$.
* **Underlying Reality:** Molecular fluctuations are too large or isotropic for simple coordinate bounding boxes to provide spatial pruning.
* **Escalation & Action:**
  1. *Pivot Attempt:* Evaluate Oriented Bounding Boxes (OBBs) or k-DOPs (discrete oriented polytopes) over a 2-week sprint.
  2. *Hard Stop:* If k-DOPs also fail to achieve $> 40\%$ pruning, **kill the geometric certificate index architecture entirely**. The core hypothesis is false.

### Criterion K-S2: Scan Domination
* **Threshold Condition:** If on multi-query exploratory workloads, more than $75\%$ of evaluated queries still require reading $> 80\%$ of total trajectory coordinate bytes despite index assistance and hierarchical refinement.
* **Underlying Reality:** The selective refinement process degenerates to full trajectory scans, offering negligible I/O reduction.
* **Escalation & Action:** Abandon indexed execution for general trajectory querying. Re-scope MOCS-Cert strictly as an offline static contract verifier.

---

## 3. Systems and Engineering Kill Criteria

### Criterion K-Sy1: Sidecar Storage Explosion
* **Threshold Condition:** If the on-disk storage footprint of the `.mocs` sidecar directory exceeds $20\%$ of the uncompressed source trajectory file size for a standard 100-query workload.
* **Underlying Reality:** The index consumes so much storage that users would rather store the raw trajectory alone or use standard compression formats like MDCompress.
* **Escalation & Action:** Redesign the binary record layout to use delta-encoding and outward-rounded floating-point representation (ensuring directed interval arithmetic rounding preserves soundness). If index overhead remains $> 15\%$, terminate sidecar materialization.

### Criterion K-Sy2: Compilation Overhead Exceeds Savings
* **Threshold Condition:** If the CPU wall-clock latency of parsing, type-checking, building the Observable DAG, and planning exceeds the time saved by trajectory pruning for $> 50\%$ of queries.
* **Underlying Reality:** The compiler introduces more overhead than the brute-force Python scan it was designed to accelerate.
* **Escalation & Action:** Strip the dynamic query optimizer. Replace the compiler with a static rule-based lookup table. If still net-negative, revert to pure library calls.

---

## 4. Mathematical and Correctness Kill Criteria

### Criterion K-M1: Irreparable Soundness Violation
* **Threshold Condition:** If during continuous integration, fuzzing, or benchmark evaluation, MOCS-Cert emits a single `CERTIFIED_TRUE` result that the reference oracle evaluates as `FALSE`, or a `CERTIFIED_FALSE` result that the oracle evaluates as `TRUE`, and the bug is due to an unsound mathematical derivation (rather than an off-by-one index typo).
* **Underlying Reality:** The formal mathematical model or periodic boundary proof is flawed.
* **Escalation & Action:**
  1. **HARD STOP:** Immediately halt all releases and revoke any pre-release packages.
  2. If a sound re-derivation cannot be proven and peer-reviewed within 14 days, **retract the certified claim** and downgrade the observable to unindexed exact execution.

### Criterion K-M2: PBC Handling Impracticability
* **Threshold Condition:** If periodic boundary condition handling cannot be made conservative without returning `UNSUPPORTED_GEOMETRY` or forcing exact fallback on more than $15\%$ of standard solvated biomolecular benchmark blocks.
* **Underlying Reality:** Orthorhombic cell boundary-crossing cannot be robustly managed by AABB envelopes.
* **Escalation & Action:** Restrict MOCS-Cert strictly to non-periodic or unwrapped macromolecular analyses.

---

## 5. Economic and Workload Kill Criteria

### Criterion K-E1: The Simple Cache Superiority
* **Threshold Condition:** If a naive, precomputed exact observable matrix (e.g. computing pairwise distance matrices once with MDTraj/NumPy and saving to an HDF5 or Parquet table) outperforms MOCS-Cert in both query latency and total workload wall-clock time across $> 80\%$ of realistic exploratory workloads ($Q \in [10, 1000]$).
* **Underlying Reality:** Trajectory query compilation has no economic justification over simple upfront precomputation.
* **Escalation & Action:**
  * Document the finding as a primary scientific negative result.
  * Pivot the project from a "query compiler" to an "adaptive view materialization manager" that orchestrates upfront precomputations.

### Criterion K-E2: Unattainable Break-Even ($N_{\text{break-even}} > 30$ on NVMe, $> 15$ on HDD)
* **Authoritative Threshold Condition (Closing the Dead Zone):**
  * **Target Gate:** $N_{\text{break-even}} \le 12$ queries on NVMe PCIe Gen4; $\le 4$ queries on spinning HDD.
  * **Warning / Investigation Zone ($12 < N_{\text{break-even}} \le 30$ on NVMe; $4 < N \le 15$ on HDD):** Triggers formal performance engineering review; phase release gates blocked until optimization or explanation is approved.
  * **Hard Termination Trigger ($N_{\text{break-even}} > 30$ on NVMe; $> 15$ on HDD):** The project is formally terminated.
* **Underlying Reality:** Typical biophysical researchers examine fewer than 30 queries on a single trajectory in an exploratory session; indexing that requires $> 30$ queries to break even will never pay for itself in standard workstation workflows.
* **Escalation & Action:** Restrict indexed mode strictly to multi-user institutional archives and high-throughput screening pipelines; terminate standalone workstation compiler productization.

---

## 6. Adoption and Usability Kill Criteria

### Criterion K-A1: Cognitive Rejection of Contracts
* **Threshold Condition:** If qualitative user studies with computational biophysicists reveal that researchers find writing Observability Contracts, specifying sampling semantics, and handling `UNKNOWN`/`UNRESOLVABLE` return states significantly more difficult and error-prone than writing 10 lines of standard MDAnalysis Python script.
* **Underlying Reality:** Formal methods and contract-driven semantics impose too heavy a cognitive barrier for the scientific gain.
* **Escalation & Action:**
  1. Hide the entire contract and compiler system behind an automatic one-liner wrapper (`mocs.quick_query("distance < 4.0")`).
  2. If researchers still reject the paradigm, archive the software as a formal-methods research prototype and cease productization.

---

## 7. Formal Exit Protocol

When a kill criterion is permanently triggered:
1. An official post-mortem issue is opened on GitHub detailing the empirical failure with complete benchmark logs.
2. The `STATUS` badge in `README.md` is updated to `TERMINATED - HYPOTHESIS REFUTED` or `PIVOTED`.
3. A technical report or workshop paper is submitted to an appropriate venue (e.g., Workshop on Molecular Data Engineering or Supercomputing) documenting the exact conditions under which conservative geometric trajectory certification fails.
