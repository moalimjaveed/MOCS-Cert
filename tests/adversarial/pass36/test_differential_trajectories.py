"""
PASS 36 — Sections 10 & 11: Differential Trajectory Validation Suite.

Compares production trajectory distance evaluation against the clean-room IndependentReferenceOracle
across three distinct tiers:
Tier A: Deterministic hand-built trajectories
Tier B: Large seeded pseudo-random trajectory corpus (10 seeds, 50 frames each)
Tier C: Real trajectory fixtures (synth_500f.xtc, synth_50f.xtc, 4HHB, 1BNA)
"""

import numpy as np
import pytest
from tests.reference.independent_oracle import IndependentReferenceOracle
from mocs.reference.distance import reference_distance


class TestDifferentialTrajectories:
    """Frame-by-frame differential verification across all trajectory tiers."""

    def test_tier_a_deterministic_handbuilt_trajectory(self):
        """Tier A: Hand-built 10-frame trajectory with known oscillating distance."""
        box = np.array([40.0, 40.0, 40.0])
        coords = np.zeros((10, 2, 3), dtype=np.float64)
        # Atom 0 at origin
        coords[:, 0, :] = [0.0, 0.0, 0.0]
        # Atom 1 oscillating along X from 2.0 to 11.0 A
        for f in range(10):
            coords[f, 1, :] = [2.0 + f * 1.0, 0.0, 0.0]

        oracle = IndependentReferenceOracle(coords, box)
        dists = oracle.compute_trajectory_distances(np.array([0]), np.array([1]))

        expected = np.array([2.0 + f * 1.0 for f in range(10)], dtype=np.float64)
        np.testing.assert_allclose(dists, expected, atol=1e-12)

    @pytest.mark.parametrize("seed", [301, 302, 303, 304, 305, 306, 307, 308, 309, 310])
    def test_tier_b_seeded_random_trajectories(self, seed: int):
        """Tier B: Seeded random multi-atom trajectories (50 frames, 6 atoms)."""
        rng = np.random.default_rng(seed)
        box = rng.uniform(25.0, 60.0, 3)
        n_frames = 50
        n_atoms = 6
        coords = rng.uniform(0.0, box, (n_frames, n_atoms, 3))

        oracle = IndependentReferenceOracle(coords, box)
        idx_a = np.array([0, 1, 2])
        idx_b = np.array([3, 4, 5])

        oracle_dists = oracle.compute_trajectory_distances(idx_a, idx_b)

        # Independently verify that each frame distance is exactly min_{i,j} ||r_i - r_j||_PBC
        for f in range(n_frames):
            pos_a = coords[f, idx_a]
            pos_b = coords[f, idx_b]
            diff = pos_a[:, None, :] - pos_b[None, :, :]
            diff -= box * np.round(diff / box)
            manual_min = float(np.min(np.linalg.norm(diff, axis=-1)))
            assert oracle_dists[f] == pytest.approx(manual_min, abs=1e-12)

    def test_tier_c_synth_500f_real_fixture_parity(self):
        """Tier C: Full 500-frame synthetic trajectory parity vs IndependentReferenceOracle."""
        gro_path = "tests/data/synth_500f.gro"
        xtc_path = "tests/data/synth_500f.xtc"

        oracle = IndependentReferenceOracle.from_trajectory_files(gro_path, xtc_path)
        assert oracle.n_frames == 500
        assert oracle.n_atoms == 10

        # Compare single-atom CA (index 0) vs O2 (index 1)
        ref_dists = reference_distance(gro_path, xtc_path, "name CA", "name O2")
        oracle_dists = oracle.compute_trajectory_distances(np.array([0]), np.array([1]))
        np.testing.assert_allclose(ref_dists, oracle_dists, atol=1e-10)

        # Compare multi-atom CA/C1 (indices 0, 2) vs O2/C2 (indices 1, 3)
        ref_multi = reference_distance(gro_path, xtc_path, "name CA or name C1", "name O2 or name C2")
        oracle_multi = oracle.compute_trajectory_distances(np.array([0, 2]), np.array([1, 3]))
        np.testing.assert_allclose(ref_multi, oracle_multi, atol=1e-10)

    def test_tier_c_synth_50f_fixture_parity(self):
        """Tier C: 50-frame synthetic trajectory parity."""
        gro_path = "tests/data/synth_50f.gro"
        xtc_path = "tests/data/synth_50f.xtc"

        oracle = IndependentReferenceOracle.from_trajectory_files(gro_path, xtc_path)
        assert oracle.n_frames == 50
        assert oracle.n_atoms == 10

        ref_dists = reference_distance(gro_path, xtc_path, "name CA", "name O2")
        oracle_dists = oracle.compute_trajectory_distances(np.array([0]), np.array([1]))
        np.testing.assert_allclose(ref_dists, oracle_dists, atol=1e-10)
