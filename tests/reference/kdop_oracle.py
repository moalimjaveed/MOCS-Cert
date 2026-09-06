"""
Standalone Clean-Room 14-DOP Reference Oracle.

CRITICAL ARCHITECTURAL RULE:
This file MUST NOT import from `mocs` or `backend`.
It is an independent reference oracle using pure NumPy / math to verify
the soundness of 14-DOP bounding logic and pairwise distance intervals.
"""

from __future__ import annotations
import math
from typing import Tuple, List, Dict, Any, Optional
import numpy as np

_INV_SQRT3 = 1.0 / math.sqrt(3.0)

# Canonical 7 directions independently declared
ORACLE_DIRECTIONS: np.ndarray = np.array([
    [1.0, 0.0, 0.0],
    [0.0, 1.0, 0.0],
    [0.0, 0.0, 1.0],
    [_INV_SQRT3, _INV_SQRT3, _INV_SQRT3],
    [_INV_SQRT3, _INV_SQRT3, -_INV_SQRT3],
    [_INV_SQRT3, -_INV_SQRT3, _INV_SQRT3],
    [-_INV_SQRT3, _INV_SQRT3, _INV_SQRT3],
], dtype=np.float64)


class PureKDOPOracle:
    """Independent implementation of 14-DOP construction and distance bounding."""

    def __init__(self, minima: np.ndarray, maxima: np.ndarray):
        self.minima = np.asarray(minima, dtype=np.float64)
        self.maxima = np.asarray(maxima, dtype=np.float64)

    @classmethod
    def from_points(cls, points: np.ndarray) -> PureKDOPOracle:
        pts = np.asarray(points, dtype=np.float64).reshape(-1, 3)
        proj = pts @ ORACLE_DIRECTIONS.T
        return cls(minima=np.min(proj, axis=0), maxima=np.max(proj, axis=0))

    def contains_point(self, pt: np.ndarray, tol: float = 1e-7) -> bool:
        p = np.asarray(pt, dtype=np.float64).reshape(3)
        proj = p @ ORACLE_DIRECTIONS.T
        return bool(np.all(proj >= self.minima - tol) and np.all(proj <= self.maxima + tol))

    def compute_cartesian_bounds(self, other: PureKDOPOracle) -> Tuple[float, float]:
        """
        Computes conservative Euclidean bounds [L, U] using independent separation logic.
        """
        # 1D separations along all 7 directions
        sep = np.maximum(0.0, np.maximum(other.minima - self.maxima, self.minima - other.maxima))

        # Cartesian Pythagorean lower bound
        l_cart = math.sqrt(float(sep[0]**2 + sep[1]**2 + sep[2]**2))
        # Diagonal maximum separation
        l_diag = float(np.max(sep[3:]))
        L = max(l_cart, l_diag)

        # Upper bound from AABB corner distances
        u_axes = np.maximum(np.abs(self.maxima[:3] - other.minima[:3]), np.abs(other.maxima[:3] - self.minima[:3]))
        U = math.sqrt(float(np.sum(u_axes**2)))

        return L, U

    def compute_periodic_bounds(
        self,
        other: PureKDOPOracle,
        box_matrix: np.ndarray
    ) -> Tuple[float, float]:
        """
        Computes periodic distance bounds across exhaustive 27 lattice translation candidates.
        box_matrix: 3x3 column basis [a b c]
        """
        ca = 0.5 * (self.minima[:3] + self.maxima[:3])
        cb = 0.5 * (other.minima[:3] + other.maxima[:3])
        delta_c = cb - ca
        inv_box = np.linalg.inv(box_matrix)
        sc = delta_c @ inv_box.T
        k0 = np.round(sc)

        grid = np.array([
            [i, j, k]
            for i in (-1, 0, 1)
            for j in (-1, 0, 1)
            for k in (-1, 0, 1)
        ], dtype=np.float64)
        shifts = (grid + k0) @ box_matrix.T

        min_L = float("inf")
        min_U = float("inf")

        for shift in shifts:
            shift_proj = shift @ ORACLE_DIRECTIONS.T
            other_s = PureKDOPOracle(
                minima=other.minima - shift_proj,
                maxima=other.maxima - shift_proj
            )
            l_s, u_s = self.compute_cartesian_bounds(other_s)
            if l_s < min_L:
                min_L = l_s
            if u_s < min_U:
                min_U = u_s

        return max(0.0, min_L), max(max(0.0, min_L), min_U)


def oracle_exact_distances(
    points_a: np.ndarray,
    points_b: np.ndarray,
    box_matrix: Optional[np.ndarray] = None
) -> Tuple[float, float]:
    """
    Computes exact minimum and maximum pairwise Euclidean distance between point sets.
    If box_matrix is provided, minimizes over lattice translations for each pair.
    """
    pa = np.asarray(points_a, dtype=np.float64).reshape(-1, 3)
    pb = np.asarray(points_b, dtype=np.float64).reshape(-1, 3)

    diff = pb[:, None, :] - pa[None, :, :]  # (N_b, N_a, 3)

    if box_matrix is None:
        dists = np.linalg.norm(diff, axis=-1)
        return float(np.min(dists)), float(np.max(dists))

    # Periodic exact distance
    # Exhaustive 125 shifts around origin
    k_range = (-2, -1, 0, 1, 2)
    grid = np.array([
        [i, j, k]
        for i in k_range
        for j in k_range
        for k in k_range
    ], dtype=np.float64)
    shifts = grid @ box_matrix.T  # (125, 3)

    flat_diff = diff.reshape(-1, 3)  # (N_b * N_a, 3)
    cand_diff = flat_diff[:, None, :] + shifts[None, :, :]  # (N, 125, 3)
    cand_dists = np.linalg.norm(cand_diff, axis=-1)  # (N, 125)
    min_dists = np.min(cand_dists, axis=-1)

    return float(np.min(min_dists)), float(np.max(min_dists))
