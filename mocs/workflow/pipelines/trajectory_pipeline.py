"""
mocs.workflow.pipelines.trajectory_pipeline — Composable Trajectory Pipeline.

Implements explicit, non-mutating trajectory transformations:
- PBC unwrapping
- Centering on geometry or selection
- Kabsch rotational fit to reference structure
- Deterministic frame slicing
- Observable calculations (RMSD, RMSF, Radius of Gyration, Contacts)
"""

from __future__ import annotations
from typing import Dict, Any, List, Optional, Tuple
import numpy as np


def unwrap_pbc(coordinates: np.ndarray, box: np.ndarray) -> np.ndarray:
    """
    Unwrap trajectory coordinates across periodic boundary conditions.
    Never mutates the input array; returns a new unwrapped coordinate array.
    
    Args:
        coordinates: shape (n_frames, n_atoms, 3) or (n_atoms, 3)
        box: shape (3,) box vectors [lx, ly, lz]
    """
    unwrapped = np.copy(coordinates)
    if box is None or len(box) < 3 or not np.all(box[:3] > 0):
        return unwrapped

    box_dims = box[:3]
    if unwrapped.ndim == 2:
        # Single frame unwrapping relative to first atom
        delta = unwrapped - unwrapped[0:1]
        shift = np.round(delta / box_dims) * box_dims
        return unwrapped - shift

    # Multi-frame continuous trajectory unwrapping
    n_frames, n_atoms, _ = unwrapped.shape
    for k in range(1, n_frames):
        # Step-wise displacement between adjacent frames
        delta = unwrapped[k] - unwrapped[k - 1]
        shifts = np.round(delta / box_dims) * box_dims
        unwrapped[k] -= shifts

    return unwrapped


def center_coordinates(
    coordinates: np.ndarray,
    center_indices: Optional[List[int]] = None
) -> np.ndarray:
    """
    Translate coordinates so that center of geometry is at the origin (0, 0, 0).
    """
    centered = np.copy(coordinates)
    if centered.ndim == 2:
        subset = centered[center_indices] if center_indices is not None and len(center_indices) > 0 else centered
        cog = np.mean(subset, axis=0)
        centered -= cog
        return centered

    n_frames = centered.shape[0]
    for k in range(n_frames):
        subset = centered[k, center_indices] if center_indices is not None and len(center_indices) > 0 else centered[k]
        cog = np.mean(subset, axis=0)
        centered[k] -= cog
    return centered


def fit_reference(
    coordinates: np.ndarray,
    reference_coords: np.ndarray,
    fit_indices: Optional[List[int]] = None
) -> np.ndarray:
    """
    Superpose frames onto reference coordinates using the optimal Kabsch rotation algorithm.
    """
    fitted = np.copy(coordinates)
    ref = np.copy(reference_coords)
    if ref.ndim == 3:
        ref = ref[0]

    f_idx = fit_indices if fit_indices is not None and len(fit_indices) > 0 else list(range(ref.shape[0]))
    ref_sub = ref[f_idx] - np.mean(ref[f_idx], axis=0)

    if fitted.ndim == 2:
        sub = fitted[f_idx]
        sub_cog = np.mean(sub, axis=0)
        fitted -= sub_cog
        # Kabsch
        h = (fitted[f_idx]).T @ ref_sub
        u, s, vt = np.linalg.svd(h)
        d = np.sign(np.linalg.det(vt.T @ u.T))
        v_diag = np.diag([1.0, 1.0, d])
        rot = vt.T @ v_diag @ u.T
        return fitted @ rot.T

    n_frames = fitted.shape[0]
    for k in range(n_frames):
        sub = fitted[k, f_idx]
        sub_cog = np.mean(sub, axis=0)
        fitted[k] -= sub_cog
        h = (fitted[k, f_idx]).T @ ref_sub
        u, s, vt = np.linalg.svd(h)
        d = np.sign(np.linalg.det(vt.T @ u.T))
        v_diag = np.diag([1.0, 1.0, d])
        rot = vt.T @ v_diag @ u.T
        fitted[k] = fitted[k] @ rot.T

    return fitted


def slice_frames(
    total_frames: int,
    start: int = 0,
    stop: Optional[int] = None,
    stride: int = 1
) -> List[int]:
    """Deterministically generate discrete sampled frame indices."""
    end = total_frames if stop is None else min(stop, total_frames)
    st = max(1, stride)
    return list(range(start, end, st))


def compute_trajectory_metrics(
    coords_trajectory: np.ndarray,
    ref_coords: np.ndarray,
    atom_indices: Optional[List[int]] = None,
    contact_cutoff_angstrom: float = 4.5,
) -> Dict[str, Any]:
    """
    Compute standard physical observables:
    - RMSD time series
    - RMSF per atom
    - Radius of gyration (Rg) time series
    - Fraction of contacts
    """
    coords = coords_trajectory if coords_trajectory.ndim == 3 else coords_trajectory[np.newaxis, ...]
    ref = ref_coords[0] if ref_coords.ndim == 3 else ref_coords
    n_frames, n_atoms, _ = coords.shape

    idx = atom_indices if atom_indices is not None and len(atom_indices) > 0 else list(range(n_atoms))
    c_sub = coords[:, idx, :]
    r_sub = ref[idx, :]

    # 1. RMSD
    diff = c_sub - r_sub[np.newaxis, :, :]
    rmsd = np.sqrt(np.mean(np.sum(diff ** 2, axis=-1), axis=-1))

    # 2. RMSF
    mean_pos = np.mean(c_sub, axis=0)
    fluc = c_sub - mean_pos[np.newaxis, :, :]
    rmsf = np.sqrt(np.mean(np.sum(fluc ** 2, axis=-1), axis=0))

    # 3. Radius of Gyration (Rg)
    cog = np.mean(c_sub, axis=1, keepdims=True)
    r_cog = c_sub - cog
    rg = np.sqrt(np.mean(np.sum(r_cog ** 2, axis=-1), axis=-1))

    # 4. Contacts within cutoff (e.g., between all atom pairs in selection)
    contacts = []
    for k in range(n_frames):
        pts = c_sub[k]
        # Pairwise distance matrix
        dmat = np.linalg.norm(pts[:, np.newaxis, :] - pts[np.newaxis, :, :], axis=-1)
        # Exclude self-distance (diagonal)
        np.fill_diagonal(dmat, np.inf)
        n_contacts = int(np.sum(dmat < contact_cutoff_angstrom) // 2)
        contacts.append(n_contacts)

    return {
        "n_frames": n_frames,
        "n_atoms_evaluated": len(idx),
        "rmsd_mean": float(np.mean(rmsd)),
        "rmsd_max": float(np.max(rmsd)),
        "rmsd_min": float(np.min(rmsd)),
        "rmsd_series": rmsd.tolist(),
        "rmsf_mean": float(np.mean(rmsf)),
        "rmsf_per_atom": rmsf.tolist(),
        "rg_mean": float(np.mean(rg)),
        "rg_series": rg.tolist(),
        "contacts_series": contacts,
        "contacts_mean": float(np.mean(contacts)),
    }
