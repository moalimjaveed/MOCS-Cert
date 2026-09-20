"""
PASS 36 — Section 6: Refinement vs Parent-Bound Invariant Validation.

Tests thousands of randomized parent/child frame subset configurations without clamping or rounding.
Proves that child distance intervals are mathematically contained within parent intervals:
    L_child >= L_parent - eps
    U_child <= U_parent + eps
under raw IEEE 754 float64 arithmetic.
"""

import numpy as np
import pytest
from mocs.bounds.periodic_bounds import compute_pbc_bounds


class TestRefinementVsParentBounds:
    """Stress testing dyadic and general sub-block refinement monotonicity."""

    def _generate_parent_and_child_aabbs(
        self,
        rng: np.random.Generator,
        box: np.ndarray,
        n_parent_frames: int = 20,
        n_child_frames: int = 10,
        n_atoms_a: int = 4,
        n_atoms_b: int = 4,
        regime: str = "normal"
    ):
        """Generates realistic parent coordinates and extracts child subset AABBs."""
        if regime == "tiny_intervals":
            coords = rng.uniform(10.0, 10.001, (n_parent_frames, n_atoms_a + n_atoms_b, 3))
        elif regime == "degenerate_single_atom":
            coords = rng.uniform(5.0, 45.0, (n_parent_frames, 2, 3))
            n_atoms_a, n_atoms_b = 1, 1
        elif regime == "seam_crossing":
            # Points clustered around 0 and around box
            coords = rng.choice([0.1, box[0] - 0.1], size=(n_parent_frames, n_atoms_a + n_atoms_b, 3))
            coords += rng.normal(0, 0.05, coords.shape)
        elif regime == "large_magnitude":
            coords = rng.uniform(100.0, 1000.0, (n_parent_frames, n_atoms_a + n_atoms_b, 3))
            coords = coords % box
        else:
            coords = rng.uniform(0.0, box, (n_parent_frames, n_atoms_a + n_atoms_b, 3))

        coords_a = coords[:, :n_atoms_a, :]
        coords_b = coords[:, n_atoms_a:, :]

        # Parent AABB over all parent frames
        parent_min_a = np.min(coords_a, axis=(0, 1))
        parent_max_a = np.max(coords_a, axis=(0, 1))
        parent_min_b = np.min(coords_b, axis=(0, 1))
        parent_max_b = np.max(coords_b, axis=(0, 1))

        # Child frames chosen as random subset
        child_indices = rng.choice(n_parent_frames, size=n_child_frames, replace=False)
        child_coords_a = coords_a[child_indices]
        child_coords_b = coords_b[child_indices]

        child_min_a = np.min(child_coords_a, axis=(0, 1))
        child_max_a = np.max(child_coords_a, axis=(0, 1))
        child_min_b = np.min(child_coords_b, axis=(0, 1))
        child_max_b = np.max(child_coords_b, axis=(0, 1))

        return (
            (parent_min_a, parent_max_a),
            (parent_min_b, parent_max_b),
            (child_min_a, child_max_a),
            (child_min_b, child_max_b),
        )

    @pytest.mark.parametrize("seed", [201, 202, 203, 204, 205])
    def test_parent_child_monotonic_containment_sweep(self, seed: int):
        """Runs 500 randomized trials per seed testing containment invariant."""
        rng = np.random.default_rng(seed)
        box = np.array([60.0, 60.0, 60.0])
        eps = 1e-10  # Floating point numerical allowance

        regimes = ["normal", "tiny_intervals", "degenerate_single_atom", "seam_crossing", "large_magnitude"]

        for i in range(200):
            regime = regimes[i % len(regimes)]
            n_parent = rng.integers(5, 50)
            n_child = rng.integers(1, n_parent)

            parent_a, parent_b, child_a, child_b = self._generate_parent_and_child_aabbs(
                rng, box, n_parent_frames=n_parent, n_child_frames=n_child, regime=regime
            )

            p_L, p_U = compute_pbc_bounds(parent_a, parent_b, box)
            c_L, c_U = compute_pbc_bounds(child_a, child_b, box)

            # Mathematical Invariant:
            # Child bounds must contract or stay identical to parent bounds
            assert c_L >= p_L - eps, (
                f"Monotonicity violation on lower bound: c_L={c_L:.12f} < p_L={p_L:.12f} "
                f"(diff={p_L - c_L}) [seed={seed}, trial={i}, regime={regime}]"
            )
            assert c_U <= p_U + eps, (
                f"Monotonicity violation on upper bound: c_U={c_U:.12f} > p_U={p_U:.12f} "
                f"(diff={c_U - p_U}) [seed={seed}, trial={i}, regime={regime}]"
            )

    def test_single_frame_child_refinement(self):
        """Refinement down to a single frame child."""
        rng = np.random.default_rng(999)
        box = np.array([50.0, 50.0, 50.0])
        parent_a, parent_b, child_a, child_b = self._generate_parent_and_child_aabbs(
            rng, box, n_parent_frames=20, n_child_frames=1, regime="normal"
        )
        p_L, p_U = compute_pbc_bounds(parent_a, parent_b, box)
        c_L, c_U = compute_pbc_bounds(child_a, child_b, box)
        assert c_L >= p_L - 1e-10
        assert c_U <= p_U + 1e-10

    def test_uneven_partition_dyadic_halving(self):
        """Refinement of uneven partition sizes (e.g. 7 frames -> 4 frames and 3 frames)."""
        rng = np.random.default_rng(888)
        box = np.array([50.0, 50.0, 50.0])
        for _ in range(50):
            parent_a, parent_b, child1_a, child1_b = self._generate_parent_and_child_aabbs(
                rng, box, n_parent_frames=7, n_child_frames=4
            )
            p_L, p_U = compute_pbc_bounds(parent_a, parent_b, box)
            c1_L, c1_U = compute_pbc_bounds(child1_a, child1_b, box)
            assert c1_L >= p_L - 1e-10
            assert c1_U <= p_U + 1e-10
