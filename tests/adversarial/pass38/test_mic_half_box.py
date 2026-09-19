"""PASS 38 — MIC Half-Box Exact Semantics Tests.

Formally tests the half-box semantics described in docs/PBC_SEMANTICS.md.
Uses independently derived expected values (no reference to the implementation).
Tests both the MIC displacement function and the full distance computation.
"""

import pytest
import numpy as np
from mocs.bounds.periodic_bounds import minimum_image_displacement, compute_pbc_bounds

L = 10.0
EPS = 1e-10


class TestHalfBoxMICSemantics:
    """Verifies MIC tie-breaking and distance correctness for all half-box cases."""

    def _mic1d(self, delta: float, L: float) -> float:
        """Reference 1D MIC: delta - L * round(delta/L)."""
        return delta - L * round(delta / L)

    def _abs_mic_1d(self, delta: float, L: float) -> float:
        return abs(self._mic1d(delta, L))

    # -----------------------------------------------------------------------
    # Table verification: L=10, all 11 cases from the spec
    # -----------------------------------------------------------------------

    @pytest.mark.parametrize("delta,expected_abs_mic,note", [
        (-15.0,  5.0, "rnte(-1.5)=-2 → -15-10*(-2)=5"),
        (-10.0,  0.0, "exact period"),
        ( -5.0,  5.0, "rnte(-0.5)=0 → -5-0=-5, |.|=5"),
        ( -5.0 + 1e-10, 5.0 - 1e-10, "just above half-box (negative), no wrap"),
        ( -5.0 - 1e-10, 5.0 - 1e-10, "just below -half-box, wraps → ~+5"),
        (  0.0,  0.0, "zero displacement"),
        (  5.0,  5.0, "rnte(0.5)=0 → 5-0=5"),
        (  5.0 + 1e-10, 5.0 - 1e-10, "just above +half-box, wraps"),
        (  5.0 - 1e-10, 5.0 - 1e-10, "just below +half-box, no wrap"),
        ( 10.0,  0.0, "exact period"),
        ( 15.0,  5.0, "rnte(1.5)=2 → 15-20=-5, |.|=5"),
    ])
    def test_half_box_table_abs_mic(self, delta, expected_abs_mic, note):
        """Absolute MIC values must match the independently derived reference table."""
        arr = np.array([delta, 0.0, 0.0])
        box = np.array([L, L, L])
        mic_vec = minimum_image_displacement(arr, box)
        abs_mic_x = abs(mic_vec[0])
        assert abs(abs_mic_x - expected_abs_mic) < 1e-8, (
            f"Case '{note}': delta={delta}, expected |MIC|={expected_abs_mic}, "
            f"got {abs_mic_x:.12f}"
        )

    def test_half_box_distance_equals_L_over_2(self):
        """Two atoms exactly L/2 apart have PBC distance = L/2."""
        # Atom A at origin, atom B at (L/2, 0, 0)
        aabb_a = (np.array([0.0, 0.0, 0.0]), np.array([0.0, 0.0, 0.0]))
        aabb_b = (np.array([L/2, 0.0, 0.0]), np.array([L/2, 0.0, 0.0]))
        bound_L, bound_U = compute_pbc_bounds(aabb_a, aabb_b, np.array([L, L, L]))
        assert abs(bound_L - L/2) < 1e-10, f"Lower bound should = L/2 = 5.0, got {bound_L}"
        assert abs(bound_U - L/2) < 1e-10, f"Upper bound should = L/2 = 5.0, got {bound_U}"

    def test_half_box_distance_is_sign_invariant(self):
        """Distance must be same whether delta = +L/2 or delta = -L/2."""
        aabb_a_pos = (np.array([L/2, 0.0, 0.0]), np.array([L/2, 0.0, 0.0]))
        aabb_a_neg = (np.array([-L/2, 0.0, 0.0]), np.array([-L/2, 0.0, 0.0]))
        aabb_b_origin = (np.array([0.0, 0.0, 0.0]), np.array([0.0, 0.0, 0.0]))
        box = np.array([L, L, L])

        L1, U1 = compute_pbc_bounds(aabb_a_pos, aabb_b_origin, box)
        L2, U2 = compute_pbc_bounds(aabb_a_neg, aabb_b_origin, box)
        assert abs(L1 - L2) < 1e-10, f"L1={L1}, L2={L2} should be equal (sign invariance)"
        assert abs(U1 - U2) < 1e-10, f"U1={U1}, U2={U2} should be equal (sign invariance)"

    def test_exact_period_gives_zero_distance(self):
        """Atoms separated by exactly L have zero periodic distance."""
        aabb_a = (np.array([0.0, 0.0, 0.0]), np.array([0.0, 0.0, 0.0]))
        aabb_b = (np.array([L, 0.0, 0.0]), np.array([L, 0.0, 0.0]))
        bound_L, bound_U = compute_pbc_bounds(aabb_a, aabb_b, np.array([L, L, L]))
        assert abs(bound_L) < 1e-10, f"L should = 0 for exact period, got {bound_L}"
        assert abs(bound_U) < 1e-10, f"U should = 0 for exact period, got {bound_U}"

    def test_exact_15_maps_to_5(self):
        """Displacement of 15 = L + L/2 maps to |MIC| = L/2 = 5."""
        arr = np.array([15.0, 0.0, 0.0])
        box = np.array([L, L, L])
        mic_vec = minimum_image_displacement(arr, box)
        assert abs(abs(mic_vec[0]) - 5.0) < 1e-10

    def test_half_box_upper_bound_valid(self):
        """Upper bound can never exceed L/2 * sqrt(3) for any configuration."""
        import itertools
        max_upper = (L / 2) * np.sqrt(3)
        # Sample many AABB pairs
        for dx in [0, L/4, L/2, 3*L/4, L]:
            aabb_a = (np.array([0.0, 0.0, 0.0]), np.array([0.0, 0.0, 0.0]))
            aabb_b = (np.array([dx, 0.0, 0.0]), np.array([dx, 0.0, 0.0]))
            _, U = compute_pbc_bounds(aabb_a, aabb_b, np.array([L, L, L]))
            assert U <= max_upper + 1e-10, (
                f"Upper bound {U:.6f} exceeds max periodic distance {max_upper:.6f} at dx={dx}"
            )

    def test_mic_range_never_exceeds_L_over_2(self):
        """For any delta, |MIC_1(delta, L)| <= L/2."""
        for delta in np.linspace(-3*L, 3*L, 1000):
            arr = np.array([delta, 0.0, 0.0])
            box = np.array([L, L, L])
            mic_vec = minimum_image_displacement(arr, box)
            assert abs(mic_vec[0]) <= L/2 + 1e-10, (
                f"|MIC({delta:.3f}, {L})| = {abs(mic_vec[0]):.6f} > L/2 = {L/2}"
            )

    def test_negative_15_maps_to_5(self):
        """Displacement of -15 maps to |MIC| = 5 (rnte(-1.5) = -2)."""
        arr = np.array([-15.0, 0.0, 0.0])
        box = np.array([L, L, L])
        mic = minimum_image_displacement(arr, box)
        # rnte(-1.5) = -2 → MIC = -15 - 10*(-2) = 5
        assert abs(mic[0] - 5.0) < 1e-10, f"Expected MIC(-15, 10) = 5, got {mic[0]}"
        assert abs(abs(mic[0]) - 5.0) < 1e-10
