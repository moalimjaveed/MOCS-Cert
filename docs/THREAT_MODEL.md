# THREAT_MODEL.md — MOCS-Cert Scientific Computing Threat and Failure Model

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Research Baseline  
**Canonical Owner:** `THREAT_MODEL.md` is the authoritative specification for epistemic, numerical, and systems failure modes in MOCS-Cert. Tracked in [`DOC_MANIFEST.yaml`](../DOC_MANIFEST.yaml).  
**Cross-References:** [`CERTIFICATE_SPEC.md`](CERTIFICATE_SPEC.md), [`DATA_PROVENANCE.md`](DATA_PROVENANCE.md), [`PBC_SEMANTICS.md`](PBC_SEMANTICS.md), [`CORRECTNESS_AND_VALIDATION.md`](CORRECTNESS_AND_VALIDATION.md).

---

## 1. Context and Threat Philosophy

In scientific software engineering, the primary threat is **not** an external network adversary seeking unauthorized access, but rather **epistemic corruption**:
> *Emitting an unsound scientific result that presents false computational certainty, leading researchers to publish erroneous biological conclusions.*

This document provides a comprehensive threat model analyzing structural failure modes across data ingestion, geometric computation, index synchronization, and certificate verification.

```
                           THREAT TAXONOMY
                                  │
      ┌──────────────────┬────────┴─────────┬──────────────────┐
      ▼                  ▼                  ▼                  ▼
[Data Integrity]  [Implementation]     [Semantic]        [Operational]
• Corrupt files   • Math derivation    • False certainty • Stale sidecar
• Hash mismatch   • Numerical drift    • Unit mismatch   • Tampered cert
• Topology drift  • PBC leakage        • Blind spots     • Hardware drift
```

---

## 2. Comprehensive Threat Catalog and Mitigations

Below, all 13 core scientific-computing threats are formally analyzed with detection mechanisms, architectural mitigations, and unmitigated impact assessments.

---

### Threat T-01: Malformed or Truncated Trajectory Files
* **Threat Mechanism:** An `.xtc` or `.dcd` file is truncated due to an aborted simulation run, disk exhaustion, or corrupted frame headers.
* **Failure Mode if Undetected:** Frame reader silently stops early; a query evaluating persistence (`FOR`) marks an event as non-occurring based on missing frames.
* **Detection Mechanism:** Level 0 manifest validation compares declared frame count against actual binary EOF offsets; validates XTC magic numbers and frame indices sequentially.
* **Mitigation:** Strict fail-closed parsing. Any unexpected EOF, non-monotonic timestamp, or header checksum error raises a fatal `MOCSTrajectoryCorruptedError` and aborts compilation with status `ERROR`. No silent best-effort reads.

---

### Threat T-02: Corrupted or Inconsistent Molecular Topology
* **Threat Mechanism:** A user supplies a `.gro` or `.pdb` topology whose atom indices or chemical names do not correspond to the coordinates encoded in the `.xtc` trajectory.
* **Failure Mode if Undetected:** Distance and hydrogen bond observables are evaluated on entirely wrong atoms (e.g. evaluating a ligand contact on a water molecule), producing scientifically catastrophic false claims.
* **Detection Mechanism:** At session initialization, MOCS-Cert verifies that total atom count in topology $\Phi$ matches frame coordinate dimensions ($n_{\text{topo}} \equiv n_{\text{frame}}$). Computes SHA-256 of topology bytes.
* **Mitigation:** The topology hash $H(\Phi)$ is permanently embedded in the Level 0 manifest and all generated certificates. If atom counts diverge or coordinate shapes mismatch, execution halts immediately with `ERROR`.

---

### Threat T-03: Wrong or Ambiguous Atom Selections
* **Threat Mechanism:** User submits an ambiguous selection query (e.g. `resname LIG` in a system containing 4 identical ligand copies, or residue index offset mismatch between 0-indexed and 1-indexed PDBs).
* **Failure Mode if Undetected:** Engine evaluates distance on the first resolved atom, or silently aggregates a multi-atom group into a center-of-geometry without user consent.
* **Detection Mechanism:** Static type checking in the AST lowering pass.
* **Mitigation:** In V0.1 pairwise mode, all atom selectors must resolve to **exactly one unique global atom index**. If a selector matches 0 atoms or $>1$ atom, compilation terminates with `MOCSSelectionResolutionError`. Multi-atom selections require explicit group aggregation syntax (`COM(...)`).

---

### Threat T-04: Periodic Boundary Condition (PBC) Image Leakage
* **Threat Mechanism:** Evaluating coordinates across a periodic face without minimum-image corrections, or assuming non-periodic Cartesian distances in a periodic box.
* **Failure Mode if Undetected:** A contact separated by $0.2\ \text{Å}$ across opposing box faces is computed as $L_x - 0.2\ \text{Å} \approx 75.0\ \text{Å}$, incorrectly certifying `FALSE` (a critical false negative).
* **Detection Mechanism:** Continuous assertion checking in exact and bound evaluators enforcing minimum-image wrapping formulas.
* **Mitigation:** All spatial routines mandate explicit cell tensor inputs. Non-periodic execution requires explicit declaration of `pbc_mode: "none"`.

---

### Threat T-05: Unit and Dimensionality Mismatches
* **Threat Mechanism:** GROMACS trajectories natively store coordinates in nanometers ($\text{nm}$), while PDB files and common biophysical cutoffs are expressed in Ångströms ($\text{Å}$).
* **Failure Mode if Undetected:** A $4.0\ \text{Å}$ contact cutoff is evaluated directly against nanometer coordinates ($4.0\ \text{nm} = 40.0\ \text{Å}$), certifying virtually every atom in the protein as in contact.
* **Detection Mechanism:** Dimensional validation in AST parser.
* **Mitigation:** MOCS-Cert enforces internal canonical units of $\text{Å}$ (length) and $\text{ps}$ (time). Trajectory readers inspect reader format metadata and apply mandatory conversion factors ($1\ \text{nm} = 10\ \text{Å}$) upon ingestion.

---

### Threat T-06: Floating-Point Numerical Instability and Boundary Chatter
* **Threat Mechanism:** Evaluating distances that land directly within floating-point precision $\epsilon$ of a decision cutoff ($\theta = 3.5\ \text{Å}$ vs. $d = 3.500000000000001\ \text{Å}$).
* **Failure Mode if Undetected:** Non-deterministic flips between `TRUE` and `FALSE` depending on compiler optimization flags (`-O3` vs `-O0`, FMA vector instructions).
* **Detection Mechanism:** Machine epsilon tolerance checks $|d - \theta| \le 10^{-6}\ \text{Å}$.
* **Mitigation:** Bounded numerical policy. Boundary-adjacent points are assigned `UNKNOWN` with resolution status `NEEDS_REFINEMENT` and tagged with an explicit numerical uncertainty warning in the certificate.

---

### Threat T-07: Stale Sidecar Index Inconsistency
* **Threat Mechanism:** A researcher re-runs an MD simulation, generating an updated `run.xtc` file with new coordinates, but leaves the old `run.mocs/` sidecar directory in place.
* **Failure Mode if Undetected:** The optimizer reads outdated Level 1 bounds and emits certified proofs that contradict the new trajectory data.
* **Detection Mechanism:** Two-tier identity verification: Tier 1 fast metadata check (mtime, file size) on session open; Tier 2 cryptographic SHA-256 audit.
* **Mitigation:** Every query invocation validates source identity. If metadata or hash mismatches, all sidecar entries are instantly invalidated, and execution falls back to Plan A direct scan or prompts for index rebuild.

---

### Threat T-08: Silent Ingestion of Unsupported Geometries
* **Threat Mechanism:** User submits a trajectory with a triclinic simulation box (e.g. truncated octahedron) or an NPT simulation with fluctuating cell volumes.
* **Failure Mode if Undetected:** AABB orthogonal bounding math fails; true distance lies outside $[L, U]$, emitting an unsound certification.
* **Detection Mechanism:** Level 0 inspection of box vectors across all frames.
* **Mitigation:** Strict precondition gate. If off-diagonal box components $\ne 0$ or cell variance $> 10^{-6}$, compilation rejects indexed mode immediately with `UNSUPPORTED_GEOMETRY`.

---

### Threat T-09: Misinterpretation of Sampling Blind Spots as Biological Proof
* **Threat Mechanism:** User asks whether a drug unbinds for at least 2 picoseconds in a trajectory sampled at 20 ps intervals.
* **Failure Mode if Undetected:** User concludes the drug never detached, when in reality brief unbinding events occurred between frames.
* **Detection Mechanism:** Temporal feasibility validator checks $\Delta\tau_{\min} \ge \Delta t$.
* **Mitigation:** The engine issues status `UNRESOLVABLE_SAMPLING` with truth value `UNKNOWN`, explicitly halting execution and outputting a diagnostic explaining that the source sampling frequency is insufficient.

---

### Threat T-10: Execution Certificate Tampering or Forgery
* **Threat Mechanism:** A malicious actor modifies a certificate JSON file to alter `"truth_value": "FALSE"` to `"truth_value": "TRUE"` in a published paper supplementary file.
* **Detection Mechanism:** Standalone verifier (`mocs verify <certificate.json>`).
* **Mitigation:** The verifier recomputes the SHA-256 hashes of the underlying trajectory and topology files (or validates recorded evidence blocks), re-evaluates the mathematical sufficiency of the evidence blocks against the recorded threshold, and confirms that bounds satisfy the claimed status.

---

### Threat T-11: Implementation Disagreement Between Runtime and Reference
* **Threat Mechanism:** A performance optimization (e.g. SIMD vectorization or integer quantization) introduces an edge-case bug into the optimized runtime that produces results differing from canonical MDAnalysis calculations.
* **Detection Mechanism:** Continuous differential testing against `mocs-reference`.
* **Mitigation:** Release blocking. Any disagreement between the reference oracle and an optimized certified result is treated as a P0 release-blocking bug.

---

### Threat T-12: Silent Floating-Point Precision Truncation
* **Threat Mechanism:** Using 32-bit floats (`float32`) for cumulative coordinate calculations, leading to catastrophic cancellation when atom coordinates exceed $1,000\ \text{Å}$.
* **Mitigation:** Mandatory IEEE-754 64-bit double precision (`float64`) throughout all internal distance, vector, and bounding calculations.

---

### Threat T-13: Silent Failure on Zero-Length Vectors
* **Threat Mechanism:** Atoms positioned at identical coordinates produce zero-length displacement vectors, causing $\operatorname{NaN}$ outputs in angular arccos routines.
* **Mitigation:** Norm clamping and explicit checks: if $\|\mathbf{v}\|_2 < 10^{-12}\ \text{Å}$, angle routines bypass division and emit `truth: UNKNOWN, resolution: ERROR` with diagnostic code `ZERO_DISPLACEMENT_SINGULARITY`.

---

### Threat T-14: Silent Certification Failure on NaN or Inf Coordinates
* **Threat Mechanism:** Corrupted trajectory files containing IEEE-754 $\operatorname{NaN}$ or $\operatorname{Inf}$ coordinates (e.g. from numerical explosion during unstable simulation phases).
* **Failure Mode if Undetected:** In IEEE-754 logic, all comparisons against $\operatorname{NaN}$ evaluate to `False` (`NaN < 4.0` is `False`). An existential query could silently evaluate corrupted exploded frames as `FALSE` instead of detecting numerical corruption.
* **Mitigation:** Strict numeric sanity gate: coordinate materialization routines check `np.isfinite()`. Any non-finite float immediately aborts execution with `truth: UNKNOWN, resolution: ERROR` and diagnostic code `INVALID_NUMERIC_DATA`. Certified results are never emitted over non-finite numerical data.
