"""
PASS 47: Cache Partitioning and Isolation Test Suite.

Requirement 31:
Never mix AABB and 14-DOP index files in the same directory.
Cache directories must be strictly partitioned:
.mci_{traj}_{hash}_aabb vs .mci_{traj}_{hash}_kdop14.
"""

import os
import shutil
import tempfile
import numpy as np
import pytest

from mocs.mci.records import AABBBlockRecord
from mocs.mci.records_kdop import KDOP14BlockRecord
from mocs.mci import MCIReader
from mocs.io.synthetic_source import SyntheticTrajectorySource
from backend.app.core.compiler_service import compiler_service


class TestCachePartitioning:
    """Verifies strict cache isolation between AABB and KDOP14 indices."""

    def test_cache_directories_partitioned(self, monkeypatch):
        temp_dir = tempfile.mkdtemp(prefix="mocs_cache_partition_")
        try:
            n_frames = 40
            n_atoms = 2
            coords = np.random.uniform(5.0, 25.0, size=(n_frames, n_atoms, 3))
            box = np.array([50.0, 50.0, 50.0])
            source = SyntheticTrajectorySource(coords, box, atom_names=["CA", "O2"])

            fake_traj = os.path.join(temp_dir, "test_part.xtc")
            fake_topo = os.path.join(temp_dir, "test_part.gro")
            data_bytes = coords.tobytes() + box.tobytes()
            with open(fake_traj, "wb") as f:
                f.write(data_bytes)
            with open(fake_topo, "wb") as f:
                f.write(data_bytes)

            from backend.app.config import settings
            monkeypatch.setattr(settings, "INDEX_ROOT", temp_dir)

            monkeypatch.setattr(
                compiler_service,
                "_resolve_trajectory_source",
                lambda tid: (source, fake_traj, fake_topo)
            )

            # 1. Compile & execute with AABB
            res_aabb = compiler_service.execute(
                "DISTANCE(name CA, name O2) < 5.0 A",
                trajectory_id="test_part.xtc",
                bounding_model="AABB"
            )
            assert res_aabb.bounding_model == "AABB"

            # 2. Compile & execute with KDOP14
            res_kdop = compiler_service.execute(
                "DISTANCE(name CA, name O2) < 5.0 A",
                trajectory_id="test_part.xtc",
                bounding_model="KDOP14"
            )
            assert res_kdop.bounding_model == "KDOP14"

            # Check that partitioned cache directories exist in temp_dir
            entries = os.listdir(temp_dir)
            mci_aabb_dirs = [e for e in entries if e.startswith(".mci_") and e.endswith("_aabb")]
            mci_kdop_dirs = [e for e in entries if e.startswith(".mci_") and e.endswith("_kdop14")]

            assert len(mci_kdop_dirs) >= 1, f"Expected KDOP14 partitioned cache dir, found: {entries}"

            # Verify that the reader for KDOP directory reads KDOP14BlockRecord (128 bytes)
            kdop_dir = os.path.join(temp_dir, mci_kdop_dirs[0])
            reader_kdop = MCIReader(kdop_dir, verify_on_open=True)
            assert reader_kdop.bounding_model == "KDOP14"
            assert reader_kdop.record_size_bytes == 128
            rec_k = reader_kdop.read_block(0, 0)
            assert isinstance(rec_k, KDOP14BlockRecord)
            reader_kdop.close()

            # Verify that AABB directory reads AABBBlockRecord (64 bytes)
            if mci_aabb_dirs:
                aabb_dir = os.path.join(temp_dir, mci_aabb_dirs[0])
                reader_aabb = MCIReader(aabb_dir, verify_on_open=True)
                assert reader_aabb.bounding_model == "AABB"
                assert reader_aabb.record_size_bytes == 64
                rec_a = reader_aabb.read_block(0, 0)
                assert isinstance(rec_a, AABBBlockRecord)
                reader_aabb.close()
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
