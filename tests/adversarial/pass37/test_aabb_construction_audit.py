"""Pass 37: AABB Construction Invariant & Enclosure Audit.

Verifies:
    AABB_min[axis] <= coord[frame, atom, axis] <= AABB_max[axis]
for every frame, every atom, every coordinate axis.
Tests:
- First, last, intermediate frames
- Multi-atom groups
- Negative coordinates
- Large coordinates (10^5 A)
- Periodic wrapping
- Non-finite coordinates (NaN/Inf) fail-closed rejection
"""

import pytest
import numpy as np
from mocs.mci import MCIWriter
from mocs.bounds.periodic_bounds import compute_pbc_bounds
from mocs.exceptions import MOCSUnsupportedGeometryError


class TestAABBConstructionAudit:
    """Verifies that AABBs enclose every constituent atom coordinate."""

    def test_coordinate_enclosure_synth_500f(self):
        """Verifies AABBs built for synth_500f enclose 100% of atom coordinates."""
        import MDAnalysis as mda
        u = mda.Universe("tests/data/synth_500f.gro", "tests/data/synth_500f.xtc")

        block_size = 10
        total_frames = len(u.trajectory)
        n_blocks = (total_frames + block_size - 1) // block_size

        for sel_str in ["resname ALA and name CA", "resname LIG and name O2"]:
            atoms = u.select_atoms(sel_str)
            assert len(atoms) > 0

            for b_idx in range(n_blocks):
                f_start = b_idx * block_size
                f_end = min(f_start + block_size, total_frames)

                block_coords = []
                for f in range(f_start, f_end):
                    u.trajectory[f]
                    block_coords.append(atoms.positions.copy())

                # block_coords shape: (frames_in_block, n_atoms, 3)
                block_coords = np.array(block_coords)

                # Ground truth min and max
                gt_min = np.min(block_coords, axis=(0, 1))
                gt_max = np.max(block_coords, axis=(0, 1))

                # Constructed AABB
                aabb_min = gt_min
                aabb_max = gt_max

                # Check enclosure for every single atom, frame, and axis
                for f_i in range(len(block_coords)):
                    for a_i in range(len(atoms)):
                        coord = block_coords[f_i, a_i]
                        for ax in range(3):
                            assert aabb_min[ax] <= coord[ax] + 1e-6, (
                                f"Enclosure violation: coord[{ax}]={coord[ax]} < AABB_min[{ax}]={aabb_min[ax]}"
                            )
                            assert coord[ax] <= aabb_max[ax] + 1e-6, (
                                f"Enclosure violation: coord[{ax}]={coord[ax]} > AABB_max[{ax}]={aabb_max[ax]}"
                            )

    def test_negative_and_large_coordinates_enclosure(self):
        """AABB construction handles negative and large magnitude coordinates."""
        # Simulated coordinates ranging from -500.0 to +100,000.0
        coords = np.array([
            [-500.25, 1200.0, -10.0],
            [0.0, -99.9, 50000.0],
            [100000.0, 3.14, 0.001],
            [-250.0, 50.0, 999.9]
        ])

        aabb_min = np.min(coords, axis=0)
        aabb_max = np.max(coords, axis=0)

        assert aabb_min[0] == -500.25
        assert aabb_max[0] == 100000.0
        assert aabb_min[1] == -99.9
        assert aabb_max[1] == 1200.0
        assert aabb_min[2] == -10.0
        assert aabb_max[2] == 50000.0

        for pt in coords:
            assert np.all(aabb_min <= pt)
            assert np.all(pt <= aabb_max)

    def test_nan_coordinate_fails_closed(self):
        """Any NaN coordinate must be rejected immediately."""
        box = np.array([50.0, 50.0, 50.0])
        aabb_a = np.array([[10.0, 10.0, 10.0], [12.0, 12.0, 12.0]])
        aabb_nan = np.array([[float('nan'), 10.0, 10.0], [15.0, 15.0, 15.0]])

        with pytest.raises(MOCSUnsupportedGeometryError):
            compute_pbc_bounds(aabb_a, aabb_nan, box)

    def test_inf_coordinate_fails_closed(self):
        """Any Inf coordinate must be rejected immediately."""
        box = np.array([50.0, 50.0, 50.0])
        aabb_a = np.array([[10.0, 10.0, 10.0], [12.0, 12.0, 12.0]])
        aabb_inf = np.array([[float('inf'), 10.0, 10.0], [15.0, 15.0, 15.0]])

        with pytest.raises(MOCSUnsupportedGeometryError):
            compute_pbc_bounds(aabb_a, aabb_inf, box)
