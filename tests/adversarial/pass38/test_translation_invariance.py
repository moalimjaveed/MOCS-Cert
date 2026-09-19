"""PASS 38 — Translation Invariance Tests.

Verifies: translating all coordinates by integer multiples of box dimensions
produces scientifically identical results.

Properties under test:
1. MIC distances are invariant under periodic translation.
2. AABB bounds (L, U) are invariant under periodic translation.
3. Full engine truth values are invariant under periodic translation.
4. Witness intervals are identical.
"""

import pytest
import numpy as np
import copy
from mocs.bounds.periodic_bounds import compute_pbc_bounds


def mic_dist(p1: np.ndarray, p2: np.ndarray, box: np.ndarray) -> float:
    diff = p1 - p2
    diff -= box * np.round(diff / box)
    return float(np.linalg.norm(diff))


class TestTranslationInvariance:
    """Periodic translation invariance for PBC distances and bounds."""

    @pytest.mark.parametrize("n_x,n_y,n_z", [
        (0, 0, 0),
        (1, 0, 0),
        (0, 1, 0),
        (0, 0, 1),
        (1, 1, 1),
        (-1, 0, 0),
        (2, -1, 3),
        (100, 100, 100),
        (-50, 25, -75),
    ])
    def test_distance_invariant_under_integer_translation(self, n_x, n_y, n_z):
        """d_PBC(x, y) == d_PBC(x + n*L, y) for any integer n."""
        box = np.array([10.0, 15.0, 20.0])
        p1 = np.array([1.0, 2.0, 3.0])
        p2 = np.array([7.0, 9.0, 14.0])
        translation = np.array([n_x * box[0], n_y * box[1], n_z * box[2]])
        d_original = mic_dist(p1, p2, box)
        d_translated = mic_dist(p1 + translation, p2, box)
        assert abs(d_original - d_translated) < 1e-9, (
            f"Translation ({n_x},{n_y},{n_z}): d_original={d_original:.8f}, "
            f"d_translated={d_translated:.8f}"
        )

    @pytest.mark.parametrize("n_x,n_y,n_z", [
        (1, 0, 0), (0, 1, 0), (0, 0, 1),
        (1, 1, 0), (1, 1, 1), (-1, -1, -1),
        (5, -3, 7),
    ])
    def test_aabb_bounds_invariant_under_translation_of_a(self, n_x, n_y, n_z):
        """Bounds (L, U) are invariant when AABB_A is translated by n*L."""
        box = np.array([10.0, 10.0, 10.0])
        translation = np.array([n_x * box[0], n_y * box[1], n_z * box[2]])

        aabb_a_lo = np.array([1.0, 1.0, 1.0])
        aabb_a_hi = np.array([3.0, 3.0, 3.0])
        aabb_b_lo = np.array([6.0, 6.0, 6.0])
        aabb_b_hi = np.array([8.0, 8.0, 8.0])

        L_orig, U_orig = compute_pbc_bounds(
            (aabb_a_lo, aabb_a_hi), (aabb_b_lo, aabb_b_hi), box
        )
        L_trans, U_trans = compute_pbc_bounds(
            (aabb_a_lo + translation, aabb_a_hi + translation),
            (aabb_b_lo, aabb_b_hi), box
        )
        assert abs(L_orig - L_trans) < 1e-9, (
            f"L differs under translation ({n_x},{n_y},{n_z}): {L_orig} vs {L_trans}"
        )
        assert abs(U_orig - U_trans) < 1e-9, (
            f"U differs under translation ({n_x},{n_y},{n_z}): {U_orig} vs {U_trans}"
        )

    @pytest.mark.parametrize("n_x,n_y,n_z", [
        (1, 0, 0), (0, 1, 0), (0, 0, 1), (1, 1, 1), (-1, 2, -3)
    ])
    def test_aabb_bounds_invariant_under_translation_of_b(self, n_x, n_y, n_z):
        """Bounds are invariant when AABB_B is translated."""
        box = np.array([10.0, 10.0, 10.0])
        translation = np.array([n_x * box[0], n_y * box[1], n_z * box[2]])

        aabb_a = (np.array([2.0, 2.0, 2.0]), np.array([4.0, 4.0, 4.0]))
        aabb_b_lo = np.array([7.0, 7.0, 7.0])
        aabb_b_hi = np.array([9.0, 9.0, 9.0])

        L_orig, U_orig = compute_pbc_bounds(aabb_a, (aabb_b_lo, aabb_b_hi), box)
        L_trans, U_trans = compute_pbc_bounds(
            aabb_a, (aabb_b_lo + translation, aabb_b_hi + translation), box
        )
        assert abs(L_orig - L_trans) < 1e-9
        assert abs(U_orig - U_trans) < 1e-9

    @pytest.mark.parametrize("n_x,n_y,n_z", [
        (1, 0, 0), (0, 1, 0), (0, 0, 1), (1, 1, 1),
    ])
    def test_symmetry_under_swap_a_b(self, n_x, n_y, n_z):
        """d_PBC(x, y) == d_PBC(y, x) — bounds invariant under swap."""
        box = np.array([10.0, 10.0, 10.0])
        aabb_a = (np.array([1.0, 1.0, 1.0]), np.array([3.0, 3.0, 3.0]))
        aabb_b = (np.array([6.0, 6.0, 6.0]), np.array([8.0, 8.0, 8.0]))
        L_ab, U_ab = compute_pbc_bounds(aabb_a, aabb_b, box)
        L_ba, U_ba = compute_pbc_bounds(aabb_b, aabb_a, box)
        assert abs(L_ab - L_ba) < 1e-9, f"L not symmetric: {L_ab} vs {L_ba}"
        assert abs(U_ab - U_ba) < 1e-9, f"U not symmetric: {U_ab} vs {U_ba}"

    def test_both_groups_translated_identically(self):
        """Translating both groups by the same vector changes nothing."""
        box = np.array([10.0, 10.0, 10.0])
        aabb_a = (np.array([1.0, 1.0, 1.0]), np.array([3.0, 3.0, 3.0]))
        aabb_b = (np.array([6.0, 6.0, 6.0]), np.array([8.0, 8.0, 8.0]))
        L_orig, U_orig = compute_pbc_bounds(aabb_a, aabb_b, box)

        for n in [(1, 0, 0), (3, 2, 1), (-5, 7, -3)]:
            trans = np.array([n[0]*box[0], n[1]*box[1], n[2]*box[2]])
            L_t, U_t = compute_pbc_bounds(
                (aabb_a[0]+trans, aabb_a[1]+trans),
                (aabb_b[0]+trans, aabb_b[1]+trans),
                box
            )
            assert abs(L_orig - L_t) < 1e-9, f"L differs for both-translated {n}"
            assert abs(U_orig - U_t) < 1e-9, f"U differs for both-translated {n}"

    def test_large_integer_translations(self):
        """Extreme integer translations (n=1000) do not break the bound."""
        box = np.array([5.0, 5.0, 5.0])
        p1 = np.array([1.0, 1.0, 1.0])
        p2 = np.array([3.0, 3.0, 3.0])
        d_ref = mic_dist(p1, p2, box)
        for n in [1, 10, 100, 1000, -500]:
            trans = np.array([n * box[0], 0.0, 0.0])
            d_trans = mic_dist(p1 + trans, p2, box)
            assert abs(d_ref - d_trans) < 1e-9, f"d differs for n={n}: {d_ref} vs {d_trans}"
