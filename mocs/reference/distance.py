"""Authoritative Reference Distance Evaluator."""

from typing import Optional
import numpy as np
try:
    import MDAnalysis as mda
except ImportError:
    mda = None

def reference_distance(
    topology_path: str,
    trajectory_path: str,
    atom_a_sel: str,
    atom_b_sel: str,
    pbc_mode: str = "orthorhombic_minimum_image"
) -> np.ndarray:
    """
    Authoritative reference evaluator for DISTANCE observable.
    Iterates through all frames sequentially without indexing.
    Returns: 1D np.ndarray of shape (n_frames,) containing float64 distances in Angstroms.
    """
    if mda is None:
        raise ImportError("MDAnalysis is required to execute reference trajectory scanning.")
    if pbc_mode != "orthorhombic_minimum_image":
        raise NotImplementedError(f"Unsupported PBC mode in reference: {pbc_mode}")

    u = mda.Universe(topology_path, trajectory_path)
    ag_a = u.select_atoms(atom_a_sel)
    ag_b = u.select_atoms(atom_b_sel)

    if len(ag_a) == 0 or len(ag_b) == 0:
        raise ValueError(f"Selections must resolve to at least 1 atom. Got {len(ag_a)} and {len(ag_b)}")

    indices_a = ag_a.indices
    indices_b = ag_b.indices

    n_frames = len(u.trajectory)
    distances = np.zeros(n_frames, dtype=np.float64)

    is_single_pair = (len(indices_a) == 1 and len(indices_b) == 1)
    if is_single_pair:
        idx_a = indices_a[0]
        idx_b = indices_b[0]

    for k, ts in enumerate(u.trajectory):
        box = ts.dimensions[:3]
        if box is None or np.any(box <= 0):
            raise ValueError(f"Frame {k} possesses invalid or non-orthorhombic simulation box.")

        if is_single_pair:
            pos_a = ts.positions[idx_a]
            pos_b = ts.positions[idx_b]
            delta = pos_b - pos_a
            delta -= box * np.round(delta / box)
            distances[k] = float(np.linalg.norm(delta))
        else:
            pos_a = ts.positions[indices_a]  # (N, 3)
            pos_b = ts.positions[indices_b]  # (M, 3)
            diff = pos_a[:, np.newaxis, :] - pos_b[np.newaxis, :, :]  # (N, M, 3)
            diff -= box * np.round(diff / box)
            distances[k] = float(np.min(np.linalg.norm(diff, axis=-1)))

    return distances
