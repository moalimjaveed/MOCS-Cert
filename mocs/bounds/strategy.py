"""
Bounding Strategy Abstraction for MOCS-Cert.

Provides a unified interface for bounding models (AABB and KDOP14),
enabling conservative distance bounds, containment checks, and serialization.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, Tuple
import numpy as np

from mocs.bounds.kdop import KDOP14, MODEL_NAME_KDOP14
from mocs.exceptions import MOCSUnsupportedGeometryError


class BoundingStrategy(ABC):
    """Abstract base class for conservative bounding representations."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Canonical model name, e.g. 'AABB' or 'KDOP14'."""
        ...

    @property
    @abstractmethod
    def version(self) -> str:
        """Model version tag."""
        ...

    @abstractmethod
    def build(self, coords: np.ndarray, metadata: Optional[Dict[str, Any]] = None) -> Any:
        """Builds a bounding representation enclosing the given coordinates."""
        ...

    @abstractmethod
    def compute_bounds(self, bound_a: Any, bound_b: Any) -> Tuple[float, float]:
        """Computes Euclidean lower and upper distance bounds between two bounding envelopes."""
        ...

    @abstractmethod
    def contains(self, bound: Any, point: np.ndarray, tolerance: float = 1e-9) -> bool:
        """Checks whether a point is contained within the bounding envelope."""
        ...

    @abstractmethod
    def serialize(self, bound: Any) -> Dict[str, Any]:
        """Serializes the bounding envelope to a JSON-compatible dictionary."""
        ...

    @abstractmethod
    def deserialize(self, data: Dict[str, Any]) -> Any:
        """Deserializes a bounding envelope from a dictionary."""
        ...


class AABBBoundingStrategy(BoundingStrategy):
    """Cartesian AABB bounding strategy."""

    @property
    def name(self) -> str:
        return "AABB"

    @property
    def version(self) -> str:
        return "AABB-v1.0"

    def build(self, coords: np.ndarray, metadata: Optional[Dict[str, Any]] = None) -> Tuple[np.ndarray, np.ndarray]:
        arr = np.asarray(coords, dtype=np.float64).reshape(-1, 3)
        if len(arr) == 0:
            raise MOCSUnsupportedGeometryError("Cannot build AABB from empty coordinates.")
        return np.min(arr, axis=0), np.max(arr, axis=0)

    def compute_bounds(self, bound_a: Tuple[np.ndarray, np.ndarray], bound_b: Tuple[np.ndarray, np.ndarray]) -> Tuple[float, float]:
        a_min, a_max = np.asarray(bound_a[0]), np.asarray(bound_a[1])
        b_min, b_max = np.asarray(bound_b[0]), np.asarray(bound_b[1])

        gap = np.maximum(0.0, np.maximum(a_min - b_max, b_min - a_max))
        L = float(np.linalg.norm(gap))

        span = np.maximum(np.abs(a_max - b_min), np.abs(b_max - a_min))
        U = float(np.linalg.norm(span))
        return L, U

    def contains(self, bound: Tuple[np.ndarray, np.ndarray], point: np.ndarray, tolerance: float = 1e-9) -> bool:
        p = np.asarray(point, dtype=np.float64)
        b_min, b_max = np.asarray(bound[0]), np.asarray(bound[1])
        return bool(np.all(p >= b_min - tolerance) and np.all(p <= b_max + tolerance))

    def serialize(self, bound: Tuple[np.ndarray, np.ndarray]) -> Dict[str, Any]:
        return {
            "bounding_model": self.name,
            "model_version": self.version,
            "min": np.asarray(bound[0]).tolist(),
            "max": np.asarray(bound[1]).tolist(),
        }

    def deserialize(self, data: Dict[str, Any]) -> Tuple[np.ndarray, np.ndarray]:
        return (np.array(data["min"], dtype=np.float64), np.array(data["max"], dtype=np.float64))


class KDOP14BoundingStrategy(BoundingStrategy):
    """14-DOP bounding strategy with 7 canonical normalized unit directions."""

    @property
    def name(self) -> str:
        return MODEL_NAME_KDOP14

    @property
    def version(self) -> str:
        return "KDOP14-v1"

    def build(self, coords: np.ndarray, metadata: Optional[Dict[str, Any]] = None) -> KDOP14:
        return KDOP14.from_coordinates(coords, metadata=metadata)

    def compute_bounds(self, bound_a: KDOP14, bound_b: KDOP14) -> Tuple[float, float]:
        if not (isinstance(bound_a, KDOP14) and isinstance(bound_b, KDOP14)):
            raise TypeError("KDOP14BoundingStrategy requires KDOP14 instances.")
        return bound_a.compute_euclidean_bounds(bound_b)

    def contains(self, bound: KDOP14, point: np.ndarray, tolerance: float = 1e-9) -> bool:
        return bound.contains_point(point, tolerance=tolerance)

    def serialize(self, bound: KDOP14) -> Dict[str, Any]:
        return bound.serialize()

    def deserialize(self, data: Dict[str, Any]) -> KDOP14:
        return KDOP14.deserialize(data)


def get_bounding_strategy(model_name: str) -> BoundingStrategy:
    """Factory returning the appropriate BoundingStrategy implementation."""
    norm = model_name.strip().upper()
    if norm == "AABB":
        return AABBBoundingStrategy()
    elif norm == "KDOP14":
        return KDOP14BoundingStrategy()
    else:
        raise MOCSUnsupportedGeometryError(
            f"Unknown bounding model '{model_name}'. Supported models: 'AABB', 'KDOP14'."
        )
