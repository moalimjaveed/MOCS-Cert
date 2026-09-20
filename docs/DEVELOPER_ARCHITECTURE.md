# DEVELOPER_ARCHITECTURE.md — MOCS-Cert Codebase Architecture and Developer Guide

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Research Baseline  
**Canonical Owner:** `DEVELOPER_ARCHITECTURE.md` is the authoritative specification for module layout, unidirectional dependencies, and developer protocols. Tracked in [`DOC_MANIFEST.yaml`](../DOC_MANIFEST.yaml).  
**Cross-References:** [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md), [`CONTRIBUTING.md`](CONTRIBUTING.md), [`TESTING_STRATEGY.md`](TESTING_STRATEGY.md), [`FORMAL_SEMANTICS.md`](FORMAL_SEMANTICS.md).

---

## 1. Repository Layout and Module Hierarchy

The MOCS-Cert software repository is organized to enforce clean separation between declarative contracts, mathematical bounding routines, lazy indexing structures, query planning, and the ground-truth reference oracle.

```
mocs/
├── __init__.py                  # Top-level package exports (mocs.open, mocs.verify)
│
├── reference/                   # AUTHORITATIVE REFERENCE ORACLE (mocs-reference)
│   ├── __init__.py
│   ├── distance.py              # Pure MDAnalysis/NumPy distance evaluator
│   ├── contact.py               # Pure reference contact evaluator
│   ├── hbond.py                 # Reference Baker-Hubbard hydrogen bond evaluator
│   └── temporal.py              # Discrete frame-run temporal evaluator
│
├── semantics/                   # CONTRACTS & TYPE SYSTEM
│   ├── __init__.py
│   ├── contracts.py             # ObservabilityContract C = (Q, eps, tau, policy)
│   ├── operators.py             # Observable metadata and capability registry
│   ├── units.py                 # Length, time, angle unit conversion
│   └── pbc.py                   # Orthorhombic cell specifications
│
├── arrays/                      # HYBRID ARRAY ACCELERATION (JAX / CuPy / NumPy)
│   ├── __init__.py
│   ├── dispatcher.py            # Device & array backend selection (auto/cpu/cuda)
│   ├── numpy_backend.py         # Standard CPU NumPy array operations
│   ├── cupy_backend.py          # CUDA/ROCm GPU accelerated batch array kernels
│   └── jax_backend.py           # JIT-compiled XLA vectorized reductions (jax.jit, vmap)
│
├── bounds/                      # GEOMETRIC ENVELOPE MATHEMATICS
│   ├── __init__.py
│   ├── aabb.py                  # Single-atom 3D Axis-Aligned Bounding Box
│   ├── interval_separation.py   # 1D coordinate interval math
│   └── periodic_bounds.py       # Minimum-image boundary patch math
│
├── index/                       # MOLECULAR CERTIFICATE INDEX (MCI)
│   ├── __init__.py
│   ├── manifest.py              # Level 0 manifest serialization
│   ├── source_map.py            # Binary frame seek table (frame_offsets.bin)
│   ├── selection_records.py     # Level 1 binary AABBBlockRecord serializer
│   └── hierarchy.py             # Dyadic temporal block partition trees
│
├── ir/                          # INTERMEDIATE REPRESENTATIONS
│   ├── __init__.py
│   ├── ast.py                   # Parser Abstract Syntax Tree nodes
│   ├── logical.py               # Logical Query IR nodes
│   ├── dag.py                   # Observable Dependency DAG & CSE engine
│   └── physical.py              # Physical Plan nodes
│
├── planner/                     # COST-BASED OPTIMIZER
│   ├── __init__.py
│   ├── cost_model.py            # Calibrated J(P) objective function
│   ├── plan_selector.py         # Plan A/B/C/D selection logic
│   └── hardware_calibration.py  # Benchmark calibration of weights (alpha..eta)
│
├── runtime/                     # CERTIFIED EXECUTION RUNTIME
│   ├── __init__.py
│   ├── direct_executor.py       # Plan A engine (direct brute-force scan)
│   ├── indexed_executor.py      # Plan B/D engine (index-pruned scan)
│   ├── refine_loop.py           # Hierarchical UNKNOWN block subdivision
│   └── temporal_synthesizer.py  # Discrete event interval generation
│
├── cache/                       # ADAPTIVE OBSERVABLE CACHE
│   ├── __init__.py
│   ├── observable_cache.py      # Materialized scalar/boolean series storage
│   └── invalidation.py          # Cryptographic digest invalidation triggers
│
├── certificates/                # CERTIFICATE GENERATION & AUDITING
│   ├── __init__.py
│   ├── schema_validator.py      # JSON-Schema 2020-12 verification
│   ├── emitter.py               # JSON certificate generator
│   └── auditor.py               # Offline independent verification engine
│
├── benchmark/                   # MOBENCH BENCHMARK SUITE
│   ├── __init__.py
│   ├── runner.py                # Automated benchmark CLI
│   ├── baselines/               # MDAnalysis, MDTraj, HDF5, MDCompress drivers
│   ├── datasets/                # Standard dataset manifest fetchers
│   └── plots/                   # Automated LaTeX and matplotlib figure scripts
│
├── fuzz/                        # ADVERSARIAL TEST SUITE (mocs-fuzz)
│   ├── __init__.py
│   ├── generator.py             # Boundary and singularity generator
│   └── differential_harness.py  # Dual-engine comparison harness
│
└── tests/                       # PYTEST TEST SUITE
    ├── unit/                    # Fast isolated module tests
    ├── integration/             # End-to-end query execution tests
    ├── differential/            # Reference vs. optimized differential tests
    └── property/                # Hypothesis invariant tests
```

---

## 2. Strict Unidirectional Dependency Architecture

To prevent architectural decay, circular dependencies, and the accidental leakage of optimization assumptions into the reference oracle, MOCS-Cert enforces a **Strict Unidirectional Dependency DAG**:

```
[reference/]  [bounds/]
     │            │
     ▼            ▼
[semantics/] ◄─ [index/]
     ▲            │
     │            ▼
     ├───────► [ir/]
     │            │
     │            ▼
     ├───────► [planner/]
     │            │
     │            ▼
     ├───────► [runtime/]
     │            │
     │            ▼
     └───────► [certificates/]
                  ▲
                  │
        [benchmark/] & [fuzz/]
```

### 2.1 Invariant Dependency Rules

0. **Unified Array Acceleration Layer (`arrays/`):**
   `arrays/` provides hardware-adaptive array operations (NumPy, JAX, CuPy). Modules in `bounds/`, `runtime/`, and `index/` import through `arrays.dispatcher` rather than binding exclusively to NumPy.
1. **Isolation of the Reference Oracle (`reference/`):**
   `reference/` may **NEVER** import from `bounds/`, `index/`, `ir/`, `planner/`, `runtime/`, or `cache/`. It depends strictly on standard external libraries (`MDAnalysis`, `numpy`) and `semantics/pbc.py`. This guarantees that `reference/` remains an untainted ground-truth oracle.
2. **Independence of Geometric Math (`bounds/`):**
   `bounds/` is a pure mathematical library. It may never import from `index/` (storage), `planner/`, or `runtime/`.
3. **Stateless Intermediate Representation (`ir/`):**
   `ir/` contains data structures and transformation passes. It never performs I/O or executes queries.
4. **Subservience of Benchmarks (`benchmark/` and `fuzz/`):**
   Testing and benchmarking modules are peripheral consumers; no production module in `mocs/` may ever import from `benchmark/` or `fuzz/`.

---

## 3. Module Interface Contracts

### 3.1 `bounds` to `index` Contract
`bounds.compute_pbc_bounds(box_a, box_b, cell_lengths) -> Tuple[float, float]` must be a pure, side-effect-free function returning conservative lower and upper Euclidean bounds in double precision.

### 3.2 `planner` to `runtime` Contract
`planner.select_plan(query_dag, index, hardware_profile) -> PhysicalPlan` must emit a serializable, deterministic plan graph committing to specific operator pipelines without triggering trajectory reads.

### 3.3 `runtime` to `certificates` Contract
`certificates.emit(result, query, session) -> dict` accepts the executed result evidence and produces a validated JSON certificate conforming strictly to `CERTIFICATE_SPEC.md`.

---

## 4. Step-by-Step Protocol: Adding a New Molecular Observable

To add a new observable operator (e.g., `RMSD` or `DIHEDRAL`), developers must execute the following sequential protocol:

1. **Formal Specification:** Document mathematical bounds, failure cases, and epistemic limits in [`OBSERVABLE_OPERATOR_SPEC.md`](OBSERVABLE_OPERATOR_SPEC.md).
2. **Reference Implementation:** Implement the slow, exact evaluator in `mocs/reference/<operator>.py` using MDAnalysis.
3. **Reference Tests:** Write exhaustive unit tests verifying the reference implementation against known analytical geometry in `tests/unit/`.
4. **Bound Derivation (If Certifiable):** If sound mathematical bounds exist, implement envelope math in `mocs/bounds/`. If sound bounds cannot be proven, register the operator as `boundable: False`.
5. **Operator Registration:** Add the operator contract and capability flags to `mocs/semantics/operators.py`.
6. **IR & DAG Lowering:** Add AST node classes in `mocs/ir/ast.py` and lowering logic in `mocs/ir/dag.py`.
7. **Differential Verification:** Run `mocs-fuzz` and verify that the optimized implementation achieves $100.0\%$ agreement with the reference implementation across $10,000$ test frames.
