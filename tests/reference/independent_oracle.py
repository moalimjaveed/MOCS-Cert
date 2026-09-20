"""
Independent Clean-Room Trajectory Reference Oracle (PASS 36).

CRITICAL ARCHITECTURAL CONSTRAINTS:
1. DO NOT import any MOCS modules (mocs.bounds, mocs.io, mocs.session, etc.).
2. DO NOT call production query executors or compilers.
3. DO NOT use intermediate values or heuristics from MOCS.
4. Purpose is transparent, provably correct, un-optimized mathematical ground truth.
"""

from __future__ import annotations
import numpy as np
from typing import Dict, Any, List, Optional, Tuple, Union

try:
    import MDAnalysis as mda
except ImportError:
    mda = None


class IndependentReferenceOracle:
    """
    Intentionally simple, transparent trajectory evaluator using pure NumPy.
    """

    def __init__(self, coordinates: np.ndarray, box_dimensions: np.ndarray):
        """
        coordinates: Shape (n_frames, n_atoms, 3) float64
        box_dimensions: Shape (n_frames, 3) or (3,) float64 (orthorhombic Lx, Ly, Lz)
        """
        assert coordinates.ndim == 3, f"Coordinates must be (n_frames, n_atoms, 3), got {coordinates.shape}"
        assert coordinates.shape[2] == 3, "Coordinate 3rd dimension must be 3"
        self.coords = np.asarray(coordinates, dtype=np.float64)
        self.n_frames, self.n_atoms, _ = self.coords.shape

        boxes = np.asarray(box_dimensions, dtype=np.float64)
        if boxes.ndim == 1:
            assert boxes.shape == (3,), "Box dimensions 1D array must have shape (3,)"
            self.boxes = np.tile(boxes, (self.n_frames, 1))
        elif boxes.ndim == 2:
            assert boxes.shape == (self.n_frames, 3), f"Box dimensions must be ({self.n_frames}, 3)"
            self.boxes = boxes
        else:
            raise ValueError(f"Invalid box dimension shape: {boxes.shape}")

        if np.any(self.boxes <= 0):
            raise ValueError("All simulation box dimensions must be strictly positive.")

    @classmethod
    def from_trajectory_files(
        cls,
        topology_path: str,
        trajectory_path: str
    ) -> IndependentReferenceOracle:
        """Loads coordinates and boxes directly using raw MDAnalysis iteration."""
        if mda is None:
            raise ImportError("MDAnalysis required to load trajectory files.")

        u = mda.Universe(topology_path, trajectory_path)
        n_frames = len(u.trajectory)
        n_atoms = len(u.atoms)

        coords = np.zeros((n_frames, n_atoms, 3), dtype=np.float64)
        boxes = np.zeros((n_frames, 3), dtype=np.float64)

        for f_idx, ts in enumerate(u.trajectory):
            coords[f_idx] = ts.positions
            box = ts.dimensions[:3]
            if box is None or np.any(box <= 0):
                raise ValueError(f"Frame {f_idx} has invalid box dimensions: {box}")
            boxes[f_idx] = box

        return cls(coords, boxes)

    def compute_frame_pairwise_min_distance(
        self,
        indices_a: np.ndarray,
        indices_b: np.ndarray,
        frame_idx: int
    ) -> float:
        """
        Computes exact minimum Euclidean distance between two atom groups in a single frame
        under minimum-image periodic boundary conditions:
            min_{i in A, j in B} || r_i - r_j ||_PBC
        """
        assert 0 <= frame_idx < self.n_frames, f"Frame {frame_idx} out of range [0, {self.n_frames})"
        idx_a = np.asarray(indices_a, dtype=np.int64)
        idx_b = np.asarray(indices_b, dtype=np.int64)

        if len(idx_a) == 0 or len(idx_b) == 0:
            raise ValueError("Atom selection indices must not be empty.")

        pos_a = self.coords[frame_idx, idx_a, :]  # (len_a, 3)
        pos_b = self.coords[frame_idx, idx_b, :]  # (len_b, 3)
        box = self.boxes[frame_idx]                # (3,)

        # Compute all pairwise differences: pos_a[i] - pos_b[j]
        # Shape: (len_a, len_b, 3)
        diff = pos_a[:, np.newaxis, :] - pos_b[np.newaxis, :, :]

        # Apply minimum-image convention: delta -= box * round(delta / box)
        diff -= box * np.round(diff / box)

        # Pairwise Euclidean distances: shape (len_a, len_b)
        pair_dists = np.linalg.norm(diff, axis=-1)

        return float(np.min(pair_dists))

    def compute_trajectory_distances(
        self,
        indices_a: np.ndarray,
        indices_b: np.ndarray,
        start_frame: int = 0,
        end_frame: Optional[int] = None
    ) -> np.ndarray:
        """
        Computes minimum pairwise distance for every frame in [start_frame, end_frame).
        Returns 1D np.ndarray of shape (end_frame - start_frame,).
        """
        if end_frame is None:
            end_frame = self.n_frames

        assert 0 <= start_frame < end_frame <= self.n_frames, f"Invalid frame range [{start_frame}, {end_frame})"
        n_eval_frames = end_frame - start_frame
        dists = np.zeros(n_eval_frames, dtype=np.float64)

        for i, f in enumerate(range(start_frame, end_frame)):
            dists[i] = self.compute_frame_pairwise_min_distance(indices_a, indices_b, f)

        return dists

    def evaluate_predicate(
        self,
        indices_a: np.ndarray,
        indices_b: np.ndarray,
        operator: str,
        threshold: float,
        start_frame: int = 0,
        end_frame: Optional[int] = None,
        float_epsilon: float = 1e-9
    ) -> np.ndarray:
        """
        Evaluates predicate frame-by-frame directly.
        Operators supported: '<', '<=', '>', '>=', '=='
        Returns boolean array of shape (end_frame - start_frame,).
        """
        dists = self.compute_trajectory_distances(indices_a, indices_b, start_frame, end_frame)

        if operator == "<":
            return dists < threshold
        elif operator == "<=":
            return dists <= threshold
        elif operator == ">":
            return dists > threshold
        elif operator == ">=":
            return dists >= threshold
        elif operator == "==":
            return np.abs(dists - threshold) < float_epsilon
        else:
            raise ValueError(f"Unsupported operator in reference oracle: {operator}")

    def evaluate_quantifier(
        self,
        indices_a: np.ndarray,
        indices_b: np.ndarray,
        operator: str,
        threshold: float,
        quantifier: str,
        start_frame: int = 0,
        end_frame: Optional[int] = None,
        min_duration_frames: int = 1
    ) -> Tuple[bool, List[Tuple[int, int]]]:
        """
        Evaluates quantifier over predicate frame results.
        quantifier: 'EXISTS', 'FORALL', 'DURATION'
        Returns (result: bool, witness_intervals: List[Tuple[int, int]])
        """
        frame_flags = self.evaluate_predicate(indices_a, indices_b, operator, threshold, start_frame, end_frame)
        if end_frame is None:
            end_frame = self.n_frames

        if quantifier == "EXISTS":
            res = bool(np.any(frame_flags))
            witnesses = []
            if res:
                # Find all contiguous intervals of True
                in_run = False
                run_start = 0
                for k, flag in enumerate(frame_flags):
                    abs_frame = start_frame + k
                    if flag and not in_run:
                        in_run = True
                        run_start = abs_frame
                    elif not flag and in_run:
                        in_run = False
                        witnesses.append((run_start, abs_frame))
                if in_run:
                    witnesses.append((run_start, end_frame))
            return res, witnesses

        elif quantifier == "FORALL":
            res = bool(np.all(frame_flags))
            witnesses = [(start_frame, end_frame)] if res else []
            return res, witnesses

        elif quantifier == "DURATION":
            assert min_duration_frames >= 1, "min_duration_frames must be >= 1"
            # Find runs of length >= min_duration_frames
            witnesses = []
            in_run = False
            run_start = 0
            for k, flag in enumerate(frame_flags):
                abs_frame = start_frame + k
                if flag and not in_run:
                    in_run = True
                    run_start = abs_frame
                elif not flag and in_run:
                    in_run = False
                    if (abs_frame - run_start) >= min_duration_frames:
                        witnesses.append((run_start, abs_frame))
            if in_run:
                if (end_frame - run_start) >= min_duration_frames:
                    witnesses.append((run_start, end_frame))

            return len(witnesses) > 0, witnesses

        else:
            raise ValueError(f"Unsupported quantifier in reference oracle: {quantifier}")
