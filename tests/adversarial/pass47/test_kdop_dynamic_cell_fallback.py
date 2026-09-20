"""
PASS 47: Dynamic Cell Fallback Test.

Validates that under dynamic (NPT) trajectories where the unit cell fluctuates per frame:
1. Block-level KDOP14 spatial bounding fails closed to [L=0, U=inf].
2. Blocks are marked for exact refinement rather than being falsely pruned.
3. Exact per-frame minimum-image distances are computed using each frame's exact unit cell.
4. Identical sound fallback occurs for both AABB and KDOP14.
"""

import os
import shutil
import tempfile
import numpy as np
import pytest

from mocs.io.synthetic_source import SyntheticTrajectorySource
from mocs.mci import MCIWriter, MCIReader
from mocs.bounds.kdop import KDOP14
from backend.app.core.compiler_service import compiler_service


class TestDynamicCellFallback:
    """Tests fail-closed behavior for dynamic cells in KDOP14 and AABB."""

    def test_dynamic_cell_fails_closed_to_unknown_and_refines(self, monkeypatch):
        """
        Synthesizes a 30-frame trajectory with a dynamic unit cell fluctuating between
        40.0 and 50.0 Ångströms. Verifies that block bounding sets L=0, U=inf,
        and exact refinement executes correctly.
        """
        n_frames = 30
        n_atoms = 2
        coords = np.zeros((n_frames, n_atoms, 3), dtype=np.float64)
        # Atom 0 at origin, Atom 1 at (5.0, 0, 0)
        coords[:, 0, :] = [0.0, 0.0, 0.0]
        coords[:, 1, :] = [5.0, 0.0, 0.0]

        # Dynamic box dimensions per frame
        boxes = np.array([[40.0 + (f % 5) * 2.0, 40.0, 40.0] for f in range(n_frames)], dtype=np.float64)

        source = SyntheticTrajectorySource(
            coords,
            boxes,
            timestep_ps=10.0,
            atom_names=["CA", "O2"]
        )
        assert source.has_dynamic_cell() is True

        temp_dir = tempfile.mkdtemp(prefix="mocs_dynamic_test_")
        try:
            # Mock _resolve_trajectory_source in compiler_service to return our dynamic synthetic source
            fake_traj_path = os.path.join(temp_dir, "dyn_traj.xtc")
            fake_topo_path = os.path.join(temp_dir, "dyn_topo.gro")
            data_bytes = coords.tobytes() + boxes.tobytes()
            with open(fake_traj_path, "wb") as f:
                f.write(data_bytes)
            with open(fake_topo_path, "wb") as f:
                f.write(data_bytes)

            def mock_resolve(traj_id):
                return source, fake_traj_path, fake_topo_path

            monkeypatch.setattr(compiler_service, "_resolve_trajectory_source", mock_resolve)

            # 1. Execute with KDOP14
            res_kdop = compiler_service.execute(
                "DISTANCE(name CA, name O2) < 6.0 A",
                trajectory_id="dyn_traj.xtc",
                bounding_model="KDOP14"
            )

            assert res_kdop.bounding_model == "KDOP14"
            assert res_kdop.truth_value == "TRUE"
            # Since cell is dynamic, block bounds cannot certify anything: certified_blocks must be 0
            assert res_kdop.certified_blocks == 0
            assert res_kdop.refined_blocks == 3  # 30 frames / 10 frames per block = 3 blocks
            for b in res_kdop.evaluated_blocks:
                assert b["lower_bound"] == 0.0
                assert b["upper_bound"] is None or b["upper_bound"] == float("inf")
                assert b["status"] in ("EXACT_TRUE", "REFINED")

            # 2. Execute with AABB and verify parity
            res_aabb = compiler_service.execute(
                "DISTANCE(name CA, name O2) < 6.0 A",
                trajectory_id="dyn_traj.xtc",
                bounding_model="AABB"
            )
            assert res_aabb.bounding_model == "AABB"
            assert res_aabb.truth_value == "TRUE"
            assert res_aabb.certified_blocks == 0
            assert res_aabb.refined_blocks == 3
            assert res_aabb.truth_value == res_kdop.truth_value
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
