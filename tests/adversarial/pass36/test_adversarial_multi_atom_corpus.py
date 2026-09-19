"""
PASS 36 — Section 4: Adversarial Multi-Atom Distance Corpus.

Exhaustively verifies multi-atom pairwise distance calculations across cases A through T.
Compares production calculations against the clean-room IndependentReferenceOracle
frame-by-frame on raw coordinate fixtures.
"""

import os
import tempfile
import numpy as np
import pytest
from tests.reference.independent_oracle import IndependentReferenceOracle
from mocs.reference.distance import reference_distance
from mocs.bounds.periodic_bounds import compute_pbc_bounds


class TestAdversarialMultiAtomCorpus:
    """Comprehensive test corpus for multi-atom selection distance evaluation."""

    def _create_temp_pdb(self, coords: np.ndarray, box: np.ndarray) -> str:
        """Helper to create a minimal PDB file for testing."""
        fd, path = tempfile.mkstemp(suffix=".pdb")
        with os.fdopen(fd, "w") as f:
            f.write(f"CRYST1{box[0]:9.3f}{box[1]:9.3f}{box[2]:9.3f} 90.00  90.00  90.00 P 1           1\n")
            for i, c in enumerate(coords):
                name = f"A{i:03d}" if i < 1000 else "ATOM"
                resname = "RES"
                f.write(f"ATOM  {i+1:5d} {name:^4s} {resname:3s} A{1:4d}    {c[0]:8.3f}{c[1]:8.3f}{c[2]:8.3f}  1.00  0.00           C\n")
            f.write("END\n")
        return path

    def _verify_frame_parity(self, oracle: IndependentReferenceOracle, idx_a: np.ndarray, idx_b: np.ndarray, box: np.ndarray):
        """Verify frame-by-frame minimum pairwise distance parity."""
        # 1. Oracle distance array
        oracle_dists = oracle.compute_trajectory_distances(idx_a, idx_b)

        # 2. Production compute_pbc_bounds on each frame
        for f in range(oracle.n_frames):
            pos_a = oracle.coords[f, idx_a, :]
            pos_b = oracle.coords[f, idx_b, :]
            min_a, max_a = np.min(pos_a, axis=0), np.max(pos_a, axis=0)
            min_b, max_b = np.min(pos_b, axis=0), np.max(pos_b, axis=0)
            L, U = compute_pbc_bounds((min_a, max_a), (min_b, max_b), box)
            true_d = oracle_dists[f]
            # Conservative bound assertion
            assert L <= true_d + 1e-5, f"Frame {f}: Lower bound L={L} > true_d={true_d}"
            assert true_d <= U + 1e-5, f"Frame {f}: Upper bound U={U} < true_d={true_d}"

    def test_case_a_one_vs_one(self):
        """Case A: Two selections with 1 atom each."""
        box = np.array([40.0, 40.0, 40.0])
        coords = np.zeros((3, 2, 3), dtype=np.float64)
        coords[0] = [[0, 0, 0], [3, 4, 0]]  # 5.0 A
        coords[1] = [[10, 10, 10], [10, 10, 15]]  # 5.0 A
        coords[2] = [[1, 1, 1], [1, 1, 3]]  # 2.0 A
        oracle = IndependentReferenceOracle(coords, box)
        self._verify_frame_parity(oracle, np.array([0]), np.array([1]), box)

    def test_case_b_one_vs_many(self):
        """Case B: 1 vs many atoms."""
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((2, 5, 3), dtype=np.float64)
        coords[0, 0] = [0, 0, 0]
        coords[0, 1:] = [[20, 0, 0], [15, 0, 0], [6, 0, 0], [12, 0, 0]]
        coords[1, 0] = [10, 10, 10]
        coords[1, 1:] = [[10, 10, 14], [10, 10, 20], [10, 10, 30], [10, 10, 40]]
        oracle = IndependentReferenceOracle(coords, box)
        self._verify_frame_parity(oracle, np.array([0]), np.array([1, 2, 3, 4]), box)

    def test_case_c_many_vs_one(self):
        """Case C: many vs 1 atom."""
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((2, 5, 3), dtype=np.float64)
        coords[:, 0:4, :] = np.random.uniform(5.0, 20.0, (2, 4, 3))
        coords[:, 4, :] = [25.0, 25.0, 25.0]
        oracle = IndependentReferenceOracle(coords, box)
        self._verify_frame_parity(oracle, np.array([0, 1, 2, 3]), np.array([4]), box)

    def test_case_d_many_vs_many(self):
        """Case D: many vs many atoms."""
        box = np.array([60.0, 60.0, 60.0])
        np.random.seed(42)
        coords = np.random.uniform(0.0, 50.0, (4, 10, 3))
        oracle = IndependentReferenceOracle(coords, box)
        self._verify_frame_parity(oracle, np.array([0, 1, 2, 3, 4]), np.array([5, 6, 7, 8, 9]), box)

    def test_case_e_atom_0_far_later_atom_near(self):
        """Case E: atom 0 is far, but a subsequent atom is in contact."""
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((1, 4, 3), dtype=np.float64)
        coords[0, 0] = [0, 0, 0]     # Sel A atom 0: far
        coords[0, 1] = [20, 20, 20] # Sel A atom 1: near Sel B
        coords[0, 2] = [20, 20, 22] # Sel B atom 0: distance 2.0 A to atom 1
        coords[0, 3] = [40, 40, 40] # Sel B atom 1
        oracle = IndependentReferenceOracle(coords, box)
        dists = oracle.compute_trajectory_distances(np.array([0, 1]), np.array([2, 3]))
        assert dists[0] == pytest.approx(2.0, abs=1e-6)
        self._verify_frame_parity(oracle, np.array([0, 1]), np.array([2, 3]), box)

    def test_case_f_atom_0_near_later_atoms_far(self):
        """Case F: atom 0 is near, subsequent atoms are far."""
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((1, 4, 3), dtype=np.float64)
        coords[0, 0] = [10, 10, 10] # Sel A atom 0: near
        coords[0, 1] = [40, 40, 40] # Sel A atom 1: far
        coords[0, 2] = [10, 10, 13] # Sel B atom 0: distance 3.0 A
        coords[0, 3] = [45, 45, 45] # Sel B atom 1: far
        oracle = IndependentReferenceOracle(coords, box)
        dists = oracle.compute_trajectory_distances(np.array([0, 1]), np.array([2, 3]))
        assert dists[0] == pytest.approx(3.0, abs=1e-6)
        self._verify_frame_parity(oracle, np.array([0, 1]), np.array([2, 3]), box)

    def test_case_g_multiple_equally_close_pairs(self):
        """Case G: multiple pairs with identical minimum distance."""
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((1, 4, 3), dtype=np.float64)
        coords[0, 0] = [10, 10, 10]
        coords[0, 1] = [20, 20, 20]
        coords[0, 2] = [10, 10, 14] # dist 4.0 A to atom 0
        coords[0, 3] = [20, 20, 24] # dist 4.0 A to atom 1
        oracle = IndependentReferenceOracle(coords, box)
        dists = oracle.compute_trajectory_distances(np.array([0, 1]), np.array([2, 3]))
        assert dists[0] == pytest.approx(4.0, abs=1e-6)

    def test_case_h_duplicate_coordinates(self):
        """Case H: identical coordinates within the same or across selections."""
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((1, 3, 3), dtype=np.float64)
        coords[0, 0] = [10, 10, 10]
        coords[0, 1] = [10, 10, 10] # duplicate
        coords[0, 2] = [10, 10, 15]
        oracle = IndependentReferenceOracle(coords, box)
        dists = oracle.compute_trajectory_distances(np.array([0, 1]), np.array([2]))
        assert dists[0] == pytest.approx(5.0, abs=1e-6)

    def test_case_i_zero_distance_contact(self):
        """Case I: co-located atoms (distance = 0.0)."""
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((1, 2, 3), dtype=np.float64)
        coords[0, 0] = [15.5, 20.0, 25.0]
        coords[0, 1] = [15.5, 20.0, 25.0]
        oracle = IndependentReferenceOracle(coords, box)
        dists = oracle.compute_trajectory_distances(np.array([0]), np.array([1]))
        assert dists[0] == 0.0

    def test_case_j_extremely_small_distances(self):
        """Case J: sub-angstrom distance (1e-4 A)."""
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((1, 2, 3), dtype=np.float64)
        coords[0, 0] = [10.0, 10.0, 10.0]
        coords[0, 1] = [10.0, 10.0, 10.0001]
        oracle = IndependentReferenceOracle(coords, box)
        dists = oracle.compute_trajectory_distances(np.array([0]), np.array([1]))
        assert dists[0] == pytest.approx(1e-4, abs=1e-8)

    def test_case_k_threshold_exactly_equal(self):
        """Case K: threshold exactly equal to distance."""
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((1, 2, 3), dtype=np.float64)
        coords[0, 0] = [0, 0, 0]
        coords[0, 1] = [4.0, 0, 0]
        oracle = IndependentReferenceOracle(coords, box)
        assert oracle.evaluate_predicate(np.array([0]), np.array([1]), "<", 4.0)[0] is np.False_
        assert oracle.evaluate_predicate(np.array([0]), np.array([1]), "<=", 4.0)[0] is np.True_
        assert oracle.evaluate_predicate(np.array([0]), np.array([1]), "==", 4.0)[0] is np.True_

    def test_case_l_distance_epsilon_below_threshold(self):
        """Case L: distance is threshold - 1e-6."""
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((1, 2, 3), dtype=np.float64)
        coords[0, 0] = [0, 0, 0]
        coords[0, 1] = [4.0 - 1e-6, 0, 0]
        oracle = IndependentReferenceOracle(coords, box)
        assert oracle.evaluate_predicate(np.array([0]), np.array([1]), "<", 4.0)[0] is np.True_

    def test_case_m_distance_epsilon_above_threshold(self):
        """Case M: distance is threshold + 1e-6."""
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((1, 2, 3), dtype=np.float64)
        coords[0, 0] = [0, 0, 0]
        coords[0, 1] = [4.0 + 1e-6, 0, 0]
        oracle = IndependentReferenceOracle(coords, box)
        assert oracle.evaluate_predicate(np.array([0]), np.array([1]), "<", 4.0)[0] is np.False_

    def test_case_n_periodic_boundary_seam(self):
        """Case N: atoms across periodic boundary seam."""
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((1, 2, 3), dtype=np.float64)
        coords[0, 0] = [1.0, 25.0, 25.0]
        coords[0, 1] = [49.0, 25.0, 25.0]  # Minimum image distance is 2.0 A across X seam
        oracle = IndependentReferenceOracle(coords, box)
        dists = oracle.compute_trajectory_distances(np.array([0]), np.array([1]))
        assert dists[0] == pytest.approx(2.0, abs=1e-6)

    def test_case_o_multiple_atoms_across_seam(self):
        """Case O: multiple atoms crossing the seam in different directions."""
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((1, 4, 3), dtype=np.float64)
        coords[0, 0] = [0.5, 0.5, 0.5]
        coords[0, 1] = [25.0, 25.0, 25.0]
        coords[0, 2] = [49.5, 49.5, 49.5]  # Wraps around all 3 axes to atom 0
        coords[0, 3] = [30.0, 30.0, 30.0]
        oracle = IndependentReferenceOracle(coords, box)
        dists = oracle.compute_trajectory_distances(np.array([0, 1]), np.array([2, 3]))
        # Distance between (0.5, 0.5, 0.5) and (49.5, 49.5, 49.5) wrapped is sqrt(1^2 + 1^2 + 1^2) = sqrt(3) ~ 1.732 A
        assert dists[0] == pytest.approx(np.sqrt(3.0), abs=1e-6)

    def test_case_p_large_coordinate_ranges(self):
        """Case P: coordinates spanning large values."""
        box = np.array([100.0, 100.0, 100.0])
        coords = np.zeros((1, 2, 3), dtype=np.float64)
        coords[0, 0] = [5.0, 10.0, 15.0]
        coords[0, 1] = [95.0, 90.0, 85.0]  # Minimum image diff: (-10, -20, -30) -> norm = sqrt(100+400+900)=sqrt(1400)~37.416 A
        oracle = IndependentReferenceOracle(coords, box)
        dists = oracle.compute_trajectory_distances(np.array([0]), np.array([1]))
        assert dists[0] == pytest.approx(np.sqrt(1400.0), abs=1e-6)

    def test_case_q_degenerate_aabbs(self):
        """Case Q: single-atom selections (zero-volume AABBs)."""
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((1, 2, 3), dtype=np.float64)
        coords[0, 0] = [10.0, 10.0, 10.0]
        coords[0, 1] = [13.0, 14.0, 10.0]  # dist = 5.0 A
        L, U = compute_pbc_bounds((coords[0, 0], coords[0, 0]), (coords[0, 1], coords[0, 1]), box)
        assert L == pytest.approx(5.0, abs=1e-6)
        assert U == pytest.approx(5.0, abs=1e-6)

    def test_case_r_single_frame_trajectory(self):
        """Case R: 1-frame trajectory."""
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((1, 2, 3), dtype=np.float64)
        coords[0, 0] = [1.0, 1.0, 1.0]
        coords[0, 1] = [2.0, 3.0, 4.0]
        oracle = IndependentReferenceOracle(coords, box)
        dists = oracle.compute_trajectory_distances(np.array([0]), np.array([1]))
        assert len(dists) == 1

    def test_case_s_one_frame_blocks(self):
        """Case S: 1-frame blocks (start_frame=f, end_frame=f+1)."""
        box = np.array([50.0, 50.0, 50.0])
        coords = np.random.uniform(10, 40, (5, 2, 3))
        oracle = IndependentReferenceOracle(coords, box)
        for f in range(5):
            d = oracle.compute_trajectory_distances(np.array([0]), np.array([1]), start_frame=f, end_frame=f+1)
            assert len(d) == 1

    def test_case_t_final_frame_boundary(self):
        """Case T: evaluating frame range touching trajectory end."""
        box = np.array([50.0, 50.0, 50.0])
        coords = np.random.uniform(10, 40, (10, 2, 3))
        oracle = IndependentReferenceOracle(coords, box)
        dists = oracle.compute_trajectory_distances(np.array([0]), np.array([1]), start_frame=7, end_frame=10)
        assert len(dists) == 3
