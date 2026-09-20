#!/usr/bin/env python3
"""
test_modular_mocs.py — Verifies modular package imports and self-tests.
"""

import sys
import numpy as np

# 1. Test top-level package imports
import mocs
from mocs import (
    TruthValue,
    ResolutionStatus,
    MOCSResult,
    ObservabilityContract,
    kleene_and,
    kleene_or,
    kleene_not,
    compute_pbc_bounds,
    PeriodicCell,
    verify_refinement_non_expansion,
    verify_certificate,
    diff_against_reference,
    reference_temporal_for,
    select_execution_plan,
    extract_half_open_intervals,
    MOCSError,
    MOCSVerificationError,
    BackendType,
    detect_optimal_backend,
    get_array_module,
    batch_compute_aabb,
    batch_derive_pairwise_bounds,
    KDOP14,
    CANONICAL_DIRECTIONS_14
)

# 2. Test subpackage imports
from mocs.ir.ast import DistanceNode, AtomRef, PredicateNode
from mocs.fuzz.generator import apply_fuzz_transformations

def test_modular_package():
    print("Testing Modular MOCS Package:")
    print(f"  Package version: {mocs.__version__}")

    # Kleene Logic
    assert kleene_and(TruthValue.TRUE, TruthValue.TRUE) == TruthValue.TRUE
    assert kleene_and(TruthValue.FALSE, TruthValue.UNKNOWN) == TruthValue.FALSE
    assert kleene_or(TruthValue.TRUE, TruthValue.UNKNOWN) == TruthValue.TRUE
    assert kleene_not(TruthValue.UNKNOWN) == TruthValue.UNKNOWN
    print("  [PASS] Kleene Logic Verification")

    # PBC Bounds
    box = np.array([50.0, 50.0, 50.0], dtype=np.float64)
    aabb_a = (np.array([1.0, 10.0, 10.0]), np.array([2.0, 11.0, 11.0]))
    aabb_b = (np.array([48.0, 10.0, 10.0]), np.array([49.0, 11.0, 11.0]))
    L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
    assert L <= 2.0 + 1e-9
    assert U >= 4.0 - 1e-9
    print(f"  [PASS] compute_pbc_bounds (L={L:.3f}, U={U:.3f})")

    # PeriodicCell General PBC Engine
    c_ortho = PeriodicCell.from_dimensions([20.0, 20.0, 20.0])
    assert c_ortho.is_orthorhombic
    assert c_ortho.cell_type == "orthorhombic"
    assert np.isclose(c_ortho.volume, 8000.0)

    # Rhombic Dodecahedron Triclinic Cell
    c_rhomb = PeriodicCell.from_dimensions([80.0, 80.0, 80.0, 60.0, 60.0, 90.0])
    assert not c_rhomb.is_orthorhombic
    assert c_rhomb.cell_type == "triclinic"
    r_pt = np.array([[12.0, -15.0, 25.0]])
    s_pt = c_rhomb.to_fractional(r_pt)
    assert np.allclose(r_pt, c_rhomb.to_cartesian(s_pt))
    L_tri, U_tri = c_rhomb.compute_aabb_bounds(aabb_a, aabb_b)
    assert L_tri >= 0.0 and U_tri >= L_tri
    print(f"  [PASS] PeriodicCell General Geometry Engine (Triclinic L={L_tri:.3f}, U={U_tri:.3f})")

    # KDOP14 Polytope Engine Verification
    pts_kdop_a = np.array([[0.0, 0.0, 0.0], [5.0, 5.0, 5.0]], dtype=np.float64)
    pts_kdop_b = np.array([[20.0, 20.0, 20.0], [25.0, 25.0, 25.0]], dtype=np.float64)
    kdop_a = KDOP14.from_coordinates(pts_kdop_a)
    kdop_b = KDOP14.from_coordinates(pts_kdop_b)
    assert kdop_a.min_projections.shape == (7,)
    assert kdop_a.max_projections.shape == (7,)
    assert kdop_a.aabb_volume() == 125.0
    v_kdop = kdop_a.exact_volume()
    assert v_kdop is not None and v_kdop <= 125.0 + 1e-9

    L_kdop, U_kdop = kdop_a.compute_cartesian_bounds(kdop_b)
    assert L_kdop > 0.0 and U_kdop >= L_kdop
    L_kdop_pbc, U_kdop_pbc = kdop_a.compute_bounds(kdop_b, c_ortho)
    assert L_kdop_pbc >= 0.0 and U_kdop_pbc >= L_kdop_pbc
    print(f"  [PASS] KDOP14 Polytope Bounding Engine (Euclidean L={L_kdop:.3f}, U={U_kdop:.3f}, PBC L={L_kdop_pbc:.3f})")

    # Non-expansion
    assert verify_refinement_non_expansion((1.0, 5.0), (1.5, 4.5))
    print("  [PASS] verify_refinement_non_expansion")

    # Half-open intervals
    bool_test = np.array([False, True, True, False, True, False, False, True])
    intervals = extract_half_open_intervals(bool_test)
    assert intervals == [(1, 3), (4, 5), (7, 8)]
    print("  [PASS] extract_half_open_intervals [k_s, k_e)")

    # Universal Verifier
    mock_cert = {
        "mocs_cert_version": "0.1.0",
        "semantic_tag": "MOCS-SEM-v1.0",
        "result": {
            "truth_value": "TRUE",
            "resolution": "COMPLETE"
        },
        "query": {
            "query_id": "test-q1",
            "observable": "DISTANCE",
            "predicate": {
                "operator": "<",
                "threshold_value": 4.0,
                "unit": "A"
            }
        },
        "semantics": {
            "sampling_semantics": { "mode": "sampled_frames", "dt_ps": 10.0 },
            "pbc_semantics": { "mode": "orthorhombic_minimum_image" }
        },
        "evidence": {
            "inspected_block_bounds": [
                { "block_id": 0, "lower_bound": 2.1, "upper_bound": 3.5, "status": "TRUE" },
                { "block_id": 1, "lower_bound": 5.0, "upper_bound": 6.2, "status": "FALSE" }
            ]
        },
        "resources": {
            "source_compressed_bytes_fetched": 1000,
            "compressed_frames_decoded": 100,
            "coordinates_materialized": 300,
            "atoms_analyzed": 2,
            "index_bytes_read": 128,
            "wall_time_seconds": 0.05,
            "peak_memory_bytes": 10485760
        }
    }
    assert verify_certificate(mock_cert, verify_hashes=False)
    print("  [PASS] verify_certificate")

    # Cost-based optimizer
    assert select_execution_plan("q1", 5, is_cached=True, index_available=True, estimated_prune_rate=0.8) == "Plan-C"
    assert select_execution_plan("q1", 10, is_cached=False, index_available=True, estimated_prune_rate=0.8) == "Plan-D"
    assert select_execution_plan("q1", 1, is_cached=False, index_available=False, estimated_prune_rate=0.8) == "Plan-A"
    print("  [PASS] select_execution_plan")

    # AST IR nodes
    d_node = DistanceNode(atom_a=AtomRef("resid 1 and name CA"), atom_b=AtomRef("resid 2 and name CA"))
    p_node = PredicateNode(observable=d_node, operator="<", threshold=4.5, unit="A")
    assert p_node.threshold == 4.5
    print("  [PASS] AST IR Node instantiation")

    # Fuzzing
    coords = np.array([[10.0, 10.0, 10.0], [20.0, 20.0, 20.0]])
    fuzzed = apply_fuzz_transformations(coords, box)
    assert fuzzed.shape == coords.shape
    print("  [PASS] Adversarial fuzzing transformation")

    # Temporal Semantics & Unsupported Continuous Persistence
    t_bool = np.array([False, True, True, False])
    truth_t, res_t = reference_temporal_for(t_bool, 15.0, 10.0, mode="sampled_frames")
    assert truth_t == "TRUE" and res_t == "COMPLETE"
    truth_sub, res_sub = reference_temporal_for(t_bool, 5.0, 10.0, mode="continuous_physical")
    assert truth_sub == "UNKNOWN" and res_sub == ResolutionStatus.UNSUPPORTED_SEMANTICS.value
    print("  [PASS] Temporal Sampled-Frames Semantics & UNSUPPORTED_SEMANTICS")

    # Differential Oracle Check
    sound, expl = diff_against_reference("TRUE", "COMPLETE", "TRUE", "COMPLETE")
    assert sound and expl is None
    unsound, expl2 = diff_against_reference("TRUE", "COMPLETE", "FALSE", "COMPLETE")
    assert not unsound and expl2 is not None
    print("  [PASS] Differential Oracle Soundness Check")

    # Multi-Tier Metrics MOCSResult
    res_obj = MOCSResult(
        truth_value="TRUE",
        resolution_status="COMPLETE",
        query_id="q001",
        plan_used="Plan-D",
        bytes_read_os=5000,
        bytes_read_decompressed=5000,
        frames_decoded=100,
        frames_evaluated=10,
        coordinates_materialized=30,
        atoms_analyzed=2,
        index_bytes_read=1024,
        scope="FULL_TRAJECTORY",
        quantifier="EXISTS"
    )
    assert res_obj.bytes_read_os == 5000
    assert res_obj.atoms_analyzed == 2
    assert res_obj.index_bytes_read == 1024
    assert res_obj.quantifier == "EXISTS"
    assert res_obj.is_certified()
    print("  [PASS] MOCSResult Multi-Tier Metrics & Quantifier Schema")

    # Duration Verifier Contiguity Check
    dur_cert = {
        "mocs_cert_version": "0.1.0",
        "semantic_tag": "MOCS-SEM-v1.0",
        "result": { "truth_value": "TRUE", "resolution": "COMPLETE" },
        "query": {
            "query_id": "test-dur",
            "observable": "DISTANCE",
            "predicate": { "operator": "<", "threshold_value": 4.0, "unit": "A" },
            "temporal": { "operator": "FOR", "min_duration_ps": 200.0 }
        },
        "semantics": {
            "sampling_semantics": { "mode": "sampled_frames", "dt_ps": 10.0 },
            "pbc_semantics": { "mode": "orthorhombic_minimum_image" }
        },
        "quantifier": "DURATION",
        "evidence": {
            "inspected_block_bounds": [
                { "block_id": 0, "frame_start": 0, "frame_end_exclusive": 10, "lower_bound": 2.0, "upper_bound": 3.0, "status": "TRUE" },
                { "block_id": 1, "frame_start": 10, "frame_end_exclusive": 20, "lower_bound": 2.0, "upper_bound": 3.0, "status": "TRUE" }
            ]
        },
        "resources": {
            "source_compressed_bytes_fetched": 1000,
            "compressed_frames_decoded": 100,
            "coordinates_materialized": 300,
            "atoms_analyzed": 2,
            "index_bytes_read": 128,
            "wall_time_seconds": 0.05,
            "peak_memory_bytes": 10485760
        }
    }
    assert verify_certificate(dur_cert, verify_hashes=False)
    # Non-contiguous witness must fail
    dur_cert_gap = {
        "mocs_cert_version": "0.1.0",
        "semantic_tag": "MOCS-SEM-v1.0",
        "result": { "truth_value": "TRUE", "resolution": "COMPLETE" },
        "query": {
            "query_id": "test-dur-gap",
            "observable": "DISTANCE",
            "predicate": { "operator": "<", "threshold_value": 4.0, "unit": "A" },
            "temporal": { "operator": "FOR", "min_duration_ps": 200.0 }
        },
        "semantics": {
            "sampling_semantics": { "mode": "sampled_frames", "dt_ps": 10.0 },
            "pbc_semantics": { "mode": "orthorhombic_minimum_image" }
        },
        "quantifier": "DURATION",
        "evidence": {
            "inspected_block_bounds": [
                { "block_id": 0, "frame_start": 0, "frame_end_exclusive": 10, "lower_bound": 2.0, "upper_bound": 3.0, "status": "TRUE" },
                { "block_id": 1, "frame_start": 20, "frame_end_exclusive": 30, "lower_bound": 2.0, "upper_bound": 3.0, "status": "TRUE" }
            ]
        },
        "resources": {
            "source_compressed_bytes_fetched": 1000,
            "compressed_frames_decoded": 100,
            "coordinates_materialized": 300,
            "atoms_analyzed": 2,
            "index_bytes_read": 128,
            "wall_time_seconds": 0.05,
            "peak_memory_bytes": 10485760
        }
    }
    try:
        verify_certificate(dur_cert_gap, verify_hashes=False)
        assert False, "Should have failed due to gap in duration"
    except MOCSVerificationError:
        pass
    print("  [PASS] Duration Verifier Contiguity & Gap Rejection")

    # Hybrid Array Acceleration Layer Verification (JAX + NumPy + CuPy)
    opt_backend = detect_optimal_backend("auto")
    assert opt_backend in (BackendType.NUMPY.value, BackendType.CUPY.value, BackendType.JAX.value)
    arr_mod = get_array_module()
    assert hasattr(arr_mod, "ndarray") or hasattr(arr_mod, "Array")

    test_coords = np.array([
        [[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]],
        [[0.5, 1.5, 2.5], [3.5, 4.5, 5.5]]
    ], dtype=np.float64) # shape (2, 2, 3)
    min_b, max_b = batch_compute_aabb(test_coords)
    assert np.allclose(min_b, [0.5, 1.5, 2.5])
    assert np.allclose(max_b, [4.0, 5.0, 6.0])

    aabb_1 = (np.array([0.0, 0.0, 0.0]), np.array([1.0, 1.0, 1.0]))
    aabb_2 = (np.array([3.0, 0.0, 0.0]), np.array([4.0, 1.0, 1.0]))
    box_dims = np.array([10.0, 10.0, 10.0])
    L_batch, U_batch = batch_derive_pairwise_bounds(aabb_1, aabb_2, box_dims)
    L_scalar, U_scalar = compute_pbc_bounds(aabb_1, aabb_2, box_dims)
    assert np.isclose(float(L_batch), L_scalar)
    assert np.isclose(float(U_batch), U_scalar)
    print(f"  [PASS] Hybrid Array Dispatcher ({opt_backend.upper()}) & Batch Vectorized PBC Bounds")

    print("\nAll Modular Package Invariants Verified Successfully!")

if __name__ == "__main__":
    test_modular_package()

