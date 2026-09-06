"""Property-based testing using Hypothesis for geometric and interval invariants."""

import math
import numpy as np
import pytest
from hypothesis import given, settings, strategies as st
from mocs.bounds.periodic_bounds import compute_pbc_bounds, verify_refinement_non_expansion

@given(
    box_x=st.floats(min_value=20.0, max_value=100.0),
    box_y=st.floats(min_value=20.0, max_value=100.0),
    box_z=st.floats(min_value=20.0, max_value=100.0),
    ax=st.floats(min_value=0.0, max_value=20.0),
    ay=st.floats(min_value=0.0, max_value=20.0),
    az=st.floats(min_value=0.0, max_value=20.0),
    bx=st.floats(min_value=0.0, max_value=20.0),
    by=st.floats(min_value=0.0, max_value=20.0),
    bz=st.floats(min_value=0.0, max_value=20.0),
    r=st.floats(min_value=0.1, max_value=3.0)
)
@settings(max_examples=100)
def test_hypothesis_pbc_containment(box_x, box_y, box_z, ax, ay, az, bx, by, bz, r):
    box = np.array([box_x, box_y, box_z])
    ca = np.array([ax, ay, az])
    cb = np.array([bx, by, bz])

    aabb_a = (ca - r, ca + r)
    aabb_b = (cb - r, cb + r)

    L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
    assert L <= U + 1e-7

    # Center distance under PBC
    delta = cb - ca
    delta -= box * np.round(delta / box)
    center_d = np.linalg.norm(delta)

    # Center point distance must be bounded within [L, U]
    assert center_d >= L - 1e-7
    assert center_d <= U + 1e-7

@given(
    L_p=st.floats(min_value=0.0, max_value=50.0),
    span_p=st.floats(min_value=1.0, max_value=20.0),
    dL=st.floats(min_value=0.0, max_value=0.5),
    dU=st.floats(min_value=0.0, max_value=0.5)
)
def test_hypothesis_refinement_monotonicity(L_p, span_p, dL, dU):
    U_p = L_p + span_p
    # Valid child is strictly contained within [L_p, U_p]
    L_c = L_p + dL
    U_c = U_p - dU
    if L_c <= U_c:
        assert verify_refinement_non_expansion((L_p, U_p), (L_c, U_c))

    # An invalid child with expanded upper bound must be rejected
    if dU > 0.01:
        invalid_U = U_p + dU
        assert not verify_refinement_non_expansion((L_p, U_p), (L_c, invalid_U))
