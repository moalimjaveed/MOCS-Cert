"""
PASS 47: 14-DOP Soundness & Adversarial Verification Suite.

Validates that KDOP14:
1. Strictly contains all input points.
2. Has normalized canonical directions matching mathematical specification.
3. Produces mathematically conservative lower and upper bounds L <= d_min <= d_max <= U.
4. Correctly integrates with PeriodicCell under orthorhombic and triclinic geometry.
5. Reliably handles multi-atom groups (1x1, 1xN, NxM).
6. Fails closed under adversarial corruption and invalid inputs.
"""

import math
import pytest
import numpy as np

from mocs.bounds.kdop import (
    KDOP14,
    KDOP14_DIRECTIONS,
    NUM_KDOP14_DIRECTIONS,
    NUM_KDOP14_HALF_SPACES,
    KDOP14_MODEL_VERSION
)
from mocs.bounds.periodic_cell import PeriodicCell
from mocs.exceptions import MOCSUnsupportedGeometryError
from tests.reference.kdop_oracle import PureKDOPOracle, oracle_exact_distances


class TestKDOP14Soundness:
    """Rigorous mathematical soundness and containment tests for KDOP14."""

    def test_canonical_directions_properties(self):
        """Validates that all 7 canonical directions are normalized unit vectors."""
        assert KDOP14_DIRECTIONS.shape == (7, 3)
        norms = np.linalg.norm(KDOP14_DIRECTIONS, axis=1)
        np.testing.assert_allclose(norms, 1.0, atol=1e-12, err_msg="All KDOP14 directions must have norm 1.0")

        # First 3 directions must be Cartesian axes
        np.testing.assert_allclose(KDOP14_DIRECTIONS[0], [1, 0, 0])
        np.testing.assert_allclose(KDOP14_DIRECTIONS[1], [0, 1, 0])
        np.testing.assert_allclose(KDOP14_DIRECTIONS[2], [0, 0, 1])

        # Next 4 directions must be space diagonals normalized by 1/sqrt(3)
        inv_sqrt3 = 1.0 / math.sqrt(3.0)
        np.testing.assert_allclose(KDOP14_DIRECTIONS[3], [inv_sqrt3, inv_sqrt3, inv_sqrt3])
        np.testing.assert_allclose(KDOP14_DIRECTIONS[4], [inv_sqrt3, inv_sqrt3, -inv_sqrt3])
        np.testing.assert_allclose(KDOP14_DIRECTIONS[5], [inv_sqrt3, -inv_sqrt3, inv_sqrt3])
        np.testing.assert_allclose(KDOP14_DIRECTIONS[6], [-inv_sqrt3, inv_sqrt3, inv_sqrt3])

    def test_point_containment(self):
        """Validates that all points used to construct a KDOP14 are strictly contained."""
        np.random.seed(42)
        pts = np.random.uniform(-20.0, 20.0, size=(250, 3))
        kdop = KDOP14.from_coordinates(pts)

        assert kdop.contains_points(pts)
        for p in pts:
            assert kdop.contains_point(p)

    def test_cartesian_bounds_soundness_against_oracle(self):
        """
        Tests that for 50 randomized pairs of point clouds in open space,
        L <= d_min <= d_max <= U unconditionally holds.
        """
        np.random.seed(101)
        for i in range(50):
            center_a = np.random.uniform(-30.0, 30.0, size=3)
            center_b = np.random.uniform(-30.0, 30.0, size=3)
            pts_a = center_a + np.random.uniform(-5.0, 5.0, size=(20, 3))
            pts_b = center_b + np.random.uniform(-5.0, 5.0, size=(20, 3))

            kdop_a = KDOP14.from_coordinates(pts_a)
            kdop_b = KDOP14.from_coordinates(pts_b)

            L, U = kdop_a.compute_cartesian_bounds(kdop_b)
            d_min, d_max = oracle_exact_distances(pts_a, pts_b)

            assert L <= d_min + 1e-9, f"Iteration {i}: Soundness violation! L={L} > d_min={d_min}"
            assert d_max <= U + 1e-9, f"Iteration {i}: Soundness violation! d_max={d_max} > U={U}"

    def test_orthorhombic_pbc_bounds_soundness(self):
        """
        Tests KDOP14 distance bounds under orthorhombic PeriodicCell.
        """
        cell = PeriodicCell.from_lengths_and_angles(50.0, 50.0, 50.0, 90.0, 90.0, 90.0)
        np.random.seed(202)

        for i in range(30):
            pts_a = np.random.uniform(5.0, 15.0, size=(15, 3))
            pts_b = np.random.uniform(35.0, 45.0, size=(15, 3))

            kdop_a = KDOP14.from_coordinates(pts_a)
            kdop_b = KDOP14.from_coordinates(pts_b)

            L, U = kdop_a.compute_bounds(kdop_b, cell)
            d_min, d_max = oracle_exact_distances(pts_a, pts_b, cell.matrix)

            assert L <= d_min + 1e-9, f"Ortho iteration {i}: L={L} > d_min={d_min}"
            assert d_max <= U + 1e-9, f"Ortho iteration {i}: d_max={d_max} > U={U}"

    def test_triclinic_pbc_bounds_soundness(self):
        """
        Tests KDOP14 distance bounds under skewed triclinic cell (Rhombic Dodecahedron).
        """
        cell = PeriodicCell.from_lengths_and_angles(60.0, 60.0, 60.0, 60.0, 60.0, 90.0)
        np.random.seed(303)

        for i in range(30):
            pts_a = np.random.uniform(10.0, 20.0, size=(10, 3))
            pts_b = np.random.uniform(30.0, 40.0, size=(10, 3))

            kdop_a = KDOP14.from_coordinates(pts_a)
            kdop_b = KDOP14.from_coordinates(pts_b)

            L, U = kdop_a.compute_bounds(kdop_b, cell)
            d_min, d_max = oracle_exact_distances(pts_a, pts_b, cell.matrix)

            assert L <= d_min + 1e-9, f"Triclinic iteration {i}: L={L} > d_min={d_min}"
            assert d_max <= U + 1e-9, f"Triclinic iteration {i}: d_max={d_max} > U={U}"

    def test_multi_atom_cardinality(self):
        """Tests that 1x1, 1xN, Nx1, and NxM groups are bounded soundly."""
        cell = PeriodicCell.from_lengths_and_angles(40.0, 40.0, 40.0, 90.0, 90.0, 90.0)
        
        # 1x1
        p1 = np.array([[5.0, 5.0, 5.0]])
        p2 = np.array([[10.0, 5.0, 5.0]])
        k1 = KDOP14.from_coordinates(p1)
        k2 = KDOP14.from_coordinates(p2)
        L, U = k1.compute_bounds(k2, cell)
        d_min, d_max = oracle_exact_distances(p1, p2, cell.matrix)
        assert L <= d_min <= d_max <= U
        assert pytest.approx(L, 1e-5) == 5.0

        # 1xN (N=10)
        p_many = np.random.uniform(8.0, 12.0, size=(10, 3))
        km = KDOP14.from_coordinates(p_many)
        L_1n, U_1n = k1.compute_bounds(km, cell)
        d_min_1n, d_max_1n = oracle_exact_distances(p1, p_many, cell.matrix)
        assert L_1n <= d_min_1n <= d_max_1n <= U_1n

        # NxM (N=15, M=20)
        pn = np.random.uniform(2.0, 6.0, size=(15, 3))
        pm = np.random.uniform(14.0, 18.0, size=(20, 3))
        kn = KDOP14.from_coordinates(pn)
        km = KDOP14.from_coordinates(pm)
        L_nm, U_nm = kn.compute_bounds(km, cell)
        d_min_nm, d_max_nm = oracle_exact_distances(pn, pm, cell.matrix)
        assert L_nm <= d_min_nm <= d_max_nm <= U_nm

    def test_adversarial_corrupt_inputs(self):
        """Fails closed on non-finite values or inverted extrema."""
        with pytest.raises(MOCSUnsupportedGeometryError):
            KDOP14.from_coordinates(np.array([[1.0, 2.0, float("nan")]]))

        with pytest.raises(MOCSUnsupportedGeometryError):
            KDOP14.from_coordinates(np.array([[float("inf"), 2.0, 3.0]]))

        with pytest.raises(ValueError, match="minima exceed maxima"):
            KDOP14(minima=np.ones(7) * 5.0, maxima=np.ones(7) * 2.0)

        with pytest.raises(ValueError, match="shape"):
            KDOP14(minima=np.ones(6), maxima=np.ones(6))

    def test_volume_computation(self):
        """Verifies exact volume computation and confirms KDOP volume <= AABB volume."""
        # Cube aligned with axes
        pts = np.array([
            [0, 0, 0], [10, 0, 0], [0, 10, 0], [10, 10, 0],
            [0, 0, 10], [10, 0, 10], [0, 10, 10], [10, 10, 10]
        ], dtype=np.float64)
        kdop = KDOP14.from_coordinates(pts)
        aabb_vol = kdop.aabb_volume()
        exact_vol = kdop.exact_volume()

        assert pytest.approx(aabb_vol, 1e-4) == 1000.0
        if exact_vol is not None:
            assert pytest.approx(exact_vol, 1e-4) == 1000.0
            assert exact_vol <= aabb_vol + 1e-7
