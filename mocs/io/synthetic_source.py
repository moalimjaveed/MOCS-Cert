"""Synthetic In-Memory Trajectory Source for Testing."""

from __future__ import annotations
import hashlib
from typing import Optional, List, Dict
import numpy as np
from mocs.io.source import TrajectorySource

class SyntheticTrajectorySource(TrajectorySource):
    """
    In-memory TrajectorySource backed directly by numpy arrays.
    Ideal for reproducible unit tests, differential oracle checks, and property testing.
    """

    def __init__(
        self,
        coordinates: np.ndarray,  # (n_frames, n_atoms, 3)
        box: np.ndarray,          # (3,), (6,), (3, 3), or (n_frames, 3/6)
        timestep_ps: float = 10.0,
        atom_names: Optional[List[str]] = None,
        residue_names: Optional[List[str]] = None,
        per_frame_cells: Optional[List["PeriodicCell"]] = None,
    ):
        if coordinates.ndim != 3 or coordinates.shape[2] != 3:
            raise ValueError(f"Coordinates array must have shape (n_frames, n_atoms, 3), got {coordinates.shape}")
        self.coordinates = coordinates.astype(np.float64)
        self.timestep_ps = float(timestep_ps)
        self.n_frames, self.n_atoms, _ = coordinates.shape

        from mocs.bounds.periodic_cell import PeriodicCell

        self._per_frame_cells: Optional[List[PeriodicCell]] = None
        box_arr = np.asarray(box, dtype=np.float64)

        if per_frame_cells is not None:
            if len(per_frame_cells) != self.n_frames:
                raise ValueError(f"per_frame_cells length {len(per_frame_cells)} does not match n_frames {self.n_frames}")
            self._per_frame_cells = per_frame_cells
            self._cell = per_frame_cells[0]
            self.box = self._cell.dimensions
            self._has_dynamic_cell = True
        elif box_arr.ndim == 2 and box_arr.shape[0] == self.n_frames and box_arr.shape[1] in (3, 6):
            # Dynamic per-frame boxes
            self._per_frame_cells = [PeriodicCell.from_dimensions(row) for row in box_arr]
            self._cell = self._per_frame_cells[0]
            self.box = box_arr
            self._has_dynamic_cell = True
        else:
            self._cell = PeriodicCell.from_dimensions(box_arr)
            self.box = self._cell.dimensions[:3] if self._cell.is_orthorhombic else self._cell.dimensions
            self._has_dynamic_cell = False

        self.atom_names = atom_names or [f"A{i}" for i in range(self.n_atoms)]
        self.residue_names = residue_names or ["LIG"] * self.n_atoms

        # Stable virtual digest
        data_bytes = self.coordinates.tobytes() + self.box.tobytes()
        self._sha256 = hashlib.sha256(data_bytes).hexdigest()
        self.frames_decoded = 0

    def get_total_frames(self) -> int:
        return self.n_frames

    def get_timestep_ps(self) -> float:
        return self.timestep_ps

    def get_box(self) -> np.ndarray:
        return self.box.copy()

    def get_cell(self, frame_idx: Optional[int] = None) -> "PeriodicCell":
        if frame_idx is not None and self._has_dynamic_cell and self._per_frame_cells:
            return self._per_frame_cells[frame_idx]
        return self._cell

    def has_dynamic_cell(self) -> bool:
        return self._has_dynamic_cell

    def read_frame_cell(self, frame_idx: int) -> "PeriodicCell":
        if frame_idx < 0 or frame_idx >= self.n_frames:
            raise IndexError(f"Frame index {frame_idx} out of range [0, {self.n_frames}).")
        if self._has_dynamic_cell and self._per_frame_cells:
            return self._per_frame_cells[frame_idx]
        return self._cell

    def read_block_cells(self, frame_start: int, frame_end_exclusive: int) -> List["PeriodicCell"]:
        if frame_start < 0 or frame_end_exclusive > self.n_frames or frame_start >= frame_end_exclusive:
            raise IndexError(f"Invalid frame block slice [{frame_start}, {frame_end_exclusive}).")
        if self._has_dynamic_cell and self._per_frame_cells:
            return self._per_frame_cells[frame_start:frame_end_exclusive]
        return [self._cell] * (frame_end_exclusive - frame_start)

    def resolve_selection(self, selection_str: str) -> np.ndarray:
        sel = selection_str.strip()
        if sel.lower().startswith("name "):
            sel = sel[5:].strip()
        # Direct numeric index
        if sel.isdigit():
            idx = int(sel)
            if 0 <= idx < self.n_atoms:
                return np.array([idx], dtype=np.int64)
        # Atom name match
        matches = [i for i, name in enumerate(self.atom_names) if name.lower() == sel.lower()]
        if matches:
            return np.array(matches, dtype=np.int64)
        # Common test labels
        if sel in ("A:155:CA", "155:CA", "CA", "A"):
            return np.array([0], dtype=np.int64)
        if sel in ("LIG:1:02", "LIG:1:O2", "O2", "02", "B"):
            return np.array([1], dtype=np.int64)
        
        from mocs.exceptions import MOCSSelectionResolutionError
        raise MOCSSelectionResolutionError(f"Selection query '{selection_str}' resolved to 0 atoms in synthetic topology.")

    def read_frame_coordinates(
        self,
        frame_idx: int,
        atom_indices: Optional[np.ndarray] = None
    ) -> np.ndarray:
        if frame_idx < 0 or frame_idx >= self.n_frames:
            raise IndexError(f"Frame index {frame_idx} out of range [0, {self.n_frames}).")
        self.frames_decoded += 1
        pos = self.coordinates[frame_idx]
        if atom_indices is not None:
            return pos[atom_indices]
        return pos

    def read_block_coordinates(
        self,
        frame_start: int,
        frame_end_exclusive: int,
        atom_indices: Optional[np.ndarray] = None
    ) -> np.ndarray:
        if frame_start < 0 or frame_end_exclusive > self.n_frames or frame_start >= frame_end_exclusive:
            raise IndexError(f"Invalid frame block slice [{frame_start}, {frame_end_exclusive}).")
        self.frames_decoded += (frame_end_exclusive - frame_start)
        block = self.coordinates[frame_start:frame_end_exclusive]
        if atom_indices is not None:
            return block[:, atom_indices, :]
        return block

    def get_file_sha256(self) -> str:
        return self._sha256

    def get_topology_sha256(self) -> str:
        return self._sha256
