# PAPER_BLUEPRINT.md — MOCS-Cert Primary Research Paper Blueprint

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Target Venue:** ACM Transactions on Computer Systems (TOCS) / VLDB / Supercomputing (SC) / Bioinformatics  
**Working Title:** *Molecular Observability Contracts for Certified Query Execution over Molecular Dynamics Trajectories*  
**Cross-References:** [`RESEARCH_PLAN.md`](RESEARCH_PLAN.md), [`PRIOR_ART_AND_NOVELTY.md`](PRIOR_ART_AND_NOVELTY.md), [`MOBENCH_SPEC.md`](MOBENCH_SPEC.md), [`RESEARCH_FIGURES.md`](RESEARCH_FIGURES.md).

---

## Section-by-Section Paper Architecture

---

### Section 1: Introduction

* **Main Claim:** Modern molecular dynamics analysis is crippled by an "imperative scanning bottleneck": scientific workflows scan multi-gigabyte coordinate streams forward from coordinates, without declaring observability contracts that would permit compiler-driven pruning and multi-query intermediate reuse.
* **Core Argument:** Exploratory analysis involves running hundreds of related queries over the same simulation. Compiling declarative observable questions into certified execution plans can prune the vast majority of coordinate reading while maintaining mathematically sound deductive guarantees.
* **Evidence Needed:**
  * Empirical growth curves showing MD trajectory size outpacing single-node I/O bandwidth.
  * Workload characterization showing high query overlap in drug screening and allosteric analysis.
* **Figures / Tables:** Figure 1 (The Imperative vs. Contract-Driven Trajectory Query Paradigm).
* **Potential Reviewer Objections & Rebuttals:**
  * *Objection:* "Why not just use MDAnalysis or MDTraj?"  
    *Rebuttal:* MDAnalysis and MDTraj are imperative coordinate libraries; they lack declarative contracts, spatial pruning envelopes, and multi-query dependency planning. MOCS uses MDAnalysis as its underlying decoder while providing an optimizing compiler layer.
  * *Objection:* "Why not just compress trajectories with MDCompress?"  
    *Rebuttal:* MDCompress optimizes coordinate compression; MOCS optimizes query execution. They are orthogonal and complementary.

---

### Section 2: Formal Problem Formulation

* **Main Claim:** Molecular trajectory querying can be formalized as an optimal plan selection problem over a decoupled domain of 3-valued logical truth ($\mathbb{T} = \{\text{TRUE}, \text{FALSE}, \text{UNKNOWN}\}$) and execution resolution status ($\mathbb{R} = \{\text{COMPLETE}, \text{NEEDS\_REFINEMENT}, \text{UNRESOLVABLE\_SAMPLING}, \text{UNSUPPORTED\_GEOMETRY}, \text{UNSUPPORTED\_SEMANTICS}, \text{ERROR}\}$), where sound incomplete certification is preferred over unsound binary approximation.
* **Core Argument:** Formally define trajectory $T$, topology $\Phi$, the Observability Contract $\mathcal{C} = (Q, \epsilon, \tau, \text{policy})$, and the cost objective $J(P)$. Differentiate computational certainty from physical/experimental truth.
* **Evidence Needed:** Formal mathematical definitions matching [`FORMAL_SEMANTICS.md`](FORMAL_SEMANTICS.md).
* **Figures / Tables:** Table 1 (Decoupled Logical Truth and Execution Resolution States).
* **Potential Reviewer Objections & Rebuttals:**
  * *Objection:* "Isn't three-valued logic standard? Why introduce UNRESOLVABLE_SAMPLING?"  
    *Rebuttal:* Conflating insufficient indexing evidence (`UNKNOWN`) with trajectory sampling insufficiency (`UNRESOLVABLE_SAMPLING`) obscures whether re-scanning or finer simulation data is required.

---

### Section 3: Observability Contracts and Operator Semantics

* **Main Claim:** Biophysical questions (`DISTANCE`, `CONTACT`, `HBOND`, `FOR`, `BEFORE`) can be represented as pure, typed declarative contracts with explicit mathematical domains, minimum-image periodicity, and numerical error bounds.
* **Core Argument:** Demonstrating how minimum-image convention on orthorhombic cells interacts with discrete temporal event intervals.
* **Evidence Needed:** Formal YAML contract listings; Baker-Hubbard hydrogen bond definitions.
* **Figures / Tables:** Figure 2 (Two-Stage Hydrogen Bond Evaluation Architecture).
* **Potential Reviewer Objections & Rebuttals:**
  * *Objection:* "What about continuous-time events between frames?"  
    *Rebuttal:* We explicitly prove why continuous interpolation without a validated physical model produces fictitious contacts, justifying our strict sampled-frame semantics.

---

### Section 4: The Molecular Certificate Index (MCI) and Bounding Envelopes

* **Main Claim:** Lazy, selection-specific AABB motion summaries provide conservative Euclidean distance bounds $[L, U]$ that achieve $> 60\%$ block pruning on folded proteins with $< 0.1\%$ storage overhead `[HYPOTHESIS]`.
* **Core Argument:** Full mathematical derivation and soundness proof of Minkowski interval separation bounds under orthorhombic periodic boundary wrapping.
* **Evidence Needed:**
  * Analytic proof of Enclosure and Monotonicity theorems (from [`MATHEMATICAL_MODEL.md`](MATHEMATICAL_MODEL.md)).
  * Synthetic and empirical validation of periodic patch unwrapping.
* **Figures / Tables:**
  * Figure 3 (AABB Geometric Bounding and Periodic Patch Decomposition).
  * Table 2 (On-Disk Binary Layout of Level 0 and Level 1 Index Structs).
* **Potential Reviewer Objections & Rebuttals:**
  * *Objection:* "AABBs are too loose for flexible macromolecules; why not use OBBs or bounding spheres?"  
    *Rebuttal:* We provide comparative empirical data demonstrating that AABBs achieve tighter bounds than bounding spheres for anisotropic thermal motion while requiring significantly lower storage than OBBs.

---

### Section 5: Query Compilation, DAGs, and Cost-Based Planning

* **Main Claim:** Declarative trajectory queries can be parsed into an Observable Dependency DAG that exposes Common Subexpressions across multi-query workloads, allowing a cost planner to dynamically choose optimal execution plans.
* **Core Argument:** The compiler lowers queries through AST $\to$ Logical IR $\to$ DAG $\to$ Physical Plan. Plan selection evaluates the calibrated objective $J(P) = \alpha C_{\text{IO}} + \beta C_{\text{CPU}} + \dots$.
* **Evidence Needed:** AST and DAG lowering examples; calibration protocol for hardware weights.
* **Figures / Tables:** Figure 4 (Observable Dependency DAG with Shared Distance Primitive).
* **Potential Reviewer Objections & Rebuttals:**
  * *Objection:* "Query compilation adds unnecessary CPU latency for simple scripts."  
    *Rebuttal:* We measure compilation overhead at $< 5\ \text{ms}$, which is negligible compared to the seconds or minutes required to stream multi-gigabyte trajectory files.

---

### Section 6: Certified Runtime and Selective Hierarchical Refinement

* **Main Claim:** Dyadic temporal subdivision resolves ambiguous (`UNKNOWN`) blocks by descending through hierarchical levels, guaranteeing monotonic non-increasing interval widths under refinement until threshold certification or single-frame exact reading is reached.
* **Core Argument:** Explaining the selective refinement loop; detailing the standalone, machine-verifiable JSON execution certificate schema bound to content-addressed MCI commitments.
* **Evidence Needed:** Refinement termination proof; schema validation logs.
* **Figures / Tables:** Figure 5 (Hierarchical Dyadic Block Subdivision and Monotonic Non-Expansion).
* **Potential Reviewer Objections & Rebuttals:**
  * *Objection:* "What happens if every block requires refinement?"  
    *Rebuttal:* We prove that in the pathological worst case, execution degenerates gracefully to Plan A (direct scan) with bounded indexing overhead.

---

### Section 7: Empirical Evaluation (MOBench Targets & Hypotheses)

* **Main Claim:** On standard biomolecular workloads, MOCS-Cert targets $4\times\text{--}12\times$ reductions in trajectory coordinate bytes read `[TARGET]`, hypothesizes $3\times\text{--}8\times$ workload speedups over MDAnalysis `[HYPOTHESIS]`, targets break-even within $N_{\text{break-even}} \le 12$ queries on NVMe / $\le 4$ on HDD `[TARGET]`, and mandates zero soundness violations across all test cases `[INVARIANT]`.
* **Core Argument:** Comprehensive empirical validation across the 10 MOBench baselines, spanning soluble proteins, membrane receptors, and protein-ligand complexes.
* **Evidence Needed:** MOBench Phase A and B benchmark result logs with Median and IQR.
* **Figures / Tables:**
  * Figure 6 (Coordinate Read Fraction $R$ vs. Interaction Distance Threshold $\theta$).
  * Figure 7 (Workload Execution Latency vs. Query Count $Q$ showing $N_{\text{break-even}}$).
  * Table 3 (Full 10-Baseline Performance Comparison Table).
* **Potential Reviewer Objections & Rebuttals:**
  * *Objection:* "Did you warm the OS cache to game the I/O timings?"  
    *Rebuttal:* We present separate, explicitly labeled cold-cache and warm-cache benchmark matrices, with cold caches enforced via `--cache-mode cold`.
  * *Objection:* "An upfront HDF5 or Parquet distance matrix is faster for repeated queries."  
    *Rebuttal:* We show that for exploratory screening over 100 candidate residues, precomputing all pairwise distances requires hours of upfront I/O and hundreds of gigabytes, whereas MOCS lazily indexes only requested selections.

---

### Section 8: Related Work

* **Main Claim:** MOCS-Cert occupies a distinct proposed architectural intersection between molecular analysis libraries, scientific trajectory databases, and formal temporal logic systems.
* **Core Argument:** Structured comparison against Dynameomics/MDX, MDAnalysis, MDTraj, MDCompress, KATE, SZ/ZFP, and Kinetic Data Structures.
* **Evidence Needed:** Literature citations and 4-point comparison table.
* **Figures / Tables:** Table 4 (Architectural Comparison with Prior Art).
* **Potential Reviewer Objections & Rebuttals:**
  * *Objection:* "This is just applying database indexing to biology."  
    *Rebuttal:* Standard spatial-temporal databases index discrete object trajectories. MOCS derives conservative bounding intervals over 3D periodic continuous configurations specifically to prune expensive floating-point observable derivations under physical minimum-image conventions.

---

### Section 9: Limitations, Threats, and Epistemic Scope

* **Main Claim:** MOCS-Cert is subject to explicit physical, geometric, and sampling boundaries that must be communicated with complete academic transparency.
* **Core Argument:** Explicit documentation of fixed orthorhombic constraints, missing-hydrogen limitations, threshold chatter, and the distinction between data certification and physical biological truth.
* **Evidence Needed:** Threat model summary matching [`THREAT_MODEL.md`](THREAT_MODEL.md) and [`LIMITATIONS.md`](LIMITATIONS.md).
* **Figures / Tables:** Table 5 (Summary of System Boundary Conditions and Failure Modes).

---

### Section 10: Conclusion and Future Directions

* **Summary:** Restate that contract-driven query compilation and certified bounding envelopes transform molecular trajectory analysis from an imperative scanning bottleneck into an optimized, verifiable computational science discipline.
* **Future Work:** Outline the Molecular Transition Representation (MTR), compiled native backends, and institutional archive transition mining.
