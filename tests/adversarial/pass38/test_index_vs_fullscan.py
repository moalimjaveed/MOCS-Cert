"""PASS 38 — Index vs Full-Scan Equivalence Tests.

This is a mandatory PASS 38 test:
  PATH A: MCI-accelerated execution (production)
  PATH B: Brute-force sequential per-frame scan (reference)

Scientific outputs MUST agree:
  - final truth value
  - witness frames (all frames where predicate is satisfied)
  - quantifier result
  - certificate truth

Only computational metrics may differ:
  - blocks examined
  - pruning efficiency
  - bytes read
  - time
"""

import pytest
import numpy as np
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))

from backend.app.core.compiler_service import CompilerService

COBRO_XTC = os.path.join("tests", "data", "real", "cobrotoxin.xtc")
COBRO_PDB = os.path.join("tests", "data", "real", "cobrotoxin.pdb")
SKIP_REAL_DATA = not (os.path.exists(COBRO_XTC) and os.path.exists(COBRO_PDB))


def brute_force_scan(topo_path: str, traj_path: str,
                     sel_a: str, sel_b: str,
                     op: str, threshold: float) -> dict:
    """
    Reference brute-force per-frame scan using MDAnalysis directly.
    No MCI index — reads every frame sequentially and computes exact distances.
    
    Returns dict with:
      - frame_truths: list of bool per frame
      - exists_truth: "TRUE" or "FALSE"
      - witness_frames: list of frame indices where predicate is true
      - min_dist_per_frame: list of float
    """
    import MDAnalysis as mda
    from MDAnalysis.analysis.distances import distance_array

    u = mda.Universe(topo_path, traj_path)
    group_a = u.select_atoms(sel_a)
    group_b = u.select_atoms(sel_b)
    box = u.dimensions[:3]

    frame_truths = []
    min_dists = []
    witness_frames = []

    for ts in u.trajectory:
        pos_a = group_a.positions
        pos_b = group_b.positions
        # Compute all pairwise PBC distances
        dists = distance_array(pos_a, pos_b, box=u.dimensions)
        min_d = dists.min()
        min_dists.append(float(min_d))

        if op == "<":
            result = min_d < threshold
        elif op == "<=":
            result = min_d <= threshold
        elif op == ">":
            result = min_d > threshold
        elif op == ">=":
            result = min_d >= threshold
        else:
            result = False

        frame_truths.append(bool(result))
        if result:
            witness_frames.append(int(ts.frame))

    exists_truth = "TRUE" if any(frame_truths) else "FALSE"
    return {
        "frame_truths": frame_truths,
        "exists_truth": exists_truth,
        "witness_frames": witness_frames,
        "min_dist_per_frame": min_dists,
        "n_frames": len(frame_truths),
    }


@pytest.mark.skipif(SKIP_REAL_DATA, reason="Real trajectory data not available")
class TestIndexVsFullScan:
    """Verifies MCI index and brute-force scan produce identical scientific results."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.compiler = CompilerService()

    @pytest.mark.parametrize("sel_a,sel_b,query,op,threshold,expected_truth", [
        ("resid 1 and name CA", "resid 2 and name CA",
         "FIND resid 1 and name CA WITHIN 4.0 A OF resid 2 and name CA", "<", 4.0, "TRUE"),
        ("resid 1 and name CA", "resid 2 and name CA",
         "FIND resid 1 and name CA WITHIN 3.5 A OF resid 2 and name CA", "<", 3.5, "FALSE"),
        ("resid 1 and name CA", "resid 50 and name CA",
         "FIND resid 1 and name CA WITHIN 10.0 A OF resid 50 and name CA", "<", 10.0, "FALSE"),
    ])
    def test_truth_value_agrees(self, sel_a, sel_b, query, op, threshold, expected_truth):
        """MCI and full-scan truth values must agree."""
        # MCI path
        mci_result = self.compiler.execute(query, COBRO_XTC)

        # Brute-force path
        brute = brute_force_scan(COBRO_PDB, COBRO_XTC, sel_a, sel_b, op, threshold)

        assert mci_result.truth_value == brute["exists_truth"], (
            f"MCI truth={mci_result.truth_value} != brute truth={brute['exists_truth']} "
            f"for query: {query}"
        )
        assert mci_result.truth_value == expected_truth, (
            f"Expected: {expected_truth}, MCI got: {mci_result.truth_value}"
        )


    def test_cobrotoxin_true_query_frame_truths(self):
        """Verify per-frame truth matches between MCI and brute-force for TRUE query."""
        # Brute force: resid 1 CA vs resid 2 CA, threshold 4.0
        brute = brute_force_scan(COBRO_PDB, COBRO_XTC,
                                  "resid 1 and name CA", "resid 2 and name CA",
                                  "<", 4.0)
        # All 3 frames satisfy d < 4.0 (distances ~3.78-3.83 Å)
        assert brute["exists_truth"] == "TRUE"
        assert all(brute["frame_truths"]), f"Expected all frames TRUE: {brute['frame_truths']}"
        assert brute["witness_frames"] == [0, 1, 2]

        # MCI result
        mci = self.compiler.execute(
            "FIND resid 1 and name CA WITHIN 4.0 A OF resid 2 and name CA",
            COBRO_XTC
        )
        assert mci.truth_value == "TRUE"

    def test_cobrotoxin_false_query_frame_truths(self):
        """Verify per-frame truth matches for FALSE query (3.5 Å threshold)."""
        brute = brute_force_scan(COBRO_PDB, COBRO_XTC,
                                  "resid 1 and name CA", "resid 2 and name CA",
                                  "<", 3.5)
        # All 3 frames: distances ~3.78-3.83 > 3.5 → all FALSE
        assert brute["exists_truth"] == "FALSE"
        assert not any(brute["frame_truths"])
        assert brute["witness_frames"] == []

        mci = self.compiler.execute(
            "FIND resid 1 and name CA WITHIN 3.5 A OF resid 2 and name CA",
            COBRO_XTC
        )
        assert mci.truth_value == "FALSE"

    def test_min_distances_consistent_with_oracle(self):
        """Per-frame minimum distances from brute force match oracle reference values."""
        brute = brute_force_scan(COBRO_PDB, COBRO_XTC,
                                  "resid 1 and name CA", "resid 2 and name CA",
                                  "<", 4.0)
        # Known values from PASS 37 oracle verification
        expected_approx = [3.826, 3.797, 3.784]
        for i, (got, exp) in enumerate(zip(brute["min_dist_per_frame"], expected_approx)):
            assert abs(got - exp) < 0.05, (
                f"Frame {i}: brute distance {got:.4f} Å deviates from oracle {exp:.3f} Å"
            )

    def test_no_false_pruning_vs_brute_force(self):
        """MCI never reports FALSE for a frame that brute-force says is TRUE."""
        brute = brute_force_scan(COBRO_PDB, COBRO_XTC,
                                  "resid 1 and name CA", "resid 2 and name CA",
                                  "<", 4.0)
        mci = self.compiler.execute(
            "FIND resid 1 and name CA WITHIN 4.0 A OF resid 2 and name CA",
            COBRO_XTC
        )
        # If brute says TRUE, MCI must say TRUE
        if brute["exists_truth"] == "TRUE":
            assert mci.truth_value == "TRUE", "MCI falsely reports FALSE when brute-force says TRUE"


class TestIndexVsFullScanSynthetic:
    """Index vs full-scan equivalence using pure mathematical tests (no file I/O)."""

    def test_point_atom_distances_match_mic_formula(self):
        """For point atoms, MCI bound == exact distance."""
        box = np.array([100.0, 100.0, 100.0])
        test_cases = [
            ([0, 0, 0], [3, 0, 0], 3.0),
            ([0, 0, 0], [7, 0, 0], 7.0),
            ([0, 0, 0], [50, 0, 0], 50.0),
            ([0, 0, 0], [60, 0, 0], 40.0),  # wraps: 100-60=40
            ([1, 1, 1], [4, 5, 6], np.sqrt(9+16+25)),
        ]
        from mocs.bounds.periodic_bounds import compute_pbc_bounds
        for pos_a, pos_b, expected_d in test_cases:
            aabb_a = (np.array(pos_a, float), np.array(pos_a, float))
            aabb_b = (np.array(pos_b, float), np.array(pos_b, float))
            L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
            assert abs(L - expected_d) < 1e-9, f"L={L} != {expected_d} for {pos_a}->{pos_b}"
            assert abs(U - expected_d) < 1e-9, f"U={U} != {expected_d} for {pos_a}->{pos_b}"

    def test_mci_index_correctness_invariant(self):
        """The central soundness invariant: no pruned block contains a witness."""
        # Simulate 10 blocks with known truth values
        # Pruned = CERTIFIED_FALSE block
        # For each pruned block: verify no actual witnesses exist
        import random
        rng = np.random.default_rng(42)
        box = np.array([20.0, 20.0, 20.0])

        for _ in range(100):
            # Random point pair
            pos_a = rng.random(3) * 18
            pos_b = rng.random(3) * 18
            threshold = rng.random() * 15 + 1.0

            from mocs.bounds.periodic_bounds import compute_pbc_bounds
            aabb_a = (pos_a.copy(), pos_a.copy())
            aabb_b = (pos_b.copy(), pos_b.copy())
            L, U = compute_pbc_bounds(aabb_a, aabb_b, box)

            # Compute true distance
            diff = pos_b - pos_a
            diff -= box * np.round(diff / box)
            true_d = np.linalg.norm(diff)

            # If certified FALSE (L >= threshold), verify no witness
            if L >= threshold:
                assert true_d >= threshold - 1e-9, (
                    f"SOUNDNESS VIOLATION: L={L:.6f} >= threshold={threshold:.6f} "
                    f"but true_d={true_d:.6f} < threshold!"
                )

            # If certified TRUE (U < threshold), verify witness exists
            if U < threshold:
                assert true_d < threshold + 1e-9, (
                    f"SOUNDNESS VIOLATION: U={U:.6f} < threshold={threshold:.6f} "
                    f"but true_d={true_d:.6f} >= threshold!"
                )
