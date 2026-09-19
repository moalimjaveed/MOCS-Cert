"""
PASS 36 — Section 7: Query Semantics Validation.

Constructs tiny deterministic trajectories and verifies query semantics across:
- Quantifiers: EXISTS, FORALL, DURATION
- Operators: <, <=, >, >=, ==
- Edge cases: Cases 1 through 6
- Connectives: AND, OR, NOT
"""

import numpy as np
import pytest
from tests.reference.independent_oracle import IndependentReferenceOracle
from mocs.types import TruthValue, kleene_and, kleene_or, kleene_not


class TestQuerySemanticsValidation:
    """Rigorous verification of temporal semantics and quantifiers."""

    def test_case_1_false_true_false_trajectory(self):
        """
        CASE 1:
        Frame 0: dist = 6.0 A (False for < 5.0)
        Frame 1: dist = 4.0 A (True for < 5.0)
        Frame 2: dist = 6.0 A (False for < 5.0)
        """
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((3, 2, 3), dtype=np.float64)
        coords[0, 1] = [6.0, 0.0, 0.0]  # Frame 0: False
        coords[1, 1] = [4.0, 0.0, 0.0]  # Frame 1: True
        coords[2, 1] = [6.0, 0.0, 0.0]  # Frame 2: False

        oracle = IndependentReferenceOracle(coords, box)
        flags = oracle.evaluate_predicate(np.array([0]), np.array([1]), "<", 5.0)
        assert list(flags) == [False, True, False]

        # Quantifier evaluations:
        exists_res, exists_wit = oracle.evaluate_quantifier(np.array([0]), np.array([1]), "<", 5.0, "EXISTS")
        assert exists_res is True
        assert exists_wit == [(1, 2)]

        forall_res, forall_wit = oracle.evaluate_quantifier(np.array([0]), np.array([1]), "<", 5.0, "FORALL")
        assert forall_res is False
        assert forall_wit == []

        dur1_res, dur1_wit = oracle.evaluate_quantifier(np.array([0]), np.array([1]), "<", 5.0, "DURATION", min_duration_frames=1)
        assert dur1_res is True
        assert dur1_wit == [(1, 2)]

        dur2_res, dur2_wit = oracle.evaluate_quantifier(np.array([0]), np.array([1]), "<", 5.0, "DURATION", min_duration_frames=2)
        assert dur2_res is False
        assert dur2_wit == []

    def test_case_2_contact_exactly_at_threshold(self):
        """
        CASE 2:
        Contact distance is exactly 4.000000000000000 A.
        """
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((1, 2, 3), dtype=np.float64)
        coords[0, 1] = [4.0, 0.0, 0.0]
        oracle = IndependentReferenceOracle(coords, box)

        # Strict < is False
        assert oracle.evaluate_predicate(np.array([0]), np.array([1]), "<", 4.0)[0] is np.False_
        # Non-strict <= is True
        assert oracle.evaluate_predicate(np.array([0]), np.array([1]), "<=", 4.0)[0] is np.True_
        # Strict > is False
        assert oracle.evaluate_predicate(np.array([0]), np.array([1]), ">", 4.0)[0] is np.False_
        # Non-strict >= is True
        assert oracle.evaluate_predicate(np.array([0]), np.array([1]), ">=", 4.0)[0] is np.True_
        # Equality == is True
        assert oracle.evaluate_predicate(np.array([0]), np.array([1]), "==", 4.0)[0] is np.True_

    def test_case_3_contact_epsilon_below_threshold(self):
        """
        CASE 3:
        Contact distance is 4.0 - 1e-12 A (below threshold).
        """
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((1, 2, 3), dtype=np.float64)
        coords[0, 1] = [4.0 - 1e-12, 0.0, 0.0]
        oracle = IndependentReferenceOracle(coords, box)

        assert oracle.evaluate_predicate(np.array([0]), np.array([1]), "<", 4.0)[0] is np.True_
        assert oracle.evaluate_predicate(np.array([0]), np.array([1]), "<=", 4.0)[0] is np.True_
        assert oracle.evaluate_predicate(np.array([0]), np.array([1]), ">", 4.0)[0] is np.False_

    def test_case_4_contact_epsilon_above_threshold(self):
        """
        CASE 4:
        Contact distance is 4.0 + 1e-12 A (above threshold).
        """
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((1, 2, 3), dtype=np.float64)
        coords[0, 1] = [4.0 + 1e-12, 0.0, 0.0]
        oracle = IndependentReferenceOracle(coords, box)

        assert oracle.evaluate_predicate(np.array([0]), np.array([1]), "<", 4.0)[0] is np.False_
        assert oracle.evaluate_predicate(np.array([0]), np.array([1]), "<=", 4.0)[0] is np.False_
        assert oracle.evaluate_predicate(np.array([0]), np.array([1]), ">", 4.0)[0] is np.True_

    def test_case_5_duration_starts_at_first_eligible_frame(self):
        """
        CASE 5:
        Duration begins exactly at frame 0 (first frame).
        Frames: [True, True, True, False, False]
        Duration for >= 3 frames is True, with witness [0, 3).
        """
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((5, 2, 3), dtype=np.float64)
        coords[0:3, 1] = [2.0, 0.0, 0.0]  # True
        coords[3:5, 1] = [8.0, 0.0, 0.0]  # False

        oracle = IndependentReferenceOracle(coords, box)
        res, witnesses = oracle.evaluate_quantifier(np.array([0]), np.array([1]), "<", 4.0, "DURATION", min_duration_frames=3)
        assert res is True
        assert witnesses == [(0, 3)]

    def test_case_6_duration_ends_at_final_eligible_frame(self):
        """
        CASE 6:
        Duration begins inside trajectory and extends through the final frame.
        Frames: [False, False, True, True, True]
        Duration for >= 3 frames is True, with witness [2, 5).
        """
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((5, 2, 3), dtype=np.float64)
        coords[0:2, 1] = [8.0, 0.0, 0.0]  # False
        coords[2:5, 1] = [2.0, 0.0, 0.0]  # True

        oracle = IndependentReferenceOracle(coords, box)
        res, witnesses = oracle.evaluate_quantifier(np.array([0]), np.array([1]), "<", 4.0, "DURATION", min_duration_frames=3)
        assert res is True
        assert witnesses == [(2, 5)]

    def test_boolean_algebra_connectives(self):
        """Verify Kleene 3-valued truth table connectives under all 9 combinations."""
        values = [TruthValue.TRUE, TruthValue.FALSE, TruthValue.UNKNOWN]

        # 1. Kleene AND
        for a in values:
            for b in values:
                res = kleene_and(a, b)
                if a == TruthValue.FALSE or b == TruthValue.FALSE:
                    assert res == TruthValue.FALSE
                elif a == TruthValue.TRUE and b == TruthValue.TRUE:
                    assert res == TruthValue.TRUE
                else:
                    assert res == TruthValue.UNKNOWN

        # 2. Kleene OR
        for a in values:
            for b in values:
                res = kleene_or(a, b)
                if a == TruthValue.TRUE or b == TruthValue.TRUE:
                    assert res == TruthValue.TRUE
                elif a == TruthValue.FALSE and b == TruthValue.FALSE:
                    assert res == TruthValue.FALSE
                else:
                    assert res == TruthValue.UNKNOWN

        # 3. Kleene NOT
        assert kleene_not(TruthValue.TRUE) == TruthValue.FALSE
        assert kleene_not(TruthValue.FALSE) == TruthValue.TRUE
        assert kleene_not(TruthValue.UNKNOWN) == TruthValue.UNKNOWN
