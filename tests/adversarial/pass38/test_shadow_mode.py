"""PASS 38 — Shadow Mode Validation Tests.

Shadow mode: simultaneous MCI + brute-force execution with automatic mismatch detection.
This is for validation only, not production use.

On mismatch: FAIL CLOSED and emit reproducible diagnostic.
"""

import pytest
import numpy as np
import os

from mocs.bounds.periodic_bounds import compute_pbc_bounds


def shadow_validate_point_pair(pos_a: np.ndarray, pos_b: np.ndarray,
                                box: np.ndarray, threshold: float,
                                op: str = "<") -> dict:
    """
    Shadow mode: run both MCI bound and exact per-frame distance,
    then compare conclusions.
    
    Returns:
      mci_decision: str ("CERTIFIED_TRUE", "CERTIFIED_FALSE", "UNKNOWN")
      exact_truth: bool
      mismatch: bool — True if MCI decision contradicts exact truth
      diagnostic: str — Human-readable report if mismatch
    """
    aabb_a = (pos_a.copy(), pos_a.copy())
    aabb_b = (pos_b.copy(), pos_b.copy())
    L, U = compute_pbc_bounds(aabb_a, aabb_b, box)

    # MCI decision
    if op == "<":
        bound_true  = (U < threshold)
        bound_false = (L >= threshold)
    elif op == "<=":
        bound_true  = (U <= threshold)
        bound_false = (L > threshold)
    elif op == ">":
        bound_true  = (L > threshold)
        bound_false = (U <= threshold)
    elif op == ">=":
        bound_true  = (L >= threshold)
        bound_false = (U < threshold)
    else:
        bound_true, bound_false = False, False

    if bound_true:
        mci_decision = "CERTIFIED_TRUE"
    elif bound_false:
        mci_decision = "CERTIFIED_FALSE"
    else:
        mci_decision = "UNKNOWN"

    # Exact truth (brute-force)
    diff = pos_b - pos_a
    diff -= box * np.round(diff / box)
    d = float(np.linalg.norm(diff))
    if op == "<":
        exact_truth = d < threshold
    elif op == "<=":
        exact_truth = d <= threshold
    elif op == ">":
        exact_truth = d > threshold
    elif op == ">=":
        exact_truth = d >= threshold
    else:
        exact_truth = False

    # Mismatch detection (soundness check)
    mismatch = False
    diagnostic = ""

    # Fatal soundness violation: MCI says FALSE, but exact says TRUE (witness pruned)
    if mci_decision == "CERTIFIED_FALSE" and exact_truth:
        mismatch = True
        diagnostic = (
            f"SOUNDNESS VIOLATION: MCI=CERTIFIED_FALSE but exact_truth=TRUE\n"
            f"  pos_a={pos_a}, pos_b={pos_b}, box={box}\n"
            f"  threshold={threshold}, op={op!r}\n"
            f"  L={L:.8f}, U={U:.8f}, d={d:.8f}"
        )
    # Secondary concern: MCI says TRUE, but exact says FALSE (overcertification)
    elif mci_decision == "CERTIFIED_TRUE" and not exact_truth:
        mismatch = True
        diagnostic = (
            f"OVERCERTIFICATION: MCI=CERTIFIED_TRUE but exact_truth=FALSE\n"
            f"  pos_a={pos_a}, pos_b={pos_b}, box={box}\n"
            f"  threshold={threshold}, op={op!r}\n"
            f"  L={L:.8f}, U={U:.8f}, d={d:.8f}"
        )

    return {
        "mci_decision": mci_decision,
        "exact_truth": exact_truth,
        "mismatch": mismatch,
        "diagnostic": diagnostic,
        "L": L, "U": U, "d": d,
    }


class TestShadowMode:
    """Shadow mode: parallel MCI + brute-force with mismatch detection."""

    @pytest.fixture
    def rng(self):
        return np.random.default_rng(2024)

    def _run_shadow_batch(self, n: int, box: np.ndarray, threshold: float,
                          op: str, rng, label: str):
        """Run shadow validation for n random point-pair configurations."""
        mismatches = []
        for i in range(n):
            pos_a = rng.random(3) * (box * 0.95)
            pos_b = rng.random(3) * (box * 0.95)
            result = shadow_validate_point_pair(pos_a, pos_b, box, threshold, op)
            if result["mismatch"]:
                mismatches.append((i, result))
        assert len(mismatches) == 0, (
            f"[{label}] {len(mismatches)} shadow mode mismatches detected:\n"
            + "\n".join(r["diagnostic"] for _, r in mismatches[:5])
        )

    def test_shadow_1000_random_cubic_box(self, rng):
        """1,000 random pairs in cubic box L=20, threshold=5, op=<."""
        self._run_shadow_batch(1000, np.array([20.0, 20.0, 20.0]), 5.0, "<", rng,
                               "cubic L=20 τ=5")

    def test_shadow_1000_anisotropic_box(self, rng):
        """1,000 random pairs in anisotropic box."""
        self._run_shadow_batch(1000, np.array([30.0, 50.0, 10.0]), 4.0, "<", rng,
                               "anisotropic 30x50x10 τ=4")

    def test_shadow_leq_operator(self, rng):
        """Shadow mode for <= operator."""
        self._run_shadow_batch(500, np.array([20.0, 20.0, 20.0]), 7.0, "<=", rng,
                               "L=20 τ=7 op=<=")

    def test_shadow_geq_operator(self, rng):
        """Shadow mode for >= operator."""
        self._run_shadow_batch(500, np.array([20.0, 20.0, 20.0]), 3.0, ">=", rng,
                               "L=20 τ=3 op=>=")

    def test_shadow_half_box_threshold(self, rng):
        """Shadow mode with threshold = L/2 (half-box boundary)."""
        box = np.array([10.0, 10.0, 10.0])
        threshold = 5.0  # = L/2
        mismatches = []
        for i in range(1000):
            pos_a = rng.random(3) * box
            pos_b = rng.random(3) * box
            result = shadow_validate_point_pair(pos_a, pos_b, box, threshold, "<")
            if result["mismatch"]:
                mismatches.append((i, result))
        assert len(mismatches) == 0, (
            f"Half-box threshold: {len(mismatches)} mismatches:\n"
            + "\n".join(r["diagnostic"] for _, r in mismatches[:3])
        )

    def test_shadow_explicit_half_box_cases(self):
        """Explicit half-box cases from the spec table.
        
        All cases verified by hand:
        - pos=[0], pos=[5], box=10: MIC(5,10)=5, d=5. 5<5=False → CERTIFIED_FALSE. 5<=5=True → TRUE.
        - pos=[0], pos=[3], box=10: MIC(3,10)=3, d=3 < 5 → CERTIFIED_TRUE.
        - pos=[0], pos=[7], box=10: MIC(7,10)=7-10=-3, d=3 < 5 → CERTIFIED_TRUE.
          (NOT CERTIFIED_FALSE: 3 < 5 is TRUE, not FALSE!)
        """
        box = np.array([10.0, 10.0, 10.0])
        cases = [
            # (pos_a, pos_b, threshold, op, expected_mci, expected_exact_truth)
            # d = |MIC(5, 10)| = 5; for < 5.0 → FALSE
            ([0.0, 0.0, 0.0], [5.0, 0.0, 0.0], 5.0, "<",  "CERTIFIED_FALSE", False),
            # d = 5; for <= 5.0 → TRUE (U=5 <= 5 → CERTIFIED_TRUE)
            ([0.0, 0.0, 0.0], [5.0, 0.0, 0.0], 5.0, "<=", "CERTIFIED_TRUE",  True),
            # d = 5; for > 5.0 → FALSE (U=5 <= 5 → CERTIFIED_FALSE)
            ([0.0, 0.0, 0.0], [5.0, 0.0, 0.0], 5.0, ">",  "CERTIFIED_FALSE", False),
            # d = 5; for >= 5.0 → TRUE (L=5 >= 5 → CERTIFIED_TRUE)
            ([0.0, 0.0, 0.0], [5.0, 0.0, 0.0], 5.0, ">=", "CERTIFIED_TRUE",  True),
            # d = |MIC(3, 10)| = 3 < 5 → CERTIFIED_TRUE for <
            ([0.0, 0.0, 0.0], [3.0, 0.0, 0.0], 5.0, "<",  "CERTIFIED_TRUE",  True),
            # d = |MIC(7, 10)| = |7-10*round(0.7)| = |7-10| = 3 < 5 → CERTIFIED_TRUE for <
            ([0.0, 0.0, 0.0], [7.0, 0.0, 0.0], 5.0, "<",  "CERTIFIED_TRUE",  True),
            # d = |MIC(8, 10)| = |8-10| = 2 < 5 → CERTIFIED_TRUE for <
            ([0.0, 0.0, 0.0], [8.0, 0.0, 0.0], 5.0, "<",  "CERTIFIED_TRUE",  True),
            # d = |MIC(2, 10)| = 2 >= 3 threshold → CERTIFIED_FALSE for >= 3
            ([0.0, 0.0, 0.0], [2.0, 0.0, 0.0], 3.0, "<",  "CERTIFIED_TRUE",  True),
        ]
        for pos_a, pos_b, thresh, op, expected_mci, expected_exact in cases:
            result = shadow_validate_point_pair(
                np.array(pos_a), np.array(pos_b), box, thresh, op
            )
            assert not result["mismatch"], result["diagnostic"]
            assert result["mci_decision"] == expected_mci, (
                f"Expected MCI={expected_mci}, got {result['mci_decision']} "
                f"for pos_a={pos_a}, pos_b={pos_b}, τ={thresh}, op={op!r}, d={result['d']:.4f}"
            )
            assert result["exact_truth"] == expected_exact, (
                f"Expected exact={expected_exact}, got {result['exact_truth']} "
                f"for pos_a={pos_a}, pos_b={pos_b}, τ={thresh}, op={op!r}, d={result['d']:.4f}"
            )


    def test_shadow_zero_distance(self):
        """Self-distance: pos_a == pos_b, d = 0."""
        box = np.array([10.0, 10.0, 10.0])
        pos = np.array([3.5, 2.7, 1.1])
        result = shadow_validate_point_pair(pos, pos.copy(), box, 1.0, "<")
        assert not result["mismatch"], result["diagnostic"]
        assert result["exact_truth"] is True  # 0 < 1.0
        assert abs(result["d"]) < 1e-10

    def test_shadow_seam_crossing(self):
        """Seam crossing: atom at x=9.9, x=0.1 — physically close but large AABB."""
        box = np.array([10.0, 10.0, 10.0])
        # Two atoms each at different sides of the seam — physically 0.2 Å apart
        result = shadow_validate_point_pair(
            np.array([9.9, 5.0, 5.0]), np.array([0.1, 5.0, 5.0]),
            box, 1.0, "<"
        )
        assert not result["mismatch"], result["diagnostic"]
        # True distance: MIC(0.1 - 9.9, 10) = MIC(-9.8, 10) = -9.8 + 10 = 0.2
        assert abs(result["d"] - 0.2) < 1e-9, f"Expected d=0.2, got {result['d']}"
        assert result["exact_truth"] is True   # 0.2 < 1.0

    def test_no_false_pruning_in_1000_random_runs(self, rng):
        """The forbidden cell [PRUNED=1][WITNESS=1] count must be 0."""
        box = np.array([15.0, 15.0, 15.0])
        forbidden_count = 0
        for _ in range(1000):
            pos_a = rng.random(3) * 14
            pos_b = rng.random(3) * 14
            threshold = rng.random() * 10 + 1
            result = shadow_validate_point_pair(pos_a, pos_b, box, threshold, "<")
            if result["mci_decision"] == "CERTIFIED_FALSE" and result["exact_truth"]:
                forbidden_count += 1
        assert forbidden_count == 0, (
            f"FORBIDDEN CELL VIOLATED: {forbidden_count} cases where "
            f"PRUNED=1 and WITNESS=1!"
        )
