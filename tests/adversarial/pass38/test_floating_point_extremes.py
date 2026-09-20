"""PASS 38 — Floating-Point Extreme Scale Attack Tests.

Tests the MIC function and PBC bounds under extreme coordinate magnitudes:
  10^-15 Å  (sub-atomic)
  10^-12 Å  (picometer)
  10^-9  Å  (sub-nanometer)
  10^-6  Å  (nanometer regime start)
  10^-3  Å  (sub-angstrom)
  1      Å  (angstrom — normal MD range)
  10     Å  (inter-residue distances)
  10^3   Å  (very large box)
  10^6   Å  (mega-angstrom)
  10^9   Å  (giga-angstrom — overflow risk)

Tests for: overflow, underflow, cancellation errors, MIC instability.

Claims:
- MOCS-Cert does NOT claim universal correctness at all scales.
- A documented numerical domain is defined based on float64 IEEE 754 limits.
"""

import pytest
import numpy as np
import math
from mocs.bounds.periodic_bounds import (
    compute_pbc_bounds, minimum_image_displacement, validate_orthorhombic_box
)
from mocs.exceptions import MOCSUnsupportedGeometryError


class TestFloatingPointExtremes:
    """Adversarial float magnitude attacks on the PBC machinery."""

    def _check_mic_soundness(self, delta: float, L: float) -> bool:
        """Returns True if |MIC(delta, L)| <= L/2 within float tolerance."""
        arr = np.array([delta, 0.0, 0.0])
        box = np.array([L, L, L])
        try:
            mic = minimum_image_displacement(arr, box)
            return abs(mic[0]) <= L / 2 + 1e-9 * L
        except Exception:
            return False

    # -----------------------------------------------------------------------
    # Normal range: 1 Å coordinates
    # -----------------------------------------------------------------------

    def test_normal_angstrom_range(self):
        """Normal MD coordinate range (1-100 Å) is fully correct."""
        box = np.array([50.0, 50.0, 50.0])
        aabb_a = (np.array([1.0, 1.0, 1.0]), np.array([5.0, 5.0, 5.0]))
        aabb_b = (np.array([20.0, 20.0, 20.0]), np.array([25.0, 25.0, 25.0]))
        L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
        assert math.isfinite(L) and math.isfinite(U)
        assert L >= 0.0 and U >= L

    # -----------------------------------------------------------------------
    # Very small coordinates
    # -----------------------------------------------------------------------

    def test_sub_angstrom_1e_minus_3(self):
        """Coordinates at 1e-3 Å scale in box 10e-3 Å."""
        scale = 1e-3
        box = np.array([10*scale, 10*scale, 10*scale])
        aabb_a = (np.array([0.0, 0.0, 0.0]), np.array([scale, scale, scale]))
        aabb_b = (np.array([3*scale, 0.0, 0.0]), np.array([4*scale, scale, scale]))
        L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
        assert math.isfinite(L) and math.isfinite(U)
        assert L >= 0.0

    def test_sub_nanometer_1e_minus_6(self):
        """Coordinates at 1e-6 Å scale."""
        scale = 1e-6
        box = np.array([10*scale, 10*scale, 10*scale])
        aabb_a = (np.array([0.0, 0.0, 0.0]), np.array([scale, scale, scale]))
        aabb_b = (np.array([2*scale, 0.0, 0.0]), np.array([3*scale, scale, scale]))
        L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
        assert math.isfinite(L) and math.isfinite(U)
        assert L >= 0.0

    def test_sub_atomic_1e_minus_9(self):
        """Coordinates at 1e-9 Å (sub-picometer) — near float64 cancellation territory."""
        scale = 1e-9
        box = np.array([10*scale, 10*scale, 10*scale])
        aabb_a = (np.array([0.0, 0.0, 0.0]), np.array([scale, scale, scale]))
        aabb_b = (np.array([2*scale, 0.0, 0.0]), np.array([3*scale, scale, scale]))
        L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
        # At this scale, float64 precision is ~2.2e-16, so relative error up to 1e-7 expected
        assert math.isfinite(L) and math.isfinite(U)
        assert L >= 0.0

    def test_extremely_small_1e_minus_15(self):
        """Coordinates at 1e-15 Å — near float64 underflow territory."""
        scale = 1e-15
        box = np.array([10*scale, 10*scale, 10*scale])
        aabb_a = (np.array([0.0, 0.0, 0.0]), np.array([scale, scale, scale]))
        aabb_b = (np.array([2*scale, 0.0, 0.0]), np.array([3*scale, scale, scale]))
        # At 1e-15 Å scale, the box is 1e-14 Å — extremely small
        # float64 relative precision ~2.2e-16, so ratio 1e-15 / 1e-14 = 0.1 is representable
        L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
        assert math.isfinite(L) and math.isfinite(U)
        assert L >= 0.0

    # -----------------------------------------------------------------------
    # Very large coordinates
    # -----------------------------------------------------------------------

    def test_large_box_1e3(self):
        """Box at 1000 Å — still normal MD territory."""
        box = np.array([1000.0, 1000.0, 1000.0])
        aabb_a = (np.array([10.0, 10.0, 10.0]), np.array([50.0, 50.0, 50.0]))
        aabb_b = (np.array([400.0, 400.0, 400.0]), np.array([450.0, 450.0, 450.0]))
        L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
        assert math.isfinite(L) and math.isfinite(U)
        assert L >= 0.0

    def test_very_large_box_1e6(self):
        """Box at 1e6 Å — pathological but structurally valid."""
        scale = 1e6
        box = np.array([scale, scale, scale])
        aabb_a = (np.array([0.0, 0.0, 0.0]), np.array([scale*0.1, 0.0, 0.0]))
        aabb_b = (np.array([scale*0.4, 0.0, 0.0]), np.array([scale*0.5, 0.0, 0.0]))
        L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
        assert math.isfinite(L) and math.isfinite(U)
        assert L >= 0.0

    def test_extreme_large_1e9_mic_stable(self):
        """MIC function at 1e9 Å scale — float64 has ~9 significant digits at this scale."""
        scale = 1e9
        L = scale
        delta = scale * 0.6  # Should wrap to -0.4 * scale
        arr = np.array([delta, 0.0, 0.0])
        box = np.array([L, L, L])
        mic = minimum_image_displacement(arr, box)
        # True MIC: delta/L = 0.6 → rnte(0.6) = 1 → MIC = 0.6L - L = -0.4L
        expected = -0.4 * scale
        # At 1e9 scale, float64 epsilon is ~1e9 * 2.2e-16 ≈ 2.2e-7
        # So we expect relative error in the MIC to be within ~1e-7
        assert abs(mic[0] - expected) < abs(expected) * 1e-6 + 1.0, (
            f"MIC at 1e9 scale: expected {expected:.3e}, got {mic[0]:.3e}"
        )

    # -----------------------------------------------------------------------
    # Catastrophic cancellation tests
    # -----------------------------------------------------------------------

    def test_near_cancellation_opposite_positions(self):
        """Two nearly opposite positions in box — cancellation in subtraction."""
        box = np.array([10.0, 10.0, 10.0])
        # Nearly at 5.0 (half-box) on each side
        aabb_a = (np.array([5.0 - 1e-10, 0.0, 0.0]), np.array([5.0 - 1e-10, 0.0, 0.0]))
        aabb_b = (np.array([5.0 + 1e-10, 0.0, 0.0]), np.array([5.0 + 1e-10, 0.0, 0.0]))
        L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
        # True distance: |MIC(2e-10, 10)| = 2e-10
        assert L >= 0.0
        assert abs(L - 2e-10) < 1e-9, f"Near-cancellation: L={L}, expected ~2e-10"

    def test_overflow_protection_box_dimension(self):
        """Box dimension of +inf is rejected."""
        with pytest.raises(MOCSUnsupportedGeometryError):
            validate_orthorhombic_box(np.array([np.inf, 10.0, 10.0]))

    def test_nan_box_dimension_rejected(self):
        """Box dimension of NaN is rejected."""
        with pytest.raises(MOCSUnsupportedGeometryError):
            validate_orthorhombic_box(np.array([np.nan, 10.0, 10.0]))

    def test_negative_box_rejected(self):
        """Negative box dimension is rejected."""
        with pytest.raises(MOCSUnsupportedGeometryError):
            validate_orthorhombic_box(np.array([-10.0, 10.0, 10.0]))

    def test_zero_box_rejected(self):
        """Zero box dimension is rejected."""
        with pytest.raises(MOCSUnsupportedGeometryError):
            validate_orthorhombic_box(np.array([0.0, 10.0, 10.0]))

    def test_nan_aabb_coordinates_rejected(self):
        """NaN coordinates in AABB are rejected."""
        box = np.array([10.0, 10.0, 10.0])
        aabb_a = (np.array([np.nan, 0.0, 0.0]), np.array([1.0, 1.0, 1.0]))
        aabb_b = (np.array([5.0, 0.0, 0.0]), np.array([6.0, 1.0, 1.0]))
        with pytest.raises(MOCSUnsupportedGeometryError):
            compute_pbc_bounds(aabb_a, aabb_b, box)

    def test_inf_aabb_coordinates_rejected(self):
        """Inf coordinates in AABB are rejected."""
        box = np.array([10.0, 10.0, 10.0])
        aabb_a = (np.array([np.inf, 0.0, 0.0]), np.array([1.0, 1.0, 1.0]))
        aabb_b = (np.array([5.0, 0.0, 0.0]), np.array([6.0, 1.0, 1.0]))
        with pytest.raises(MOCSUnsupportedGeometryError):
            compute_pbc_bounds(aabb_a, aabb_b, box)

    # -----------------------------------------------------------------------
    # Documented numerical domain
    # -----------------------------------------------------------------------

    def test_numerical_domain_lower_bound(self):
        """Box and coordinates must be representable in float64 (> ~5e-324 Å)."""
        # Sub-subnormal floats: float64 min positive = 5e-324
        # At this scale, rounding to zero occurs in arithmetic
        # This is outside the documented numerical domain — we just verify no crash
        scale = 1e-300
        try:
            box = np.array([scale, scale, scale])
            aabb_a = (np.array([0.0, 0.0, 0.0]), np.array([0.0, 0.0, 0.0]))
            aabb_b = (np.array([scale * 0.3, 0.0, 0.0]), np.array([scale * 0.3, 0.0, 0.0]))
            validate_orthorhombic_box(box)
            # May produce denormalized results but should not crash
        except MOCSUnsupportedGeometryError:
            pass  # Acceptable — zero box rejected correctly

    def test_mic_range_invariant_across_magnitudes(self):
        """For any valid (delta, L), |MIC(delta, L)| <= L/2."""
        test_cases = [
            (3.0, 10.0),
            (5.0, 10.0),  # exact half
            (7.0, 10.0),
            (1e-6, 1e-5),
            (3e-6, 1e-5),
            (1e6, 2e6),
            (0.9e9, 1e9),
        ]
        for delta, L in test_cases:
            ok = self._check_mic_soundness(delta, L)
            assert ok, f"|MIC({delta}, {L})| > L/2"
