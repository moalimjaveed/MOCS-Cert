# PERFORMANCE_MODEL.md — MOCS-Cert Computational Performance and Cost Model

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Design Baseline (Audit Revisions Applied)  
**Canonical Owner:** `PERFORMANCE_MODEL.md` is the authoritative specification for multi-tier I/O accounting, execution cost functional $J(P)$, break-even formulations, and hardware calibration in MOCS-Cert. Tracked in [`DOC_MANIFEST.yaml`](../DOC_MANIFEST.yaml).

---

## 1. Executive Summary and Principles

The MOCS-Cert performance model is an empirical, hardware-calibrated cost framework used by the query optimizer to select execution plans.

### 1.1 Strict Performance Claim Rules (Blueprint §41)
* **Never state:** *"MOCS is 100× faster"* or *"MOCS provides optimal execution"*.
* **Always state:** *"The benchmark will measure whether MOCS achieves speedup on exploratory workloads."*
* Every numerical figure in this and related benchmark documents must carry an explicit epistemological tag:
  * `[TARGET]`: An engineering design goal.
  * `[HYPOTHESIS]`: A theoretical conjecture to be tested experimentally.
  * `[MEASURED]`: An empirical quantity validated on specific hardware with recorded provenance.

---

## 2. Multi-Tier I/O & Compute Accounting

Because modern molecular dynamics trajectories are stored in compressed formats (such as XTC), frame reduction does not translate directly to physical disk byte reduction. MOCS-Cert mandates five distinct accounting metrics:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. source_compressed_bytes_fetched (bytes read from disk)   │
├────┼────────────────────────────────────────────────────────┤
│ 2. compressed_frames_decoded (decompression codec invocations)│
├────┼────────────────────────────────────────────────────────┤
│ 3. coordinates_materialized (floats loaded into host memory)│
├────┼────────────────────────────────────────────────────────┤
│ 4. atoms_analyzed (subset of coordinates used in predicate) │
├────┼────────────────────────────────────────────────────────┤
│ 5. index_bytes_read (sidecar AABB and seek table reads)     │
└─────────────────────────────────────────────────────────────┘
```

**[DEFINITION] (Multi-Tier I/O & Compute Metrics):**
1. **Source Compressed Bytes Fetched ($B_{\text{disk}}$):** Actual raw bytes requested from the underlying filesystem.
2. **Compressed Frames Decoded ($F_{\text{decode}}$):** Number of trajectory frame chunks uncompressed by the coordinate codec.
3. **Coordinates Decoded ($C_{\text{decode}}$):** Total raw 3D coordinate floats emitted by the decompression codec ($F_{\text{decode}} \times n_{\text{atoms}} \times 3$).
4. **Coordinates Materialized ($C_{\text{mat}}$):** Total 3D coordinate float elements loaded into Python host array memory (NumPy) or GPU device memory (CuPy / JAX).
5. **Coordinates Retained ($C_{\text{retain}}$):** Coordinates preserved in working memory after selection slicing for predicate evaluation.
6. **Atoms Analyzed ($A_{\text{eval}}$):** Number of atom coordinates evaluated in observable operators.
7. **Index Bytes Read ($B_{\text{index}}$):** Bytes read from Level 0 seek tables and Level 1 AABB selection sidecars.

---

## 3. Dimensional Execution Time Model

For any candidate execution plan $P$, total execution cost is evaluated using a dimensionally sound execution time estimator $\hat{T}(P)$ (in seconds), with memory footprint enforced as an optimization constraint:

$$\hat{T}(P) = T_{\text{IO}}(P) + T_{\text{decode}}(P) + T_{\text{CPU}}(P) + T_{\text{refine}}(P) + T_{\text{compile}}(P)$$

subject to:
$$\operatorname{PeakMemory}(P) \le M_{\text{budget}}$$

```
                             Execution Time Components of T(P)
 ┌─────────────────┬─────────────────┬─────────────────┬─────────────────┬─────────────────┐
 │    T_IO(P)      │   T_decode(P)   │    T_CPU(P)     │   T_refine(P)   │   T_compile(P)  │
 ├─────────────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┤
 │ Raw bytes read  │ Decompression   │ Observable      │ Incremental     │ AST parsing,    │
 │ from disk /     │ time spent in   │ arithmetic,     │ index traversal │ DAG CSE, plan   │
 │ storage bus     │ libxdrfile      │ distance FLOPs  │ & seek latency  │ optimization    │
 └─────────────────┴─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

### 3.1 Trajectory I/O Time ($T_{\text{IO}}$)
$$T_{\text{IO}}(P) = \frac{\text{BytesToRead}(P)}{\text{Bandwidth}_{\text{storage}}}$$
* **Direct Full Scan (Plan A):** Reads the complete source trajectory file.
* **Indexed Execution (Plan B/D):** Reads sidecar index bytes plus surviving candidate frame bytes ($B_{\text{index}} + f_{\text{refine}} \cdot S_{\text{source}}$).

### 3.2 Codec Decompression Time ($T_{\text{decode}}$)
$$T_{\text{decode}}(P) = \frac{\text{FramesToDecode}(P)}{\text{Throughput}_{\text{codec\_fps}}}$$
Direct scan decodes all $N$ frames. Indexed execution decodes only the unpruned frames $f_{\text{refine}} \cdot N$.

### 3.3 Compute Engine Calculation Time ($T_{\text{compute}}$ / $T_{\text{CPU}}$)
$$T_{\text{compute}}(P) = \frac{\text{FLOPs}(P)}{\text{Throughput}_{\text{compute}}}$$
Accounts for bounding box arithmetic, periodic wrapping, and pairwise Cartesian distance calculations. Throughput depends on the active array execution backend:
* **NumPy (CPU Baseline):** Bound by host CPU vector throughput and memory bandwidth.
* **CuPy (GPU CUDA/ROCm):** Massively parallel thread blocks evaluate coordinates directly in VRAM with zero host serialization.
* **JAX (OpenXLA JIT):** Fused XLA kernels combine coordinate extraction, minimum-image shifts, and norm evaluation in a single memory pass, dramatically reducing memory traffic.

### 3.4 Incremental Refinement Overhead ($T_{\text{refine}}$)
To **prevent double-counting**, $T_{\text{refine}}(P)$ measures strictly the **incremental overhead** of hierarchical index search:
* Dyadic tree traversal and bounding-box split bookkeeping.
* Non-sequential seek penalties ($T_{\text{seek}}$) associated with discontiguous block reads.
All physical byte reading and frame decompression occurring during refinement are accounted strictly in $T_{\text{IO}}$ and $T_{\text{decode}}$.

### 3.5 Materialized Cache Access (Plan C)
Plan C (in-memory cached intermediate view) incurs non-zero time:
$$T(P_C) = T_{\text{lookup}} + T_{\text{deserialize}} > 0$$
Cache hits avoid trajectory I/O and distance calculation, but incur key hashing and memory transfer overhead.

### 3.6 Compiler Overhead ($T_{\text{compile}}$)
One-time overhead of parsing, AST lowering, DAG construction, and cost evaluation:
$$T_{\text{compile}}(P) \approx 2\text{--}10\ \text{ms on modern x86\_64 CPU [TARGET]}$$

---

## 4. Break-Even Analysis ($N_{\text{break-even}}$)

The core economic hypothesis of MOCS-Cert is that **index construction pays back its upfront cost across exploratory multi-query workloads**.

```
  Total Wall Time
        │
        │             Direct Brute-Force Scan (Plan A)
        │            /
        │           /
        │          /
        │         /  ◄── Intersection = N_break-even
        │        /
        │       /───────────────── MOCS Indexed (Plan D)
        │      /
        │     / (Includes one-time Index Build Cost)
        │    /
        │   /
        └──────────────────────────────────────────── Workload Query Count (Q)
```

### 4.1 Mathematical Derivation

Let:
* $C_{\text{build}}$: Wall-clock time required to construct the Level 1 MCI index for selection $S$.
* $T_{\text{direct}}$: Wall-clock time to execute one query via direct brute-force scanning.
* $T_{\text{indexed}}$: Wall-clock time to execute one query via the certified index.
* $\Delta T_{\text{saved}} = T_{\text{direct}} - T_{\text{indexed}}$: Net time saved per query.

The break-even query count $N_{\text{break-even}}$ is defined as:

$$N_{\text{break-even}} = \frac{C_{\text{build}}}{T_{\text{direct}} - T_{\text{indexed}}} = \frac{C_{\text{build}}}{\Delta T_{\text{saved}}}$$

### 4.2 Authoritative Thresholds by Storage Tier

To resolve cross-document consistency across `RESEARCH_PLAN.md`, `KILL_CRITERIA.md`, and `RESEARCH_FIGURES.md`, the following authoritative thresholds govern MOCS-Cert:

| Storage Tier | Target Gate ($N_{\text{break-even}}$) [TARGET] | Warning / Investigation Zone | Project Termination Trigger [KILL] |
|---|:---:|:---:|:---:|
| **NVMe PCIe Gen4 SSD** | $\le 12$ queries | $12 < N \le 30$ queries | $> 30$ queries (Criterion K-E2) |
| **SATA SSD / Spinning HDD** | $\le 4$ queries | $4 < N \le 15$ queries | $> 15$ queries |

* **Target Gate:** Represents successful demonstration of computational leverage.
* **Warning Zone:** Requires algorithmic investigation of index build throughput and bound tightness; phase progression paused.
* **Project Termination:** Demonstrates that index build overhead cannot be amortized on exploratory workloads, triggering project termination under Criterion K-E2.

---

## 5. Workload Amortization and Multi-Query Dependency Reuse

When a researcher evaluates a batch of queries $Q = \{q_1, q_2, \dots, q_K\}$:

$$C_{\text{workload}}(Q) = C_{\text{build}}(S_{\text{unique}}) + \sum_{k=1}^K T_{\text{indexed}}(q_k) - T_{\text{DAG\_reuse}}(Q)$$

Where $T_{\text{DAG\_reuse}}$ quantifies the savings gained from Common Subexpression Elimination in the Observable Dependency DAG:
* If $q_1$ and $q_2$ share a common distance primitive $\operatorname{DISTANCE}(A, B)$, the block bounds are loaded and evaluated once for both queries.
* If a contact series is materialized for $q_1$, $q_2$ reuses the cached boolean vector without touching the MCI index.
