"""Pass 37: AABB Bound Absolute Realizability & Soundness Test Suite.

Verifies:
    L <= d_actual <= U
for every realizable particle pair across diverse spatial configurations:
- 1 atom vs 1 atom (zero-volume AABB)
- 1 vs many
- many vs 1
- many vs many
- degenerate AABB (flat line, flat plane)
- identical AABB (overlapping)
- disjoint AABB
- periodic seam crossing
- half-box displacement (L_box / 2)
- highly anisotropic box (e.g. 10 x 100 x 50)
- coordinates near boundary (0.001, L - 0.001)

Records:
    min_slack_L = min(d - L) >= -eps
    min_slack_U = min(U - d) >= -eps
"""

import pytest
import numpy as np
from mocs.bounds.periodic_bounds import compute_pbc_bounds


def calc_min_image_dist(p1: np.ndarray, p2: np.ndarray, box: np.ndarray) -> float:
    diff = p1 - p2
    diff -= box * np.round(diff / box)
    return float(np.linalg.norm(diff))


def generate_aabb_samples(aabb_min: np.ndarray, aabb_max: np.ndarray, n_pts: int = 15) -> np.ndarray:
    """Generates corner vertices, center, and random interior points."""
    pts = [aabb_min, aabb_max, (aabb_min + aabb_max) / 2.0]
    # 8 corner vertices
    for ix in [0, 1]:
        for iy in [0, 1]:
            for iz in [0, 1]:
                pts.append(np.array([
                    aabb_max[0] if ix else aabb_min[0],
                    aabb_max[1] if iy else aabb_min[1],
                    aabb_max[2] if iz else aabb_min[2]
                ]))
    # Random interior
    rng = np.random.default_rng(42)
    for _ in range(n_pts):
        pts.append(aabb_min + rng.random(3) * (aabb_max - aabb_min))
    return np.array(pts)


class TestBoundSoundnessRealizability:
    """Rigorous mathematical realizability tests for periodic AABB bounding."""

    def _check_realizability(self, aabb_a: np.ndarray, aabb_b: np.ndarray, box: np.ndarray, n_samples: int = 20):
        L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
        assert L >= 0.0, f"Lower bound cannot be negative: L={L}"
        assert U >= L, f"Upper bound {U} cannot be less than lower bound {L}"

        samples_a = generate_aabb_samples(aabb_a[0], aabb_a[1], n_samples)
        samples_b = generate_aabb_samples(aabb_b[0], aabb_b[1], n_samples)

        slacks_L = []
        slacks_U = []

        for p_a in samples_a:
            for p_b in samples_b:
                d = calc_min_image_dist(p_a, p_b, box)
                slack_L = d - L
                slack_U = U - d
                slacks_L.append(slack_L)
                slacks_U.append(slack_U)

                assert slack_L >= -1e-7, (
                    f"SOUNDNESS VIOLATION: Actual distance {d:.6f} < Lower Bound {L:.6f} "
                    f"(slack={slack_L:.3e}, p_a={p_a}, p_b={p_b})"
                )
                assert slack_U >= -1e-7, (
                    f"SOUNDNESS VIOLATION: Actual distance {d:.6f} > Upper Bound {U:.6f} "
                    f"(slack={slack_U:.3e}, p_a={p_a}, p_b={p_b})"
                )

        return min(slacks_L), min(slacks_U)

    def test_zero_volume_aabb_one_on_one(self):
        """Single atom vs single atom: L and U must equal exact distance."""
        box = np.array([50.0, 50.0, 50.0])
        p1 = np.array([10.0, 10.0, 10.0])
        p2 = np.array([14.0, 10.0, 10.0])
        aabb_a = np.array([p1, p1])
        aabb_b = np.array([p2, p2])

        min_sL, min_sU = self._check_realizability(aabb_a, aabb_b, box)
        L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
        assert np.isclose(L, 4.0, atol=1e-6)
        assert np.isclose(U, 4.0, atol=1e-6)
        assert min_sL >= -1e-9 and min_sU >= -1e-9

    def test_one_vs_many_and_many_vs_one(self):
        """One point vs finite box, and finite box vs one point."""
        box = np.array([50.0, 50.0, 50.0])
        pt = np.array([5.0, 5.0, 5.0])
        box_pts = np.array([[10.0, 10.0, 10.0], [15.0, 18.0, 14.0]])

        # 1 vs many
        min_sL1, min_sU1 = self._check_realizability(np.array([pt, pt]), box_pts, box)
        # many vs 1
        min_sL2, min_sU2 = self._check_realizability(box_pts, np.array([pt, pt]), box)

        assert min_sL1 >= -1e-7 and min_sU1 >= -1e-7
        assert min_sL2 >= -1e-7 and min_sU2 >= -1e-7

    def test_many_vs_many_general_disjoint(self):
        """Two separated multi-atom bounding boxes."""
        box = np.array([60.0, 60.0, 60.0])
        aabb_a = np.array([[5.0, 5.0, 5.0], [12.0, 15.0, 10.0]])
        aabb_b = np.array([[30.0, 25.0, 20.0], [38.0, 32.0, 28.0]])

        min_sL, min_sU = self._check_realizability(aabb_a, aabb_b, box)
        assert min_sL >= -1e-7 and min_sU >= -1e-7

    def test_identical_and_overlapping_aabb(self):
        """Overlapping and identical AABBs: L must be 0.0."""
        box = np.array([50.0, 50.0, 50.0])
        aabb = np.array([[10.0, 10.0, 10.0], [20.0, 20.0, 20.0]])

        # Identical
        L, U = compute_pbc_bounds(aabb, aabb, box)
        assert np.isclose(L, 0.0, atol=1e-7)
        assert U > 0.0
        self._check_realizability(aabb, aabb, box)

        # Partially overlapping
        aabb_overlap = np.array([[15.0, 15.0, 15.0], [25.0, 25.0, 25.0]])
        L_ov, U_ov = compute_pbc_bounds(aabb, aabb_overlap, box)
        assert np.isclose(L_ov, 0.0, atol=1e-7)
        self._check_realizability(aabb, aabb_overlap, box)

    def test_degenerate_aabb_flat_plane_and_line(self):
        """Degenerate AABBs with zero thickness on one or two dimensions."""
        box = np.array([40.0, 40.0, 40.0])
        # Flat plane (dx = 0)
        plane_a = np.array([[10.0, 5.0, 5.0], [10.0, 15.0, 15.0]])
        # Flat line (dx = 0, dy = 0)
        line_b = np.array([[25.0, 10.0, 5.0], [25.0, 10.0, 25.0]])

        min_sL, min_sU = self._check_realizability(plane_a, line_b, box)
        assert min_sL >= -1e-7 and min_sU >= -1e-7

    def test_periodic_seam_crossing(self):
        """Boxes situated across the periodic boundary seam (near 0 and near L)."""
        box = np.array([50.0, 50.0, 50.0])
        # A near left seam
        aabb_a = np.array([[0.5, 10.0, 10.0], [2.0, 12.0, 12.0]])
        # B near right seam
        aabb_b = np.array([[48.0, 10.0, 10.0], [49.5, 12.0, 12.0]])

        # Distance across seam is ~ 1.0 to 4.5 A
        L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
        assert L < 5.0, f"Periodic seam lower bound should be small, got {L}"
        min_sL, min_sU = self._check_realizability(aabb_a, aabb_b, box)
        assert min_sL >= -1e-7 and min_sU >= -1e-7

    def test_half_box_displacement(self):
        """Boxes separated by exactly L_box / 2 (maximum potential minimum-image distance)."""
        box = np.array([60.0, 60.0, 60.0])
        aabb_a = np.array([[5.0, 5.0, 5.0], [7.0, 7.0, 7.0]])
        aabb_b = np.array([[35.0, 5.0, 5.0], [37.0, 7.0, 7.0]])  # dx = 30.0 = box_x / 2

        L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
        assert L <= 30.0 and U >= 30.0
        min_sL, min_sU = self._check_realizability(aabb_a, aabb_b, box)
        assert min_sL >= -1e-7 and min_sU >= -1e-7

    def test_highly_anisotropic_box(self):
        """Highly anisotropic simulation boxes (e.g. 15.0 x 120.0 x 45.0 A)."""
        box = np.array([15.0, 120.0, 45.0])
        aabb_a = np.array([[1.0, 10.0, 5.0], [3.0, 20.0, 15.0]])
        aabb_b = np.array([[13.0, 80.0, 35.0], [14.5, 95.0, 42.0]])

        min_sL, min_sU = self._check_realizability(aabb_a, aabb_b, box)
        assert min_sL >= -1e-7 and min_sU >= -1e-7

    def test_coordinates_near_box_boundary(self):
        """Coordinates within 0.001 A of 0.0 and L_box."""
        box = np.array([40.0, 40.0, 40.0])
        aabb_a = np.array([[0.0001, 0.0001, 0.0001], [0.5, 0.5, 0.5]])
        aabb_b = np.array([[39.5, 39.5, 39.5], [39.9999, 39.9999, 39.9999]])

        min_sL, min_sU = self._check_realizability(aabb_a, aabb_b, box)
        assert min_sL >= -1e-7 and min_sU >= -1e-7
