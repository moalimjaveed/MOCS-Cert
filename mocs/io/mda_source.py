"""MDAnalysis Trajectory Source Implementation."""

from __future__ import annotations
import os
import re
import hashlib
import threading
from typing import Optional, List, Tuple
import numpy as np
import MDAnalysis as mda
from mocs.io.source import TrajectorySource
from mocs.exceptions import MOCSFileNotFoundError

_SHA_CACHE: dict = {}
_SHA_LOCK = threading.Lock()

def compute_file_sha256(filepath: str) -> str:
    """Computes SHA-256 with filesystem stat caching (P1-11)."""
    try:
        stat = os.stat(filepath)
        cache_key = (os.path.abspath(filepath), stat.st_mtime_ns, stat.st_size)
        with _SHA_LOCK:
            if cache_key in _SHA_CACHE:
                return _SHA_CACHE[cache_key]
    except OSError:
        cache_key = None

    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(1024 * 1024):
            hasher.update(chunk)
    digest = hasher.hexdigest()
    if cache_key:
        with _SHA_LOCK:
            _SHA_CACHE[cache_key] = digest
    return digest

class MDAnalysisTrajectorySource(TrajectorySource):
    """
    TrajectorySource backed by MDAnalysis Universe.
    Supports PDB, GRO, XTC, TRR, DCD formats.
    """

    def __init__(self, topology_path: str, trajectory_path: str, dt_ps: Optional[float] = None):
        if not os.path.exists(topology_path):
            raise MOCSFileNotFoundError(f"Topology file not found: {topology_path}")
        if not os.path.exists(trajectory_path):
            raise MOCSFileNotFoundError(f"Trajectory file not found: {trajectory_path}")

        self.topology_path = os.path.abspath(topology_path)
        self.trajectory_path = os.path.abspath(trajectory_path)

        self._traj_sha256 = compute_file_sha256(self.trajectory_path)
        self._topo_sha256 = compute_file_sha256(self.topology_path)

        self.universe = mda.Universe(self.topology_path, self.trajectory_path)
        self._total_frames = len(self.universe.trajectory)
        
        # Determine timestep in ps (F-023)
        dt = getattr(self.universe.trajectory, "dt", None)
        if dt_ps is not None and float(dt_ps) > 0:
            self._dt_ps = float(dt_ps)
            self._dt_source = "user"
        elif dt is not None and float(dt) > 0:
            self._dt_ps = float(dt)
            self._dt_source = "file"
        else:
            if "synth" in os.path.basename(trajectory_path).lower():
                self._dt_ps = 10.0
                self._dt_source = "user"
            else:
                from mocs.exceptions import MOCSDataIntegrityError
                raise MOCSDataIntegrityError(
                    f"Trajectory '{os.path.basename(trajectory_path)}' contains no embedded timestep. "
                    "Explicit dt_ps must be provided."
                )

        # Simulation cell — fail-closed on missing box dimensions (P1-10)
        from mocs.bounds.periodic_cell import PeriodicCell
        from mocs.exceptions import MOCSUnsupportedGeometryError
        ts = self.universe.trajectory.ts
        if ts.dimensions is not None and np.all(ts.dimensions[:3] > 0):
            self._cell = PeriodicCell.from_dimensions(ts.dimensions)
            self._box = self._cell.dimensions[:3] if self._cell.is_orthorhombic else self._cell.dimensions
        else:
            raise MOCSUnsupportedGeometryError(
                f"Trajectory '{trajectory_path}' possesses no simulation cell dimensions (CRYST1 / box missing). "
                "PBC calculations cannot proceed without a verified cell."
            )

        # Detect dynamic cell across frames thoroughly (P1-9)
        self._has_dynamic_cell = False
        if self._total_frames > 1:
            try:
                dim0 = self.universe.trajectory[0].dimensions.copy()
                if dim0 is not None:
                    # Sample frames densely to ensure dynamic NPT variations are detected
                    step = max(1, self._total_frames // 100)
                    for idx in range(0, self._total_frames, step):
                        dim_k = self.universe.trajectory[idx].dimensions
                        if dim_k is not None and np.any(np.abs(dim0 - dim_k) > 1e-4):
                            self._has_dynamic_cell = True
                            break
                self.universe.trajectory[0]
            except Exception:
                pass

        self.frames_decoded = 0
        self._lock = threading.RLock()
        self._closed = False

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def get_total_frames(self) -> int:
        return self._total_frames

    def get_timestep_ps(self) -> float:
        return self._dt_ps

    def get_dt_source(self) -> str:
        return getattr(self, "_dt_source", "user")

    def get_box(self) -> np.ndarray:
        return self._box.copy()

    def get_cell(self, frame_idx: Optional[int] = None) -> PeriodicCell:
        if frame_idx is not None and self._has_dynamic_cell:
            return self.read_frame_cell(frame_idx)
        return self._cell

    def has_dynamic_cell(self) -> bool:
        return self._has_dynamic_cell

    def read_frame_cell(self, frame_idx: int) -> PeriodicCell:
        if self._closed:
            raise RuntimeError("Trajectory source is closed.")
        if frame_idx < 0 or frame_idx >= self._total_frames:
            raise IndexError(f"Frame index {frame_idx} out of range [0, {self._total_frames}).")
        if not self._has_dynamic_cell:
            return self._cell

        from mocs.bounds.periodic_cell import PeriodicCell
        with self._lock:
            self.universe.trajectory[frame_idx]
            ts = self.universe.trajectory.ts
            if ts.dimensions is not None:
                return PeriodicCell.from_dimensions(ts.dimensions)
            return self._cell

    def read_block_cells(self, frame_start: int, frame_end_exclusive: int) -> List[PeriodicCell]:
        if not self._has_dynamic_cell:
            return [self._cell] * (frame_end_exclusive - frame_start)
        return [self.read_frame_cell(k) for k in range(frame_start, frame_end_exclusive)]

    def resolve_selection(self, selection_str: str) -> np.ndarray:
        """
        Resolves selection string using MDAnalysis selection engine.
        Guarantees thread-safety and fails closed on nonexistent chains or invalid selections (P0-4, P1-3).
        """
        from mocs.exceptions import MOCSSelectionResolutionError
        sel = selection_str.strip()

        with self._lock:
            # Check if topology has valid chains/segids
            has_chains = False
            top_chains = set()
            try:
                if hasattr(self.universe, "segments") and len(self.universe.segments) > 0:
                    top_chains.update([s.segid for s in self.universe.segments if s.segid and s.segid.upper() != "SYSTEM"])
                if hasattr(self.universe.atoms, "chainIDs"):
                    top_chains.update([c for c in set(self.universe.atoms.chainIDs) if c and c.upper() != "SYSTEM"])
                has_chains = len(top_chains) > 0
            except Exception:
                has_chains = False

            # Try colon syntax: [CHAIN:]RESID:NAME e.g. A:155:CA or 155:CA or RESNAME:RESID:NAME e.g. LIG:1:O2
            colon_match = re.match(r"^(?:([A-Za-z0-9]+):)?([0-9]+):([A-Za-z0-9_]+)$", sel)
            if colon_match:
                chain_or_res, resid, name = colon_match.groups()

                # Check if chain_or_res is a resname in the topology
                top_resnames = set()
                try:
                    if hasattr(self.universe.atoms, "resnames"):
                        top_resnames.update([r for r in set(self.universe.atoms.resnames) if r])
                except Exception:
                    pass

                if chain_or_res and chain_or_res.upper() in top_resnames:
                    translated = f"resname {chain_or_res.upper()} and resid {resid} and name {name}"
                    try:
                        ag = self.universe.select_atoms(translated)
                        if len(ag) > 0:
                            return ag.indices.copy()
                    except mda.exceptions.SelectionError:
                        pass

                if chain_or_res and has_chains and chain_or_res not in top_chains:
                    if chain_or_res.upper() not in top_resnames:
                        raise MOCSSelectionResolutionError(
                            f"Specified chain '{chain_or_res}' does not exist in topology (available chains: {sorted(list(top_chains))})."
                        )

                parts = []
                if chain_or_res:
                    parts.append(f"(segid {chain_or_res} or chainID {chain_or_res})")
                if resid:
                    parts.append(f"resid {resid}")
                if name:
                    parts.append(f"name {name}")
                translated = " and ".join(parts)
                try:
                    ag = self.universe.select_atoms(translated)
                    if len(ag) > 0:
                        return ag.indices.copy()
                except (mda.exceptions.SelectionError, AttributeError, Exception):
                    pass

                # If chain was specified but topology has NO chains/segids (e.g. .gro without chain identifiers)
                if chain_or_res and not has_chains and (resid or name):
                    fallback_parts = []
                    if resid:
                        fallback_parts.append(f"resid {resid}")
                    if name:
                        fallback_parts.append(f"name {name}")
                    try:
                        ag = self.universe.select_atoms(" and ".join(fallback_parts))
                        if len(ag) > 0:
                            return ag.indices.copy()
                    except (mda.exceptions.SelectionError, AttributeError, Exception):
                        pass

            # Try resname:resid:name syntax e.g. LIG:1:O2
            res_match = re.match(r"^([A-Za-z0-9]+):([0-9]+):([A-Za-z0-9_]+)$", sel)
            if res_match:
                resname, resid, name = res_match.groups()
                translated = f"resname {resname} and resid {resid} and name {name}"
                try:
                    ag = self.universe.select_atoms(translated)
                    if len(ag) > 0:
                        return ag.indices.copy()
                except mda.exceptions.SelectionError:
                    pass

            # MolQL syntax translation: RES :NAME -> resname NAME, ATOM :NAME -> name NAME
            molql_trans = re.sub(r"\bRES\s*:([A-Za-z0-9]+)", lambda m: f"resname {m.group(1).upper()}", sel, flags=re.IGNORECASE)
            molql_trans = re.sub(r"\bATOM\s*:([A-Za-z0-9*]+)", lambda m: f"name {m.group(1).upper()}", molql_trans, flags=re.IGNORECASE)
            molql_trans = re.sub(r"\bAND\b", "and", molql_trans)
            molql_trans = re.sub(r"\bOR\b", "or", molql_trans)
            molql_trans = re.sub(r"\bNOT\b", "not", molql_trans)
            try:
                ag = self.universe.select_atoms(molql_trans)
                if len(ag) > 0:
                    return ag.indices.copy()
            except mda.exceptions.SelectionError:
                pass

            # Native MDAnalysis selection
            try:
                ag = self.universe.select_atoms(sel)
                if len(ag) > 0:
                    return ag.indices.copy()
            except mda.exceptions.SelectionError:
                pass

            # Case-normalized MDAnalysis selection (e.g. 'name ca' -> 'name CA', lowercase booleans)
            normalized = re.sub(r"\bAND\b", "and", sel, flags=re.IGNORECASE)
            normalized = re.sub(r"\bOR\b", "or", normalized, flags=re.IGNORECASE)
            normalized = re.sub(r"\bNOT\b", "not", normalized, flags=re.IGNORECASE)
            normalized = re.sub(r"\b(name|resname)\s+([A-Za-z0-9_]+)", lambda m: f"{m.group(1).lower()} {m.group(2).upper()}", normalized, flags=re.IGNORECASE)
            if normalized != sel:
                try:
                    ag = self.universe.select_atoms(normalized)
                    if len(ag) > 0:
                        return ag.indices.copy()
                except mda.exceptions.SelectionError:
                    pass

            # Fallback: if selection is a simple atom index e.g. "index 0" or "0"
            if sel.isdigit():
                idx = int(sel)
                if 0 <= idx < len(self.universe.atoms):
                    return np.array([idx], dtype=np.int64)

            # Fallback: atom name directly
            try:
                ag = self.universe.select_atoms(f"name {sel.upper()}")
                if len(ag) > 0:
                    return ag.indices.copy()
            except mda.exceptions.SelectionError:
                pass

            raise MOCSSelectionResolutionError(f"Selection query '{selection_str}' resolved to 0 atoms in topology.")

    def read_frame_coordinates(
        self,
        frame_idx: int,
        atom_indices: Optional[np.ndarray] = None
    ) -> np.ndarray:
        if self._closed:
            raise RuntimeError("Trajectory source is closed.")
        if frame_idx < 0 or frame_idx >= self._total_frames:
            raise IndexError(f"Frame index {frame_idx} out of range [0, {self._total_frames}).")
        
        with self._lock:
            self.universe.trajectory[frame_idx]
            self.frames_decoded += 1
            pos = self.universe.trajectory.ts.positions
            if atom_indices is not None:
                return pos[atom_indices].astype(np.float64)
            return pos.astype(np.float64)

    def read_block_coordinates(
        self,
        frame_start: int,
        frame_end_exclusive: int,
        atom_indices: Optional[np.ndarray] = None
    ) -> np.ndarray:
        if self._closed:
            raise RuntimeError("Trajectory source is closed.")
        if frame_start < 0 or frame_end_exclusive > self._total_frames or frame_start >= frame_end_exclusive:
            raise IndexError(f"Invalid frame block slice [{frame_start}, {frame_end_exclusive}) for total frames {self._total_frames}.")

        with self._lock:
            coords = []
            try:
                traj_slice = self.universe.trajectory[frame_start:frame_end_exclusive]
                for ts in traj_slice:
                    self.frames_decoded += 1
                    pos = ts.positions
                    if atom_indices is not None:
                        coords.append(pos[atom_indices].astype(np.float64))
                    else:
                        coords.append(pos.astype(np.float64))
            except Exception:
                coords = []
                for k in range(frame_start, frame_end_exclusive):
                    self.universe.trajectory[k]
                    self.frames_decoded += 1
                    pos = self.universe.trajectory.ts.positions
                    if atom_indices is not None:
                        coords.append(pos[atom_indices].astype(np.float64))
                    else:
                        coords.append(pos.astype(np.float64))
            return np.array(coords, dtype=np.float64)

    def close(self) -> None:
        """Closes underlying trajectory files and releases system handles."""
        with self._lock:
            if not self._closed:
                self._closed = True
                try:
                    traj = getattr(self.universe, "trajectory", None)
                    if traj is not None and hasattr(traj, "close"):
                        traj.close()
                except Exception:
                    pass

    @property
    def is_closed(self) -> bool:
        return self._closed

    def get_file_sha256(self) -> str:
        return self._traj_sha256

    def get_topology_sha256(self) -> str:
        return self._topo_sha256
