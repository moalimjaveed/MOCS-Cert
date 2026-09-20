"""Unit tests for MCI 64-byte binary index layout, seeks, and hashing."""

import os
import shutil
import pytest
import numpy as np
from mocs.mci import AABBBlockRecord, RECORD_SIZE_BYTES, MCIWriter, MCIReader
from mocs.io import SyntheticTrajectorySource

def test_aabb_block_record_struct_packing():
    rec = AABBBlockRecord(
        atom_group_id=1,
        block_id=42,
        frame_start=420,
        frame_end_exclusive=430,
        x_min=1.23,
        x_max=4.56,
        y_min=2.34,
        y_max=5.67,
        z_min=3.45,
        z_max=6.78
    )
    packed = rec.pack()
    assert len(packed) == 64
    assert len(packed) == RECORD_SIZE_BYTES

    unpacked = AABBBlockRecord.unpack(packed)
    assert unpacked == rec
    assert unpacked.atom_group_id == 1
    assert unpacked.block_id == 42
    assert unpacked.frame_start == 420
    assert unpacked.frame_end_exclusive == 430
    assert np.isclose(unpacked.x_min, 1.23)
    assert np.isclose(unpacked.x_max, 4.56)

def test_mci_writer_and_random_seek(tmp_path):
    # Create synthetic source
    n_frames, n_atoms = 30, 2
    coords = np.zeros((n_frames, n_atoms, 3), dtype=np.float64)
    # Give distinct coordinates per frame
    for f in range(n_frames):
        coords[f, 0] = [float(f), 10.0, 10.0]
        coords[f, 1] = [float(f) + 3.0, 10.0, 10.0]

    box = np.array([100.0, 100.0, 100.0])
    source = SyntheticTrajectorySource(coords, box)

    groups = {0: np.array([0]), 1: np.array([1])}
    index_dir = str(tmp_path / "test_mci")

    manifest = MCIWriter.build_index(source, groups, index_dir, block_size=10)
    assert manifest["num_blocks_per_group"] == 3
    assert manifest["total_frames"] == 30
    assert len(manifest["mci_index_hash"]) == 64

    # Verify random seeks
    with MCIReader(index_dir) as reader:
        # Seek directly to block 2 of group 1
        rec = reader.read_block(group_id=1, block_id=2)
        assert rec.block_id == 2
        assert rec.frame_start == 20
        assert rec.frame_end_exclusive == 30
        # In block 2 (frames 20-29), atom 1 x ranges from 20+3=23 to 29+3=32
        assert np.isclose(rec.x_min, 23.0)
        assert np.isclose(rec.x_max, 32.0)
        assert reader.index_bytes_read == 64
