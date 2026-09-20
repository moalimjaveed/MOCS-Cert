# QUERY_IR_AND_COMPILER.md — MOCS-Cert Compiler, IR, and Optimization Engine

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Research Baseline  
**Canonical Owner:** `QUERY_IR_AND_COMPILER.md` is the authoritative specification for AST lowering, Observable Dependency DAG, and physical plan generation. Tracked in [`DOC_MANIFEST.yaml`](../DOC_MANIFEST.yaml).  
**Cross-References:** [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md), [`QUERY_LANGUAGE_SPEC.md`](QUERY_LANGUAGE_SPEC.md), [`CERTIFICATE_INDEX_SPEC.md`](CERTIFICATE_INDEX_SPEC.md), [`MATHEMATICAL_MODEL.md`](MATHEMATICAL_MODEL.md), [`PERFORMANCE_MODEL.md`](PERFORMANCE_MODEL.md).

---

## 1. Compiler Architecture and Representation Pipeline

The MOCS-Cert compiler transforms a high-level scientific query into an optimized, certified physical execution plan. The compilation pipeline operates across five progressive intermediate representations:

```
[ User Query / Python API Call ]
               │
               ▼
       [ Frontend Parser ]
               │
               ▼
    [ Abstract Syntax Tree (AST) ]
               │
               ▼
    [ Type Checker & Validator ]
               │
               ▼
       [ Logical Query IR ]
               │
               ▼
  [ Observable Dependency Analyzer ]
               │
               ▼
   [ Observable Dependency DAG ]
               │
               ▼
 [ Cost-Based Plan Optimizer (J(P)) ]
               │
               ▼
    [ Physical Execution Plan ]
               │
               ▼
   [ Certified Query Runtime ]
```

---

## 2. Representation Tiers

### 2.1 Tier 1: Logical Query IR

The Logical Query IR represents the declarative semantics of the query without committing to physical execution strategies (e.g., whether a distance will be computed from raw frames, fetched from cache, or pruned via bounding box envelopes).

**Logical IR Schema:**

```yaml
LogicalPlan:
  plan_id: "logical-uuid"
  contract:
    pbc_mode: "orthorhombic_minimum_image"
    precision: "float64"
    sampling: "sampled_frames"
  root_node:
    type: "TemporalJoin"
    operator: "BEFORE"
    left_child:
      type: "TemporalFilter"
      operator: "FOR"
      min_duration_ps: 100.0
      child:
        type: "PredicateFilter"
        operator: "HBOND"
        donor: "A:155:NE2"
        hydrogen: "A:155:HE2"
        acceptor: "LIG:1:O2"
        d_cutoff_A: 3.5
        angle_cutoff_deg: 120.0
    right_child:
      type: "PredicateFilter"
      operator: "CONTACT"
      atom_a: "A:200:CA"
      atom_b: "LIG:1:C1"
      cutoff_A: 4.5
```

---

### 2.2 Tier 2: Observable Dependency DAG

The Observable Dependency DAG exposes shared sub-computations. In exploratory multi-query workloads, numerous complex predicates share common geometric primitives (e.g., both an HBOND and a CONTACT predicate depend on pairwise distance calculations between overlapping selections).

```
                      Query Root (BEFORE)
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
     HBOND Predicate                      CONTACT Predicate
      (A:155 -> LIG)                        (A:200 -> LIG)
            │                                     │
     ┌──────┴──────┐                              │
     ▼             ▼                              ▼
DISTANCE         ANGLE                         DISTANCE
(A:155, LIG:O2)  (D, H, A)                     (A:200, LIG:C1)
     │                                            │
     └─────────────────────┬──────────────────────┘
                           ▼
                  Trajectory Coordinate
                     Stream (Reader)
```

**Common Subexpression Elimination (CSE):**
If query $Q_1$ requires $\operatorname{DISTANCE}(A, B)$ and query $Q_2$ requires $\operatorname{CONTACT}(A, B, 4.0)$, the compiler collapses these into a single shared node in the dependency DAG. The envelope bounds or distance time series are computed once and consumed by both consumers.

---

### 2.3 Tier 3: Physical Execution Plan

The Physical Execution Plan commits to specific runtime operators, access paths, indexing strategies, memory allocations, and refinement loops.

**Physical Plan Schema:**

```yaml
PhysicalPlan:
  plan_id: "plan-phys-0042"
  plan_type: "Plan-D"  # Indexed Pruning with Hierarchical Refinement
  estimated_cost_J: 124.5
  pipeline_steps:
    - step_id: 1
      operator: "MCI_Index_Scan"
      selection_a: "A:155:NE2"
      selection_b: "LIG:1:O2"
      block_level: 0  # Coarse blocks (b=100)
      output_channel: "hbond_donor_acceptor_bounds"

    - step_id: 2
      operator: "Block_Threshold_Filter"
      input_channel: "hbond_donor_acceptor_bounds"
      predicate: "< 3.5 A"
      actions:
        certified_true: "mark_candidate"
        certified_false: "prune_block"
        unknown: "mark_refine_queue"

    - step_id: 3
      operator: "Selective_Refinement_Loop"
      input_channel: "mark_refine_queue"
      strategy: "dyadic_split_to_exact"
      max_refinement_depth: 3

    - step_id: 4
      operator: "Exact_Coordinate_Scan"
      target_blocks: "surviving_candidates"
      atoms_to_read: ["A:155:NE2", "A:155:HE2", "LIG:1:O2"]
      evaluator: "mocs.reference.hbond.exact_hbond_frame"

    - step_id: 5
      operator: "Temporal_Interval_Synthesizer"
      predicate_stream: "exact_hbond_series"
      min_duration_ps: 100.0
      output_channel: "event_intervals_A"

    - step_id: 6
      operator: "Temporal_Precedence_Join"
      left_events: "event_intervals_A"
      right_events: "event_intervals_B"
      condition: "left.k_e <= right.k_s"  # Half-open interval discrete precedence

    - step_id: 7
      operator: "Certificate_Emitter"
      output_path: "trajectory.mocs/certificates/e7b8c381.json"
```

---

## 3. Compiler Optimization Passes

The MOCS-Cert compiler applies five standard optimization passes before plan finalization:

### 3.1 Pass 1: Predicate Pushdown
Spatial contact thresholds ($\theta$) are pushed directly into index scans. Rather than materializing floating-point distance intervals for all blocks, the index evaluator emits three-valued Boolean classification vectors (`TRUE`, `FALSE`, `UNKNOWN`) directly at the block level.

### 3.2 Pass 2: Spatial Pruning
Blocks proven to have lower distance bound $L \ge \theta$ are pruned immediately. Their frame byte offsets are stripped from the trajectory read queue, guaranteeing that zero I/O bandwidth is expended on non-interacting frames.

### 3.3 Pass 3: Temporal Short-Circuiting and Pruning
For temporal ordering queries such as $\operatorname{BEFORE}(A, B)$:
* If event $A$ is certified to occur in block range $[0, 50]$, and an exact evaluation of $B$ reveals an event at frame index $10$ ($10 < 50$), the $\operatorname{BEFORE}$ predicate evaluates to `FALSE` immediately.
* Remaining blocks ($[51, M-1]$) are pruned from evaluation (Early Termination / Short-Circuit).

### 3.4 Pass 4: Adaptive Materialization Analysis
The compiler consults the session workload statistics. If an atom selection's AABB summary has been referenced more than a threshold frequency $N_{\text{reuse}}$, the compiler inserts a materialization step to persist the selection summary to disk in the sidecar `selections/` directory.

### 3.5 Pass 5: Fallback and Guard Rails
If the system detects unsupported features (e.g. non-orthorhombic simulation cells or missing periodic dimensions), the optimizer bypasses indexed planning entirely and emits a guarded error or falls back directly to Plan A (Exact Direct Scan) with an explicit explanatory notice.

---

## 4. The Four Concrete Plan Archetypes

| Plan ID | Name | Description | Best Suited For |
|---|---|---|---|
| **Plan A** | **Direct Scan** | Full sequential scan of all trajectory frames using brute-force evaluation. Zero indexing overhead. | One-off queries; trajectories smaller than 10 MB; non-indexable complex metrics. |
| **Plan B** | **Indexed Pruning** | Uses Level 1 AABB index bounds to prune impossible blocks; surviving blocks read exact frames. | Single queries on pre-indexed systems; high pruning efficiency ($\eta_{\text{prune}} > 0.8$). |
| **Plan C** | **Observable Cache** | Reads pre-computed, materialized Boolean or scalar time series from `trajectory.mocs/cache/`. Non-zero cost $C_{\text{lookup}} + C_{\text{read}} > 0$. | Heavily repeated queries on identical atom selections across interactive exploration. |
| **Plan D** | **Hierarchical Refinement** | Full MOCS pipeline: coarse bounds $\to$ dyadic block subdivision $\to$ exact frame scan only on unresolved leaves. | Large multi-query workloads; exploratory screening across thousands of candidate residue pairs. |

---

## 5. Cost-Based Plan Selection Algorithm

The optimizer selects the **lowest estimated-cost plan among enumerated feasible candidates** using a calibrated, dimensionally sound execution time model $\hat{T}(P)$ with memory as a feasibility constraint:

$$\hat{T}(P) = T_{\text{IO}}(P) + T_{\text{decode}}(P) + T_{\text{CPU}}(P) + T_{\text{refine}}(P) + T_{\text{compile}}(P)$$

subject to:
$$\operatorname{PeakMemory}(P) \le M_{\text{budget}}$$

where:
* $T_{\text{IO}}(P) = \frac{\text{BytesToRead}(P)}{\text{Bandwidth}_{\text{storage}}}$
* $T_{\text{decode}}(P) = \frac{\text{FramesToDecode}(P)}{\text{DecodeRate}_{\text{codec}}}$
* $T_{\text{CPU}}(P) = \frac{\text{CoordinatesMaterialized}(P) \cdot \text{FLOPsPerAtom}}{\text{ComputeThroughput}_{\text{CPU}}}$
* $T_{\text{refine}}(P)$: The **incremental overhead** of hierarchical index traversal and interval subdivision bookkeeping (all I/O and frame decoding incurred during refinement are accounted strictly in $T_{\text{IO}}$ and $T_{\text{decode}}$ to prevent double-counting).
* $T_{\text{compile}}(P)$: Optimization and contract generation time.

```python
def select_execution_plan(query: LogicalPlan, index: MCI, session: Session) -> PhysicalPlan:
    """
    Evaluates all feasible candidate plan archetypes (Plan A, B, C, D)
    and selects the plan minimizing estimated execution time.
    """
    candidates = []

    # 1. Plan C: Materialized Observable Cache (if valid cache entry exists)
    cache_key = compute_observable_hash(query)
    if session.cache.contains(cache_key):
        cost_C = estimate_cache_lookup_and_read_time(query, session.hardware_weights)
        candidates.append(PhysicalPlan(type="Plan-C", estimated_time_sec=cost_C))

    # 2. Plan A: Direct Sequential Scan (always feasible)
    cost_A = estimate_direct_scan_time(query, session.hardware_weights)
    candidates.append(PhysicalPlan(type="Plan-A", estimated_time_sec=cost_A))

    # Determine index construction amortization
    index_exists = index.has_selections(query.selections)
    if index_exists:
        build_time_share = 0.0
    else:
        # Amortize cold index construction across estimated remaining workload
        total_build_time = estimate_index_build_time(query.selections, session.hardware_weights)
        workload_n = max(1, session.workload_remaining_queries)
        build_time_share = total_build_time / workload_n

    # 3. Plan B: Single-Level Indexed Pruning (Level 1 AABB without dyadic refinement)
    cost_B = build_time_share + estimate_single_level_indexed_time(query, session.hardware_weights)
    candidates.append(PhysicalPlan(type="Plan-B", estimated_time_sec=cost_B))

    # 4. Plan D: Hierarchical Dyadic Refinement
    # CRITICAL INVARIANT: If index is missing, Plan D MUST include the amortized build cost!
    cost_D = build_time_share + estimate_hierarchical_refinement_time(query, index, session.hardware_weights)
    candidates.append(PhysicalPlan(type="Plan-D", estimated_time_sec=cost_D))

    # 5. Filter by memory constraint and select minimum estimated time
    feasible = [p for p in candidates if p.peak_memory_bytes <= session.memory_budget_bytes]
    if not feasible:
        return PhysicalPlan(type="Plan-A", estimated_time_sec=cost_A)

    return min(feasible, key=lambda p: p.estimated_time_sec)
```
