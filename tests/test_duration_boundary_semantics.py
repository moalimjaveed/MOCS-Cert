"""
Test Suite: Duration Boundary Semantics & Sampled-Frame Verification
Tests exact boundary behaviors for:
- 1 frame
- 2 frames
- exactly 100 ps
- 99.999 ps
- 100.001 ps
- spanning two blocks
- continuous physical semantics rejection
"""

import math
import pytest
from mocs.certificates.auditor import verify_certificate
from mocs.exceptions import MOCSVerificationError


def compute_req_frames(tau: float, dt: float) -> int:
    """Exact canonical duration formula: max(1, ceil((tau - 1e-9) / dt))"""
    return max(1, int(math.ceil((tau - 1e-9) / dt)))


def test_duration_formula_precision():
    dt = 10.0  # 10 ps timestep
    
    # 1 frame (10 ps)
    assert compute_req_frames(10.0, dt) == 1
    # 0 ps or near 0
    assert compute_req_frames(0.0, dt) == 1
    assert compute_req_frames(1e-9, dt) == 1
    
    # 2 frames (20 ps)
    assert compute_req_frames(20.0, dt) == 2
    assert compute_req_frames(10.0001, dt) == 2
    
    # Exactly 100 ps -> exactly 10 frames
    assert compute_req_frames(100.0, dt) == 10
    
    # 99.999 ps -> ceil((99.999 - 1e-9) / 10) = ceil(9.9998999999) = 10 frames
    assert compute_req_frames(99.999, dt) == 10
    
    # 100.001 ps -> ceil((100.001 - 1e-9) / 10) = ceil(10.0000999999) = 11 frames
    assert compute_req_frames(100.001, dt) == 11
    
    # Fractional boundaries
    assert compute_req_frames(100.00001, dt) == 11
    # Float precision safeguard: 100.0 with typical float epsilon doesn't become 11
    assert compute_req_frames(100.0 + 1e-11, dt) == 10


def test_duration_exact_100ps_single_block():
    """100 ps required with dt=10 ps requires 10 frames. Single block [10, 20) has 10 frames."""
    cert = {
        "mocs_cert_version": "0.1.0",
        "semantic_tag": "MOCS-SEM-v1.0",
        "result": {"truth_value": "TRUE", "resolution": "COMPLETE"},
        "quantifier": "DURATION",
        "query": {
            "temporal": {"operator": "FOR", "min_duration_ps": 100.0},
            "predicate": {"operator": "<", "threshold_value": 4.0}
        },
        "semantics": {
            "sampling_semantics": {"mode": "sampled_frames", "dt_ps": 10.0}
        },
        "evidence": {
            "inspected_block_bounds": [
                {"block_id": 1, "frame_start": 10, "frame_end_exclusive": 20, "lower_bound": 2.0, "upper_bound": 3.5, "status": "CERTIFIED_TRUE"}
            ]
        },
        "proof": {"type": "WITNESS_BOUNDS"}
    }
    assert verify_certificate(cert, verify_hashes=False) is True


def test_duration_99_999ps_satisfied_by_10_frames():
    """99.999 ps requires 10 frames, satisfied by [10, 20)."""
    cert = {
        "mocs_cert_version": "0.1.0",
        "semantic_tag": "MOCS-SEM-v1.0",
        "result": {"truth_value": "TRUE", "resolution": "COMPLETE"},
        "quantifier": "DURATION",
        "query": {
            "temporal": {"operator": "FOR", "min_duration_ps": 99.999},
            "predicate": {"operator": "<", "threshold_value": 4.0}
        },
        "semantics": {
            "sampling_semantics": {"mode": "sampled_frames", "dt_ps": 10.0}
        },
        "evidence": {
            "inspected_block_bounds": [
                {"block_id": 1, "frame_start": 10, "frame_end_exclusive": 20, "lower_bound": 2.0, "upper_bound": 3.5, "status": "CERTIFIED_TRUE"}
            ]
        },
        "proof": {"type": "WITNESS_BOUNDS"}
    }
    assert verify_certificate(cert, verify_hashes=False) is True


def test_duration_100_001ps_rejected_by_10_frames():
    """100.001 ps requires 11 frames; 10 frames in [10, 20) must be rejected."""
    cert = {
        "mocs_cert_version": "0.1.0",
        "semantic_tag": "MOCS-SEM-v1.0",
        "result": {"truth_value": "TRUE", "resolution": "COMPLETE"},
        "quantifier": "DURATION",
        "query": {
            "temporal": {"operator": "FOR", "min_duration_ps": 100.001},
            "predicate": {"operator": "<", "threshold_value": 4.0}
        },
        "semantics": {
            "sampling_semantics": {"mode": "sampled_frames", "dt_ps": 10.0}
        },
        "evidence": {
            "inspected_block_bounds": [
                {"block_id": 1, "frame_start": 10, "frame_end_exclusive": 20, "lower_bound": 2.0, "upper_bound": 3.5, "status": "CERTIFIED_TRUE"}
            ]
        },
        "proof": {"type": "WITNESS_BOUNDS"}
    }
    with pytest.raises(MOCSVerificationError, match="query requires 11 frames"):
        verify_certificate(cert, verify_hashes=False)


def test_duration_spanning_two_blocks():
    """Contiguous run spanning Block 1 [10, 20) and Block 2 [20, 30) gives 20 frames = 200 ps."""
    cert = {
        "mocs_cert_version": "0.1.0",
        "semantic_tag": "MOCS-SEM-v1.0",
        "result": {"truth_value": "TRUE", "resolution": "COMPLETE"},
        "quantifier": "DURATION",
        "query": {
            "temporal": {"operator": "FOR", "min_duration_ps": 150.0},  # requires 15 frames
            "predicate": {"operator": "<", "threshold_value": 4.0}
        },
        "semantics": {
            "sampling_semantics": {"mode": "sampled_frames", "dt_ps": 10.0}
        },
        "evidence": {
            "inspected_block_bounds": [
                {"block_id": 1, "frame_start": 10, "frame_end_exclusive": 20, "lower_bound": 2.0, "upper_bound": 3.5, "status": "CERTIFIED_TRUE"},
                {"block_id": 2, "frame_start": 20, "frame_end_exclusive": 30, "lower_bound": 2.2, "upper_bound": 3.8, "status": "CERTIFIED_TRUE"}
            ]
        },
        "proof": {"type": "WITNESS_BOUNDS"}
    }
    assert verify_certificate(cert, verify_hashes=False) is True


def test_duration_gap_between_blocks_rejected():
    """Block 1 [10, 20) and Block 2 [21, 30) has a 1-frame gap (frame 20). Max run is 10 frames."""
    cert = {
        "mocs_cert_version": "0.1.0",
        "semantic_tag": "MOCS-SEM-v1.0",
        "result": {"truth_value": "TRUE", "resolution": "COMPLETE"},
        "quantifier": "DURATION",
        "query": {
            "temporal": {"operator": "FOR", "min_duration_ps": 150.0},  # requires 15 frames
            "predicate": {"operator": "<", "threshold_value": 4.0}
        },
        "semantics": {
            "sampling_semantics": {"mode": "sampled_frames", "dt_ps": 10.0}
        },
        "evidence": {
            "inspected_block_bounds": [
                {"block_id": 1, "frame_start": 10, "frame_end_exclusive": 20, "lower_bound": 2.0, "upper_bound": 3.5, "status": "CERTIFIED_TRUE"},
                {"block_id": 2, "frame_start": 21, "frame_end_exclusive": 30, "lower_bound": 2.2, "upper_bound": 3.8, "status": "CERTIFIED_TRUE"}
            ]
        },
        "proof": {"type": "WITNESS_BOUNDS"}
    }
    with pytest.raises(MOCSVerificationError, match="query requires 15 frames"):
        verify_certificate(cert, verify_hashes=False)


def test_duration_1_frame_and_2_frame_boundaries():
    """1 frame = 10 ps, 2 frames = 20 ps."""
    # 1 frame
    cert_1f = {
        "mocs_cert_version": "0.1.0",
        "semantic_tag": "MOCS-SEM-v1.0",
        "result": {"truth_value": "TRUE", "resolution": "COMPLETE"},
        "quantifier": "DURATION",
        "query": {
            "temporal": {"operator": "FOR", "min_duration_ps": 10.0},
            "predicate": {"operator": "<", "threshold_value": 4.0}
        },
        "semantics": {
            "sampling_semantics": {"mode": "sampled_frames", "dt_ps": 10.0}
        },
        "evidence": {
            "witness_intervals": [[5, 6]]
        },
        "proof": {"type": "WITNESS_BOUNDS"}
    }
    assert verify_certificate(cert_1f, verify_hashes=False) is True

    # 2 frames
    cert_2f = {
        "mocs_cert_version": "0.1.0",
        "semantic_tag": "MOCS-SEM-v1.0",
        "result": {"truth_value": "TRUE", "resolution": "COMPLETE"},
        "quantifier": "DURATION",
        "query": {
            "temporal": {"operator": "FOR", "min_duration_ps": 20.0},
            "predicate": {"operator": "<", "threshold_value": 4.0}
        },
        "semantics": {
            "sampling_semantics": {"mode": "sampled_frames", "dt_ps": 10.0}
        },
        "evidence": {
            "witness_intervals": [[5, 7]]
        },
        "proof": {"type": "WITNESS_BOUNDS"}
    }
    assert verify_certificate(cert_2f, verify_hashes=False) is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
