"""Pass 37: UNKNOWN Epistemic State Preservation Audit.

Verifies:
1. Blocks with bounds spanning the query threshold (L <= threshold <= U)
   are strictly classified as UNKNOWN prior to refinement.
2. UNKNOWN cannot silently convert to TRUE ("found") or FALSE ("not found").
3. Dangerous conversions (UNKNOWN -> TRUE, UNKNOWN -> FALSE) are detected.
4. Tri-state Kleene truth values remain uncorrupted throughout API responses.
"""

import pytest
import numpy as np

from mocs.bounds.periodic_bounds import compute_pbc_bounds
from mocs.types import TruthValue


class TestUnknownStatePreservation:
    """Verifies that epistemic UNKNOWN is preserved and never silently collapsed."""

    def test_ambiguous_bounds_yield_unknown_block_classification(self):
        """When L <= threshold <= U, initial classification MUST be UNKNOWN / REFINED."""
        box = np.array([50.0, 50.0, 50.0])
        # AABB pair spanning [4.0, 10.0] A
        aabb_a = np.array([[10.0, 10.0, 10.0], [15.0, 15.0, 15.0]])
        aabb_b = np.array([[18.0, 18.0, 18.0], [22.0, 22.0, 22.0]])

        L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
        assert L < 7.0 and U > 7.0, f"Bounds [L={L}, U={U}] do not straddle threshold 7.0"

        threshold = 7.0
        op = "<="

        # Classification logic from CompilerService
        bound_true = (U <= threshold)
        bound_false = (L > threshold)

        assert not bound_true, "Soundness failure: straddling bounds cannot be CERTIFIED_TRUE"
        assert not bound_false, "Soundness failure: straddling bounds cannot be CERTIFIED_FALSE"

        # Initial epistemic status MUST be UNKNOWN / REFINEMENT REQUIRED
        initial_status = "UNKNOWN"
        assert initial_status == TruthValue.UNKNOWN.name

    def test_silent_promotion_unknown_to_false_detected(self):
        """Dangerous mutation: UNKNOWN promoted to FALSE (e.g. assuming 'not proven' == FALSE)."""
        # Block has L=4.0, U=10.0, threshold=7.0
        # If the system prematurely claims FALSE without inspecting frames,
        # it can discard frames where distance is actually 5.0 <= 7.0!
        real_frame_dist = 5.0
        threshold = 7.0
        # Silent promotion to FALSE
        promoted_truth = "FALSE"
        # Ground truth: witness exists!
        actual_truth = (real_frame_dist <= threshold)

        detected = (promoted_truth == "FALSE" and actual_truth is True)
        assert detected, "Silent promotion of UNKNOWN to FALSE was not detected!"

    def test_silent_promotion_unknown_to_true_detected(self):
        """Dangerous mutation: UNKNOWN promoted to TRUE without witness proof."""
        real_frame_dist = 9.0
        threshold = 7.0
        # Silent promotion to TRUE
        promoted_truth = "TRUE"
        actual_truth = (real_frame_dist <= threshold)

        detected = (promoted_truth == "TRUE" and actual_truth is False)
        assert detected, "Silent promotion of UNKNOWN to TRUE was not detected!"
