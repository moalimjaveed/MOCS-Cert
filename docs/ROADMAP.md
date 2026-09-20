# ROADMAP.md — MOCS-Cert Development and Research Roadmap

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Research Baseline  
**Canonical Owner:** `ROADMAP.md` is the authoritative public timeline, milestone breakdown, and research governance plan for MOCS-Cert. Tracked in [`DOC_MANIFEST.yaml`](../DOC_MANIFEST.yaml).  
**Cross-References:** [`PROJECT_SCOPE.md`](PROJECT_SCOPE.md), [`RESEARCH_PLAN.md`](RESEARCH_PLAN.md), [`KILL_CRITERIA.md`](KILL_CRITERIA.md), [`PAPER_BLUEPRINT.md`](PAPER_BLUEPRINT.md).

---

## 1. Roadmap Architecture and Governance

This roadmap defines the staged engineering milestones and research directions for MOCS-Cert. 

### 1.1 Research Governance Policy
* **Falsification-Driven Promotion:** A milestone does not advance to the next phase merely because time has elapsed. Each milestone is gated by explicit experimental verification in [`RESEARCH_PLAN.md`](RESEARCH_PLAN.md) and adherence to [`KILL_CRITERIA.md`](KILL_CRITERIA.md).
* **No Speculative Release Dates:** Because scientific computing research involves fundamental empirical risks (e.g. bound tightness over dynamic proteins), calendar dates are provided only for near-term software engineering sprints. Difficult research phases are sequenced without calendar guarantees.

```
┌────────────────────────────────────────────────────────────────────────┐
│ NOW: V0.1 (Research Prototype Baseline — PASS 46 & 47 Complete)        │
│ • Core primitives: DISTANCE, CONTACT, HBOND (staged)                  │
│ • Temporal logic: FOR, BEFORE, AFTER, FOLLOWED_BY, WITHIN             │
│ • Engine: Level 1 MCI, AABB & KDOP14 bounds, dyadic refinement        │
│ • General Periodic Cells: Orthorhombic, Triclinic, NPT (PASS 46)       │
│ • Sound 14-DOP Bounding: Eliminates AABB rotation explosion (PASS 47)  │
├────────────────────────────────────────────────────────────────────────┤
│ NEXT: V0.2 (Compiler Infrastructure & Workload Optimization)           │
│ • Full Observable Dependency DAG with Common Subexpression Elimination │
│ • Calibrated cost-based query planner (J(P))                           │
│ • Surface language prototype (MolQL-Cert frontend)                     │
│ • MOBench Phase B (200-500 trajectories) full baseline showdown        │
├────────────────────────────────────────────────────────────────────────┤
│ LATER: V1.0 (Production-Grade Open Source Ecosystem)                   │
│ • Adaptive observable materialization across interactive sessions      │
│ • Compiled Rust / SIMD acceleration for bounding kernels               │
│ • Deep integration with MDAnalysis and GROMACS ecosystem               │
├────────────────────────────────────────────────────────────────────────┤
│ RESEARCH: Advanced Formulations (Conditional on V1.0 Success)          │
│ • Molecular Transition Representation (MTR) structured event streams   │
│ • [COMPLETED IN PASS 47] 14-DOP geometric bounds (Limitation 2)        │
│ • [COMPLETED IN PASS 46] Non-orthogonal (triclinic) periodic cells     │
├────────────────────────────────────────────────────────────────────────┤
│ LONG-TERM: Cross-Trajectory Transition Mining & Biophysical Discovery │
│ • Large-scale institutional archive event mining across 10,000+ runs   │
│ • Discovery of recurring transition motifs across unrelated proteins   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase Breakdown

### 2.1 NOW: Version 0.1 (Research Baseline / Active Development)

* **Objective:** Establish a sound, functional proof-of-concept demonstrating that conservative spatial bounds can prune coordinate reads on real trajectories without introducing any unsound certified results.
* **Core Capabilities:**
  * Observable Operators: $\operatorname{DISTANCE}$, $\operatorname{CONTACT}$, $\operatorname{HBOND}$ (staged donor-acceptor distance filtering + exact angle scans).
  * Temporal Operators: $\operatorname{FOR}$, $\operatorname{BEFORE}$, $\operatorname{AFTER}$, $\operatorname{FOLLOWED\_BY}$, $\operatorname{WITHIN}$ (half-open event intervals $[k_s, k_e)$).
  * Epistemic Result Logic: Strict implementation of the 3-valued truth domain ($\{\text{TRUE}, \text{FALSE}, \text{UNKNOWN}\}$) decoupled from execution resolution status ($\{\text{COMPLETE}, \text{NEEDS\_REFINEMENT}, \text{UNRESOLVABLE\_SAMPLING}, \text{UNSUPPORTED\_GEOMETRY}, \text{ERROR}\}$).
  * Indexing: Level 0 global manifest and seek table (`frame_offsets.bin`); Level 1 lazy binary AABB motion records.
  * Runtime: Hierarchical dyadic block refinement down to exact frame leaves.
  * Quality Assurance: Authoritative reference oracle (`mocs-reference`), adversarial fuzzing (`mocs-fuzz`), standalone certificate verifier (`mocs verify`).
* **Explicit V0.1 Exclusions:** No distributed cluster backends, no machine learning optimizers, no triclinic PBC, no variable simulation cells, no custom trajectory binary formats.

---

### 2.2 NEXT: Version 0.2 (Compiler Infrastructure & Workload Optimization)

* **Objective:** Evolve from individual query pruning to true multi-query workload optimization.
* **Target Features:**
  * **Observable Dependency DAG:** Complete compiler subsystem performing Common Subexpression Elimination across multi-query batches.
  * **Calibrated Cost Planner:** Implementation of the empirical $J(P)$ objective function, dynamically choosing between Plan A (Direct Scan), Plan B (Indexed Pruning), Plan C (Cache), and Plan D (Hierarchical Refinement).
  * **MolQL-Cert Surface Language:** Parser and type checker for declarative query scripts.
  * **Threshold Hysteresis Bands:** Optional transition bands ($[\theta - \epsilon, \theta + \epsilon]$) to stabilize contact evaluations in flexible loop regions.
  * **MOBench Phase B:** Comprehensive 10-baseline performance evaluation across 200–500 trajectories.

---

### 2.3 LATER: Version 1.0 (Production-Grade Open Source Ecosystem)

* **Objective:** Deliver a hardened, highly usable software platform ready for widespread adoption by computational biophysicists and pharmaceutical researchers.
* **Target Features:**
  * **Adaptive Materialization:** Runtime monitoring of query patterns to automatically materialize and persist intermediate observables in the sidecar `cache/`.
  * **Compiled Native Core:** Porting performance-critical bounding and seek loops to Rust via PyO3, maintaining strict bit-level semantic equivalence.
  * **MDAnalysis First-Class Integration:** Direct plugin bindings allowing researchers to invoke MOCS compilation directly from `MDAnalysis.Universe` instances.
  * **Extended Trajectory Support:** Hardened format readers for AMBER (`.nc`, `.netcdf`) and CHARMM/NAMD (`.dcd`).

---

### 2.4 RESEARCH: Advanced Formulations (Year 2–3)

* **Molecular Transition Representation (MTR):**
  * Researching whether continuous coordinate changes between frames can be transformed into discrete, structured transition events (e.g., `RigidMove`, `TorsionFlip`, `ContactFormation`).
* **Tighter Geometric Bounding Volumes:**
  * **[COMPLETED IN PASS 47]** Canonical 14-Discrete Oriented Polytope (14-DOP) bounding geometry implemented, validated against clean-room oracle, and proven to reduce bounding volume explosion by up to 79.92% on rotated elongated geometries while strictly preserving conservative distance lower bounds.
* **Triclinic Periodic Boundary Handling:**
  * **[COMPLETED IN PASS 46]** General non-orthogonal (triclinic) periodic cell support implemented via `PeriodicCell` engine with 27-neighborhood candidate searches and dynamic NPT fail-closed refinement.

---

### 2.5 LONG-TERM: Large-Scale Molecular Event Mining

* **Grand Scientific Question:** *“Do large collections of molecular dynamics trajectories exhibit recurring, low-dimensional transition motifs when queried through observable contracts rather than raw Cartesian coordinates?”*
* **Scope:** Querying institutional repositories (e.g. Folding@home, GPCRdb, D. E. Shaw datasets) containing millions of frames to identify shared unbinding or allosteric activation pathways.
* **Status:** Pure scientific exploration; contingent upon the empirical success of earlier systems phases.
