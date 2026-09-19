"""Hostile Audit - Section 9: Refinement Monotonicity Adversarial Test.

Rigorously verifies:
1. L_child >= L_parent - eps
2. U_child <= U_parent + eps
3. all exact child observations in child interval [L_child, U_child]
4. child interval [L_child, U_child] subset of parent interval [L_parent, U_parent]
5. 0 violations across 100 random trajectory subdivisions.
"""

import math
import sys
import numpy as np
import pytest
sys.path.insert(0, ".")

from mocs.bounds.periodic_bounds import compute_pbc_bounds, verify_refinement_non_expansion

def exact_pbc_distance(p1: np.ndarray, p2: np.ndarray, box: np.ndarray) -> float:
    delta = p2 - p1
    delta -= box * np.round(delta / box)
    return float(np.linalg.norm(delta))

def test_random_refinements():
    np.random.seed(123)
    box = np.array([80.0, 80.0, 80.0])
    eps = 1e-6
    
    total_refinements = 100
    violations = 0
    
    for trial in range(total_refinements):
        n_frames = np.random.randint(10, 50)
        
        # Generate random smooth trajectory for 2 atoms
        coords_a = np.zeros((n_frames, 3))
        coords_b = np.zeros((n_frames, 3))
        
        start_a = np.random.uniform(10.0, 70.0, size=3)
        start_b = np.random.uniform(10.0, 70.0, size=3)
        
        step_a = np.random.normal(0.0, 0.5, size=(n_frames, 3))
        step_b = np.random.normal(0.0, 0.5, size=(n_frames, 3))
        
        coords_a = start_a + np.cumsum(step_a, axis=0)
        coords_b = start_b + np.cumsum(step_b, axis=0)
        
        # Parent AABB over entire slice [0, n_frames)
        parent_aabb_a = (np.min(coords_a, axis=0), np.max(coords_a, axis=0))
        parent_aabb_b = (np.min(coords_b, axis=0), np.max(coords_b, axis=0))
        L_p, U_p = compute_pbc_bounds(parent_aabb_a, parent_aabb_b, box)
        
        # Subdivide into 2 or 3 children blocks
        split_idx = n_frames // 2
        slices = [(0, split_idx), (split_idx, n_frames)]
        
        for fs, fe in slices:
            child_coords_a = coords_a[fs:fe]
            child_coords_b = coords_b[fs:fe]
            
            child_aabb_a = (np.min(child_coords_a, axis=0), np.max(child_coords_a, axis=0))
            child_aabb_b = (np.min(child_coords_b, axis=0), np.max(child_coords_b, axis=0))
            
            L_c, U_c = compute_pbc_bounds(child_aabb_a, child_aabb_b, box)
            
            # Condition 1 & 2: Monotonic non-expansion
            if not verify_refinement_non_expansion((L_p, U_p), (L_c, U_c), epsilon=eps):
                violations += 1
                print(f"Violation in trial {trial}: Parent [{L_p:.4f}, {U_p:.4f}], Child [{L_c:.4f}, {U_c:.4f}]")
                
            # Condition 3: All exact child observations in child interval
            for f in range(fs, fe):
                exact_dist = exact_pbc_distance(coords_a[f], coords_b[f], box)
                assert L_c <= exact_dist + eps, f"Soundness violation: L_c={L_c} > exact={exact_dist}"
                assert exact_dist <= U_c + eps, f"Soundness violation: exact={exact_dist} > U_c={U_c}"
                
            # Condition 4: Child interval subset of parent interval (with epsilon)
            assert L_c >= L_p - eps, f"Monotonicity error: L_c={L_c} < L_p={L_p}"
            assert U_c <= U_p + eps, f"Monotonicity error: U_c={U_c} > U_p={U_p}"
            
    assert violations == 0, f"Refinement monotonicity failed with {violations} violations!"
    print(f"[SECTION 9: REFINEMENT ADVERSARIAL TEST COMPLETE — {total_refinements} REFINEMENTS, 0 VIOLATIONS (PASS)]")

if __name__ == "__main__":
    test_random_refinements()
