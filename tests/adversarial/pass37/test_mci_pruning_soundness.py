"""Pass 37: Exhaustive MCI Pruning Soundness Test Suite.

Verifies the Central Invariant of MOCS-Cert:
PRUNING MUST NEVER REMOVE A BLOCK THAT COULD CONTAIN A VALID ANSWER.
Formally:
    PRODUCTION_PRUNED => NO WITNESS PRESENT IN BLOCK.
    Forbidden condition: PRUNED and WITNESS_EXISTS.
"""

import os
import pytest
import numpy as np
import MDAnalysis as mda

from backend.app.core.compiler_service import CompilerService
from tests.reference.mci_oracle import MCIIndependentOracle


class TestMCIPruningSoundness:
    """Verifies block-by-block pruning decisions against independent ground truth."""

    @pytest.fixture(autouse=True)
    def setup_service(self):
        self.compiler = CompilerService()

    def test_synth_500f_pruning_soundness_exists_multiple_thresholds(self):
        """Tests synth_500f across multiple thresholds: tight, boundary, loose."""
        topo = "tests/data/synth_500f.gro"
        traj = "tests/data/synth_500f.xtc"
        oracle = MCIIndependentOracle(topo, traj)

        thresholds = [2.0, 4.0, 5.5, 6.0, 10.0, 15.0]

        for thresh in thresholds:
            query = f"FIND resname ALA and name CA WITHIN {thresh} A OF resname LIG and name O2"
            exec_res = self.compiler.execute(query, traj)

            evaluated_blocks = exec_res.certificate["evidence"]["inspected_block_bounds"]
            assert len(evaluated_blocks) == 50, f"Expected 50 blocks, got {len(evaluated_blocks)}"

            op = exec_res.certificate["query"]["predicate"]["operator"]

            gt_records = oracle.evaluate_ground_truth(
                sel_a="resname ALA and name CA",
                sel_b="resname LIG and name O2",
                predicate_op=op,
                threshold=thresh,
                block_size=10,
                quantifier="EXISTS"
            )

            audited = oracle.audit_production_decisions(gt_records, evaluated_blocks, quantifier="EXISTS")

            unsound_blocks = [r for r in audited if not r.sound]
            assert len(unsound_blocks) == 0, (
                f"Threshold {thresh} Å had {len(unsound_blocks)} unsound blocks! Violations:\n" +
                "\n".join(r.violation_reason for r in unsound_blocks if r.violation_reason)
            )

            # Assert Forbidden Condition: PRUNED and WITNESS_EXISTS == 0
            pruned_with_witness = [r for r in audited if r.pruned and r.witness_present]
            assert len(pruned_with_witness) == 0, (
                f"FATAL: {len(pruned_with_witness)} blocks were PRUNED despite containing witnesses!"
            )

    def test_synth_50f_pruning_soundness_exists(self):
        """Tests synth_50f.xtc with independent oracle."""
        topo = "tests/data/synth_50f.gro"
        traj = "tests/data/synth_50f.xtc"
        oracle = MCIIndependentOracle(topo, traj)

        for thresh in [3.0, 5.5, 8.0]:
            query = f"FIND resname ALA and name CA WITHIN {thresh} A OF resname LIG and name O2"
            exec_res = self.compiler.execute(query, traj)
            evaluated_blocks = exec_res.certificate["evidence"]["inspected_block_bounds"]

            op = exec_res.certificate["query"]["predicate"]["operator"]

            gt_records = oracle.evaluate_ground_truth(
                sel_a="resname ALA and name CA",
                sel_b="resname LIG and name O2",
                predicate_op=op,
                threshold=thresh,
                block_size=10,
                quantifier="EXISTS"
            )

            audited = oracle.audit_production_decisions(gt_records, evaluated_blocks, quantifier="EXISTS")
            unsound = [r for r in audited if not r.sound]
            assert len(unsound) == 0

    def test_hand_built_boundary_trajectories(self, tmp_path):
        """Constructs hand-built trajectory where particles cross threshold exactly in specific blocks."""
        gro_path = str(tmp_path / "test_boundary.gro")
        xtc_path = str(tmp_path / "test_boundary.xtc")

        # Copy synth_50f.gro as base topology
        import shutil
        shutil.copyfile("tests/data/synth_50f.gro", gro_path)

        u = mda.Universe(gro_path)
        box = u.dimensions[:3]
        n_frames = 40
        block_size = 10

        # Block 0: dist = 12.0 (Threshold = 10.0 => FALSE)
        # Block 1: dist = 8.0  (Threshold = 10.0 => TRUE, witness in all frames)
        # Block 2: dist starts at 12.0 and drops to 7.0 at frame 25 (MIXED => witness present)
        # Block 3: dist = 20.0 (Threshold = 10.0 => FALSE)

        distances = []
        for f in range(n_frames):
            if f < 10:
                d = 12.0
            elif f < 20:
                d = 8.0
            elif f < 30:
                d = 12.0 if f < 25 else 7.0
            else:
                d = 20.0
            distances.append(d)

        with mda.Writer(xtc_path, n_atoms=len(u.atoms)) as w:
            for f_idx, d in enumerate(distances):
                u.trajectory.ts.frame = f_idx
                u.trajectory.ts.time = f_idx * 10.0
                pos = u.atoms.positions.copy()
                pos[0] = [10.0, 10.0, 10.0]        # resname ALA name CA
                pos[1] = [10.0 + d, 10.0, 10.0]    # resname LIG name O2
                u.atoms.positions = pos
                u.dimensions = np.array([box[0], box[1], box[2], 90.0, 90.0, 90.0])
                w.write(u.atoms)

        oracle = MCIIndependentOracle(gro_path, xtc_path)
        gt_records = oracle.evaluate_ground_truth(
            sel_a="name CA",
            sel_b="name O2",
            predicate_op="<",
            threshold=10.0,
            block_size=10,
            quantifier="EXISTS"
        )

        # Ground truth expectations:
        assert gt_records[0].witness_present is False
        assert gt_records[1].witness_present is True
        assert gt_records[2].witness_present is True  # frame 25-29 are 7.0 < 10.0
        assert gt_records[3].witness_present is False

        query = "FIND name CA WITHIN 10.0 A OF name O2"
        exec_res = self.compiler.execute(query, xtc_path)
        evaluated_blocks = exec_res.certificate["evidence"]["inspected_block_bounds"]

        audited = oracle.audit_production_decisions(gt_records, evaluated_blocks, quantifier="EXISTS")

        for r in audited:
            assert r.sound is True, f"Block {r.block_id} failed soundness check: {r.violation_reason}"
            if r.witness_present:
                assert not r.pruned, f"Block {r.block_id} has witness but was PRUNED!"

    def test_false_positive_false_negative_matrix(self):
        """Constructs and validates the formal FP/FN matrix across 500 frames."""
        topo = "tests/data/synth_500f.gro"
        traj = "tests/data/synth_500f.xtc"
        oracle = MCIIndependentOracle(topo, traj)

        matrix = {
            "exact_false_pruned": 0,
            "exact_false_refined": 0,
            "exact_true_refined": 0,
            "exact_true_direct_certified": 0,
            "exact_unknown_refined": 0,
            "FORBIDDEN_exact_true_pruned": 0,
            "FORBIDDEN_witness_classified_impossible": 0,
            "FORBIDDEN_exact_false_certified_true": 0,
            "FORBIDDEN_exact_true_certified_false": 0,
        }

        # Spectrum of thresholds: tight, boundary, loose
        for thresh in [3.0, 5.0, 5.5, 6.0, 15.0]:
            query = f"FIND resname ALA and name CA WITHIN {thresh} A OF resname LIG and name O2"
            exec_res = self.compiler.execute(query, traj)
            evaluated_blocks = exec_res.certificate["evidence"]["inspected_block_bounds"]

            op = exec_res.certificate["query"]["predicate"]["operator"]

            gt_records = oracle.evaluate_ground_truth(
                sel_a="resname ALA and name CA",
                sel_b="resname LIG and name O2",
                predicate_op=op,
                threshold=thresh,
                block_size=10,
                quantifier="EXISTS"
            )

            audited = oracle.audit_production_decisions(gt_records, evaluated_blocks, quantifier="EXISTS")

            for r in audited:
                if not r.witness_present and r.pruned:
                    matrix["exact_false_pruned"] += 1
                elif not r.witness_present and r.refined:
                    matrix["exact_false_refined"] += 1
                elif r.witness_present and r.refined:
                    matrix["exact_true_refined"] += 1
                elif r.witness_present and r.production_classification == "CERTIFIED_TRUE":
                    matrix["exact_true_direct_certified"] += 1

                # Check forbidden states
                if r.witness_present and r.pruned:
                    matrix["FORBIDDEN_exact_true_pruned"] += 1
                    matrix["FORBIDDEN_witness_classified_impossible"] += 1
                if not r.witness_present and r.production_classification == "CERTIFIED_TRUE":
                    matrix["FORBIDDEN_exact_false_certified_true"] += 1
                if r.witness_present and r.production_classification == "CERTIFIED_FALSE":
                    matrix["FORBIDDEN_exact_true_certified_false"] += 1

        # Assert all forbidden cells are STRICTLY ZERO
        assert matrix["FORBIDDEN_exact_true_pruned"] == 0
        assert matrix["FORBIDDEN_witness_classified_impossible"] == 0
        assert matrix["FORBIDDEN_exact_false_certified_true"] == 0
        assert matrix["FORBIDDEN_exact_true_certified_false"] == 0

        # Assert valid branches were visited
        assert matrix["exact_false_pruned"] + matrix["exact_true_direct_certified"] + matrix["exact_true_refined"] > 0
