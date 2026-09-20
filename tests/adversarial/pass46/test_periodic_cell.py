"""
PASS 46: PeriodicCell Canonical Geometry & Invariant Test Suite.

Verifies:
- Cases A-L:
  - Case A: Fixed orthorhombic diagonal tensor
  - Case B: GROMACS reduced rhombic dodecahedron (60°, 60°, 90°)
  - Case C: Truncated octahedron (reduced crystallographic)
  - Case D: Skewed monoclinic cell (gamma = 35°)
  - Case E: Obtuse triclinic cell (alpha = 120°, beta = 110°, gamma = 100°)
  - Case F: Collinear cell basis (gamma = 0° or 180° -> fail-closed)
  - Case G: Non-finite values (NaN, Inf -> fail-closed)
  - Case H: Zero / negative lengths (la <= 0 -> fail-closed)
  - Case I: Near-singular matrix (condition number > 1e12 -> fail-closed)
  - Case J: Translation invariance: d_MIC(r_a + H*n, r_b + H*m) == d_MIC(r_a, r_b)
  - Case K: Metric symmetry: d_MIC(r_a, r_b) == d_MIC(r_b, r_a)
  - Case L: Positive definiteness and identity: d_MIC(r_a, r_a) == 0.0
"""

import math
import pytest
import numpy as np

from mocs.bounds.periodic_cell import PeriodicCell
from mocs.exceptions import MOCSUnsupportedGeometryError


class TestPeriodicCellGeometry:
    """Test suite covering Cases A-L for PeriodicCell."""

    def test_case_a_fixed_orthorhombic(self):
        """Case A: Fixed orthorhombic diagonal tensor."""
        cell = PeriodicCell.from_dimensions([40.0, 50.0, 60.0])
        assert cell.is_orthorhombic is True
        assert cell.cell_type == "orthorhombic"
        assert math.isclose(cell.volume, 120000.0)
        assert np.allclose(cell.lengths, [40.0, 50.0, 60.0])
        assert np.allclose(cell.angles, [90.0, 90.0, 90.0])

        # Test displacement on orthorhombic fast path
        delta = np.array([25.0, -30.0, 5.0])
        mic = cell.minimum_image_displacement(delta)
        expected = np.array([-15.0, 20.0, 5.0])
        assert np.allclose(mic, expected)

    def test_case_b_rhombic_dodecahedron(self):
        """Case B: GROMACS reduced rhombic dodecahedron (60°, 60°, 90°)."""
        cell = PeriodicCell.from_dimensions([80.017, 80.017, 80.017, 60.0, 60.0, 90.0])
        assert cell.is_orthorhombic is False
        assert cell.cell_type == "triclinic"
        assert cell.volume > 0.0

        # Fractional round-trip
        r = np.array([[15.0, -25.0, 40.0], [0.0, 0.0, 0.0], [80.0, 80.0, 80.0]])
        s = cell.to_fractional(r)
        r_rec = cell.to_cartesian(s)
        assert np.allclose(r, r_rec)

    def test_case_c_truncated_octahedron(self):
        """Case C: Truncated octahedron geometry."""
        # Standard truncated octahedron: a=b=c, alpha=beta=gamma = 109.47122°
        cell = PeriodicCell.from_dimensions([50.0, 50.0, 50.0, 109.47, 109.47, 109.47])
        assert cell.is_orthorhombic is False
        assert cell.cell_type == "triclinic"
        assert cell.volume > 0.0

    def test_case_d_skewed_monoclinic(self):
        """Case D: Highly skewed monoclinic cell (gamma = 35°) fails closed per F-002."""
        with pytest.raises(MOCSUnsupportedGeometryError):
            PeriodicCell.from_dimensions([30.0, 40.0, 50.0, 90.0, 90.0, 35.0])

    def test_case_e_obtuse_triclinic(self):
        """Case E: Obtuse triclinic cell."""
        cell = PeriodicCell.from_dimensions([45.0, 40.0, 55.0, 100.0, 105.0, 110.0])
        assert cell.is_orthorhombic is False
        assert cell.cell_type == "triclinic"
        assert cell.volume > 0.0

    def test_case_f_collinear_rejection(self):
        """Case F: Collinear or unphysical cell basis fails closed."""
        with pytest.raises(MOCSUnsupportedGeometryError):
            PeriodicCell.from_dimensions([50.0, 50.0, 50.0, 90.0, 90.0, 0.0])

        with pytest.raises(MOCSUnsupportedGeometryError):
            PeriodicCell.from_dimensions([50.0, 50.0, 50.0, 90.0, 90.0, 180.0])

    def test_case_g_non_finite_rejection(self):
        """Case G: Non-finite values fail closed."""
        with pytest.raises(MOCSUnsupportedGeometryError):
            PeriodicCell.from_dimensions([float("nan"), 50.0, 50.0])

        with pytest.raises(MOCSUnsupportedGeometryError):
            PeriodicCell.from_dimensions([50.0, float("inf"), 50.0])

    def test_case_h_zero_negative_length_rejection(self):
        """Case H: Zero / negative lengths fail closed."""
        with pytest.raises(MOCSUnsupportedGeometryError):
            PeriodicCell.from_dimensions([0.0, 50.0, 50.0])

        with pytest.raises(MOCSUnsupportedGeometryError):
            PeriodicCell.from_dimensions([50.0, -10.0, 50.0])

    def test_case_i_near_singular_rejection(self):
        """Case I: Near-singular matrix fails closed."""
        # Collinear columns
        singular_mat = np.array([
            [1.0, 2.0, 3.0],
            [2.0, 4.0, 6.0],
            [1.0, 1.0, 1.0],
        ])
        with pytest.raises(MOCSUnsupportedGeometryError):
            PeriodicCell.from_matrix(singular_mat)

    def test_case_j_translation_invariance(self):
        """
        Case J: Invariant under integer lattice translations:
        d_MIC(p_a + H*n, p_b + H*m) == d_MIC(p_a, p_b)
        """
        cell = PeriodicCell.from_dimensions([80.017, 80.017, 80.017, 60.0, 60.0, 90.0])
        H = cell.matrix

        np.random.seed(42)
        for _ in range(50):
            pa = np.random.uniform(0.0, 80.0, size=3)
            pb = np.random.uniform(0.0, 80.0, size=3)
            base_dist = cell.minimum_image_distance(pb - pa)

            # Random lattice shifts
            n = np.random.randint(-3, 4, size=3)
            m = np.random.randint(-3, 4, size=3)
            pa_shifted = pa + H @ n
            pb_shifted = pb + H @ m

            shifted_dist = cell.minimum_image_distance(pb_shifted - pa_shifted)
            assert np.isclose(base_dist, shifted_dist, atol=1e-5), f"Failed: base={base_dist}, shifted={shifted_dist}"

    def test_case_k_metric_symmetry(self):
        """Case K: d_MIC(p_a, p_b) == d_MIC(p_b, p_a)."""
        cell = PeriodicCell.from_dimensions([80.017, 80.017, 80.017, 60.0, 60.0, 90.0])
        np.random.seed(123)
        for _ in range(50):
            pa = np.random.uniform(-50.0, 150.0, size=3)
            pb = np.random.uniform(-50.0, 150.0, size=3)
            d_ab = cell.minimum_image_distance(pb - pa)
            d_ba = cell.minimum_image_distance(pa - pb)
            assert np.isclose(d_ab, d_ba, atol=1e-9)

    def test_case_l_positive_definiteness(self):
        """Case L: d_MIC(p_a, p_a) == 0.0 and d_MIC(p_a, p_b) >= 0.0."""
        cell = PeriodicCell.from_dimensions([80.017, 80.017, 80.017, 60.0, 60.0, 90.0])
        pa = np.array([25.3, -14.2, 58.7])
        assert cell.minimum_image_distance(pa - pa) == 0.0

        pb = pa + np.array([0.001, 0.0, 0.0])
        assert cell.minimum_image_distance(pb - pa) > 0.0
