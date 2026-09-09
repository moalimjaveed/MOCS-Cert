"""MCI Binary Index Reader with Random Access & I/O Accounting (MCI_SPEC.md §5)."""

from __future__ import annotations
import os
import json
import struct
import hashlib
import threading
from typing import Dict, List, Optional, Any, Union
import numpy as np

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
from mocs.exceptions import MOCSFileNotFoundError, MOCSDataIntegrityError

def compute_file_sha256(filepath: str) -> str:
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(1024 * 1024):
            hasher.update(chunk)
    return hasher.hexdigest()

class MCIReader:
    """
    Random-access reader for Molecular Certificate Index (MCI) binary files.
    Enforces O(1) block seeks and rigorous multi-tier I/O accounting across
    both AABB (64-byte) and KDOP14 (128-byte) records.
    """

    def __init__(self, index_dir: str, verify_on_open: bool = True):
        self._lock = threading.RLock()
        self.index_dir = os.path.abspath(index_dir)
        self.manifest_path = os.path.join(self.index_dir, "manifest.json")
        self.blocks_path = os.path.join(self.index_dir, "blocks.bin")

        if not os.path.exists(self.manifest_path):
            raise MOCSFileNotFoundError(f"MCI manifest not found: {self.manifest_path}")
        if not os.path.exists(self.blocks_path):
            raise MOCSFileNotFoundError(f"MCI binary blocks file not found: {self.blocks_path}")

        with open(self.manifest_path, "r", encoding="utf-8") as f:
            self.manifest: Dict[str, Any] = json.load(f)

        self.num_blocks = self.manifest["num_blocks_per_group"]
        self.block_size = self.manifest["block_size_frames"]
        self.total_frames = self.manifest["total_frames"]
        self.bounding_model = self.manifest.get("bounding_model", "AABB").upper()
        self.record_size_bytes = self.manifest.get("record_size_bytes", (
            KDOP14_RECORD_SIZE_BYTES if self.bounding_model == "KDOP14" else RECORD_SIZE_BYTES
        ))
        self.group_map = {int(gid): i for i, gid in enumerate(self.manifest.get("atom_groups", {}).keys())}
        self.num_atom_groups = len(self.group_map)

        # Multi-tier I/O telemetry
        self.index_bytes_read: int = 0
        self.blocks_read_count: int = 0

        # Cached unbuffered file handle for random seeks
        self._f_blocks = open(self.blocks_path, "rb", buffering=0)

        # Validate 12-byte binary format header (F-052)
        hdr = self._f_blocks.read(MCI_HEADER_SIZE)
        if len(hdr) < MCI_HEADER_SIZE or hdr[:8] != MCI_MAGIC:
            self.close()
            raise MOCSDataIntegrityError("blocks.bin is not a MOCS MCI file or is truncated.")
        fmt, = struct.unpack("<I", hdr[8:12])
        expected = FORMAT_KDOP14 if self.bounding_model == "KDOP14" else FORMAT_AABB
        if fmt != expected:
            self.close()
            raise MOCSDataIntegrityError(
                f"blocks.bin format {fmt:#x} contradicts manifest bounding_model "
                f"'{self.bounding_model}' — index directory is inconsistent."
            )

        if verify_on_open:
            try:
                self.verify_integrity()
            except Exception:
                self.close()
                raise

    def close(self):
        if hasattr(self, "_lock"):
            with self._lock:
                if hasattr(self, "_f_blocks") and not self._f_blocks.closed:
                    self._f_blocks.close()
        else:
            if hasattr(self, "_f_blocks") and not self._f_blocks.closed:
                self._f_blocks.close()

    @property
    def is_closed(self) -> bool:
        return not hasattr(self, "_f_blocks") or self._f_blocks.closed

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def verify_integrity(self):
        """Verifies binary file size, hash commitments, and manifest integrity."""
        # 1. Manifest self-commitment check
        if "mci_index_hash" in self.manifest:
            clean_manifest = {k: v for k, v in self.manifest.items() if k != "mci_index_hash"}
            expected_index_hash = hashlib.sha256(json.dumps(clean_manifest, sort_keys=True).encode("utf-8")).hexdigest()
            if self.manifest["mci_index_hash"] != expected_index_hash:
                raise MOCSDataIntegrityError(
                    f"MCI manifest self-digest hash mismatch! Expected {expected_index_hash}, got {self.manifest['mci_index_hash']}"
                )

        # 2. blocks.bin size and SHA-256 check
        expected_size = self.manifest.get("files", {}).get("blocks_bin", {}).get("size_bytes")
        actual_size = os.path.getsize(self.blocks_path)
        if expected_size is not None and actual_size != expected_size:
            raise MOCSDataIntegrityError(f"blocks.bin size mismatch: expected {expected_size}, got {actual_size}")

        expected_blocks_sha = self.manifest.get("files", {}).get("blocks_bin", {}).get("sha256")
        if expected_blocks_sha:
            actual_blocks_sha = compute_file_sha256(self.blocks_path)
            if actual_blocks_sha != expected_blocks_sha:
                raise MOCSDataIntegrityError(
                    f"blocks.bin SHA-256 mismatch! Expected {expected_blocks_sha}, got {actual_blocks_sha}"
                )

        # 3. frame_offsets.bin size and SHA-256 check
        expected_offsets_size = self.manifest.get("files", {}).get("frame_offsets_bin", {}).get("size_bytes")
        actual_offsets_size = os.path.getsize(os.path.join(self.index_dir, "frame_offsets.bin"))
        if expected_offsets_size is not None and actual_offsets_size != expected_offsets_size:
            raise MOCSDataIntegrityError(
                f"frame_offsets.bin size mismatch: expected {expected_offsets_size}, got {actual_offsets_size}"
            )

        expected_offsets_sha = self.manifest.get("files", {}).get("frame_offsets_bin", {}).get("sha256")
        if expected_offsets_sha:
            actual_offsets_sha = compute_file_sha256(os.path.join(self.index_dir, "frame_offsets.bin"))
            if actual_offsets_sha != expected_offsets_sha:
                raise MOCSDataIntegrityError(
                    f"frame_offsets.bin SHA-256 mismatch! Expected {expected_offsets_sha}, got {actual_offsets_sha}"
                )

    def read_block(self, group_id: int, block_id: int) -> Union[AABBBlockRecord, KDOP14BlockRecord]:
        """
        O(1) direct seek to record byte offset:
        offset = (group_idx * num_blocks + block_id) * record_size_bytes.
        """
        if group_id not in self.group_map:
            raise ValueError(f"Atom group ID {group_id} not indexed in this MCI.")
        if block_id < 0 or block_id >= self.num_blocks:
            raise IndexError(f"Block ID {block_id} out of range [0, {self.num_blocks}).")

        group_idx = self.group_map[group_id]
        rec_size = self.record_size_bytes
        byte_offset = MCI_HEADER_SIZE + (group_idx * self.num_blocks + block_id) * rec_size

        with self._lock:
            if not hasattr(self, "_f_blocks") or self._f_blocks.closed:
                raise RuntimeError("MCIReader is closed.")
            self._f_blocks.seek(byte_offset)
            data = self._f_blocks.read(rec_size)
            if len(data) < rec_size:
                raise EOFError(f"Truncated record at group {group_id}, block {block_id}: expected {rec_size} bytes, got {len(data)}")

            self.index_bytes_read += rec_size
            self.blocks_read_count += 1

        if self.bounding_model == "KDOP14":
            rec = KDOP14BlockRecord.unpack(data)
            if rec.atom_group_id != group_id:
                raise MOCSDataIntegrityError(f"Atom group ID mismatch in record: expected {group_id}, found {rec.atom_group_id}")
            if rec.block_id != block_id:
                raise MOCSDataIntegrityError(f"Block ID mismatch in record: expected {block_id}, found {rec.block_id}")
            if any(min_v > max_v + 1e-12 for min_v, max_v in zip(rec.minima, rec.maxima)):
                raise MOCSDataIntegrityError(f"Corrupt KDOP14 bounds in block {block_id}: min bounds exceed max bounds!")
            return rec
        else:
            rec = AABBBlockRecord.unpack(data)
            if rec.atom_group_id != group_id:
                raise MOCSDataIntegrityError(f"Atom group ID mismatch in record: expected {group_id}, found {rec.atom_group_id}")
            if rec.block_id != block_id:
                raise MOCSDataIntegrityError(f"Block ID mismatch in record: expected {block_id}, found {rec.block_id}")
            if rec.x_min > rec.x_max or rec.y_min > rec.y_max or rec.z_min > rec.z_max:
                raise MOCSDataIntegrityError(f"Corrupt AABB bounds in block {block_id}: min bounds exceed max bounds!")
            return rec

    def read_group_blocks(self, group_id: int) -> List[AABBBlockRecord]:
        """Reads all blocks for a given atom group."""
        return [self.read_block(group_id, b_id) for b_id in range(self.num_blocks)]

    def get_index_hash(self) -> str:
        return self.manifest.get("mci_index_hash", "")

    def get_manifest(self) -> Dict[str, Any]:
        return self.manifest
