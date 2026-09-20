"""Adversarial Fuzzing & Coordinate Transformations."""

import numpy as np

def apply_fuzz_transformations(coords: np.ndarray, box: np.ndarray) -> np.ndarray:
    """
    Applies rigid transformation + bounded noise to coordinates.
    All pairwise distances under minimum-image must remain invariant.
    """
    shift = np.random.uniform(0, box, size=(1, 3))
    transformed = (coords + shift) % box

    axes_perm = np.random.permutation([0, 1, 2])
    transformed = transformed[:, axes_perm]

    noise = np.random.normal(0.0, 1e-5, size=transformed.shape)
    transformed += noise
    return transformed
