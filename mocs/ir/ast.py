"""Query Intermediate Representations & Abstract Syntax Tree Nodes."""

from enum import Enum
from dataclasses import dataclass
from typing import Optional

class TimeUnit(str, Enum):
    PS = "ps"
    NS = "ns"
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
    operator: str  # '<', '<=', '>', '>='
    threshold: float
    unit: str = "A"

@dataclass(frozen=True)
class TemporalNode(ASTNode):
    operator: str  # 'FOR', 'BEFORE', 'AFTER', 'FOLLOWED_BY', 'WITHIN'
    left: ASTNode
    right: Optional[ASTNode] = None
    duration_value: Optional[float] = None
    duration_unit: Optional[TimeUnit] = None
    window_value: Optional[float] = None
