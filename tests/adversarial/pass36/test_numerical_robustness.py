"""
PASS 36 — Section 16: Numerical Robustness and Floating-Point Invariant Suite.

Attacks the bounding and distance engines across:
- float32 vs float64 precision
- extreme coordinate magnitudes (1e-7 to 1e7 A)
- subnormal scale distances
- NaN and Infinity rejection (strict fail-closed)
- zero-distance and co-located coordinates
"""

import numpy as np
import pytest
from mocs.bounds.periodic_bounds import (
    compute_pbc_bounds,
    validate_orthorhombic_box,
    minimum_image_displacement
)
from mocs.exceptions import MOCSUnsupportedGeometryError
from tests.reference.independent_oracle import IndependentReferenceOracle


class TestNumericalRobustness:
    """Floating-point precision, extreme scale, and invalid float stress tests."""

    def test_float32_vs_float64_precision_parity(self):
        """Verify bounding computation is consistent whether inputs arrive as float32 or float64."""
        box32 = np.array([50.0, 50.0, 50.0], dtype=np.float32)
        box64 = np.array([50.0, 50.0, 50.0], dtype=np.float64)

        min_a32, max_a32 = np.array([10.1, 10.2, 10.3], dtype=np.float32), np.array([12.1, 12.2, 12.3], dtype=np.float32)
        min_b32, max_b32 = np.array([20.1, 20.2, 20.3], dtype=np.float32), np.array([22.1, 22.2, 22.3], dtype=np.float32)

        min_a64, max_a64 = min_a32.astype(np.float64), max_a32.astype(np.float64)
        min_b64, max_b64 = min_b32.astype(np.float64), max_b32.astype(np.float64)

        L32, U32 = compute_pbc_bounds((min_a32, max_a32), (min_b32, max_b32), box32)
        L64, U64 = compute_pbc_bounds((min_a64, max_a64), (min_b64, max_b64), box64)

        assert L32 == pytest.approx(L64, abs=1e-5)
        assert U32 == pytest.approx(U64, abs=1e-5)

    def test_extreme_coordinate_magnitudes(self):
        """Coordinates at 1e6 A (astronomical scale in molecular systems)."""
        box = np.array([1e6, 1e6, 1e6], dtype=np.float64)
        min_a, max_a = np.array([100.0, 100.0, 100.0]), np.array([200.0, 200.0, 200.0])
        min_b, max_b = np.array([999800.0, 999800.0, 999800.0]), np.array([999900.0, 999900.0, 999900.0])

        L, U = compute_pbc_bounds((min_a, max_a), (min_b, max_b), box)
        assert 0.0 <= L <= U
        assert np.isfinite(L) and np.isfinite(U)

    def test_subnormal_scale_distances(self):
        """Distances on the order of 1e-12 A."""
        box = np.array([50.0, 50.0, 50.0])
        min_a, max_a = np.array([10.0, 10.0, 10.0]), np.array([10.0, 10.0, 10.0])
        min_b, max_b = np.array([10.0, 10.0, 10.0 + 1e-12]), np.array([10.0, 10.0, 10.0 + 1e-12])

        L, U = compute_pbc_bounds((min_a, max_a), (min_b, max_b), box)
        assert L == pytest.approx(1e-12, abs=1e-15)
        assert U == pytest.approx(1e-12, abs=1e-15)

    def test_nan_coordinates_rejected_fail_closed(self):
        """NaN inside coordinates must strictly raise MOCSUnsupportedGeometryError."""
        box = np.array([50.0, 50.0, 50.0])
        min_a, max_a = np.array([np.nan, 0.0, 0.0]), np.array([1.0, 1.0, 1.0])
        min_b, max_b = np.array([5.0, 5.0, 5.0]), np.array([6.0, 6.0, 6.0])

        with pytest.raises(MOCSUnsupportedGeometryError):
            compute_pbc_bounds((min_a, max_a), (min_b, max_b), box)

    def test_infinite_coordinates_rejected_fail_closed(self):
        """Infinity inside coordinates must strictly raise MOCSUnsupportedGeometryError."""
        box = np.array([50.0, 50.0, 50.0])
        min_a, max_a = np.array([np.inf, 0.0, 0.0]), np.array([1.0, 1.0, 1.0])
        min_b, max_b = np.array([5.0, 5.0, 5.0]), np.array([6.0, 6.0, 6.0])

        with pytest.raises(MOCSUnsupportedGeometryError):
            compute_pbc_bounds((min_a, max_a), (min_b, max_b), box)

    def test_nan_in_box_dimensions_fails_closed(self):
        """NaN inside box dimensions raises MOCSUnsupportedGeometryError."""
        with pytest.raises(MOCSUnsupportedGeometryError):
            validate_orthorhombic_box(np.array([50.0, np.nan, 50.0]))

    def test_inf_in_box_dimensions_fails_closed(self):
        """Infinity inside box dimensions raises MOCSUnsupportedGeometryError."""
        with pytest.raises(MOCSUnsupportedGeometryError):
            validate_orthorhombic_box(np.array([50.0, np.inf, 50.0]))
