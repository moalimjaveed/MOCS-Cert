# QUERY_LANGUAGE_SPEC.md — MOCS-Cert Declarative Query Language Specification

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Classification:** Canonical Planning Artifact (Not V0.1 Normative Interface)  
**Version:** 0.1.0 / Research Planning Baseline  
**Canonical Owner:** `QUERY_LANGUAGE_SPEC.md` is the future planning specification for the declarative query syntax (MolQL-Cert) and AST definitions. Tracked in [`DOC_MANIFEST.yaml`](../DOC_MANIFEST.yaml).  
**Notice:** In V0.1, MOCS-Cert exposes its normative functionality strictly via the Python API ([`API_SPEC.md`](API_SPEC.md)). The declarative query language specified here (provisionally designated **MolQL-Cert**) represents the planned high-level surface language that compiles down to the MOCS Logical Query IR.

---

## 1. Design Objectives and Operator Precedence

1. **Declarative Simplicity:** Enable researchers to express complex spatial-temporal molecular questions without writing imperative loops or custom trajectory traversal scripts.
2. **Deterministic Type System:** Enforce static validation of single-atom selections ($|\operatorname{ag}| = 1$), spatial units, and chemical roles before reading coordinate bytes.
3. **Sound Epistemic Grounding:** The language syntax mirrors the formal 3-valued truth domain and execution resolution statuses defined in [`FORMAL_SEMANTICS.md`](FORMAL_SEMANTICS.md).
4. **Prohibition of Floating-Point Equality:** Raw floating-point equality (`==`) is strictly prohibited. All spatial comparisons must use inequalities (`<`, `<=`, `>`, `>=`).
5. **Operator Precedence Hierarchy:**
   Expressions are parsed with the following strict precedence (from highest to lowest binding):
   1. Primary expressions, observable calls, and parenthesized expressions: `(...)`, `DISTANCE()`, `CONTACT()`, `HBOND()`
   2. Unary logical negation: `NOT`
   3. Conjunction: `AND`
   4. Disjunction: `OR`
   5. Temporal composition operators: `FOR`, `BEFORE`, `AFTER`, `FOLLOWED_BY`, `WITHIN`

---

## 2. Formal Grammar (EBNF Specification)

```ebnf
(* Top-level Query *)
Query ::= ObservabilityContract? Statement EOF ;

(* Observability Contract Header (Optional override) *)
ObservabilityContract ::= "CONTRACT" "{" ContractOption* "}" ;
ContractOption ::= "TIME_TOLERANCE" "=" Number TimeUnit
                 | "DISTANCE_TOLERANCE" "=" Number LengthUnit
                 | "PRECISION" "=" "float64" (* float32 reserved for future versions *)
                 | "PBC" "=" ("orthorhombic" | "none") ;

(* Statements *)
Statement ::= TemporalStatement
            | PredicateExpression ;

(* Temporal Compositions *)
TemporalStatement ::= PredicateExpression "FOR" DurationSpec
                    | PredicateExpression "BEFORE" PredicateExpression
                    | PredicateExpression "AFTER" PredicateExpression
                    | PredicateExpression "FOLLOWED_BY" PredicateExpression ("WITHIN" DurationSpec)?
                    | PredicateExpression "WITHIN" DurationSpec "OF" PredicateExpression ;

DurationSpec ::= (">=" | ">")? Number TimeUnit ;
TimeUnit ::= "ps" | "ns" | "us" | "frames" ;

(* Predicate Expressions *)
PredicateExpression ::= ObservableCall ComparisonOp Threshold
                      | "(" PredicateExpression ")"
                      | PredicateExpression ("AND" | "OR") PredicateExpression
                      | "NOT" PredicateExpression ;

ComparisonOp ::= "<" | "<=" | ">" | ">=" ;  (* Raw '==' is prohibited *)
Threshold ::= Number LengthUnit? ;
LengthUnit ::= "A" | "angstrom" | "nm" ;

(* Observable Function Calls *)
ObservableCall ::= DistanceCall
                 | ContactCall
                 | HBondCall ;

DistanceCall ::= "DISTANCE" "(" AtomSelector "," AtomSelector ")" ;
ContactCall  ::= "CONTACT" "(" AtomSelector "," AtomSelector ("," "cutoff" "=" Threshold)? ")" ;
HBondCall    ::= "HBOND" "(" "donor" "=" AtomSelector "," 
                             "hydrogen" "=" AtomSelector "," 
                             "acceptor" "=" AtomSelector 
                             ("," "d_cutoff" "=" Threshold)? 
                             ("," "angle_cutoff" "=" Number "deg")? ")" ;

(* Atom Selectors (Strict Single-Atom Invariant: |ag| = 1) *)
AtomSelector ::= Identifier ":" Identifier ":" Identifier  (* Explicit Chain:Residue:AtomName *)
               | StringLiteral                             (* Standard MDAnalysis selection string *)
               | "@" Integer                               (* 0-indexed global atom index *) ;

(* Lexical Primitives *)
Number        ::= [0-9]+ ("." [0-9]+)? ;
Integer       ::= [0-9]+ ;
Identifier    ::= [a-zA-Z_][a-zA-Z0-9_]* ;
StringLiteral ::= '"' [^"\\]* '"' ;
```

---

## 3. Abstract Syntax Tree (AST) Definition

The parser transforms the token stream into a typed Abstract Syntax Tree represented by immutable Python dataclasses:

```python
from dataclasses import dataclass
from typing import Optional, Union, List
from enum import Enum

class TimeUnit(str, Enum):
    PS = "ps"
    NS = "ns"
    US = "us"
    FRAMES = "frames"

class LengthUnit(str, Enum):
    ANGSTROM = "A"
    NM = "nm"

@dataclass(frozen=True)
class AtomRef:
    selector: str

@dataclass(frozen=True)
class ASTNode:
    pass

@dataclass(frozen=True)
class DistanceNode(ASTNode):
    atom_a: AtomRef
    atom_b: AtomRef

@dataclass(frozen=True)
class ContactNode(ASTNode):
    atom_a: AtomRef
    atom_b: AtomRef
    cutoff_angstrom: float

@dataclass(frozen=True)
class HBondNode(ASTNode):
    donor: AtomRef
    hydrogen: AtomRef
    acceptor: AtomRef
    distance_cutoff_angstrom: float = 3.5
    angle_cutoff_degrees: float = 120.0

@dataclass(frozen=True)
class PredicateNode(ASTNode):
    observable: ASTNode
    operator: str  # '<', '<=', etc.
    threshold: float
    unit: str

@dataclass(frozen=True)
class TemporalNode(ASTNode):
    operator: str  # 'FOR', 'BEFORE', 'AFTER', 'FOLLOWED_BY', 'WITHIN'
    left: ASTNode
    right: Optional[ASTNode] = None
    duration_value: Optional[float] = None
    duration_unit: Optional[TimeUnit] = None
    window_value: Optional[float] = None
```

---

## 4. Type Checking and Semantic Validation

The compiler runs four static validation passes over the AST prior to plan generation:

```
    [Parsed AST]
          │
          ▼
   [Pass 1: Topology Resolution]
   • Validate atom selectors against declared topology Phi
   • Reject empty selections or ambiguous multi-atom selections
          │
          ▼
   [Pass 2: Chemical Role Validation]
   • Verify HBond donor is an electronegative heavy atom (N, O, S)
   • Verify declared hydrogen is bonded to donor in covalent graph E
   • Verify acceptor possesses available lone pair chemistry
          │
          ▼
   [Pass 3: Dimensional and Unit Consistency]
   • Convert nm to Angstroms (1 nm = 10 A)
   • Convert ns to picoseconds (1 ns = 1000 ps)
   • Reject unitless thresholds where ambiguous
          │
          ▼
   [Pass 4: Temporal Feasibility Verification]
   • Under sampled_frames: tau <= dt is valid (requires ceil(tau / dt) = 1 frame)
   • Continuous physical requests (mode: continuous_physical) with tau < dt rejected with UNSUPPORTED_SEMANTICS
   • Trajectories with missing, irregular, or corrupt timestamps flagged for UNRESOLVABLE_SAMPLING
          │
          ▼
   [Validated Logical IR]
```

---

## 5. Concrete Query Examples

### Example 1: Basic Distance Threshold
```text
DISTANCE(A:155:CA, LIG:1:O2) < 4.0 A
```
*Meaning:* Evaluates whether the alpha carbon of residue 155 in chain A and oxygen O2 of ligand 1 remain within 4.0 Å under periodic minimum-image distance.

### Example 2: Persistent Contact Over Duration (FOR)
```text
CONTACT(A:155:CA, LIG:1:C1, cutoff=4.5 A) FOR >= 500 ps
```
*Meaning:* Asserts that a continuous spatial contact (< 4.5 Å) persists without interruption for at least 500 ps.

### Example 3: Hydrogen Bond Preceding Unbinding Event (BEFORE)
```text
HBOND(donor=A:155:NE2, hydrogen=A:155:HE2, acceptor=LIG:1:O1) 
BEFORE 
(DISTANCE(A:155:CA, LIG:1:C1) >= 8.0 A)
```
*Meaning:* Asserts that a specific hydrogen bond event interval $A = [k_{s, A}, k_{e, A})$ terminates strictly before the separation event interval $B = [k_{s, B}, k_{e, B})$ commences ($k_{e, A} \le k_{s, B}$).

### Example 4: Sequential Mechanism (FOLLOWED_BY with Window)
```text
HBOND(donor=A:155:N, hydrogen=A:155:H, acceptor=LIG:1:O2)
FOLLOWED_BY
CONTACT(A:200:CA, LIG:1:C5, cutoff=4.0 A)
WITHIN 2.0 ns
```
*Meaning:* A key anchoring hydrogen bond breaks, followed by the formation of a secondary contact within a temporal lag of 2 nanoseconds.

---

## 6. Syntactically or Semantically Invalid Queries

### Invalid Query 1: Observable Missing Comparison Operator
```text
DISTANCE(A:155:CA, LIG:1:O2)
```
*Diagnostic:* `TypeError: DISTANCE returns a continuous scalar (Length). A predicate requires a comparison operator (<, <=, >, >=) and a threshold.`

### Invalid Query 2: Incompatible Temporal Operands
```text
DISTANCE(A:155:CA, LIG:1:O2) BEFORE CONTACT(A:200:CA, LIG:1:C1)
```
*Diagnostic:* `TypeError: Left operand of BEFORE is a scalar distance function, not a Boolean event predicate. Did you mean 'DISTANCE(...) < threshold BEFORE ...'?`

### Invalid Query 3: Covalent Topology Inconsistency
```text
HBOND(donor=A:155:CA, hydrogen=A:155:HA, acceptor=LIG:1:O2)
```
*Diagnostic:* `ChemicalRoleError: Atom A:155:CA is an aliphatic carbon. C-H groups do not satisfy the standard donor role in HBOND-v1.`

### Invalid Query 4: Unsupported Continuous-Time Request
```text
CONTACT(A:155:CA, LIG:1:O2, cutoff=4.0 A) FOR >= 2 ps [mode: continuous_physical]
```
*Diagnostic (on trajectory with dt = 10 ps):* `SemanticError: Sub-frame continuous physical persistence (2 ps < 10 ps) requires continuous trajectory dynamics unsupported in V0.1. Evaluation returns UNKNOWN with UNSUPPORTED_SEMANTICS. Under default sampled_frames mode, tau <= dt is valid and requires ceil(tau / dt) = 1 frame.`

---

## 7. Language Extension Model

Future extensions to MolQL-Cert are governed by the following architectural rules:
1. No grammatical syntax may be added unless the corresponding observable contract is formally defined in [`OBSERVABLE_OPERATOR_SPEC.md`](OBSERVABLE_OPERATOR_SPEC.md).
2. The language must never invent implicit physical assumptions (such as continuous spline interpolation) unless explicitly declared in the `CONTRACT` block.
3. User-defined composite observables (macros) must compile to an acyclic sub-DAG in the Logical IR.
