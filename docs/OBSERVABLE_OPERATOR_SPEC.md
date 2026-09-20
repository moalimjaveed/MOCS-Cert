# OBSERVABLE_OPERATOR_SPEC.md — MOCS-Cert Observable Operator Specification

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Research Baseline  
**Cross-References:** [`FORMAL_SEMANTICS.md`](FORMAL_SEMANTICS.md), [`MATHEMATICAL_MODEL.md`](MATHEMATICAL_MODEL.md), [`PBC_SEMANTICS.md`](PBC_SEMANTICS.md), [`REFERENCE_SEMANTICS.md`](REFERENCE_SEMANTICS.md).

---

## 1. Architectural Operator Framework

In MOCS-Cert, an observable operator is a first-class declarative entity. An operator contract defines not merely an algorithmic implementation, but its mathematical domain, coordinate dependencies, numerical error bounds, bounding capabilities, and failure semantics.

```
                  ┌──────────────────────────────┐
                  │      Observable Contract     │
                  └──────────────┬───────────────┘
                                 │
                  ┌──────────────┴───────────────┐
                  ▼                              ▼
     [Exact Evaluator Path]            [Bound Evaluator Path]
     • Frame-by-frame Cartesian        • AABB block bounds (L, U)
     • Reference oracle agreement      • Hierarchical refinement
     • float64 strict MIC              • Fast pruning filter
```

Every operator in MOCS-Cert must declare its capabilities across three orthogonal dimensions:
1. **Boundable:** Can the operator compute sound upper and lower bounds over an AABB temporal block without scanning frames?
2. **Exact:** Does an authoritative per-frame evaluation algorithm exist?
3. **Refinable:** Can ambiguous envelope blocks be hierarchically subdivided to tighten bounds?

---

## 2. Operator Specification: DISTANCE

### 2.1 Formal YAML Contract

```yaml
operator: DISTANCE
version: "1.0.0"
description: "Minimum-image Euclidean distance between two selected atom centers."

inputs:
  atom_a:
    type: AtomRef
    description: "First atom identifier (e.g., 'A:155:CA' or integer index)."
  atom_b:
    type: AtomRef
    description: "Second atom identifier (e.g., 'LIG:1:O2' or integer index)."

dependencies: []

units:
  internal: "angstrom"
  supported_inputs: ["angstrom", "nm"]

semantics:
  metric: "euclidean_minimum_image"
  pbc_cell: "orthorhombic_fixed"
  domain: "R^3 x R^3 -> R_>=0"

capabilities:
  boundable: true
  exact: true
  refinable: true
  certifiable: true

numerical_policy:
  precision: "float64"
  ieee_rounding: "round_to_nearest_even"
  tolerance_epsilon: 1.0e-6

exact_evaluator:
  algorithm: "per_frame_minimum_image_cartesian"
  reference_module: "mocs.reference.distance"
  complexity: "O(1) per frame"

bound_evaluator:
  method: "aabb_minkowski_interval_separation"
  lower_bound: "L = sqrt(sum_mu max(0, dx_mu_min)^2)"
  upper_bound: "U = sqrt(sum_mu max(|dx_mu_max|)^2)"
  complexity: "O(1) per block"

refinement:
  strategy: "dyadic_temporal_subdivision"
  termination_condition: "L >= threshold OR U < threshold OR single_frame_leaf"

failure_modes:
  atom_not_found:
    status: "ERROR"
    message: "Atom selection string resolved to 0 atoms."
  ambiguous_selection:
    status: "ERROR"
    message: "Atom selection resolved to >1 atoms in pairwise mode."
  triclinic_box:
    status: "UNSUPPORTED_GEOMETRY"
    message: "Triclinic simulation cell encountered; V0.1 requires fixed orthorhombic."
  variable_box:
    status: "UNSUPPORTED_GEOMETRY"
    message: "Box vectors vary across trajectory frames."
  degenerate_box:
    status: "ERROR"
    message: "Box edge length <= 0.0 A."

provenance:
  specification_id: "SPEC-OP-DISTANCE-V1"
  authoritative_document: "FORMAL_SEMANTICS.md"
```

### 2.2 Mathematical Evaluation Details

Given coordinates $\mathbf{x}_i(k), \mathbf{x}_j(k) \in \mathbb{R}^3$ and orthorhombic box lengths $\mathbf{L} = (L_x, L_y, L_z)$:
1. Displacement vector $\mathbf{r} = \mathbf{x}_j(k) - \mathbf{x}_i(k)$.
2. Minimum image correction per dimension $\mu \in \{x, y, z\}$:
   $$\delta_\mu = r_\mu - L_\mu \cdot \operatorname{round}\left(\frac{r_\mu}{L_\mu}\right)$$
3. Scalar Euclidean distance:
   $$d_{ij}(k) = \sqrt{\delta_x^2 + \delta_y^2 + \delta_z^2}$$

The bound evaluator utilizes pre-computed atom AABBs $\mathcal{B}_i^m$ and $\mathcal{B}_j^m$ over block $B_m$ as derived in [`MATHEMATICAL_MODEL.md`](MATHEMATICAL_MODEL.md) §4.2.

---

## 3. Operator Specification: CONTACT

### 3.1 Formal YAML Contract

```yaml
operator: CONTACT
version: "1.0.0"
description: "Binary thresholded spatial contact between two atom centers."

inputs:
  atom_a:
    type: AtomRef
    description: "First atom identifier."
  atom_b:
    type: AtomRef
    description: "Second atom identifier."
  cutoff:
    type: Float64
    unit: "angstrom"
    default: 4.0
    description: "Maximum threshold distance to declare spatial contact."

dependencies:
  - operator: DISTANCE
    operands: ["atom_a", "atom_b"]

units:
  cutoff: "angstrom"
  output: "boolean"

semantics:
  definition: "DISTANCE(atom_a, atom_b) < cutoff"
  boundary_condition: "strict_inequality"
  hysteresis_policy: "none_in_v0.1"

capabilities:
  boundable: true
  exact: true
  refinable: true
  certifiable: true

certification_conditions:
  certified_true: "U < cutoff"
  certified_false: "L >= cutoff"
  unknown: "L < cutoff <= U"

threshold_semantics:
  strictness: "strict_less_than"
  tolerance_band: "none (hysteresis reserved for V0.2 DESIGN OPTION)"

exact_evaluator:
  algorithm: "compare_exact_distance_to_cutoff"
  reference_module: "mocs.reference.contact"
  complexity: "O(1) per frame"

bound_evaluator:
  method: "inherited_from_distance_bounds"
  complexity: "O(1) per block"

refinement:
  strategy: "subdivide_unknown_blocks"
  action: "recurse until U < cutoff OR L >= cutoff OR exact frame evaluation"

failure_modes:
  inherited: "All DISTANCE failure modes propagate directly."
  non_positive_cutoff:
    status: "ERROR"
    message: "Contact threshold cutoff must be strictly positive."

provenance:
  specification_id: "SPEC-OP-CONTACT-V1"
  authoritative_document: "FORMAL_SEMANTICS.md"
```

### 3.2 Threshold Behavior and Hysteresis Notes

In V0.1, contact evaluation uses strict inequality ($d_{ij} < \theta$). If a distance oscillates directly across the threshold boundary within a block, the bounds $L$ and $U$ will necessarily satisfy $L < \theta \le U$, forcing the block status to `UNKNOWN` and triggering selective refinement.

**V0.2 Design Option (Hysteresis):** To prevent boundary chatter in highly flexible loops, future specifications may define dual-threshold Schmitt trigger semantics:
* Contact Formation: $d_{ij} < \theta_{\text{form}}$ (e.g., $3.8\ \text{Å}$)
* Contact Dissociation: $d_{ij} \ge \theta_{\text{break}}$ (e.g., $4.2\ \text{Å}$)
In V0.1, this feature is explicitly omitted to maintain mathematical simplicity.

---

## 4. Operator Specification: HBOND

### 4.1 Formal YAML Contract

```yaml
operator: HBOND
version: "1.0.0"
description: "Geometric hydrogen bond detection based on donor-acceptor distance and donor-H-acceptor angle."

inputs:
  donor:
    type: AtomRef
    description: "Donor heavy atom (e.g., Nitrogen or Oxygen)."
  hydrogen:
    type: AtomRef
    description: "Hydrogen atom covalently bound to donor."
  acceptor:
    type: AtomRef
    description: "Acceptor heavy atom (e.g., Oxygen or Nitrogen)."
  distance_cutoff:
    type: Float64
    unit: "angstrom"
    default: 3.5
    description: "Maximum distance between donor and acceptor heavy atoms."
  angle_cutoff:
    type: Float64
    unit: "degrees"
    default: 120.0
    description: "Minimum donor-H...acceptor angle."

dependencies:
  - operator: DISTANCE
    operands: ["donor", "acceptor"]
  - operator: ANGLE
    operands: ["donor", "hydrogen", "acceptor"]
  - dependency: TOPOLOGY_COVALENT_BOND
    operands: ["donor", "hydrogen"]

units:
  distance: "angstrom"
  angle: "degrees"
  output: "boolean"

semantics:
  conjunction: "DISTANCE(donor, acceptor) < distance_cutoff AND ANGLE(donor, hydrogen, acceptor) >= angle_cutoff"
  topology_constraint: "BOND(donor, hydrogen) in Phi"

topology_requirements:
  explicit_hydrogens: true
  connectivity_present: true
  unsupported: "Implicit hydrogen models (united-atom) are rejected explicitly in V0.1."

capabilities:
  boundable: "partially_boundable (distance pruning only in V0.1)"
  exact: true
  refinable: true
  certifiable: "partially_certifiable (sound FALSE pruning; TRUE requires exact scan)"

exact_evaluator:
  algorithm: "conjunction_of_cartesian_distance_and_dot_product_angle"
  reference_module: "mocs.reference.hbond"
  complexity: "O(1) per frame"

bound_evaluator:
  method: "staged_distance_pruning"
  stage_1_prune: "If L_DA >= distance_cutoff -> CERTIFIED_FALSE for entire block"
  stage_2_exact: "If L_DA < distance_cutoff -> block is UNKNOWN; evaluate exact frames"
  angular_bound_status: "UNVALIDATED / OPEN QUESTION for V0.1"

refinement:
  strategy: "hierarchical_distance_refinement_then_exact_angle_scan"

failure_modes:
  missing_hydrogen:
    status: "ERROR"
    message: "Hydrogen atom not found in topology or missing coordinates in trajectory."
  unconnected_hydrogen:
    status: "ERROR"
    message: "Topology indicates declared hydrogen is not covalently bonded to declared donor."
  identical_donor_acceptor:
    status: "ERROR"
    message: "Donor atom reference matches acceptor atom reference."
  triclinic_box:
    status: "UNSUPPORTED_GEOMETRY"
    message: "Periodic minimum image requires fixed orthorhombic cell in V0.1."

provenance:
  specification_id: "SPEC-OP-HBOND-V1"
  authoritative_document: "FORMAL_SEMANTICS.md"
```

### 4.2 Two-Stage Hydrogen Bond Evaluation Architecture

Because sound angular bounds under AABB bounding remain an open research question with severe interval overestimation, MOCS-Cert executes $\operatorname{HBOND}$ via a strict conservative filter:

```
                            HBOND Query
                                 │
                 [Stage 1: Distance Pruning Filter]
                 Compute [L_DA, U_DA] between Donor and Acceptor
                                 │
             ┌───────────────────┴───────────────────┐
             ▼                                       ▼
     L_DA >= d_cutoff                        L_DA < d_cutoff
             │                                       │
     CERTIFIED_FALSE                         Candidate Block
 (Block Pruned! 0 frames read)                       │
                                                     ▼
                                       [Stage 2: Exact Frame Scan]
                                       Read coordinates for D, H, A
                                       Evaluate exact distance and angle
                                                     │
                                                     ▼
                                       Exact Frame Boolean Sequence
```

---

## 5. Temporal Operators Specification

Temporal operators accept frame-level Boolean observation series and evaluate temporal duration, precedence, and proximity contracts.

### 5.1 FOR Operator Contract

```yaml
operator: FOR
inputs:
  predicate: BooleanObservable
  min_duration_ps: Float64
semantics: "Requires a contiguous run of predicate=TRUE with duration >= min_duration_ps"
certification_logic:
  certified_true: "Contiguous certified_true blocks span >= min_duration_ps"
  certified_false: "No possible run of blocks can satisfy min_duration_ps"
  unknown: "Contiguous candidate blocks could satisfy duration, but require refinement"
  unresolvable: "Missing, irregular, or corrupt timestamps prevent sound duration mapping"
  unsupported_semantics: "Continuous physical persistence is not supported in V0.1"
```

### 5.2 BEFORE Operator Contract

```yaml
operator: BEFORE
inputs:
  predicate_a: BooleanObservable
  predicate_b: BooleanObservable
semantics: "Event A terminates strictly prior to the commencement of Event B"
sufficient_condition: "max_frame(Event_A) < min_frame(Event_B)"
uncertainty_condition: "Event intervals overlap or block boundaries interleave -> UNKNOWN"
```

### 5.3 FOLLOWED_BY Operator Contract

```yaml
operator: FOLLOWED_BY
inputs:
  predicate_a: BooleanObservable
  predicate_b: BooleanObservable
  max_window_ps: Float64
semantics: "Predicate A occurs, and Predicate B occurs within max_window_ps after A ends"
evaluation: "BEFORE(A, B) AND (start_time(B) - end_time(A)) <= max_window_ps"
```

### 5.4 WITHIN Operator Contract

```yaml
operator: WITHIN
inputs:
  predicate_a: BooleanObservable
  predicate_b: BooleanObservable
  window_ps: Float64
semantics: "Predicate A and Predicate B occur within temporal distance <= window_ps of each other"
evaluation: "min(|start(A) - end(B)|, |start(B) - end(A)|) <= window_ps"
```

---

## 6. Operator Extension Protocol (Adding Future Operators)

To maintain soundness guarantees, any proposed future operator (e.g., `RMSD`, `DIHEDRAL`, `POCKET_VOLUME`) must implement the standard Python ABC:

```python
class ObservableOperator(ABC):
    @abstractmethod
    def name(self) -> str: ...
    
    @abstractmethod
    def dependencies(self) -> List[str]: ...
    
    @abstractmethod
    def exact_evaluate(self, frame: Frame) -> Any: ...
    
    @abstractmethod
    def bound_evaluate(self, block: TemporalBlock) -> Tuple[float, float]: ...
    
    @abstractmethod
    def is_sound_bound_supported(self) -> bool: ...
```

If sound mathematical bounds cannot be formally derived and proven for the operator, `is_sound_bound_supported()` must return `False`, instructing the compiler to execute the operator exclusively via exact candidate scanning or Plan A direct fallback.
