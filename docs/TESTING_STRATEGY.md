# TESTING_STRATEGY.md — MOCS-Cert Testing and Quality Assurance Strategy

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Research Baseline  
**Canonical Owner:** `TESTING_STRATEGY.md` is the authoritative QA architecture, testing pyramid, and pre-release gate specification for MOCS-Cert. Tracked in [`DOC_MANIFEST.yaml`](../DOC_MANIFEST.yaml).  
**Cross-References:** [`CORRECTNESS_AND_VALIDATION.md`](CORRECTNESS_AND_VALIDATION.md), [`FUZZING_AND_ADVERSARIAL_TESTING.md`](FUZZING_AND_ADVERSARIAL_TESTING.md), [`DEVELOPER_ARCHITECTURE.md`](DEVELOPER_ARCHITECTURE.md), [`KILL_CRITERIA.md`](KILL_CRITERIA.md).

---

## 1. Objective and Separation of Concerns

While [`CORRECTNESS_AND_VALIDATION.md`](CORRECTNESS_AND_VALIDATION.md) defines the mathematical theory of soundness vs. completeness, this document establishes the **practical software engineering test suite architecture, execution protocols, and pre-release gates**.

The MOCS-Cert QA framework is designed to prevent regressions, enforce performance boundaries, and guarantee that no release is published with an unresolved soundness disagreement against `mocs-reference`.

```
                              TEST SUITE PYRAMID
                                      ▲
                                     / \
                                    /   \
                                   /     \
                                  /  REL  \     ◄── Pre-Release Gate (Zero Soundness Bugs)
                                 /─────────\
                                /   PERF    \   ◄── MOBench Benchmarks & Break-Even
                               /─────────────\
                              /     FUZZ      \ ◄── Boundary Singularities (mocs-fuzz)
                             /─────────────────\
                            /   DIFFERENTIAL    \◄── Dual-Engine Oracle Verification
                           /─────────────────────\
                          /      INTEGRATION      \◄── Full Query Pipeline (mocs.open/query)
                         /─────────────────────────\
                        /           UNIT            \ ◄── Pure Bounds, Math & Parser (< 30s)
                       └─────────────────────────────┘
```

---

## 2. Test Suite Categorization and Tooling

### 2.1 Unit Tests (`tests/unit/`)
* **Scope:** Tests isolated functions, vector math routines, AST lowering passes, and file seek table logic in complete isolation from disk I/O where possible.
* **Execution Runner:** `pytest tests/unit/ -v`
* **Performance Budget:** Must execute to completion in under $30\ \text{seconds}$ on a 4-core workstation.
* **Coverage Target:** Minimum $90\%$ line coverage across `mocs/bounds/`, `mocs/semantics/`, and `mocs/ir/`.

### 2.2 Integration Tests (`tests/integration/`)
* **Scope:** Exercises the complete user-facing pipeline from `mocs.open()` through query parsing, DAG planning, MCI index retrieval, hierarchical refinement, and certificate emission over synthetic mini-trajectories ($1,000$ frames).
* **Execution Runner:** `pytest tests/integration/ -v`
* **Key Scenarios Tested:**
  * End-to-end `DISTANCE` threshold queries.
  * Staged `HBOND` candidate pruning and refinement.
  * Temporal composition (`BEFORE`, `FOR`, `FOLLOWED_BY`).
  * Invalidation of sidecar caches upon source file modification.

### 2.3 Reference Differential Tests (`tests/differential/`)
* **Scope:** Evaluates candidate execution plans directly against `mocs-reference` over identical trajectory datasets.
* **Execution Runner:** `pytest tests/differential/ -v --trajectories 5`
* **Pass Condition:** Absolute agreement on all certified states.
  * $\operatorname{truth\_value}(q) \equiv \operatorname{Ref}(q)$ whenever $\operatorname{resolution\_status}(q) = \text{COMPLETE}$.
  * `UNKNOWN` is allowed as a sound incomplete result (`NEEDS_REFINEMENT` or `UNRESOLVABLE_SAMPLING`).
  * **Any contradiction is a catastrophic failure.**

### 2.4 Adversarial and Fuzz Tests (`tests/fuzz/`)
* **Scope:** Driven by `mocs-fuzz` (see [`FUZZING_AND_ADVERSARIAL_TESTING.md`](FUZZING_AND_ADVERSARIAL_TESTING.md)). Injects boundary values ($3.499999\ \text{Å}$, box face alignment, single-frame events, zero vectors).
* **Execution Runner:** `python -m mocs.fuzz.generator --cases 500 --seed 42`

### 2.5 Property-Based Tests (`tests/property/`)
* **Scope:** Uses `hypothesis` to generate randomized coordinate configurations, verifying invariant mathematical properties (e.g. AABB envelope containment, distance bound monotonicity, coordinate translation invariance).
* **Execution Runner:** `pytest tests/property/ -v`

### 2.6 Regression Tests (`tests/regression/`)
* **Scope:** Every fixed bug in MOCS-Cert receives a dedicated, permanent regression test named after its issue tracker ID (e.g., `test_issue_104_pbc_wrapping.py`).
* **Rule:** A bug fix PR cannot be merged without an accompanying regression test reproducing the original failure.

### 2.7 Performance and Amortization Tests (`benchmark/`)
* **Scope:** Tracks query execution latency, coordinate read fractions, and index build times over designated standard workloads using MOBench.
* **Rule:** Performance regressions $> 15\%$ in the core bound evaluation loops block promotion to production release branches.

### 2.8 Reproducibility Audits (`tests/reproducibility/`)
* **Scope:** Periodic automated re-execution of published benchmark manifests from recorded git commit SHAs, ensuring that environment changes (e.g., NumPy or MDAnalysis minor updates) have not introduced numerical drift.

---

## 3. Pre-Release Quality Gate

Before any release tag (e.g. `v0.1.0-alpha`, `v0.1.0`) is published to PyPI or GitHub, the candidate build must satisfy the **MOCS-Cert Release Gate Checklist**:

```markdown
### MOCS-Cert Mandatory Release Gate

- [ ] **1. Unit Suite:** 100% pass across all unit tests (pytest tests/unit/).
- [ ] **2. Integration Suite:** 100% pass across all integration workflows.
- [ ] **3. Differential Oracle:** Zero disagreements against mocs-reference across 30 Phase A trajectories.
- [ ] **4. Fuzzing Cleanliness:** Zero failures on the 10 standard adversarial boundary cases.
- [ ] **5. Type Checking:** mypy --strict passes with 0 errors across mocs/.
- [ ] **6. Offline Certificate Audit:** Standalone verifier (mocs.verify) validates 100% of emitted test certificates.
- [ ] **7. Kill Criteria Audit:** Confirmed that no metric violates thresholds in KILL_CRITERIA.md.
- [ ] **8. Documentation Alignment:** All 35 specification documents verified as internally consistent.
```

If any single check fails, the release is aborted immediately.
