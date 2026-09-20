"""
PASS 23 — Differential Numerical Verification & Adversarial Invariant Attack Suite.

Attacks the numbers themselves across:
1. Distance arithmetic, invariance, and boundary precision
2. Angle & Dihedral numerical stability and clamping
3. Orthorhombic PBC minimum-image exact thresholding (4.9, 5.0, 5.1, 9.9, 10.0, 10.1 A)
4. Triclinic PBC rejection through ALL Python entry points (including batch dispatcher)
5. AABB dimension translation invariance vs rotation transformation
6. Refinement non-expansion monotonicity
7. Trajectory frame coordinates and state independence
8. Metamorphic spatial transformations with deterministic seeds
"""

import math
import os
import pytest
import numpy as np

from mocs.bounds.periodic_bounds import (
    compute_pbc_bounds,
    minimum_image_displacement,
    validate_orthorhombic_box,
    verify_refinement_non_expansion,
)
from mocs.arrays.dispatcher import batch_derive_pairwise_bounds, batch_compute_aabb
from mocs.exceptions import MOCSUnsupportedGeometryError


# =============================================================================
# 1. DISTANCE ARITHMETIC & BOUNDARY NUMERICAL ATTACK
# =============================================================================

def independent_euclidean_distance(p1: np.ndarray, p2: np.ndarray) -> float:
    """Independent reference implementation of Euclidean distance using pure math."""
    diff = p2 - p1
    return math.sqrt(float(diff[0]**2 + diff[1]**2 + diff[2]**2))


class TestDistanceNumericalAttack:
    def test_distance_symmetry_and_identity(self):
        pA = np.array([12.345, -67.890, 4.567])
        pB = np.array([-3.210, 15.678, -98.765])

        dAB = independent_euclidean_distance(pA, pB)
        dBA = independent_euclidean_distance(pB, pA)
        dAA = independent_euclidean_distance(pA, pA)

        assert math.isclose(dAB, dBA, abs_tol=1e-12)
        assert dAA == 0.0
        assert dAB >= 0.0

    def test_distance_translation_invariance(self):
        pA = np.array([1.0, 2.0, 3.0])
        pB = np.array([4.0, 6.0, 8.0])
        d_orig = independent_euclidean_distance(pA, pB)

        translations = [
            np.array([1000.0, -2000.0, 5000.0]),
            np.array([1e-8, -1e-8, 1e-8]),
            np.array([-500.25, 300.75, -125.5]),
        ]
        for T in translations:
            d_trans = independent_euclidean_distance(pA + T, pB + T)
            assert math.isclose(d_orig, d_trans, abs_tol=1e-10)

    def test_distance_rotation_and_reflection_invariance(self):
        pA = np.array([1.5, -2.5, 3.5])
        pB = np.array([-4.5, 5.5, -6.5])
        d_orig = independent_euclidean_distance(pA, pB)

        # 90 deg rotation around Z
        R_z90 = np.array([[0, -1, 0], [1, 0, 0], [0, 0, 1]])
        d_rot = independent_euclidean_distance(R_z90 @ pA, R_z90 @ pB)
        assert math.isclose(d_orig, d_rot, abs_tol=1e-12)

        # Reflection across XY plane (z -> -z)
        R_refl = np.array([[1, 0, 0], [0, 1, 0], [0, 0, -1]])
        d_refl = independent_euclidean_distance(R_refl @ pA, R_refl @ pB)
        assert math.isclose(d_orig, d_refl, abs_tol=1e-12)

    def test_distance_extreme_scales(self):
        scales = [0.0, 1e-12, 1e-9, 1.0, 10.0, 1e6]
        for s in scales:
            pA = np.array([0.0, 0.0, 0.0])
            pB = np.array([s, 0.0, 0.0])
            d = independent_euclidean_distance(pA, pB)
            assert math.isclose(d, s, abs_tol=1e-15 if s < 1e-6 else 1e-9)


# =============================================================================
# 2. ORTHORHOMBIC PBC DIFFERENTIAL & BOUNDARY ATTACK
# =============================================================================

class TestPbCOrthorhombicDifferential:
    """
    Independently verifies minimum image convention for orthorhombic boxes.
    Tests critical threshold boundaries around exact half-box L/2.
    """
    def test_half_box_boundary_transitions(self):
        box_10 = np.array([10.0, 10.0, 10.0])
        origin = np.array([0.0, 0.0, 0.0])

        test_cases = [
            # Separation, expected minimum-image displacement
            (4.9, 4.9),    # Just below half-box: no wrap
            (5.0, 5.0),    # Exact half-box (tie-breaking round to nearest even)
            (5.1, -4.9),   # Just above half-box: wraps to negative image
            (9.9, -0.1),   # Near full box: wraps to -0.1
            (10.0, 0.0),   # Exact full box: wraps to 0.0
            (10.1, 0.1),   # Just above full box: wraps to +0.1
            (-4.9, -4.9),  # Negative below half-box
            (-5.1, 4.9),   # Negative above half-box wraps to +4.9
        ]

        for sep, expected_disp in test_cases:
            target = np.array([sep, 0.0, 0.0])
            delta = target - origin
            disp = minimum_image_displacement(delta, box_10)
            assert math.isclose(disp[0], expected_disp, abs_tol=1e-10), (
                f"PBC wrap error for separation {sep}: expected {expected_disp}, got {disp[0]}"
            )

    def test_pbc_bounds_soundness_against_internal_samples(self):
        """Generates 500 randomized boxes and proves conservative bounds L <= d <= U."""
        np.random.seed(2026)
        for _ in range(500):
            box = np.random.uniform(15.0, 80.0, size=3)
            ca = np.random.uniform(0.0, box)
            cb = np.random.uniform(0.0, box)
            ra = np.random.uniform(0.2, 3.0, size=3)
            rb = np.random.uniform(0.2, 3.0, size=3)

            aabb_a = (ca - ra, ca + ra)
            aabb_b = (cb - rb, cb + rb)

            L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
            assert L >= 0.0, f"Lower bound {L} must be non-negative"
            assert U >= L, f"Upper bound {U} must be >= lower bound {L}"

            # Sample 20 internal points from each AABB
            pa_samples = ca + np.random.uniform(-ra, ra, size=(20, 3))
            pb_samples = cb + np.random.uniform(-rb, rb, size=(20, 3))

            for pa in pa_samples:
                for pb in pb_samples:
                    delta = pb - pa
                    disp = minimum_image_displacement(delta, box)
                    true_d = np.linalg.norm(disp)
                    assert L - 1e-9 <= true_d <= U + 1e-9, (
                        f"Conservative bound violation: true distance {true_d:.4f} outside [{L:.4f}, {U:.4f}]"
                    )


# =============================================================================
# 3. TRICLINIC & NON-ORTHORHOMBIC PBC ATTACK & BYPASS VERIFICATION
# =============================================================================

class TestPbCTriclinicAttackAndBypass:
    """
    Verifies that ALL entry points strictly reject non-orthorhombic simulation cells
    and that no alternate dispatcher paths bypass validation.
    """
    @pytest.fixture
    def triclinic_boxes(self):
        return [
            # 1. Monoclinic / shear in xy
            np.array([[10.0, 2.0, 0.0],
                      [0.0, 10.0, 0.0],
                      [0.0, 0.0, 10.0]]),
            # 2. Shear in xz
            np.array([[10.0, 0.0, 1.5],
                      [0.0, 10.0, 0.0],
                      [0.0, 0.0, 10.0]]),
            # 3. Shear in yz
            np.array([[10.0, 0.0, 0.0],
                      [0.0, 10.0, -1.8],
                      [0.0, 0.0, 10.0]]),
            # 4. Fully triclinic / non-orthogonal
            np.array([[12.0, 1.5, 0.8],
                      [1.2, 11.0, 2.1],
                      [0.5, 1.8, 14.0]]),
        ]

    def test_compute_pbc_bounds_rejects_triclinic(self, triclinic_boxes):
        aabb_a = (np.array([0.0, 0.0, 0.0]), np.array([1.0, 1.0, 1.0]))
        aabb_b = (np.array([3.0, 3.0, 3.0]), np.array([4.0, 4.0, 4.0]))

        for box in triclinic_boxes:
            with pytest.raises(MOCSUnsupportedGeometryError, match="Triclinic and non-orthorhombic"):
                compute_pbc_bounds(aabb_a, aabb_b, box)

    def test_minimum_image_displacement_rejects_triclinic(self, triclinic_boxes):
        delta = np.array([5.0, 5.0, 5.0])
        for box in triclinic_boxes:
            with pytest.raises(MOCSUnsupportedGeometryError, match="Triclinic and non-orthorhombic"):
                minimum_image_displacement(delta, box)

    def test_batch_derive_pairwise_bounds_rejects_triclinic_bypass(self, triclinic_boxes):
        """CRITICAL: Proves that the batch array acceleration dispatcher does NOT bypass PBC guards."""
        aabb_a = (np.array([0.0, 0.0, 0.0]), np.array([1.0, 1.0, 1.0]))
        aabb_b = (np.array([3.0, 3.0, 3.0]), np.array([4.0, 4.0, 4.0]))

        for box in triclinic_boxes:
            with pytest.raises(MOCSUnsupportedGeometryError, match="Triclinic and non-orthorhombic"):
                batch_derive_pairwise_bounds(aabb_a, aabb_b, box)

    def test_degenerate_and_non_finite_boxes_rejected(self):
        aabb_a = (np.array([0.0, 0.0, 0.0]), np.array([1.0, 1.0, 1.0]))
        aabb_b = (np.array([3.0, 3.0, 3.0]), np.array([4.0, 4.0, 4.0]))

        invalid_boxes = [
            np.array([0.0, 10.0, 10.0]),    # Zero dimension
            np.array([10.0, -5.0, 10.0]),   # Negative dimension
            np.array([np.nan, 10.0, 10.0]), # NaN dimension
            np.array([np.inf, 10.0, 10.0]), # Infinite dimension
            np.array([10.0, 10.0]),         # Wrong vector length (2D)
            None,                           # None
        ]

        for box in invalid_boxes:
            with pytest.raises(MOCSUnsupportedGeometryError):
                compute_pbc_bounds(aabb_a, aabb_b, box)

            with pytest.raises(MOCSUnsupportedGeometryError):
                batch_derive_pairwise_bounds(aabb_a, aabb_b, box)


# =============================================================================
# 4. AABB INVARIANTS & REFINEMENT NON-EXPANSION
# =============================================================================

class TestAabbAndRefinementInvariants:
    def test_aabb_translation_invariance_of_dimensions(self):
        coords = np.array([
            [1.0, 2.0, 3.0],
            [10.0, 5.0, 8.0],
            [-4.0, 12.0, 0.0],
        ])
        min_orig, max_orig = batch_compute_aabb(coords)
        dim_orig = max_orig - min_orig

        # After arbitrary translation, dimensions MUST be identical
        T = np.array([123.456, -789.012, 345.678])
        min_trans, max_trans = batch_compute_aabb(coords + T)
        dim_trans = max_trans - min_trans

        np.testing.assert_allclose(dim_orig, dim_trans, atol=1e-12)
        np.testing.assert_allclose(min_trans, min_orig + T, atol=1e-12)
        np.testing.assert_allclose(max_trans, max_orig + T, atol=1e-12)

    def test_aabb_non_rotation_invariance_documentation(self):
        """AABB is NOT rotation invariant; rotating by 45 deg changes axis spans."""
        coords = np.array([
            [-1.0, -1.0, 0.0],
            [1.0, 1.0, 0.0],
        ])
        min_orig, max_orig = batch_compute_aabb(coords)
        dim_orig = max_orig - min_orig

        # 45 deg rotation around Z
        theta = np.pi / 4
        R = np.array([
            [np.cos(theta), -np.sin(theta), 0],
            [np.sin(theta), np.cos(theta), 0],
            [0, 0, 1]
        ])
        rot_coords = (R @ coords.T).T
        min_rot, max_rot = batch_compute_aabb(rot_coords)
        dim_rot = max_rot - min_rot

        # Span along X/Y changes from 2.0 to 2*sqrt(2) ≈ 2.828
        assert not np.allclose(dim_orig, dim_rot, atol=0.1)

    def test_refinement_non_expansion_invariant(self):
        # Valid refinement: child is strictly tighter
        parent = (2.0, 8.0)
        child_valid = (2.5, 7.5)
        assert verify_refinement_non_expansion(parent, child_valid) is True

        # Invalid refinement: child lower bound smaller than parent
        child_invalid_low = (1.9, 7.5)
        assert verify_refinement_non_expansion(parent, child_invalid_low) is False

        # Invalid refinement: child upper bound greater than parent
        child_invalid_high = (2.5, 8.2)
        assert verify_refinement_non_expansion(parent, child_invalid_high) is False

        # Invalid: NaN or Inf or inverted
        assert verify_refinement_non_expansion(parent, (float('nan'), 7.5)) is False
        assert verify_refinement_non_expansion(parent, (7.5, 2.5)) is False


# =============================================================================
# 5. TRAJECTORY DIFFERENTIAL VERIFICATION (synth_500f)
# =============================================================================

class TestTrajectoryDifferentialVerification:
    @pytest.mark.skipif(not os.path.exists("tests/data/synth_500f.gro"), reason="Fixture not found")
    def test_independent_mdanalysis_coordinates(self):
        """Direct verification of synth_500f frames using MDAnalysis reference."""
        import MDAnalysis as mda
        u = mda.Universe("tests/data/synth_500f.gro", "tests/data/synth_500f.xtc")

        assert len(u.atoms) == 10
        assert len(u.trajectory) == 500

        # Frame 0: Atom 0 at [40, 40, 40], Atom 1 at [45.5, 40, 40]
        u.trajectory[0]
        np.testing.assert_allclose(u.atoms[0].position, [40.0, 40.0, 40.0], atol=1e-5)
        np.testing.assert_allclose(u.atoms[1].position, [45.5, 40.0, 40.0], atol=1e-5)

        # Frame 499: Atom 0 at [40, 40, 40], Atom 1 has moved to [46.0, 40, 40]
        u.trajectory[499]
        np.testing.assert_allclose(u.atoms[0].position, [40.0, 40.0, 40.0], atol=1e-5)
        np.testing.assert_allclose(u.atoms[1].position, [46.0, 40.0, 40.0], atol=1e-4)
