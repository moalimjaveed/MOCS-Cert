"""MCI Binary Index Writer with Crash-Safe Persistence (MCI_SPEC.md §4-§5)."""

from __future__ import annotations
import os
import json
import struct
import hashlib
from typing import Dict, List, Optional, Any
import numpy as np

from mocs.io.source import TrajectorySource
from mocs.mci.records import (
    AABBBlockRecord,
    RECORD_SIZE_BYTES,
    KDOP14BlockRecord,
    KDOP14_RECORD_SIZE_BYTES,
    MCI_MAGIC,
    FORMAT_AABB,
    FORMAT_KDOP14,
    MCI_HEADER_SIZE,
)
from mocs.bounds.kdop import KDOP14

def compute_file_sha256(filepath: str) -> str:
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(1024 * 1024):
            hasher.update(chunk)
    return hasher.hexdigest()

class MCIWriter:
    """
    Constructs and persists a Molecular Certificate Index (MCI) on disk.
    Enforces record alignment (64-byte for AABB, 128-byte for KDOP14),
    Merkle tree commitments, and atomic commits.
    """

    @staticmethod
    def build_index(
        source: TrajectorySource,
        atom_groups: Dict[int, np.ndarray],  # group_id -> atom_indices
        output_dir: str,
        block_size: int = 10,
        trajectory_id: str = "trajectory.xtc",
        topology_id: str = "topology.gro",
        bounding_model: str = "AABB"
    ) -> Dict[str, Any]:
        """
        Builds the Level 1 binary block index for the given trajectory, atom groups,
        and bounding model ('AABB' or 'KDOP14').
        """
        os.makedirs(output_dir, exist_ok=True)

        is_kdop = (bounding_model.upper() == "KDOP14")
        rec_size = KDOP14_RECORD_SIZE_BYTES if is_kdop else RECORD_SIZE_BYTES
        format_tag = "KDOP14-L1-BINARY-128" if is_kdop else "AABB-L1-BINARY-64"

        total_frames = source.get_total_frames()
        timestep_ps = source.get_timestep_ps()
        box = source.get_box()

        # Calculate block ranges
        num_blocks = (total_frames + block_size - 1) // block_size
        block_records = []
        block_hashes: List[str] = []

        blocks_bin_tmp = os.path.join(output_dir, "blocks.bin.tmp")
        offsets_bin_tmp = os.path.join(output_dir, "frame_offsets.bin.tmp")

        # Open temporary binary files
        with open(blocks_bin_tmp, "wb") as f_blocks, open(offsets_bin_tmp, "wb") as f_offsets:
            # Write 12-byte format discrimination header (F-052)
            fmt_code = FORMAT_KDOP14 if is_kdop else FORMAT_AABB
            f_blocks.write(MCI_MAGIC + struct.pack("<I", fmt_code))
            current_byte_offset = MCI_HEADER_SIZE

            for group_id, atom_indices in atom_groups.items():
                for b_idx in range(num_blocks):
                    f_start = b_idx * block_size
                    f_end = min(total_frames, (b_idx + 1) * block_size)

                    # Materialize coordinates for this block slice
                    coords = source.read_block_coordinates(f_start, f_end, atom_indices)

                    if is_kdop:
                        kdop = KDOP14.from_coordinates(coords)
                        rec = KDOP14BlockRecord.from_projections(
                            atom_group_id=group_id,
                            block_id=b_idx,
                            frame_start=f_start,
                            frame_end_exclusive=f_end,
                            min_projections=kdop.min_projections,
                            max_projections=kdop.max_projections,
                        )
                    else:
                        # Compute AABB extrema across all atoms in group and all frames in block
                        x_min = float(np.min(coords[..., 0]))
                        x_max = float(np.max(coords[..., 0]))
                        y_min = float(np.min(coords[..., 1]))
                        y_max = float(np.max(coords[..., 1]))
                        z_min = float(np.min(coords[..., 2]))
                        z_max = float(np.max(coords[..., 2]))

                        rec = AABBBlockRecord(
                            atom_group_id=group_id,
                            block_id=b_idx,
                            frame_start=f_start,
                            frame_end_exclusive=f_end,
                            x_min=x_min,
                            x_max=x_max,
                            y_min=y_min,
                            y_max=y_max,
                            z_min=z_min,
                            z_max=z_max
                        )

                    packed = rec.pack()
                    f_blocks.write(packed)
                    block_records.append(rec)
                    block_hashes.append(rec.compute_sha256())

                    # Write offset seek table: 8-byte uint64 byte offset
                    f_offsets.write(np.uint64(current_byte_offset).tobytes())
                    current_byte_offset += rec_size

            # Force persistence to disk
            f_blocks.flush()
            os.fsync(f_blocks.fileno())
            f_offsets.flush()
            os.fsync(f_offsets.fileno())

        # Atomic rename
        blocks_bin = os.path.join(output_dir, "blocks.bin")
        offsets_bin = os.path.join(output_dir, "frame_offsets.bin")
        os.replace(blocks_bin_tmp, blocks_bin)
        os.replace(offsets_bin_tmp, offsets_bin)

        blocks_sha256 = compute_file_sha256(blocks_bin)
        offsets_sha256 = compute_file_sha256(offsets_bin)

        # Compute Merkle tree root over all block hashes
        merkle_hasher = hashlib.sha256()
        for bh in block_hashes:
            merkle_hasher.update(bh.encode("ascii"))
        merkle_root = merkle_hasher.hexdigest()

        manifest = {
            "mci_version": "0.1.0",
            "format": format_tag,
            "bounding_model": "KDOP14" if is_kdop else "AABB",
            "record_size_bytes": rec_size,
            "trajectory_id": trajectory_id,
            "trajectory_sha256": source.get_file_sha256(),
            "topology_id": topology_id,
            "topology_sha256": source.get_topology_sha256(),
            "total_frames": total_frames,
            "block_size_frames": block_size,
            "num_blocks_per_group": num_blocks,
            "num_atom_groups": len(atom_groups),
            "atom_groups": {str(gid): idxs.tolist() for gid, idxs in atom_groups.items()},
            "box_dimensions_angstrom": box.tolist(),
            "timestep_ps": timestep_ps,
            "files": {
                "blocks_bin": {
                    "path": "blocks.bin",
                    "size_bytes": os.path.getsize(blocks_bin),
                    "sha256": blocks_sha256
                },
                "frame_offsets_bin": {
                    "path": "frame_offsets.bin",
                    "size_bytes": os.path.getsize(offsets_bin),
                    "sha256": offsets_sha256
                }
            },
            "merkle_root": merkle_root
        }

        # Canonical JSON commitment digest
        canonical_json = json.dumps(manifest, sort_keys=True)
        mci_index_hash = hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()
        manifest["mci_index_hash"] = mci_index_hash

        # Write manifest atomically
        manifest_tmp = os.path.join(output_dir, "manifest.json.tmp")
        manifest_final = os.path.join(output_dir, "manifest.json")
        with open(manifest_tmp, "w", encoding="utf-8") as f:
            f.write(json.dumps(manifest, indent=2, sort_keys=True))
            f.flush()
            os.fsync(f.fileno())
        os.replace(manifest_tmp, manifest_final)

        return manifest
