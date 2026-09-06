"""MOCS-Cert Hybrid Array Acceleration Layer (JAX + NumPy + CuPy)."""
from mocs.arrays.dispatcher import (
    BackendType,
    has_cuda,
    has_rocm,
    has_cupy,
    has_jax,
    detect_optimal_backend,
    get_array_module,
    to_host,
    to_device,
    batch_compute_aabb,
    batch_derive_pairwise_bounds
)
from mocs.arrays.numpy_backend import numpy_compute_aabb, numpy_derive_bounds
from mocs.arrays.cupy_backend import is_cupy_available, cupy_compute_aabb, cupy_derive_bounds
from mocs.arrays.jax_backend import is_jax_available, jax_compute_aabb, jax_derive_bounds

__all__ = [
    "BackendType",
    "has_cuda",
    "has_rocm",
    "has_cupy",
    "has_jax",
    "detect_optimal_backend",
    "get_array_module",
    "to_host",
    "to_device",
    "batch_compute_aabb",
    "batch_derive_pairwise_bounds",
    "numpy_compute_aabb",
    "numpy_derive_bounds",
    "is_cupy_available",
    "cupy_compute_aabb",
    "cupy_derive_bounds",
    "is_jax_available",
    "jax_compute_aabb",
    "jax_derive_bounds"
]
