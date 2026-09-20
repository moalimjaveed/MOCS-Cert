"""
Canonical General Periodic-Cell Geometry Engine.

Supports:
- Orthorhombic cells (fast path preserved)
- Skewed and general static triclinic cells (GROMACS reduced, rhombic dodecahedra, truncated octahedra)
- Unit-cell transformations (fractional <-> cartesian, wrapping)
- Sound 27-neighborhood candidate lattice search for triclinic minimum-image convention
- Conservative AABB spatial bounding under general PBC
- Dynamic / fluctuating unit cell support (NPT)
"""

from __future__ import annotations

import math
from typing import Any, Sequence, Tuple, Union
import numpy as np

from mocs.exceptions import MOCSUnsupportedGeometryError


# Canonical 27 grid shifts n in {-1, 0, 1}^3
_GRID_27 = np.array(
    np.meshgrid([-1, 0, 1], [-1, 0, 1], [-1, 0, 1], indexing="ij")
).reshape(3, -1).T  # Shape: (27, 3), int64


class PeriodicCell:
    """
    Represents a 3D periodic simulation cell defined by three lattice vectors a, b, c.
    
    Matrix Convention:
      H = [a, b, c] in R^{3 x 3} where a, b, c are column vectors.
      r = H s, where s in R^3 is fractional coordinates.
      s = H^{-1} r.
      
    Row Vectors:
      V = H.T in R^{3 x 3}, where V[0]=a, V[1]=b, V[2]=c.
    """

    __slots__ = (
        "_matrix",
        "_inv_matrix",
        "_vectors",
        "_lengths",
        "_angles",
        "_volume",
        "_is_orthorhombic",
        "_is_reduced",
        "_shifts_27",
    )

    def __init__(self, matrix: np.ndarray) -> None:
        """
        Initializes a PeriodicCell from a 3x3 column matrix H = [a, b, c].
        """
        if matrix is None:
            raise MOCSUnsupportedGeometryError("Simulation cell matrix cannot be None.")

        arr = np.asarray(matrix, dtype=np.float64)
        if arr.shape != (3, 3):
            raise MOCSUnsupportedGeometryError(
                f"Simulation cell matrix must have shape (3, 3), got {arr.shape}."
            )
        if not np.all(np.isfinite(arr)):
            raise MOCSUnsupportedGeometryError(
                f"Simulation cell contains non-finite values (NaN/Inf): {arr}"
            )

        # Lattice vectors as columns: a = arr[:, 0], b = arr[:, 1], c = arr[:, 2]
        a = arr[:, 0]
        b = arr[:, 1]
        c = arr[:, 2]

        la = float(np.linalg.norm(a))
        lb = float(np.linalg.norm(b))
        lc = float(np.linalg.norm(c))

        if la <= 1e-12 or lb <= 1e-12 or lc <= 1e-12:
            raise MOCSUnsupportedGeometryError(
                f"Simulation cell has degenerate or zero-length lattice vectors: lengths=({la}, {lb}, {lc})."
            )

        # Volume / determinant check
        det = float(np.linalg.det(arr))
        if det <= 1e-12:
            raise MOCSUnsupportedGeometryError(
                f"Simulation cell determinant must be strictly positive (> 0.0), got {det:.6e}."
            )

        # Invertibility and condition number
        cond = float(np.linalg.cond(arr))
        if cond > 1e12 or not math.isfinite(cond):
            raise MOCSUnsupportedGeometryError(
                f"Simulation cell is near-singular or degenerate (condition number = {cond:.2e} > 1e12)."
            )

        inv_mat = np.linalg.inv(arr)

        # Angles in degrees: alpha = angle(b, c), beta = angle(a, c), gamma = angle(a, b)
        cos_alpha = np.clip(np.dot(b, c) / (lb * lc), -1.0, 1.0)
        cos_beta = np.clip(np.dot(a, c) / (la * lc), -1.0, 1.0)
        cos_gamma = np.clip(np.dot(a, b) / (la * lb), -1.0, 1.0)

        alpha = float(np.degrees(np.arccos(cos_alpha)))
        beta = float(np.degrees(np.arccos(cos_beta)))
        gamma = float(np.degrees(np.arccos(cos_gamma)))

        if alpha <= 0.0 or alpha >= 180.0 or beta <= 0.0 or beta >= 180.0 or gamma <= 0.0 or gamma >= 180.0:
            raise MOCSUnsupportedGeometryError(
                f"Simulation cell angles must lie strictly between 0 and 180 degrees, got ({alpha}, {beta}, {gamma})."
            )

        # Check orthorhombic: angles == 90 deg within 1e-3 and off-diagonals |H_ij| <= 1e-6
        is_ortho = (
            abs(alpha - 90.0) <= 1e-3
            and abs(beta - 90.0) <= 1e-3
            and abs(gamma - 90.0) <= 1e-3
        )
        if is_ortho:
            # Check off-diagonal elements in H
            off_diag_mask = ~np.eye(3, dtype=bool)
            if np.any(np.abs(arr[off_diag_mask]) > 1e-6):
                is_ortho = False

        # Check GROMACS/Niggli reduced convention
        # |b_x| <= a_x / 2, |c_x| <= a_x / 2, |c_y| <= b_y / 2
        is_red = True
        if arr[0, 0] > 0:
            if abs(arr[0, 1]) > 0.5 * arr[0, 0] + 1e-6 or abs(arr[0, 2]) > 0.5 * arr[0, 0] + 1e-6:
                is_red = False
        if arr[1, 1] > 0:
            if abs(arr[1, 2]) > 0.5 * arr[1, 1] + 1e-6:
                is_red = False

        # Volume
        volume = float(la * lb * lc) if is_ortho else det

        # Precompute 27 shifts in Cartesian coordinates: n @ H.T -> shape (27, 3)
        shifts_27 = _GRID_27.astype(np.float64) @ arr.T

        self._matrix = arr
        self._inv_matrix = inv_mat
        self._vectors = arr.T  # rows are a, b, c
        self._lengths = np.array([la, lb, lc], dtype=np.float64)
        self._angles = np.array([alpha, beta, gamma], dtype=np.float64)
        self._volume = volume
        self._is_orthorhombic = is_ortho
        self._is_reduced = is_red
        self._shifts_27 = shifts_27

        if not is_ortho and not is_red:
            raise MOCSUnsupportedGeometryError(
                "Non-reduced triclinic cell: the 27-neighborhood minimum-image search is only "
                "exact for GROMACS/Niggli-reduced cells. Reduce the cell before indexing."
            )

    # -------------------------------------------------------------------------
    # Factories
    # -------------------------------------------------------------------------

    @classmethod
    def from_matrix(cls, matrix: np.ndarray) -> "PeriodicCell":
        """Constructs a PeriodicCell from column matrix H = [a, b, c]."""
        return cls(matrix)

    @classmethod
    def from_vectors(cls, vectors: np.ndarray) -> "PeriodicCell":
        """
        Constructs a PeriodicCell from a (3, 3) array where rows are lattice vectors a, b, c.
        H = vectors.T.
        """
        arr = np.asarray(vectors, dtype=np.float64)
        if arr.shape != (3, 3):
            raise MOCSUnsupportedGeometryError(
                f"Lattice vectors array must have shape (3, 3), got {arr.shape}."
            )
        return cls(arr.T)

    @classmethod
    def from_dimensions(cls, dims: Union[Sequence[float], np.ndarray]) -> "PeriodicCell":
        """
        Constructs a PeriodicCell from dimensions:
        - length 3: [lx, ly, lz] (orthorhombic)
        - length 6: [lx, ly, lz, alpha, beta, gamma] (degrees)
        - shape (3, 3): treated as box matrix/vectors
        """
        if dims is None:
            raise MOCSUnsupportedGeometryError("Box dimensions cannot be None.")

        arr = np.asarray(dims, dtype=np.float64)
        if not np.all(np.isfinite(arr)):
            raise MOCSUnsupportedGeometryError(f"Box dimensions contain non-finite values: {arr}")

        if arr.ndim == 2 and arr.shape == (3, 3):
            return cls.from_vectors(arr)

        if arr.ndim != 1:
            raise MOCSUnsupportedGeometryError(
                f"Box dimensions must be 1D or 2D (3x3), got {arr.ndim}D."
            )

        if arr.shape[0] == 3:
            lx, ly, lz = arr
            if lx <= 0.0 or ly <= 0.0 or lz <= 0.0:
                raise MOCSUnsupportedGeometryError(
                    f"Orthorhombic box dimensions must be strictly positive, got [{lx}, {ly}, {lz}]."
                )
            matrix = np.diag([lx, ly, lz])
            return cls(matrix)

        if arr.shape[0] == 6:
            lx, ly, lz, alpha, beta, gamma = arr
            if lx <= 0.0 or ly <= 0.0 or lz <= 0.0:
                raise MOCSUnsupportedGeometryError(
                    f"Box lengths must be strictly positive, got [{lx}, {ly}, {lz}]."
                )

            # Check if orthorhombic
            if (
                abs(alpha - 90.0) <= 1e-3
                and abs(beta - 90.0) <= 1e-3
                and abs(gamma - 90.0) <= 1e-3
            ):
                return cls(np.diag([lx, ly, lz]))

            # Standard crystallographic / GROMACS alignment:
            # a is along x-axis
            # b is in xy-plane
            # c completes the right-handed basis
            alpha_r = math.radians(alpha)
            beta_r = math.radians(beta)
            gamma_r = math.radians(gamma)

            sin_gamma = math.sin(gamma_r)
            if abs(sin_gamma) < 1e-12:
                raise MOCSUnsupportedGeometryError(
                    f"Collinear cell basis: gamma={gamma} degrees."
                )

            ax = lx
            ay = 0.0
            az = 0.0

            bx = ly * math.cos(gamma_r)
            by = ly * sin_gamma
            bz = 0.0

            cx = lz * math.cos(beta_r)
            cy = lz * (math.cos(alpha_r) - math.cos(beta_r) * math.cos(gamma_r)) / sin_gamma
            cz_sq = lz**2 - cx**2 - cy**2
            if cz_sq < 0.0:
                raise MOCSUnsupportedGeometryError(
                    f"Invalid triclinic angles: cannot embed in 3D Euclidean space: cz^2 = {cz_sq:.6e}."
                )
            cz = math.sqrt(max(0.0, cz_sq))

            # Column matrix H = [a, b, c]
            matrix = np.array([
                [ax, bx, cx],
                [ay, by, cy],
                [az, bz, cz],
            ], dtype=np.float64)

            return cls(matrix)

        raise MOCSUnsupportedGeometryError(
            f"Box dimensions must have length 3, 6, or shape (3, 3), got shape {arr.shape}."
        )

    @classmethod
    def from_lengths_and_angles(
        cls,
        lx: float,
        ly: float,
        lz: float,
        alpha: float = 90.0,
        beta: float = 90.0,
        gamma: float = 90.0,
    ) -> "PeriodicCell":
        """
        Constructs a PeriodicCell from cell lengths and angles in degrees.
        """
        return cls.from_dimensions([lx, ly, lz, alpha, beta, gamma])

    # -------------------------------------------------------------------------
    # Properties
    # -------------------------------------------------------------------------

    @property
    def matrix(self) -> np.ndarray:
        """3x3 column matrix H = [a, b, c]."""
        return self._matrix.copy()

    @property
    def inv_matrix(self) -> np.ndarray:
        """3x3 inverse matrix H^{-1}."""
        return self._inv_matrix.copy()

    @property
    def vectors(self) -> np.ndarray:
        """3x3 matrix where rows are lattice vectors a, b, c (H.T)."""
        return self._vectors.copy()

    @property
    def lengths(self) -> np.ndarray:
        """Lengths of lattice vectors [||a||, ||b||, ||c||]."""
        return self._lengths.copy()

    @property
    def angles(self) -> np.ndarray:
        """Cell angles in degrees [alpha, beta, gamma]."""
        return self._angles.copy()

    @property
    def volume(self) -> float:
        """Simulation cell volume (det(H))."""
        return self._volume

    @property
    def is_orthorhombic(self) -> bool:
        """True if cell is orthorhombic and axis-aligned."""
        return self._is_orthorhombic

    @property
    def is_reduced(self) -> bool:
        """True if cell satisfies GROMACS / Niggli reduced conventions."""
        return self._is_reduced

    @property
    def cell_type(self) -> str:
        """'orthorhombic' or 'triclinic'."""
        return "orthorhombic" if self._is_orthorhombic else "triclinic"

    @property
    def dimensions(self) -> np.ndarray:
        """Returns 6-element array [lx, ly, lz, alpha, beta, gamma]."""
        return np.concatenate([self._lengths, self._angles])

    # -------------------------------------------------------------------------
    # Coordinate Transformations
    # -------------------------------------------------------------------------

    def to_fractional(self, cartesian: np.ndarray) -> np.ndarray:
        """
        Converts Cartesian coordinates to fractional coordinates: s = H^{-1} r.
        Supports (3,) or (..., 3) shapes.
        """
        arr = np.asarray(cartesian, dtype=np.float64)
        return arr @ self._inv_matrix.T

    def to_cartesian(self, fractional: np.ndarray) -> np.ndarray:
        """
        Converts fractional coordinates to Cartesian coordinates: r = H s.
        Supports (3,) or (..., 3) shapes.
        """
        arr = np.asarray(fractional, dtype=np.float64)
        return arr @ self._matrix.T

    def wrap_to_cell(self, cartesian: np.ndarray) -> np.ndarray:
        """
        Wraps Cartesian coordinates into the primary cell [0, 1)^3 fractional volume.
        """
        s = self.to_fractional(cartesian)
        s_wrapped = s - np.floor(s)
        return self.to_cartesian(s_wrapped)

    # -------------------------------------------------------------------------
    # Minimum-Image Convention
    # -------------------------------------------------------------------------

    def minimum_image_displacement(self, delta: np.ndarray) -> np.ndarray:
        """
        Computes the minimum-image displacement vector delta_mic for delta = r_b - r_a.
        Supports 1D (3,) or 2D (N, 3) arrays.
        
        Guarantees:
        - Exact agreement with minimum lattice distance
        - Zero distortion on orthorhombic fast path
        - Deterministic canonical tie-breaking
        """
        arr = np.asarray(delta, dtype=np.float64)
        is_1d = (arr.ndim == 1)
        if is_1d:
            if arr.shape != (3,):
                raise MOCSUnsupportedGeometryError(f"Displacement vector must have shape (3,), got {arr.shape}.")
            pts = arr.reshape(1, 3)
        elif arr.ndim == 2:
            if arr.shape[1] != 3:
                raise MOCSUnsupportedGeometryError(f"Displacement array must have shape (N, 3), got {arr.shape}.")
            pts = arr
        else:
            raise MOCSUnsupportedGeometryError(f"Displacement array must be 1D or 2D, got {arr.ndim}D.")

        if not np.all(np.isfinite(pts)):
            raise MOCSUnsupportedGeometryError("Displacement contains non-finite values (NaN or Inf).")

        if self._is_orthorhombic:
            # Fast orthorhombic path: delta - L * round(delta / L)
            box_diag = self._lengths
            res = pts - box_diag * np.round(pts / box_diag)
            return res[0] if is_1d else res

        # Triclinic general path: 27-neighborhood search around fractional center
        s = pts @ self._inv_matrix.T
        s0 = s - np.round(s)
        delta0 = s0 @ self._matrix.T  # Shape: (N, 3)

        # Candidate displacements: delta0[:, None, :] + shifts_27[None, :, :]
        # Shape: (N, 27, 3)
        candidates = delta0[:, np.newaxis, :] + self._shifts_27[np.newaxis, :, :]
        dists_sq = np.sum(candidates**2, axis=-1)  # Shape: (N, 27)
        best_indices = np.argmin(dists_sq, axis=1)  # Shape: (N,)

        res = candidates[np.arange(len(pts)), best_indices]
        return res[0] if is_1d else res

    def minimum_image_distance(self, delta: np.ndarray) -> Union[float, np.ndarray]:
        """Computes Euclidean norm of minimum-image displacement."""
        mic = self.minimum_image_displacement(delta)
        if mic.ndim == 1:
            return float(np.linalg.norm(mic))
        return np.linalg.norm(mic, axis=-1)

    # -------------------------------------------------------------------------
    # Conservative Spatial AABB Bounding
    # -------------------------------------------------------------------------

    def compute_aabb_bounds(
        self,
        aabb_a: Tuple[np.ndarray, np.ndarray],
        aabb_b: Tuple[np.ndarray, np.ndarray],
    ) -> Tuple[float, float]:
        """
        [PROVEN MATHEMATICAL BOUND]
        Computes conservative lower bound L and upper bound U for the Euclidean
        distance between two atomic AABBs under periodic boundary conditions.
        
        Guarantees:
          For any p_a in AABB_a, p_b in AABB_b:
            L <= d_MIC(p_a, p_b) <= U
        """
        a_min = np.asarray(aabb_a[0], dtype=np.float64)
        a_max = np.asarray(aabb_a[1], dtype=np.float64)
        b_min = np.asarray(aabb_b[0], dtype=np.float64)
        b_max = np.asarray(aabb_b[1], dtype=np.float64)

        if not (
            np.all(np.isfinite(a_min))
            and np.all(np.isfinite(a_max))
            and np.all(np.isfinite(b_min))
            and np.all(np.isfinite(b_max))
        ):
            raise MOCSUnsupportedGeometryError("AABB coordinates contain non-finite values (NaN or Inf).")

        if self._is_orthorhombic:
            # Fast orthorhombic closed-form path
            box_diag = self._lengths
            dx_min_sq, dy_min_sq, dz_min_sq = 0.0, 0.0, 0.0
            dx_max_sq, dy_max_sq, dz_max_sq = 0.0, 0.0, 0.0

            for mu in range(3):
                L_mu = box_diag[mu]
                c_a = 0.5 * (a_min[mu] + a_max[mu])
                c_b = 0.5 * (b_min[mu] + b_max[mu])
                delta_c = c_b - c_a
                delta_c -= L_mu * np.round(delta_c / L_mu)

                r_a = 0.5 * (a_max[mu] - a_min[mu])
                r_b = 0.5 * (b_max[mu] - b_min[mu])
                r_sum = r_a + r_b

                d_mu_min = max(0.0, abs(delta_c) - r_sum)
                d_mu_max = min(0.5 * L_mu, abs(delta_c) + r_sum)

                if mu == 0:
                    dx_min_sq, dx_max_sq = d_mu_min**2, d_mu_max**2
                elif mu == 1:
                    dy_min_sq, dy_max_sq = d_mu_min**2, d_mu_max**2
                else:
                    dz_min_sq, dz_max_sq = d_mu_min**2, d_mu_max**2

            L = math.sqrt(dx_min_sq + dy_min_sq + dz_min_sq)
            U = math.sqrt(dx_max_sq + dy_max_sq + dz_max_sq)
            return L, U

        # General Triclinic Bounding Path
        # 1. Center AABB B relative to AABB A in fractional coordinates
        ca = 0.5 * (a_min + a_max)
        cb = 0.5 * (b_min + b_max)
        delta_c = cb - ca
        sc = delta_c @ self._inv_matrix.T
        k0 = np.round(sc)

        # 2. Evaluate all 27 candidate lattice translations around k0
        shifts = (_GRID_27.astype(np.float64) + k0) @ self._matrix.T

        min_d_min = float("inf")
        min_d_max = float("inf")

        for shift in shifts:
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

        L = max(0.0, min_d_min)
        U = max(L, min_d_max)
        return L, U

    def compute_kdop_bounds(
        self,
        kdop_a: Any,
        kdop_b: Any
    ) -> Tuple[float, float]:
        """
        Computes conservative lower bound L and upper bound U for the Euclidean
        distance between two atomic KDOP14 polytopes under periodic boundary conditions.
        """
        return kdop_a.compute_bounds(kdop_b, self)

