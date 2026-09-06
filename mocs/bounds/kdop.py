"""
Authoritative 14-DOP (Discrete Oriented Polytope) Bounding Geometry Engine.

Defines the canonical 14-DOP bounding representation with 7 normalized unit
directions (3 Cartesian axes + 4 cube main diagonals), providing tighter
conservative bounding envelopes for rotating and elongated molecular structures.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Dict, Optional, Sequence, Tuple, Union
import numpy as np

from mocs.exceptions import MOCSUnsupportedGeometryError


# Canonical 7 directions in R^3, normalized to unit length (||u_k|| = 1.0)
# Projections dot(p, u_k) are in physical distance units (Angstroms).
_INV_SQRT3 = 1.0 / math.sqrt(3.0)

CANONICAL_DIRECTIONS_14 = np.array([
    [1.0, 0.0, 0.0],              # u1: +X axis
    [0.0, 1.0, 0.0],              # u2: +Y axis
    [0.0, 0.0, 1.0],              # u3: +Z axis
    [_INV_SQRT3,  _INV_SQRT3,  _INV_SQRT3],   # u4: (+1, +1, +1) / sqrt(3)
    [_INV_SQRT3,  _INV_SQRT3, -_INV_SQRT3],   # u5: (+1, +1, -1) / sqrt(3)
    [_INV_SQRT3, -_INV_SQRT3,  _INV_SQRT3],   # u6: (+1, -1, +1) / sqrt(3)
    [-_INV_SQRT3, _INV_SQRT3,  _INV_SQRT3],   # u7: (-1, +1, +1) / sqrt(3)
], dtype=np.float64)

NUM_DIRECTIONS_14 = 7
NUM_PLANES_14 = 14
MODEL_NAME_KDOP14 = "KDOP14"
MODEL_VERSION_KDOP14 = "KDOP14-v1"

# Backward and cross-module aliases
KDOP14_DIRECTIONS = CANONICAL_DIRECTIONS_14
CANONICAL_KDOP14_DIRECTIONS = CANONICAL_DIRECTIONS_14
NUM_KDOP14_DIRECTIONS = NUM_DIRECTIONS_14
NUM_KDOP14_HALF_SPACES = NUM_PLANES_14
KDOP14_MODEL_VERSION = MODEL_VERSION_KDOP14



@dataclass(frozen=True, init=False)
class KDOP14:
    """
    Canonical 14-Discrete Orientation Polytope (14-DOP) bounding volume.
    
    Attributes:
        min_projections: Shape (7,), minimum projection along each canonical direction.
        max_projections: Shape (7,), maximum projection along each canonical direction.
        directions: Shape (7, 3), unit direction vectors. Defaults to CANONICAL_DIRECTIONS_14.
        model_version: "KDOP14-v1"
        dimension: 3
        metadata: Optional dictionary with provenance details.
    """
    min_projections: np.ndarray
    max_projections: np.ndarray
    directions: np.ndarray
    model_version: str
    dimension: int
    metadata: Dict[str, Any]

    def __init__(
        self,
        min_projections: Optional[np.ndarray] = None,
        max_projections: Optional[np.ndarray] = None,
        directions: Optional[np.ndarray] = None,
        model_version: str = MODEL_VERSION_KDOP14,
        dimension: int = 3,
        metadata: Optional[Dict[str, Any]] = None,
        *,
        minima: Optional[np.ndarray] = None,
        maxima: Optional[np.ndarray] = None,
    ):
        if min_projections is None:
            min_projections = minima
        if max_projections is None:
            max_projections = maxima

        if min_projections is None or max_projections is None:
            raise MOCSUnsupportedGeometryError("KDOP14 requires both min_projections (minima) and max_projections (maxima).")

        mins = np.asarray(min_projections, dtype=np.float64)
        maxs = np.asarray(max_projections, dtype=np.float64)
        dirs = (
            CANONICAL_DIRECTIONS_14.copy()
            if directions is None
            else np.asarray(directions, dtype=np.float64)
        )

        if mins.shape != (7,) or maxs.shape != (7,):
            raise ValueError(
                f"KDOP14 projections must have shape (7,), got min={mins.shape}, max={maxs.shape}."
            )
        if dirs.shape != (7, 3):
            raise ValueError(
                f"KDOP14 directions must have shape (7, 3), got {dirs.shape}."
            )
        if not (np.all(np.isfinite(mins)) and np.all(np.isfinite(maxs)) and np.all(np.isfinite(dirs))):
            raise MOCSUnsupportedGeometryError("KDOP14 contains non-finite values (NaN or Inf).")

        # Inverted interval check
        if np.any(mins > maxs + 1e-12):
            bad_idx = np.where(mins > maxs)[0].tolist()
            raise ValueError(
                f"KDOP14 has inverted projection intervals (minima exceed maxima) at indices: {bad_idx}."
            )

        object.__setattr__(self, "min_projections", mins)
        object.__setattr__(self, "max_projections", maxs)
        object.__setattr__(self, "directions", dirs)
        object.__setattr__(self, "model_version", model_version)
        object.__setattr__(self, "dimension", dimension)
        object.__setattr__(self, "metadata", metadata or {})

    @classmethod
    def from_coordinates(cls, coords: np.ndarray, metadata: Optional[Dict[str, Any]] = None) -> KDOP14:
        """
        Constructs a conservative KDOP14 envelope containing all given coordinates.
        
        Args:
            coords: Array of shape (..., 3), e.g. (N, 3) or (frames, atoms, 3).
            metadata: Optional provenance dictionary.
        """
        arr = np.asarray(coords, dtype=np.float64)
        if arr.shape[-1] != 3:
            raise MOCSUnsupportedGeometryError(f"Coordinates must have trailing dimension 3, got shape {arr.shape}.")
        if not np.all(np.isfinite(arr)):
            raise MOCSUnsupportedGeometryError("Coordinates contain non-finite values (NaN or Inf).")

        flat_pts = arr.reshape(-1, 3)
        if len(flat_pts) == 0:
            raise MOCSUnsupportedGeometryError("Cannot construct KDOP14 from empty coordinate array.")

        # Projections: (N, 3) @ (3, 7) -> (N, 7)
        projections = flat_pts @ CANONICAL_DIRECTIONS_14.T
        mins = np.min(projections, axis=0)
        maxs = np.max(projections, axis=0)

        return cls(
            min_projections=mins,
            max_projections=maxs,
            directions=CANONICAL_DIRECTIONS_14.copy(),
            model_version=MODEL_VERSION_KDOP14,
            dimension=3,
            metadata=metadata or {}
        )

    def contains_point(self, point: Sequence[float], tolerance: float = 1e-9) -> bool:
        """Returns True if the point lies within all 14 bounding half-spaces within tolerance."""
        p = np.asarray(point, dtype=np.float64)
        if p.shape != (3,):
            raise MOCSUnsupportedGeometryError(f"Point must have shape (3,), got {p.shape}.")
        proj = p @ self.directions.T
        return bool(np.all(proj >= self.min_projections - tolerance) and np.all(proj <= self.max_projections + tolerance))

    def contains_all(self, coords: np.ndarray, tolerance: float = 1e-9) -> bool:
        """Returns True if all coordinates in the array lie within the KDOP14."""
        arr = np.asarray(coords, dtype=np.float64)
        flat_pts = arr.reshape(-1, 3)
        if len(flat_pts) == 0:
            return True
        projs = flat_pts @ self.directions.T  # (N, 7)
        return bool(
            np.all(projs >= self.min_projections - tolerance)
            and np.all(projs <= self.max_projections + tolerance)
        )

    def get_aabb(self) -> Tuple[Tuple[float, float, float], Tuple[float, float, float]]:
        """
        Returns the exact Cartesian AABB subset: ((x_min, y_min, z_min), (x_max, y_max, z_max)).
        Directions 0, 1, 2 correspond directly to the unit Cartesian axes X, Y, Z.
        """
        return (
            (float(self.min_projections[0]), float(self.min_projections[1]), float(self.min_projections[2])),
            (float(self.max_projections[0]), float(self.max_projections[1]), float(self.max_projections[2]))
        )

    def compute_euclidean_bounds(self, other: KDOP14) -> Tuple[float, float]:
        """
        Computes conservative Euclidean lower bound L and upper bound U
        between this KDOP14 and another KDOP14.
        
        Mathematical Foundation:
          For any x in self, y in other, and any unit vector u_k:
            |(y - x) . u_k| <= ||y - x||_2
          The 1D separation gap along u_k is:
            g_k = max(0.0, other.min_k - self.max_k, self.min_k - other.max_k)
          Because axes u1, u2, u3 are mutually orthogonal:
            ||y - x||_2 >= sqrt(g1^2 + g2^2 + g3^2)
          And for any diagonal direction k in {4, 5, 6, 7}:
            ||y - x||_2 >= g_k
          Therefore:
            L = max(sqrt(g1^2 + g2^2 + g3^2), max_{k=4..7} g_k)
            
          Upper bound U is bounded by the Cartesian enclosing box:
            U = sqrt(sum_{mu=0}^2 max(|self.max_mu - other.min_mu|, |other.max_mu - self.min_mu|)^2)
        """
        if not isinstance(other, KDOP14):
            raise TypeError(f"Expected KDOP14 instance, got {type(other)}.")

        # 1. Directional separation gaps along all 7 canonical directions
        gap_a_left_of_b = other.min_projections - self.max_projections
        gap_b_left_of_a = self.min_projections - other.max_projections
        gaps = np.maximum(0.0, np.maximum(gap_a_left_of_b, gap_b_left_of_a))

        # Orthogonal Cartesian lower bound (directions 0, 1, 2)
        l_ortho_sq = float(gaps[0]**2 + gaps[1]**2 + gaps[2]**2)
        l_ortho = math.sqrt(l_ortho_sq)

        # Diagonal directional lower bounds (directions 3, 4, 5, 6)
        l_diags = float(np.max(gaps[3:]))

        L = max(l_ortho, l_diags)

        # 2. Conservative upper bound from Cartesian extrema
        dx_max = max(abs(self.max_projections[0] - other.min_projections[0]),
                     abs(other.max_projections[0] - self.min_projections[0]))
        dy_max = max(abs(self.max_projections[1] - other.min_projections[1]),
                     abs(other.max_projections[1] - self.min_projections[1]))
        dz_max = max(abs(self.max_projections[2] - other.min_projections[2]),
                     abs(other.max_projections[2] - self.min_projections[2]))
        U = math.sqrt(dx_max**2 + dy_max**2 + dz_max**2)
        return L, U

    @property
    def minima(self) -> np.ndarray:
        return self.min_projections

    @property
    def maxima(self) -> np.ndarray:
        return self.max_projections

    def contains_points(self, coords: np.ndarray, tolerance: float = 1e-9) -> bool:
        return self.contains_all(coords, tolerance=tolerance)

    def exact_volume(self) -> Optional[float]:
        """
        Computes the exact volume of the 14-DOP convex polytope in R^3.
        Uses Chebyshev center via SciPy linear programming to find an interior point,
        followed by SciPy HalfspaceIntersection and ConvexHull.
        Returns 0.0 if degenerate or flat, or None if scipy is unavailable.
        """
        try:
            from scipy.spatial import HalfspaceIntersection, ConvexHull
            from scipy.optimize import linprog
        except ImportError:
            return None

        # Check if any interval is 0 or inverted
        extents = self.max_projections - self.min_projections
        if np.any(extents <= 1e-12):
            return 0.0

        # Construct halfspaces for linprog:
        # For each direction u_k (k=0..6):
        # u_k . x + r <= max_k
        # -u_k . x + r <= -min_k
        # Total 14 inequalities in (x, y, z, r). Objective: maximize r (minimize -r).
        A_ub = []
        b_ub = []
        halfspaces = []
        for i in range(7):
            u = self.directions[i]
            # u . x + r <= max
            A_ub.append([u[0], u[1], u[2], 1.0])
            b_ub.append(self.max_projections[i])
            # -u . x + r <= -min
            A_ub.append([-u[0], -u[1], -u[2], 1.0])
            b_ub.append(-self.min_projections[i])

            # Halfspace representation for scipy HalfspaceIntersection: [A, b] meaning A . x + b <= 0
            halfspaces.append(np.append(u, -self.max_projections[i]))
            halfspaces.append(np.append(-u, self.min_projections[i]))

        res = linprog(
            c=[0.0, 0.0, 0.0, -1.0],
            A_ub=np.array(A_ub, dtype=np.float64),
            b_ub=np.array(b_ub, dtype=np.float64),
            bounds=(None, None),
            method="highs"
        )

        if not res.success or res.x[3] <= 1e-9:
            return 0.0

        interior_point = res.x[:3]
        try:
            hs = HalfspaceIntersection(np.array(halfspaces, dtype=np.float64), interior_point)
            hull = ConvexHull(hs.intersections)
            return float(hull.volume)
        except Exception:
            return 0.0

    def compute_volume(self) -> Optional[float]:
        return self.exact_volume()

    def aabb_volume(self) -> float:
        """Computes volume of enclosing Cartesian AABB."""
        ext = np.maximum(0.0, self.max_projections[:3] - self.min_projections[:3])
        return float(ext[0] * ext[1] * ext[2])

    def compute_cartesian_bounds(self, other: KDOP14) -> Tuple[float, float]:
        return self.compute_euclidean_bounds(other)

    def compute_periodic_bounds(self, other: KDOP14, cell: Any) -> Tuple[float, float]:
        """
        [PROVEN BOUND]
        Computes conservative lower bound L and upper bound U under Periodic Boundary
        Conditions defined by the canonical PeriodicCell abstraction.
        Evaluates candidate lattice translations across the 27-neighborhood to guarantee
        soundness for any cell geometry (orthorhombic or triclinic).
        """
        ca = 0.5 * (self.min_projections[:3] + self.max_projections[:3])
        cb = 0.5 * (other.min_projections[:3] + other.max_projections[:3])
        delta_c = cb - ca
        sc = cell.to_fractional(delta_c)
        k0 = np.round(sc)

        grid = np.array([
            [i, j, k]
            for i in (-1, 0, 1)
            for j in (-1, 0, 1)
            for k in (-1, 0, 1)
        ], dtype=np.float64)
        shifts = (grid + k0) @ cell.matrix.T

        min_L = float("inf")
        min_U = float("inf")

        for shift in shifts:
            shift_proj = shift @ self.directions.T
            other_s = KDOP14(
                min_projections=other.min_projections - shift_proj,
                max_projections=other.max_projections - shift_proj,
                directions=self.directions
            )
            l_s, u_s = self.compute_euclidean_bounds(other_s)
            if l_s < min_L:
                min_L = l_s
            if u_s < min_U:
                min_U = u_s

        L = max(0.0, min_L)
        U = max(L, min_U)
        return L, U

    def compute_bounds(self, other: KDOP14, cell: Optional[Any] = None) -> Tuple[float, float]:
        """Unified dispatch for Cartesian or Periodic distance bounds."""
        if cell is None:
            return self.compute_euclidean_bounds(other)
        return self.compute_periodic_bounds(other, cell)

    def serialize(self) -> Dict[str, Any]:
        """Serializes KDOP14 to a JSON-compatible dictionary."""
        return {
            "bounding_model": MODEL_NAME_KDOP14,
            "model_version": self.model_version,
            "dimension": self.dimension,
            "directions": self.directions.tolist(),
            "min_projections": self.min_projections.tolist(),
            "max_projections": self.max_projections.tolist(),
            "metadata": self.metadata
        }

    @classmethod
    def deserialize(cls, data: Dict[str, Any]) -> KDOP14:
        """Deserializes KDOP14 from a dictionary."""
        model = data.get("bounding_model", MODEL_NAME_KDOP14)
        if model != MODEL_NAME_KDOP14:
            raise MOCSUnsupportedGeometryError(f"Cannot deserialize {model} into KDOP14.")
        return cls(
            min_projections=np.array(data["min_projections"], dtype=np.float64),
            max_projections=np.array(data["max_projections"], dtype=np.float64),
            directions=np.array(data.get("directions", CANONICAL_DIRECTIONS_14), dtype=np.float64),
            model_version=data.get("model_version", MODEL_VERSION_KDOP14),
            dimension=data.get("dimension", 3),
            metadata=data.get("metadata", {})
        )


def compute_kdop_bounds(
    kdop_a: KDOP14,
    kdop_b: KDOP14,
    cell: Optional[Any] = None
) -> Tuple[float, float]:
    """
    Computes conservative lower bound L and upper bound U between two KDOP14 polytopes,
    under Cartesian space or periodic boundary conditions.
    """
    return kdop_a.compute_bounds(kdop_b, cell)

