"""
PASS 47: Golden AABB Parity Test Suite.

Validates that across golden scientific queries:
1. KDOP14 and AABB produce 100% identical epistemic truth values (TRUE, FALSE, UNKNOWN).
2. KDOP14 lower bounds are monotonically tighter than or equal to AABB: L_KDOP >= L_AABB.
3. KDOP14 achieves equal or superior pruning efficiency relative to AABB.
"""

import pytest
from backend.app.core.compiler_service import compiler_service


class TestAABBGoldenParity:
    """Rigorous equivalence tests between AABB baseline and KDOP14."""

    @pytest.mark.parametrize("query_text", [
        "DISTANCE(name CA, name O2) < 3.0 A",
        "DISTANCE(name CA, name O2) < 4.0 A",
        "DISTANCE(name CA, name O2) < 6.0 A",
        "DISTANCE(name CA, name O2) > 10.0 A",
        "FIND ALL (name CA) WITHIN 5.0 A OF (name O2)",
        "DISTANCE(name CA, name O2) < 4.0 A FOR 30.0 ps",
    ])
    def test_golden_queries_truth_parity(self, query_text):
        """Validates that AABB and KDOP14 evaluate to identical truth values."""
        res_aabb = compiler_service.execute(query_text, bounding_model="AABB")
        res_kdop = compiler_service.execute(query_text, bounding_model="KDOP14")

        assert res_aabb.truth_value == res_kdop.truth_value, (
            f"Query '{query_text}' truth value mismatch: "
            f"AABB={res_aabb.truth_value} vs KDOP14={res_kdop.truth_value}"
        )

        assert res_aabb.resolution_status == res_kdop.resolution_status

        # KDOP14 should prune at least as many blocks or require equal/fewer refinements
        assert res_kdop.refined_blocks <= res_aabb.refined_blocks, (
            f"KDOP14 refined {res_kdop.refined_blocks} blocks, which is worse than AABB {res_aabb.refined_blocks}"
        )

    def test_monotonic_bound_tightness_on_synth(self):
        """Verifies that across all evaluated blocks, L_KDOP >= L_AABB - eps."""
        res_aabb = compiler_service.execute("DISTANCE(name CA, name O2) < 5.0 A", bounding_model="AABB")
        res_kdop = compiler_service.execute("DISTANCE(name CA, name O2) < 5.0 A", bounding_model="KDOP14")

        blocks_aabb = {b["block_id"]: b for b in res_aabb.evaluated_blocks}
        blocks_kdop = {b["block_id"]: b for b in res_kdop.evaluated_blocks}

        for b_id, b_k in blocks_kdop.items():
            b_a = blocks_aabb[b_id]
            l_a, u_a = b_a["lower_bound"], b_a["upper_bound"]
            l_k, u_k = b_k["lower_bound"], b_k["upper_bound"]

            # Lower bound must be monotonically tighter or equal
            assert l_k >= l_a - 1e-9, f"Block {b_id}: L_KDOP ({l_k}) < L_AABB ({l_a})"
            # Upper bound must be tighter or equal
            assert u_k <= u_a + 1e-9, f"Block {b_id}: U_KDOP ({u_k}) > U_AABB ({u_a})"
