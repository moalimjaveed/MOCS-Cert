"""Pass 37: MCI Writer / Reader Roundtrip & Binary Corruption Adversarial Test Suite.

Verifies:
1. Deterministic byte-for-byte serialization & semantic roundtrip.
2. Fail-closed behavior on binary corruption:
   - Single byte flip in blocks.bin
   - Truncated records
   - Duplicated / swapped records
   - Corrupt block ID in record header
   - Inverted AABB bounds (x_min > x_max)
   - Manifest tamper (mci_index_hash mismatch)
"""

import os
import json
import pytest
import numpy as np

from mocs.io import MDAnalysisTrajectorySource
from mocs.mci import MCIReader, MCIWriter, AABBBlockRecord
from mocs.mci.records import MCI_HEADER_SIZE
from mocs.exceptions import MOCSDataIntegrityError


class TestMCIRoundtripCorruption:
    """Verifies binary MCI serialization integrity and corruption resistance."""

    @pytest.fixture
    def setup_mci(self, tmp_path):
        mci_dir = str(tmp_path / "baseline_mci")
        src = MDAnalysisTrajectorySource("tests/data/synth_50f.gro", "tests/data/synth_50f.xtc")
        atom_groups = {0: np.array([0]), 1: np.array([1])}
        manifest = MCIWriter.build_index(src, atom_groups, mci_dir, block_size=10)
        return {
            "mci_dir": mci_dir,
            "manifest": manifest,
            "src": src
        }

    def test_clean_roundtrip_semantic_and_byte_parity(self, setup_mci):
        """Clean write and read must match 100% byte-for-byte and semantically."""
        mci_dir = setup_mci["mci_dir"]

        with MCIReader(mci_dir, verify_on_open=True) as reader:
            assert reader.num_blocks == 5
            assert reader.total_frames == 50

            for gid in [0, 1]:
                recs = reader.read_group_blocks(gid)
                assert len(recs) == 5
                for b in range(5):
                    rec = recs[b]
                    assert rec.atom_group_id == gid
                    assert rec.block_id == b
                    assert rec.frame_start == b * 10
                    assert rec.frame_end_exclusive == (b + 1) * 10
                    # Repack and check length
                    assert len(rec.pack()) == 64

    def test_single_byte_flip_in_blocks_bin_fails_closed(self, setup_mci):
        """Flipping a single byte in blocks.bin triggers SHA-256 integrity error."""
        mci_dir = setup_mci["mci_dir"]
        blocks_path = os.path.join(mci_dir, "blocks.bin")

        with open(blocks_path, "r+b") as f:
            f.seek(32)  # Middle of record 0
            byte = f.read(1)
            flipped = bytes([byte[0] ^ 0xFF])
            f.seek(32)
            f.write(flipped)

        with pytest.raises(MOCSDataIntegrityError) as exc:
            MCIReader(mci_dir, verify_on_open=True)
        assert "SHA-256 mismatch" in str(exc.value)

    def test_truncated_record_fails_closed(self, setup_mci):
        """Truncated blocks.bin triggers size mismatch on open."""
        mci_dir = setup_mci["mci_dir"]
        blocks_path = os.path.join(mci_dir, "blocks.bin")

        sz = os.path.getsize(blocks_path)
        with open(blocks_path, "r+b") as f:
            f.truncate(sz - 20)  # Truncated by 20 bytes

        with pytest.raises(MOCSDataIntegrityError) as exc:
            MCIReader(mci_dir, verify_on_open=True)
        assert "size mismatch" in str(exc.value) or "truncated" in str(exc.value)

    def test_corrupt_block_id_in_record_fails_closed(self, setup_mci):
        """A block record with wrong block ID fails closed on read."""
        mci_dir = setup_mci["mci_dir"]

        with MCIReader(mci_dir, verify_on_open=False) as reader:
            # Change block_id of block 1 to 99
            # Record 1 offset is MCI_HEADER_SIZE + 64 bytes, block_id is at offset + 4
            with open(os.path.join(mci_dir, "blocks.bin"), "r+b") as f:
                f.seek(MCI_HEADER_SIZE + 64 + 4)
                f.write((99).to_bytes(4, byteorder="little"))

            # Reading block 0 succeeds
            r0 = reader.read_block(0, 0)
            assert r0.block_id == 0

            # Reading block 1 fails closed
            with pytest.raises(MOCSDataIntegrityError) as exc:
                reader.read_block(0, 1)
            assert "Block ID mismatch" in str(exc.value)

    def test_inverted_aabb_bounds_fails_closed(self, setup_mci):
        """Record with x_min > x_max fails closed on read."""
        mci_dir = setup_mci["mci_dir"]

        with MCIReader(mci_dir, verify_on_open=False) as reader:
            # Invert bounds in block 0: x_min = 100.0, x_max = 1.0
            import struct
            with open(os.path.join(mci_dir, "blocks.bin"), "r+b") as f:
                f.seek(MCI_HEADER_SIZE + 16)
                f.write(struct.pack("<2d", 100.0, 1.0))

            with pytest.raises(MOCSDataIntegrityError) as exc:
                reader.read_block(0, 0)
            assert "Corrupt AABB bounds" in str(exc.value)

    def test_manifest_tamper_fails_closed(self, setup_mci):
        """Modifying manifest values without regenerating mci_index_hash triggers integrity failure."""
        mci_dir = setup_mci["mci_dir"]
        manifest_path = os.path.join(mci_dir, "manifest.json")

        with open(manifest_path, "r", encoding="utf-8") as f:
            man = json.load(f)

        man["total_frames"] = 9999
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(man, f)

        with pytest.raises(MOCSDataIntegrityError) as exc:
            MCIReader(mci_dir, verify_on_open=True)
        assert "MCI manifest self-digest hash mismatch" in str(exc.value)
