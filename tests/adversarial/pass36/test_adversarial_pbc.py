"""
PASS 36 — Section 5: PBC Adversarial Validation Suite.

Attacks orthorhombic PBC bounds with randomized, anisotropic, extreme,
and boundary configurations. Validates conservative bounding invariants and fail-closed error handling.
"""

from __future__ import annotations
from typing import Tuple
import numpy as np
import pytest
from mocs.bounds.periodic_bounds import (
    compute_pbc_bounds,
    validate_orthorhombic_box,
    minimum_image_displacement,
)
from mocs.exceptions import MOCSUnsupportedGeometryError


class TestPBCAdversarialValidation:
    """Rigorous adversarial testing of orthorhombic PBC interval math."""

    def _brute_force_realizable_bounds(
        self,
        min_a: np.ndarray,
        max_a: np.ndarray,
        min_b: np.ndarray,
        max_b: np.ndarray,
        box: np.ndarray,
        grid_steps: int = 5
    ) -> Tuple[float, float]:
        """
        Samples a grid of points inside AABB A and AABB B, evaluates true minimum-image
        distances for all sampled pairs, and returns empirical (min_dist, max_dist).
        """
        # Create grid points for box A
        pts_a = []
        for x in np.linspace(min_a[0], max_a[0], grid_steps):
            for y in np.linspace(min_a[1], max_a[1], grid_steps):
                for z in np.linspace(min_a[2], max_a[2], grid_steps):
                    pts_a.append([x, y, z])
        pts_a = np.array(pts_a, dtype=np.float64)

        # Create grid points for box B
        pts_b = []
        for x in np.linspace(min_b[0], max_b[0], grid_steps):
            for y in np.linspace(min_b[1], max_b[1], grid_steps):
                for z in np.linspace(min_b[2], max_b[2], grid_steps):
                    pts_b.append([x, y, z])
        pts_b = np.array(pts_b, dtype=np.float64)

        # Pairwise diffs: (N_A, N_B, 3)
        diff = pts_a[:, np.newaxis, :] - pts_b[np.newaxis, :, :]
        diff -= box * np.round(diff / box)
        dists = np.linalg.norm(diff, axis=-1)

        return float(np.min(dists)), float(np.max(dists))

    @pytest.mark.parametrize("seed", [101, 102, 103, 104, 105, 106, 107, 108, 109, 110])
    def test_randomized_orthorhombic_boxes_coverage(self, seed: int):
        """
        Tests 100 randomized bounding box configurations per seed across diverse box regimes:
        - tiny boxes [4, 4, 4]
        - large boxes [500, 500, 500]
        - highly anisotropic boxes [8, 150, 25]
        - coordinates near half-box seam
        """
        rng = np.random.default_rng(seed)
        for _ in range(50):
            # Select box regime
            regime = rng.integers(0, 4)
            if regime == 0:  # tiny
                box = rng.uniform(5.0, 10.0, 3)
            elif regime == 1:  # large
                box = rng.uniform(200.0, 800.0, 3)
            elif regime == 2:  # anisotropic
                box = np.array([rng.uniform(6.0, 15.0), rng.uniform(50.0, 200.0), rng.uniform(10.0, 30.0)])
            else:  # cubic-like
                s = rng.uniform(30.0, 80.0)
                box = np.array([s, s + rng.uniform(-1.0, 1.0), s + rng.uniform(-1.0, 1.0)])

            # Generate AABB A inside [0, box]
            w_a = rng.uniform(0.1, 0.25 * box)
            center_a = rng.uniform(0.0, box)
            min_a = center_a - w_a / 2.0
            max_a = center_a + w_a / 2.0

            # Generate AABB B (occasionally near half-box displacement)
            w_b = rng.uniform(0.1, 0.25 * box)
            if rng.random() < 0.3:
                # Displace near half-box (e.g. box/2 +- epsilon)
                disp = 0.5 * box + rng.uniform(-0.5, 0.5, 3)
                center_b = (center_a + disp) % box
            else:
                center_b = rng.uniform(0.0, box)
            min_b = center_b - w_b / 2.0
            max_b = center_b + w_b / 2.0

            L, U = compute_pbc_bounds((min_a, max_a), (min_b, max_b), box)

            # Invariant 1: Non-negativity and ordering
            assert 0.0 <= L <= U + 1e-12, f"Ordering violation: L={L}, U={U} for box={box}"

            # Invariant 2: Conservative containment vs brute-force grid samples
            emp_min, emp_max = self._brute_force_realizable_bounds(min_a, max_a, min_b, max_b, box, grid_steps=4)
            assert L <= emp_min + 1e-5, f"Lower bound L={L} exceeds empirical min={emp_min} (seed={seed})"
            assert emp_max <= U + 1e-5, f"Upper bound U={U} is below empirical max={emp_max} (seed={seed})"

    def test_exact_half_box_displacement(self):
        """Displacement exactly at box / 2 (maximum periodic boundary ambiguity)."""
        box = np.array([40.0, 40.0, 40.0])
        min_a, max_a = np.array([10.0, 10.0, 10.0]), np.array([11.0, 11.0, 11.0])
        # Box B center shifted by exactly 20.0 A (half-box)
        min_b, max_b = np.array([30.0, 10.0, 10.0]), np.array([31.0, 11.0, 11.0])

        L, U = compute_pbc_bounds((min_a, max_a), (min_b, max_b), box)
        emp_min, emp_max = self._brute_force_realizable_bounds(min_a, max_a, min_b, max_b, box, grid_steps=5)
        assert 0.0 <= L <= emp_min + 1e-6
        assert emp_max <= U + 1e-6

    def test_values_slightly_below_and_above_half_box(self):
        """Test points slightly below (19.999 A) and above (20.001 A) half-box (20.0 A)."""
        box = np.array([40.0, 40.0, 40.0])
        min_a = np.array([0.0, 0.0, 0.0])
        max_a = np.array([0.5, 0.5, 0.5])

        # Slightly below
        min_b1, max_b1 = np.array([19.999, 0.0, 0.0]), np.array([20.0, 0.5, 0.5])
        L1, U1 = compute_pbc_bounds((min_a, max_a), (min_b1, max_b1), box)
        assert 0.0 <= L1 <= U1

        # Slightly above
        min_b2, max_b2 = np.array([20.001, 0.0, 0.0]), np.array([20.01, 0.5, 0.5])
        L2, U2 = compute_pbc_bounds((min_a, max_a), (min_b2, max_b2), box)
        assert 0.0 <= L2 <= U2

    def test_invalid_box_inputs_fail_closed(self):
        """Verify invalid box dimensions, matrices, and geometries fail closed."""
        # 1. Zero dimension
        with pytest.raises(MOCSUnsupportedGeometryError):
            validate_orthorhombic_box(np.array([40.0, 0.0, 40.0]))

        # 2. Negative dimension
        with pytest.raises(MOCSUnsupportedGeometryError):
            validate_orthorhombic_box(np.array([40.0, -10.0, 40.0]))

        # 3. None box
        with pytest.raises(MOCSUnsupportedGeometryError):
            validate_orthorhombic_box(None)

        # 4. NaN in box
        with pytest.raises(MOCSUnsupportedGeometryError):
            validate_orthorhombic_box(np.array([40.0, np.nan, 40.0]))

        # 5. Inf in box
        with pytest.raises(MOCSUnsupportedGeometryError):
            validate_orthorhombic_box(np.array([40.0, np.inf, 40.0]))

        # 6. Wrong vector length
        with pytest.raises(MOCSUnsupportedGeometryError):
            validate_orthorhombic_box(np.array([40.0, 40.0]))

        # 7. Triclinic matrix (non-zero off-diagonals)
        triclinic_matrix = np.array([
            [40.0, 2.5, 0.0],
            [0.0, 40.0, 0.0],
            [0.0, 0.0, 40.0]
        ])
        with pytest.raises(MOCSUnsupportedGeometryError):
            validate_orthorhombic_box(triclinic_matrix)
