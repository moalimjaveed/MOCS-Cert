"""Authoritative Reference Contact Evaluator."""

import numpy as np
from mocs.reference.distance import reference_distance

def reference_contact(
    topology_path: str,
    trajectory_path: str,
    atom_a_sel: str,
    atom_b_sel: str,
    cutoff: float
) -> np.ndarray:
    """
    Authoritative reference evaluator for CONTACT observable.
    Requires explicit cutoff parameter in Angstroms (no silent default).
    Returns: 1D np.ndarray of shape (n_frames,) containing booleans.
    """
    dist_series = reference_distance(topology_path, trajectory_path, atom_a_sel, atom_b_sel)
    return dist_series < cutoff
