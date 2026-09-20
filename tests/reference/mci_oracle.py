"""Independent Block-Level Exhaustive Oracle for MCI and Pruning Soundness Verification.

CLEAN-ROOM INDEPENDENT ORACLE:
This module contains ZERO imports from production MOCS packages (mocs, backend).
It uses only standard scientific libraries (NumPy, MDAnalysis) to exhaustively
evaluate raw coordinates frame-by-frame and determine exact ground truth
for every block in a trajectory.
"""

from __future__ import annotations
import math
from dataclasses import dataclass
from typing import List, Tuple, Dict, Any, Optional
import numpy as np
import MDAnalysis as mda


@dataclass(frozen=True)
class BlockOracleRecord:
    """Exact ground-truth assessment of an MCI block compared against production."""
    block_id: int
    frame_start: int
    frame_end: int
    exact_truth: str  # 'TRUE', 'FALSE', or 'UNKNOWN'
    min_dist_actual: float
    max_dist_actual: float
    witness_present: bool
    witness_count: int
    production_classification: Optional[str] = None
    pruned: Optional[bool] = None
    refined: Optional[bool] = None
    sound: Optional[bool] = None
    violation_reason: Optional[str] = None


class MCIIndependentOracle:
    """Exhaustive, ground-truth oracle for block-level trajectory queries."""

    def __init__(self, topo_path: str, traj_path: str):
        self.topo_path = topo_path
        self.traj_path = traj_path
        self.universe = mda.Universe(topo_path, traj_path)
        self.n_frames = len(self.universe.trajectory)
        self.box = self.universe.dimensions[:3] if self.universe.dimensions is not None else None

    @staticmethod
    def _minimum_image_distance(p1: np.ndarray, p2: np.ndarray, box: np.ndarray) -> float:
        """Exact minimum-image Cartesian distance between two points."""
        d = p1 - p2
        d -= box * np.round(d / box)
        return float(np.linalg.norm(d))

    @classmethod
    def compute_frame_min_distance(
        cls,
        coords_a: np.ndarray,
        coords_b: np.ndarray,
        box: np.ndarray
    ) -> float:
        """Computes exact minimum distance between any atom in coords_a and coords_b."""
        diff = coords_a[:, np.newaxis, :] - coords_b[np.newaxis, :, :]  # (N, M, 3)
        diff -= box * np.round(diff / box)
        dist_matrix = np.linalg.norm(diff, axis=-1)  # (N, M)
        return float(np.min(dist_matrix))

    @classmethod
    def compute_frame_max_distance(
        cls,
        coords_a: np.ndarray,
        coords_b: np.ndarray,
        box: np.ndarray
    ) -> float:
        """Computes exact maximum distance between any atom in coords_a and coords_b."""
        diff = coords_a[:, np.newaxis, :] - coords_b[np.newaxis, :, :]  # (N, M, 3)
        diff -= box * np.round(diff / box)
        dist_matrix = np.linalg.norm(diff, axis=-1)
        return float(np.max(dist_matrix))

    def evaluate_ground_truth(
        self,
        sel_a: str,
        sel_b: str,
        predicate_op: str,
        threshold: float,
        block_size: int,
        quantifier: str = "EXISTS"
    ) -> List[BlockOracleRecord]:
        """Exhaustively evaluates every block frame-by-frame on raw trajectory coordinates."""
        grp_a = self.universe.select_atoms(sel_a)
        grp_b = self.universe.select_atoms(sel_b)

        if len(grp_a) == 0:
            raise ValueError(f"Oracle: Selection A '{sel_a}' matched 0 atoms.")
        if len(grp_b) == 0:
            raise ValueError(f"Oracle: Selection B '{sel_b}' matched 0 atoms.")

        frame_min_distances: List[float] = []
        frame_max_distances: List[float] = []
        frame_predicate_truths: List[bool] = []

        for ts in self.universe.trajectory:
            box = ts.dimensions[:3] if ts.dimensions is not None else self.box
            if box is None or np.any(box <= 0):
                raise ValueError("Oracle: Invalid or non-periodic simulation box.")

            pos_a = grp_a.positions
            pos_b = grp_b.positions

            min_d = self.compute_frame_min_distance(pos_a, pos_b, box)
            max_d = self.compute_frame_max_distance(pos_a, pos_b, box)
            frame_min_distances.append(min_d)
            frame_max_distances.append(max_d)

            if predicate_op == "<=":
                is_true = (min_d <= threshold)
            elif predicate_op == "<":
                is_true = (min_d < threshold)
            elif predicate_op == ">=":
                is_true = (min_d >= threshold)
            elif predicate_op == ">":
                is_true = (min_d > threshold)
            elif predicate_op in ("==", "="):
                is_true = math.isclose(min_d, threshold, abs_tol=1e-7)
            else:
                raise ValueError(f"Oracle: Unsupported operator {predicate_op}")

            frame_predicate_truths.append(is_true)

        total_frames = len(frame_min_distances)
        num_blocks = math.ceil(total_frames / block_size)
        records: List[BlockOracleRecord] = []

        for b_id in range(num_blocks):
            f_start = b_id * block_size
            f_end = min(f_start + block_size, total_frames)

            block_min_d = min(frame_min_distances[f_start:f_end])
            block_max_d = max(frame_max_distances[f_start:f_end])
            block_truths = frame_predicate_truths[f_start:f_end]

            witnesses = [f for f, t in enumerate(block_truths, start=f_start) if t]
            witness_count = len(witnesses)

            if quantifier.upper() == "EXISTS":
                witness_present = (witness_count > 0)
                exact_truth = "TRUE" if witness_present else "FALSE"
            elif quantifier.upper() == "FORALL":
                counterexamples = len(block_truths) - witness_count
                witness_present = (counterexamples == 0)
                exact_truth = "TRUE" if witness_present else "FALSE"
            else:
                exact_truth = "UNKNOWN"
                witness_present = False

            records.append(
                BlockOracleRecord(
                    block_id=b_id,
                    frame_start=f_start,
                    frame_end=f_end,
                    exact_truth=exact_truth,
                    min_dist_actual=block_min_d,
                    max_dist_actual=block_max_d,
                    witness_present=witness_present,
                    witness_count=witness_count
                )
            )

        return records

    def audit_production_decisions(
        self,
        ground_truth: List[BlockOracleRecord],
        production_blocks: List[Dict[str, Any]],
        quantifier: str = "EXISTS"
    ) -> List[BlockOracleRecord]:
        """Compares production block decisions against exhaustive ground truth.

        Central Invariant:
        PRUNED => NO WITNESS PRESENT IN BLOCK.
        Forbidden condition: (pruned == True) and (witness_present == True).
        """
        audited_records: List[BlockOracleRecord] = []
        prod_by_id = {b.get("block_id", idx): b for idx, b in enumerate(production_blocks)}

        for gt in ground_truth:
            prod = prod_by_id.get(gt.block_id)
            if prod is None:
                audited_records.append(
                    BlockOracleRecord(
                        block_id=gt.block_id,
                        frame_start=gt.frame_start,
                        frame_end=gt.frame_end,
                        exact_truth=gt.exact_truth,
                        min_dist_actual=gt.min_dist_actual,
                        max_dist_actual=gt.max_dist_actual,
                        witness_present=gt.witness_present,
                        witness_count=gt.witness_count,
                        production_classification="MISSING",
                        pruned=True,
                        refined=False,
                        sound=False,
                        violation_reason=f"Block {gt.block_id} was completely omitted from production."
                    )
                )
                continue

            status = prod.get("status") or prod.get("classification")
            truth = prod.get("truth") or prod.get("truth_value")
            was_pruned = prod.get("pruned", False)
            was_refined = prod.get("refined", False)

            if was_pruned is None or "pruned" not in prod:
                was_pruned = (status == "CERTIFIED_FALSE") or (truth == "FALSE" and not was_refined)

            if was_refined is None or "refined" not in prod:
                was_refined = (status in ("REFINED", "EXACT_TRUE", "EXACT_FALSE", "EXACT_MIXED"))

            sound = True
            reason = None

            if quantifier.upper() == "EXISTS":
                if was_pruned and gt.witness_present:
                    sound = False
                    reason = (
                        f"SOUNDNESS VIOLATION: Block {gt.block_id} was PRUNED by production, "
                        f"but exhaustive oracle found {gt.witness_count} witnesses in frames [{gt.frame_start}, {gt.frame_end})!"
                    )
                elif status == "CERTIFIED_TRUE" and not gt.witness_present:
                    sound = False
                    reason = (
                        f"SOUNDNESS VIOLATION: Block {gt.block_id} was CERTIFIED_TRUE by production, "
                        f"but exhaustive oracle found ZERO witnesses!"
                    )
                elif status == "CERTIFIED_FALSE" and gt.witness_present:
                    sound = False
                    reason = (
                        f"SOUNDNESS VIOLATION: Block {gt.block_id} was CERTIFIED_FALSE by production, "
                        f"but exhaustive oracle found {gt.witness_count} witnesses!"
                    )

            audited_records.append(
                BlockOracleRecord(
                    block_id=gt.block_id,
                    frame_start=gt.frame_start,
                    frame_end=gt.frame_end,
                    exact_truth=gt.exact_truth,
                    min_dist_actual=gt.min_dist_actual,
                    max_dist_actual=gt.max_dist_actual,
                    witness_present=gt.witness_present,
                    witness_count=gt.witness_count,
                    production_classification=status,
                    pruned=was_pruned,
                    refined=was_refined,
                    sound=sound,
                    violation_reason=reason
                )
            )

        return audited_records
