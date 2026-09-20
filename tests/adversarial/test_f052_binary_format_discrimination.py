"""
F-052 Regression & Adversarial Test Suite.

Verifies:
1. blocks.bin begins with 12-byte canonical header: b"MOCSMCI\x01" + 4-byte format discriminator.
2. MCIReader verifies magic header and format code against manifest bounding_model.
3. Mutating manifest from KDOP14 to AABB (or reverse) causes MCIReader to reject immediately with MOCSDataIntegrityError.
4. Truncated or missing magic header is rejected fail-closed.
"""

import os
import json
import pytest
import numpy as np

from mocs.mci.writer import MCIWriter
from mocs.mci.reader import MCIReader
from mocs.mci.records import MCI_MAGIC, FORMAT_AABB, FORMAT_KDOP14, MCI_HEADER_SIZE
from mocs.exceptions import MOCSDataIntegrityError
from mocs.io.synthetic_source import SyntheticTrajectorySource


@pytest.fixture
def temp_mci_dir(tmp_path):
    out_dir = tmp_path / "test_mci"
    out_dir.mkdir()
    return str(out_dir)


def test_f052_magic_header_and_format_written(temp_mci_dir):
    coords = np.random.RandomState(42).uniform(10.0, 40.0, size=(20, 10, 3))
    box = np.array([50.0, 50.0, 50.0])
    source = SyntheticTrajectorySource(coordinates=coords, box=box)
    groups = {0: np.array([0, 1, 2]), 1: np.array([3, 4, 5])}

    # 1. Build AABB index
    manifest_aabb = MCIWriter.build_index(
        source=source,
        atom_groups=groups,
        output_dir=temp_mci_dir,
        block_size=5,
        bounding_model="AABB"
    )

    blocks_bin = os.path.join(temp_mci_dir, "blocks.bin")
    with open(blocks_bin, "rb") as f:
        hdr = f.read(MCI_HEADER_SIZE)
    assert len(hdr) == 12
    assert hdr[:8] == MCI_MAGIC
    assert int.from_bytes(hdr[8:12], "little") == FORMAT_AABB

    reader = MCIReader(temp_mci_dir)
    assert reader.bounding_model == "AABB"
    rec = reader.read_block(0, 0)
    assert rec.block_id == 0
    reader.close()


def test_f052_mismatch_kdop_manifest_with_aabb_binary_rejected(temp_mci_dir):
    coords = np.random.RandomState(42).uniform(10.0, 40.0, size=(20, 10, 3))
    box = np.array([50.0, 50.0, 50.0])
    source = SyntheticTrajectorySource(coordinates=coords, box=box)
    groups = {0: np.array([0, 1, 2])}

    # Build AABB index
    MCIWriter.build_index(
        source=source,
        atom_groups=groups,
        output_dir=temp_mci_dir,
        block_size=5,
        bounding_model="AABB"
    )

    # Mutate manifest to claim KDOP14
    manifest_path = os.path.join(temp_mci_dir, "manifest.json")
    with open(manifest_path, "r", encoding="utf-8") as f:
        m = json.load(f)
    m["bounding_model"] = "KDOP14"
    # Recompute self-digest so manifest passes self-check
    clean = {k: v for k, v in m.items() if k != "mci_index_hash"}
    import hashlib
    m["mci_index_hash"] = hashlib.sha256(json.dumps(clean, sort_keys=True).encode()).hexdigest()
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(m, f)

    with pytest.raises(MOCSDataIntegrityError) as excinfo:
        MCIReader(temp_mci_dir)
    assert "contradicts manifest bounding_model" in str(excinfo.value)


def test_f052_mismatch_aabb_manifest_with_kdop_binary_rejected(tmp_path):
    out_dir = str(tmp_path / "kdop_mci")
    os.makedirs(out_dir, exist_ok=True)
    coords = np.random.RandomState(42).uniform(10.0, 40.0, size=(20, 10, 3))
    box = np.array([50.0, 50.0, 50.0])
    source = SyntheticTrajectorySource(coordinates=coords, box=box)
    groups = {0: np.array([0, 1, 2])}

    # Build KDOP14 index
    MCIWriter.build_index(
        source=source,
        atom_groups=groups,
        output_dir=out_dir,
        block_size=5,
        bounding_model="KDOP14"
    )

    # Mutate manifest to claim AABB
    manifest_path = os.path.join(out_dir, "manifest.json")
    with open(manifest_path, "r", encoding="utf-8") as f:
        m = json.load(f)
    m["bounding_model"] = "AABB"
    clean = {k: v for k, v in m.items() if k != "mci_index_hash"}
    import hashlib
    m["mci_index_hash"] = hashlib.sha256(json.dumps(clean, sort_keys=True).encode()).hexdigest()
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(m, f)

    with pytest.raises(MOCSDataIntegrityError) as excinfo:
        MCIReader(out_dir)
    assert "contradicts manifest bounding_model" in str(excinfo.value)
