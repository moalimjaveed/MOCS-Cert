"""Hostile Audit - Section 8: Adversarial PBC Bounding Tests.

Rigorously tests:
1. Opposite box faces (x1 ~ 0, x2 ~ L)
2. Coordinates exactly at 0.0 and L
3. Half-box separation (delta = L / 2)
4. AABB crossing periodic boundary
5. Minimum-image tie cases
6. Large envelopes (>= L/2) triggering safe conservative fallbacks
7. Degenerate envelopes (single points, zero volume)

Invariant: L <= exact_distance <= U + eps must hold for all cases.
"""

import math
import sys
import numpy as np
import pytest
sys.path.insert(0, ".")
from mocs.bounds.periodic_bounds import compute_pbc_bounds, minimum_image_displacement

def exact_pbc_distance(p1: np.ndarray, p2: np.ndarray, box: np.ndarray) -> float:
    delta = p2 - p1
    delta -= box * np.round(delta / box)
    return float(np.linalg.norm(delta))

def test_opposite_box_faces():
    box = np.array([100.0, 100.0, 100.0])
    # Points near opposite faces
    p1 = np.array([0.01, 50.0, 50.0])
    p2 = np.array([99.99, 50.0, 50.0])
    
    aabb_a = (p1 - 0.05, p1 + 0.05)
    aabb_b = (p2 - 0.05, p2 + 0.05)
    
    L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
    exact = exact_pbc_distance(p1, p2, box)
    
    assert L <= exact + 1e-7, f"Lower bound violation: L={L} > exact={exact}"
    assert exact <= U + 1e-7, f"Upper bound violation: exact={exact} > U={U}"

def test_coordinates_at_zero_and_L():
    box = np.array([80.0, 80.0, 80.0])
    p1 = np.array([0.0, 0.0, 0.0])
    p2 = np.array([80.0, 80.0, 80.0]) # same periodic image!
    
    aabb_a = (p1, p1)
    aabb_b = (p2, p2)
    
    L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
    exact = exact_pbc_distance(p1, p2, box)
    
    assert exact == 0.0
    assert L <= exact + 1e-7
    assert exact <= U + 1e-7

def test_half_box_separation_tie():
    box = np.array([60.0, 60.0, 60.0])
    # Exactly half-box separation: delta = 30.0
    p1 = np.array([10.0, 20.0, 30.0])
    p2 = np.array([40.0, 20.0, 30.0]) # delta_x = 30.0 = box/2
    
    aabb_a = (p1 - 1.0, p1 + 1.0)
    aabb_b = (p2 - 1.0, p2 + 1.0)
    
    L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
    exact = exact_pbc_distance(p1, p2, box)
    
    assert L <= exact + 1e-7
    assert exact <= U + 1e-7

def test_degenerate_zero_volume_envelopes():
    box = np.array([50.0, 50.0, 50.0])
    p1 = np.array([12.34, 23.45, 34.56])
    p2 = np.array([45.67, 12.34, 23.45])
    
    aabb_a = (p1, p1)
    aabb_b = (p2, p2)
    
    L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
    exact = exact_pbc_distance(p1, p2, box)
    
    assert abs(L - exact) < 1e-6
    assert abs(U - exact) < 1e-6

def test_large_envelopes_safe_fallback():
    box = np.array([50.0, 50.0, 50.0])
    # AABB radius is >= 25.0 (half-box)
    aabb_a = (np.array([0.0, 0.0, 0.0]), np.array([30.0, 30.0, 30.0]))
    aabb_b = (np.array([20.0, 20.0, 20.0]), np.array([49.0, 49.0, 49.0]))
    
    L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
    assert L == 0.0, "Large envelope must conservatively set lower bound to 0.0"
    max_possible_dist = 0.5 * math.sqrt(3 * (50.0 ** 2))
    assert U <= max_possible_dist + 1e-7

def test_randomized_pbc_bounding_invariants():
    np.random.seed(42)
    box = np.array([75.0, 80.0, 85.0])
    
    for _ in range(500):
        # Pick two random points
        p1 = np.random.uniform(0.0, box)
        p2 = np.random.uniform(0.0, box)
        
        # Random radius up to 10.0 A
        r1 = np.random.uniform(0.0, 5.0, size=3)
        r2 = np.random.uniform(0.0, 5.0, size=3)
        
        aabb_a = (p1 - r1, p1 + r1)
        aabb_b = (p2 - r2, p2 + r2)
        
        L, U = compute_pbc_bounds(aabb_a, aabb_b, box)
        
        # Test random sample points inside the AABBs
        for _ in range(10):
            sample_a = np.random.uniform(aabb_a[0], aabb_a[1])
            sample_b = np.random.uniform(aabb_b[0], aabb_b[1])
            exact = exact_pbc_distance(sample_a, sample_b, box)
            
            assert L <= exact + 1e-6, f"Soundness violation: L={L} > exact={exact}"
            assert exact <= U + 1e-6, f"Soundness violation: exact={exact} > U={U}"

if __name__ == "__main__":
    test_opposite_box_faces()
    test_coordinates_at_zero_and_L()
    test_half_box_separation_tie()
    test_degenerate_zero_volume_envelopes()
    test_large_envelopes_safe_fallback()
    test_randomized_pbc_bounding_invariants()
    print("[SECTION 8: ADVERSARIAL PBC BOUNDING TESTS COMPLETE (PASS)]")
