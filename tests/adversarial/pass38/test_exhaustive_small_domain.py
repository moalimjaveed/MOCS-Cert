"""PASS 38 — Exhaustive Small-Domain Bound Verification.

Uses the exhaustive_pbc_oracle module to verify compute_pbc_bounds produces
conservative bounds (L <= d_min, U >= d_max) over ALL AABB pairs in
small integer domains.

This is the gold-standard soundness test: exhaustive, not randomized.
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'reference'))
from exhaustive_pbc_oracle import exhaustive_verify


class TestExhaustiveSmallDomain:
    """Exhaustive integer-domain bound soundness verification."""

    def _run_and_assert(self, Lx, Ly, Lz, step=2, label=""):
        pairs, ul, uu, ces = exhaustive_verify(Lx, Ly, Lz, step=step, tolerance=1e-9)
        assert pairs > 0, f"No pairs were tested for {label}"
        assert ul == 0, (
            f"SOUNDNESS VIOLATION [{label}]: {ul} unsound lower bounds found!\n"
            + "\n".join(
                f"  AABB_A={ce.aabb_a.lo}..{ce.aabb_a.hi}, "
                f"AABB_B={ce.aabb_b.lo}..{ce.aabb_b.hi}, "
                f"L={ce.prod_L:.8f} > d_min={ce.true_dmin:.8f}"
                for ce in ces[:3] if ce.violation == "UNSOUND_LOWER"
            )
        )
        assert uu == 0, (
            f"SOUNDNESS VIOLATION [{label}]: {uu} unsound upper bounds found!\n"
            + "\n".join(
                f"  AABB_A={ce.aabb_a.lo}..{ce.aabb_a.hi}, "
                f"AABB_B={ce.aabb_b.lo}..{ce.aabb_b.hi}, "
                f"U={ce.prod_U:.8f} < d_max={ce.true_dmax:.8f}"
                for ce in ces[:3] if ce.violation == "UNSOUND_UPPER"
            )
        )
        return pairs

    def test_cubic_L2(self):
        """Exhaustive cubic box L=2, step=2 (0.5 Å grid)."""
        pairs = self._run_and_assert(2, 2, 2, step=2, label="L=2 cubic")
        assert pairs > 100, f"Expected many pairs tested, got {pairs}"

    def test_cubic_L3(self):
        """Exhaustive cubic box L=3, step=2."""
        pairs = self._run_and_assert(3, 3, 3, step=2, label="L=3 cubic")
        assert pairs > 1000

    def test_cubic_L4(self):
        """Exhaustive cubic box L=4, step=2 (0.5 Å grid)."""
        pairs = self._run_and_assert(4, 4, 4, step=2, label="L=4 cubic")
        assert pairs > 10000

    def test_anisotropic_2x3x4(self):
        """Exhaustive anisotropic box Lx=2, Ly=3, Lz=4."""
        pairs = self._run_and_assert(2, 3, 4, step=2, label="2x3x4 anisotropic")
        assert pairs > 100

    def test_anisotropic_3x3x6(self):
        """Strongly anisotropic box 3x3x6."""
        pairs = self._run_and_assert(3, 3, 6, step=2, label="3x3x6 anisotropic")
        assert pairs > 1000

    def test_flat_aabbs_degenerate(self):
        """Point AABBs (zero volume) at specific positions."""
        import numpy as np
        from mocs.bounds.periodic_bounds import compute_pbc_bounds
        from fractions import Fraction

        # Test: two point atoms at specific positions
        test_cases = [
            # (pos_a, pos_b, box, expected_d)
            ((0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (4.0, 4.0, 4.0), 1.0),
            ((0.0, 0.0, 0.0), (2.0, 0.0, 0.0), (4.0, 4.0, 4.0), 2.0),
            ((0.0, 0.0, 0.0), (3.0, 0.0, 0.0), (4.0, 4.0, 4.0), 1.0),  # wraps to 1
            ((0.0, 0.0, 0.0), (4.0, 0.0, 0.0), (4.0, 4.0, 4.0), 0.0),  # full period
            ((0.0, 0.0, 0.0), (2.0, 2.0, 0.0), (4.0, 4.0, 4.0), 2.0 * np.sqrt(2)),
        ]
        for pos_a, pos_b, box, expected_d in test_cases:
            aabb_a = (np.array(pos_a), np.array(pos_a))
            aabb_b = (np.array(pos_b), np.array(pos_b))
            L, U = compute_pbc_bounds(aabb_a, aabb_b, np.array(box))
            assert abs(L - expected_d) < 1e-9, (
                f"L={L:.8f} != expected_d={expected_d:.8f} for pos_a={pos_a} pos_b={pos_b}"
            )
            assert abs(U - expected_d) < 1e-9, (
                f"U={U:.8f} != expected_d={expected_d:.8f} for pos_a={pos_a} pos_b={pos_b}"
            )
