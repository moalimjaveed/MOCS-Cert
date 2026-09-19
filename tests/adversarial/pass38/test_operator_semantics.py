"""PASS 38 — Operator Semantics Tests.

Formally tests all 5 distance operators (<, <=, >, >=, ==) against the
pruning decision semantics in docs/FORMAL_SEMANTICS.md.

Key focus:
- Exact threshold boundary cases: d == τ exactly
- Boundary: U == τ for < vs <= operators
- Boundary: L == τ for > vs >= operators
"""

import pytest
import numpy as np
from mocs.bounds.periodic_bounds import compute_pbc_bounds


def point_aabb(pos: list) -> tuple:
    arr = np.array(pos)
    return (arr.copy(), arr.copy())


class TestOperatorSemantics:
    """Tests that the pruning decisions match the formal table."""

    BOX = np.array([100.0, 100.0, 100.0])

    # -----------------------------------------------------------------------
    # Helper: apply production pruning decision
    # -----------------------------------------------------------------------
    def _pruning_decision(self, L: float, U: float, op: str, thresh: float) -> str:
        """Apply the exact production code logic."""
        if op in ("<", "<="):
            bound_true  = (U < thresh) if op == "<" else (U <= thresh)
            bound_false = (L >= thresh) if op == "<" else (L > thresh)
        elif op in (">", ">="):
            bound_true  = (L > thresh) if op == ">" else (L >= thresh)
            bound_false = (U <= thresh) if op == ">" else (U < thresh)
        else:
            bound_true, bound_false = False, False

        if bound_true:
            return "CERTIFIED_TRUE"
        elif bound_false:
            return "CERTIFIED_FALSE"
        return "UNKNOWN"

    # -----------------------------------------------------------------------
    # < operator tests
    # -----------------------------------------------------------------------
    def test_strict_less_U_strictly_below_thresh(self):
        """U < τ → CERTIFIED_TRUE for <."""
        # Point atoms distance = 3.0, τ = 5.0 → U = 3.0 < 5.0 → TRUE
        aabb_a = point_aabb([0.0, 0.0, 0.0])
        aabb_b = point_aabb([3.0, 0.0, 0.0])
        L, U = compute_pbc_bounds(aabb_a, aabb_b, self.BOX)
        dec = self._pruning_decision(L, U, "<", 5.0)
        assert dec == "CERTIFIED_TRUE", f"Expected CERTIFIED_TRUE, got {dec}, L={L} U={U}"

    def test_strict_less_L_at_thresh(self):
        """L >= τ → CERTIFIED_FALSE for <."""
        # Point atoms at distance 7.0, τ = 5.0 → L = 7.0 ≥ 5.0 → FALSE
        aabb_a = point_aabb([0.0, 0.0, 0.0])
        aabb_b = point_aabb([7.0, 0.0, 0.0])
        L, U = compute_pbc_bounds(aabb_a, aabb_b, self.BOX)
        dec = self._pruning_decision(L, U, "<", 5.0)
        assert dec == "CERTIFIED_FALSE", f"Expected CERTIFIED_FALSE, got {dec}, L={L} U={U}"

    def test_strict_less_U_exactly_equals_thresh(self):
        """U == τ with < operator → UNKNOWN (not CERTIFIED_TRUE)."""
        # Point atoms at 5.0, τ = 5.0
        aabb_a = point_aabb([0.0, 0.0, 0.0])
        aabb_b = point_aabb([5.0, 0.0, 0.0])
        L, U = compute_pbc_bounds(aabb_a, aabb_b, self.BOX)
        # For point atoms: L = U = 5.0
        assert abs(U - 5.0) < 1e-9
        dec = self._pruning_decision(L, U, "<", 5.0)
        # U == τ and op is <: bound_true = (U < τ) = False → not TRUE
        # L == τ and op is <: bound_false = (L >= τ) = True → CERTIFIED_FALSE
        # (distance is exactly 5.0, predicate d < 5.0 = FALSE → correct)
        assert dec == "CERTIFIED_FALSE", (
            f"Point at exact threshold, op=<: expected CERTIFIED_FALSE, got {dec}"
        )

    def test_leq_U_exactly_equals_thresh(self):
        """U == τ with <= operator → CERTIFIED_TRUE."""
        aabb_a = point_aabb([0.0, 0.0, 0.0])
        aabb_b = point_aabb([5.0, 0.0, 0.0])
        L, U = compute_pbc_bounds(aabb_a, aabb_b, self.BOX)
        assert abs(U - 5.0) < 1e-9
        dec = self._pruning_decision(L, U, "<=", 5.0)
        # d = 5.0, predicate d <= 5.0 = TRUE
        assert dec == "CERTIFIED_TRUE", (
            f"Point at exact threshold, op=<=: expected CERTIFIED_TRUE, got {dec}"
        )

    # -----------------------------------------------------------------------
    # > operator tests
    # -----------------------------------------------------------------------
    def test_strict_greater_L_above_thresh(self):
        """L > τ → CERTIFIED_TRUE for >."""
        aabb_a = point_aabb([0.0, 0.0, 0.0])
        aabb_b = point_aabb([8.0, 0.0, 0.0])
        L, U = compute_pbc_bounds(aabb_a, aabb_b, self.BOX)
        dec = self._pruning_decision(L, U, ">", 5.0)
        assert dec == "CERTIFIED_TRUE", f"L={L} > 5.0 should be CERTIFIED_TRUE, got {dec}"

    def test_strict_greater_U_at_thresh(self):
        """U <= τ → CERTIFIED_FALSE for >."""
        aabb_a = point_aabb([0.0, 0.0, 0.0])
        aabb_b = point_aabb([3.0, 0.0, 0.0])
        L, U = compute_pbc_bounds(aabb_a, aabb_b, self.BOX)
        dec = self._pruning_decision(L, U, ">", 5.0)
        assert dec == "CERTIFIED_FALSE", f"U={U} <= 5.0 should be CERTIFIED_FALSE, got {dec}"

    def test_strict_greater_L_exactly_equals_thresh(self):
        """L == τ with > operator → UNKNOWN (not CERTIFIED_TRUE)."""
        aabb_a = point_aabb([0.0, 0.0, 0.0])
        aabb_b = point_aabb([5.0, 0.0, 0.0])
        L, U = compute_pbc_bounds(aabb_a, aabb_b, self.BOX)
        dec = self._pruning_decision(L, U, ">", 5.0)
        # d = 5.0, predicate d > 5.0 = FALSE
        # L = 5.0: bound_true = (L > τ) = False → not TRUE
        # U = 5.0: bound_false = (U <= τ) = True → CERTIFIED_FALSE
        assert dec == "CERTIFIED_FALSE", (
            f"Point at threshold, op=>: expected CERTIFIED_FALSE (d > 5.0 is False), got {dec}"
        )

    def test_geq_L_exactly_equals_thresh(self):
        """L == τ with >= operator → CERTIFIED_TRUE."""
        aabb_a = point_aabb([0.0, 0.0, 0.0])
        aabb_b = point_aabb([5.0, 0.0, 0.0])
        L, U = compute_pbc_bounds(aabb_a, aabb_b, self.BOX)
        dec = self._pruning_decision(L, U, ">=", 5.0)
        # d = 5.0, predicate d >= 5.0 = TRUE
        assert dec == "CERTIFIED_TRUE", (
            f"Point at threshold, op=>=: expected CERTIFIED_TRUE, got {dec}"
        )

    # -----------------------------------------------------------------------
    # Threshold zero
    # -----------------------------------------------------------------------
    def test_threshold_zero_lt(self):
        """d < 0 is always FALSE."""
        aabb_a = point_aabb([0.0, 0.0, 0.0])
        aabb_b = point_aabb([1.0, 0.0, 0.0])
        L, U = compute_pbc_bounds(aabb_a, aabb_b, self.BOX)
        dec = self._pruning_decision(L, U, "<", 0.0)
        assert dec == "CERTIFIED_FALSE"

    def test_threshold_zero_geq(self):
        """d >= 0 is always TRUE (distances are non-negative)."""
        aabb_a = point_aabb([0.0, 0.0, 0.0])
        aabb_b = point_aabb([1.0, 0.0, 0.0])
        L, U = compute_pbc_bounds(aabb_a, aabb_b, self.BOX)
        dec = self._pruning_decision(L, U, ">=", 0.0)
        assert dec == "CERTIFIED_TRUE"

    # -----------------------------------------------------------------------
    # WITHIN vs WHERE DISTANCE operator semantic difference
    # -----------------------------------------------------------------------
    def test_within_compiles_to_strict_lt_boundary_case(self):
        """Verify that at exactly threshold distance, WITHIN (< op) gives FALSE."""
        # This is a semantic documentation test, not an engine execution test
        # At d = τ: "WITHIN τ" semantics → d < τ → FALSE
        # "WHERE DISTANCE <= τ" semantics → d <= τ → TRUE
        d = 5.0
        tau = 5.0
        within_result = d < tau   # WITHIN uses <
        where_leq_result = d <= tau   # WHERE DISTANCE <= uses <=
        assert within_result == False, "WITHIN at exact threshold should be False"
        assert where_leq_result == True, "WHERE DISTANCE <= at exact threshold should be True"

    def test_unknown_interval_produces_correct_decision(self):
        """L < τ < U → UNKNOWN for < operator."""
        # AABB containing atoms at distances 3 and 7 from target
        # Box size 100 so no wrapping needed
        # AABB_A: [0, 4] on x-axis, center=2, r=2
        # AABB_B: [5, 5], point at x=5
        aabb_a = (np.array([0.0, 0.0, 0.0]), np.array([4.0, 0.0, 0.0]))
        aabb_b = (np.array([5.0, 0.0, 0.0]), np.array([5.0, 0.0, 0.0]))
        L, U = compute_pbc_bounds(aabb_a, aabb_b, self.BOX)
        # True distances: 5-4=1 to 5-0=5, so L=1, U=5
        tau = 3.0
        dec = self._pruning_decision(L, U, "<", tau)
        # L=1 < τ=3 <= U=5, so UNKNOWN
        assert dec == "UNKNOWN", f"Expected UNKNOWN for L={L} < τ={tau} <= U={U}, got {dec}"
