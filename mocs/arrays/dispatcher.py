"""Hardware Detection and Multi-Backend Array Dispatcher for MOCS-Cert."""
from __future__ import annotations
from enum import Enum
from typing import Tuple, Any
import numpy as np

from mocs.arrays.numpy_backend import numpy_compute_aabb, numpy_derive_bounds
from mocs.arrays.cupy_backend import is_cupy_available, cupy_compute_aabb, cupy_derive_bounds
from mocs.arrays.jax_backend import is_jax_available, jax_compute_aabb, jax_derive_bounds

class BackendType(str, Enum):
    NUMPY = "numpy"
    CUPY = "cupy"
    JAX = "jax"
    AUTO = "auto"

def has_cuda() -> bool:
    return is_cupy_available()

def has_rocm() -> bool:
    return is_cupy_available()

def has_cupy() -> bool:
    return is_cupy_available()

def has_jax() -> bool:
    return is_jax_available()

def detect_optimal_backend(device: str = "auto") -> str:
    req = device.lower().strip()
    if req in ("cuda", "gpu", "rocm"):
        if is_cupy_available():
            return BackendType.CUPY.value
        elif is_jax_available():
            return BackendType.JAX.value
        return BackendType.NUMPY.value
    elif req in ("jax", "xla"):
        if is_jax_available():
            return BackendType.JAX.value
        return BackendType.NUMPY.value
    elif req in ("numpy", "cpu"):
        return BackendType.NUMPY.value

    if is_cupy_available():
        return BackendType.CUPY.value
    elif is_jax_available():
        return BackendType.JAX.value
    return BackendType.NUMPY.value

def get_array_module(backend: str = "auto") -> Any:
    resolved = detect_optimal_backend(backend)
    if resolved == BackendType.CUPY.value and is_cupy_available():
        import cupy as cp
        return cp
    elif resolved == BackendType.JAX.value and is_jax_available():
        import jax.numpy as jnp
        return jnp
    return np

def to_host(arr: Any) -> np.ndarray:
    if isinstance(arr, np.ndarray):
        return arr
    if hasattr(arr, "get"):
        try:
            return arr.get()
        except Exception:
            pass
    try:
        return np.asarray(arr)
    except Exception:
        raise TypeError(f"Cannot convert object of type {type(arr)} to host NumPy array.")

def to_device(arr: Any, backend: str = "auto") -> Any:
    resolved = detect_optimal_backend(backend)
    if resolved == BackendType.CUPY.value and is_cupy_available():
        import cupy as cp
        return cp.asarray(arr)
    elif resolved == BackendType.JAX.value and is_jax_available():
        import jax.numpy as jnp
        return jnp.asarray(arr)
    return np.asarray(arr)

def batch_compute_aabb(coords: Any, backend: str = "auto") -> Tuple[np.ndarray, np.ndarray]:
    resolved = detect_optimal_backend(backend)
    if resolved == BackendType.CUPY.value and is_cupy_available():
        min_box, max_box = cupy_compute_aabb(coords)
        return to_host(min_box), to_host(max_box)
    elif resolved == BackendType.JAX.value and is_jax_available():
        min_box, max_box = jax_compute_aabb(coords)
        return to_host(min_box), to_host(max_box)
    else:
        min_box, max_box = numpy_compute_aabb(to_host(coords))
        return min_box, max_box

def batch_derive_pairwise_bounds(
    aabb_a: Tuple[Any, Any],
    aabb_b: Tuple[Any, Any],
    box_dimensions: Any,
    backend: str = "auto"
) -> Tuple[np.ndarray, np.ndarray]:
    from mocs.bounds.periodic_bounds import validate_orthorhombic_box
    valid_box = validate_orthorhombic_box(to_host(box_dimensions))
    resolved = detect_optimal_backend(backend)
    if resolved == BackendType.CUPY.value and is_cupy_available():
        L, U = cupy_derive_bounds(aabb_a, aabb_b, valid_box)
        return to_host(L), to_host(U)
    elif resolved == BackendType.JAX.value and is_jax_available():
        L, U = jax_derive_bounds(aabb_a, aabb_b, valid_box)
        return to_host(L), to_host(U)
    else:
        L, U = numpy_derive_bounds(
            (to_host(aabb_a[0]), to_host(aabb_a[1])),
            (to_host(aabb_b[0]), to_host(aabb_b[1])),
            valid_box
        )
        return L, U
