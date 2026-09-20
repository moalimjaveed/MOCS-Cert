"""PASS 22 - Adversarial PBC Semantic Boundary Tests.

Verifies:
1. Rejection of triclinic / non-orthorhombic simulation boxes with MOCSUnsupportedGeometryError.
2. Rejection of non-finite, negative, or degenerate box vectors.
3. Proper diagonal extraction for 3x3 orthogonal matrices.
4. Fail-closed behavior on minimum_image_displacement and compute_pbc_bounds.
"""

import sys
import numpy as np
import pytest
sys.path.insert(0, '.')

from mocs.bounds.periodic_bounds import (
    validate_orthorhombic_box,
    compute_pbc_bounds,
    minimum_image_displacement
)
from mocs.exceptions import MOCSUnsupportedGeometryError

def test_triclinic_3x3_matrix_rejection():
    # Triclinic cell with non-zero xy shear
    box = np.array([
        [80.0, 15.0, 0.0],
        [0.0, 80.0, 0.0],
        [0.0, 0.0, 80.0]
    ])
    with pytest.raises(MOCSUnsupportedGeometryError, match='Triclinic and non-orthorhombic'):
        validate_orthorhombic_box(box)
    
    aabb_a = (np.array([0., 0., 0.]), np.array([1., 1., 1.]))
    aabb_b = (np.array([10., 10., 10.]), np.array([11., 11., 11.]))
    with pytest.raises(MOCSUnsupportedGeometryError):
        compute_pbc_bounds(aabb_a, aabb_b, box)
    
    with pytest.raises(MOCSUnsupportedGeometryError):
        minimum_image_displacement(np.array([5.0, 5.0, 5.0]), box)

def test_hexagonal_rhombic_dodecahedron_rejection():
    # Non-diagonal triclinic cell (e.g. rhombic dodecahedron or monoclinic)
    box = np.array([
        [50.0, 0.0, 0.0],
        [25.0, 43.3, 0.0],
        [25.0, 14.43, 40.82]
    ])
    with pytest.raises(MOCSUnsupportedGeometryError, match='Triclinic and non-orthorhombic'):
        validate_orthorhombic_box(box)

def test_valid_orthogonal_3x3_diagonal():
    box = np.diag([60.0, 70.0, 80.0])
    diag = validate_orthorhombic_box(box)
    assert np.allclose(diag, [60.0, 70.0, 80.0])
    
    aabb_a = (np.array([0., 0., 0.]), np.array([1., 1., 1.]))
    aabb_b = (np.array([5., 5., 5.]), np.array([6., 6., 6.]))
    L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
    assert L > 0 and U > L

def test_negative_and_zero_dimensions_rejection():
    with pytest.raises(MOCSUnsupportedGeometryError, match='strictly positive'):
        validate_orthorhombic_box(np.array([80.0, -10.0, 80.0]))
    with pytest.raises(MOCSUnsupportedGeometryError, match='strictly positive'):
        validate_orthorhombic_box(np.array([80.0, 0.0, 80.0]))

def test_non_finite_dimensions_rejection():
    with pytest.raises(MOCSUnsupportedGeometryError, match='non-finite'):
        validate_orthorhombic_box(np.array([80.0, float('nan'), 80.0]))
    with pytest.raises(MOCSUnsupportedGeometryError, match='non-finite'):
        validate_orthorhombic_box(np.array([80.0, float('inf'), 80.0]))

def test_invalid_shape_rejection():
    with pytest.raises(MOCSUnsupportedGeometryError, match='must have length 3'):
        validate_orthorhombic_box(np.array([80.0, 80.0]))
    with pytest.raises(MOCSUnsupportedGeometryError, match='must have length 3'):
        validate_orthorhombic_box(np.array([80.0, 80.0, 80.0, 80.0]))
    with pytest.raises(MOCSUnsupportedGeometryError, match='cannot be None'):
        validate_orthorhombic_box(None)
