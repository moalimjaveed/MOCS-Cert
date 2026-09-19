"""
PASS 24 — Adversarial Data Corruption, Parser Differential & Round-Trip Integrity Audit.

Attacks:
1. Trajectory and topology mismatch & corrupt file headers
2. Trajectory frame access boundary violations & non-monotonic slices
3. Selection parser syntax differentials & adversarial query strings
4. MCI binary index tampering, byte flips, and hash commitment failures
5. Certificate provenance auditing and cryptographic digest verification
6. Atom reordering invariance and multi-tier I/O accounting preservation
"""

import os
import tempfile
import json
import hashlib
import pytest
import numpy as np

from mocs.io.mda_source import MDAnalysisTrajectorySource, compute_file_sha256
from mocs.io.synthetic_source import SyntheticTrajectorySource
from mocs.mci.reader import MCIReader
from mocs.mci.writer import MCIWriter
from mocs.certificates.auditor import audit_data_provenance, diff_against_reference, verify_certificate
from mocs.exceptions import (
    MOCSFileNotFoundError,
    MOCSDataIntegrityError,
    MOCSVerificationError,
)
from mocs.bounds.periodic_bounds import compute_pbc_bounds


# =============================================================================
# 1. TRAJECTORY & TOPOLOGY INTEGRITY & BOUNDARY ATTACKS
# =============================================================================

class TestTrajectoryAdversarialIntegrity:
    """Attacks on trajectory/topology sources, corrupted files, and frame boundaries."""

    def test_nonexistent_files_fail_closed(self):
        with pytest.raises(MOCSFileNotFoundError):
            MDAnalysisTrajectorySource("non_existent_topo.gro", "non_existent_traj.xtc")

        # Existing topo with missing traj
        gro_path = "tests/data/synth_500f.gro"
        if os.path.exists(gro_path):
            with pytest.raises(MOCSFileNotFoundError):
                MDAnalysisTrajectorySource(gro_path, "missing_traj.xtc")

    def test_out_of_bounds_frame_access(self):
        coords = np.zeros((10, 3, 3), dtype=np.float64)
        box = np.array([50.0, 50.0, 50.0], dtype=np.float64)
        source = SyntheticTrajectorySource(coords, box)

        # Exact bounds
        with pytest.raises(IndexError):
            source.read_frame_coordinates(-1)
        with pytest.raises(IndexError):
            source.read_frame_coordinates(10)
        with pytest.raises(IndexError):
            source.read_frame_coordinates(999)

        # Valid bounds
        f0 = source.read_frame_coordinates(0)
        f9 = source.read_frame_coordinates(9)
        assert f0.shape == (3, 3)
        assert f9.shape == (3, 3)

    def test_non_monotonic_and_degenerate_block_slices(self):
        coords = np.zeros((20, 4, 3), dtype=np.float64)
        box = np.array([60.0, 60.0, 60.0], dtype=np.float64)
        source = SyntheticTrajectorySource(coords, box)

        # End before start
        with pytest.raises(IndexError):
            source.read_block_coordinates(10, 5)

        # End equal to start (empty slice)
        with pytest.raises(IndexError):
            source.read_block_coordinates(5, 5)

        # Negative start
        with pytest.raises(IndexError):
            source.read_block_coordinates(-2, 5)

        # Out-of-bounds end
        with pytest.raises(IndexError):
            source.read_block_coordinates(0, 25)

        # Valid block slice
        block = source.read_block_coordinates(5, 15)
        assert block.shape == (10, 4, 3)

    def test_corrupted_trajectory_header_fails_closed(self):
        """Feeding random garbage bytes as an XTC file must raise an exception."""
        with tempfile.TemporaryDirectory() as tmpdir:
            corrupt_xtc = os.path.join(tmpdir, "corrupt.xtc")
            with open(corrupt_xtc, "wb") as f:
                f.write(b"\x00\x00\x00\x00\xFF\xFF\xFF\xFFCORRUPT_HEADER_TRUNCATED")

            gro_path = "tests/data/synth_500f.gro"
            if os.path.exists(gro_path):
                with pytest.raises(Exception):
                    MDAnalysisTrajectorySource(gro_path, corrupt_xtc)


# =============================================================================
# 2. SELECTION PARSER DIFFERENTIAL & ADVERSARIAL QUERY STRINGS
# =============================================================================

class TestSelectionParserDifferentials:
    """Attacks on selection resolution across MolQL, colon syntax, and fallback rules."""

    @pytest.fixture
    def synth_source(self):
        gro_path = "tests/data/synth_500f.gro"
        xtc_path = "tests/data/synth_500f.xtc"
        if not os.path.exists(gro_path) or not os.path.exists(xtc_path):
            pytest.skip("Fixture synth_500f files not present.")
        return MDAnalysisTrajectorySource(gro_path, xtc_path)

    def test_molql_res_and_atom_translation(self, synth_source):
        # MolQL: RES :ALA and ATOM :CA
        res_ca = synth_source.resolve_selection("RES :ALA and ATOM :CA")
        assert len(res_ca) >= 1
        assert res_ca[0] == 0

    def test_colon_syntax_resolution(self, synth_source):
        # Syntax: 155:CA (residue 155, CA atom)
        idx_ca = synth_source.resolve_selection("155:CA")
        assert len(idx_ca) >= 1
        assert idx_ca[0] == 0

        # Syntax: 1:O2 (residue 1, O2 atom)
        idx_o2 = synth_source.resolve_selection("1:O2")
        assert len(idx_o2) >= 1
        assert idx_o2[0] == 1

        # Syntax: LIG:1:O2
        idx_lig = synth_source.resolve_selection("LIG:1:O2")
        assert len(idx_lig) >= 1
        assert idx_lig[0] == 1

    def test_bogus_and_malicious_selections_fail_closed(self, synth_source):
        bogus_selections = [
            "NONEXISTENT_RESIDUE_AND_ATOM",
            "9999999:ZZZ",
            "DROP TABLE users; --",
            "eval(1+1)",
            "RES :NONEXIST",
            "name INVALID_ATOM_NAME_XYZ",
        ]
        for sel in bogus_selections:
            with pytest.raises(ValueError):
                synth_source.resolve_selection(sel)


# =============================================================================
# 3. MCI BINARY INDEX TAMPERING & CRYPTOGRAPHIC COMMITMENT ATTACKS
# =============================================================================

class TestMciIndexAdversarialAttacks:
    """Attacks on MCI binary files, manifests, SHA-256 integrity, and random access seeks."""

    @pytest.fixture
    def built_mci_dir(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            coords = np.random.uniform(5.0, 45.0, size=(20, 4, 3))
            box = np.array([50.0, 50.0, 50.0], dtype=np.float64)
            source = SyntheticTrajectorySource(coords, box, timestep_ps=5.0)
            atom_groups = {0: np.array([0, 1]), 1: np.array([2, 3])}
            MCIWriter.build_index(
                source=source,
                atom_groups=atom_groups,
                output_dir=tmpdir,
                block_size=5,
            )
            yield tmpdir

    def test_mci_valid_read_and_telemetry(self, built_mci_dir):
        with MCIReader(built_mci_dir, verify_on_open=True) as reader:
            assert reader.num_blocks == 4
            assert reader.block_size == 5
            assert reader.total_frames == 20

            # Seek block
            rec = reader.read_block(0, 0)
            assert rec.atom_group_id == 0
            assert rec.block_id == 0
            assert reader.blocks_read_count == 1
            assert reader.index_bytes_read == 64

    def test_mci_manifest_hash_tampering(self, built_mci_dir):
        # Verify legitimate index opens cleanly
        reader = MCIReader(built_mci_dir, verify_on_open=True)
        reader.close()

        # Tamper with manifest values (without updating mci_index_hash)
        manifest_path = os.path.join(built_mci_dir, "manifest.json")
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest_data = json.load(f)

        manifest_data["total_frames"] = 999  # Tampered!
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest_data, f)

        # Re-opening must fail closed with MOCSDataIntegrityError
        with pytest.raises(MOCSDataIntegrityError) as exc_info:
            MCIReader(built_mci_dir, verify_on_open=True)
        assert "MCI manifest self-digest hash mismatch" in str(exc_info.value)

    def test_mci_blocks_binary_byte_flip_detection(self, built_mci_dir):
        # Flip a single byte in blocks.bin
        blocks_path = os.path.join(built_mci_dir, "blocks.bin")
        with open(blocks_path, "r+b") as f:
            f.seek(16)
            byte = f.read(1)
            f.seek(16)
            f.write(bytes([byte[0] ^ 0xFF]))

        # Reader must detect SHA-256 commitment violation
        with pytest.raises(MOCSDataIntegrityError) as exc_info:
            MCIReader(built_mci_dir, verify_on_open=True)
        assert "blocks.bin SHA-256 mismatch" in str(exc_info.value)

    def test_mci_blocks_binary_truncation_detection(self, built_mci_dir):
        # Truncate blocks.bin by 10 bytes
        blocks_path = os.path.join(built_mci_dir, "blocks.bin")
        curr_size = os.path.getsize(blocks_path)
        with open(blocks_path, "r+b") as f:
            f.truncate(curr_size - 10)

        # Reader must detect size mismatch
        with pytest.raises(MOCSDataIntegrityError) as exc_info:
            MCIReader(built_mci_dir, verify_on_open=True)
        assert "size mismatch" in str(exc_info.value)


# =============================================================================
# 4. CERTIFICATE PROVENANCE & ORACLE AUDIT
# =============================================================================

class TestCertificateProvenanceAuditing:
    """Attacks on certificate lineage, file hashes, and oracle differential verification."""

    def test_audit_data_provenance_file_hash_tamper(self):
        gro_path = "tests/data/synth_500f.gro"
        xtc_path = "tests/data/synth_500f.xtc"
        if not os.path.exists(gro_path) or not os.path.exists(xtc_path):
            pytest.skip("Fixture synth_500f files not present.")

        manifest = {
            "source": {
                "trajectory_size_bytes": os.path.getsize(xtc_path),
                "trajectory_sha256": compute_file_sha256(xtc_path),
                "topology_sha256": compute_file_sha256(gro_path),
            }
        }

        # Valid check passes
        assert audit_data_provenance(manifest, xtc_path, gro_path) is True

        # Tampered trajectory hash fails closed
        tampered_manifest = {
            "source": {
                "trajectory_size_bytes": os.path.getsize(xtc_path),
                "trajectory_sha256": "0" * 64,
                "topology_sha256": compute_file_sha256(gro_path),
            }
        }
        with pytest.raises(MOCSDataIntegrityError) as exc_info:
            audit_data_provenance(tampered_manifest, xtc_path, gro_path)
        assert "Trajectory SHA-256 mismatch" in str(exc_info.value)

        # Tampered file size fails closed even in fast check
        tampered_size_manifest = {
            "source": {
                "trajectory_size_bytes": 12345,
                "trajectory_sha256": compute_file_sha256(xtc_path),
                "topology_sha256": compute_file_sha256(gro_path),
            }
        }
        with pytest.raises(MOCSDataIntegrityError) as exc_info:
            audit_data_provenance(tampered_size_manifest, xtc_path, gro_path, fast_check_only=True)
        assert "Trajectory file size mismatch" in str(exc_info.value)

    def test_oracle_differential_soundness_violation(self):
        # MOCS evaluates TRUE but oracle evaluates FALSE -> Soundness violation!
        is_sound, reason = diff_against_reference(
            result_truth="TRUE",
            result_resolution="COMPLETE",
            oracle_truth="FALSE",
            oracle_resolution="COMPLETE"
        )
        assert is_sound is False
        assert "SOUNDNESS VIOLATION" in reason

        # MOCS evaluates FALSE but oracle evaluates TRUE -> Soundness violation!
        is_sound, reason = diff_against_reference(
            result_truth="FALSE",
            result_resolution="COMPLETE",
            oracle_truth="TRUE",
            oracle_resolution="COMPLETE"
        )
        assert is_sound is False
        assert "SOUNDNESS VIOLATION" in reason

        # Concordant evaluations pass
        is_sound, reason = diff_against_reference("TRUE", "COMPLETE", "TRUE", "COMPLETE")
        assert is_sound is True
        assert reason is None


# =============================================================================
# 5. ATOM REORDERING INVARIANCE & TOPOLOGY PERMUTATION
# =============================================================================

class TestAtomReorderingInvariance:
    """Verifies that spatial bounds calculations are invariant to atom order permutation."""

    def test_pbc_bounds_permutation_invariance(self):
        box = np.array([50.0, 50.0, 50.0], dtype=np.float64)

        # Original coordinates
        rng = np.random.default_rng(42)
        coords1 = rng.uniform(5.0, 45.0, size=(10, 3))
        coords2 = rng.uniform(5.0, 45.0, size=(10, 3))

        aabb1_orig = (np.min(coords1, axis=0), np.max(coords1, axis=0))
        aabb2_orig = (np.min(coords2, axis=0), np.max(coords2, axis=0))

        b_min_orig, b_max_orig = compute_pbc_bounds(aabb1_orig, aabb2_orig, box)

        # Permute atoms in coords1 and coords2
        perm1 = rng.permutation(10)
        perm2 = rng.permutation(10)
        coords1_perm = coords1[perm1]
        coords2_perm = coords2[perm2]

        aabb1_perm = (np.min(coords1_perm, axis=0), np.max(coords1_perm, axis=0))
        aabb2_perm = (np.min(coords2_perm, axis=0), np.max(coords2_perm, axis=0))

        b_min_perm, b_max_perm = compute_pbc_bounds(aabb1_perm, aabb2_perm, box)

        # The bounding box distance interval [b_min, b_max] must be identical
        assert np.isclose(b_min_orig, b_min_perm, atol=1e-12)
        assert np.isclose(b_max_orig, b_max_perm, atol=1e-12)
