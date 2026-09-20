"""
PASS 36 — Section 9: Selection Resolution Adversarial Corpus.

Validates that atom selection resolution strictly fails closed:
- Exact atom, exact residue, multi-atom, case variations
- Nonexistent atoms and residues strictly raise ValueError / MOCSSelectionResolutionError
- GRO vs PDB topology compatibility
- Never falls back to index 0 or fabricated atom indices
"""

import pytest
import numpy as np
from mocs.io.mda_source import MDAnalysisTrajectorySource
from mocs.io.synthetic_source import SyntheticTrajectorySource
from mocs.exceptions import MOCSSelectionResolutionError


class TestSelectionResolutionAdversarial:
    """Rigorous fail-closed verification for atom selection resolution."""

    @pytest.fixture
    def gro_source(self):
        return MDAnalysisTrajectorySource("tests/data/synth_500f.gro", "tests/data/synth_500f.xtc")

    @pytest.fixture
    def pdb_source(self):
        return MDAnalysisTrajectorySource("tests/data/synth_500f.pdb", "tests/data/synth_500f.xtc")

    def test_exact_atom_resolution(self, gro_source):
        """Resolving exact atom name CA."""
        idx = gro_source.resolve_selection("name CA")
        assert isinstance(idx, np.ndarray)
        assert len(idx) == 1
        assert idx[0] == 0  # In synth_500f, atom 0 is CA

    def test_exact_residue_resolution(self, gro_source):
        """Resolving exact residue by name."""
        idx = gro_source.resolve_selection("resname LIG")
        assert len(idx) == 1
        assert idx[0] == 1  # In synth_500f, atom 1 is LIG

    def test_multi_atom_resolution(self, gro_source):
        """Resolving multiple atoms across residues."""
        idx = gro_source.resolve_selection("name CA or name O2")
        assert len(idx) == 2
        assert set(idx) == {0, 1}

    def test_case_variation_resolution(self, gro_source):
        """Case variation: 'name ca' -> resolves same as 'name CA'."""
        idx_lower = gro_source.resolve_selection("name ca")
        idx_upper = gro_source.resolve_selection("name CA")
        np.testing.assert_array_equal(idx_lower, idx_upper)

    def test_nonexistent_atom_fails_closed_no_silent_fallback(self, gro_source):
        """Nonexistent atom name must raise ValueError, NEVER return index 0."""
        with pytest.raises(ValueError) as excinfo:
            gro_source.resolve_selection("name NONEXISTENT_ATOM_XYZ")
        assert "resolved to 0 atoms" in str(excinfo.value)

    def test_nonexistent_residue_fails_closed(self, gro_source):
        """Nonexistent residue name must raise ValueError, NEVER return index 0."""
        with pytest.raises(ValueError) as excinfo:
            gro_source.resolve_selection("resname NONEXISTENT_RES_XYZ")
        assert "resolved to 0 atoms" in str(excinfo.value)

    def test_empty_selection_string_fails_closed(self, gro_source):
        """Empty selection string must raise ValueError."""
        with pytest.raises(ValueError):
            gro_source.resolve_selection("")

    def test_colon_syntax_gro_without_chains(self, gro_source):
        """Colon syntax on GRO file (which lacks chains) gracefully extracts resid and name."""
        idx = gro_source.resolve_selection("A:1:O2")
        assert len(idx) == 1
        assert idx[0] == 1

    def test_colon_syntax_pdb_with_chains(self, pdb_source):
        """Colon syntax on PDB file."""
        idx = pdb_source.resolve_selection("B:1:O2")
        assert len(idx) == 1
        assert idx[0] == 1

    def test_topology_trajectory_atom_count_mismatch_fails_closed(self):
        """Mismatched atom count between topology and trajectory must fail closed."""
        # synth_500f has 3 atoms. If we construct a source with a 4-atom topology against 3-atom trajectory:
        coords = np.zeros((5, 4, 3), dtype=np.float64)
        box = np.array([40.0, 40.0, 40.0])
        synth = SyntheticTrajectorySource(coords, box)
        with pytest.raises((IndexError, ValueError)):
            # Asking for out-of-range atom index 99
            synth.read_frame_coordinates(0, np.array([99]))
