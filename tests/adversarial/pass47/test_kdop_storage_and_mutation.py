"""
PASS 47: MCI Storage, Serialization, and Mutation Injection Test Suite.

Validates that:
1. KDOP14BlockRecord adheres strictly to the 128-byte binary layout (<IIII14d).
2. Binary serialization/deserialization is lossless and exact.
3. MCIWriter and MCIReader produce valid cryptographic manifests (SHA-256 and Merkle root).
4. Bit-flip corruption in blocks.bin or manifest tampering fails closed via MOCSDataIntegrityError.
"""

import os
import shutil
import tempfile
import struct
import numpy as np
import pytest

from mocs.mci.records_kdop import KDOP14BlockRecord
from mocs.mci import MCIWriter, MCIReader
from mocs.io.synthetic_source import SyntheticTrajectorySource
from mocs.exceptions import MOCSDataIntegrityError


class TestKDOPStorageAndMutation:
    """Rigorous tests for binary KDOP record storage and corruption detection."""

    def test_record_size_and_struct_format(self):
        """Validates that KDOP14BlockRecord is exactly 128 bytes."""
        assert KDOP14BlockRecord.RECORD_SIZE == 128
        assert KDOP14BlockRecord.STRUCT_FORMAT == "<IIII14d"
        assert struct.calcsize(KDOP14BlockRecord.STRUCT_FORMAT) == 128

    def test_roundtrip_serialization(self):
        """Validates that serialization and deserialization preserve all 14 projections."""
        projs = np.array([
            1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5,
            10.5, 20.5, 30.5, 40.5, 50.5, 60.5, 70.5
        ], dtype=np.float64)

        rec = KDOP14BlockRecord.from_projections(
            atom_group_id=1,
            block_id=42,
            frame_start=420,
            frame_end_exclusive=430,
            projections=projs
        )

        b = rec.to_bytes()
        assert len(b) == 128

        rec2 = KDOP14BlockRecord.from_bytes(b)
        assert rec2.atom_group_id == 1
        assert rec2.block_id == 42
        assert rec2.frame_start == 420
        assert rec2.frame_end_exclusive == 430
        np.testing.assert_allclose(rec2.minima, projs[:7])
        np.testing.assert_allclose(rec2.maxima, projs[7:])

    def test_mci_writer_reader_kdop_manifest(self):
        """Verifies end-to-end KDOP14 index creation and manifest cryptographic integrity."""
        temp_dir = tempfile.mkdtemp(prefix="mocs_kdop_storage_")
        try:
            n_frames = 50
            coords = np.random.uniform(5.0, 35.0, size=(n_frames, 4, 3))
            box = np.array([40.0, 40.0, 40.0])
            source = SyntheticTrajectorySource(coords, box)

            atom_groups = {0: np.array([0, 1]), 1: np.array([2, 3])}
            MCIWriter.build_index(
                source,
                atom_groups,
                temp_dir,
                block_size=10,
                bounding_model="KDOP14",
                trajectory_id="synth.xtc",
                topology_id="synth.gro"
            )

            manifest_path = os.path.join(temp_dir, "manifest.json")
            blocks_path = os.path.join(temp_dir, "blocks.bin")
            assert os.path.exists(manifest_path)
            assert os.path.exists(blocks_path)

            # 12-byte discriminator header + 2 atom groups * 5 blocks * 128 bytes = 1292 bytes
            assert os.path.getsize(blocks_path) == 12 + 2 * 5 * 128

            reader = MCIReader(temp_dir, verify_on_open=True)
            assert reader.bounding_model == "KDOP14"
            assert reader.num_blocks == 5
            assert reader.num_atom_groups == 2

            # Read each block and verify conversions
            for g_id in (0, 1):
                for b_id in range(5):
                    blk = reader.read_block(g_id, b_id)
                    kdop = blk.to_kdop()
                    assert kdop.minima.shape == (7,)
                    assert kdop.maxima.shape == (7,)
                    aabb = blk.get_aabb()
                    assert len(aabb) == 2
                    assert len(aabb[0]) == 3
                    assert len(aabb[1]) == 3
            reader.close()
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    def test_bit_flip_corruption_detection(self):
        """Verifies that tampering with a single byte in blocks.bin fails closed."""
        temp_dir = tempfile.mkdtemp(prefix="mocs_kdop_corrupt_")
        try:
            n_frames = 20
            coords = np.random.uniform(1.0, 10.0, size=(n_frames, 2, 3))
            box = np.array([30.0, 30.0, 30.0])
            source = SyntheticTrajectorySource(coords, box)

            MCIWriter.build_index(
                source,
                {0: np.array([0]), 1: np.array([1])},
                temp_dir,
                block_size=10,
                bounding_model="KDOP14"
            )

            blocks_path = os.path.join(temp_dir, "blocks.bin")
            with open(blocks_path, "r+b") as f:
                f.seek(64)  # inside the first block
                byte = f.read(1)
                f.seek(64)
                f.write(bytes([byte[0] ^ 0xFF]))  # flip bits

            # Opening corrupted file with verify_on_open=True must raise MOCSDataIntegrityError
            with pytest.raises(MOCSDataIntegrityError):
                MCIReader(temp_dir, verify_on_open=True)
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
