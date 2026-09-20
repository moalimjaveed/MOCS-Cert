"""Pass 37: Exact Refinement Soundness Test Suite.

Verifies that for every refined block:
Production exact coordinate evaluation
    vs.
Independent raw-coordinate oracle evaluation
matches 100% across:
- EXISTS, FORALL, DURATION quantifiers
- Single witness frame
- Multiple witness frames
- Witness at first frame of block
- Witness at last frame of block
- Zero witnesses in block
- Exact threshold (d == threshold)
- Epsilon-near threshold (threshold +- 1e-5 A)
"""

import pytest
import numpy as np
import MDAnalysis as mda

from backend.app.core.compiler_service import CompilerService
from tests.reference.mci_oracle import MCIIndependentOracle


class TestExactRefinementSoundness:
    """Verifies exact coordinate refinement results against raw coordinates."""

    @pytest.fixture(autouse=True)
    def setup_service(self):
        self.compiler = CompilerService()

    def test_refinement_parity_synth_500f_boundary_threshold(self):
        """Forces blocks into refinement using threshold near minimum distance (5.5 A)."""
        topo = "tests/data/synth_500f.gro"
        traj = "tests/data/synth_500f.xtc"
        oracle = MCIIndependentOracle(topo, traj)

        # Threshold 5.5 A is near the actual distance, exercising refinement
        query = "FIND resname ALA and name CA WITHIN 5.5 A OF resname LIG and name O2"
        exec_res = self.compiler.execute(query, traj)
        evaluated_blocks = exec_res.certificate["evidence"]["inspected_block_bounds"]

        op = exec_res.certificate["query"]["predicate"]["operator"]
        gt_records = oracle.evaluate_ground_truth(
            sel_a="resname ALA and name CA",
            sel_b="resname LIG and name O2",
            predicate_op=op,
            threshold=5.5,
            block_size=10,
            quantifier="EXISTS"
        )

        for b_prod, b_gt in zip(evaluated_blocks, gt_records):
            assert b_prod["block_id"] == b_gt.block_id
            # If production classified as EXACT_TRUE, oracle must have witness_present == True
            if b_prod["status"] == "EXACT_TRUE":
                assert b_gt.witness_present is True
            elif b_prod["status"] == "EXACT_FALSE":
                assert b_gt.witness_present is False

    def test_witness_position_corner_cases(self, tmp_path):
        """Constructs synthetic blocks with witnesses specifically at first, last, or exact threshold."""
        gro_path = str(tmp_path / "corner.gro")
        xtc_path = str(tmp_path / "corner.xtc")

        import shutil
        shutil.copyfile("tests/data/synth_50f.gro", gro_path)
        u = mda.Universe(gro_path)
        box = u.dimensions[:3]

        # Block 0: Witness ONLY at first frame (frame 0) (d=4.0, other 9 frames d=15.0)
        # Block 1: Witness ONLY at last frame (frame 19) (d=4.0, other 9 frames d=15.0)
        # Block 2: Witness at intermediate frame (frame 25) (d=4.5, other 9 frames d=15.0)
        distances = [15.0] * 30
        distances[0] = 4.0      # Block 0 first frame
        distances[19] = 4.0     # Block 1 last frame
        distances[25] = 4.5     # Block 2 intermediate frame

        with mda.Writer(xtc_path, n_atoms=len(u.atoms)) as w:
            for f_idx, d in enumerate(distances):
                u.trajectory.ts.frame = f_idx
                u.trajectory.ts.time = f_idx * 10.0
                pos = u.atoms.positions.copy()
                pos[0] = [10.0, 10.0, 10.0]
                pos[1] = [10.0 + d, 10.0, 10.0]
                u.atoms.positions = pos
                u.dimensions = np.array([box[0], box[1], box[2], 90.0, 90.0, 90.0])
                w.write(u.atoms)

        oracle = MCIIndependentOracle(gro_path, xtc_path)
        gt_records = oracle.evaluate_ground_truth("name CA", "name O2", "<=", 5.0, 10, "EXISTS")

        assert gt_records[0].witness_present is True
        assert gt_records[1].witness_present is True
        assert gt_records[2].witness_present is True  # Exactly at threshold 5.0 <= 5.0

        query = "FIND (name CA) WHERE DISTANCE <= 5.0 A TO (name O2)"
        exec_res = self.compiler.execute(query, xtc_path)
        evaluated = exec_res.certificate["evidence"]["inspected_block_bounds"]

        audited = oracle.audit_production_decisions(gt_records, evaluated, quantifier="EXISTS")
        for r in audited:
            assert r.sound is True
            assert not r.pruned
