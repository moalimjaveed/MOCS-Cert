# FUZZING_AND_ADVERSARIAL_TESTING.md — MOCS-Cert Adversarial Fuzzing Specification

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Research Baseline  
**Canonical Owner:** `FUZZING_AND_ADVERSARIAL_TESTING.md` is the authoritative specification for boundary singularity generation, adversarial testing, and differential fuzzing in MOCS-Cert. Tracked in [`DOC_MANIFEST.yaml`](../DOC_MANIFEST.yaml).  
**Cross-References:** [`CORRECTNESS_AND_VALIDATION.md`](CORRECTNESS_AND_VALIDATION.md), [`REFERENCE_SEMANTICS.md`](REFERENCE_SEMANTICS.md), [`PBC_SEMANTICS.md`](PBC_SEMANTICS.md), [`TEMPORAL_SEMANTICS.md`](TEMPORAL_SEMANTICS.md).

---

## 1. Objectives and Adversarial Strategy

The MOCS Adversarial Testing Suite (`mocs-fuzz`) is purpose-built to break the conservative certification mechanisms of MOCS-Cert. Standard random testing frequently samples benign configurations far from decision boundaries. In contrast, `mocs-fuzz` deliberately generates worst-case numerical, topological, and geometric singularities.

```
                           mocs-fuzz Architecture
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
   [Threshold Boundary]      [Geometric Singularities] [Temporal & Boundary]
   • 3.499999 A vs 3.500001  • Collinear angles (180)  • Single-frame events
   • delta = 1e-9 A          • Zero-length vectors     • Events on block edges
   • Floating tie-breaks     • Box face straddling     • Multi-block crossings
           │                         │                         │
           └─────────────────────────┼─────────────────────────┘
                                     ▼
                      [Randomized Transformations]
                      • Global 3D Rigid Translations
                      • Global 3D Rigid Rotations
                      • Gaussian Coordinate Noise (sigma = 1e-4 A)
                      • Sweep Block Sizes b in {10, 25, 50, 100, 500}
                                     │
                                     ▼
                      [Differential Comparison Oracle]
                      Reference Engine <───► Optimized Engine
                                     │
                             Zero Discrepancies?
                             YES ──► PASS
                             NO  ──► SOUNDNESS BUG (CRITICAL)
```

---

## 2. Catalog of Mandatory Adversarial Cases

The test generator automatically synthesizes and injects the following ten adversarial test cases:

### Case 1: Threshold Boundary Proximity ($3.499999\ \text{Å}$ vs. $3.500001\ \text{Å}$)
* **Construction:** Coordinates constructed such that the true Euclidean distance evaluates to $3.500000\ \text{Å} \pm 10^{-6}\ \text{Å}$.
* **Target Vulnerability:** Floating-point rounding errors causing `TRUE` when the exact evaluator returns `FALSE`, or vice-versa.
* **Expected Invariant:** If $d = 3.500001\ \text{Å}$ and $\theta = 3.5\ \text{Å}$, MOCS must return `FALSE` or `UNKNOWN` (with resolution status `COMPLETE` or `NEEDS_REFINEMENT`), never `TRUE`.

### Case 2: Periodic Boundary Face Alignment
* **Construction:** An atom placed exactly at the cell boundary $x = 0.00000000\ \text{Å}$, and its partner at $x = L_x - 0.00000001\ \text{Å}$.
* **Target Vulnerability:** Inconsistent coordinate wrapping where one evaluator computes $d \approx 0.0\ \text{Å}$ across the boundary while the bounding box evaluator computes Cartesian separation $d \approx L_x$.
* **Expected Invariant:** Distance must evaluate to $\approx 10^{-8}\ \text{Å}$ in both reference and optimized runtimes.

### Case 3: Block Boundary Event Straddling
* **Construction:** A contact event that persists for 10 frames, starting at frame index $m \cdot b - 5$ and terminating at $m \cdot b + 5$ (spanning the exact partition boundary between Block $m-1$ and Block $m$).
* **Target Vulnerability:** Block-level aggregation logic prematurely truncating contiguous event intervals.
* **Expected Invariant:** The synthesized event interval must span the full 10 frames across block boundaries.

### Case 4: Isolated Single-Frame Events
* **Construction:** A contact or hydrogen bond that is `TRUE` for exactly one frame $k$ and `FALSE` for all $k-1$ and $k+1$.
* **Target Vulnerability:** Temporal interval compressors assuming minimum event lifespans.
* **Expected Invariant:** The event must be detected with duration $\Delta t$.

### Case 5: Zero-Length Displacement Vector ($\mathbf{x}_i = \mathbf{x}_j$)
* **Construction:** Two distinct atom selections assigned identical Cartesian coordinates in synthetic frames.
* **Target Vulnerability:** Division by zero in vector normalization or angle calculations:
  $$\frac{\mathbf{v}}{\|\mathbf{v}\|_2} \to \frac{\mathbf{0}}{0} \implies \text{NaN}$$
* **Expected Invariant:** Distance evaluates to $0.0\ \text{Å}$; angle calculations abort gracefully or return a defined boundary code without crashing.

### Case 6: Exactly Collinear Hydrogen Bond ($\theta = 180.000^\circ$)
* **Construction:** Donor, Hydrogen, and Acceptor coordinates placed along a straight line in 3D space ($\mathbf{x}_D - \mathbf{x}_H = -c(\mathbf{x}_A - \mathbf{x}_H)$).
* **Target Vulnerability:** Cross product degeneracy or floating-point domain errors in $\arccos(\operatorname{clip}(\cos \theta, -1.0, 1.0))$.
* **Expected Invariant:** Evaluates to $180.0^\circ$ exactly; passes the angular cutoff $\theta \ge 120^\circ$.

### Case 7: Missing Atom Selection
* **Construction:** Topology includes atom record, but trajectory contains fewer atom coordinate records per frame.
* **Target Vulnerability:** Out-of-bounds coordinate indexing or silent truncation.
* **Expected Invariant:** Raises fatal `MOCSDataIntegrityError` or `ERROR` status immediately.

### Case 8: Empty Selection String
* **Construction:** User query submits selection `resname UNK`, which matches 0 atoms in the system topology.
* **Target Vulnerability:** Null pointer or empty array slice passed to AABB builder.
* **Expected Invariant:** Emits `ERROR` status with descriptive message before starting I/O.

### Case 9: Rapid Periodic Re-entry (Multi-crossing per block)
* **Construction:** A fast-moving solvent or ion that crosses the periodic boundary 4 times back and forth within a single 50-frame block.
* **Target Vulnerability:** Guarded conservative PBC bounding algorithm assumption of at most one boundary transition per block.
* **Expected Invariant:** Detected by velocity check; forces `UNSUPPORTED_GEOMETRY` or exact frame evaluation for that block.

### Case 10: Near-Nyquist Event Oscillation
* **Construction:** Predicate alternates every single frame: `[TRUE, FALSE, TRUE, FALSE, ...]`.
* **Target Vulnerability:** Event aggregator stack overflow or unbounded interval creation.
* **Expected Invariant:** Emits $N/2$ individual 1-frame intervals without memory exhaustion.

---

## 3. Randomized Coordinate Transformations

To test geometric rotational and translational invariance, `mocs-fuzz` wraps existing benchmark trajectories in randomized mathematical transformations:

```python
def apply_fuzz_transformations(coords: np.ndarray, box: np.ndarray) -> np.ndarray:
    """
    Applies rigid transformation + bounded noise to coordinates.
    All pairwise distances under minimum-image must remain invariant.
    """
    # 1. Random 3D Translation
    shift = np.random.uniform(0, box, size=(1, 3))
    transformed = (coords + shift) % box

    # 2. Random Orthogonal Rotation Matrix (preserving periodic cell alignment)
    # Note: For orthorhombic PBC, only 90-degree axis permutations preserve diagonal box
    axes_perm = np.random.permutation([0, 1, 2])
    transformed = transformed[:, axes_perm]

    # 3. Bounded Coordinate Jitter (below tolerance epsilon)
    noise = np.random.normal(0.0, 1e-5, size=transformed.shape)
    transformed += noise

    return transformed
```

---

## 4. Block-Size Sweep Equivalence Invariant

A fundamental correctness property of MOCS-Cert is that **the final certified truth value of a query must be invariant to the chosen index block size $b$**:

$$\operatorname{truth\_value}(Q, T \mid b=10) \equiv \operatorname{truth\_value}(Q, T \mid b=100) \equiv \operatorname{truth\_value}(Q, T \mid b=500)$$

While the number of refined blocks, bytes inspected, and execution latency will vary, the logical output (`TRUE` vs. `FALSE`) must never diverge across block sizes upon complete resolution. Any divergence between runs on identical data with different block sizes indicates a defective bound evaluator.

---

## 5. CI Execution Requirements

1. **Adversarial Regression Test:** The 10 synthetic boundary cases must execute on every GitHub Actions PR with a $100\%$ pass threshold.
2. **Execution Timeout:** The fuzzing harness must complete within $120\ \text{seconds}$ on standard CI runners.
3. **Artifact Logging:** If any differential discrepancy is detected, the fuzz harness automatically serializes the exact failing frame coordinates, box dimensions, query parameters, and random seed to `tests/failures/<seed>.json` for instantaneous local reproduction.
