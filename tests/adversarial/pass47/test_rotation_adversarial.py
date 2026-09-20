"""
PASS 47: Rotation Adversarial Study & Quantitative Tightness Evaluation.

Evaluates AABB vs KDOP14 across a family of rotated and elongated molecular geometries:
- Axis-aligned rod (0°)
- Rotated rods (15°, 30°, 45°, 60°, 75°)
- Rotating helix-like point clouds
- Compact globular objects
- Isotropic random clouds

Measures:
1. Enclosing volume: V_AABB vs V_KDOP
2. Bound gap: G = U - L for AABB vs KDOP
3. Soundness invariant verification
"""

import math
import pytest
import numpy as np

from mocs.bounds.kdop import KDOP14, KDOP14_DIRECTIONS
from mocs.bounds.periodic_bounds import compute_pbc_bounds
from mocs.bounds.periodic_cell import PeriodicCell
from tests.reference.kdop_oracle import oracle_exact_distances


def generate_rotated_rod(length: float, radius: float, angle_deg: float, axis: str = "z") -> np.ndarray:
    """Generates an elongated cylinder/rod rotated around the specified axis."""
    n_points = 100
    # Along x-axis initially
    x = np.linspace(-0.5 * length, 0.5 * length, n_points)
    angles = np.linspace(0, 2 * np.pi, n_points)
    y = radius * np.cos(angles)
    z = radius * np.sin(angles)
    pts = np.column_stack([x, y, z])

    # Rotation matrix around z
    theta = math.radians(angle_deg)
    if axis == "z":
        R = np.array([
            [math.cos(theta), -math.sin(theta), 0],
            [math.sin(theta), math.cos(theta), 0],
            [0, 0, 1]
        ])
    elif axis == "y":
        R = np.array([
            [math.cos(theta), 0, math.sin(theta)],
            [0, 1, 0],
            [-math.sin(theta), 0, math.cos(theta)]
        ])
    else:
        R = np.array([
            [1, 0, 0],
            [0, math.cos(theta), -math.sin(theta)],
            [0, math.sin(theta), math.cos(theta)]
        ])
    return pts @ R.T


class TestRotationAdversarialStudy:
    """Rigorous empirical evaluation of volume and bound gap across rotation angles."""

    def test_rod_rotation_volume_tightness(self):
        """
        Tests that when an elongated rod (length=30 Å, radius=2 Å) is rotated:
        1. V_KDOP <= V_AABB holds at every angle.
        2. At 45° rotation in xy-plane, KDOP achieves measurable volume reduction over AABB.
        """
        angles = [0, 15, 30, 45, 60, 75, 90]
        records = []

        for angle in angles:
            rod = generate_rotated_rod(length=30.0, radius=2.0, angle_deg=angle, axis="z")
            kdop = KDOP14.from_coordinates(rod)

            v_aabb = kdop.aabb_volume()
            v_kdop = kdop.exact_volume()

            assert v_kdop is not None, "Exact KDOP volume computation failed"
            assert v_kdop <= v_aabb + 1e-6, f"KDOP volume ({v_kdop}) must be <= AABB volume ({v_aabb})"

            vol_reduction_pct = ((v_aabb - v_kdop) / v_aabb) * 100.0 if v_aabb > 0 else 0.0
            records.append({
                "angle": angle,
                "v_aabb": v_aabb,
                "v_kdop": v_kdop,
                "reduction_pct": vol_reduction_pct
            })

        # At 0° and 90° (axis aligned), reduction is modest
        # At 45°, reduction is strictly positive and significant
        rec_45 = next(r for r in records if r["angle"] == 45)
        assert rec_45["reduction_pct"] > 10.0, (
            f"At 45° diagonal rotation, KDOP should reduce volume by > 10%, got {rec_45['reduction_pct']:.2f}%"
        )

    def test_pairwise_bound_gap_tightness(self):
        """
        Compares bounding gap G = U - L between two parallel rotated rods.
        Confirms that KDOP14 produces a tighter or equal lower bound L without violating soundness.
        """
        cell = PeriodicCell.from_lengths_and_angles(100.0, 100.0, 100.0, 90.0, 90.0, 90.0)

        for angle in [0, 30, 45, 60]:
            rod_a = generate_rotated_rod(length=20.0, radius=2.0, angle_deg=angle) + np.array([20.0, 20.0, 50.0])
            rod_b = generate_rotated_rod(length=20.0, radius=2.0, angle_deg=angle) + np.array([50.0, 50.0, 50.0])

            kdop_a = KDOP14.from_coordinates(rod_a)
            kdop_b = KDOP14.from_coordinates(rod_b)

            aabb_a = kdop_a.get_aabb()
            aabb_b = kdop_b.get_aabb()

            L_aabb, U_aabb = compute_pbc_bounds(aabb_a, aabb_b, cell)
            L_kdop, U_kdop = kdop_a.compute_bounds(kdop_b, cell)

            d_min, d_max = oracle_exact_distances(rod_a, rod_b, cell.matrix)

            # Soundness guarantees
            assert L_aabb <= d_min + 1e-9
            assert L_kdop <= d_min + 1e-9
            assert d_max <= U_aabb + 1e-9
            assert d_max <= U_kdop + 1e-9

            # KDOP lower bound must be at least as informative as AABB
            assert L_kdop >= L_aabb - 1e-9, f"KDOP lower bound ({L_kdop}) cannot be worse than AABB ({L_aabb})"

    def test_compact_globular_object(self):
        """For isotropic/spherical clouds, AABB and KDOP both perform soundly."""
        np.random.seed(555)
        sphere_pts = np.random.normal(loc=0.0, scale=3.0, size=(100, 3))
        kdop = KDOP14.from_coordinates(sphere_pts)

        v_aabb = kdop.aabb_volume()
        v_kdop = kdop.exact_volume()

        assert v_kdop is not None
        assert v_kdop <= v_aabb
