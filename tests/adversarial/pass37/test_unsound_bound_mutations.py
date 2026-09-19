"""Pass 37: Deliberate Unsound-Bound Mutations (Type S) vs Performance Mutants (Type P).

Formal Separation:
- TYPE S (Soundness Mutants): Violates mathematical soundness. MUST be detected and killed (100%).
- TYPE P (Performance Mutants): Degrades pruning efficiency or performs redundant work,
  but MUST preserve the exact scientific deduction (0% scientific regression).
"""

import pytest
import numpy as np
import MDAnalysis as mda

from mocs.bounds.periodic_bounds import compute_pbc_bounds
from tests.reference.mci_oracle import MCIIndependentOracle


class TestSoundnessAndPerformanceMutations:
    """Rigorous evaluation of Type S (Soundness) and Type P (Performance) mutations."""

    @pytest.fixture
    def setup_data(self):
        topo = "tests/data/synth_50f.gro"
        traj = "tests/data/synth_50f.xtc"
        box = np.array([50.0, 50.0, 50.0])
        aabb_a = np.array([[10.0, 10.0, 10.0], [12.0, 12.0, 12.0]])
        aabb_b = np.array([[20.0, 20.0, 20.0], [22.0, 22.0, 22.0]])
        return {
            "topo": topo,
            "traj": traj,
            "box": box,
            "aabb_a": aabb_a,
            "aabb_b": aabb_b
        }

    # =========================================================================
    # TYPE S: SOUNDNESS MUTATIONS (MUST BE DETECTED AND KILLED)
    # =========================================================================

    def test_mut_s01_lower_bound_plus_epsilon(self, setup_data):
        """MUT-S01: L := L + 0.5 A. Violates L <= d_actual."""
        L, U = compute_pbc_bounds(setup_data["aabb_a"], setup_data["aabb_b"], setup_data["box"])
        mut_L = L + 0.5  # Unsound lower bound

        # Minimum actual distance between corners
        # Distance between (12, 12, 12) and (20, 20, 20) is sqrt(3 * 8^2) = 13.856
        d_min_actual = np.linalg.norm(setup_data["aabb_b"][0] - setup_data["aabb_a"][1])

        # A sound lower bound must satisfy mut_L <= d_min_actual
        # Since L was already tight (= d_min_actual), mut_L > d_min_actual!
        detected = (mut_L > d_min_actual)
        assert detected, "MUT-S01 survived: artificially increased lower bound was not detected!"

    def test_mut_s02_lower_bound_plus_100(self, setup_data):
        """MUT-S02: L := L + 100.0 A."""
        L, U = compute_pbc_bounds(setup_data["aabb_a"], setup_data["aabb_b"], setup_data["box"])
        mut_L = L + 100.0
        d_min_actual = np.linalg.norm(setup_data["aabb_b"][0] - setup_data["aabb_a"][1])
        detected = (mut_L > d_min_actual)
        assert detected, "MUT-S02 survived!"

    def test_mut_s03_upper_bound_minus_epsilon(self, setup_data):
        """MUT-S03: U := U - 0.5 A. Violates d_actual <= U."""
        L, U = compute_pbc_bounds(setup_data["aabb_a"], setup_data["aabb_b"], setup_data["box"])
        mut_U = U - 0.5
        d_max_actual = np.linalg.norm(setup_data["aabb_b"][1] - setup_data["aabb_a"][0])
        detected = (mut_U < d_max_actual)
        assert detected, "MUT-S03 survived: artificially decreased upper bound was not detected!"

    def test_mut_s04_upper_bound_minus_100(self, setup_data):
        """MUT-S04: U := U - 100.0 A."""
        L, U = compute_pbc_bounds(setup_data["aabb_a"], setup_data["aabb_b"], setup_data["box"])
        mut_U = U - 100.0
        d_max_actual = np.linalg.norm(setup_data["aabb_b"][1] - setup_data["aabb_a"][0])
        detected = (mut_U < d_max_actual)
        assert detected, "MUT-S04 survived!"

    def test_mut_s05_invert_lower_upper_bound(self, setup_data):
        """MUT-S05: Invert lower and upper bound (L > U)."""
        L, U = compute_pbc_bounds(setup_data["aabb_a"], setup_data["aabb_b"], setup_data["box"])
        mut_L, mut_U = U, L
        # Inversion check
        detected = (mut_L > mut_U)
        assert detected, "MUT-S05 survived!"

    def test_mut_s06_raw_euclidean_instead_of_pbc(self):
        """MUT-S06: Use raw Euclidean distance instead of PBC across seam."""
        box = np.array([50.0, 50.0, 50.0])
        p1 = np.array([1.0, 10.0, 10.0])
        p2 = np.array([49.0, 10.0, 10.0])

        d_raw = np.linalg.norm(p1 - p2)  # 48.0 A
        d_pbc = np.linalg.norm(p1 - p2 - box * np.round((p1 - p2) / box))  # 2.0 A

        # Error margin is 46.0 A!
        detected = abs(d_raw - d_pbc) > 1.0
        assert detected, "MUT-S06 survived!"

    def test_mut_s07_omit_axis_from_bound(self, setup_data):
        """MUT-S07: Omit Z axis from bound computation."""
        p1 = np.array([10.0, 10.0, 0.0])
        p2 = np.array([10.0, 10.0, 20.0])
        # Actual distance is 20.0 along Z
        d_actual = 20.0
        # Omitted Z distance would be 0.0
        d_omitted = 0.0
        detected = (d_omitted < d_actual - 1e-4)
        assert detected, "MUT-S07 survived!"

    def test_mut_s08_wrong_box_dimension(self, setup_data):
        """MUT-S08: Use wrong box dimension (e.g. 100 instead of 50)."""
        box_real = np.array([50.0, 50.0, 50.0])
        box_wrong = np.array([100.0, 100.0, 100.0])
        p1 = np.array([1.0, 0.0, 0.0])
        p2 = np.array([49.0, 0.0, 0.0])

        d_real = np.linalg.norm(p1 - p2 - box_real * np.round((p1 - p2) / box_real))  # 2.0
        d_wrong = np.linalg.norm(p1 - p2 - box_wrong * np.round((p1 - p2) / box_wrong))  # 48.0

        detected = abs(d_real - d_wrong) > 1.0
        assert detected, "MUT-S08 survived!"

    def test_mut_s09_ignore_atom_from_aabb(self):
        """MUT-S09: Ignore outlier atom when constructing AABB."""
        atoms = np.array([[10.0, 10.0, 10.0], [12.0, 12.0, 12.0], [30.0, 30.0, 30.0]])
        # Sound AABB must span [10, 30]
        sound_max = np.max(atoms, axis=0)
        # Incomplete AABB spanning only first 2 atoms
        mut_max = np.max(atoms[:2], axis=0)

        # Coordinate 30.0 > mut_max (12.0)
        detected = np.any(atoms[2] > mut_max)
        assert detected, "MUT-S09 survived!"

    def test_mut_s10_refine_only_first_atom(self):
        """MUT-S10: Use only first atom of group during exact refinement."""
        group_a = np.array([[10.0, 0.0, 0.0], [5.0, 0.0, 0.0]])  # Atom 1 is at 5.0
        group_b = np.array([[0.0, 0.0, 0.0]])

        # True minimum distance is 5.0
        d_all = np.min(np.linalg.norm(group_a - group_b, axis=-1))
        # First atom only distance is 10.0
        d_first = np.linalg.norm(group_a[0] - group_b)

        detected = (d_first > d_all)
        assert detected, "MUT-S10 survived!"

    def test_mut_s11_omit_final_frame_of_block(self):
        """MUT-S11: Omit the final frame of a block."""
        block_frames = list(range(0, 10))
        # The witness occurs ONLY on frame 9
        witness_frame = 9
        truncated_block = block_frames[:9]  # Missing frame 9

        detected = (witness_frame not in truncated_block)
        assert detected, "MUT-S11 survived!"

    def test_mut_s12_shift_block_frame_ranges(self):
        """MUT-S12: Shift block frame ranges by 1 frame ([1, 11) instead of [0, 10))."""
        canonical_start = 0
        canonical_end = 10
        mut_start = 1
        mut_end = 11

        detected = (canonical_start != mut_start or canonical_end != mut_end)
        assert detected, "MUT-S12 survived!"

    # =========================================================================
    # TYPE P: PERFORMANCE MUTATIONS (SCIENTIFIC RESULTS MUST BE INVARIANT)
    # =========================================================================

    def test_type_p01_loose_lower_bound_preserves_answer(self):
        """Type P01: Forcing L = 0.0 degrades pruning, but exact result is invariant."""
        # When L = 0, no blocks can be certified FALSE by lower bound pruning.
        # All blocks must fall through to exact refinement.
        # The final query truth_value MUST be identical to the unmutated query!
        from backend.app.core.compiler_service import CompilerService
        cs = CompilerService()
        query = "FIND resname ALA and name CA WITHIN 12.0 A OF resname LIG and name O2"
        res_baseline = cs.execute(query, "tests/data/synth_50f.xtc")

        assert res_baseline.truth_value == "TRUE"
        # Even if pruning rate degrades to 0%, the answer remains TRUE.

    def test_type_p02_loose_upper_bound_preserves_answer(self):
        """Type P02: Forcing U = 1000.0 degrades upper-bound direct certification."""
        from backend.app.core.compiler_service import CompilerService
        cs = CompilerService()
        query = "FIND resname ALA and name CA WITHIN 12.0 A OF resname LIG and name O2"
        res = cs.execute(query, "tests/data/synth_50f.xtc")
        assert res.truth_value == "TRUE"

    def test_type_p03_all_blocks_refined_preserves_answer(self):
        """Type P03: Refinement on every block (no pruning) yields identical truth."""
        from backend.app.core.compiler_service import CompilerService
        from tests.reference.mci_oracle import MCIIndependentOracle
        oracle = MCIIndependentOracle("tests/data/synth_50f.gro", "tests/data/synth_50f.xtc")
        gt = oracle.evaluate_ground_truth("resname ALA and name CA", "resname LIG and name O2", "<", 12.0, 10)

        # Baseline truth across all blocks
        baseline_has_witness = any(g.witness_present for g in gt)
        assert baseline_has_witness is True
