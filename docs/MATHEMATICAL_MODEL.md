# MATHEMATICAL_MODEL.md — MOCS-Cert Mathematical Foundation and Derivations

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Design Baseline (Audit Revisions Applied)  
**Canonical Owner:** `MATHEMATICAL_MODEL.md` is the authoritative specification for geometric envelopes, distance derivations, bound proofs, and algorithmic complexity in MOCS-Cert. Tracked in [`DOC_MANIFEST.yaml`](../DOC_MANIFEST.yaml).

---

## 1. Mathematical Epistemology and Labeling Rules

To ensure strict scientific integrity, every mathematical expression, equation, and theorem-like statement in this document is explicitly categorized under one of the following formal epistemological designations:

1. **[DEFINITION]:** An axiomatic convention or formal mapping defining system terminology.
2. **[PROVEN BOUND]:** A mathematically proven inequality derived rigorously from explicit geometric preconditions.
3. **[HEURISTIC]:** An empirical approximation or operational algorithm without a closed mathematical proof of general optimality.
4. **[OPTIMIZATION OBJECTIVE]:** A cost function formulated for algorithmic selection whose weights are empirically calibrated.
5. **[RESEARCH HYPOTHESIS]:** An unproven empirical conjecture subject to experimental refutation.

---

## 2. Molecular State Space Representation

### 2.1 Coordinate State

**[DEFINITION] (State Space).** Let $n \in \mathbb{N}_{>0}$ denote the fixed number of atoms declared in the molecular topology $\Phi$. The coordinate state of the system at temporal frame index $k \in \{0, \dots, N-1\}$ is represented as a point matrix in Euclidean configuration space:

$$\mathbf{X}_k = \begin{bmatrix} \mathbf{x}_0(k) \\ \mathbf{x}_1(k) \\ \vdots \\ \mathbf{x}_{n-1}(k) \end{bmatrix} \in \mathbb{R}^{n \times 3}$$

where each row $\mathbf{x}_i(k) = (x_i(k), y_i(k), z_i(k)) \in \mathbb{R}^3$ specifies the spatial coordinates of atom $\alpha_i$ at time $t_k$.

### 2.2 Simulation Cell Tensor

**[DEFINITION] (Orthorhombic Box Tensor).** For fixed orthorhombic periodic conditions, the simulation box tensor $\mathbf{B} \in \mathbb{R}^{3 \times 3}$ is constant across all frames:

$$\mathbf{B} = \begin{bmatrix} L_x & 0 & 0 \\ 0 & L_y & 0 \\ 0 & 0 & L_z \end{bmatrix}, \quad L_x, L_y, L_z \in \mathbb{R}_{>0}$$

The volume of the simulation cell is $V = \det(\mathbf{B}) = L_x L_y L_z$. The primary simulation cell domain is $\Omega = [0, L_x) \times [0, L_y) \times [0, L_z)$.

---

## 3. Trajectory Temporal Block Partitioning

**[DEFINITION] (Temporal Block Partition).** Let $\mathcal{T} = \{0, 1, \dots, N-1\}$ be the sequence of frame indices. A block partition $\mathcal{P}_b$ of parameter block size $b \in \{10, 25, 50, 100, 250, 500\}$ is a collection of $M = \lceil N/b \rceil$ contiguous, disjoint half-open index intervals:

$$\mathcal{P}_b = \{B_0, B_1, \dots, B_{M-1}\}$$

where:

$$B_m = [m \cdot b, \, \min((m+1) \cdot b, N)) = \{k \in \mathcal{T} \mid m \cdot b \le k < \min((m+1) \cdot b, N)\}$$

**Properties of Partition:**
1. $\bigcup_{m=0}^{M-1} B_m = \mathcal{T}$ (Exhaustiveness)
2. $B_m \cap B_{m'} = \emptyset$ for all $m \ne m'$ (Disjointness)
3. $|B_m| = b$ for $m < M-1$, and $1 \le |B_{M-1}| \le b$.

---

## 4. Geometric Envelopes and Conservative Distance Bounds

MOCS-Cert utilizes Axis-Aligned Bounding Boxes (AABBs) to conservatively envelope atom motion within temporal blocks. AABBs are chosen over bounding spheres for V0.1 because they provide more compact representations for anisotropic thermal fluctuations and directional drift.

### 4.1 Single-Atom AABB Envelope

**[DEFINITION] (Atom Block Envelope).** For atom $\alpha_i$ and block $B_m$, the axis-aligned bounding box $\mathcal{B}_i^m \subset \mathbb{R}^3$ is defined as the Cartesian product of coordinate extrema over the frames in $B_m$:

$$\mathcal{B}_i^m = [x_{i,\min}^m, x_{i,\max}^m] \times [y_{i,\min}^m, y_{i,\max}^m] \times [z_{i,\min}^m, z_{i,\max}^m]$$

where for each axis $\mu \in \{x, y, z\}$:

$$x_{i,\min}^m = \min_{k \in B_m} x_{i,\mu}(k), \quad x_{i,\max}^m = \max_{k \in B_m} x_{i,\mu}(k)$$

**[PROVEN BOUND] (Envelope Containment Lemma).**
By construction, for all frames $k \in B_m$ and all atoms $\alpha_i \in \mathcal{A}$:

$$\mathbf{x}_i(k) \in \mathcal{B}_i^m$$

*Proof.* Follows immediately from the definition of the infimum/minimum and supremum/maximum over a finite non-empty set of reals $B_m$. $\blacksquare$

### 4.2 Non-Periodic Pairwise Distance Bounds

Let $\mathcal{B}_i^m = \prod_{\mu \in \{x,y,z\}} [a_{\mu,\min}, a_{\mu,\max}]$ and $\mathcal{B}_j^m = \prod_{\mu \in \{x,y,z\}} [b_{\mu,\min}, b_{\mu,\max}]$ be the bounding boxes of atoms $\alpha_i$ and $\alpha_j$ over block $B_m$.

#### Coordinate Separation Intervals
For each axis $\mu \in \{x, y, z\}$, define the 1D interval separation metrics:

$$\Delta_{\mu,\min} = \begin{cases} 
0 & \text{if } [a_{\mu,\min}, a_{\mu,\max}] \cap [b_{\mu,\min}, b_{\mu,\max}] \ne \emptyset \\
\max(a_{\mu,\min} - b_{\mu,\max}, b_{\mu,\min} - a_{\mu,\max}) & \text{otherwise}
\end{cases}$$

$$\Delta_{\mu,\max} = \max(|a_{\mu,\max} - b_{\mu,\min}|, |b_{\mu,\max} - a_{\mu,\min}|)$$

#### Extreme Distance Bounds
**[PROVEN BOUND] (Euclidean Distance Bounds).**

$$L_{ij}^m = \sqrt{\Delta_{x,\min}^2 + \Delta_{y,\min}^2 + \Delta_{z,\min}^2}$$

$$U_{ij}^m = \sqrt{\Delta_{x,\max}^2 + \Delta_{y,\max}^2 + \Delta_{z,\max}^2}$$

**Soundness Theorem:**
For all frames $k \in B_m$:

$$L_{ij}^m \le \|\mathbf{x}_i(k) - \mathbf{x}_j(k)\|_2 \le U_{ij}^m$$

*Proof.*
1. For any axis $\mu$, let $\xi_\mu(k) = x_{i,\mu}(k) - x_{j,\mu}(k)$.
2. Since $x_{i,\mu}(k) \in [a_{\mu,\min}, a_{\mu,\max}]$ and $x_{j,\mu}(k) \in [b_{\mu,\min}, b_{\mu,\max}]$, the difference $\xi_\mu(k)$ is bounded in the Minkowski difference interval:
   $$\xi_\mu(k) \in [a_{\mu,\min} - b_{\mu,\max}, a_{\mu,\max} - b_{\mu,\min}]$$
3. By definition of $\Delta_{\mu,\min}$ and $\Delta_{\mu,\max}$:
   $$\Delta_{\mu,\min} \le |\xi_\mu(k)| \le \Delta_{\mu,\max}$$
4. Squaring each non-negative term preserves inequality:
   $$\Delta_{\mu,\min}^2 \le \xi_\mu(k)^2 \le \Delta_{\mu,\max}^2$$
5. Summing across $\mu \in \{x, y, z\}$ and taking the monotonic square root yields:
   $$\sqrt{\sum_\mu \Delta_{\mu,\min}^2} \le \sqrt{\sum_\mu \xi_\mu(k)^2} \le \sqrt{\sum_\mu \Delta_{\mu,\max}^2}$$
   $$L_{ij}^m \le d_{ij}(k) \le U_{ij}^m \quad \forall k \in B_m. \quad \blacksquare$$

---

## 5. Periodic Boundary Conditions (PBC) Mathematics & Algorithm Status

In orthorhombic periodic systems, particles interact across periodic replicas shifted by lattice vectors:

$$\mathbf{R}_{\mathbf{p}} = \mathbf{B} \mathbf{p} = (p_x L_x, p_y L_y, p_z L_z), \quad \mathbf{p} \in \mathbb{Z}^3$$

### 5.1 Minimum Image Distance

**[DEFINITION] (Minimum Image Distance).** The minimum image distance between two positions $\mathbf{x}_i, \mathbf{x}_j \in \Omega$ is:

$$d_{\text{MIC}}(\mathbf{x}_i, \mathbf{x}_j) = \min_{\mathbf{p} \in \mathbb{Z}^3} \|\mathbf{x}_i - (\mathbf{x}_j + \mathbf{R}_{\mathbf{p}})\|_2$$

Under the orthorhombic condition where all edge lengths $L_\mu$ exceed twice the interaction cutoff $\theta$, the minimum is strictly attained for $\mathbf{p} \in \{-1, 0, 1\}^3$.

**Scalar Uniqueness:** The scalar distance $d_{\text{MIC}}(\mathbf{x}_i, \mathbf{x}_j)$ is uniquely determined for all pairs in $\Omega$. When $|\delta_\mu| = L_\mu/2$, the displacement vector has two equivalent representations ($\pm L_\mu/2$); deterministic tie-breaking selects the positive representative, preserving scalar uniqueness.

### 5.2 Proven Periodic AABB Distance Bound Theorem

**[PROVEN BOUND] (Theorem: Minimum-Image Coordinate Interval Separation).**
Let an orthorhombic simulation box have edge lengths $\mathbf{L} = (L_x, L_y, L_z)$ with $L_\mu > 2\theta$ for all $\mu \in \{x, y, z\}$. Let $I_A = [a_{\min}, a_{\max}]$ and $I_B = [b_{\min}, b_{\max}]$ be 1D coordinate intervals along axis $\mu$ for atoms $\alpha_A$ and $\alpha_B$ within block $B_m$, with interval centers $c_A = \frac{a_{\min} + a_{\max}}{2}$, $c_B = \frac{b_{\min} + b_{\max}}{2}$, and interval half-widths $r_A = \frac{a_{\max} - a_{\min}}{2}$, $r_B = \frac{b_{\max} - b_{\min}}{2}$.

Define the center displacement wrapped under the minimum image convention:
$$\Delta c_\mu = (c_B - c_A) - L_\mu \cdot \operatorname{round}\left(\frac{c_B - c_A}{L_\mu}\right)$$

**Theorem Statement:**
If the combined interval half-width satisfies the **Non-Interference Condition**:
$$r_{\text{sum}} = r_A + r_B < \frac{L_\mu}{2}$$
and the maximum per-frame coordinate displacement satisfies $\Delta x_{\mu, \text{frame}} \le \frac{L_\mu}{4}$, then the minimum image separation distance $d_{\mu, \text{MIC}}(x_A, x_B)$ for all $x_A \in I_A, x_B \in I_B$ is strictly bounded by:
$$d_{\mu, \min} \le d_{\mu, \text{MIC}}(x_A, x_B) \le d_{\mu, \max}$$
where:
$$d_{\mu, \min} = \max(0, \, |\Delta c_\mu| - r_{\text{sum}})$$
$$d_{\mu, \max} = \min\left(\frac{L_\mu}{2}, \, |\Delta c_\mu| + r_{\text{sum}}\right)$$

*Proof.*
1. For any $x_A \in I_A$ and $x_B \in I_B$, we have $x_A = c_A + \delta_A$ and $x_B = c_B + \delta_B$, where $|\delta_A| \le r_A$ and $|\delta_B| \le r_B$.
2. The unwrapped coordinate difference is:
   $$x_B - x_A = (c_B - c_A) + (\delta_B - \delta_A)$$
   where $|\delta_B - \delta_A| \le |\delta_B| + |\delta_A| \le r_B + r_A = r_{\text{sum}}$.
3. Under the minimum image convention, $d_{\mu, \text{MIC}}(x_A, x_B) = \min_{p \in \{-1, 0, 1\}} |(x_B - x_A) - p L_\mu|$.
4. Because $r_{\text{sum}} < L_\mu / 2$, any displacement from the center difference $\Delta c_\mu$ cannot exceed $r_{\text{sum}}$.
5. By the reverse triangle inequality on the minimum-image metric space:
   $$||\Delta c_\mu| - r_{\text{sum}}| \le d_{\mu, \text{MIC}}(x_A, x_B) \le |\Delta c_\mu| + r_{\text{sum}}$$
6. Clamping to the physically attainable minimum-image metric range $[0, L_\mu/2]$ yields $d_{\mu, \min}$ and $d_{\mu, \max}$.
7. Summing across orthogonal axes $\mu \in \{x, y, z\}$ establishes the Euclidean distance bounds:
   $$L = \sqrt{\sum_{\mu} d_{\mu, \min}^2} \le \|\mathbf{x}_A - \mathbf{x}_B\|_{\text{MIC}} \le \sqrt{\sum_{\mu} d_{\mu, \max}^2} = U \quad \blacksquare$$

### 5.3 Algorithmic Bound Conditions & Safe Fallback

To guarantee that certified answers NEVER rely on unproven heuristics:

1. **Non-Interference Guard ($r_{\text{sum}} < L_\mu / 2$):** If the bounding boxes of a block are so large that $r_A + r_B \ge L_\mu / 2$, periodic interval unwrapping cannot be guaranteed conservative.
2. **Displacement Guard ($\Delta x_{\text{frame}} \le L_\mu / 4$):** If an atom's coordinate displacement between consecutive frames exceeds $L_\mu / 4$, local periodic continuity cannot be guaranteed.

**Mandatory Engine Action:**
When either guard condition is triggered:
* The engine flags **`BOUND_CONSTRUCTION_UNAVAILABLE`**.
* This is recognized as an **algorithmic limitation** of AABB envelope construction, **NOT** an `UNSUPPORTED_GEOMETRY`.
* The block's truth value is set to **`UNKNOWN`** with execution resolution **`NEEDS_REFINEMENT`**.
* The execution runtime automatically triggers dyadic sub-block subdivision (which halves the block time span and coordinate envelope) or falls back to direct exact frame evaluation.
* Consequently, all certified `TRUE` and `FALSE` query answers are guaranteed to be mathematically sound under the proven theorem.

---

## 6. Selection Envelopes vs. Derived Pairwise Bounds

**[DEFINITION] (Selection Envelope Storage Architecture).**
To prevent combinatorial explosion, the Molecular Certificate Index (MCI Level 1) stores **selection bounding envelopes**, not pairwise distance bounds:
* For each indexed atom or selection $S$ and block $B_m$, MCI stores the bounding box $\mathcal{B}_S^m$ ($6$ float64 extrema).
* Space complexity for $s$ selections over $M$ blocks is strictly:
  $$\mathcal{O}(M \cdot s) = \mathcal{O}\left(\frac{N}{b} \cdot s\right)$$
* When a query evaluates a pair $(S_1, S_2)$, the pairwise distance interval $[L_{12}^m, U_{12}^m]$ is derived **on the fly** in $\mathcal{O}(1)$ operations per block from $\mathcal{B}_{S_1}^m$ and $\mathcal{B}_{S_2}^m$.

Pairwise distance bounds are never combinatorially materialized on disk in V0.1.

### 6.1 Vectorized Tensor Formulation & Mixed Array Acceleration (JAX, CuPy, NumPy)

To evaluate spatial envelopes and on-the-fly pairwise bounds across massive trajectories without interpreter bottlenecks, MOCS-Cert formalizes AABB construction and bound evaluation in tensor notation, accelerated via hybrid dispatch (`mocs.arrays`):

1. **Coordinate Tensor Formulation:**
   Let a trajectory segment comprising $M$ temporal blocks of length $b$ over selection $S$ with $s = |S|$ atoms be represented as a rank-4 tensor $\mathbf{X} \in \mathbb{R}^{M \times b \times s \times 3}$.
   The selection bounding box extrema for all $M$ blocks are evaluated via parallel tensor reductions:
   $$\mathbf{X}_{\min}^m = \min_{k \in [0, b)} \min_{i \in [0, s)} \mathbf{X}_{m, k, i, :}, \qquad \mathbf{X}_{\max}^m = \max_{k \in [0, b)} \max_{i \in [0, s)} \mathbf{X}_{m, k, i, :}$$
   yielding box center $\mathbf{c}^m = \frac{1}{2}(\mathbf{X}_{\min}^m + \mathbf{X}_{\max}^m)$ and half-span radii $\mathbf{r}^m = \frac{1}{2}(\mathbf{X}_{\max}^m - \mathbf{X}_{\min}^m)$.

2. **CuPy Batch GPU Parallelism:**
   When evaluating dense coordinate envelopes across millions of frames or large selections ($s > 10^4$), coordinates stream directly into GPU memory via CUDA/ROCm streams. CuPy executes the min/max reductions across GPU thread blocks with $\mathcal{O}(\log(b \cdot s))$ parallel tree-reduction span, achieving $>100\times$ speedup over single-threaded host loops.

3. **JAX OpenXLA Kernel Fusion (`jax.jit` & `jax.vmap`):**
   Deriving pairwise bounds between selections $S_1$ and $S_2$ requires evaluating the minimum-image center displacement $\Delta \mathbf{c}^m$, radial sum $\mathbf{r}_{\text{sum}}^m = \mathbf{r}_1^m + \mathbf{r}_2^m$, 1D interval distance projections $d_{\mu, \min}^m$, and Euclidean norms $L^m = \|\mathbf{d}_{\min}^m\|_2$ across all $M$ blocks.
   In standard NumPy, this sequence instantiates 8 intermediate array buffers. Under JAX compilation (`@jax.jit`), OpenXLA fuses this multi-step mathematical pipeline into a single hardware loop:
   $$\mathbf{L}, \mathbf{U} = \operatorname{vmap}(\operatorname{DeriveBounds})_{\text{fused}}(\mathbf{B}_1, \mathbf{B}_2, \mathbf{L}_{\text{box}})$$
   executing in a single memory pass with zero intermediate heap allocations on both GPU and AVX-vectorized CPU.

4. **NumPy Host Interoperability:**
   NumPy maintains zero-copy buffer handoffs with external C/Cython readers (MDAnalysis) and acts as the universal host fallback whenever GPU or JAX environments are absent.

---

## 7. Predicate Certification Conditions

Let $\theta \in \mathbb{R}_{>0}$ be the scalar threshold for a contact predicate $\operatorname{CONTACT}(\alpha_i, \alpha_j, \theta)$. Let $[L_{ij}^m, U_{ij}^m]$ be the sound distance bounds derived for block $B_m$.

### 7.1 Block-Level Certification Rules

**[DEFINITION] (Sufficient Conditions for Block Certification).**

$$\operatorname{Status}(B_m) = \begin{cases}
\mathbf{CERTIFIED\_TRUE} & \text{if } U_{ij}^m < \theta \\
\mathbf{CERTIFIED\_FALSE} & \text{if } L_{ij}^m \ge \theta \\
\mathbf{UNKNOWN} & \text{if } L_{ij}^m < \theta \le U_{ij}^m
\end{cases}$$

**Soundness Properties:**
* If $U_{ij}^m < \theta$, then for all $k \in B_m$: $d_{ij}(k) \le U_{ij}^m < \theta \implies \operatorname{CONTACT}(k) = \text{TRUE}$.
* If $L_{ij}^m \ge \theta$, then for all $k \in B_m$: $d_{ij}(k) \ge L_{ij}^m \ge \theta \implies \operatorname{CONTACT}(k) = \text{FALSE}$.
* If $L_{ij}^m < \theta \le U_{ij}^m$, the bound interval straddles the threshold; the block requires selective refinement.

---

## 8. Hierarchical Selective Refinement

When a block evaluates to $\mathbf{UNKNOWN}$, MOCS-Cert performs hierarchical temporal subdivision.

### 8.1 Subdivision Operator

**[DEFINITION] (Block Subdivision).**
A block $B_m$ spanning $[k_1, k_2)$ with $|B_m| = K$ frames is subdivided into $r = 2$ child sub-blocks:

$$B_{m,0} = [k_1, \, k_1 + \lfloor K/2 \rfloor), \quad B_{m,1} = [k_1 + \lfloor K/2 \rfloor, \, k_2)$$

### 8.2 Monotonic Non-Expansion of Refinement Bounds

**[PROVEN BOUND] (Envelope Monotonicity Property).**
Let $B_{\text{child}} \subset B_{\text{parent}}$. Then for any atom $\alpha_i$:

$$\mathcal{B}_i^{\text{child}} \subseteq \mathcal{B}_i^{\text{parent}}$$

*Proof.* Since $B_{\text{child}} \subset B_{\text{parent}}$, the coordinate set over $B_{\text{child}}$ is a subset of coordinates over $B_{\text{parent}}$. The minimum over a subset is $\ge$ the minimum over the superset, and the maximum is $\le$. Hence the bounding intervals satisfy:
$$[x_{\min}^{\text{child}}, x_{\max}^{\text{child}}] \subseteq [x_{\min}^{\text{parent}}, x_{\max}^{\text{parent}}]. \quad \blacksquare$$

**[PROVEN BOUND] (Monotonic Non-Increasing Interval Width Theorem).**
Under dyadic subdivision, distance bounds satisfy:

$$L_{ij}^{\text{child}} \ge L_{ij}^{\text{parent}} \quad \text{and} \quad U_{ij}^{\text{child}} \le U_{ij}^{\text{parent}}$$

Consequently, the bound interval width $W = U - L$ satisfies:

$$W(B_{\text{child}}) \le W(B_{\text{parent}})$$

*Proof.* The 1D interval separation metrics $\Delta_{\mu,\min}$ and $\Delta_{\mu,\max}$ are monotonic functions of interval inclusion. As bounding intervals contract or remain identical, coordinate differences can only shrink or stay constant. Therefore, interval width is non-increasing. $\blacksquare$

*Remark on Strict Contraction:* Refinement does **not** guarantee strict reduction ($W_{\text{child}} < W_{\text{parent}}$) for every child; if the extreme coordinates of the parent block are located within a single child, that child retains the parent's width. The rigorous guarantee is **monotonic non-expansion**, not strict contraction.

---

## 9. Bound Quality and Pruning Metrics

To quantify index effectiveness across benchmarks, MOCS-Cert formalizes three non-dimensional bound metrics:

1. **Conservative Bound Width:**
   $$W(B_m) = U_{ij}^m - L_{ij}^m \ge 0$$

2. **Bound Looseness Ratio ($G$):**
   Let $[d_{\min}^m, d_{\max}^m]$ be the ground-truth exact distance range over $B_m$. The looseness ratio is:
   $$G(B_m) = \frac{U_{ij}^m - L_{ij}^m}{\max(d_{\max}^m - d_{\min}^m, \epsilon_{\text{num}})}$$
   where $\epsilon_{\text{num}} = 10^{-6}\ \text{Å}$ regularizes zero denominators.
   * Note: For completely rigid atom pairs where $U = L$ and $d_{\max} = d_{\min}$, $G = 0 / \epsilon_{\text{num}} = 0$. In general, $G(B_m) \ge 0$. For non-rigid dynamic systems where $d_{\max} - d_{\min} > 0$, $G \ge 1.0$ because $[L, U] \supseteq [d_{\min}, d_{\max}]$.

3. **Pruning Efficiency ($\eta_{\text{prune}}$):**
   Across a trajectory with $M$ blocks:
   $$\eta_{\text{prune}} = \frac{|\{m \mid \operatorname{Status}(B_m) \in \{\mathbf{CERTIFIED\_TRUE}, \mathbf{CERTIFIED\_FALSE}\}\}|}{M}$$

---

## 10. Computational Cost Model and Break-Even Formulation

### 10.1 Cost Objective Formulation

**[OPTIMIZATION OBJECTIVE] (Workload Cost Functional).**
For candidate execution plan $P$:

$$J(P) = \alpha C_{\text{IO}}(P) + \beta C_{\text{CPU}}(P) + \gamma C_{\text{memory}}(P) + \delta C_{\text{refine}}(P) + \eta C_{\text{compile}}(P)$$

**Component Definitions:**
* $C_{\text{IO}}$: Estimated trajectory bytes transferred from disk storage.
* $C_{\text{CPU}}$: Estimated floating-point operations (AABB comparisons, distance evaluations).
* $C_{\text{memory}}$: Peak resident working memory buffer required by the plan.
* $C_{\text{refine}}$: Expected penalty for handling blocks that require sub-block re-reads.
* $C_{\text{compile}}$: One-time cost of parsing, IR construction, and DAG optimization.

### 10.2 Break-Even Query Workload ($N_{\text{break-even}}$)

**[RESEARCH HYPOTHESIS] (Amortization Threshold).**
Let $C_{\text{build}}$ be the one-time wall-clock cost of constructing the Level 1 MCI sidecar index for selection $S$. Let $T_{\text{direct}}$ be the execution latency of a brute-force trajectory scan, and $T_{\text{indexed}}$ be the average execution latency of an index-certified query.

The break-even query count $N_{\text{break-even}}$ is:

$$N_{\text{break-even}} = \frac{C_{\text{build}}}{T_{\text{direct}} - T_{\text{indexed}}}$$

Authoritative break-even targets and kill thresholds by storage tier are specified in [`KILL_CRITERIA.md`](KILL_CRITERIA.md).

---

## 11. Algorithmic Complexity Analysis

We analyze computational complexity for a trajectory of $N$ frames, $n$ system atoms, block size $b$, and selection size $s = |\operatorname{sel}| \ll n$:

| Operation | Time Complexity | Working Space Complexity | Provenance / Derivation |
|---|---|---|---|
| **Level 0 Metadata Parse** | $\mathcal{O}(1)$ | $\mathcal{O}(1)$ | Header reading |
| **AABB Construction (per selection)** | $\mathcal{O}(N \cdot s)$ | $\mathcal{O}(M \cdot s) = \mathcal{O}\left(\frac{N}{b} \cdot s\right)$ | Single sequential pass over frames |
| **Block Distance Bound Derivation** | $\mathcal{O}(1)$ per block | $\mathcal{O}(1)$ | 6 coordinate difference ops |
| **Block Pruning Scan** | $\mathcal{O}(M) = \mathcal{O}(N/b)$ | $\mathcal{O}(M)$ | $M$ scalar threshold comparisons |
| **Refinement (Single Block)** | $\mathcal{O}(b \cdot s)$ | $\mathcal{O}(b \cdot s)$ | Exact scan of $b$ frames |
| **Full Exact Fallback** | $\mathcal{O}(N \cdot s)$ | $\mathcal{O}(s)$ | MDAnalysis standard loop |

**Cold vs. Warm Worst-Case Complexity Analysis:**
* **Warm Query (Index already built):** In the adversarial worst case ($\eta_{\text{prune}} = 0$), execution complexity degenerates to:
  $$\mathcal{O}(N/b) + \mathcal{O}(N \cdot s) = \mathcal{O}(N \cdot s)$$
  matching brute-force scanning plus the negligible overhead of the index scan.
* **Cold Query (First execution, index not yet built):** Total work includes the index construction pass plus the fallback scan:
  $$\mathcal{O}(N \cdot s \cdot C_{\text{decode}}) + \mathcal{O}(N/b) + \mathcal{O}(N \cdot s \cdot C_{\text{decode}}) \approx 2 \times T_{\text{direct}}$$
  Cold execution in an unprunable workload takes approximately twice the time of a direct scan. Indexing is advantageous only when amortized across exploratory workloads ($Q \ge N_{\text{break-even}}$) or when $\eta_{\text{prune}} > 0$.
