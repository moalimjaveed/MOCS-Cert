# MOCS-Cert: Formal Problem Statement

> **Document type**: Research problem definition  
> **Status**: V0.1.0 Design Baseline (Audit Revisions Applied)  
> **Canonical Owner**: `PROBLEM_STATEMENT.md` is the authoritative formal research problem definition, bottleneck characterization, and core hypotheses for MOCS-Cert. Tracked in [`DOC_MANIFEST.yaml`](../DOC_MANIFEST.yaml).  
> **Cross-references**: [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) · [FORMAL_SEMANTICS.md](FORMAL_SEMANTICS.md) · [BENCHMARK_SPEC.md](BENCHMARK_SPEC.md) · [KILL_CRITERIA.md](KILL_CRITERIA.md) · [PRIOR_ART_AND_NOVELTY.md](PRIOR_ART_AND_NOVELTY.md)

---

## Table of Contents

1. [The Trajectory Analysis Problem Today](#1-the-trajectory-analysis-problem-today)
2. [Trajectory Scale and the Scanning Bottleneck](#2-trajectory-scale-and-the-scanning-bottleneck)
3. [Repeated Computation in Exploratory Workloads](#3-repeated-computation-in-exploratory-workloads)
4. [Why a Single-Query Benchmark Is Insufficient](#4-why-a-single-query-benchmark-is-insufficient)
5. [The Scientific Use Case](#5-the-scientific-use-case)
6. [The Formal Problem Statement](#6-the-formal-problem-statement)
7. [What MOCS Is Not Primarily](#7-what-mocs-is-not-primarily)
8. [Prior Work Context](#8-prior-work-context)
9. [The Primary Research Hypothesis](#9-the-primary-research-hypothesis)
10. [The Secondary Research Hypothesis](#10-the-secondary-research-hypothesis)

---

## 1. The Trajectory Analysis Problem Today

### 1.1 The Conventional MD Analysis Workflow

Molecular dynamics (MD) simulation produces a time series of atomic coordinate frames. The conventional workflow proceeds as follows:

```
Simulation engine (e.g., GROMACS, NAMD, OpenMM)
        |
        v
  Output trajectory file (XTC / DCD / TRR)
        |
        v
  Analysis library (MDAnalysis, MDTraj)
        |
        v
  Load all frames into memory or stream sequentially
        |
        v
  Compute scalar observable per frame (e.g., distance, RMSD, contact)
        |
        v
  Apply threshold filter (e.g., distance < 3.5 A)
        |
        v
  Identify events, compute statistics, plot results
```

In a representative workflow, a researcher uses GROMACS to simulate a protein-ligand complex, writes an XTC trajectory, loads it into MDAnalysis with a Python script, iterates frame-by-frame to compute the distance between a residue's atom and a ligand atom, and collects the frames where that distance falls below a threshold. A subsequent script may then search for temporal patterns -- "how often does this distance remain below threshold for at least 100 ps?"

### 1.2 What the System Does Not Know

The critical structural problem is this: **at the time a trajectory file is written and at the time an analysis script begins executing, the system has no prior information about which spatial regions of the trajectory are relevant to the query.** The analysis library cannot know, without reading coordinates, that the atom pair of interest spends 80% of simulation time at distances greater than 10 A and therefore those frames contribute nothing to the predicate `distance < 3.5 A`. It scans every frame uniformly.

More precisely: the analysis system does not know the answer to any of the following without reading data:

- **Spatial relevance**: Are the queried atoms ever close enough to satisfy the predicate?
- **Temporal extent**: If so, over which frame intervals?
- **Dependency structure**: Does computing observable `q_2` require data already computed for `q_1`?
- **Refinement necessity**: Which blocks of frames require exact-frame evaluation vs. which can be certified by bounds alone?

This absence of prior query-relevant geometric metadata is the foundational inefficiency that MOCS-Cert is designed to investigate.

---

## 2. Trajectory Scale and the Scanning Bottleneck

### 2.1 Scale of Modern Trajectories

Modern MD simulations routinely produce trajectories in the tens to hundreds of gigabytes. Consider the following representative example:

| Simulation parameter           | Value                                     |
|--------------------------------|-------------------------------------------|
| System                         | Protein-ligand complex, ~50,000 atoms     |
| Simulation length              | 1 us                                      |
| Coordinate output stride       | 10 ps                                     |
| Total frames                   | 100,000                                   |
| Coordinate precision           | 32-bit float, 3 dimensions                |
| Bytes per frame (uncompressed) | 50,000 x 3 x 4 = 600 KB                  |
| Uncompressed total             | ~60 GB                                    |
| XTC compressed total           | ~6-15 GB (compression ratio varies)       |

A 1 us trajectory at 10 ps sampling therefore produces N_frames = 100,000 frames. Even at high compression ratios, the file may be 6 to 15 GB on disk.

### 2.2 The O(N_frames) I/O Cost

Computing a pairwise distance for every frame requires reading, decompressing, and accessing coordinates for every frame. Let:

- N_frames = number of frames in the trajectory
- C_read(f) = I/O cost to read and decompress frame f
- C_compute(f) = CPU cost to compute the observable for frame f

The total cost of a naive scan is:

```
C_naive = sum_{f=1}^{N_frames} [ C_read(f) + C_compute(f) ]
```

This cost is **O(N_frames)** in both I/O and CPU. For a 100,000-frame trajectory with an average frame decompression cost of ~50 us and a distance computation cost of ~1 us per query atom pair, the per-query cost is on the order of seconds to minutes, depending entirely on I/O throughput and decompression speed.

### 2.3 The Bottleneck Is I/O, Not Arithmetic

For simple scalar observables (pairwise distances, contact detection), the arithmetic cost per frame is negligible relative to the cost of reading and decompressing a frame from disk. A pairwise distance computation requires 6 floating-point reads, 3 subtractions, 3 multiplications, 2 additions, and 1 square root -- well under 1 us on modern hardware. Reading and decompressing the full coordinate set for a 50,000-atom frame from a compressed XTC file requires moving several hundred kilobytes of data from disk through the XTC decompressor, which is orders of magnitude more expensive.

This means that **the dominant cost of trajectory analysis for simple observables is I/O throughput and decompression overhead, not floating-point computation.** Any strategy that reduces the number of frames that must be decompressed and read in full has the potential to reduce total wall-clock time by a corresponding factor -- if and only if the cost of the pruning mechanism is lower than the cost of the frames it eliminates.

That "if and only if" is the central empirical question MOCS-Cert is designed to answer.

### 2.4 Scaling Trends

This bottleneck is not improving with hardware in a way that neutralizes it:

- **Storage capacity** has grown faster than I/O bandwidth: trajectories that fit on a single drive cannot be read at full speed in time proportional to their scientific value.
- **CPU speed** increases benefit arithmetic more than I/O: faster CPUs complete decompression faster, but decompression throughput is often I/O-bound, not CPU-bound.
- **Memory-mapped access** does not fundamentally change the O(N_frames) scaling; it shifts the access pattern but does not eliminate the need to touch each frame's coordinate block.

The trajectory analysis problem is therefore a data-movement problem, and its cost scales with the number of frames that must be touched, not with the difficulty of the arithmetic.

---

## 3. Repeated Computation in Exploratory Workloads

### 3.1 The Exploratory Research Pattern

Computational chemists and structural biologists rarely know in advance which molecular interactions are scientifically significant. A representative exploratory workload proceeds as follows:

1. Select a candidate binding pocket and enumerate residues within 10 A of the ligand centroid.
2. For each residue, compute its distance to each polar atom on the ligand across the trajectory.
3. Filter for residue-atom pairs that fall below a contact threshold at least once.
4. Among those pairs, compute contact persistence over time.
5. Among persistent contacts, identify temporal ordering (does contact A consistently precede contact B?).
6. Vary thresholds and time windows to test sensitivity.

At each step, the researcher does not know how many pairs will survive the filter. Steps 2 through 6 are performed iteratively, with each result informing the parameters of the next query.

### 3.2 A Concrete Example of Workload Scale

Consider the following concrete parameter space:

| Parameter                                      | Value                          |
|------------------------------------------------|--------------------------------|
| Candidate residues                             | 1,000                          |
| Ligand heavy atoms                             | 500                            |
| Distance pairs                                 | 1,000 x 500 = **500,000**      |
| Contact thresholds explored                    | 3 (3.5 A, 4.0 A, 4.5 A)       |
| Time-window durations explored                 | 3 (50 ps, 100 ps, 200 ps)      |
| Total distinct query instances                 | 500,000 x 3 x 3 = **4,500,000** |
| Pairs scientifically interesting to researcher | ~200                           |

**In this scenario, a researcher who ultimately cares about approximately 200 distance pairs must, under a naive full-scan strategy, either:**

- **(A) Precompute all 4,500,000 query instances**: This produces a complete result set but requires an enormous amount of computation and storage, most of which is never used.
- **(B) Compute each query independently on demand**: Each of the 200 queries examined triggers an independent full scan of the trajectory. If each scan costs 30 seconds, 200 queries cost 100 minutes -- wasting the shared sub-computation of, e.g., the distance time series for atoms that appear in multiple queries.

### 3.3 The Shared Sub-Computation Problem

Many distance pairs in the above example share atom selections. The distance `d(A:155, LIG:O2)` is a sub-computation shared between:
- The contact query `d(A:155, LIG:O2) < 4.0 A`
- The hydrogen bond query `HBOND(A:155, LIG:O2)` (which requires distance as a component)
- Any temporal query that references either of the above

Under independent query execution, each query re-reads the trajectory to compute this distance from scratch. Under a dependency-aware execution model, the distance time series `d(A:155, LIG:O2)` is computed once and reused across all dependent queries. The economic advantage of reuse grows with the number of queries sharing a sub-expression, the cost of computing that sub-expression, and the cost of storing the intermediate result.

This is the **workload dependency structure**, and it is the second major efficiency lever that MOCS-Cert is designed to exploit.

---

## 4. Why a Single-Query Benchmark Is Insufficient

### 4.1 The Precomputed Table Baseline

For a **single, repeated, precisely specified query** over a trajectory that does not change, the optimal strategy is well understood: precompute the observable once, store the result in a compact indexed table, and answer all future instances of the same query from the table in O(1) or O(log N) time. A precomputed table of distances indexed by frame is the optimal solution for a single repeated query. MOCS-Cert does not aim to outperform this strategy on a single isolated query.

This is an important and explicit scoping constraint. **The research case for MOCS-Cert is not that it beats a perfectly precomputed, cached observable on a single query.** If a researcher has already computed `d(A:155, LIG:O2)` for all frames and stored the result, no subsequent query on that distance pair benefits from MOCS-Cert's pruning mechanisms.

### 4.2 The Workload Economics Problem

The research case for MOCS-Cert is about **workload economics**: the relative cost of three strategies over an exploratory workload where query specifications are not known in advance.

Let W = {q_1, ..., q_K} be the set of queries a researcher actually executes during an analysis session. Let O = {o_1, ..., o_M} be the set of all observable instances that could be precomputed. Typically |W| << |O| in exploratory workloads. Three strategies can be compared:

| Strategy                              | Description                                              | Cost Model                                           |
|---------------------------------------|----------------------------------------------------------|------------------------------------------------------|
| **S1: Indiscriminate Precomputation** | Compute all observables in O before any query            | C(S1) = sum_{o in O} C_compute(o) + C_store(O)      |
| **S2: Independent Per-Query Scan**    | Scan trajectory independently for each query             | C(S2) = sum_{q in W} C_scan(q)                       |
| **S3: Adaptive Materialization**      | Compute on demand; share and cache sub-expressions       | C(S3) = C_plan(W) + C_shared(W) + C_refine(W)       |

The research question is: **for what workload structure and trajectory properties does S3 achieve lower total cost than both S1 and S2?**

This is not a question with a universal answer. It depends on:

- **|W| / |O|**: The fraction of observable space actually queried
- **Dependency structure of W**: How many queries share sub-expressions
- **Selectivity of predicates**: What fraction of frames survive each predicate
- **Trajectory I/O cost**: How expensive full scans are relative to bound computation
- **Sidecar amortization**: Whether the cost of building the MCI is amortized over enough queries

### 4.3 The Necessary Evaluation Design

A benchmark that measures MOCS-Cert on a single query in isolation does not answer this question. The benchmark must measure:

1. Total cost (I/O + CPU + wall time) over a realistic **multi-query workload session**
2. Under varying degrees of workload selectivity (what fraction of precomputed observables are actually examined)
3. Against both S1 and S2 baselines
4. On real trajectories with measured bound tightness

See [BENCHMARK_SPEC.md](BENCHMARK_SPEC.md) for the full experimental design. See [KILL_CRITERIA.md](KILL_CRITERIA.md) for the conditions under which this research direction will be abandoned.

---

## 5. The Scientific Use Case

### 5.1 Temporal Composition of Molecular Observables

The scientific use cases that motivate MOCS-Cert frequently involve **temporal composition** of multiple dependent observables. Consider the following example from drug binding mechanism analysis:

> **Scientific question**: Does residue A:155 form a hydrogen bond with the ligand oxygen O2 for at least 100 ps, and does this hydrogen bond precede the formation of a van der Waals contact between residue A:200 and the ligand?

Expressed as a structured predicate:

```
HBOND(A:155, LIG:O2) FOR >= 100ps  BEFORE  CONTACT(A:200, LIG)
```

This question requires:

1. Computing the hydrogen bond predicate `HBOND(A:155, LIG:O2)` as a time-indexed boolean series
2. Identifying contiguous intervals where that predicate is TRUE with total duration >= 100 ps
3. Computing the contact predicate `CONTACT(A:200, LIG)` as a time-indexed boolean series
4. Identifying intervals where that predicate is TRUE
5. Evaluating the temporal ordering: does any satisfied HBOND interval end before any satisfied CONTACT interval begins?

### 5.2 The Current Tooling Gap

Current analysis tools (MDAnalysis, MDTraj) are capable of computing each of the constituent observables independently. The gap is at the level of **query orchestration**:

- There is no standard mechanism for declaring the temporal composition as a single query and having the system plan its execution.
- There is no mechanism for certifying that the result is sound under the declared numerical and sampling semantics.
- The researcher must manually code the sequencing of all sub-computations.
- If the researcher subsequently varies the hydrogen bond duration threshold, the entire computation must be manually re-executed.
- There is no provenance record of which frames were inspected, what semantics were applied, or what numerical tolerances were assumed.

### 5.3 Compound Queries Amplify the Workload Problem

The temporal composition problem compounds the workload economics problem from Section 3. All three of the following queries share the sub-expression `HBOND(A:155, LIG:O2)`:

- `HBOND(A:155, LIG:O2) FOR >= 100ps  BEFORE  CONTACT(A:200, LIG)`
- `HBOND(A:155, LIG:O2) FOR >= 50ps   WITHIN  200ps  OF  CONTACT(A:200, LIG)`
- `HBOND(A:155, LIG:O2) FOR >= 100ps  BEFORE  CONTACT(A:201, LIG)`

Dependency-aware planning can compute these shared sub-expressions once and reuse their certified intervals across all three queries.

---

## 6. The Formal Problem Statement

### 6.1 Definitions

Before stating the problem formally, we define the key entities. These definitions are developed in full in [FORMAL_SEMANTICS.md](FORMAL_SEMANTICS.md).

**Definition 6.1 (Trajectory).** A molecular dynamics trajectory T is a finite sequence of frames:

```
T = (f_1, f_2, ..., f_N)
```

where each frame f_k = (t_k, X_k, B_k) consists of:
- t_k in R_>=0: the simulation time at frame k (in picoseconds)
- X_k in R^{3 x n_atoms}: the Cartesian coordinate matrix for all n_atoms atoms at frame k
- B_k in R^{3x3}: the periodic boundary condition (PBC) box matrix at frame k

In V0.1, B_k is restricted to orthorhombic boxes (B_k = diag(a, b, c)) with box dimensions fixed across all frames (static box).

**Definition 6.2 (Observable).** A molecular observable o is a function from a frame to a scalar or boolean value, parameterized by atom selection(s) and numerical parameters. V0.1 supports three observable types:

- `DISTANCE(sel_A, sel_B, epsilon_r)`: minimum inter-selection distance under minimum-image PBC, with length tolerance epsilon_r
- `CONTACT(sel_A, sel_B, d_c, epsilon_r)`: boolean predicate, TRUE when `DISTANCE(sel_A, sel_B) < d_c`. Points within $|d - d_c| \le \epsilon_r$ map to `UNKNOWN` with resolution status `NEEDS_REFINEMENT` under the numerical boundary ambiguity policy.
- `HBOND(sel_donor, sel_acceptor, d_c, theta_c, epsilon_r, epsilon_theta)`: boolean predicate under hydrogen bond geometry criteria

**Definition 6.3 (Query).** A query q is a temporal predicate over observables. V0.1 supports temporal operators FOR, BEFORE, AFTER, FOLLOWED_BY, WITHIN.

**Definition 6.4 (Observable Contract).** An observable contract C is a 4-tuple:

```
C = (Q, epsilon, tau, policy)
```

where:
- Q = {q_1, ..., q_n}: the set of queries to be evaluated
- epsilon: numerical tolerance specification (length tolerance epsilon_r, angle tolerance epsilon_theta)
- tau: sampling time tolerance (minimum event duration for UNKNOWN vs. UNRESOLVABLE_SAMPLING classification)
- policy: the certification policy governing when UNKNOWN is permitted vs. when refinement is required

**Definition 6.5 (Execution Plan).** An execution plan P(Q, C, T) is a concrete sequence of computational operations that, when executed, produces answers to all queries in Q under contract C applied to trajectory T.

**Definition 6.6 (Sound Answer).** An answer $a(q_i) = (\text{truth\_value}, \text{resolution\_status})$ is sound under contract $C$ if:
- If $\text{truth\_value} = \text{TRUE}$ and $\text{resolution\_status} = \text{COMPLETE}$, then $q_i$ is provably TRUE for all frame sequences consistent with $T$ under the declared PBC and numerical semantics
- If $\text{truth\_value} = \text{FALSE}$ and $\text{resolution\_status} = \text{COMPLETE}$, then $q_i$ is provably FALSE under the same conditions
- If $\text{truth\_value} = \text{UNKNOWN}$ and $\text{resolution\_status} = \text{NEEDS\_REFINEMENT}$, then current evidence is insufficient to determine the truth value, but no incorrect boolean answer is certified
- If $\text{resolution\_status} = \text{UNRESOLVABLE\_SAMPLING}$, then trajectory timestamps are missing, irregular, or corrupt, preventing sound temporal frame mapping
- If $\text{resolution\_status} = \text{UNSUPPORTED\_GEOMETRY}$, then the geometry of $T$ falls outside supported orthorhombic PBC
- If $\text{resolution\_status} = \text{UNSUPPORTED\_SEMANTICS}$, then the query requests continuous physical persistence or semantics unsupported in V0.1 sampled-frame execution
- If $\text{resolution\_status} = \text{ERROR}$, then a system or contract validation error halted evaluation

**Definition 6.7 (Cost Function).** The cost of an execution plan P is:

```
J(P) = alpha * C_IO(P) + beta * C_CPU(P) + gamma * C_memory(P)
     + delta * C_refinement(P) + eta * C_compile(P)
```

where alpha, beta, gamma, delta, eta are weights calibrated from measurements on the target hardware. The weights are MEASURED quantities, not assumed constants. See [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) for the planner specification.

### 6.2 The Problem Statement

> **Problem Statement (MOCS-Cert V0.1)**
>
> **Given**:
> - A molecular dynamics trajectory T = (f_1, ..., f_N) satisfying the V0.1 geometry constraints
>   (orthorhombic periodic box, static topology)
> - A set of queries Q = {q_1, ..., q_n} expressing predicates over molecular observables from the
>   supported observable set {DISTANCE, CONTACT, HBOND} with temporal operators from
>   {FOR, BEFORE, AFTER, FOLLOWED_BY, WITHIN}
> - A declared observable contract C = (Q, epsilon, tau, policy) specifying the numerical semantics
>   and tolerance policy
>
> **Find**: An execution plan P(Q, C, T) such that:
>
> 1. **Soundness**: For all q_i in Q, the answer a(q_i) produced by P is sound under the declared
>    semantics of C. No TRUE or FALSE answer is returned with COMPLETE status unless it is provably
>    correct. UNKNOWN is returned in preference to an incorrect answer.
>
> 2. **Workload efficiency**: The total cost J(P) over the full workload Q is minimized (or bounded)
>    relative to the baseline strategies of independent full-scan evaluation and indiscriminate
>    precomputation. The planner selects a Pareto-efficient plan considering I/O reduction, CPU
>    sharing, and materialization cost.
>
> 3. **Conservative certification**: When information is insufficient to determine the truth value of
>    a predicate with certainty, the system returns UNKNOWN rather than an approximate or
>    probabilistic answer. The system does not assert confidence intervals or probability distributions
>    over UNKNOWN regions unless a future version explicitly adopts a probabilistic semantics
>    extension.
>
> 4. **Machine-verifiable certificates**: For each q_i, the execution plan P produces a
>    machine-readable certificate recording: the query, the contract semantics, the source trajectory
>    hash, the evidence blocks inspected, the result status, the refinement history, and the
>    MOCS-Cert compiler version. The certificate enables a third party to independently verify the
>    result without re-executing the full plan.

---

## 7. What MOCS Is Not Primarily

### 7.1 Not a Trajectory Compression Project

MOCS-Cert is not primarily a trajectory compression scheme. The Molecular Certificate Index (MCI) sidecar files (`.mocs/`) store geometric metadata and observable summaries, not compressed coordinate data. The source XTC/DCD/TRR trajectory is unchanged by MOCS-Cert. The sidecar is auxiliary; the trajectory is authoritative.

Prior compression work (MDCompress, XTC/XTC2 from GROMACS, KATE) is acknowledged and not duplicated. See [PRIOR_ART_AND_NOVELTY.md](PRIOR_ART_AND_NOVELTY.md).

### 7.2 Not a New Trajectory File Format

MOCS-Cert reads existing trajectory formats via MDAnalysis (XTC, DCD, TRR in V0.1). It does not define a new binary coordinate format. The sidecar contains JSON metadata and binary observable summaries, not a replacement for XTC. A new trajectory format is explicitly out of scope for V0.1.

### 7.3 Not an Experimental Biology Validation System

MOCS-Cert makes no claims about the biological correctness of MD force fields, the physical validity of simulation parameters, or the relationship between computational results and experimental observables. Whether the trajectory faithfully represents the physical system is the responsibility of the simulation setup and force field parameterization, which are outside the scope of this project.

### 7.4 Not a Machine Learning or Statistical Inference System

V0.1 contains no machine learning components. Bound computation is geometric and deterministic. The AABB (axis-aligned bounding box) bounds used in V0.1 are hard geometric bounds derived directly from coordinate data -- they are not statistical models or probability distributions.

### 7.5 Primary Purpose

The initial and primary purpose of MOCS-Cert is:

- **Query execution efficiency**: Reducing the amount of coordinate data that must be read to answer a query, without sacrificing soundness
- **Certified pruning**: Producing machine-verifiable proof that a portion of the trajectory cannot affect the query answer
- **Workload-aware planning**: Exploiting the dependency structure of a query set to share computation across queries

---

## 8. Prior Work Context

MOCS-Cert is not developed in isolation. Distinctions from each system are documented in [PRIOR_ART_AND_NOVELTY.md](PRIOR_ART_AND_NOVELTY.md).

### 8.1 Trajectory Databases

**Dynameomics / MDX** (Van Der Kamp et al.; Kehl et al.): A large-scale trajectory database with database-style query capabilities over pre-stored MD trajectories. MDX enables SQL-like queries over trajectory data with indexed access. MOCS-Cert differs in that it targets analysis of user-produced trajectories via a sidecar model rather than a centralized database system. MOCS-Cert's certification and contract mechanisms are not present in MDX.

### 8.2 Random-Access Compression

**MDCompress**: A block-structured trajectory compression scheme supporting random frame access. MOCS-Cert's Selective Refinement Engine benefits from random frame access, but MDCompress does not provide query semantics, observable contracts, or certified answers.

**KATE (Kinematic Adaptive Trajectory Encoding)**: Adaptive trajectory compression with inter-frame correlation. Similar positioning to MDCompress with respect to MOCS-Cert.

**XTC2 (GROMACS)**: The current production compression format used by GROMACS. MOCS-Cert reads XTC files via MDAnalysis and does not compete with XTC2 as a compression scheme.

### 8.3 Analysis Libraries

**MDAnalysis** (Michaud-Agrawal et al.; Gowers et al.): A Python library for trajectory analysis. MOCS-Cert V0.1 uses MDAnalysis as its trajectory reader and reference implementation backend.

**MDTraj** (McGibbon et al.): A high-performance trajectory analysis library with optimized distance computations. MOCS-Cert may use MDTraj as a backend for exact-frame computation in the Selective Refinement Engine in future versions.

### 8.4 The Gap Under Investigation

The combination of capabilities that MOCS-Cert is designed to investigate is not, to the project's knowledge, present in any of the above systems:

1. **Contract-driven execution**: Queries are declared with explicit numerical and sampling semantics before execution; the system plans and certifies against those declared semantics.
2. **Dependency-aware planning**: The system builds an explicit observable dependency DAG from the query set and shares sub-computations across queries.
3. **Conservative certification**: The system produces formal CERTIFIED_TRUE / CERTIFIED_FALSE / UNKNOWN answers per block, and never asserts certainty beyond what the data supports.
4. **Selective refinement**: UNKNOWN blocks are refined hierarchically rather than scanned uniformly.

The existence of this gap in the literature is an empirical claim made by the project, not a proven theorem. The gap may be narrower than currently assessed.

---

## 9. The Primary Research Hypothesis

The primary research hypothesis of MOCS-Cert, drawn directly from the project blueprint, is:

> **Primary Hypothesis (H1)**:
>
> *"Can a restricted but useful class of molecular trajectory questions be compiled into sound,
> workload-aware execution plans that inspect much less coordinate data than a full scan while
> preserving explicit semantics and reproducibility?"*

### 9.1 Decomposition

**H1a (Pruning effectiveness)**: For a representative set of queries over real MD trajectories, block-level AABB bounds will certify a non-trivial fraction of trajectory blocks as CERTIFIED_FALSE without full-frame coordinate access. The bound tightness experiment directly tests this.

**H1b (Soundness preservation)**: The certified answers produced by MOCS-Cert will agree with the reference answers produced by full-scan MDAnalysis on the same queries and trajectories. The reference differential test directly tests this.

**H1c (Workload economics)**: Over a multi-query workload, the total cost of MOCS-Cert (planning + bound evaluation + selective refinement) will be lower than independent full-scan evaluation for workloads with sufficient shared structure and sufficient predicate selectivity. The MOBench workload benchmark tests this.

All three components must be satisfied for H1 to be considered supported.

### 9.2 Conditions for Falsification

H1 is falsified (triggering kill criteria; see [KILL_CRITERIA.md](KILL_CRITERIA.md)) if:

- AABB bounds are not tight enough to prune a meaningful fraction of blocks on real trajectories (H1a fails)
- The reference differential test reveals soundness errors (H1b fails)
- The MOBench results show no regime where MOCS-Cert beats independent scanning over realistic workloads (H1c fails)

---

## 10. The Secondary Research Hypothesis

> **Secondary Hypothesis (H2)**:
>
> *"Can related molecular questions share intermediate observables and certificates sufficiently well
> that adaptive materialization beats both independent analysis and indiscriminate precomputation on
> exploratory workloads?"*

### 10.1 Decomposition

**H2a (Materialization benefit)**: Storing and reusing intermediate observable results (e.g., a distance time series, a contact event interval list) reduces the marginal cost of subsequent related queries by a measurable factor.

**H2b (Adaptive beats indiscriminate)**: Adaptive materialization -- computing and caching intermediate results on demand as queries arrive -- produces lower total cost than computing all possible observables in advance, for exploratory workloads where the researcher examines only a fraction of the possible query space.

**H2c (Adaptive beats independent)**: Adaptive materialization produces lower total cost than independent per-query scanning, for workloads where the shared dependency structure is rich enough to justify the overhead of dependency analysis and cache management.

### 10.2 Conditions for Falsification

H2 is falsified if:

- Materialization overhead exceeds the reuse benefit for realistic query arrival patterns (H2a fails)
- The fraction of observable space explored in practice is too large for indiscriminate precomputation to be clearly wasteful (H2b fails)
- The shared dependency structure of realistic query sets is too sparse for reuse to benefit independent scanning (H2c fails)

### 10.3 Interaction with H1

H2 is only relevant if H1 is supported. The experimental program therefore tests H1 first and proceeds to H2 only if H1 survives the initial kill tests.

---

*Document version: 1.0 | MOCS-Cert V0.1 scope | Last revised: 2026-09-12*
