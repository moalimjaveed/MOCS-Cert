"""PASS 38 — Periodic Seam AABB Attack Tests.

Adversarially tests the case where a selection group spans the periodic boundary,
creating a very large Cartesian AABB for a physically small cluster.

This tests soundness (L <= d_min) in all seam-crossing configurations.
Specifically validates:
1. Soundness is preserved (L never > d_min)
2. The bound degrades gracefully (L → 0 in worst case)
3. Multiple seam crossings handled correctly
4. Coordinates outside [0,L) handled correctly
5. Mixed wrapped/unwrapped coordinates handled correctly
"""

import pytest
import numpy as np
from mocs.bounds.periodic_bounds import compute_pbc_bounds


def mic_dist(p1: np.ndarray, p2: np.ndarray, box: np.ndarray) -> float:
    """Reference: pairwise MIC distance."""
    diff = p1 - p2
    diff -= box * np.round(diff / box)
    return float(np.linalg.norm(diff))


def true_min_max_dist(atoms_a: np.ndarray, atoms_b: np.ndarray,
                      box: np.ndarray):
    """Compute true min/max PBC distance between two sets of points."""
    min_d, max_d = np.inf, 0.0
    for a in atoms_a:
        for b in atoms_b:
            d = mic_dist(a, b, box)
            if d < min_d:
                min_d = d
            if d > max_d:
                max_d = d
    return min_d, max_d


def make_aabb(atoms: np.ndarray):
    """Build AABB from atom coordinate array."""
    return (atoms.min(axis=0), atoms.max(axis=0))


class TestPeriodicSeamAABB:
    """Tests for periodic seam crossing — verifies soundness in all cases."""

    def _verify_soundness(self, atoms_a, atoms_b, box, label=""):
        aabb_a = make_aabb(atoms_a)
        aabb_b = make_aabb(atoms_b)
        L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
        true_dmin, true_dmax = true_min_max_dist(atoms_a, atoms_b, box)

        assert L >= 0.0, f"[{label}] Lower bound cannot be negative: L={L}"
        assert U >= L, f"[{label}] Upper bound cannot be less than lower: U={U} < L={L}"
        assert L <= true_dmin + 1e-9, (
            f"[{label}] SOUNDNESS VIOLATION: L={L:.8f} > d_min={true_dmin:.8f}"
        )
        assert U >= true_dmax - 1e-9, (
            f"[{label}] SOUNDNESS VIOLATION: U={U:.8f} < d_max={true_dmax:.8f}"
        )
        return L, U, true_dmin, true_dmax

    def test_seam_crossing_cluster_1d(self):
        """Atoms at 99, 99.5, 0, 0.5 straddle boundary in box L=100."""
        box = np.array([100.0, 10.0, 10.0])
        atoms_a = np.array([[99.0, 5.0, 5.0], [99.5, 5.0, 5.0],
                             [0.0, 5.0, 5.0], [0.5, 5.0, 5.0]])
        atoms_b = np.array([[1.0, 5.0, 5.0]])
        L, U, dmin, dmax = self._verify_soundness(atoms_a, atoms_b, box, "1D seam")
        # True min distance: 0.5 Å (atom at 0.5 to atom at 1.0)
        assert abs(dmin - 0.5) < 1e-9
        # Bound should be sound (L=0 or a small value)
        assert L <= dmin + 1e-9

    def test_seam_crossing_reverse_cluster(self):
        """Atoms straddling seam from the other side."""
        box = np.array([100.0, 10.0, 10.0])
        atoms_a = np.array([[0.0, 5.0, 5.0], [0.5, 5.0, 5.0],
                             [99.0, 5.0, 5.0], [99.5, 5.0, 5.0]])
        atoms_b = np.array([[99.0, 5.0, 5.0]])
        L, U, dmin, dmax = self._verify_soundness(atoms_a, atoms_b, box, "reverse seam")
        assert L <= dmin + 1e-9

    def test_seam_crossing_both_sides(self):
        """Both selections straddle the seam."""
        box = np.array([10.0, 10.0, 10.0])
        # A spans x = 9.5, 0.5 → AABB [0.0, 9.5]
        atoms_a = np.array([[9.5, 5.0, 5.0], [0.5, 5.0, 5.0]])
        # B spans x = 9.8, 0.2 → AABB [0.0, 9.8]
        atoms_b = np.array([[9.8, 5.0, 5.0], [0.2, 5.0, 5.0]])
        L, U, dmin, dmax = self._verify_soundness(atoms_a, atoms_b, box, "both seam")
        assert L <= dmin + 1e-9

    def test_coordinates_outside_fundamental_domain(self):
        """Coordinates outside [0, L) — e.g., negative or beyond L."""
        box = np.array([10.0, 10.0, 10.0])
        atoms_a = np.array([[-0.5, 5.0, 5.0]])   # x = -0.5 (≡ 9.5)
        atoms_b = np.array([[0.5, 5.0, 5.0]])     # x = 0.5
        L, U, dmin, dmax = self._verify_soundness(atoms_a, atoms_b, box, "neg coord")
        # True distance: MIC(-0.5 - 0.5, 10) = MIC(-1.0, 10) = -1.0 → distance = 1.0
        assert abs(dmin - 1.0) < 1e-9
        assert L <= 1.0 + 1e-9

    def test_coordinates_translated_by_multiple_L(self):
        """Coordinates shifted by integer multiples of L."""
        box = np.array([10.0, 10.0, 10.0])
        atoms_a = np.array([[2.0, 5.0, 5.0]])
        atoms_b = np.array([[17.0, 5.0, 5.0]])   # ≡ 7.0, distance = 5.0
        L, U, dmin, dmax = self._verify_soundness(atoms_a, atoms_b, box, "multi-L shift")
        assert abs(dmin - 5.0) < 1e-9
        assert L <= 5.0 + 1e-9

    def test_mixed_wrapped_unwrapped(self):
        """Some atoms wrapped, some not — mix within same selection."""
        box = np.array([10.0, 10.0, 10.0])
        # A: x = 9.0 (wrapped) and x = 19.0 (unwrapped, ≡ 9.0 mod 10)
        atoms_a = np.array([[9.0, 5.0, 5.0], [19.0, 5.0, 5.0]])
        atoms_b = np.array([[1.0, 5.0, 5.0]])
        L, U, dmin, dmax = self._verify_soundness(atoms_a, atoms_b, box, "mixed wrap")
        # True distance: MIC(9-1, 10)=-2→d=2 and MIC(19-1, 10)=-2→d=2
        assert abs(dmin - 2.0) < 1e-9
        assert L <= dmin + 1e-9

    def test_multiple_seam_crossings_3d(self):
        """3D seam crossing: selection spans periodic boundary in all 3 axes."""
        box = np.array([10.0, 10.0, 10.0])
        atoms_a = np.array([
            [9.5, 9.5, 9.5],
            [0.5, 9.5, 9.5],
            [9.5, 0.5, 9.5],
            [9.5, 9.5, 0.5],
            [0.5, 0.5, 0.5],
        ])
        atoms_b = np.array([[5.0, 5.0, 5.0]])
        L, U, dmin, dmax = self._verify_soundness(atoms_a, atoms_b, box, "3D seam")
        assert L <= dmin + 1e-9
        assert U >= dmax - 1e-9

    def test_very_large_aabb_half_width(self):
        """AABB half-width > L/2 — bound degrades to L=0 gracefully."""
        box = np.array([10.0, 10.0, 10.0])
        # AABB spanning almost the full box
        aabb_a = (np.array([0.0, 0.0, 0.0]), np.array([9.9, 9.9, 9.9]))
        aabb_b = (np.array([4.9, 4.9, 4.9]), np.array([5.1, 5.1, 5.1]))
        L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
        # L should be 0 (any point in B is reachable from somewhere in A)
        assert L >= 0.0
        assert U >= 0.0
        assert L <= U + 1e-10

    def test_seam_cluster_smaller_box(self):
        """Small box L=5, cluster at {4.5, 0.5}."""
        box = np.array([5.0, 5.0, 5.0])
        atoms_a = np.array([[4.5, 2.5, 2.5], [0.5, 2.5, 2.5]])
        atoms_b = np.array([[0.0, 2.5, 2.5]])
        L, U, dmin, dmax = self._verify_soundness(atoms_a, atoms_b, box, "small box seam")
        # True distances: |4.5 - 0| via MIC: MIC(4.5, 5) = 4.5 - 5*round(0.9) = 4.5-5=-0.5 → d=0.5
        # |0.5 - 0| = 0.5
        assert abs(dmin - 0.5) < 1e-9
        assert L <= dmin + 1e-9
