"""Unit tests for TrajectorySource implementations."""

import os
import pytest
import numpy as np
from mocs.io import MDAnalysisTrajectorySource, SyntheticTrajectorySource

def test_synthetic_trajectory_source():
    n_frames, n_atoms = 10, 5
    coords = np.random.uniform(0.0, 50.0, size=(n_frames, n_atoms, 3))
    box = np.array([50.0, 50.0, 50.0])
    source = SyntheticTrajectorySource(coords, box, timestep_ps=5.0)

    assert source.get_total_frames() == 10
    assert source.get_timestep_ps() == 5.0
    assert np.allclose(source.get_box(), [50.0, 50.0, 50.0])

    # Frame read
    f0 = source.read_frame_coordinates(0)
    assert f0.shape == (n_atoms, 3)
    assert np.allclose(f0, coords[0])

    # Slice block read
    b = source.read_block_coordinates(2, 6)
    assert b.shape == (4, n_atoms, 3)
    assert np.allclose(b, coords[2:6])

    # Atom selection resolution
    idx = source.resolve_selection("0")
    assert idx.tolist() == [0]

def test_mda_trajectory_source():
    gro_path = "tests/data/synth_500f.gro"
    xtc_path = "tests/data/synth_500f.xtc"
    if not os.path.exists(gro_path) or not os.path.exists(xtc_path):
        pytest.skip("Fixture synth_500f files not present.")

    source = MDAnalysisTrajectorySource(gro_path, xtc_path)
    assert source.get_total_frames() == 500
    assert source.get_timestep_ps() == 10.0
    assert len(source.get_file_sha256()) == 64
    assert len(source.get_topology_sha256()) == 64

    # Resolve selections
    ca_idx = source.resolve_selection("name CA")
    o2_idx = source.resolve_selection("name O2")
    assert len(ca_idx) == 1 and ca_idx[0] == 0
    assert len(o2_idx) == 1 and o2_idx[0] == 1

    # Read block
    coords = source.read_block_coordinates(0, 10, ca_idx)
    assert coords.shape == (10, 1, 3)
    assert np.allclose(coords[0, 0], [40.0, 40.0, 40.0])
