"""CuPy GPU Array Backend for MOCS-Cert."""
from __future__ import annotations
from typing import Tuple, Any
import numpy as np

try:
    import cupy as cp
    _CUPY_AVAILABLE = True
except (ImportError, Exception):
    cp = None
    _CUPY_AVAILABLE = False

def is_cupy_available() -> bool:
    if not _CUPY_AVAILABLE or cp is None:
        return False
    try:
        return cp.cuda.runtime.getDeviceCount() > 0
    except Exception:
        return False

def cupy_compute_aabb(coords: Any) -> Tuple[Any, Any]:
    if not is_cupy_available():
        raise RuntimeError("CuPy backend requested but CuPy/CUDA device is not available.")
    coords_gpu = cp.asarray(coords, dtype=cp.float64)
    if coords_gpu.ndim == 2:
        return cp.min(coords_gpu, axis=0), cp.max(coords_gpu, axis=0)
    elif coords_gpu.ndim == 3:
        return cp.min(coords_gpu, axis=(0, 1)), cp.max(coords_gpu, axis=(0, 1))
    elif coords_gpu.ndim == 4:
        return cp.min(coords_gpu, axis=(1, 2)), cp.max(coords_gpu, axis=(1, 2))
    else:
        reduce_axes = tuple(range(coords_gpu.ndim - 1))
        return cp.min(coords_gpu, axis=reduce_axes), cp.max(coords_gpu, axis=reduce_axes)

def cupy_derive_bounds(aabb_a: Tuple[Any, Any], aabb_b: Tuple[Any, Any], box_dimensions: Any) -> Tuple[Any, Any]:
    if not is_cupy_available():
        raise RuntimeError("CuPy backend requested but CuPy/CUDA device is not available.")
    min_a = cp.asarray(aabb_a[0], dtype=cp.float64)
    max_a = cp.asarray(aabb_a[1], dtype=cp.float64)
    min_b = cp.asarray(aabb_b[0], dtype=cp.float64)
    max_b = cp.asarray(aabb_b[1], dtype=cp.float64)
    box = cp.asarray(box_dimensions, dtype=cp.float64)

    c_a = 0.5 * (min_a + max_a)
    c_b = 0.5 * (min_b + max_b)
    r_a = 0.5 * (max_a - min_a)
    r_b = 0.5 * (max_b - min_b)
    r_sum = r_a + r_b

    delta_c = c_b - c_a
    delta_c = delta_c - box * cp.round(delta_c / box)

    abs_delta_c = cp.abs(delta_c)
    d_mu_min = cp.maximum(0.0, abs_delta_c - r_sum)
    d_mu_max = cp.minimum(0.5 * box, abs_delta_c + r_sum)

    L = cp.sqrt(cp.sum(d_mu_min ** 2, axis=-1))
    U = cp.sqrt(cp.sum(d_mu_max ** 2, axis=-1))
    return L, U
