# CORRECTNESS_AND_VALIDATION.md — MOCS-Cert Correctness and Verification Framework

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Research Baseline  
**Canonical Owner:** `CORRECTNESS_AND_VALIDATION.md` is the authoritative specification for verification hierarchy and mathematical soundness invariants. Tracked in [`DOC_MANIFEST.yaml`](../DOC_MANIFEST.yaml).  
**Cross-References:** [`REFERENCE_SEMANTICS.md`](REFERENCE_SEMANTICS.md), [`FUZZING_AND_ADVERSARIAL_TESTING.md`](FUZZING_AND_ADVERSARIAL_TESTING.md), [`MATHEMATICAL_MODEL.md`](MATHEMATICAL_MODEL.md), [`KILL_CRITERIA.md`](KILL_CRITERIA.md).

---

## 1. The Foundational Invariant: Soundness vs. Completeness

The validation architecture of MOCS-Cert is anchored upon a fundamental distinction between computational soundness and algorithmic completeness:

```
                   THE SOUNDNESS-COMPLETENESS SPECTRUM
                   
    [ UNSOUND ]               [ SOUND & INCOMPLETE ]       [ SOUND & COMPLETE ]
         │                              │                           │
  Emits False Proofs             Emits UNKNOWN when            Emits Exact Proofs
  (CRITICAL BUG - HARD STOP)    Evidence is Insufficient      for All Admissible Queries
                                 (ACCEPTABLE - OPTIMIZATION)   (IDEAL TARGET)
```

### 1.1 Soundness Target (Non-Negotiable Absolute)
Under no condition may MOCS-Cert return a certified result that contradicts the ground-truth calculation of the reference engine:

$$\forall Q, T, \Phi: \quad \operatorname{truth\_value}(Q) = \text{TRUE} \implies \operatorname{ReferenceEngine}(Q) = \text{TRUE}$$
$$\forall Q, T, \Phi: \quad \operatorname{truth\_value}(Q) = \text{FALSE} \implies \operatorname{ReferenceEngine}(Q) = \text{FALSE}$$

A single violation of this invariant is classified as a **Soundness Bug of Severity 1 (P0)**, immediately halting continuous integration pipelines and blocking release tags.

### 1.2 Completeness (Optimization Target)
MOCS-Cert is designed to remain sound even when incomplete. If an AABB bounding envelope is loose (e.g., during high-amplitude domain motion), the runtime safely returns `UNKNOWN` with resolution status `NEEDS_REFINEMENT`. The user or planner may then selectively refine the block down to exact frames. Returning `UNKNOWN` is never a defect; it is a sound acknowledgment of insufficient indexing resolution.

---

## 2. Multi-Tiered Verification Hierarchy

Validation in MOCS-Cert operates across eight rigorous levels:

```
[Level 8: Independent Certificate Auditing] ◄── Verifies emitted proofs offline
[Level 7: Fuzzing & Adversarial Testing]    ◄── Stress-tests boundary conditions
[Level 6: Reference Differential Testing]   ◄── Validates optimized engine vs. oracle
[Level 5: Property-Based Invariant Tests]   ◄── Hypothesis testing on arbitrary boxes
[Level 4: PBC & Minimum-Image Verification] ◄── Verifies boundary face transitions
[Level 3: End-to-End Integration Tests]     ◄── Full pipeline (Parser -> Plan -> Proof)
[Level 2: Unit Operator Tests]              ◄── Isolated distance/contact/hbond checks
[Level 1: Mathematical Bound Verification]  ◄── Analytic proofs on synthetic coordinates
```

---

## 3. Mathematical Verification and Bound Checks

Prior to executing on real trajectories, the geometric bound algorithms in `mocs/bounds/` are validated against synthetic coordinate matrices:

### 3.1 Exact Enclosure Check
For any synthetic atom trajectory $\mathbf{X} \in \mathbb{R}^{K \times 3}$ and its computed AABB $\mathcal{B} = [\mathbf{x}_{\min}, \mathbf{x}_{\max}]$:
$$\forall k \in [0, K-1], \quad \mathbf{x}_{\min} \le \mathbf{X}[k] \le \mathbf{x}_{\max}$$
This inequality must hold to floating-point exactness ($0.0$ tolerance).

### 3.2 Bound Monotonicity and Refinement Non-Expansion Check
For any partition split of an atom block $B_{\text{parent}} \to \{B_{\text{left}}, B_{\text{right}}\}$ and resulting pairwise distance bounds:
$$L_{\text{parent}} \le \min(L_{\text{left}}, L_{\text{right}}) \quad \text{and} \quad U_{\text{parent}} \ge \max(U_{\text{left}}, U_{\text{right}})$$
The bounding interval width must never widen under refinement:
$$W_{\text{child}} \le W_{\text{parent}}$$
Any violation where child bounds widen relative to the parent indicates an arithmetic overflow, periodic wrapping bug, or coordinate ordering error.

---

## 4. Property-Based Testing (Hypothesis Framework)

MOCS-Cert employs the `hypothesis` library to generate thousands of randomized, legally structured molecular systems:

```python
from hypothesis import given, strategies as st
import numpy as np

@given(
    box=st.lists(st.floats(min_value=20.0, max_value=200.0), min_size=3, max_size=3),
    coords_a=st.lists(st.floats(min_value=0.0, max_value=20.0), min_size=3, max_size=3),
    coords_b=st.lists(st.floats(min_value=0.0, max_value=20.0), min_size=3, max_size=3)
)
def test_distance_bound_invariants(box, coords_a, coords_b):
    """
    Property: Lower and Upper distance bounds must enclose the true 
    minimum-image distance for all generated configurations.
    """
    box_arr = np.array(box, dtype=np.float64)
    a = np.array(coords_a, dtype=np.float64) % box_arr
    b = np.array(coords_b, dtype=np.float64) % box_arr

    # Compute exact distance
    delta = b - a
    delta -= box_arr * np.round(delta / box_arr)
    d_exact = np.linalg.norm(delta)

    # Compute AABB bounds (point box test)
    aabb_a = (a, a)
    aabb_b = (b, b)
    L, U = compute_pbc_bounds(aabb_a, aabb_b, box_arr)

    assert L <= d_exact + 1e-9, f"Lower bound violation: L={L} > d={d_exact}"
    assert U >= d_exact - 1e-9, f"Upper bound violation: U={U} < d={d_exact}"
```

---

## 5. Floating-Point and Numerical Policies

1. **Strict IEEE-754 Float64:** All intermediate coordinate differences, vector norms, and bounding box comparisons in MOCS-Cert are computed in 64-bit double precision (`float64`).
2. **Machine Epsilon Policy:**
   When a computed distance $d$ falls within numerical tolerance $\epsilon = 10^{-6}\ \text{Å}$ of a threshold $\theta$ ($|d - \theta| \le \epsilon$), the runtime does not emit a brittle boolean decision. It tags the frame as a **Boundary Ambiguity**, maps the truth value to `UNKNOWN`, and sets the resolution status to `NEEDS_REFINEMENT` (or alerts the user that higher-precision coordinates or an exact evaluation are required), ensuring no false proofs are certified.
3. **Associativity Invariance:** Minimum image rounding $\operatorname{round}(x / L)$ must apply strict round-to-nearest-even tie-breaking to avoid drift across compiler targets.

---

## 6. Continuous Integration (CI) and Release Gateways

Every pull request to MOCS-Cert must clear the following automated test suites:

* **Suite A (Fast Unit):** Runs in $< 30\ \text{seconds}$. Validates AST parsing, IR lowering, and vector algebra.
* **Suite B (Differential Verification):** Runs against 5 standard benchmark trajectories ($1,000$ random queries). Requires $100\%$ agreement with `mocs-reference`.
* **Suite C (Adversarial Fuzzing):** Stress-tests $3.499999\ \text{Å}$ boundary conditions and box edge-crossings.
* **Suite D (Offline Certificate Audit):** Generates and independently verifies certificates using the standalone verifier.
