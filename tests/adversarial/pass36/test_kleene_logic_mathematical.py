"""
PASS 36 — Section 15: Independent Kleene 3-Valued Logic Validation.

Formally tests Kleene strong 3-valued logic algebra against an independent
numeric valuation model (FALSE=0, UNKNOWN=1/2, TRUE=1):
- Conjunction min(a, b), Disjunction max(a, b), Negation 1 - a
- De Morgan's laws
- Double negation
- Information ordering monotonicity
- Trajectory block epistemic tripartite states: TRUE, FALSE, UNKNOWN
- Proof that UNKNOWN is never collapsed into FALSE/TRUE
"""

import pytest
from mocs.types import TruthValue, kleene_and, kleene_or, kleene_not
from mocs.bounds.periodic_bounds import compute_pbc_bounds
import numpy as np


class TestKleeneLogicMathematical:
    """Independent mathematical verification of 3-valued logic."""

    VAL_MAP = {
        TruthValue.FALSE: 0.0,
        TruthValue.UNKNOWN: 0.5,
        TruthValue.TRUE: 1.0,
    }
    REV_MAP = {
        0.0: TruthValue.FALSE,
        0.5: TruthValue.UNKNOWN,
        1.0: TruthValue.TRUE,
    }

    def _independent_kleene_and(self, a: TruthValue, b: TruthValue) -> TruthValue:
        return self.REV_MAP[min(self.VAL_MAP[a], self.VAL_MAP[b])]

    def _independent_kleene_or(self, a: TruthValue, b: TruthValue) -> TruthValue:
        return self.REV_MAP[max(self.VAL_MAP[a], self.VAL_MAP[b])]

    def _independent_kleene_not(self, a: TruthValue) -> TruthValue:
        return self.REV_MAP[1.0 - self.VAL_MAP[a]]

    def test_complete_truth_table_parity(self):
        """Exhaustive parity check across all 9 combinations."""
        values = [TruthValue.FALSE, TruthValue.UNKNOWN, TruthValue.TRUE]
        for a in values:
            for b in values:
                # Test AND
                prod_and = kleene_and(a, b)
                math_and = self._independent_kleene_and(a, b)
                assert prod_and == math_and, f"AND mismatch for ({a}, {b})"

                # Test OR
                prod_or = kleene_or(a, b)
                math_or = self._independent_kleene_or(a, b)
                assert prod_or == math_or, f"OR mismatch for ({a}, {b})"

            # Test NOT
            prod_not = kleene_not(a)
            math_not = self._independent_kleene_not(a)
            assert prod_not == math_not, f"NOT mismatch for {a}"

    def test_de_morgans_laws(self):
        """Verifies De Morgan's laws: not(a and b) == not(a) or not(b)."""
        values = [TruthValue.FALSE, TruthValue.UNKNOWN, TruthValue.TRUE]
        for a in values:
            for b in values:
                lhs1 = kleene_not(kleene_and(a, b))
                rhs1 = kleene_or(kleene_not(a), kleene_not(b))
                assert lhs1 == rhs1, f"De Morgan 1 failed for ({a}, {b})"

                lhs2 = kleene_not(kleene_or(a, b))
                rhs2 = kleene_and(kleene_not(a), kleene_not(b))
                assert lhs2 == rhs2, f"De Morgan 2 failed for ({a}, {b})"

    def test_double_negation(self):
        """Verifies not(not(a)) == a."""
        for a in [TruthValue.FALSE, TruthValue.UNKNOWN, TruthValue.TRUE]:
            assert kleene_not(kleene_not(a)) == a

    def test_trajectory_block_tripartite_epistemic_states(self):
        """
        Constructs three blocks demonstrating the three distinct epistemic states:
        1. Block A: Certified TRUE (U < 4.0 A)
        2. Block B: Certified FALSE (L >= 4.0 A)
        3. Block C: Ambiguous UNKNOWN (L < 4.0 A <= U)
        """
        box = np.array([50.0, 50.0, 50.0])
        threshold = 4.0

        # 1. Proves TRUE: AABB dist in [1.0, 3.0]
        a1, a2 = np.array([0, 0, 0]), np.array([1, 1, 1])
        b1, b2 = np.array([2, 0, 0]), np.array([3, 1, 1])
        L1, U1 = compute_pbc_bounds((a1, a2), (b1, b2), box)
        assert U1 < threshold
        state1 = TruthValue.TRUE if U1 < threshold else (TruthValue.FALSE if L1 >= threshold else TruthValue.UNKNOWN)
        assert state1 == TruthValue.TRUE

        # 2. Proves FALSE: AABB dist in [10.0, 15.0]
        c1, c2 = np.array([0, 0, 0]), np.array([1, 1, 1])
        d1, d2 = np.array([12, 0, 0]), np.array([14, 1, 1])
        L2, U2 = compute_pbc_bounds((c1, c2), (d1, d2), box)
        assert L2 >= threshold
        state2 = TruthValue.TRUE if U2 < threshold else (TruthValue.FALSE if L2 >= threshold else TruthValue.UNKNOWN)
        assert state2 == TruthValue.FALSE

        # 3. Cannot prove either: AABB dist in [2.0, 8.0]
        e1, e2 = np.array([0, 0, 0]), np.array([1, 1, 1])
        f1, f2 = np.array([3, 0, 0]), np.array([7, 1, 1])
        L3, U3 = compute_pbc_bounds((e1, e2), (f1, f2), box)
        assert L3 < threshold <= U3
        state3 = TruthValue.TRUE if U3 < threshold else (TruthValue.FALSE if L3 >= threshold else TruthValue.UNKNOWN)
        assert state3 == TruthValue.UNKNOWN

    def test_unknown_never_silently_collapsed(self):
        """UNKNOWN must never collapse to FALSE or TRUE without refinement."""
        assert kleene_and(TruthValue.UNKNOWN, TruthValue.TRUE) == TruthValue.UNKNOWN
        assert kleene_or(TruthValue.UNKNOWN, TruthValue.FALSE) == TruthValue.UNKNOWN
        assert kleene_not(TruthValue.UNKNOWN) == TruthValue.UNKNOWN
