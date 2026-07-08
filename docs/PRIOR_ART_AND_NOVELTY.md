# PRIOR_ART_AND_NOVELTY.md — MOCS-Cert Prior Art Literature Map and Novelty Framing

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Research Baseline  
**Canonical Owner:** `PRIOR_ART_AND_NOVELTY.md` is the authoritative literature map, prior art baseline, and novelty ceiling for MOCS-Cert. Tracked in [`DOC_MANIFEST.yaml`](../DOC_MANIFEST.yaml).  
**Cross-References:** [`PROBLEM_STATEMENT.md`](PROBLEM_STATEMENT.md), [`LIMITATIONS.md`](LIMITATIONS.md), [`PAPER_BLUEPRINT.md`](PAPER_BLUEPRINT.md), [`KILL_CRITERIA.md`](KILL_CRITERIA.md).

---

## 1. The Ceiling of Novelty Claims

This document establishes the **absolute ceiling for novelty and priority claims** across the entire MOCS-Cert repository and future publications. 

### 1.1 Strict Linguistic Prohibitions
To ensure the highest standard of academic honesty, the following promotional words and phrases are **strictly prohibited** across all MOCS-Cert documents, commit messages, and paper drafts unless accompanied by independent, third-party citation verification:
* `"first-ever"`
* `"unprecedented"`
* `"revolutionary"`
* `"unique"`
* `"no existing system can do this"`
* `"solves molecular dynamics"`
* `"paradigm shift"`

### 1.2 The Defensible Core Contribution

The defensible scientific and systems contribution of MOCS-Cert is framed strictly as:

> **The integration of contract-driven molecular observable execution, explicit operator dependency compilation, lazy/query-driven certificate indexing, conservative block-level predicate certification, three-valued execution with an explicit unresolvable state, selective source refinement, and adaptive multi-query reuse over existing molecular dynamics trajectory files.**

MOCS-Cert did **not** invent any of these components in isolation. Its contribution lies entirely in the formal synthesis, mathematical bounding, and systems engineering applied to exploratory molecular trajectory querying.

---

## 2. Systematic Literature Map

Below, MOCS-Cert is systematically benchmarked against 14 related computational biology, database, and systems domains using the mandatory 4-point evaluation structure.

---

### 2.1 Dynameomics and the MDX Query Language (Beck et al., 2008; van der Kamp et al., 2010)

* **What it does:** Dynameomics constructed massive relational and multidimensional databases storing pre-analyzed molecular dynamics simulations. It introduced **MDX**, a structured query language allowing users to query conformational transitions, secondary structure occupancy, and cavity volumes across thousands of protein simulations.
* **What MOCS shares:** Both systems recognize that researchers ask high-level structural and temporal questions rather than raw coordinate questions. Both seek to provide query-driven access to MD trajectories.
* **What MOCS does differently:** Dynameomics relied on heavy, centralized relational databases requiring complete upfront data ingestion and precomputation. MOCS-Cert operates as a **lightweight, decentralized sidecar index** directly over standard, unmodified trajectory files (`.xtc`, `.dcd`) on a local workstation, computing conservative bounds on-the-fly and refining only unresolved blocks.
* **What MOCS must NOT claim:**
  * Must NOT claim to be the "first molecular query system" or "first molecular query language".
  * Must NOT claim that trajectory querying is a novel problem formulation.

---

### 2.2 MDAnalysis (Michaud-Agrawal et al., 2011; Gowers et al., 2016)

* **What it does:** The premier Python library for molecular dynamics analysis. Provides flexible coordinate readers, powerful atom selection engines, spatial analysis algorithms, and time-series extraction over virtually all known simulation formats.
* **What MOCS shares:** MOCS-Cert builds directly upon MDAnalysis, utilizing its format decoders and topology parsers. MDAnalysis functions serve as the ground-truth oracle in `mocs-reference`.
* **What MOCS does differently:** MDAnalysis is an imperative, frame-by-frame traversal library. It possesses no query compiler, no spatial bounding envelopes, and no mechanism to skip coordinate reading based on predicate thresholds. MOCS-Cert provides a declarative compiler layer on top of trajectory streams.
* **What MOCS must NOT claim:**
  * Must NOT claim to replace MDAnalysis.
  * Must NOT claim superior general trajectory analysis capabilities.
  * Must NOT claim to be faster than MDAnalysis for a single unindexed scan.

---

### 2.3 MDTraj (McGibbon et al., 2015)

* **What it does:** An extremely fast trajectory analysis engine heavily optimized with C, Cython, SSE/AVX vector intrinsics, and CUDA kernels. Focuses on high-throughput calculation of pairwise distances, contacts, dihedrals, and hydrogen bonds.
* **What MOCS shares:** Both focus on maximizing the computational efficiency of molecular observable evaluation.
* **What MOCS does differently:** MDTraj optimizes the *inner loop* of coordinate math (computing pairwise distances faster). MOCS-Cert optimizes the *execution plan* (pruning entire blocks so that coordinate math is never invoked).
* **What MOCS must NOT claim:**
  * Must NOT claim that MOCS has faster raw coordinate math kernels than MDTraj.
  * Must NOT claim that MOCS invented fast contact or distance algorithms.

---

### 2.4 Trajectory Databases and Data Warehouses (BioSimDB, TrajStore)

* **What it does:** Centralized scientific data warehouses that ingest simulation frames into relational, document, or array databases (e.g. TileDB, SciDB), indexing spatial coordinates with R-trees or octrees.
* **What MOCS shares:** Utilizing spatial bounding boxes to accelerate spatial range queries.
* **What MOCS does differently:** Trajectory databases require users to convert their multi-gigabyte trajectories into custom database formats or upload them to centralized clusters. MOCS-Cert leaves existing `.xtc`/`.dcd` files 100% untouched, creating disposable, rebuildable `.mocs` sidecars.
* **What MOCS must NOT claim:**
  * Must NOT claim that indexing molecular trajectories is novel.

---

### 2.5 Modern Random-Access Trajectory Compression: MDCompress (2026)

* **What it does:** Provides high-ratio lossy/lossless trajectory compression with native random-access chunking, allowing users to decompress specific frame ranges without sequential streaming from frame 0.
* **What MOCS shares:** Both recognize that reading every byte of a 100 GB trajectory is the primary computational bottleneck.
* **What MOCS does differently:** MDCompress is a **storage format** operating at the coordinate level. MOCS-Cert is a **query compiler** operating at the observable/predicate level. MOCS and MDCompress are complementary: MOCS can use MDCompress as a high-performance random-access I/O backend.
* **What MOCS must NOT claim:**
  * Must NOT claim to be a compression algorithm or trajectory container format.
  * Must NOT claim to compress trajectory coordinates better than MDCompress.

---

### 2.6 Kinetics-Preserving Compression: KATE

* **What it does:** Trajectory compression that explicitly bounds errors on dynamical and kinetic quantities of interest (e.g., transition path distributions, Markov state model rates) rather than minimizing uniform geometric RMSE.
* **What MOCS shares:** Deep concern for the preservation of kinetic and temporal validity during data reduction.
* **What MOCS does differently:** KATE modifies or approximates coordinates to achieve smaller file sizes. MOCS-Cert never modifies source coordinates; it builds an out-of-core bounding certificate over the exact original data.
* **What MOCS must NOT claim:**
  * Must NOT claim to invent kinetic-preserving trajectory reductions.

---

### 2.7 Scientific Quantity-of-Interest (QoI) Preserving Compression (SZ, ZFP)

* **What it does:** Advanced floating-point lossy compressors used in climate, astrophysics, and fluid dynamics that guarantee point-wise error bounds ($\epsilon$) or preserve derived quantities like vorticity or energy conservation.
* **What MOCS shares:** The concept of an explicit user-declared tolerance contract $\epsilon$.
* **What MOCS does differently:** Error-bounded compressors compress the field and decompress an approximation. MOCS-Cert certifies discrete logical predicates (`TRUE`/`FALSE`) over the original data.
* **What MOCS must NOT claim:**
  * Must NOT claim priority over error-bounded scientific reduction.

---

### 2.8 Progressive Scientific Retrieval and Spatial Indexing (R-Trees, Octrees, BVH)

* **What it does:** Hierarchical spatial bounding structures (Bounding Volume Hierarchies, R-Trees) used in computer graphics, GIS, and computational chemistry to progressively render or query spatial scenes from coarse to fine resolution.
* **What MOCS shares:** Hierarchical tree decomposition (Level 0 $\to$ Level 1 $\to$ Level 2) and Minkowski interval distance bounds.
* **What MOCS does differently:** Spatial databases index spatial entities across space. MOCS-Cert indexes **temporal blocks across time** for specific spatial selections under periodic minimum-image conventions.
* **What MOCS must NOT claim:**
  * Must NOT claim to invent bounding volume hierarchies, AABB trees, or progressive retrieval.

---

### 2.9 Temporal Logic and Interval Databases (Allen's Interval Algebra, LTL, STL)

* **What it does:** Mathematical formalisms for reasoning about time intervals (Allen, 1983) and monitoring temporal predicates over continuous-time signals (Linear/Signal Temporal Logic). Used in cyber-physical systems and formal verification.
* **What MOCS shares:** Temporal operators (`BEFORE`, `AFTER`, `FOLLOWED_BY`, `WITHIN`) map directly to Allen's interval relations and STL duration formulas.
* **What MOCS does differently:** Applies temporal logic specifically to sampled molecular coordinate blocks, incorporating the explicit epistemic state `UNRESOLVABLE_SAMPLING` when sampling intervals $\Delta t$ prevent sound verification.
* **What MOCS must NOT claim:**
  * Must NOT claim to invent temporal logic, interval arithmetic, or three-valued logic.

---

### 2.10 Kinetic Data Structures (KDS) (Basch, Guibas, Hershberger, 1999)

* **What it does:** A theoretical computer science framework for maintaining geometric attributes (convex hulls, Delaunay triangulations, closest pairs) of moving points whose trajectories are continuous, explicit mathematical functions of time $x(t)$. Maintains "certificates" that trigger combinatorial updates upon failure.
* **What MOCS shares:** The concept of geometric certificates that assert the validity of a spatial predicate.
* **What MOCS does differently:** Classical KDS assumes continuous, predictable motion polynomials. Molecular dynamics produces noisy, discrete, non-differentiable stochastic coordinates. MOCS-Cert operates over discrete sampled blocks using conservative data bounds rather than motion polynomial roots.
* **What MOCS must NOT claim:**
  * Must NOT claim that MOCS-Cert implements classical Kinetic Data Structures.

---

### 2.11 Scientific Query Compilers (Weld, ArrayQL, SciDB)

* **What it does:** Systems that compile declarative tensor and array queries into optimized execution plans, performing loop fusion, operator pushdown, and SIMD code generation.
* **What MOCS shares:** Abstract Syntax Tree lowering, Logical IR, and Cost-Based Planning.
* **What MOCS does differently:** MOCS-Cert is domain-specialized for molecular topology, periodic minimum-image distances, and biophysical observability contracts.
* **What MOCS must NOT claim:**
  * Must NOT claim to invent query compilation or cost-based plan optimization.

---

### 2.12 Materialized-View Selection in Relational Databases

* **What it does:** Algorithms in database management systems (DBMS) that observe workload history and automatically materialize expensive joins or intermediate aggregates to accelerate future queries.
* **What MOCS shares:** Adaptive materialization of reusable intermediate observables in the sidecar `cache/`.
* **What MOCS does differently:** Specializes view selection to biophysical observable dependency DAGs (e.g. caching pairwise distance intervals to feed contact and hydrogen bond queries).
* **What MOCS must NOT claim:**
  * Must NOT claim novelty for adaptive materialization or multi-query workload optimization as general computer science paradigms.

---

### 2.13 Genomic Interval Query Systems (BEDTools, TileDB-Bio)

* **What it does:** Highly optimized interval engines that compute overlaps, intersections, and windows across millions of genomic feature intervals on 1D chromosome coordinates.
* **What MOCS shares:** Discrete interval intersection and fast temporal windowing algorithms.
* **What MOCS does differently:** Operates in 4D space-time (3D molecular coordinates under periodic boundaries $\times$ 1D discrete time), deriving intervals dynamically from 3D coordinate bounding envelopes.
* **What MOCS must NOT claim:**
  * Must NOT claim to invent interval intersection algorithms.

---

### 2.14 Three-Valued Logic and Epistemic Systems (Kleene, Łukasiewicz, Belnap)

* **What it does:** Multi-valued logical systems that extend classical Boolean logic with truth values representing unknown, undefined, or indeterminate states.
* **What MOCS shares:** Returning `UNKNOWN` when bounds straddle a threshold, and applying Kleene strong three-valued conjunctions ($\text{TRUE} \land \text{UNKNOWN} = \text{UNKNOWN}$; $\text{FALSE} \land \text{UNKNOWN} = \text{FALSE}$).
* **What MOCS does differently:** Introduces the dedicated domain-specific epistemic status `UNRESOLVABLE_SAMPLING` to explicitly differentiate between incomplete indexing evidence vs. inherent source trajectory sampling insufficiency.
* **What MOCS must NOT claim:**
  * Must NOT claim to invent three-valued logic.
