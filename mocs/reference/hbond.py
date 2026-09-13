"""Authoritative Reference Hydrogen Bond Evaluator."""

import numpy as np
try:
    import MDAnalysis as mda
except ImportError:
    mda = None

def reference_hbond(
    topology_path: str,
    trajectory_path: str,
    donor_sel: str,
    hydrogen_sel: str,
    acceptor_sel: str,
    d_cutoff: float = 3.5,
    angle_cutoff_deg: float = 120.0
) -> np.ndarray:
    """
    Authoritative reference evaluator for HBOND observable.
    Requires explicit hydrogen covalently bonded to donor.
    Returns: 1D np.ndarray of shape (n_frames,) of boolean states.
    """
    if mda is None:
        raise ImportError("MDAnalysis is required to execute reference trajectory scanning.")

    u = mda.Universe(topology_path, trajectory_path)
    d_atom = u.select_atoms(donor_sel)
    h_atom = u.select_atoms(hydrogen_sel)
    a_atom = u.select_atoms(acceptor_sel)

    if len(d_atom) != 1 or len(h_atom) != 1 or len(a_atom) != 1:
        raise ValueError("Donor, hydrogen, and acceptor selections must each resolve to 1 atom.")

    d_idx = d_atom.indices[0]
    h_idx = h_atom.indices[0]
    a_idx = a_atom.indices[0]

    bonds = set(u.bonds.to_indices())
    if (min(d_idx, h_idx), max(d_idx, h_idx)) not in bonds:
        raise ValueError(f"Topology does not contain a covalent bond between donor {d_idx} and hydrogen {h_idx}")

    n_frames = len(u.trajectory)
    hbond_states = np.zeros(n_frames, dtype=bool)
    angle_cutoff_rad = np.deg2rad(angle_cutoff_deg)

    for k, ts in enumerate(u.trajectory):
        box = ts.dimensions[:3]
        pos_d = ts.positions[d_idx]
        pos_h = ts.positions[h_idx]
        pos_a = ts.positions[a_idx]

        # Vectors relative to H in common minimum-image frame
        v_hd = pos_d - pos_h
        v_hd -= box * np.round(v_hd / box)

        v_ha = pos_a - pos_h
        v_ha -= box * np.round(v_ha / box)

        norm_hd = np.linalg.norm(v_hd)
        norm_ha = np.linalg.norm(v_ha)
        if norm_hd < 1e-12 or norm_ha < 1e-12:
            raise ValueError(f"Frame {k}: Zero-displacement singularity detected in HBOND calculation.")

        # D-A distance in common image frame centered on H
        delta_da = v_ha - v_hd
        d_da = np.linalg.norm(delta_da)

        if d_da >= d_cutoff:
            hbond_states[k] = False
            continue

        cos_theta = np.dot(v_hd, v_ha) / (norm_hd * norm_ha)
        cos_theta = np.clip(cos_theta, -1.0, 1.0)
        theta = np.arccos(cos_theta)

        hbond_states[k] = bool(theta >= angle_cutoff_rad)

    return hbond_states
