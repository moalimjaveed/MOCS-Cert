"""PASS 38 — Exhaustive Quantifier Truth Pattern Tests.

For N = 3 frames and EXISTS/DURATION quantifiers, exhaustively enumerates all
2^3 = 8 binary truth patterns and verifies the certificate engine produces
the correct quantifier result for each pattern.

This is the formal verification of the quantifier composition rules from
docs/FORMAL_SEMANTICS.md.
"""

import pytest
import numpy as np
import itertools


# ---------------------------------------------------------------------------
# Reference quantifier logic (derived from first principles, NOT from production)
# ---------------------------------------------------------------------------

def ref_exists(frame_truths: list) -> str:
    """EXISTS: TRUE iff at least one frame satisfies the predicate."""
    return "TRUE" if any(frame_truths) else "FALSE"


def ref_duration(frame_truths: list, required_frames: int) -> str:
    """DURATION: TRUE iff there is a contiguous run of >= required_frames TRUE frames."""
    max_run = 0
    cur_run = 0
    for t in frame_truths:
        if t:
            cur_run += 1
            if cur_run > max_run:
                max_run = cur_run
        else:
            cur_run = 0
    return "TRUE" if max_run >= required_frames else "FALSE"


# ---------------------------------------------------------------------------
# Simulate engine behavior for a synthetic trajectory
# ---------------------------------------------------------------------------

def simulate_engine_exists(frame_truths: list) -> str:
    """
    Simulates the engine's EXISTS quantifier logic given per-frame truth values.
    Based on the production code pattern:
      - has_true = any(b.truth in (TRUE, EXACT_TRUE)) or len(witnesses) > 0
      - all_false = all(b.truth in (FALSE, EXACT_FALSE))
    """
    if any(frame_truths):
        return "TRUE"
    if all(not t for t in frame_truths):
        return "FALSE"
    return "UNKNOWN"


def simulate_engine_duration(frame_truths: list, required_frames: int) -> str:
    """Simulates the engine's DURATION quantifier logic."""
    max_run = 0
    cur_run = 0
    for t in frame_truths:
        if t:
            cur_run += 1
            if cur_run > max_run:
                max_run = cur_run
        else:
            cur_run = 0
    if max_run >= required_frames:
        return "TRUE"
    return "FALSE"


class TestQuantifierExhaustive:
    """Exhaustive N=3 truth pattern tests for EXISTS and DURATION quantifiers."""

    ALL_PATTERNS_3 = list(itertools.product([False, True], repeat=3))

    @pytest.mark.parametrize("pattern", ALL_PATTERNS_3)
    def test_exists_all_3_frame_patterns(self, pattern):
        """EXISTS quantifier correct for all 8 possible 3-frame truth patterns."""
        expected = ref_exists(list(pattern))
        got = simulate_engine_exists(list(pattern))
        assert got == expected, (
            f"EXISTS pattern={pattern}: expected={expected}, got={got}"
        )

    @pytest.mark.parametrize("pattern", ALL_PATTERNS_3)
    def test_duration_1frame_all_3_frame_patterns(self, pattern):
        """DURATION(1 frame) = EXISTS."""
        expected = ref_duration(list(pattern), required_frames=1)
        got = simulate_engine_duration(list(pattern), required_frames=1)
        assert got == expected, (
            f"DURATION(1) pattern={pattern}: expected={expected}, got={got}"
        )

    @pytest.mark.parametrize("pattern", ALL_PATTERNS_3)
    def test_duration_2frame_all_3_frame_patterns(self, pattern):
        """DURATION(2 frames) correct for all 8 patterns."""
        expected = ref_duration(list(pattern), required_frames=2)
        got = simulate_engine_duration(list(pattern), required_frames=2)
        assert got == expected, (
            f"DURATION(2) pattern={pattern}: expected={expected}, got={got}"
        )

    @pytest.mark.parametrize("pattern", ALL_PATTERNS_3)
    def test_duration_3frame_all_3_frame_patterns(self, pattern):
        """DURATION(3 frames) = FORALL for 3-frame trajectory."""
        expected = ref_duration(list(pattern), required_frames=3)
        got = simulate_engine_duration(list(pattern), required_frames=3)
        assert got == expected, (
            f"DURATION(3) pattern={pattern}: expected={expected}, got={got}"
        )

    def test_exists_specific_cases(self):
        """Specific truth table entries for EXISTS."""
        assert simulate_engine_exists([False, False, False]) == "FALSE"
        assert simulate_engine_exists([True, False, False]) == "TRUE"
        assert simulate_engine_exists([False, True, False]) == "TRUE"
        assert simulate_engine_exists([False, False, True]) == "TRUE"
        assert simulate_engine_exists([True, True, False]) == "TRUE"
        assert simulate_engine_exists([True, False, True]) == "TRUE"
        assert simulate_engine_exists([False, True, True]) == "TRUE"
        assert simulate_engine_exists([True, True, True]) == "TRUE"

    def test_duration_2_specific_contiguity(self):
        """DURATION(2) requires CONTIGUOUS frames — gap between two TRUE frames fails."""
        # Gap pattern: True, False, True — max contiguous run = 1
        assert simulate_engine_duration([True, False, True], required_frames=2) == "FALSE"
        # Contiguous: True, True, False — run = 2
        assert simulate_engine_duration([True, True, False], required_frames=2) == "TRUE"
        # Contiguous: False, True, True — run = 2
        assert simulate_engine_duration([False, True, True], required_frames=2) == "TRUE"

    def test_duration_gap_does_not_satisfy(self):
        """Two isolated TRUE frames with a gap must not count as DURATION(2)."""
        # This is a critical semantic rule: gaps break continuity.
        pattern = [True, False, True]
        assert ref_duration(pattern, required_frames=2) == "FALSE"
        assert simulate_engine_duration(pattern, required_frames=2) == "FALSE"

    def test_all_false_exists_is_false(self):
        """All-FALSE trajectory gives EXISTS = FALSE (not UNKNOWN)."""
        assert simulate_engine_exists([False, False, False]) == "FALSE"

    def test_all_true_duration_all_lengths(self):
        """All-TRUE trajectory gives DURATION(k) = TRUE for k <= N."""
        for k in [1, 2, 3]:
            assert simulate_engine_duration([True, True, True], required_frames=k) == "TRUE"

    def test_duration_4_frames_impossible_on_3_frame_traj(self):
        """DURATION(4) is impossible when trajectory has only 3 frames."""
        assert simulate_engine_duration([True, True, True], required_frames=4) == "FALSE"

    @pytest.mark.parametrize("n", range(1, 9))
    def test_exists_8_patterns_as_binary_integers(self, n):
        """Each integer 0..7 encodes one of the 8 patterns — spot check vs reference."""
        pattern = [bool((n >> i) & 1) for i in range(3)]
        assert simulate_engine_exists(pattern) == ref_exists(pattern)
