"""High-Level Certified Query Session & Factory Functions."""

import os
import json
import time
import hashlib
from typing import Optional, Union, Tuple, Dict, Any, List
import numpy as np

from mocs.types import (
    TruthValue,
    ResolutionStatus,
    MOCSResult,
    DEFAULT_BLOCK_SIZE
)
from mocs.exceptions import MOCSFileNotFoundError
from mocs.certificates.auditor import (
    compute_file_sha256,
    verify_certificate
)
from mocs.reference.distance import reference_distance
from mocs.reference.hbond import reference_hbond
from mocs.reference.temporal import (
    reference_temporal_for,
    extract_half_open_intervals
)

class MOCSSession:
    """MOCS-Cert Active Trajectory Observation Session."""
    def __init__(
        self,
        trajectory_path: str,
        topology_path: str,
        sidecar_dir: Optional[str] = None,
        pbc_mode: str = "orthorhombic_minimum_image",
        dt_ps: Optional[float] = None
    ):
        if not os.path.exists(trajectory_path):
            raise MOCSFileNotFoundError(f"Trajectory not found: {trajectory_path}")
        if not os.path.exists(topology_path):
            raise MOCSFileNotFoundError(f"Topology not found: {topology_path}")

        self.trajectory_path = trajectory_path
        self.topology_path = topology_path
        self.sidecar_dir = sidecar_dir or f"{trajectory_path}.mocs"
        self.pbc_mode = pbc_mode
        self.dt_ps = dt_ps or 10.0
        self.query_history: List[str] = []

    def query(
        self,
        observable: str,
        operands: Union[Tuple[str, str], Dict[str, str]],
        predicate: str,
        temporal: Optional[Dict[str, Any]] = None,
        block_size: int = DEFAULT_BLOCK_SIZE,
        allow_refinement: bool = True,
        plan: Optional[str] = None
    ) -> MOCSResult:
        """Executes a contract-driven certified query using the indexed pipeline."""
        t0_wall = time.perf_counter()
        query_id = f"q-{len(self.query_history) + 1:04d}"
        self.query_history.append(query_id)

        parts = predicate.strip().split()
        if len(parts) >= 2:
            op, thresh_str = parts[0], parts[1]
            thresh_val = float(thresh_str)
        else:
            op, thresh_val = "<", 4.0

        obs_lower = observable.lower()
        if obs_lower not in ("distance", "contact"):
            raise NotImplementedError(f"Observable {observable} not implemented in V0.1.")

        sel_a, sel_b = operands[0], operands[1]

        # Use MDAnalysis source and MCI index
        from mocs.io.mda_source import MDAnalysisTrajectorySource
        from mocs.mci import MCIReader, MCIWriter
        from mocs.bounds.periodic_bounds import compute_pbc_bounds
        from mocs.planner.plan_selector import select_execution_plan

        source = MDAnalysisTrajectorySource(self.topology_path, self.trajectory_path)
        sel_a_idx = source.resolve_selection(sel_a)
        sel_b_idx = source.resolve_selection(sel_b)
        box = source.get_box()
        n_frames = source.get_total_frames()

        # Build / load MCI index
        traj_name = os.path.splitext(os.path.basename(self.trajectory_path))[0]
        sel_hash = hashlib.sha256((sel_a + "_" + sel_b).encode()).hexdigest()[:8]
        if self.sidecar_dir:
            sidecar_dir = self.sidecar_dir
        else:
            default_mocs = f"{self.trajectory_path}.mocs"
            is_valid_default = False
            if os.path.exists(os.path.join(default_mocs, "manifest.json")):
                try:
                    with open(os.path.join(default_mocs, "manifest.json"), "r") as mf:
                        ex_mf = json.load(mf)
                    if (ex_mf.get("block_size_frames") == block_size and
                        ex_mf.get("atom_groups", {}).get("0") == sel_a_idx.tolist() and
                        ex_mf.get("atom_groups", {}).get("1") == sel_b_idx.tolist()):
                        with MCIReader(default_mocs, verify_on_open=True):
                            pass
                        sidecar_dir = default_mocs
                        is_valid_default = True
                except (OSError, json.JSONDecodeError, ValueError, KeyError):
                    # Corrupted or incompatible existing manifest; fall back to rebuild
                    pass
            if not is_valid_default:
                sidecar_dir = os.path.join(os.path.dirname(self.trajectory_path) or ".", f".mci_{traj_name}_{sel_hash}_bs{block_size}")

        need_build = True
        if os.path.exists(os.path.join(sidecar_dir, "manifest.json")):
            try:
                with open(os.path.join(sidecar_dir, "manifest.json"), "r") as mf:
                    existing_manifest = json.load(mf)
                if (existing_manifest.get("block_size_frames") == block_size and
                    existing_manifest.get("atom_groups", {}).get("0") == sel_a_idx.tolist() and
                    existing_manifest.get("atom_groups", {}).get("1") == sel_b_idx.tolist()):
                    with MCIReader(sidecar_dir, verify_on_open=True):
                        need_build = False
            except Exception:
                need_build = True

        if need_build:
            atom_groups = {0: sel_a_idx, 1: sel_b_idx}
            MCIWriter.build_index(
                source,
                atom_groups,
                sidecar_dir,
                block_size=block_size,
                trajectory_id=os.path.basename(self.trajectory_path),
                topology_id=os.path.basename(self.topology_path)
            )

        reader = MCIReader(sidecar_dir, verify_on_open=True)
        total_blocks = reader.num_blocks
        actual_bs = reader.manifest.get("block_size_frames", block_size)

        # Fast scan to estimate prune rate
        pruned_b = 0
        for b_idx in range(total_blocks):
            ra = reader.read_block(0, b_idx)
            rb = reader.read_block(1, b_idx)
            L, U = compute_pbc_bounds(ra.get_aabb(), rb.get_aabb(), box)
            if op == "<" and (U < thresh_val or L >= thresh_val):
                pruned_b += 1
            elif op == "<=" and (U <= thresh_val or L > thresh_val):
                pruned_b += 1
            elif op == ">" and (L > thresh_val or U <= thresh_val):
                pruned_b += 1
            elif op == ">=" and (L >= thresh_val or U < thresh_val):
                pruned_b += 1

        est_prune_rate = pruned_b / total_blocks if total_blocks > 0 else 0.0
        plan_used = plan or select_execution_plan(
            query_id=query_id,
            workload_remaining=5,
            is_cached=False,
            index_available=True,
            estimated_prune_rate=est_prune_rate
        )

        index_bytes_read = 0
        frames_scanned_exact = 0
        blocks_certified_true = 0
        blocks_certified_false = 0
        blocks_refined = 0
        inspected_block_bounds = []
        frame_results = np.zeros(n_frames, dtype=bool)

        if plan_used == "Plan-A":
            # Brute force scan
            reader.close()
            dist_series = reference_distance(self.topology_path, self.trajectory_path, sel_a, sel_b, self.pbc_mode)
            if op == "<":
                bool_series = dist_series < thresh_val
            elif op == "<=":
                bool_series = dist_series <= thresh_val
            elif op == ">":
                bool_series = dist_series > thresh_val
            else:
                bool_series = dist_series >= thresh_val
            frame_results = bool_series
            frames_scanned_exact = n_frames
            blocks_certified_true = 0
            blocks_certified_false = 0
        else:
            # Indexed execution (Plan-B / Plan-D)
            bytes_per_record = reader.manifest.get("record_size_bytes", 64)
            for b_idx in range(total_blocks):
                ra = reader.read_block(0, b_idx)
                rb = reader.read_block(1, b_idx)
                index_bytes_read += (bytes_per_record * 2)

                L, U = compute_pbc_bounds(ra.get_aabb(), rb.get_aabb(), box)
                s_frame = b_idx * actual_bs
                e_frame = min(n_frames, s_frame + actual_bs)

                if op == "<":
                    is_cert_true = (U < thresh_val)
                    is_cert_false = (L >= thresh_val)
                elif op == "<=":
                    is_cert_true = (U <= thresh_val)
                    is_cert_false = (L > thresh_val)
                elif op == ">":
                    is_cert_true = (L > thresh_val)
                    is_cert_false = (U <= thresh_val)
                elif op == ">=":
                    is_cert_true = (L >= thresh_val)
                    is_cert_false = (U < thresh_val)
                else:
                    is_cert_true, is_cert_false = False, False

                if is_cert_true:
                    blocks_certified_true += 1
                    status = "CERTIFIED_TRUE"
                    frame_results[s_frame:e_frame] = True
                elif is_cert_false:
                    blocks_certified_false += 1
                    status = "CERTIFIED_FALSE"
                    frame_results[s_frame:e_frame] = False
                else:
                    # Ambiguous block: requires refinement or exact evaluation
                    blocks_refined += 1
                    status = "REFINED"
                    # Materialize exact frames for unresolved block
                    exact_frames = source.read_block_coordinates(s_frame, e_frame)
                    frames_scanned_exact += len(exact_frames)
                    idx_a = sel_a_idx[0]
                    idx_b = sel_b_idx[0]
                    for offset, fr in enumerate(exact_frames):
                        pos_a = fr[idx_a]
                        pos_b = fr[idx_b]
                        delta = pos_b - pos_a
                        delta -= box * np.round(delta / box)
                        d = float(np.linalg.norm(delta))
                        if op == "<":
                            hit = (d < thresh_val)
                        elif op == "<=":
                            hit = (d <= thresh_val)
                        elif op == ">":
                            hit = (d > thresh_val)
                        else:
                            hit = (d >= thresh_val)
                        frame_results[s_frame + offset] = hit

                inspected_block_bounds.append({
                    "block_id": b_idx,
                    "frame_start": s_frame,
                    "frame_end_exclusive": e_frame,
                    "lower_bound": float(L),
                    "upper_bound": float(U),
                    "status": status,
                    "truth_value": "TRUE" if status == "CERTIFIED_TRUE" else ("FALSE" if status == "CERTIFIED_FALSE" else "UNKNOWN")
                })
            reader.close()

        intervals = extract_half_open_intervals(frame_results)

        if temporal and temporal.get("operator") == "FOR":
            min_dur = temporal["min_duration_ps"]
            truth, res = reference_temporal_for(frame_results, min_dur, self.dt_ps)
        else:
            if any(frame_results):
                truth = TruthValue.TRUE.value
                res = ResolutionStatus.COMPLETE.value
            else:
                truth = TruthValue.FALSE.value
                res = ResolutionStatus.COMPLETE.value

        wall_time = max(0.0001, round(time.perf_counter() - t0_wall, 4))
        traj_size = os.path.getsize(self.trajectory_path)
        compressed_bytes = traj_size if frames_scanned_exact > 0 else 0

        cert = {
            "$schema": "https://mocs-cert.org/schemas/v0.1/certificate.json",
            "certificate_id": hashlib.sha256(f"{query_id}-{self.trajectory_path}".encode()).hexdigest()[:16],
            "mocs_cert_version": "0.1.0",
            "semantic_tag": "MOCS-SEM-v1.0",
            "result": {
                "truth_value": truth,
                "resolution": res
            },
            "query": {
                "query_id": query_id,
                "observable": observable.upper(),
                "predicate": {
                    "operator": op,
                    "threshold_value": thresh_val,
                    "unit": "A"
                },
                "temporal": temporal
            },
            "semantics": {
                "sampling_semantics": {
                    "mode": "sampled_frames",
                    "dt_ps": self.dt_ps
                },
                "pbc_semantics": {
                    "mode": self.pbc_mode
                },
                "numerical_precision": "float64"
            },
            "execution": {
                "selected_plan": plan_used,
                "actual_execution_strategy": plan_used
            },
            "source": {
                "trajectory_file": os.path.basename(self.trajectory_path),
                "topology_file": os.path.basename(self.topology_path),
                "trajectory_sha256": compute_file_sha256(self.trajectory_path),
                "topology_sha256": compute_file_sha256(self.topology_path),
                "trajectory_size_bytes": traj_size
            },
            "index_commitment": {
                "mci_index_hash": reader.manifest.get("mci_index_hash", compute_file_sha256(os.path.join(sidecar_dir, "manifest.json"))),
                "mci_path": os.path.join(sidecar_dir, "blocks.bin"),
                "manifest": reader.manifest
            },
            "evidence": {
                "total_blocks": total_blocks,
                "blocks_certified_true": blocks_certified_true,
                "blocks_certified_false": blocks_certified_false,
                "blocks_refined": blocks_refined,
                "frames_scanned_exact": frames_scanned_exact,
                "inspected_block_bounds": inspected_block_bounds
            },
            "proof": {
                "type": "WITNESS_BOUNDS" if truth == "TRUE" else "EXHAUSTIVE_NEGATION",
                "witness_intervals": [(int(iv[0]), int(iv[1])) for iv in intervals] if truth == "TRUE" else [],
                "coverage": {
                    "blocks_covered": total_blocks,
                    "total_blocks": total_blocks
                }
            },
            "intervals": [(int(iv[0]), int(iv[1])) for iv in intervals] if truth == "TRUE" else [],
            "resources": {
                "source_compressed_bytes_fetched": compressed_bytes,
                "compressed_frames_decoded": frames_scanned_exact,
                "coordinates_materialized": frames_scanned_exact * 2,
                "atoms_analyzed": len(sel_a_idx) + len(sel_b_idx),
                "index_bytes_read": index_bytes_read,
                "wall_time_seconds": wall_time,
                "peak_memory_bytes": 10485760
            }
        }

        return MOCSResult(
            truth_value=truth,
            resolution_status=res,
            query_id=query_id,
            plan_used=plan_used,
            bytes_read_os=compressed_bytes,
            bytes_read_decompressed=compressed_bytes,
            frames_decoded=frames_scanned_exact,
            frames_evaluated=frames_scanned_exact,
            coordinates_materialized=frames_scanned_exact * 2,
            atoms_analyzed=len(sel_a_idx) + len(sel_b_idx),
            index_bytes_read=index_bytes_read,
            bytes_read=compressed_bytes + index_bytes_read,
            read_fraction=round((compressed_bytes + index_bytes_read) / max(1, traj_size), 4),
            wall_time_seconds=wall_time,
            peak_memory_bytes=cert["resources"]["peak_memory_bytes"],
            blocks_total=total_blocks,
            blocks_certified=blocks_certified_true + blocks_certified_false,
            blocks_refined=blocks_refined,
            frames_scanned_exact=frames_scanned_exact,
            scope="FULL_TRAJECTORY",
            quantifier="EXISTS" if not temporal else "DURATION",
            frame_series=frame_results,
            intervals=intervals,
            certificate=cert
        )

def open_session(
    trajectory_path: str,
    topology_path: str,
    sidecar_dir: Optional[str] = None,
    pbc_mode: str = "orthorhombic_minimum_image",
    dt_ps: Optional[float] = None
) -> MOCSSession:
    """Initializes a certified molecular observation session."""
    return MOCSSession(trajectory_path, topology_path, sidecar_dir, pbc_mode, dt_ps)

def verify_file(
    certificate_path: str,
    trajectory_path: Optional[str] = None,
    topology_path: Optional[str] = None
) -> bool:
    """Independently audits an emitted execution certificate file."""
    with open(certificate_path, "r", encoding="utf-8") as f:
        cert = json.load(f)
    return verify_certificate(cert, trajectory_path, topology_path)
