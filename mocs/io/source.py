"""Abstract Base Class for Trajectory Sources."""

from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Optional, List, Tuple
import numpy as np

class TrajectorySource(ABC):
    """
    Abstract interface for streaming coordinates, topologies, and metadata
    from molecular dynamics trajectory files.
    """

    @abstractmethod
    def get_total_frames(self) -> int:
        """Returns total number of frames in trajectory."""
        pass

    @abstractmethod
    def get_timestep_ps(self) -> float:
        """Returns sampling interval dt in picoseconds."""
        pass

    def get_dt_source(self) -> str:
        """Returns the origin of the timestep ('file' or 'user')."""
        return "user"

    @abstractmethod
    def get_box(self) -> np.ndarray:
        """Returns simulation box dimensions in Angstroms."""
        pass

    def get_cell(self, frame_idx: Optional[int] = None) -> "PeriodicCell":
        """Returns the PeriodicCell for the trajectory (or specific frame)."""
        from mocs.bounds.periodic_cell import PeriodicCell
        return PeriodicCell.from_dimensions(self.get_box())

    def has_dynamic_cell(self) -> bool:
        """Returns True if the simulation unit cell fluctuates across frames."""
        return False

    def read_frame_cell(self, frame_idx: int) -> "PeriodicCell":
        """Returns the PeriodicCell for a specific frame index."""
        return self.get_cell(frame_idx)

    def read_block_cells(self, frame_start: int, frame_end_exclusive: int) -> List["PeriodicCell"]:
        """Returns a list of PeriodicCell instances across a block of frames."""
        return [self.read_frame_cell(k) for k in range(frame_start, frame_end_exclusive)]

    @abstractmethod
    def resolve_selection(self, selection_str: str) -> np.ndarray:
        """
        Resolves a selection query string to a 1D array of 0-based integer atom indices.
        """
        pass

    @abstractmethod
    def read_frame_coordinates(
        self,
        frame_idx: int,
        atom_indices: Optional[np.ndarray] = None
    ) -> np.ndarray:
        """
        Reads coordinates for a single frame.
        Returns: np.ndarray of shape (N, 3) where N = len(atom_indices) or total atoms.
        """
        pass

    @abstractmethod
    def read_block_coordinates(
        self,
        frame_start: int,
        frame_end_exclusive: int,
        atom_indices: Optional[np.ndarray] = None
    ) -> np.ndarray:
        """
        Reads coordinates across a block of frames [frame_start, frame_end_exclusive).
        Returns: np.ndarray of shape (B, N, 3) where B = frame_end_exclusive - frame_start.
        """
        pass

    @abstractmethod
    def get_file_sha256(self) -> str:
        """Returns SHA-256 digest of underlying trajectory file."""
        pass

    @abstractmethod
    def get_topology_sha256(self) -> str:
        """Returns SHA-256 digest of underlying topology file."""
        pass

    def close(self) -> None:
        """Closes underlying trajectory files and releases system handles."""
        pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    @property
    def is_closed(self) -> bool:
        return False
