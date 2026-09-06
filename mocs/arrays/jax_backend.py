"""JAX OpenXLA Array Backend for MOCS-Cert."""
from __future__ import annotations
from typing import Tuple, Any
import numpy as np

try:
    import jax
    import jax.numpy as jnp
    _JAX_AVAILABLE = True
except (ImportError, Exception):
    jax = None
    jnp = None
    _JAX_AVAILABLE = False

def is_jax_available() -> bool:
    return _JAX_AVAILABLE and jax is not None

def jax_compute_aabb(coords: Any) -> Tuple[Any, Any]:
    if not is_jax_available():
        raise RuntimeError("JAX backend requested but JAX is not available.")
    coords_jax = jnp.asarray(coords, dtype=jnp.float64)
    reduce_axes = tuple(range(coords_jax.ndim - 1))
    return jnp.min(coords_jax, axis=reduce_axes), jnp.max(coords_jax, axis=reduce_axes)

def jax_derive_bounds(aabb_a: Tuple[Any, Any], aabb_b: Tuple[Any, Any], box_dimensions: Any) -> Tuple[Any, Any]:
    if not is_jax_available():
        raise RuntimeError("JAX backend requested but JAX is not available.")
    min_a = jnp.asarray(aabb_a[0], dtype=jnp.float64)
    max_a = jnp.asarray(aabb_a[1], dtype=jnp.float64)
    min_b = jnp.asarray(aabb_b[0], dtype=jnp.float64)
    max_b = jnp.asarray(aabb_b[1], dtype=jnp.float64)
    box = jnp.asarray(box_dimensions, dtype=jnp.float64)

    c_a = 0.5 * (min_a + max_a)
    c_b = 0.5 * (min_b + max_b)
    r_a = 0.5 * (max_a - min_a)
    r_b = 0.5 * (max_b - min_b)
    r_sum = r_a + r_b

    delta_c = c_b - c_a
    delta_c = delta_c - box * jnp.round(delta_c / box)

    abs_delta_c = jnp.abs(delta_c)
    d_mu_min = jnp.maximum(0.0, abs_delta_c - r_sum)
    d_mu_max = jnp.minimum(0.5 * box, abs_delta_c + r_sum)

    L = jnp.sqrt(jnp.sum(d_mu_min ** 2, axis=-1))
    U = jnp.sqrt(jnp.sum(d_mu_max ** 2, axis=-1))
    return L, U
