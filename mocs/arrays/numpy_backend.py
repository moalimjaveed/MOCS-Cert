"""NumPy CPU Array Backend for MOCS-Cert.

Provides CPU baseline vectorization, MDAnalysis format reader interoperability,
and fallback execution on standard hosts without GPU/JAX acceleration.
"""

from __future__ import annotations
from typing import Tuple
import numpy as np

def numpy_compute_aabb(coords: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    if coords.ndim == 2:
        return np.min(coords, axis=0), np.max(coords, axis=0)
    elif coords.ndim == 3:
        return np.min(coords, axis=(0, 1)), np.max(coords, axis=(0, 1))
    elif coords.ndim == 4:
        return np.min(coords, axis=(1, 2)), np.max(coords, axis=(1, 2))
    else:
        reduce_axes = tuple(range(coords.ndim - 1))
        return np.min(coords, axis=reduce_axes), np.max(coords, axis=reduce_axes)

def numpy_derive_bounds(
    aabb_a: Tuple[np.ndarray, np.ndarray],
    aabb_b: Tuple[np.ndarray, np.ndarray],
    box_dimensions: np.ndarray
) -> Tuple[np.ndarray, np.ndarray]:
    from mocs.bounds.periodic_bounds import validate_orthorhombic_box
    min_a, max_a = np.asarray(aabb_a[0], dtype=np.float64), np.asarray(aabb_a[1], dtype=np.float64)
    min_b, max_b = np.asarray(aabb_b[0], dtype=np.float64), np.asarray(aabb_b[1], dtype=np.float64)
    box = validate_orthorhombic_box(box_dimensions)

    c_a = 0.5 * (min_a + max_a)
    c_b = 0.5 * (min_b + max_b)
    r_a = 0.5 * (max_a - min_a)
    r_b = 0.5 * (max_b - min_b)
    r_sum = r_a + r_b

    delta_c = c_b - c_a
    delta_c = delta_c - box * np.round(delta_c / box)

    abs_delta_c = np.abs(delta_c)
    d_mu_min = np.maximum(0.0, abs_delta_c - r_sum)
    d_mu_max = np.minimum(0.5 * box, abs_delta_c + r_sum)

    L = np.sqrt(np.sum(d_mu_min ** 2, axis=-1))
    U = np.sqrt(np.sum(d_mu_max ** 2, axis=-1))
    return L, U
