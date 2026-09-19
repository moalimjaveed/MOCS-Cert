"""Pass 37: Block Partition Coverage & Non-Overlap Invariant Audit.

Verifies:
1. Complete Frame Coverage: UNION(block_ranges) == [0, N)
2. Non-Overlap Invariant: block_i INTERSECTION block_j == empty for all i != j
3. Half-Open Semantics: [f_start, f_end_exclusive)
4. Edge cases: N=0, N=1, N=2, N % block_size != 0, block_size=1, block_size > N
"""

import pytest
import math
from typing import List, Tuple


def compute_canonical_partitions(total_frames: int, block_size: int) -> List[Tuple[int, int]]:
    """Calculates canonical half-open block partitions [start, end)."""
    if total_frames <= 0 or block_size <= 0:
        return []
    n_blocks = math.ceil(total_frames / block_size)
    partitions = []
    for b_id in range(n_blocks):
        fs = b_id * block_size
        fe = min(fs + block_size, total_frames)
        partitions.append((fs, fe))
    return partitions


def verify_partition_invariants(total_frames: int, block_size: int, partitions: List[Tuple[int, int]]):
    """Rigorous invariant checks for block partitioning."""
    if total_frames == 0:
        assert len(partitions) == 0
        return

    # 1. Non-empty blocks
    for idx, (s, e) in enumerate(partitions):
        assert s < e, f"Block {idx} has invalid range: [{s}, {e})"
        assert s >= 0 and e <= total_frames, f"Block {idx} range out of bounds: [{s}, {e}) not in [0, {total_frames})"

    # 2. Sequential contiguity: partitions[i][1] == partitions[i+1][0]
    for idx in range(len(partitions) - 1):
        curr_e = partitions[idx][1]
        next_s = partitions[idx + 1][0]
        assert curr_e == next_s, (
            f"Gap or overlap between block {idx} and {idx+1}: block {idx} ends at {curr_e}, block {idx+1} starts at {next_s}"
        )

    # 3. Complete coverage: UNION(partitions) == set(range(total_frames))
    covered_frames = set()
    for s, e in partitions:
        block_set = set(range(s, e))
        # 4. Pairwise disjoint
        intersection = covered_frames.intersection(block_set)
        assert len(intersection) == 0, f"Overlap detected: frames {intersection} present in multiple blocks!"
        covered_frames.update(block_set)

    expected_frames = set(range(total_frames))
    assert covered_frames == expected_frames, (
        f"Coverage mismatch: missing={expected_frames - covered_frames}, excess={covered_frames - expected_frames}"
    )


class TestBlockPartitionAudit:
    """Verifies partition invariants across standard and edge-case trajectory lengths."""

    @pytest.mark.parametrize("N, B", [
        (500, 10),      # Standard synth_500f
        (50, 10),       # Standard synth_50f
        (0, 10),        # Empty trajectory
        (1, 10),        # Single frame, block_size > N
        (2, 10),        # 2 frames, block_size > N
        (13, 5),        # N % B != 0 (13 = 5 + 5 + 3)
        (7, 1),         # Block size 1 (every frame is its own block)
        (1, 1),         # Single frame, single block
        (100, 33),      # Non-power-of-two (33 + 33 + 33 + 1)
        (1000, 64),     # 1000 frames with 64-frame blocks
    ])
    def test_partition_invariants(self, N, B):
        partitions = compute_canonical_partitions(N, B)
        verify_partition_invariants(N, B, partitions)

    def test_production_mci_partition_matches_invariants(self):
        """Audits production MCI reader block partitions for synth_500f."""
        from backend.app.core.compiler_service import CompilerService
        cs = CompilerService()
        query = "FIND resname ALA and name CA WITHIN 12.0 A OF resname LIG and name O2"
        exec_res = cs.execute(query, "tests/data/synth_500f.xtc")

        evaluated_blocks = exec_res.certificate["evidence"]["inspected_block_bounds"]
        partitions = [(b["frame_start"], b["frame_end_exclusive"]) for b in evaluated_blocks]

        verify_partition_invariants(500, 10, partitions)
