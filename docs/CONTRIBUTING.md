# CONTRIBUTING.md — MOCS-Cert Contribution Guidelines

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Research Baseline  
**Canonical Governance:** All 35 specifications and their dependencies are registered in [`DOC_MANIFEST.yaml`](../DOC_MANIFEST.yaml).  
**Cross-References:** [`DEVELOPER_ARCHITECTURE.md`](DEVELOPER_ARCHITECTURE.md), [`CORRECTNESS_AND_VALIDATION.md`](CORRECTNESS_AND_VALIDATION.md), [`PRIOR_ART_AND_NOVELTY.md`](PRIOR_ART_AND_NOVELTY.md), [`TESTING_STRATEGY.md`](TESTING_STRATEGY.md).

---

## 1. Welcome and Scientific Ethos

Thank you for contributing to **MOCS-Cert**! 

MOCS-Cert is a formal scientific software project dedicated to certified, contract-driven molecular dynamics trajectory analysis. Because our software produces machine-verifiable execution proofs intended for scientific publication, our contribution standards prioritize **mathematical rigor, deductive soundness, and epistemic honesty** above rapid feature velocity.

A contribution that introduces a minor performance gain at the cost of an occasional soundness bug is strictly unacceptable. Conversely, refactorings that simplify verification or expose unstated assumptions are highly valued.

---

## 2. Code Quality and Style Standards

### 2.1 Language and Versioning
* Python 3.9+ exclusively.
* Strict PEP 8 formatting enforced via `black` (88-character line limit) and `isort`.
* Full type annotations (`typing`) required on all public functions, classes, and method signatures. Type safety is verified via `mypy --strict`.

### 2.2 Numerical and Algebraic Standards
* **Mandatory Double Precision:** All coordinate calculations, vector norms, and bounding algorithms must execute in `numpy.float64`. Float32 is permissible only when interfacing directly with compressed trajectory readers.
* **Explicit Tolerance Epsilon:** Never compare floating-point values using raw equality (`d == threshold`). Comparisons must apply the declared contract numerical epsilon ($10^{-6}\ \text{Å}$).
* **Pure Mathematical Functions:** Functions in `mocs/bounds/` must remain pure, deterministic, and free of side effects.

### 2.3 Documentation Hygiene
* Every new function or class must include a Google-style docstring citing its authoritative specification document (e.g. `"Conforms to FORMAL_SEMANTICS.md §3.1"`).
* Avoid duplicating definitions across documents. Always cite the single authoritative owner document.

---

## 3. Scientific Correctness Obligations

Any pull request touching mathematical bounds, observable operators, or temporal logic must satisfy the following scientific criteria:

1. **Epistemic Classification:** Every equation or bound introduced in PR descriptions or docstrings must be labeled explicitly as:
   * `[PROVEN BOUND]` (with included mathematical proof)
   * `[HEURISTIC]`
   * `[OPTIMIZATION OBJECTIVE]`
   * `[RESEARCH HYPOTHESIS]`
2. **Precondition Audit:** Any assumption regarding periodic boundary conditions, coordinate wrapping, or uniform sampling must be explicitly verified in code using fail-closed assertions.
3. **Reference Oracle Alignment:** The candidate code must be verified against `mocs-reference` across at least $10,000$ test frames with **zero** soundness discrepancies.

---

## 4. Benchmark and Performance Claim Requirements

To prevent misleading performance claims, any PR claiming a speedup, I/O reduction, or memory optimization must include:
1. **MOBench Conformance:** Results must be generated using the standardized MOBench benchmark runner (`mocs benchmark run`).
2. **Hardware Metadata:** The full CPU model, RAM capacity, storage media (NVMe/SSD/HDD), and OS must be detailed in the PR description.
3. **Standardized Metrics:** Must report Median and IQR across 5 cold-cache runs.
4. **Epistemic Labeling:** All claimed metrics must be tagged `[MEASURED]`. Unverified performance projections must be tagged `[TARGET]` or `[HYPOTHESIS]`.
5. **No Isolated Micro-optimizations:** Changes must demonstrate a net-positive impact on overall workload execution ($J(P)$), accounting for compilation and planning overhead.

---

## 5. Prohibition of Unsupported Scientific Claims

Pull requests will be rejected immediately by maintainers if PR descriptions, documentation additions, or docstrings violate [`PRIOR_ART_AND_NOVELTY.md`](PRIOR_ART_AND_NOVELTY.md) by:
* Using promotional hype terms (`"first-ever"`, `"unprecedented"`, `"revolutionary"`, `"unique"`).
* Claiming MOCS-Cert proves or certifies physical biological reality.
* Failing to acknowledge existing literature when introducing related algorithms.
* Claiming that MOCS-Cert replaces MDAnalysis, MDTraj, or MDCompress.

---

## 6. Pull Request Review Checklist

Before submitting a Pull Request, verify that all items in this checklist are satisfied:

```markdown
### PR Submitter Checklist

- [ ] **Architecture:** Respects unidirectional dependency rules in `DEVELOPER_ARCHITECTURE.md`.
- [ ] **Type Safety:** Passes `mypy --strict` with zero warnings.
- [ ] **Unit Testing:** Unit tests added in `tests/unit/` with > 90% code coverage.
- [ ] **Differential Testing:** Passes `tests/differential/` against `mocs-reference` with 0 soundness failures.
- [ ] **Adversarial Testing:** Tested against `mocs-fuzz` boundary cases (3.499999 A, PBC crossings).
- [ ] **No Unsound Claims:** No marketing hype or ungrounded physical reality claims.
- [ ] **Performance Provenance:** If claiming speedup, attached MOBench CSV log and hardware metadata.
- [ ] **Documentation:** Updated relevant authoritative specification document rather than duplicating text.
```

---

## 7. Licensing and Provenance

MOCS-Cert is distributed under the Apache License 2.0. By contributing to this project, you certify that:
1. The contribution was created in whole or part by you and you have the right to submit it under the Apache-2.0 license.
2. The code does not incorporate proprietary or un-attributed algorithms from academic or commercial software without explicit permission and attribution.
