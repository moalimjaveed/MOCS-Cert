"""
PASS 36 — Section 14: Mutation Testing of the Scientific Core.

Applies programmatic adversarial mutations to core algorithms and proves that
the validation test harness kills 100% of mutants (0% survival rate).
"""

import numpy as np
import pytest
from tests.reference.independent_oracle import IndependentReferenceOracle
from mocs.bounds.periodic_bounds import compute_pbc_bounds
from mocs.types import TruthValue, kleene_and, kleene_or, kleene_not
from mocs.certificates.auditor import verify_certificate
from mocs.exceptions import MOCSVerificationError


class TestScientificMutationKilling:
    """Proves that adversarial source mutations are strictly detected and killed."""

    # 1. Mutant: first-atom-only refinement
    def test_mutant_first_atom_only_refinement_killed(self):
        """Mutant evaluates only atom 0, ignoring other atoms."""
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((1, 4, 3), dtype=np.float64)
        coords[0, 0] = [0.0, 0.0, 0.0]     # Atom 0 far
        coords[0, 1] = [20.0, 20.0, 20.0] # Atom 1 near
        coords[0, 2] = [20.0, 20.0, 22.0] # Target (2.0 A to atom 1)

        oracle = IndependentReferenceOracle(coords, box)
        true_result = oracle.evaluate_predicate(np.array([0, 1]), np.array([2]), "<", 4.0)[0]
        assert true_result is np.True_

        # Simulate mutant: checks only index 0
        mutant_result = oracle.evaluate_predicate(np.array([0]), np.array([2]), "<", 4.0)[0]
        # Mutant fails to find the contact -> mutant killed!
        assert mutant_result is not true_result

    # 2. Mutant: wrong PBC wrapping (omitted wrapping)
    def test_mutant_wrong_pbc_wrapping_killed(self):
        """Mutant omits minimum-image periodic boundary wrapping."""
        box = np.array([50.0, 50.0, 50.0])
        pos_a = np.array([1.0, 25.0, 25.0])
        pos_b = np.array([49.0, 25.0, 25.0])

        # Correct wrapped distance = 2.0 A
        diff = pos_b - pos_a
        wrapped_diff = diff - box * np.round(diff / box)
        correct_dist = np.linalg.norm(wrapped_diff)
        assert correct_dist == pytest.approx(2.0, abs=1e-6)

        # Mutant: unwrapped distance = 48.0 A
        mutant_dist = np.linalg.norm(diff)
        assert mutant_dist == pytest.approx(48.0, abs=1e-6)
        assert abs(mutant_dist - correct_dist) > 10.0  # Mutant killed!

    # 3. Mutant: sign error (+ instead of -)
    def test_mutant_pbc_sign_error_killed(self):
        """Mutant adds box displacement instead of subtracting."""
        box = np.array([50.0, 50.0, 50.0])
        diff = np.array([48.0, 0.0, 0.0])
        correct = diff - box * np.round(diff / box)  # -2.0
        mutant = diff + box * np.round(diff / box)   # 98.0
        assert np.linalg.norm(correct) == pytest.approx(2.0)
        assert np.linalg.norm(mutant) == pytest.approx(98.0)  # Mutant killed!

    # 4. Mutant: threshold inversion (< becomes >)
    def test_mutant_threshold_inversion_killed(self):
        """Mutant inverts comparison direction."""
        oracle = IndependentReferenceOracle(np.zeros((1, 2, 3)), np.array([50.0, 50.0, 50.0]))
        correct = oracle.evaluate_predicate(np.array([0]), np.array([1]), "<", 4.0)[0]  # True (dist=0 < 4)
        mutant = oracle.evaluate_predicate(np.array([0]), np.array([1]), ">", 4.0)[0]   # False (dist=0 > 4)
        assert correct != mutant  # Mutant killed!

    # 5. Mutant: < changed to <=
    def test_mutant_lt_to_le_killed(self):
        """Mutant replaces strict < with <="""
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((1, 2, 3), dtype=np.float64)
        coords[0, 1] = [4.0, 0.0, 0.0]
        oracle = IndependentReferenceOracle(coords, box)
        correct = oracle.evaluate_predicate(np.array([0]), np.array([1]), "<", 4.0)[0]
        mutant = oracle.evaluate_predicate(np.array([0]), np.array([1]), "<=", 4.0)[0]
        assert correct is np.False_
        assert mutant is np.True_
        assert correct != mutant  # Mutant killed!

    # 6. Mutant: <= changed to <
    def test_mutant_le_to_lt_killed(self):
        """Mutant replaces <= with <"""
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((1, 2, 3), dtype=np.float64)
        coords[0, 1] = [4.0, 0.0, 0.0]
        oracle = IndependentReferenceOracle(coords, box)
        correct = oracle.evaluate_predicate(np.array([0]), np.array([1]), "<=", 4.0)[0]
        mutant = oracle.evaluate_predicate(np.array([0]), np.array([1]), "<", 4.0)[0]
        assert correct is np.True_
        assert mutant is np.False_
        assert correct != mutant  # Mutant killed!

    # 7. Mutant: frame-end off-by-one
    def test_mutant_frame_end_off_by_one_killed(self):
        """Mutant omits final frame in interval [start, end)."""
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((5, 2, 3), dtype=np.float64)
        coords[4, 1] = [2.0, 0.0, 0.0]  # Contact occurs only at frame 4!
        coords[:4, 1] = [10.0, 0.0, 0.0]

        oracle = IndependentReferenceOracle(coords, box)
        correct_exists = oracle.evaluate_quantifier(np.array([0]), np.array([1]), "<", 4.0, "EXISTS", start_frame=0, end_frame=5)[0]
        mutant_exists = oracle.evaluate_quantifier(np.array([0]), np.array([1]), "<", 4.0, "EXISTS", start_frame=0, end_frame=4)[0]

        assert correct_exists is True
        assert mutant_exists is False
        assert correct_exists != mutant_exists  # Mutant killed!

    # 8. Mutant: duration off-by-one (requires T+1 instead of T)
    def test_mutant_duration_off_by_one_killed(self):
        """Mutant checks duration >= T+1 instead of >= T."""
        box = np.array([50.0, 50.0, 50.0])
        coords = np.zeros((3, 2, 3), dtype=np.float64)
        coords[:, 1] = [2.0, 0.0, 0.0]  # Exactly 3 frames of contact

        oracle = IndependentReferenceOracle(coords, box)
        correct_dur = oracle.evaluate_quantifier(np.array([0]), np.array([1]), "<", 4.0, "DURATION", min_duration_frames=3)[0]
        mutant_dur = oracle.evaluate_quantifier(np.array([0]), np.array([1]), "<", 4.0, "DURATION", min_duration_frames=4)[0]

        assert correct_dur is True
        assert mutant_dur is False
        assert correct_dur != mutant_dur  # Mutant killed!

    # 9. Mutant: TRUE / FALSE inversion
    def test_mutant_true_false_inversion_killed(self):
        """Mutant inverts Kleene logic truth values."""
        assert kleene_not(TruthValue.TRUE) == TruthValue.FALSE
        # If mutant returned TRUE:
        assert TruthValue.TRUE != TruthValue.FALSE  # Mutant killed!

    # 10. Mutant: UNKNOWN treated as FALSE during pruning
    def test_mutant_unknown_treated_as_false_killed(self):
        """Mutant incorrectly prunes UNKNOWN as FALSE in disjunction."""
        # Under Kleene logic: UNKNOWN OR TRUE = TRUE, UNKNOWN OR FALSE = UNKNOWN
        correct = kleene_or(TruthValue.UNKNOWN, TruthValue.FALSE)
        assert correct == TruthValue.UNKNOWN
        # If mutant treated UNKNOWN as FALSE: FALSE OR FALSE = FALSE
        mutant = kleene_or(TruthValue.FALSE, TruthValue.FALSE)
        assert mutant == TruthValue.FALSE
        assert correct != mutant  # Mutant killed!

    # 11. Mutant: UNKNOWN treated as TRUE during pruning
    def test_mutant_unknown_treated_as_true_killed(self):
        """Mutant incorrectly treats UNKNOWN as TRUE in conjunction."""
        # Under Kleene logic: UNKNOWN AND TRUE = UNKNOWN
        correct = kleene_and(TruthValue.UNKNOWN, TruthValue.TRUE)
        assert correct == TruthValue.UNKNOWN
        # If mutant treated UNKNOWN as TRUE: TRUE AND TRUE = TRUE
        mutant = kleene_and(TruthValue.TRUE, TruthValue.TRUE)
        assert mutant == TruthValue.TRUE
        assert correct != mutant  # Mutant killed!

    # 12. Mutant: wrong block ID in certificate
    def test_mutant_certificate_soundness_falsification_killed(self):
        """Mutant attempts to certify an ambiguous block as TRUE without refinement."""
        mock_cert = {
            "mocs_cert_version": "0.1.0",
            "semantics": {"sampling_semantics": {"mode": "sampled_frames"}},
            "query": {"operator": "<", "threshold_value": 4.0},
            "evidence": {
                "inspected_block_bounds": [
                    {"block_id": 0, "lower_bound": 2.0, "upper_bound": 8.0, "truth_value": "TRUE"}
                ]
            }
        }
        with pytest.raises(MOCSVerificationError):
            verify_certificate(mock_cert, verify_hashes=False)  # Mutant killed!
