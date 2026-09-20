"""Geometric Bounding & PBC Mathematics."""

import math
from typing import Tuple
import numpy as np
from typing import Tuple, Union
import numpy as np
from mocs.exceptions import MOCSUnsupportedGeometryError
from mocs.bounds.periodic_cell import PeriodicCell

def validate_orthorhombic_box(box: np.ndarray) -> np.ndarray:
    """
    Validates that a simulation box conforms strictly to orthorhombic PBC.
    
    Rejects:
      - None or non-finite inputs (NaN, Inf)
      - Triclinic matrices (non-zero off-diagonal elements |B_ij| > 1e-6 for i != j)
      - Dimensions <= 0.0 (degenerate / collapsed simulation cell)
      - Vectors with length != 3
      
    Returns:
      1D float64 numpy array of shape (3,) containing [L_x, L_y, L_z].
    """
    if box is None:
        raise MOCSUnsupportedGeometryError("Simulation box cannot be None.")
    
    arr = np.asarray(box, dtype=np.float64)
    if not np.all(np.isfinite(arr)):
        raise MOCSUnsupportedGeometryError(f"Box dimensions contain non-finite values: {arr}")
    
    if arr.ndim == 2:
        if arr.shape != (3, 3):
            raise MOCSUnsupportedGeometryError(f"Simulation box matrix must be 3x3, got shape {arr.shape}.")
        off_diag_mask = ~np.eye(3, dtype=bool)
        if np.any(np.abs(arr[off_diag_mask]) > 1e-6):
            raise MOCSUnsupportedGeometryError(
                "Triclinic and non-orthorhombic simulation cells are unsupported in V0.1. "
                "Only fixed orthorhombic cells with diagonal box tensors are supported."
            )
        diag = np.diag(arr)
    elif arr.ndim == 1:
        if arr.shape[0] == 6:
            angles = arr[3:]
            if np.any(np.abs(angles - 90.0) > 1e-3):
                raise MOCSUnsupportedGeometryError(
                    f"Triclinic and non-orthorhombic simulation cells are unsupported in V0.1: "
                    f"cell angles [alpha={angles[0]:.2f}, beta={angles[1]:.2f}, gamma={angles[2]:.2f}] != 90 degrees."
                )
            diag = arr[:3]
        elif arr.shape[0] == 3:
            diag = arr
        else:
            raise MOCSUnsupportedGeometryError(
                f"Box dimension vector must have length 3 (or 6 [lx, ly, lz, alpha, beta, gamma]), got length {arr.shape[0]}."
            )
    else:
        raise MOCSUnsupportedGeometryError(f"Unsupported box tensor dimensionality: {arr.ndim}D.")
    
    if np.any(diag <= 0.0):
        raise MOCSUnsupportedGeometryError(f"Box dimensions must be strictly positive (> 0.0), got {diag}.")
    
    return diag

def minimum_image_displacement(delta: np.ndarray, box: Union[np.ndarray, PeriodicCell]) -> np.ndarray:
    """Computes minimum-image displacement vector with round-to-nearest-even tie-breaking."""
    if isinstance(box, PeriodicCell):
        return box.minimum_image_displacement(delta)
    box_diag = validate_orthorhombic_box(box)
    return delta - box_diag * np.round(delta / box_diag)

def compute_pbc_bounds(
    aabb_a: Tuple[np.ndarray, np.ndarray],
    aabb_b: Tuple[np.ndarray, np.ndarray],
    box_dimensions: Union[np.ndarray, PeriodicCell]
) -> Tuple[float, float]:
    """
    [PROVEN BOUND]
    Computes conservative lower bound L and upper bound U for Euclidean distance
    between two atomic AABBs under periodic boundary conditions.
    """
    if isinstance(box_dimensions, PeriodicCell):
        return box_dimensions.compute_aabb_bounds(aabb_a, aabb_b)
    box_diag = validate_orthorhombic_box(box_dimensions)
    a_min = np.asarray(aabb_a[0], dtype=np.float64)
    a_max = np.asarray(aabb_a[1], dtype=np.float64)
    b_min = np.asarray(aabb_b[0], dtype=np.float64)
    b_max = np.asarray(aabb_b[1], dtype=np.float64)

    if not (np.all(np.isfinite(a_min)) and np.all(np.isfinite(a_max)) and
            np.all(np.isfinite(b_min)) and np.all(np.isfinite(b_max))):
        raise MOCSUnsupportedGeometryError("AABB coordinates contain non-finite values (NaN or Inf).")
    
    dx_min_sq, dy_min_sq, dz_min_sq = 0.0, 0.0, 0.0
    dx_max_sq, dy_max_sq, dz_max_sq = 0.0, 0.0, 0.0
    
    for mu in range(3):
        L_mu = box_diag[mu]
        I_a = (a_min[mu], a_max[mu])
        I_b = (b_min[mu], b_max[mu])
        
        c_a = 0.5 * (I_a[0] + I_a[1])
        c_b = 0.5 * (I_b[0] + I_b[1])
        delta_c = c_b - c_a
        delta_c -= L_mu * np.round(delta_c / L_mu)
        
        r_a = 0.5 * (I_a[1] - I_a[0])
        r_b = 0.5 * (I_b[1] - I_b[0])
        r_sum = r_a + r_b
        
        d_mu_min = max(0.0, abs(delta_c) - r_sum)
        d_mu_max = min(0.5 * L_mu, abs(delta_c) + r_sum)
        
        if mu == 0:
            dx_min_sq, dx_max_sq = d_mu_min ** 2, d_mu_max ** 2
        elif mu == 1:
            dy_min_sq, dy_max_sq = d_mu_min ** 2, d_mu_max ** 2
        else:
            dz_min_sq, dz_max_sq = d_mu_min ** 2, d_mu_max ** 2

    L = math.sqrt(dx_min_sq + dy_min_sq + dz_min_sq)
    U = math.sqrt(dx_max_sq + dy_max_sq + dz_max_sq)
    return L, U

def verify_refinement_non_expansion(
    parent_bounds: Tuple[float, float],
    child_bounds: Tuple[float, float],
    epsilon: float = 1e-7
) -> bool:
    """
    [MATHEMATICAL INVARIANT]
    Verifies that dyadic refinement preserves subset enclosure:
      L_child >= L_parent - epsilon
      U_child <= U_parent + epsilon
    Also rejects non-finite bounds (NaN, Inf) and inverted bounds (L > U).
    """
    L_p, U_p = parent_bounds
    L_c, U_c = child_bounds

    if not (math.isfinite(L_p) and math.isfinite(U_p) and math.isfinite(L_c) and math.isfinite(U_c)):
        return False
    if L_p > U_p or L_c > U_c:
        return False

    return (L_c >= L_p - epsilon) and (U_c <= U_p + epsilon)
