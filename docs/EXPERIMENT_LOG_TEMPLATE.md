# EXPERIMENT_LOG_TEMPLATE.md — MOCS-Cert Scientific Experiment Log Template

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Research Baseline  
**Cross-References:** [`MOBENCH_SPEC.md`](MOBENCH_SPEC.md), [`RESEARCH_PLAN.md`](RESEARCH_PLAN.md), [`DATA_PROVENANCE.md`](DATA_PROVENANCE.md), [`KILL_CRITERIA.md`](KILL_CRITERIA.md).

---

## 1. Instructions for Researchers

Every empirical trial, benchmarking run, or kill-test validation conducted within the MOCS-Cert project must be documented using this standard template.
* **Storage Location:** Save completed logs as `experiments/EXP-<YYYYMMDD>-<ID>.md`.
* **Reproducibility Mandate:** An experiment log missing the cryptographic source hashes, hardware context, or exact reproduction CLI command is considered invalid and cannot be cited in publications.
* **Epistemic Discipline:** Hypotheses must be recorded **prior** to execution; observed results must be reported with statistical dispersion (Median + IQR).

---

## 2. The Standard Experiment Log Template

```markdown
# Experiment Record: [EXP-ID] — [Brief Descriptive Title]

**Date Conducted:** YYYY-MM-DD  
**Lead Researcher:** [Name / GitHub Handle]  
**Research Program Phase:** [Phase 0 / Phase 1 / Phase 2 / Phase 3 / Phase 4 / Phase 5]  
**Target Milestone:** [e.g. Kill Test K-S1 Evaluation / MOBench Phase A Baseline Comparison]

---

## 1. Scientific / Engineering Hypothesis

*State the explicit, falsifiable hypothesis being tested. Specify expected quantitative thresholds.*
> **Hypothesis [HYPOTHESIS]:** [e.g. For dataset DS-BPTI at block size b=100, AABB distance bounds will achieve a pruning efficiency eta_prune >= 0.60 for contact queries at threshold theta = 4.0 A, reducing coordinate bytes read by at least 3x relative to MDAnalysis brute-force scan.]

---

## 2. Experimental Dataset and Source Provenance

| Provenance Attribute | Value / Specification |
|---|---|
| **MOBench Dataset ID** | `mobench-A-001` |
| **System Description** | [e.g. Solvated Bovine Pancreatic Trypsin Inhibitor (BPTI)] |
| **Trajectory File Path** | `data/bpti_production.xtc` |
| **Trajectory SHA-256** | `[64-hexadecimal SHA-256 hash]` |
| **Trajectory Size** | `[e.g. 2,684,354,560 bytes (2.50 GB)]` |
| **Topology File Path** | `data/bpti_solvated.tpr` |
| **Topology SHA-256** | `[64-hexadecimal SHA-256 hash]` |
| **Total Frame Count ($N$)** | `100,000` |
| **Total Atom Count ($n$)** | `8,920` |
| **Sampling Interval ($\Delta t$)** | `10.0 ps (Total simulated time: 1.0 us)` |
| **Simulation Box ($\mathbf{B}$)** | `Orthorhombic [48.24, 48.24, 48.24] A` |
| **Periodic Mode** | `orthorhombic_minimum_image` |

---

## 3. Hardware and Software Environment

| Environment Attribute | Specification |
|---|---|
| **Host CPU** | [e.g. AMD Ryzen 9 5950X (16 cores, 3.4 GHz base)] |
| **System RAM** | [e.g. 64 GB DDR4-3600 CL16] |
| **Storage Subsystem** | [e.g. Samsung 980 Pro 2TB NVMe PCIe 4.0 (Direct Mount)] |
| **Operating System** | [e.g. Ubuntu 22.04 LTS (Kernel 5.15.0-generic)] |
| **Python Build** | `Python 3.10.12 (GCC 11.3.0)` |
| **MOCS-Cert Version** | `0.1.0-dev` |
| **Git Commit SHA** | `[40-hexadecimal commit hash]` |
| **Core Libraries** | `numpy==1.24.3`, `mdanalysis==2.5.0`, `scipy==1.10.1` |

---

## 4. Query and Workload Configuration

* **Query Class:** [Single Ad-hoc / Repeated / Combinatorial Screen / Temporal Compound]
* **Target Observables:** [`DISTANCE` / `CONTACT` / `HBOND`]
* **Atom Selections:**
  * Selection A: `A:155:CA`
  * Selection B: `LIG:1:O2`
* **Predicate Thresholds:** `[e.g. < 4.0 A, >= 3.5 A]`
* **Temporal Predicates:** `[e.g. FOR >= 100 ps, BEFORE, NONE]`
* **Tested Block Sizes ($b$):** `[10, 25, 50, 100, 250, 500]`
* **Cache State Prior to Run:** [Cold Cache (drop_caches executed) / Warm Cache]
* **Number of Trials:** `5 replicate trials (cold cache) / 10 replicate trials (warm cache)`

---

## 5. Comparative Baselines Evaluated

- [ ] Baseline 1: MDAnalysis Direct Scan (Serial)
- [ ] Baseline 2: MDAnalysis Parallel Scan (pmda)
- [ ] Baseline 3: MDTraj Direct Scan
- [ ] Baseline 4: MDAnalysis Optimized Selection
- [ ] Baseline 5: Precomputed Columnar Cache (Parquet/Arrow)
- [ ] Baseline 6: Precomputed Observable Table (HDF5)
- [ ] Baseline 7: Naive Scalar Interval Index
- [ ] Baseline 8: MOCS Direct Execution (Plan A)
- [ ] Baseline 9: MOCS Indexed Execution (Plan B)
- [ ] Baseline 10: MOCS Hierarchical Refinement (Plan D)

---

## 6. Empirical Results Matrix

*All numerical metrics are reported as **Median [IQR]** across replicate trials (minimum 5 cold or 10 warm). Every cell below is a template placeholder to be recorded during execution.*

| Execution Target / Baseline | Wall Time (s) [MEASURED] | Source Compressed Bytes Fetched [MEASURED] | Compressed Frames Decoded [MEASURED] | Coordinates Materialized [MEASURED] | Soundness Violations |
|---|---|---|---|---|---|
| **MDAnalysis Direct (Serial)** | [MEASURED: T_direct] | [MEASURED: total_bytes] | [MEASURED: N_frames] | [MEASURED: N * n * 3] | 0 (Oracle) |
| **MDAnalysis Parallel (pmda)** | [MEASURED: T_pmda] | [MEASURED: total_bytes] | [MEASURED: N_frames] | [MEASURED: N * n * 3] | 0 (Oracle) |
| **MDTraj Direct** | [MEASURED: T_mdtraj] | [MEASURED: total_bytes] | [MEASURED: N_frames] | [MEASURED: N * n * 3] | 0 (Oracle) |
| **MDAnalysis Optimized Selection** | [MEASURED: T_opt] | [MEASURED: total_bytes] | [MEASURED: N_frames] | [MEASURED: selected_coords] | 0 (Oracle) |
| **Precomputed Columnar (Parquet/Arrow)** | [MEASURED: T_parquet] | [MEASURED: table_bytes] | [MEASURED: 0] | [MEASURED: column_floats] | 0 |
| **Precomputed Observable (HDF5)** | [MEASURED: T_hdf5] | [MEASURED: table_bytes] | [MEASURED: 0] | [MEASURED: column_floats] | 0 |
| **Naive Scalar Interval Index** | [MEASURED: T_naive] | [MEASURED: index_bytes] | [MEASURED: decoded_frames] | [MEASURED: coords] | 0 |
| **MOCS Plan A (Direct)** | [MEASURED: T_planA] | [MEASURED: total_bytes] | [MEASURED: N_frames] | [MEASURED: N * n * 3] | 0 |
| **MOCS Plan B (Indexed)** | [MEASURED: T_planB] | [MEASURED: fetched_bytes] | [MEASURED: decoded_frames] | [MEASURED: materialized] | 0 |
| **MOCS Plan D ($b=100$)** | [MEASURED: T_planD] | [MEASURED: fetched_bytes] | [MEASURED: decoded_frames] | [MEASURED: materialized] | [MEASURED: count] |
| **MOCS Plan D ($b=50$)** | [MEASURED: T_planD50] | [MEASURED: fetched_bytes] | [MEASURED: decoded_frames] | [MEASURED: materialized] | [MEASURED: count] |

---

## 7. Derived Performance Metrics

* **One-Time Level 1 Index Build Time ($C_{\text{build}}$):** `[MEASURED: seconds — NOT YET AVAILABLE]`
* **Sidecar Index Storage Footprint:** `[MEASURED: KB (.bin) + KB (seek table) — NOT YET AVAILABLE]`
* **Refinement Rate ($F_{\text{refine}}$):** `[MEASURED: percentage of blocks requiring refinement — NOT YET AVAILABLE]`
* **Calculated Break-Even Workload ($N_{\text{break-even}}$):**
  $$N_{\text{break-even}} = \frac{C_{\text{build}}}{T_{\text{direct}} - T_{\text{indexed}}} = \text{[MEASURED: calculate from empirical runs]}$$
  *(Compare against authoritative storage tier thresholds in KILL_CRITERIA.md).*

---

## 8. Failure Modes, Anomalies, and Edge Cases

*Document any unexpected behavior, near-boundary chatter, or system warnings.*
* **Observed Anomaly:** [Record any boundary-straddling events, multi-crossing fallbacks, or velocity guard trips]
* **Soundness Verification:** [Record differential check agreement against mocs-reference over all evaluated frames]

---

## 9. Scientific Interpretation and Conclusion

* **Hypothesis Evaluation:** [CONFIRMED / REFUTED / INCONCLUSIVE — compare measured results directly to Section 1 hypothesis]
* **Impact on Kill Criteria:** [State explicitly whether any kill criteria thresholds in KILL_CRITERIA.md were approached or violated]
* **Next Action:** [State next planned experimental step or architectural pivot]

---

## 10. Execution Artifacts and Reproducibility

* **Raw Metric Logs:** `results/exp_20260912_001/results.csv`
* **Generated Certificate:** `results/exp_20260912_001/certificate_bpti_c40.json`
* **Exact Reproducibility CLI Invocation:**
```bash
python -m mocs.benchmark.runner \
    --dataset mobench-A-001 \
    --workload single_contact_c40 \
    --block-sizes 50,100 \
    --trials 5 \
    --cache-mode cold \
    --output results/exp_20260912_001/
```
```
