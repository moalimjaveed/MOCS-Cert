# TEMPORAL_SEMANTICS.md — MOCS-Cert Temporal Semantics and Discrete Event Algebra

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Design Baseline (Audit Revisions Applied)  
**Canonical Owner:** `TEMPORAL_SEMANTICS.md` is the authoritative specification for discrete event models, half-open intervals, sampled duration metrics, and temporal operators in MOCS-Cert. Tracked in [`DOC_MANIFEST.yaml`](../DOC_MANIFEST.yaml).

---

## 1. Fundamental Principle: Sampled-Frame Semantics

Molecular dynamics trajectories do not store a continuous trajectory function $\mathbf{x}(t)$. They store a discrete sequence of sampled snapshots recorded at discrete simulation instants:

$$T = \langle f_0, f_1, \dots, f_{N-1} \rangle, \quad t_k = t_0 + k \cdot \Delta t$$

### 1.1 Strict Prohibition of Continuous-Time Hallucination
* **The Principle of Sampled Grounding:** MOCS-Cert reasons **exclusively** about the observed, stored frames in the trajectory.
* **Prohibition of Interpolation:** In V0.1, the engine never performs linear, polynomial, or spline interpolation across adjacent frames to infer unobserved states.
* **Prohibition of Continuous Persistence Claims:** In V0.1, a temporal operator asserts properties over discrete runs of sampled frames, not continuous physical persistence between frames. Continuous-time queries without explicit interpolation contracts are rejected with `UNSUPPORTED_SEMANTICS`.
* **Prohibition of False Nyquist Claims:** MOCS-Cert explicitly rejects the heuristic rule:
  $$\Delta t < \frac{\tau_{\text{autocorrelation}}}{2}$$
  as a general theorem of sampling sufficiency. Autocorrelation times vary across observables in the same trajectory (e.g. bond vibrations $\sim 10\ \text{fs}$ vs. domain motions $\sim 1\ \mu\text{s}$). Claiming that a single sampling interval $\Delta t$ satisfies continuous Shannon-Nyquist reconstruction across arbitrary molecular observables is scientifically indefensible.

---

## 2. Discrete Event Algebra and Half-Open Interval Models

Let $P: T \to \{0, 1\}$ be an exact or certified frame-level Boolean observable predicate (such as $\operatorname{CONTACT}$ or $\operatorname{HBOND}$).

```
Frame Index:  0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15
Predicate P: [0  1  1  1  1  0  0  0  1  1  1  0  0  0  0  0]
                 └──────────)          └────────)
                 Interval E1           Interval E2
                 [ks=1, ke=5)          [ks=8, ke=11)
                 Duration = 4*dt       Duration = 3*dt
```

### 2.1 Half-Open Event Interval Definition and Sample-Slot Axiom

**[AXIOM] (Sample-Slot Semantics).** In MOCS-Cert V0.1, simulation trajectories are evaluated strictly under sampled-frame semantics (`mode: sampled_frames`). Each discrete frame $k \in \{0, 1, \dots, N-1\}$ occupies the half-open temporal slot:

$$I_k = [t_k, t_{k+1}) = [k \Delta t, (k+1)\Delta t)$$

having discrete duration $\Delta t$. A predicate $P$ evaluating to `TRUE` at frame $f_k$ asserts truth throughout slot $I_k$. MOCS-Cert makes zero mathematical claims regarding continuous coordinates between discrete sampled timepoints. Requests for continuous-time physical persistence (`mode: continuous_physical`) are outside V0.1 capabilities and emit `resolution: UNSUPPORTED_SEMANTICS`.

**[DEFINITION] (Event Interval).** An event interval $E$ is a maximal, contiguous half-open index interval over which predicate $P$ evaluates to `TRUE`:

$$E = [k_s, k_e) = \{k \in \mathbb{N}_0 \mid k_s \le k < k_e\}$$

where $k_s$ is the index of the first frame of the event, and $k_e$ is the frame index strictly after the event concludes:
1. $\forall k \in \{k_s, k_s + 1, \dots, k_e - 1\}: P(f_k) = \text{TRUE}$.
2. If $k_s > 0$, then $P(f_{k_s - 1}) = \text{FALSE}$ (maximal start).
3. If $k_e < N$, then $P(f_{k_e}) = \text{FALSE}$ (maximal exclusive end).

### 2.2 Sampled Event Duration Metric

**[DEFINITION] (Sampled Duration).** Under discrete sampled-frame semantics, the duration of event $E = [k_s, k_e)$ is:

$$\operatorname{Duration}(E) = (k_e - k_s) \cdot \Delta t$$

*Consistency Verification:* 100 consecutive `TRUE` frames from index 0 to 99 form the half-open interval $[0, 100)$. Its duration is:
$$(100 - 0) \times 10\ \text{ps} = 1000\ \text{ps}$$
A single `TRUE` frame at index $k$ forms interval $[k, k+1)$ with duration $(k+1 - k)\Delta t = \Delta t$.

---

## 3. The Temporal Operators

### 3.1 The FOR Operator (Sampled Duration Persistence)

**Syntax:** $\operatorname{FOR}(P, \tau)$  
**Semantic Contract:** Asserts that an unbroken run of sampled frames satisfying predicate $P$ spans at least elapsed duration $\tau$:

$$\operatorname{FOR}_{\text{sampled}}(P, \tau) \iff \exists E \in \mathcal{E}_P : \operatorname{Duration}(E) \ge \tau \iff (k_e - k_s) \ge \left\lceil \frac{\tau}{\Delta t} \right\rceil$$

**Definite vs. Possible Event Sets:**
* **$\mathcal{E}_P^{\text{def}}$ (Definite Events):** Contiguous sequences composed strictly of verified `TRUE` blocks or frames.
* **$\mathcal{E}_P^{\text{poss}}$ (Possible Events):** Contiguous sequences composed of `TRUE` and `UNKNOWN` blocks or frames, terminated by verified `FALSE` boundaries.

* **Sound Condition for CERTIFIED_TRUE:**
  $$\exists E = [k_s, k_e) \in \mathcal{E}_P^{\text{def}} \text{ such that } (k_e - k_s) \cdot \Delta t \ge \tau$$
* **Sound Condition for CERTIFIED_FALSE:**
  $$\max_{E \in \mathcal{E}_P^{\text{poss}}} \operatorname{Duration}(E) < \tau$$
  If even the most optimistic unbroken run through unrefuted `UNKNOWN` blocks cannot achieve $\lceil \tau / \Delta t \rceil$ frames, the query is certified `FALSE` without requiring further frame decoding.
* **Condition for UNRESOLVABLE_SAMPLING:**
  Triggered only if non-uniform, corrupt, or missing timestamps in the trajectory source prevent mapping elapsed physical durations to discrete frame indices. Under regular sampled-frame semantics, queries with $\tau \le \Delta t$ require $\lceil \tau / \Delta t \rceil = 1$ frame and evaluate to `TRUE` if any single frame satisfies $P$. Queries requiring continuous inter-frame physical guarantees emit `resolution: UNSUPPORTED_SEMANTICS`.

---

### 3.2 The BEFORE and AFTER Operators (Precedence)

**Syntax:** $\operatorname{BEFORE}(P_A, P_B)$

Let $\mathcal{E}_A = \{A_1, A_2, \dots\}$ and $\mathcal{E}_B = \{B_1, B_2, \dots\}$ be the sets of observed event intervals for predicates $P_A$ and $P_B$.

```
Case 1: Sound BEFORE (CERTIFIED_TRUE)
Event A: [=====) (ends at a_e)
Event B:             [=====) (starts at b_s)
                 a_e <= b_s  ==> A strictly precedes B

Case 2: Overlapping Event (UNKNOWN)
Event A: [===========)
Event B:      [===========)
         Overlap region: temporal ordering ambiguous at event level
```

**Occurrence Quantifiers & Semantics (V0.1 Canonical):**
V0.1 implements existential occurrence precedence by default:

$$\operatorname{BEFORE}_{\text{exists}}(A, B) \iff \exists A \in \mathcal{E}_A, \, \exists B \in \mathcal{E}_B : a_e \le b_s$$

* **CERTIFIED_TRUE:** An occurrence of event $A$ completes strictly at or before an occurrence of event $B$ begins ($a_e \le b_s$).
* **CERTIFIED_FALSE:** For all candidate pairs $(A, B)$, $a_e > b_s$ (every occurrence of $B$ begins before $A$ concludes).
* **UNKNOWN:** Candidate occurrences overlap ($a_s < b_e \land b_s < a_e$) or uninspected blocks leave ordering unproven.
* **Empty Event Set Algebra:**
  If $\mathcal{E}_A = \emptyset$ or $\mathcal{E}_B = \emptyset$:
  * If both are definitively certified empty, $\operatorname{BEFORE}_{\text{exists}}$ evaluates to `FALSE`.
  * If candidate blocks remain unrefuted, evaluates to `UNKNOWN`.

$\operatorname{AFTER}(P_A, P_B)$ is defined symmetrically: $\exists A \in \mathcal{E}_A, \exists B \in \mathcal{E}_B : b_e \le a_s$.

---

### 3.3 The FOLLOWED_BY Operator (Sequential Chaining with UNKNOWN Preservation)

**Syntax:** $\operatorname{FOLLOWED\_BY}(P_A, P_B, W_{\max})$

Assimilates temporal precedence with an upper bound on transition latency:

$$\operatorname{FOLLOWED\_BY}(A, B, W_{\max}) \iff (a_e \le b_s) \land \left((b_s - a_e) \cdot \Delta t \le W_{\max}\right)$$

* **CERTIFIED_TRUE:** There exists an occurrence pair $(A, B)$ satisfying $a_e \le b_s$ and $(b_s - a_e)\Delta t \le W_{\max}$.
* **CERTIFIED_FALSE:** For all candidate pairs, either $a_e > b_s$ or $(b_s - a_e)\Delta t > W_{\max}$.
* **UNKNOWN (Preserved Symmetry):** If occurrences of $A$ and $B$ overlap in time ($a_s < b_e \land b_s < a_e$), or unresolved blocks leave precedence ambiguous, the operator evaluates to `UNKNOWN`. It does **not** default to `FALSE`.

---

### 3.4 The WITHIN Operator (Temporal Proximity)

**Syntax:** $\operatorname{WITHIN}(P_A, P_B, W_{\text{window}})$

Asserts mutual temporal proximity without imposing directional causality.

**[DEFINITION] (Interval Separation Distance).**
For two half-open intervals $A = [a_s, a_e)$ and $B = [b_s, b_e)$, temporal distance is defined rigorously as:

$$\operatorname{dist}_{\text{temporal}}(A, B) = \max(0, \, b_s - a_e, \, a_s - b_e) \cdot \Delta t$$

* **Overlapping Case:** If $A$ and $B$ overlap ($a_s < b_e \land b_s < a_e$), $b_s - a_e < 0$ and $a_s - b_e < 0$, yielding $\operatorname{dist}_{\text{temporal}}(A, B) = 0$.
* **Disjoint Case ($A$ before $B$):** $b_s \ge a_e$, yielding distance $(b_s - a_e)\Delta t$.
* **Disjoint Case ($B$ before $A$):** $a_s \ge b_e$, yielding distance $(a_s - b_e)\Delta t$.

$$\operatorname{WITHIN}(A, B, W_{\text{window}}) \iff \min_{A \in \mathcal{E}_A, B \in \mathcal{E}_B} \operatorname{dist}_{\text{temporal}}(A, B) \le W_{\text{window}}$$

---

## 4. Boundary and Sub-Frame Failure Conditions

### 4.1 Sub-Frame Events and Inter-Frame Blind Spots
In molecular dynamics, hydrogen bond lifetimes frequently range from $0.5\ \text{ps}$ to $5.0\ \text{ps}$. If a trajectory is recorded at $\Delta t = 20\ \text{ps}$, transient events can occur completely within the unobserved interval $(t_k, t_{k+1})$.

**MOCS-Cert Stance:**
MOCS-Cert does **not** assert that the interaction did not occur physically. It certifies exclusively that **in the observed coordinate snapshots, no interaction was recorded**. Queries requiring guarantees about unobserved inter-frame states are rejected with `UNSUPPORTED_SEMANTICS`.

### 4.2 Handling Block Boundary Transitions
When temporal blocks are evaluated independently:
* If Block $m-1$ ends with $P=\text{TRUE}$ at frame $b-1$, and Block $m$ begins with $P=\text{TRUE}$ at frame $b$, the temporal synthesizer stitches these contiguous blocks into a single unified event interval.
* Block partitioning never truncates event intervals.
