"""
Independent Reference Oracle for Triclinic / General Periodic-Cell Geometry.

CRITICAL ASSURANCE:
This module contains ZERO imports from `mocs` or `backend`.
It is an independent mathematical ground truth implementing exhaustive
brute-force lattice searches over large candidate translation grids
(k >= 2, i.e., 125 or 343 candidate translations) to verify production code.
"""

from __future__ import annotations

import math
from typing import Sequence, Tuple, Union
import numpy as np


class TriclinicReferenceOracle:
    """
    Independent, brute-force oracle for periodic boundary conditions.
    Does NOT use any production MOCS code.
    """

    def __init__(self, dimensions: Union[Sequence[float], np.ndarray], search_k: int = 2) -> None:
        """
        Initializes oracle with dimensions [lx, ly, lz, alpha, beta, gamma] (or 3-element [lx, ly, lz]).
        search_k defines the lattice search neighborhood: n in {-search_k, ..., +search_k}^3.
        search_k=2 gives 5^3 = 125 shifts.
        search_k=3 gives 7^3 = 343 shifts.
        """
        arr = np.asarray(dimensions, dtype=np.float64)
        if arr.ndim == 1 and arr.shape[0] == 3:
            lx, ly, lz = arr
            alpha = beta = gamma = 90.0
        elif arr.ndim == 1 and arr.shape[0] == 6:
            lx, ly, lz, alpha, beta, gamma = arr
        elif arr.ndim == 2 and arr.shape == (3, 3):
            # Treat rows as lattice vectors
            self.vectors = arr.copy()
            self.matrix = arr.T.copy()  # columns are a, b, c
            self.inv_matrix = np.linalg.inv(self.matrix)
            self._init_shifts(search_k)
            return
        else:
            raise ValueError(f"Invalid dimensions shape: {arr.shape}")

        # Construct lattice vectors from crystallographic dimensions
        a_rad = math.radians(alpha)
        b_rad = math.radians(beta)
        g_rad = math.radians(gamma)
        sin_g = math.sin(g_rad)

        ax, ay, az = lx, 0.0, 0.0
        bx, by, bz = ly * math.cos(g_rad), ly * sin_g, 0.0
        cx = lz * math.cos(b_rad)
        cy = lz * (math.cos(a_rad) - math.cos(b_rad) * math.cos(g_rad)) / sin_g
        cz = math.sqrt(max(0.0, lz**2 - cx**2 - cy**2))

        # Rows are a, b, c
        self.vectors = np.array([
            [ax, ay, az],
            [bx, by, bz],
            [cx, cy, cz]
        ], dtype=np.float64)

        # Matrix has a, b, c as columns
        self.matrix = self.vectors.T
        self.inv_matrix = np.linalg.inv(self.matrix)
        self._init_shifts(search_k)

    def _init_shifts(self, search_k: int) -> None:
        self.search_k = search_k
        r = list(range(-search_k, search_k + 1))
        grid = np.array(np.meshgrid(r, r, r, indexing="ij")).reshape(3, -1).T
        self.grid = grid  # (N_shifts, 3)
        self.shifts = grid @ self.vectors  # (N_shifts, 3) Cartesian translation vectors

    def to_fractional(self, r: np.ndarray) -> np.ndarray:
        return np.asarray(r, dtype=np.float64) @ self.inv_matrix.T

    def to_cartesian(self, s: np.ndarray) -> np.ndarray:
        return np.asarray(s, dtype=np.float64) @ self.matrix.T

    def minimum_image_displacement(self, delta: np.ndarray) -> np.ndarray:
        """
        Brute-force minimum image displacement searching across all (2k+1)^3 lattice shifts.
        """
        d = np.asarray(delta, dtype=np.float64)
        is_1d = (d.ndim == 1)
        pts = d.reshape(1, 3) if is_1d else d

        s = pts @ self.inv_matrix.T
        s0 = s - np.round(s)
        d0 = s0 @ self.matrix.T

        # candidates: (N, num_shifts, 3)
        candidates = d0[:, np.newaxis, :] + self.shifts[np.newaxis, :, :]
        dists_sq = np.sum(candidates**2, axis=-1)
        best_indices = np.argmin(dists_sq, axis=1)

        res = candidates[np.arange(len(pts)), best_indices]
        return res[0] if is_1d else res

    def minimum_image_distance(self, delta: np.ndarray) -> Union[float, np.ndarray]:
        disp = self.minimum_image_displacement(delta)
        if disp.ndim == 1:
            return float(np.linalg.norm(disp))
        return np.linalg.norm(disp, axis=-1)

    def compute_aabb_bounds(
        self,
        aabb_a: Tuple[np.ndarray, np.ndarray],
        aabb_b: Tuple[np.ndarray, np.ndarray],
    ) -> Tuple[float, float]:
        """
        Computes distance bounds by searching over all (2k+1)^3 shifts around center.
        """
        a_min, a_max = np.asarray(aabb_a[0], dtype=np.float64), np.asarray(aabb_a[1], dtype=np.float64)
        b_min, b_max = np.asarray(aabb_b[0], dtype=np.float64), np.asarray(aabb_b[1], dtype=np.float64)

        ca = 0.5 * (a_min + a_max)
        cb = 0.5 * (b_min + b_max)
        sc = (cb - ca) @ self.inv_matrix.T
        k0 = np.round(sc)

        all_shifts = (self.grid.astype(np.float64) + k0) @ self.vectors

        min_d_min = float("inf")
        min_d_max = float("inf")

        for shift in all_shifts:
            b_min_s = b_min - shift
            b_max_s = b_max - shift

            d_min_axis = np.maximum(0.0, np.maximum(a_min - b_max_s, b_min_s - a_max))
            d_min_s = math.sqrt(float(np.sum(d_min_axis**2)))

            d_max_axis = np.maximum(np.abs(a_max - b_min_s), np.abs(b_max_s - a_min))
            d_max_s = math.sqrt(float(np.sum(d_max_axis**2)))

            if d_min_s < min_d_min:
                min_d_min = d_min_s
            if d_max_s < min_d_max:
                min_d_max = d_max_s

        return max(0.0, min_d_min), max(min_d_min, min_d_max)
