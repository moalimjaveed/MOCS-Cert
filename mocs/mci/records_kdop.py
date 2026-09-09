"""MCI 128-byte Binary Record Layout for KDOP14."""

from __future__ import annotations
import struct
import hashlib
from dataclasses import dataclass
from typing import Tuple, Sequence, Optional, ClassVar
import numpy as np

from mocs.bounds.kdop import KDOP14, CANONICAL_DIRECTIONS_14, MODEL_VERSION_KDOP14

# Binary layout: <IIII14d (Little-endian: 4 uint32, 14 float64)
# 4 * 4 bytes + 14 * 8 bytes = 16 + 112 = 128 bytes aligned.
KDOP14_RECORD_FORMAT = "<IIII14d"
KDOP14_RECORD_SIZE_BYTES = struct.calcsize(KDOP14_RECORD_FORMAT)
if KDOP14_RECORD_SIZE_BYTES != 128:
    raise ValueError(f"KDOP14BlockRecord must be exactly 128 bytes, got {KDOP14_RECORD_SIZE_BYTES}")


@dataclass(frozen=True)
class KDOP14BlockRecord:
    """
    Standardized 128-byte binary record representing a 14-DOP bounding volume
    over a temporal coordinate block.
    """
    RECORD_SIZE: ClassVar[int] = 128
    RECORD_SIZE_BYTES: ClassVar[int] = 128
    STRUCT_FORMAT: ClassVar[str] = "<IIII14d"

    atom_group_id: int
    block_id: int
    frame_start: int
    frame_end_exclusive: int
    min_proj_0: float
    min_proj_1: float
    min_proj_2: float
    min_proj_3: float
    min_proj_4: float
    min_proj_5: float
    min_proj_6: float
    max_proj_0: float
    max_proj_1: float
    max_proj_2: float
    max_proj_3: float
    max_proj_4: float
    max_proj_5: float
    max_proj_6: float

    @classmethod
    def from_projections(
        cls,
        atom_group_id: int,
        block_id: int,
        frame_start: int,
        frame_end_exclusive: int,
        min_projections: Optional[Sequence[float]] = None,
        max_projections: Optional[Sequence[float]] = None,
        projections: Optional[Sequence[float]] = None,
    ) -> KDOP14BlockRecord:
        if projections is not None:
            projs = [float(x) for x in projections]
            if len(projs) != 14:
                raise ValueError(f"Expected 14 projections, got {len(projs)}")
            mins = projs[:7]
            maxs = projs[7:]
        else:
            if min_projections is None or max_projections is None:
                raise ValueError("Either projections (14 floats) or both min_projections and max_projections (7 floats each) must be provided.")
            mins = [float(x) for x in min_projections]
            maxs = [float(x) for x in max_projections]
            if len(mins) != 7 or len(maxs) != 7:
                raise ValueError(f"Expected 7 min and 7 max projections, got {len(mins)} and {len(maxs)}")
        return cls(
            atom_group_id=atom_group_id,
            block_id=block_id,
            frame_start=frame_start,
            frame_end_exclusive=frame_end_exclusive,
            min_proj_0=mins[0], min_proj_1=mins[1], min_proj_2=mins[2],
            min_proj_3=mins[3], min_proj_4=mins[4], min_proj_5=mins[5], min_proj_6=mins[6],
            max_proj_0=maxs[0], max_proj_1=maxs[1], max_proj_2=maxs[2],
            max_proj_3=maxs[3], max_proj_4=maxs[4], max_proj_5=maxs[5], max_proj_6=maxs[6]
        )


    def pack(self) -> bytes:
        return struct.pack(
            KDOP14_RECORD_FORMAT,
            self.atom_group_id,
            self.block_id,
            self.frame_start,
            self.frame_end_exclusive,
            float(self.min_proj_0),
            float(self.min_proj_1),
            float(self.min_proj_2),
            float(self.min_proj_3),
            float(self.min_proj_4),
            float(self.min_proj_5),
            float(self.min_proj_6),
            float(self.max_proj_0),
            float(self.max_proj_1),
            float(self.max_proj_2),
            float(self.max_proj_3),
            float(self.max_proj_4),
            float(self.max_proj_5),
            float(self.max_proj_6),
        )

    @classmethod
    def unpack(cls, data: bytes) -> KDOP14BlockRecord:
        if len(data) != KDOP14_RECORD_SIZE_BYTES:
            raise ValueError(f"Expected {KDOP14_RECORD_SIZE_BYTES} bytes, got {len(data)}")
        unpacked = struct.unpack(KDOP14_RECORD_FORMAT, data)
        return cls(*unpacked)

    to_bytes = pack
    from_bytes = unpack

    def compute_sha256(self) -> str:
        return hashlib.sha256(self.pack()).hexdigest()

    @property
    def min_projections(self) -> np.ndarray:
        return np.array([
            self.min_proj_0, self.min_proj_1, self.min_proj_2,
            self.min_proj_3, self.min_proj_4, self.min_proj_5, self.min_proj_6
        ], dtype=np.float64)

    @property
    def max_projections(self) -> np.ndarray:
        return np.array([
            self.max_proj_0, self.max_proj_1, self.max_proj_2,
            self.max_proj_3, self.max_proj_4, self.max_proj_5, self.max_proj_6
        ], dtype=np.float64)

    @property
    def minima(self) -> Tuple[float, ...]:
        return (
            self.min_proj_0, self.min_proj_1, self.min_proj_2,
            self.min_proj_3, self.min_proj_4, self.min_proj_5, self.min_proj_6
        )

    @property
    def maxima(self) -> Tuple[float, ...]:
        return (
            self.max_proj_0, self.max_proj_1, self.max_proj_2,
            self.max_proj_3, self.max_proj_4, self.max_proj_5, self.max_proj_6
        )


    def to_kdop(self) -> KDOP14:
        """Converts record to KDOP14 object."""
        return KDOP14(
            min_projections=self.min_projections,
            max_projections=self.max_projections,
            directions=CANONICAL_DIRECTIONS_14.copy(),
            model_version=MODEL_VERSION_KDOP14,
            dimension=3,
            metadata={
                "atom_group_id": self.atom_group_id,
                "block_id": self.block_id,
                "frame_start": self.frame_start,
                "frame_end_exclusive": self.frame_end_exclusive
            }
        )

    get_kdop = to_kdop

    def get_aabb(self) -> Tuple[Tuple[float, float, float], Tuple[float, float, float]]:
        """Returns ((x_min, y_min, z_min), (x_max, y_max, z_max)) from Cartesian projections."""
        return (
            (float(self.min_proj_0), float(self.min_proj_1), float(self.min_proj_2)),
            (float(self.max_proj_0), float(self.max_proj_1), float(self.max_proj_2))
        )
