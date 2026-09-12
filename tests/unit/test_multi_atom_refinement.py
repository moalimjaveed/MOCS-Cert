"""
Regression Test Suite for Multi-Atom Selection Refinement,
PBC All-Pairs Minimum-Image Distance, and Fail-Closed Selection Resolution.

Addresses P0 Defects identified in Pass 34/35:
1. Refinement previously evaluated only index [0], ignoring remaining atoms in multi-atom selections.
2. Selection resolution previously fell back to [0] on unknown selections instead of raising an error.
3. Reference distance previously rejected multi-atom selections.
"""

import numpy as np
import pytest
from mocs.exceptions import MOCSSelectionResolutionError
from mocs.io.synthetic_source import SyntheticTrajectorySource
from mocs.session import MOCSSession
from mocs.reference.distance import reference_distance
from backend.app.core.compiler_service import compiler_service


class TestMultiAtomRefinement:
    """Test suite for multi-atom selection distance evaluation and refinement."""

    def test_multi_atom_adversarial_first_atom_far_second_atom_near_in_compiler(self, monkeypatch):
        """
        Adversarial test:
        Selection A has 2 atoms:
          - Atom 0 at (0, 0, 0)
          - Atom 1 at (10, 10, 10)
        Selection B has 1 atom:
          - Atom 2 at (10, 10, 12)  # Distance to Atom 1 is 2.0 A; Distance to Atom 0 is ~17.3 A.

        Predicate: < 4.0 A
        Expected truth value: CERTIFIED TRUE (since Atom 1 is within 2.0 A <= 4.0 A).
        Buggy behavior in Pass 34: Checked only Atom 0 (distance ~17.3 A > 4.0 A) and produced FALSE.
        """
        n_frames = 10
        n_atoms = 5
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((n_frames, n_atoms, 3), dtype=np.float32)

        coords[:, 0, :] = [0.0, 0.0, 0.0]       # Atom 0: Far from Atom 2
        coords[:, 1, :] = [10.0, 10.0, 10.0]   # Atom 1: Near to Atom 2 (2.0 A)
        coords[:, 2, :] = [10.0, 10.0, 12.0]   # Atom 2: Target
        coords[:, 3, :] = [30.0, 30.0, 30.0]
        coords[:, 4, :] = [40.0, 40.0, 40.0]

        custom_source = SyntheticTrajectorySource(coordinates=coords, box=box)

        # Mock source in compiler_service to use our adversarial coordinate geometry
        monkeypatch.setattr(compiler_service, "_resolve_trajectory_source", lambda tid=None: (custom_source, "mock.xtc", "mock.gro"))

        # Also mock resolve_selection on this source to map selections to multi-atom indices
        def mock_resolve(query: str):
            if "SEL_A" in query:
                return np.array([0, 1], dtype=np.int64)
            if "SEL_B" in query:
                return np.array([2], dtype=np.int64)
            return custom_source.resolve_selection(query)

        monkeypatch.setattr(custom_source, "resolve_selection", mock_resolve)

        res = compiler_service.execute("FIND (SEL_A) WITHIN 4.0A OF (SEL_B)")

        assert res.truth_value in ("TRUE", "CERTIFIED TRUE"), f"Expected TRUE, got {res.truth_value}"

    def test_selection_resolution_failure_raises_exception_no_silent_fallback(self):
        """
        Verify that an unresolvable selection strictly raises MOCSSelectionResolutionError
        and never silently falls back to atom [0].
        """
        with pytest.raises(MOCSSelectionResolutionError):
            compiler_service.execute("FIND (name NON_EXISTENT_ATOM_XYZ) WITHIN 4.0A OF (name CA)")

    def test_synthetic_source_resolve_selection_empty_raises_error(self):
        """
        Verify that SyntheticTrajectorySource.resolve_selection raises MOCSSelectionResolutionError
        when a query matches 0 atoms.
        """
        coords = np.zeros((2, 3, 3), dtype=np.float64)
        box = np.array([50.0, 50.0, 50.0])
        source = SyntheticTrajectorySource(coordinates=coords, box=box)
        with pytest.raises(MOCSSelectionResolutionError):
            source.resolve_selection("RES :NON_EXISTENT_RESIDUE")

    def test_mocs_session_multi_atom_refinement_synth(self):
        """
        Verify that MOCSSession correctly evaluates multi-atom selections against synth fixture.
        """
        session = MOCSSession(
            trajectory_path="tests/data/synth_500f.xtc",
            topology_path="tests/data/synth_500f.pdb"
        )
        res = session.query(
            observable="distance",
            operands=("name CA or name C1", "name O2 or name C2"),
            predicate="< 15.0"
        )
        assert res.truth_value in ("TRUE", "CERTIFIED TRUE", "TruthValue.TRUE")
        assert res.resolution_status == "COMPLETE"

    def test_multi_atom_reference_distance_parity(self):
        """
        Verify that mocs.reference.distance computes the exact same minimum pairwise
        distance across multi-atom groups as MDAnalysis.
        """
        import MDAnalysis as mda
        from MDAnalysis.analysis.distances import distance_array

        u = mda.Universe("tests/data/synth_500f.pdb")
        sel_a = u.select_atoms("name CA or name C1")
        sel_b = u.select_atoms("name O2 or name C2")

        dists = reference_distance(
            "tests/data/synth_500f.pdb",
            "tests/data/synth_500f.pdb",
            "name CA or name C1",
            "name O2 or name C2",
        )

        expected_dists = distance_array(sel_a.positions, sel_b.positions, box=u.dimensions)
        expected_min = float(np.min(expected_dists))

        assert dists[0] == pytest.approx(expected_min, abs=1e-3)
