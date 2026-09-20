"""Differential oracle tests comparing MOCS execution against brute force ground truth."""

import os
import pytest
import numpy as np
from mocs.bounds.periodic_bounds import compute_pbc_bounds
from mocs.reference.distance import reference_distance
from mocs.certificates.auditor import diff_against_reference
from backend.app.core.compiler_service import compiler_service

def test_aabb_pbc_differential_soundness_oracle():
    """Differential oracle test with 1,000 randomized configurations."""
    np.random.seed(42)
    oracle_cases = 1000
    violations = 0

    for _ in range(oracle_cases):
        box = np.random.uniform(20.0, 100.0, size=3)
        ca = np.random.uniform(0.0, box)
        cb = np.random.uniform(0.0, box)
        ra = np.random.uniform(0.1, 4.0, size=3)
        rb = np.random.uniform(0.1, 4.0, size=3)

        aabb_a = (ca - ra, ca + ra)
        aabb_b = (cb - rb, cb + rb)

        L, U = compute_pbc_bounds(aabb_a, aabb_b, box)

        # 100 sample points inside boxes
        pa = ca + np.random.uniform(-ra, ra, size=(100, 3))
        pb = cb + np.random.uniform(-rb, rb, size=(100, 3))

        delta = pb - pa
        delta -= box * np.round(delta / box)
        dists = np.sqrt(np.sum(delta**2, axis=1))

        min_d = np.min(dists)
        max_d = np.max(dists)

        if min_d < L - 1e-7 or max_d > U + 1e-7:
            violations += 1

    assert violations == 0, f"Found {violations} AABB PBC soundness violations!"

def test_full_pipeline_against_reference_oracle():
    """Runs query execution and validates certificate truth value against reference evaluator."""
    gro_path = "tests/data/synth_500f.gro"
    xtc_path = "tests/data/synth_500f.xtc"
    if not os.path.exists(gro_path) or not os.path.exists(xtc_path):
        pytest.skip("Fixture synth_500f not found.")

    # 1. Reference ground truth for DISTANCE < 4.0 A
    ref_dists = reference_distance(gro_path, xtc_path, "name CA", "name O2")
    has_contact = np.any(ref_dists < 4.0)
    expected_truth = "TRUE" if has_contact else "FALSE"

    # 2. MOCS Execution
    exec_res = compiler_service.execute("DISTANCE(name CA, name O2) < 4.0 A")
    mocs_truth = exec_res.truth_value

    is_sound, msg = diff_against_reference(mocs_truth, exec_res.resolution_status, expected_truth)
    assert is_sound, f"Oracle mismatch: {msg}"
    assert mocs_truth == expected_truth
