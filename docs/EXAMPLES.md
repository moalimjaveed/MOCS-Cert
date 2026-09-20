# EXAMPLES.md — MOCS-Cert Query and Certification Walkthrough Examples

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Research Baseline  
**Cross-References:** [`API_SPEC.md`](API_SPEC.md), [`FORMAL_SEMANTICS.md`](FORMAL_SEMANTICS.md), [`TEMPORAL_SEMANTICS.md`](TEMPORAL_SEMANTICS.md), [`MATHEMATICAL_MODEL.md`](MATHEMATICAL_MODEL.md).

---

## 1. Overview of Examples

This document provides seven concrete, fully traced examples demonstrating the execution mechanics, index pruning, hierarchical refinement, and epistemic logic of MOCS-Cert. Each example illustrates:
1. The user's scientific query (Python API).
2. What happens under the hood across compiler and runtime subsystems.
3. The computational result object.
4. The machine-verifiable execution certificate summary.
5. Why the result is mathematically and deductively sound.

---

### Example 1: Single Distance Threshold Query (Fast Pruning)

### Scientific Question
*"Does the catalytic tyrosine (A:155:OH) come within 3.5 Å of the ligand carbonyl oxygen (LIG:1:O2) during the simulation?"*

### Python API Invocation
```python
import mocs

session = mocs.open("trajectories/run.xtc", "topologies/system.tpr")
result = session.query(
    observable="distance",
    operands=("A:155:OH", "LIG:1:O2"),
    predicate="< 3.5 A",
    block_size=100
)
```

### Under the Hood Execution Trace
1. **Compilation:** The query lowers to `LogicalPlan(Distance < 3.5 A)`.
2. **Index Lookup:** The engine seeks into `selections/a155_oh.bin` and `selections/lig_o2.bin`, reading 1,000 Level 1 AABB records ($M = 1,000$ blocks of 100 frames).
3. **Bound Derivation:** For each block $m$, the runtime computes $L_m$ and $U_m$ under periodic minimum-image convention.
   * For blocks $0$ to $999$, the lowest computed lower bound is $L_{\min} = 6.42\ \text{Å}$.
   * Since $L_m \ge 3.5\ \text{Å}$ for every single block $m \in [0, 999]$, every block satisfies the `CERTIFIED_FALSE` condition.
4. **Pruning:** All 1,000 blocks are pruned from coordinate reading.
5. **I/O Access:** **Zero coordinate frames are read from `run.xtc`.**

### Emitted Result and Certificate Summary
```json
{
  "truth": "FALSE",
  "resolution": "COMPLETE",
  "quantifier": "EXISTS",
  "plan_used": "Plan-B",
  "resources": {
    "source_compressed_bytes_fetched": 0,
    "compressed_frames_decoded": 0,
    "coordinates_materialized": 0,
    "atoms_analyzed": 0,
    "index_bytes_read": 128000,
    "wall_time_seconds": 0.042,
    "peak_memory_bytes": 10485760
  },
  "evidence": {
    "total_blocks": 1000,
    "blocks_certified_false": 1000,
    "blocks_refined": 0,
    "frames_scanned_exact": 0
  }
}
```

### Why It Is Sound
By the Minkowski interval theorem ([`MATHEMATICAL_MODEL.md`](MATHEMATICAL_MODEL.md) §4.2), for any frame $k$ in block $m$, $d_{ij}(k) \ge L_m$. Since $L_m \ge 6.42\ \text{Å} > 3.5\ \text{Å}$ for all $m$, it is mathematically impossible for $d_{ij}(k) < 3.5\ \text{Å}$ to hold at any frame in the trajectory.

---

## Example 2: Persistent Spatial Contact Over Time (FOR Operator)

### Scientific Question
*"Does the ligand form a stable spatial contact (< 4.5 Å) with residue A:200 that persists unbroken for at least 500 ps?"*

### Python API Invocation
```python
result = session.query(
    observable="contact",
    operands=("A:200:CA", "LIG:1:C5"),
    predicate="< 4.5 A",
    temporal={"operator": "FOR", "min_duration_ps": 500.0},
    block_size=100
)
```

### Under the Hood Execution Trace
1. **Temporal Parameter Check:** $\Delta t = 10.0\ \text{ps}$. Required span is $500\ \text{ps} \implies K_{\text{req}} = 50$ consecutive frames. Since $500\ \text{ps} > 10\ \text{ps}$, query is resolvable.
2. **Index Pruning:**
   * Blocks $0\dots 400$: $L_m > 8.0\ \text{Å} \implies$ `CERTIFIED_FALSE`.
   * Block $401$ (frames 40,100 to 40,200): $U_{401} = 3.85\ \text{Å} < 4.5\ \text{Å} \implies$ `CERTIFIED_TRUE`.
3. **Temporal Short-Circuit:**
   * Block $401$ is 100 consecutive frames where every frame is guaranteed to have distance $< 3.85\ \text{Å} < 4.5\ \text{Å}$.
   * Duration of Block 401: $100 \times 10\ \text{ps} = 1,000\ \text{ps} > 500\ \text{ps}$.
4. **Early Termination:** The requirement is satisfied within Block 401 alone. The engine terminates immediately, pruning remaining blocks ($402\dots 999$).

### Emitted Result and Certificate Summary
```json
{
  "truth": "TRUE",
  "resolution": "COMPLETE",
  "quantifier": "DURATION",
  "plan_used": "Plan-D",
  "evidence": {
    "total_blocks": 1000,
    "blocks_inspected": 402,
    "blocks_certified_true": 1,
    "witness_interval": [40100, 40200],
    "witness_duration_ps": 1000.0
  }
}
```

### Why It Is Sound
Because $U_{401} < 4.5\ \text{Å}$, every single frame in the 100-frame block is guaranteed to satisfy the contact condition. A contiguous run of 100 frames spans $1,000\ \text{ps}$, which strictly exceeds the requested $500\ \text{ps}$.

---

## Example 3: Staged Hydrogen Bond Verification

### Scientific Question
*"Does the backbone amide of Gly120 form a canonical hydrogen bond with the ligand carbonyl?"*

### Python API Invocation
```python
result = session.query(
    observable="hbond",
    operands={
        "donor": "A:120:N",
        "hydrogen": "A:120:H",
        "acceptor": "LIG:1:O1"
    },
    distance_cutoff_angstrom=3.5,
    angle_cutoff_degrees=120.0,
    block_size=100
)
```

### Under the Hood Execution Trace
1. **Topology Validation:** Confirms covalent bond $(A:120:N, A:120:H) \in \mathcal{E}$.
2. **Stage 1 (Distance Pruning):** Evaluates donor-acceptor distance bounds $[L_{DA}^m, U_{DA}^m]$.
   * In 920 blocks, $L_{DA}^m \ge 3.5\ \text{Å} \implies$ Pruned as `CERTIFIED_FALSE` (no angle check needed).
   * In 80 blocks, $L_{DA}^m < 3.5\ \text{Å} \implies$ Ambiguous candidates.
3. **Stage 2 (Exact Candidate Scan):** For the 80 surviving blocks ($8,000$ frames), the engine seeks to offsets via `frame_offsets.bin`, reads coordinates for the 3 atoms, and computes exact distances and angles $\theta_{DHA}$ in a common unwrapped coordinate frame centered on $H$.
   * In Block 512, frame 51,245 satisfies $d_{DA} = 2.82\ \text{Å} < 3.5\ \text{Å}$ and $\theta = 164.2^\circ \ge 120^\circ$.
4. **Outcome:** A confirmed hydrogen bond event is discovered.

### Emitted Result Summary
* **Truth:** `TRUE` (Resolution: `COMPLETE`, Quantifier: `EXISTS`)
* **Frames Decoded:** 8,000 out of 100,000 ($92\%$ fewer decoded frames compared to brute force).

### Why It Is Sound
Blocks eliminated in Stage 1 had donor-acceptor distances strictly $\ge 3.5\ \text{Å}$. Since a hydrogen bond strictly requires $d_{DA} < 3.5\ \text{Å}$, pruning them cannot eliminate any true hydrogen bonds. Surviving frames were evaluated with the exact reference algorithm.

---

## Example 4: Temporal Precedence (BEFORE Operator)

### Scientific Question
*"Does the catalytic hydrogen bond break BEFORE residue A:200 forms an unbinding contact?"*

### Python API Invocation
```python
result = session.query(
    observable="hbond",
    operands={"donor": "A:120:N", "hydrogen": "A:120:H", "acceptor": "LIG:1:O1"},
    predicate="< 3.5 A",
    temporal={
        "operator": "BEFORE",
        "target_observable": "contact",
        "target_operands": ("A:200:CA", "LIG:1:C5"),
        "target_predicate": "< 4.5 A"
    }
)
```

### Under the Hood Execution Trace
1. Event $A$ (Hydrogen Bond) is evaluated: The event episode is the half-open interval $E_A = [12000, 12451)$, where frame $12,450$ is the final true frame ($t = 124.5\ \text{ns}$) and $k_{e, A} = 12451$.
2. Event $B$ (Contact) is evaluated: The first frame where contact forms is frame $45,120$ ($t = 451.2\ \text{ns}$), so $k_{s, B} = 45120$.
3. **Precedence Check (Half-Open Interval Soundness):**
   $$k_{e, A} = 12,451 \le 45,120 = k_{s, B}$$
   Since $12,451 \le 45,120$, $E_A$ concludes strictly at or before $E_B$ begins.

### Emitted Result Summary
* **Truth:** `TRUE` (Resolution: `COMPLETE`, Quantifier: `EXISTS`)
* **Observed Lag:** $(45,120 - 12,451) \times 10\ \text{ps} = 32,669 \times 10\ \text{ps} = 326.69\ \text{ns}$.

### Why It Is Sound
Conforms strictly to the sound half-open precedence condition $k_{e, A} \le k_{s, B}$ defined in [`FORMAL_SEMANTICS.md`](FORMAL_SEMANTICS.md) §4.3.

---

## Example 5: Sequential Mechanism (FOLLOWED_BY within Lag Window)

### Scientific Question
*"Does an allosteric contact form within 2 nanoseconds after the primary salt bridge breaks?"*

### Python API Invocation
```python
result = session.query(
    observable="distance",
    operands=("A:50:NZ", "A:100:OE1"),
    predicate="> 4.0 A",
    temporal={
        "operator": "FOLLOWED_BY",
        "target_observable": "contact",
        "target_operands": ("A:200:CA", "LIG:1:C5"),
        "target_predicate": "< 4.5 A",
        "window_ps": 2000.0
    }
)
```

### Under the Hood Execution Trace
1. Salt bridge breakage event concludes at frame $20,000$ ($k_e = 20001$).
2. Allosteric contact forms at frame $20,150$ ($k_s = 20150$).
3. Precedence holds ($20,001 \le 20,150$).
4. Lag duration: $(20,150 - 20,001) \times 10\ \text{ps} = 1,499\ \text{ps} \approx 1.5\ \text{ns}$.
5. Window check: $1,499\ \text{ps} \le 2,000.0\ \text{ps} \implies \text{Condition Satisfied}$.

### Emitted Result Summary
* **Truth:** `TRUE` (Resolution: `COMPLETE`, Quantifier: `EXISTS`)
* **Observed Lag:** $1,499\ \text{ps} \le 2,000\ \text{ps}$.

---

## Example 6: UNKNOWN Block Triggering Hierarchical Refinement

### Scientific Question
*"Is there a close contact (< 3.8 Å) between Trp54 (A:54:NE1) and the ligand carbonyl (LIG:1:O2)?"*

### Execution Trace Showing Hierarchical Subdivision
1. **Level 0 (Coarse Block $b=500$):**
   * Block 12 spans frames $[6000, 6500)$.
   * Bounds computed: $L = 3.2\ \text{Å}, U = 4.6\ \text{Å}$.
   * Since $3.2 < 3.8 \le 4.6$, Status is **`UNKNOWN`**.
2. **Selective Refinement Triggered:**
   * Block 12 is split dyadically into two Level 1 sub-blocks of 250 frames:
     * Sub-block $12.0$ $[6000, 6250)$: Recomputed bounds $L=3.9\ \text{Å}, U=4.5\ \text{Å}$. Since $L \ge 3.8\ \text{Å} \implies$ **`CERTIFIED_FALSE`** (Pruned!).
     * Sub-block $12.1$ $[6250, 6500)$: Recomputed bounds $L=3.3\ \text{Å}, U=3.7\ \text{Å}$. Since $U < 3.8\ \text{Å} \implies$ **`CERTIFIED_TRUE`** (Pruned!).
3. **Resolution:** Both halves resolved at Level 1 without reading exact coordinate frames.

---

## Example 7: Continuous Physical Request Rejection

### Scientific Question
*"Prove that an unbroken contact persisted continuously for 2.0 picoseconds in a trajectory sampled at 10.0 ps intervals."*

### Python API Invocation
```python
result = session.query(
    observable="contact",
    operands=("A:155:CA", "LIG:1:O2"),
    predicate="< 3.5 A",
    temporal={"operator": "FOR", "min_duration_ps": 2.0, "mode": "continuous_physical"}
)
```

### Under the Hood Execution Trace
1. Trajectory metadata inspection: Timestep between stored frames is $\Delta t = 10.0\ \text{ps}$.
2. Mode check: Contract explicitly requests `mode: "continuous_physical"`.
3. Precondition failure: V0.1 operates strictly under discrete sampled-frame semantics (`mode: "sampled_frames"`). Sub-frame continuous physical persistence cannot be mathematically certified without an unvalidated continuous-time trajectory model.
4. **Execution Halted:** The compiler halts execution with `resolution: UNSUPPORTED_SEMANTICS`.

### Emitted Result and Diagnostic Summary
```json
{
  "truth": "UNKNOWN",
  "resolution": "UNSUPPORTED_SEMANTICS",
  "quantifier": "DURATION",
  "error_diagnostic": {
    "requested_mode": "continuous_physical",
    "supported_mode": "sampled_frames",
    "explanation": "Continuous physical persistence queries are outside V0.1 capability. V0.1 evaluates trajectories strictly under discrete sampled-frame semantics."
  }
}
```

### Why It Is Sound
Returning `FALSE` would be false certainty (the contact might have persisted between frames). Returning `UNKNOWN` with `NEEDS_REFINEMENT` would invite useless refinement of stored frames that do not possess inter-frame coordinates. Emitting `UNSUPPORTED_SEMANTICS` honestly identifies the boundary of certified discrete observation.
