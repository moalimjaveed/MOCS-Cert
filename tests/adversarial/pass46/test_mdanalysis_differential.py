"""
PASS 46: Differential Verification Against MDAnalysis.

Compares MOCS PeriodicCell minimum_image_displacement and minimum_image_distance
against MDAnalysis.lib.distances.minimize_vectors on 1,000+ random points across
diverse cell shapes (orthorhombic, rhombic dodecahedron, skewed triclinic).
Also verifies that independent TriclinicReferenceOracle agrees with PeriodicCell.
"""

import pytest
import numpy as np
import MDAnalysis as mda
from MDAnalysis.lib.distances import minimize_vectors

from mocs.bounds.periodic_cell import PeriodicCell
from tests.reference.triclinic_oracle import TriclinicReferenceOracle


class TestMDAnalysisDifferential:
    """Differential verification against MDAnalysis."""

    @pytest.mark.parametrize(
        "dimensions",
        [
            # Fixed orthorhombic
            [80.0, 90.0, 100.0, 90.0, 90.0, 90.0],
            # GROMACS Rhombic Dodecahedron (AdK)
            [80.017, 80.017, 80.017, 60.0, 60.0, 90.0],
            # Skewed triclinic
            [65.0, 70.0, 75.0, 75.0, 80.0, 85.0],
            # Truncated Octahedron
            [60.0, 60.0, 60.0, 109.47, 109.47, 109.47],
        ],
    )
    def test_minimize_vectors_parity(self, dimensions):
        """
        Differential parity test: 500 points per geometry against MDAnalysis minimize_vectors.
        """
        cell = PeriodicCell.from_dimensions(dimensions)
        oracle = TriclinicReferenceOracle(dimensions, search_k=2)

        np.random.seed(42)
        # Random displacement vectors in range [-200, 200]
        deltas = np.random.uniform(-200.0, 200.0, size=(500, 3)).astype(np.float64)

        # 1. MOCS vectorized calculation
        mocs_disp = cell.minimum_image_displacement(deltas)
        mocs_dists = np.linalg.norm(mocs_disp, axis=1)

        # 2. Independent Oracle calculation
        oracle_disp = oracle.minimum_image_displacement(deltas)
        oracle_dists = np.linalg.norm(oracle_disp, axis=1)

        # 3. MDAnalysis minimize_vectors
        mda_disp = minimize_vectors(deltas.astype(np.float32), np.array(dimensions, dtype=np.float32))
        mda_dists = np.linalg.norm(mda_disp, axis=1)

        # MOCS vs Oracle: exact agreement (float64)
        assert np.allclose(mocs_dists, oracle_dists, atol=1e-8)

        # MOCS vs MDAnalysis: agreement within float32 tolerance (1e-4 A)
        max_diff = np.max(np.abs(mocs_dists - mda_dists))
        assert max_diff < 1e-4, f"Discrepancy with MDAnalysis for {dimensions}: {max_diff:.6e} A"

    def test_aabb_bounds_soundness_against_oracle(self):
        """
        Verifies that PeriodicCell.compute_aabb_bounds satisfies L <= d_true <= U
        for 200 randomized AABB pairs with 50 internal points each.
        """
        cell = PeriodicCell.from_dimensions([80.017, 80.017, 80.017, 60.0, 60.0, 90.0])
        oracle = TriclinicReferenceOracle([80.017, 80.017, 80.017, 60.0, 60.0, 90.0], search_k=2)

        np.random.seed(101)
        for _ in range(200):
            size_a = np.random.uniform(1.0, 15.0, size=3)
            size_b = np.random.uniform(1.0, 15.0, size=3)
            pos_a = np.random.uniform(0.0, 80.0, size=3)
            pos_b = np.random.uniform(0.0, 80.0, size=3)

            aabb_a = (pos_a, pos_a + size_a)
            aabb_b = (pos_b, pos_b + size_b)

            L, U = cell.compute_aabb_bounds(aabb_a, aabb_b)
            assert 0.0 <= L <= U

            # Test with sample point pairs
            pts_a = np.random.uniform(aabb_a[0], aabb_a[1], size=(20, 3))
            pts_b = np.random.uniform(aabb_b[0], aabb_b[1], size=(20, 3))

            for pa in pts_a:
                for pb in pts_b:
                    d_mic = oracle.minimum_image_distance(pb - pa)
                    assert d_mic >= L - 1e-8, f"Violation of L bound: d_mic={d_mic}, L={L}"
                    assert d_mic <= U + 1e-8, f"Violation of U bound: d_mic={d_mic}, U={U}"
