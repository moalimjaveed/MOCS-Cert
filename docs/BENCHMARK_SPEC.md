# BENCHMARK_SPEC.md — MOCS-Cert Comprehensive Benchmarking Protocol

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Research Baseline  
**Canonical Owner:** `BENCHMARK_SPEC.md` is the authoritative protocol for experimental benchmarks, baseline comparisons, and multi-query workload classes. Tracked in [`DOC_MANIFEST.yaml`](../DOC_MANIFEST.yaml).  
**Cross-References:** [`PERFORMANCE_MODEL.md`](PERFORMANCE_MODEL.md), [`MOBENCH_SPEC.md`](MOBENCH_SPEC.md), [`KILL_CRITERIA.md`](KILL_CRITERIA.md), [`PROBLEM_STATEMENT.md`](PROBLEM_STATEMENT.md).

---

## 1. Objectives and Benchmarking Ethics

The goal of the MOCS-Cert benchmarking protocol is to empirically measure the performance envelope, computational savings, break-even thresholds, and pruning efficacy of certified query execution against existing state-of-the-art molecular dynamics analysis tools.

### 1.1 Strict Experimental Standards
* **No Artificial Single-Query Advantages:** MOCS-Cert does not claim to outperform a dedicated, pre-computed observable table for an isolated query. Workloads must reflect genuine scientific exploratory analysis.
* **Cold vs. Warm Cache Rigor:** Direct comparison of I/O performance requires explicitly flushing operating system page caches between runs.
* **Provenance-Complete Reporting:** Every benchmark number must be accompanied by full CPU model details, RAM bandwidth, filesystem types (NVMe/SSD/HDD), software commit hashes, and dataset cryptographic digests.

---

## 2. Benchmark Dataset Stratification

To prevent cherry-picking, benchmark datasets are strictly stratified across four physical axes:

```
                                  DATASET MATRIX
                                         │
       ┌──────────────────┬──────────────┴──────────────┬──────────────────┐
       ▼                  ▼                             ▼                  ▼
[System Biomolecule] [Dynamic Mobility]       [Trajectory Scale]     [Sampling Step]
• Soluble Globular   • Rigid / Low-RMSF       • Short: 10k frames    • Fine: 1 ps
• Membrane Receptor  • Dynamic Loops/Hinges   • Medium: 100k frames  • Standard: 10 ps
• Protein-Ligand     • Disordered (IDP)       • Long: 1M+ frames     • Coarse: 50 ps
```

### 2.1 Standard Dataset Catalog

| Dataset ID | System Description | Atoms ($n$) | Box Type | Box Size ($L_x, L_y, L_z$) | Frames ($N$) | Total Size |
|---|---|---|---|---|---|---|
| **DS-BPTI** | Bovine Pancreatic Trypsin Inhibitor (Soluble, folded) | 8,920 | Orthorhombic | $48.2 \times 48.2 \times 48.2\ \text{Å}$ | 100,000 | 2.6 GB |
| **DS-GPCR** | beta-2 Adrenergic Receptor in POPC lipid bilayer | 84,120 | Orthorhombic | $92.4 \times 92.4 \times 105.1\ \text{Å}$ | 50,000 | 12.8 GB |
| **DS-SARS2** | SARS-CoV-2 Main Protease with non-covalent inhibitor | 48,320 | Orthorhombic | $84.5 \times 84.5 \times 84.5\ \text{Å}$ | 100,000 | 14.5 GB |
| **DS-IDP** | Intrinsically Disordered Peptide (High conformational drift) | 12,450 | Orthorhombic | $65.0 \times 65.0 \times 65.0\ \text{Å}$ | 100,000 | 3.7 GB |

*(Note: All datasets require fixed orthorhombic simulation boxes in V0.1).*

---

## 3. Workload Query Classes

Scientific queries in MOCS-Cert are evaluated across five formal workload archetypes:

### 3.1 Class 1: Single Distance Predicate (Ad-hoc)
A solitary spatial contact query: $\operatorname{DISTANCE}(A, B) < 4.0\ \text{Å}$.
* *Evaluation Target:* Measures the overhead of ad-hoc plan generation vs. direct brute-force execution.

### 3.2 Class 2: Repeated Query Workload (Interactive Parameter Tuning)
The user explores interaction sensitivity by adjusting thresholds or temporal windows across the same atom selection:
$$Q_1: \operatorname{CONTACT}(A, B, 3.5), \quad Q_2: \operatorname{CONTACT}(A, B, 4.0), \quad Q_3: \operatorname{CONTACT}(A, B, 4.5)$$
* *Evaluation Target:* Measures Level 1 AABB index reuse and observable cache amortization.

### 3.3 Class 3: Combinatorial Screening Workload (Exploratory Mining)
A researcher examines binding pocket stability across candidate residues:
$$\{ \operatorname{CONTACT}(\text{Res}_i, \text{Ligand}, 4.0\ \text{Å}) \mid i \in [100, 250] \}$$
Evaluates $150$ pairwise queries.
* *Evaluation Target:* Measures the $N_{\text{break-even}}$ threshold and shared dependency compilation in the Observable DAG.

### 3.4 Class 4: Temporal Compound Queries
Chained temporal predicates:
$$\operatorname{HBOND}(D_1, H_1, A_1) \operatorname{FOR} \ge 100\ \text{ps} \operatorname{BEFORE} \operatorname{CONTACT}(C_1, C_2, 4.5\ \text{Å})$$
* *Evaluation Target:* Evaluates temporal interval synthesis and pruning efficiency under complex compositions.

---

## 4. The Ten Mandatory Baselines

Every benchmark evaluation must report comparative figures against the following ten baseline configurations:

1. **MDAnalysis Direct Scan (Serial):** Standard sequential loop reading `.xtc` frames via `mda.Universe` and computing observables with built-in distance modules.
2. **MDAnalysis Parallel Scan (pmda):** Multicore parallel trajectory reading across CPU cores using parallel MDAnalysis workers.
3. **MDTraj Direct Scan:** High-performance C/Cython trajectory scanning using `mdtraj.load_xtc` and `mdtraj.compute_distances`.
4. **MDAnalysis Optimized Selection:** Memory-mapped atom group slicing designed to minimize coordinate copying.
5. **Precomputed Columnar Cache (Parquet/Arrow):** Columnar disk storage of pre-materialized observable time series.
6. **Precomputed Observable Table (HDF5):** Distance matrix precomputed offline and saved to an uncompressed HDF5 dataset.
7. **Simple Scalar Interval Index:** Non-geometric naive block min/max scalar distance interval index.
8. **MOCS Direct Scan (Plan A):** MOCS-Cert executing through its pipeline without index assistance.
9. **MOCS Indexed Pruning (Plan B):** MOCS-Cert using Level 1 AABB index bounds with single-pass exact candidate scans.
10. **MOCS Hierarchical Refinement (Plan D):** Full MOCS-Cert pipeline with multi-level dyadic block subdivision.

---

## 5. Quantitative Evaluation Metrics

Every benchmark report must collect and publish the following metrics conforming to the multi-tier accounting architecture:

| Metric Name | Symbol | Technical Definition | Unit |
|---|---|---|---|
| **Soundness Violation Count** | $N_{\text{unsound}}$ | $|\{q \mid \operatorname{MOCS}(q) \ne \operatorname{Ref}(q) \land \operatorname{MOCS}(q) \in \{\text{TRUE}, \text{FALSE}\}\}|$ | Integer ($0$ mandatory) |
| **Source Compressed Bytes Fetched** | $B_{\text{disk}}$ | Raw compressed trajectory bytes requested from storage bus | Megabytes ($\text{MB}$) |
| **Compressed Frames Decoded** | $F_{\text{decode}}$ | Total trajectory frames decompressed by the coordinate codec | Frame count |
| **Coordinates Materialized** | $C_{\text{mat}}$ | 3D coordinate floats loaded into host RAM | Float count |
| **Atoms Analyzed** | $A_{\text{eval}}$ | Atom coordinates evaluated in predicate calculations | Float count |
| **Index Bytes Read** | $B_{\text{index}}$ | Bytes read from Level 0 and Level 1 sidecar files | Kilobytes ($\text{KB}$) |
| **Pruning Efficiency** | $\eta_{\text{prune}}$ | $\frac{\text{Blocks certified TRUE or FALSE without frame I/O}}{\text{Total temporal blocks } M}$ | Dimensionless $[0.0, 1.0]$ |
| **Refinement Fraction** | $F_{\text{refine}}$ | $\frac{\text{Frames evaluated in exact refinement}}{\text{Total frames in trajectory } N}$ | Dimensionless $[0.0, 1.0]$ |
| **Index Overhead Ratio** | $\Omega_{\text{storage}}$ | $\frac{\text{Total size of sidecar directory (.mocs)}}{\text{Total trajectory file size}}$ | Percentage $(\%)$ |
| **Query Latency** | $T_{\text{lat}}$ | Wall-clock time elapsed from query submission to certificate emission | Milliseconds ($\text{ms}$) |
| **Peak Resident Memory** | $\operatorname{RSS}$ | Maximum resident working memory footprint | Megabytes ($\text{MB}$) |
| **Workload Throughput** | $\Theta$ | $\frac{\text{Total queries evaluated}}{\text{Total workload wall-clock time}}$ | Queries / second |
| **Break-Even Workload** | $N_{\text{break-even}}$ | $\frac{C_{\text{build}}}{T_{\text{direct}} - T_{\text{indexed}}}$ | Query count |

---

## 6. Experimental Execution Protocol and Statistical Rigor

1. **Host Environment Isolation:** Disable dynamic CPU frequency scaling (set CPU governor to `performance`). Close background daemons and record host hardware metadata.
2. **OS Page Cache Protocol:**
   * **Cold-Cache Mode (`--cache-mode cold`):** Flush OS page caches immediately before each trial:
     ```bash
     # Linux:
     sync; echo 3 | sudo tee /proc/sys/vm/drop_caches
     # Windows PowerShell:
     Clear-SystemCache
     ```
     Run a minimum of $5$ replicate trials.
   * **Warm-Cache Mode (`--cache-mode warm`):** Execute $1$ unmeasured warmup trial to prime OS page caches, followed by a minimum of $10$ measured replicate trials.
3. **Statistical Reporting Standards:**
   * Report **Median** and **Interquartile Range (IQR)** for all timing and latency metrics (never arithmetic mean, which is distorted by I/O tail latency).
   * Report **95% Bootstrap Confidence Intervals** for speedup ratios.
   * For sample sizes $N \ge 15$, conduct a two-sided Wilcoxon signed-rank test against the primary baseline; for smaller sample sizes ($N < 15$), report median paired differences and Cliff's delta effect sizes.
   * Terminology rule: Replicate runs on the same hardware are designated **replicate trials** (never "independent runs").
