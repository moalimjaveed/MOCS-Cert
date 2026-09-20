"""MCI 64-byte Binary Record Layout Specification (MCI_SPEC.md §3)."""

from __future__ import annotations
import struct
import hashlib
from dataclasses import dataclass
from typing import Tuple

# Binary layout: <IIII6d (Little-endian: 4 uint32, 6 float64)
# 4 * 4 bytes + 6 * 8 bytes = 16 + 48 = 64 bytes aligned.
# Binary layout: <IIII6d (Little-endian: 4 uint32, 6 float64)
# 4 * 4 bytes + 6 * 8 bytes = 16 + 48 = 64 bytes aligned.
RECORD_FORMAT = "<IIII6d"
RECORD_SIZE_BYTES = struct.calcsize(RECORD_FORMAT)
if RECORD_SIZE_BYTES != 64:
    raise ValueError(f"AABBBlockRecord must be exactly 64 bytes, got {RECORD_SIZE_BYTES}")

# Binary format discrimination constants (F-052)
MCI_MAGIC: bytes = b"MOCSMCI\x01"
FORMAT_AABB: int = 0x41414242
FORMAT_KDOP14: int = 0x4B444F50
MCI_HEADER_SIZE: int = 12

@dataclass(frozen=True)
class AABBBlockRecord:
    """
    Standardized 64-byte binary record representing an AABB bounding volume
    over a temporal coordinate block.
    """
    atom_group_id: int
    block_id: int
    frame_start: int
    frame_end_exclusive: int
    x_min: float
    x_max: float
    y_min: float
    y_max: float
    z_min: float
    z_max: float

    def pack(self) -> bytes:
        return struct.pack(
            RECORD_FORMAT,
            self.atom_group_id,
            self.block_id,
            self.frame_start,
            self.frame_end_exclusive,
            float(self.x_min),
            float(self.x_max),
            float(self.y_min),
            float(self.y_max),
            float(self.z_min),
            float(self.z_max),
        )

    @classmethod
    def unpack(cls, data: bytes) -> AABBBlockRecord:
        if len(data) != RECORD_SIZE_BYTES:
            raise ValueError(f"Expected {RECORD_SIZE_BYTES} bytes, got {len(data)}")
        unpacked = struct.unpack(RECORD_FORMAT, data)
        return cls(*unpacked)

    def compute_sha256(self) -> str:
        return hashlib.sha256(self.pack()).hexdigest()

    def get_aabb(self) -> Tuple[Tuple[float, float, float], Tuple[float, float, float]]:
        """Returns ((x_min, y_min, z_min), (x_max, y_max, z_max))."""
        return (
            (self.x_min, self.y_min, self.z_min),
            (self.x_max, self.y_max, self.z_max)
        )


# ==============================================================================
# KDOP14 128-byte Binary Record Layout (canonical import from records_kdop)
# ==============================================================================
from mocs.mci.records_kdop import (
    KDOP14BlockRecord,
    KDOP14_RECORD_FORMAT,
    KDOP14_RECORD_SIZE_BYTES,
)

__all__ = [
    "AABBBlockRecord",
    "RECORD_FORMAT",
    "RECORD_SIZE_BYTES",
    "KDOP14BlockRecord",
    "KDOP14_RECORD_FORMAT",
    "KDOP14_RECORD_SIZE_BYTES",
    "MCI_MAGIC",
    "FORMAT_AABB",
    "FORMAT_KDOP14",
    "MCI_HEADER_SIZE",
]



