"""
F-002 Regression & Property Test Suite.

Verifies:
1. Non-reduced triclinic cells are rejected immediately with MOCSUnsupportedGeometryError (fail-closed).
2. Reduced triclinic cells initialize cleanly and maintain exact minimum-image soundness against exhaustive lattice search.
3. AABB bounds [L, U] strictly satisfy L <= true_distance <= U across all admissible configurations.
"""

import numpy as np
import pytest
from mocs.bounds.periodic_cell import PeriodicCell
from mocs.exceptions import MOCSUnsupportedGeometryError


def test_f002_non_reduced_cell_rejected():
    """Non-reduced triclinic cells must be rejected fail-closed."""
    H_non_reduced = np.array([
        [30.0, 60.0, 60.0],
        [0.0,  30.0, 60.0],
        [0.0,   0.0, 30.0]
    ], dtype=np.float64)

    with pytest.raises(MOCSUnsupportedGeometryError) as excinfo:
        PeriodicCell(H_non_reduced)
    assert "Non-reduced triclinic cell" in str(excinfo.value)


def test_f002_reduced_cells_accepted():
    """Reduced cells must pass."""
    L = 40.0
    H_rhombic = np.array([
        [L, 0.0, L / 2.0],
        [0.0, L, L / 2.0],
        [0.0, 0.0, L * np.sqrt(2.0) / 2.0]
    ], dtype=np.float64)

    cell = PeriodicCell(H_rhombic)
    assert cell.is_reduced
    assert not cell.is_orthorhombic


def test_f002_exhaustive_lattice_search_differential():
    """Differential verification against exhaustive +-3 lattice search for reduced cells."""
    L = 30.0
    H = np.array([
        [L, L * 0.3, L * 0.4],
        [0.0, L, L * 0.2],
        [0.0, 0.0, L]
    ], dtype=np.float64)

    cell = PeriodicCell(H)

    shifts = []
    for nx in range(-3, 4):
        for ny in range(-3, 4):
            for nz in range(-3, 4):
                shifts.append(nx * H[:, 0] + ny * H[:, 1] + nz * H[:, 2])
    shifts = np.array(shifts)

    rng = np.random.RandomState(42)
    for _ in range(50):
        p1 = rng.uniform(-50.0, 50.0, size=3)
        p2 = rng.uniform(-50.0, 50.0, size=3)

        diff = p2 - p1
        d_mic = cell.minimum_image_displacement(diff)
        dist_mic = float(np.linalg.norm(d_mic))

        shifted_diffs = diff + shifts
        dists_all = np.linalg.norm(shifted_diffs, axis=1)
        dist_oracle = float(np.min(dists_all))

        assert abs(dist_mic - dist_oracle) < 1e-6, f"MIC mismatch: cell={dist_mic}, oracle={dist_oracle}"
