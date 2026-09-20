# RESEARCH_PLAN.md — MOCS-Cert Scientific and Engineering Research Program

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Research Baseline  
**Cross-References:** [`KILL_CRITERIA.md`](KILL_CRITERIA.md), [`PAPER_BLUEPRINT.md`](PAPER_BLUEPRINT.md), [`BENCHMARK_SPEC.md`](BENCHMARK_SPEC.md), [`MOBENCH_SPEC.md`](MOBENCH_SPEC.md), [`ROADMAP.md`](ROADMAP.md).

---

## 1. Executive Program Architecture

MOCS-Cert is structured as an **experiment-driven scientific computing research program**. Development does not proceed blindly on optimistic assumptions; rather, each progressive phase is gated by strict, falsifiable hypotheses. If an empirical hypothesis fails its kill gate, the system pivots or terminates in accordance with [`KILL_CRITERIA.md`](KILL_CRITERIA.md).

```
Phase 0: The Kill Test (2 Weeks) ──► Gate 0: Bound Tightness & Zero Unsoundness
   │ Pass
   ▼
Phase 1: Distance Certification (Weeks 3-6) ──► Gate 1: Measurable Pruning & Level 1 MCI
   │ Pass
   ▼
Phase 2: Contact & Hydrogen Bond (Weeks 7-10) ──► Gate 2: Staged Pruning & Reference Oracle
   │ Pass
   ▼
Phase 3: Temporal Event Composition (Weeks 11-16) ──► Gate 3: Sound Precedence & UNRESOLVABLE
   │ Pass
   ▼
Phase 4: Dependency Planning & Amortization (Months 5-8) ──► Gate 4: N_break-even <= 12 (NVMe) / <= 4 (HDD)
   │ Pass
   ▼
Phase 5: Adaptive Materialization (Months 9-12) ──► Gate 5: MOBench Full Baseline Showdown
   │ Pass
   ▼
Phase 6: Rust / SIMD Acceleration (Year 2)
   │
Phase 7: Molecular Transition Representation (MTR) (Year 2-3 Research)
```

---

## 2. Detailed Phase Breakdowns

### Phase 0: The Decisive Kill Test (Weeks 1–2)

* **Research Question:** Can simple axis-aligned bounding boxes (AABB) around atom positions in temporal blocks provide bounds tight enough to prune any meaningful fraction of frames in a real molecular dynamics trajectory?
* **Scientific Hypothesis:** For a folded protein in water, partitioning a 100,000-frame trajectory into blocks of size $b \in [10, 100]$ yields distance bounds $[L, U]$ sufficiently tight that $> 50\%$ of candidate residue pairs separated by $> 6.0\ \text{Å}$ can be certified non-interacting (`CERTIFIED_FALSE` for $\theta = 4.0\ \text{Å}$) without reading underlying frame coordinates.
* **Experimental Protocol:**
  1. Take one real 100,000-frame solvated protein trajectory (DS-BPTI).
  2. Implement a 150-line standalone Python script computing AABBs over block sizes $b \in \{10, 25, 50, 100, 250, 500\}$.
  3. Sample 5,000 random non-neighboring atom pairs.
  4. Derive bounds $L$ and $U$ and compare against brute-force exact distances.
  5. Plot bound width $W = U - L$ vs. block size $b$.
  6. Plot coordinate bytes inspected vs. block size.
* **Success Criteria:**
  * Zero unsound certified results ($0$ false positives, $0$ false negatives).
  * Pruning efficiency $\eta_{\text{prune}} \ge 0.50$ for at least one block size $b \le 100$.
  * Total coordinate bytes inspected reduced by $\ge 3\times$ compared to full scan.
* **Failure Criteria (Trigger Kill Criterion K-S1):**
  * Bounds are so loose ($W > 8.0\ \text{Å}$) that $> 85\%$ of blocks return `UNKNOWN` across all tested block sizes.
* **Primary Deliverables:** `mocs/scratch/phase0_kill_test.py`, bound tightness CSV tables, Figure 1 (Bound Tightness vs. Block Size).
* **Paper Potential:** Establishes the empirical foundation for Section 3 of the primary systems paper.

---

### Phase 1: Full Distance Certification and Level 1 MCI (Weeks 3–6)

* **Research Question:** How does orthorhombic periodic boundary handling affect AABB bound tightness, and how can Level 1 indices be lazily constructed without full-system overhead?
* **Scientific Hypothesis:** Lazy materialization of selection-specific AABB summaries achieves $< 0.1\%$ storage overhead relative to the source trajectory while preserving complete minimum-image soundness across boundary-crossing events.
* **Experimental Protocol:**
  1. Implement `mocs/bounds/` with periodic patch decomposition and boundary straddling checks.
  2. Implement Level 0 manifest and binary source seek table (`frame_offsets.bin`).
  3. Implement Level 1 binary AABB file serialization (`AABBBlockRecord`).
  4. Differential testing against `mocs-reference.reference_distance` on 30 diverse trajectories.
* **Success Criteria:**
  * Zero discrepancies on $100,000$ adversarial boundary-adjacent queries.
  * Level 1 index construction time amortized over $\le 10$ queries.
* **Failure Criteria (Trigger Kill Criterion K-M2):**
  * Periodic boundary conditions cannot be handled conservatively without constantly emitting `UNSUPPORTED_GEOMETRY`.
* **Primary Deliverables:** `mocs/bounds/`, `mocs/index/`, `tests/unit/test_pbc_bounds.py`.

---

### Phase 2: Contact Certification and Two-Stage Hydrogen Bonds (Weeks 7–10)

* **Research Question:** Can complex ternary observables like hydrogen bonds (which require angular verification) be accelerated using purely distance-based block bounding?
* **Scientific Hypothesis:** A two-stage filtering architecture (Stage 1: Donor-Acceptor distance bound pruning; Stage 2: Exact frame scanning for angle and distance) eliminates $> 75\%$ of trajectory blocks from expensive angular floating-point calculations.
* **Experimental Protocol:**
  1. Implement `mocs/reference/hbond.py` supporting standard Baker-Hubbard criteria.
  2. Implement staged HBOND plan in `mocs/runtime/`.
  3. Benchmark HBOND queries across 50 protein-ligand complexes.
* **Success Criteria:**
  * Total execution time for HBOND analysis reduced by $\ge 4\times$ relative to MDAnalysis brute-force scans.
  * Agreement with exact reference oracle is $100.0\%$.
* **Failure Criteria (Trigger Kill Criterion K-S2):**
  * Donor-acceptor distance bounds fail to prune blocks, forcing near-complete frame reads.
* **Primary Deliverables:** `mocs/semantics/operators.py`, `mocs/runtime/staged_hbond.py`.

---

### Phase 3: Temporal Event Logic and Composition (Weeks 11–16)

* **Research Question:** How can discrete event intervals be soundly synthesized across block partitions without introducing boundary truncation artifacts?
* **Scientific Hypothesis:** A discrete event interval algebra over three-valued block indicators can certify temporal operators (`FOR`, `BEFORE`, `AFTER`, `FOLLOWED_BY`, `WITHIN`) while soundly flagging sub-frame temporal questions as `UNRESOLVABLE_SAMPLING`.
* **Experimental Protocol:**
  1. Implement temporal synthesizers in `mocs/runtime/temporal.py`.
  2. Fuzz with synthetic near-Nyquist event series (`[1, 0, 1, 0, ...]`) and single-frame flickers.
  3. Validate contract duration checks against trajectory sampling steps.
* **Success Criteria:**
  * All queries requesting $\Delta\tau < \Delta t$ correctly emit `UNRESOLVABLE_SAMPLING`.
  * Precedence queries (`BEFORE`) correctly terminate early upon identifying definitive counter-events.
* **Primary Deliverables:** `mocs/runtime/temporal.py`, `tests/fuzz/test_temporal_fuzz.py`.

---

### Phase 4: Dependency-Aware Planning and Multi-Query Workloads (Months 5–8)

* **Research Question:** Does common-subexpression elimination over an Observable Dependency DAG outperform independent query execution on realistic exploratory biophysical workloads?
* **Scientific Hypothesis:** In exploratory binding-site screening workloads ($100\text{--}1,000$ queries), multi-query DAG reuse and adaptive materialization reduce total execution wall-clock time by $\ge 3\times$ compared to independent execution.
* **Experimental Protocol:**
  1. Implement Logical IR, Observable Dependency DAG, and cost planner in `mocs/planner/`.
  2. Execute MOBench Workload Class 3 (Combinatorial Screening) across 200 trajectories.
  3. Measure $N_{\text{break-even}}$ across different disk architectures (NVMe vs. SATA vs. HDD).
* **Success Criteria:**
  * Measured $N_{\text{break-even}} \le 12$ queries on NVMe drives and $\le 4$ queries on spinning HDDs.
  * Multi-query throughput exceeds independent MDAnalysis loops by $\ge 3\times$.
* **Failure Criteria (Trigger Kill Criterion K-A1):**
  * Precomputing a simple NumPy distance matrix offline beats MOCS multi-query execution across all realistic workload sizes.
* **Primary Deliverables:** Full compiler optimization module, MOBench Phase A/B interim report.
* **Paper Potential:** Major systems paper submission: *“Molecular Observability Contracts for Certified Query Execution over Molecular Dynamics Trajectories”*.

---

### Phase 5: Adaptive Materialization and MOBench Public Release (Months 9–12)

* **Focus:** Benchmark stabilization, open-source software release, and public dataset distribution.
* **Deliverables:** Complete public release of `mocs-cert` on PyPI/GitHub, MOBench dataset repository, fully reproducible benchmarking pipeline.

---

### Phase 6: Compiled Backend (Rust / SIMD) (Year 2)

* **Focus:** Porting profiling-validated hot paths (AABB derivation, periodic interval checks) to a compiled Rust core via PyO3/maturin.
* **Constraint:** Purely a performance optimization. The mathematical model, certificate schema, and Python API remain strictly invariant.

---

### Phase 7: Molecular Transition Representation (MTR) (Years 2–3 Research)

* **Research Hypothesis:** Observable state transitions across long molecular trajectories can be compactly represented as structured event streams, enabling cross-trajectory motif mining and biophysical discovery across institutional archives.
