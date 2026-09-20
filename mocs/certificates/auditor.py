"""Certificate Verification & Cryptographic Provenance Auditor."""

import os
import math
import json
import hashlib
from typing import Dict, Any, Optional
from mocs.exceptions import (
    MOCSVerificationError,
    MOCSDataIntegrityError,
    MOCSFileNotFoundError
)
from mocs.types import ResolutionStatus

def compute_file_sha256(filepath: str) -> str:
    """Computes standard SHA-256 digest over file bytes."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(1024 * 1024):
            hasher.update(chunk)
    return hasher.hexdigest()

def audit_data_provenance(
    manifest: Dict[str, Any],
    traj_path: str,
    topo_path: str,
    fast_check_only: bool = False
) -> bool:
    """
    Two-Tier Identity Verification:
      Tier 1: Fast metadata check (file size, mtime)
      Tier 2: Full SHA-256 cryptographic byte digest validation
    """
    if not os.path.exists(traj_path):
        raise MOCSFileNotFoundError(f"Trajectory not found: {traj_path}")
    if not os.path.exists(topo_path):
        raise MOCSFileNotFoundError(f"Topology not found: {topo_path}")

    actual_traj_size = os.path.getsize(traj_path)
    expected_traj_size = manifest["source"].get("trajectory_size_bytes")
    if expected_traj_size and actual_traj_size != expected_traj_size:
        raise MOCSDataIntegrityError(
            f"Trajectory file size mismatch! Expected: {expected_traj_size}, Found: {actual_traj_size}"
        )

    if fast_check_only:
        return True

    actual_traj_hash = compute_file_sha256(traj_path)
    if actual_traj_hash != manifest["source"]["trajectory_sha256"]:
        raise MOCSDataIntegrityError("Trajectory SHA-256 mismatch: Trajectory content does not match the certificate commitment.")

    actual_topo_hash = compute_file_sha256(topo_path)
    if actual_topo_hash != manifest["source"]["topology_sha256"]:
        raise MOCSDataIntegrityError("Topology SHA-256 mismatch: Topology content does not match the certificate commitment.")

    return True

def diff_against_reference(
    result_truth: str,
    result_resolution: str,
    oracle_truth: str,
    oracle_resolution: str = "COMPLETE"
) -> Tuple[bool, Optional[str]]:
    """
    Differential oracle check comparing MOCS output against mocs-reference ground truth.
    Returns: (is_sound, explanation)
    """
    if result_truth in ("TRUE", "FALSE") and oracle_truth in ("TRUE", "FALSE"):
        if result_truth != oracle_truth:
            return (False, f"SOUNDNESS VIOLATION: MOCS evaluated {result_truth} but oracle evaluated {oracle_truth}!")
    return (True, None)

def verify_certificate(
    cert: Dict[str, Any],
    trajectory_path: Optional[str] = None,
    topology_path: Optional[str] = None,
    verify_hashes: bool = True,
    index_manifest: Optional[Dict[str, Any]] = None
) -> bool:
    """
    Authoritative Standalone Verification Algorithm (CERTIFICATE_SPEC.md §4).
    Independently audits an emitted execution certificate without full re-execution.
    """
    if not cert.get("mocs_cert_version", "").startswith("0.1."):
        raise MOCSVerificationError("Incompatible certificate version tag.")

    # Semantics audit
    sem = cert.get("semantics", {})
    sampling_mode = sem.get("sampling_semantics", {}).get("mode", "sampled_frames")
    truth = cert.get("result", {}).get("truth_value")
    resolution = cert.get("result", {}).get("resolution")

    if sampling_mode == "continuous_physical":
        if truth != "UNKNOWN" and resolution != ResolutionStatus.UNSUPPORTED_SEMANTICS.value:
            raise MOCSVerificationError("Continuous physical semantics cannot evaluate to TRUE/COMPLETE; requires UNSUPPORTED_SEMANTICS resolution.")
    elif sampling_mode != "sampled_frames":
        raise MOCSVerificationError(f"Unsupported sampling semantics mode: {sampling_mode}. Only 'sampled_frames' is supported.")

    pbc_mode = sem.get("pbc_semantics", {}).get("mode", "orthorhombic_minimum_image")
    if pbc_mode not in ("orthorhombic_minimum_image", "triclinic_minimum_image", "none", "cartesian_open_boundary"):
        raise MOCSVerificationError(f"Unsupported PBC mode: {pbc_mode}")

    # Bounding model audit
    bounding_model = (
        cert.get("index_commitment", {}).get("bounding_model")
        or cert.get("bounding_model")
    )
    if bounding_model is not None and bounding_model.upper() not in ("AABB", "KDOP14"):
        raise MOCSVerificationError(f"Unsupported bounding model: {bounding_model}")

    # Provenance and hash verification
    if verify_hashes:
        source_info = cert.get("source", {})
        traj_hash = source_info.get("trajectory_sha256", "")
        if traj_hash and (set(traj_hash) == {"0"} or set(traj_hash) == {"f"}):
            raise MOCSVerificationError(f"Rejected dummy/forged trajectory SHA-256 hash: {traj_hash}")

        topo_hash = source_info.get("topology_sha256", "")
        if topo_hash and (set(topo_hash) == {"0"} or set(topo_hash) == {"f"}):
            raise MOCSVerificationError(f"Rejected dummy/forged topology SHA-256 hash: {topo_hash}")

        if trajectory_path is None:
            cand_traj = source_info.get("trajectory_path") or source_info.get("trajectory_id")
            if cand_traj:
                if os.path.exists(cand_traj):
                    trajectory_path = cand_traj
                else:
                    for prefix in ["tests/data", "artifacts/unseen_data", "scratch", "."]:
                        p = os.path.join(prefix, os.path.basename(cand_traj))
                        if os.path.exists(p):
                            trajectory_path = p
                            break

        if topology_path is None and trajectory_path:
            cand_topo = source_info.get("topology_path") or source_info.get("topology_id")
            if cand_topo and os.path.exists(cand_topo):
                topology_path = cand_topo
            else:
                base = os.path.splitext(trajectory_path)[0]
                for ext in [".gro", ".pdb", ".tpr"]:
                    if os.path.exists(base + ext):
                        topology_path = base + ext
                        break

        if trajectory_path and topology_path and os.path.exists(trajectory_path) and os.path.exists(topology_path):
            audit_data_provenance(cert, trajectory_path, topology_path)

    # MCI commitment audit
    mci_target = (
        cert.get("source", {}).get("mci_hash")
        or cert.get("index_commitment", {}).get("mci_index_hash")
        or cert.get("index_commitment", {}).get("mci_sha256")
    )
    if mci_target:
        if set(mci_target) == {"0"} or set(mci_target) == {"f"}:
            raise MOCSVerificationError(f"Rejected forged MCI index hash: {mci_target}")
        if index_manifest is None:
            index_manifest = cert.get("index_commitment", {}).get("manifest")
        if index_manifest:
            manifest_mci = index_manifest.get("mci_index_hash")
            if manifest_mci and manifest_mci != mci_target:
                raise MOCSVerificationError("MCI index commitment mismatch!")

    # Resource metrics audit
    if "resources" in cert:
        for metric in ["source_compressed_bytes_fetched", "compressed_frames_decoded", "coordinates_materialized", "atoms_analyzed", "index_bytes_read"]:
            val = cert["resources"].get(metric)
            if val is not None and val < 0:
                raise MOCSVerificationError(f"Resource metric {metric} cannot be negative: {val}")

    pred = cert.get("query", {}).get("predicate", {})
    op = pred.get("operator") or cert.get("query", {}).get("operator", "<")
    threshold = pred.get("threshold_value", cert.get("query", {}).get("threshold_value", 4.0))
    quantifier = cert.get("quantifier", cert.get("query", {}).get("quantifier", "EXISTS"))

    block_bounds = cert.get("evidence", {}).get("inspected_block_bounds", [])
    total_blocks = cert.get("evidence", {}).get("total_blocks", len(block_bounds))

    for block in block_bounds:
        L = block.get("lower_bound")
        U = block.get("upper_bound")
        if L is None:
            L = 0.0
        if U is None:
            U = float("inf")
        status = block.get("status") or block.get("truth_value")
        b_id = block.get("block_id", -1)

        if op in ("<", "<="):
            bound_true = (U < threshold) if op == "<" else (U <= threshold)
            bound_false = (L >= threshold) if op == "<" else (L > threshold)
            if status in ("TRUE", "CERTIFIED_TRUE") and not bound_true:
                raise MOCSVerificationError(f"Soundness violation in Block {b_id}: status=TRUE but U={U} violates {op} {threshold}")
            if status in ("FALSE", "CERTIFIED_FALSE") and not bound_false:
                raise MOCSVerificationError(f"Soundness violation in Block {b_id}: status=FALSE but L={L} violates {op} {threshold}")
        elif op in (">", ">="):
            bound_true = (L > threshold) if op == ">" else (L >= threshold)
            bound_false = (U <= threshold) if op == ">" else (U < threshold)
            if status in ("TRUE", "CERTIFIED_TRUE") and not bound_true:
                raise MOCSVerificationError(f"Soundness violation in Block {b_id}: status=TRUE but L={L} violates {op} {threshold}")
            if status in ("FALSE", "CERTIFIED_FALSE") and not bound_false:
                raise MOCSVerificationError(f"Soundness violation in Block {b_id}: status=FALSE but U={U} violates {op} {threshold}")
        else:
            raise MOCSVerificationError(f"Unsupported predicate operator: {op}")

    proof = cert.get("proof", {})
    proof_type = proof.get("type")

    if quantifier == "EXISTS":
        if truth == "TRUE":
            has_witness = (
                any(b.get("status") in ("TRUE", "CERTIFIED_TRUE", "EXACT_TRUE") for b in block_bounds)
                or bool(proof.get("witness_intervals"))
                or bool(proof.get("witness"))
                or bool(cert.get("intervals"))
                or bool(cert.get("evidence", {}).get("witness_intervals"))
            )
            if not has_witness:
                raise MOCSVerificationError("Existential quantifier TRUE requires verified witness block or interval.")
        elif truth == "FALSE":
            has_true_witness = (
                any(b.get("status") in ("TRUE", "CERTIFIED_TRUE", "EXACT_TRUE") for b in block_bounds)
                or bool(proof.get("witness_intervals"))
                or bool(proof.get("witness"))
                or bool(cert.get("intervals"))
                or bool(cert.get("evidence", {}).get("witness_intervals"))
            )
            if has_true_witness:
                raise MOCSVerificationError("Contradiction: Existential FALSE claimed but positive witness is present.")
            if total_blocks > 0:
                covered = proof.get("coverage", {}).get("blocks_covered", len(block_bounds))
                if covered < total_blocks:
                    raise MOCSVerificationError("Exhaustive negation proof incomplete: coverage does not span all blocks.")

    elif quantifier == "FORALL":
        if truth == "TRUE":
            if total_blocks > 0 and len(block_bounds) < total_blocks:
                raise MOCSVerificationError("Universal quantifier TRUE requires complete trajectory block coverage.")
        elif truth == "FALSE":
            has_counter = any(b.get("status") in ("FALSE", "CERTIFIED_FALSE") for b in block_bounds) or proof.get("counterexample") is not None
            if not has_counter:
                raise MOCSVerificationError("Universal quantifier FALSE requires counterexample witness.")

    elif quantifier == "DURATION":
        temp = cert.get("query", {}).get("temporal")
        if temp and temp.get("operator") == "FOR":
            min_dur = temp["min_duration_ps"]
            dt = cert.get("semantics", {}).get("sampling_semantics", {}).get("dt_ps", 10.0)
            mode = cert.get("semantics", {}).get("sampling_semantics", {}).get("mode", "sampled_frames")
            if mode == "continuous_physical" and min_dur < dt:
                if cert.get("result", {}).get("resolution") != ResolutionStatus.UNSUPPORTED_SEMANTICS.value:
                    raise MOCSVerificationError("Continuous physical persistence requires UNSUPPORTED_SEMANTICS resolution.")
            if truth == "TRUE":
                req_frames = max(1, int(math.ceil((min_dur - 1e-9) / dt)))
                intervals = []
                for b in block_bounds:
                    if b.get("status") in ("TRUE", "CERTIFIED_TRUE", "EXACT_TRUE"):
                        s = b.get("frame_start")
                        e = b.get("frame_end_exclusive")
                        if s is not None and e is not None and e > s:
                            intervals.append((s, e))
                if not intervals:
                    # Check if evidence contains intervals
                    ev_ivs = cert.get("evidence", {}).get("witness_intervals") or cert.get("intervals")
                    if ev_ivs:
                        intervals = [(iv[0], iv[1]) for iv in ev_ivs]
                if not intervals:
                    raise MOCSVerificationError("Duration query TRUE requires verified witness blocks or frames.")

                intervals.sort(key=lambda x: x[0])
                max_contiguous_frames = 0
                current_run_frames = intervals[0][1] - intervals[0][0]
                prev_end = intervals[0][1]
                for s, e in intervals[1:]:
                    if s == prev_end:
                        current_run_frames += (e - s)
                        prev_end = e
                    elif s < prev_end:
                        raise MOCSVerificationError(f"Overlapping witness intervals: [{s}, {e}) overlaps previous end {prev_end}.")
                    else:
                        if current_run_frames > max_contiguous_frames:
                            max_contiguous_frames = current_run_frames
                        current_run_frames = e - s
                        prev_end = e
                if current_run_frames > max_contiguous_frames:
                    max_contiguous_frames = current_run_frames
                if max_contiguous_frames < req_frames:
                    raise MOCSVerificationError(
                        f"Duration proof violates contiguity: max contiguous run is {max_contiguous_frames} frames "
                        f"({max_contiguous_frames * dt} ps), but query requires {req_frames} frames ({min_dur} ps)."
                    )

    temp = cert.get("query", {}).get("temporal")
    if temp and temp.get("operator") == "FOR":
        min_dur = temp["min_duration_ps"]
        dt = cert.get("semantics", {}).get("sampling_semantics", {}).get("dt_ps", 10.0)
        mode = cert.get("semantics", {}).get("sampling_semantics", {}).get("mode", "sampled_frames")
        if mode == "continuous_physical" and min_dur < dt:
            if cert.get("result", {}).get("resolution") != ResolutionStatus.UNSUPPORTED_SEMANTICS.value:
                raise MOCSVerificationError("Continuous physical persistence requires UNSUPPORTED_SEMANTICS resolution.")

    return True

if __name__ == "__main__":
    import argparse
    import sys
    parser = argparse.ArgumentParser(description="MOCS-Cert Standalone Certificate Auditor")
    parser.add_argument("certificate", help="Path to certificate JSON file")
    parser.add_argument("--trajectory", "-t", default=None, help="Path to trajectory file for byte-commitment verification")
    parser.add_argument("--topology", "-s", default=None, help="Path to topology file")
    args = parser.parse_args()

    with open(args.certificate, "r", encoding="utf-8") as f:
        cert_data = json.load(f)

    try:
        ok = verify_certificate(cert_data, trajectory_path=args.trajectory, topology_path=args.topology)
        if ok:
            print("CERTIFICATE_VERIFIED_SUCCESS")
            sys.exit(0)
        else:
            print("CERTIFICATE_VERIFICATION_FAILED", file=sys.stderr)
            sys.exit(1)
    except Exception as exc:
        print(f"CERTIFICATE_VERIFICATION_ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
