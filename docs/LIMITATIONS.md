# LIMITATIONS.md — MOCS-Cert Known Limitations and Boundary Conditions

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Research Baseline  
**Canonical Owner:** `LIMITATIONS.md` is the authoritative specification for all epistemic, physical, sampling, topological, and systems limitations in MOCS-Cert. Tracked in [`DOC_MANIFEST.yaml`](../DOC_MANIFEST.yaml).  
**Cross-References:** [`FORMAL_SEMANTICS.md`](FORMAL_SEMANTICS.md), [`TEMPORAL_SEMANTICS.md`](TEMPORAL_SEMANTICS.md), [`PBC_SEMANTICS.md`](PBC_SEMANTICS.md), [`OBSERVABLE_OPERATOR_SPEC.md`](OBSERVABLE_OPERATOR_SPEC.md), [`KILL_CRITERIA.md`](KILL_CRITERIA.md).

---

## 1. Executive Position

Scientific integrity demands complete transparency regarding what an analytical tool can and cannot accomplish. MOCS-Cert is designed to provide deductive, machine-verifiable execution guarantees over discrete trajectory files. It is **not** a general physics engine, **not** an experimental validator, and **not** an automated discovery oracle.

This document details every known structural, mathematical, and implementation limitation of MOCS-Cert V0.1.

---

## 2. Epistemic and Physical Limitations

### 2.1 Sampled Data Is Not Physical Truth
A `TRUE` result with `COMPLETE` resolution status emitted by MOCS-Cert certifies solely that the binary coordinate values in the declared file satisfy the mathematical predicate under the specified contract. It does **not** assert:
* That the simulated molecule physically folded or bound in nature.
* That the conformational state observed corresponds to an experimentally populated free-energy minimum.
* That the numerical integrator reproduced realistic physical dynamics rather than numerical integration drift.

### 2.2 Force-Field and Integration Uncertainty
MOCS-Cert possesses zero knowledge of:
* The force field potential function (e.g. AMBER, CHARMM, OPLS, MARTINI) used to generate the trajectory.
* Force-field parameterization errors, cutoff artifacts, or electrostatic truncation schemes (PME).
* Thermostat or barostat velocity reassignment shocks.

---

## 3. Temporal and Sampling Limitations

### 3.1 Finite Temporal Resolution and Inter-Frame Blind Spots
Trajectory files record snapshots at discrete intervals $\Delta t$ (typically $10\ \text{ps}$ to $100\ \text{ps}$). Molecular events with sub-picosecond lifetimes (e.g., hydrogen bond flickering, water molecule coordination shifts, transition state crossings) can occur entirely within the unobserved interval $(t_k, t_{k+1})$.
* **Sample-Slot Axiom:** Under discrete sample-slot semantics (`mode: sampled_frames`), each frame $k$ occupies slot $[t_k, t_{k+1})$ of duration $\Delta t$; a duration $\tau \le \Delta t$ requires $\lceil \tau / \Delta t \rceil = 1$ frame (any single verified true frame satisfies the query).
* **Contract Rules:**
  - `sampled_frames`: $\tau \le \Delta t$ is valid and resolvable over discrete frame slots.
  - `continuous_physical`: requests for continuous sub-frame persistence ($\tau < \Delta t$) are rejected with `truth: UNKNOWN, resolution: UNSUPPORTED_SEMANTICS`.
  - missing / irregular / corrupt timestamps: return `truth: UNKNOWN, resolution: UNRESOLVABLE_SAMPLING`.

### 3.2 Discrete Ordering and Continuous Interpolation
Under half-open discrete interval semantics $E = [k_s, k_e)$, if event $A$ ends at frame index $k_{e, A}$ and event $B$ starts at $k_{s, B}$, discrete precedence requires $k_{e, A} \le k_{s, B}$. However, in continuous physical time between frames, discrete sampled frames cannot prove the continuous ordering of unobserved barrier crossings. Such sub-frame continuous inferences are explicitly unsupported in V0.1.

---

## 4. Chemical, Structural, and Topological Limitations

### 4.1 Missing Explicit Hydrogens
The $\operatorname{HBOND}$ operator requires explicit coordinates for hydrogen atoms covalently bound to donors.
* **Limitation:** Trajectories generated under united-atom force fields (e.g. GROMOS) or stripped trajectories where hydrogens were removed to save disk space **cannot** be queried for hydrogen bonds.
* **Policy:** MOCS-Cert refuses to guess hydrogen coordinates (no geometric patching or geometric placement in V0.1). Queries on missing-hydrogen trajectories abort with an explicit `ERROR`.

### 4.2 Static Topology Invariance
All V0.1 indexing mechanisms assume an immutable covalent bond graph $\mathcal{E}$ and constant atom identity mapping.
* **Unsupported:** Chemical reactions, protonation/deprotonation state transitions, bond cleavage, variable atom counts (grand canonical ensembles), and reactive force fields (ReaxFF).

### 4.3 Topology Metadata Trust Boundary
MOCS-Cert verifies the internal consistency of the topology file (valid indices, non-empty atom sets), but does not validate chemical correctness. If a user provides an incorrect PDB topology file with misidentified residue numbers or reversed stereocenters, MOCS-Cert will soundly certify the wrong scientific question.

---

## 5. Periodic Boundary and Geometric Limitations

### 5.1 General Periodic-Cell Geometry (RESOLVED in PASS 46)
* **Status:** **RESOLVED in PASS 46** via the canonical `PeriodicCell` engine.
* **Supported Geometries:**
  * Fixed orthorhombic simulation boxes ($\alpha = \beta = \gamma = 90^\circ$, fast-path $O(1)$ evaluation).
  * Skewed and general static triclinic simulation boxes (rhombic dodecahedra, truncated octahedra, monoclinic) with nearest lattice vector 27-neighborhood candidate search.
  * Variable-cell / fluctuating volume trajectories (NPT): evaluated soundly via exact per-frame unit cell matrices $H(k)$ without unvalidated spatial over-pruning.
* **Fail-Closed Boundary Protections:**
  * Degenerate / collinear basis vectors ($\det(H) \le 0$), non-finite coordinates, zero/negative lengths, or near-singular cells ($\kappa(H) > 10^6$) are strictly rejected fail-closed with `MOCSUnsupportedGeometryError`.
  * Explicitly requesting `orthorhombic_minimum_image` on a triclinic trajectory fails closed immediately with `MOCSUnsupportedGeometryError`.

### 5.2 Patch Decomposition Singularities
The guarded conservative PBC bounding algorithm assumes an atom crosses at most one periodic cell boundary within a single temporal block. Highly turbulent solvent atoms with unphysically large velocities (e.g., in un-equilibrated systems or integration blowups) crossing multiple boundaries in $< 100$ frames cannot be bounded soundly and trigger fallback to exact frame reading.

### 5.3 Bounding Volume Anisotropy & Rotation Explosion (RESOLVED IN PASS 47 VIA 14-DOP)
* **Status:** **RESOLVED in PASS 47** via Canonical 14-Discrete Oriented Polytope (`KDOP14`) bounding geometry.
* **Problem:** Cartesian AABBs suffer from severe volume explosion when enclosing elongated anisotropic structures (e.g., $\alpha$-helices, elongated rods) oriented diagonally relative to the frame coordinate axes, causing bounding volume to expand by up to $\approx \frac{L}{\sqrt{2} r}$ and diluting pruning efficiency.
* **Resolution:** Introduced canonical 14-DOP geometry with 7 normalized direction vectors ($u_1, u_2, u_3$ Cartesian axes + 4 cube space diagonals).
* **Empirical Measurements (`benchmark_aabb_vs_kdop.py`):**
  * Measured volume reduction of **79.92%** on elongated rods rotated 45° in the $xy$-plane.
  * Measured volume reduction of **79.29%** on rods oriented along the 3D space diagonal.
  * Measured volume reduction of **62.45%** on rods rotated at 30° and 60°.
  * 100% epistemic truth parity with baseline AABB.
  * Strict mathematical soundness guaranteed: $L \le d_{\min} \le d_{\max} \le U$ verified across all periodic geometries.

---

## 6. Mathematical and Bound Limitations

### 6.1 Threshold Boundary Chatter and Instability
For queries where the distance threshold $\theta$ lies directly within the standard deviation of an atom pair's thermal fluctuation ($d_{ij}(k) \approx \theta$):
* Bounding envelopes $[L, U]$ will straddle $\theta$ ($L < \theta \le U$) across almost every block.
* The index will fail to prune these blocks, returning `UNKNOWN` and triggering deep hierarchical refinement.
* Users investigating interactions near their equilibrium separation will observe higher refinement fractions and lower speedups.

### 6.2 Nonlinear Observable Over-Approximation
AABB bounding envelopes provide tight bounds for Euclidean distance. However, for nonlinear observables:
* **Backbone Torsion Dihedrals ($\phi, \psi$):** AABB bounding yields angular intervals spanning $[0^\circ, 360^\circ]$ for moderate motions.
* **RMSD / Radius of Gyration / Pocket Volumes:** Nonlinear algebraic couplings create severe interval overestimation (wrapping explosion).
* **V0.1 Status:** Angular bounding is designated as an `UNVALIDATED / OPEN QUESTION`. HBOND uses distance-only pruning in V0.1.

---

## 7. Systems and Computational Limitations

### 7.1 Non-Trivial Index Build Cost
Constructing Level 1 MCI motion summaries requires streaming the entire trajectory once from disk. For a $100\ \text{GB}$ trajectory on a spinning hard drive ($150\ \text{MB/s}$), index construction requires $\approx 11\ \text{minutes}$.
* **Limitation:** For one-off, single-query workloads ($Q=1$), running MOCS-Cert in indexed mode is strictly slower than running an immediate brute-force scan.
* **Requirement:** Compilation provides net savings only when amortized across exploratory multi-query sessions ($Q \ge N_{\text{break-even}}$).

### 7.2 Cache Invalidation Vulnerability
Because MOCS sidecars are stored as detached files in `trajectory.mocs/`, replacing or modifying the source `.xtc` file without updating the sidecar renders all index records invalid. While SHA-256 verification catches this, rebuilding the index wipes out all cached intermediate results.

### 7.3 Unknown Result Frequency
The frequency of `UNKNOWN` return states is fundamentally workload-dependent. In floppy, highly flexible protein systems (such as intrinsically disordered proteins), AABB envelopes can widen to $15\ \text{Å}$, forcing $> 90\%$ of blocks to be resolved via exact frame refinement.
