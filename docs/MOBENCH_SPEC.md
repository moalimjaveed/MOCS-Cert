# MOBENCH_SPEC.md — Molecular Observability Benchmark (MOBench) Suite Specification

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Research Baseline  
**Canonical Owner:** `MOBENCH_SPEC.md` is the authoritative specification for MOBench dataset manifests, workload records, and test harness execution rules. Tracked in [`DOC_MANIFEST.yaml`](../DOC_MANIFEST.yaml).  
**Cross-References:** [`BENCHMARK_SPEC.md`](BENCHMARK_SPEC.md), [`PERFORMANCE_MODEL.md`](PERFORMANCE_MODEL.md), [`DATA_PROVENANCE.md`](DATA_PROVENANCE.md), [`EXPERIMENT_LOG_TEMPLATE.md`](EXPERIMENT_LOG_TEMPLATE.md).

---

## 1. Executive Purpose

**MOBench (Molecular Observability Benchmark)** is the standardized, open-source benchmark suite designed to evaluate the computational efficiency, soundness, and scaling properties of contract-driven molecular trajectory query compilers.

MOBench provides:
1. Standardized trajectory-topology dataset records with cryptographic manifests.
2. Formally defined multi-query workloads simulating real biophysical analysis tasks.
3. Automated test harnesses executing all 10 standard baselines under identical environmental conditions.
4. Machine-readable schema definitions for results reporting and figure generation.

**Scientific Integrity Notice:** MOBench does **not** pre-specify final speedup numbers or performance outcomes. All performance numbers must be empirically measured on designated hardware and reported with statistical dispersion metrics.

---

## 2. MOBench Phase Structure

MOBench is deployed across three progressive empirical research phases:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase A: Mechanism Feasibility & Kill Testing (30 Trajectories)        │
│ • Focus: Bound tightness, AABB pruning rates, N_break-even measurement │
│ • Decision Gate: Pass Kill Criteria K-S1, K-S2, K-Sy1, K-Sy2           │
├────────────────────────────────────────────────────────────────────────┤
│ Phase B: Systems Performance & Baseline Showdown (200-500 Trajectories)│
│ • Focus: Complete 10-baseline comparison across diverse topologies     │
│ • Decision Gate: Multi-query workload amortization verification        │
├────────────────────────────────────────────────────────────────────────┤
│ Phase C: Generalization & Transition Corpus Mining (1000+ Trajectories)│
│ • Focus: Scalability across large institutional repositories           │
│ • Research Scope: Event stream transition pattern discovery            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Schema Definitions

### 3.1 Dataset Manifest Schema (`dataset.json`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "MOBenchDatasetRecord",
  "type": "object",
  "required": [
    "dataset_id",
    "name",
    "system_class",
    "trajectory_file",
    "topology_file",
    "trajectory_sha256",
    "topology_sha256",
    "frame_count",
    "atom_count",
    "dt_ps",
    "box"
  ],
  "properties": {
    "dataset_id": { "type": "string", "pattern": "^mobench-[A-C]-[0-9]{3}$" },
    "name": { "type": "string" },
    "system_class": {
      "type": "string",
      "enum": ["soluble_globular", "membrane_receptor", "protein_ligand", "idp", "nucleic_acid"]
    },
    "trajectory_file": { "type": "string" },
    "topology_file": { "type": "string" },
    "trajectory_sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "topology_sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "frame_count": { "type": "integer" },
    "atom_count": { "type": "integer" },
    "dt_ps": { "type": "number" },
    "box": {
      "type": "object",
      "required": ["type", "lengths_angstrom"],
      "properties": {
        "type": { "type": "string", "enum": ["orthorhombic"] },
        "lengths_angstrom": { "type": "array", "items": { "type": "number" }, "minItems": 3, "maxItems": 3 }
      }
    }
  }
}
```

---

### 3.2 Workload Manifest Schema (`workload.json`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "MOBenchWorkloadRecord",
  "type": "object",
  "required": [
    "workload_id",
    "dataset_id",
    "workload_class",
    "description",
    "queries"
  ],
  "properties": {
    "workload_id": { "type": "string" },
    "dataset_id": { "type": "string" },
    "workload_class": {
      "type": "string",
      "enum": ["single_ad_hoc", "parameter_tuning", "combinatorial_screen", "temporal_compound", "interactive_session"]
    },
    "description": { "type": "string" },
    "queries": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["query_id", "observable", "operands", "predicate"],
        "properties": {
          "query_id": { "type": "string" },
          "observable": { "type": "string", "enum": ["DISTANCE", "CONTACT", "HBOND"] },
          "operands": { "type": "object" },
          "predicate": { "type": "object" },
          "temporal": { "type": ["object", "null"] }
        }
      }
    }
  }
}
```

---

### 3.3 Execution Result Record Schema (`result.json`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "MOBenchRunResult",
  "type": "object",
  "required": [
    "run_id",
    "workload_id",
    "baseline_id",
    "timestamp",
    "environment",
    "metrics"
  ],
  "properties": {
    "run_id": { "type": "string", "format": "uuid" },
    "workload_id": { "type": "string" },
    "baseline_id": {
      "type": "string",
      "enum": [
        "mdanalysis_direct",
        "mdanalysis_pmda",
        "mdtraj_direct",
        "mdanalysis_opt_selection",
        "parquet_columnar",
        "precomputed_hdf5",
        "simple_interval_index",
        "mocs_direct_planA",
        "mocs_indexed_planB",
        "mocs_refine_planD"
      ]
    },
    "environment": {
      "type": "object",
      "required": ["cpu_model", "ram_gb", "storage_media", "os", "python_version"],
      "properties": {
        "cpu_model": { "type": "string" },
        "ram_gb": { "type": "number" },
        "storage_media": { "type": "string", "enum": ["NVMe_PCIe4", "SATA_SSD", "HDD"] },
        "os": { "type": "string" },
        "python_version": { "type": "string" }
      }
    },
    "metrics": {
      "type": "object",
      "required": [
        "wall_time_ms",
        "bytes_read_os",
        "bytes_read_decompressed",
        "frames_decoded",
        "frames_evaluated",
        "coordinates_materialized",
        "atoms_analyzed",
        "index_bytes_read",
        "soundness_violations",
        "peak_memory_mb"
      ],
      "properties": {
        "wall_time_ms": { "type": "number" },
        "bytes_read_os": { "type": "integer" },
        "bytes_read_decompressed": { "type": "integer" },
        "frames_decoded": { "type": "integer" },
        "frames_evaluated": { "type": "integer" },
        "coordinates_materialized": { "type": "integer" },
        "atoms_analyzed": { "type": "integer" },
        "index_bytes_read": { "type": "integer" },
        "soundness_violations": { "type": "integer" },
        "peak_memory_mb": { "type": "number" },
        "blocks_pruned_pct": { "type": "number" }
      }
    }
  }
}
```

---

## 4. Standard Baseline Execution Rules

To ensure fair and uncompromised evaluation, every baseline implementation in MOBench must strictly adhere to the following rules:

1. **Idiomatic Implementation:** Each baseline must be written using standard best practices recommended in its official documentation. No baseline may be deliberately crippled (e.g. unbuffered frame loops or redundant array copies).
2. **Identical Atom Selections:** All baselines must resolve identical atom index lists extracted from the authoritative topology file.
3. **No In-Memory Cheating:** Direct scan baselines (MDAnalysis, MDTraj, MOCS Plan A) must start from cold disk files. Storing entire trajectories in RAM prior to query submission is permitted only for explicit in-memory/precomputed baselines (`precomputed_hdf5`, `parquet_columnar`).
4. **Equal Error Handling:** If an underlying library does not support minimum-image handling for specific boxes, it must raise an exception rather than silently outputting non-periodic coordinates.

---

## 5. Statistical Methodology and Publication Protocols

### 5.1 Sample Size and Replication
* **Cold Cache Trials:** Minimum 5 replicate trials per configuration, preceded by filesystem cache drops (`--cache-mode cold`).
* **Warm Cache Trials:** Minimum 10 replicate trials per configuration; the first run is an unmeasured warmup pass (`--cache-mode warm --warmup 1`).

### 5.2 Metric Aggregation
* **Central Tendency:** Reported as the **Median** ($\tilde{x}$). Mean is strictly prohibited for execution latency due to long-tail I/O pauses.
* **Dispersion Metric:** Reported as the **Interquartile Range (IQR)**:
  $$\operatorname{IQR} = Q_3 - Q_1$$
* **Significance Testing:** Paired comparisons between MOCS and baseline timings must report the non-parametric Wilcoxon signed-rank test $p$-value ($p < 0.01$ threshold) when $N \ge 15$. For smaller sample sizes ($N < 15$), report median paired differences and Cliff's delta effect sizes.

---

## 6. Standard Reproducibility CLI Workflow

Every published MOBench experiment must be 100% reproducible via standard command-line invocations:

```bash
# 1. Download and verify dataset SHA-256
python -m mocs.benchmark.datasets fetch --id mobench-A-001 --verify

# 2. Run automated benchmark suite across all baselines
python -m mocs.benchmark.runner \
    --workload mobench-A-001-W1 \
    --baselines all \
    --trials 5 \
    --cache-mode cold \
    --output-dir results/mobench_A_001_W1/

# 3. Verify soundness of all results against the reference oracle
python -m mocs.benchmark.verify --results results/mobench_A_001_W1/

# 4. Generate publication-ready figures and LaTeX summary tables
python -m mocs.benchmark.report \
    --results results/mobench_A_001_W1/ \
    --format latex \
    --output figures/
```
