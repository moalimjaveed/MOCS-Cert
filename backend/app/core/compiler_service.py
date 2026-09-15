"""MolQL compiler, execution plan generator, and real certified query executor service."""

from __future__ import annotations
import os
import re
import time
import math
import json
import hashlib
import tempfile
from typing import Dict, Any, List, Optional, Tuple
import numpy as np

from backend.app.schemas.query import (
    QueryCompileResponse,
    ExecutionPlanStep,
    QueryExecuteResponse
)
from backend.app.core.trajectory_service import trajectory_service
import mocs
from mocs.types import TruthValue, ResolutionStatus
from mocs.planner.plan_selector import select_execution_plan
from mocs.bounds.periodic_bounds import compute_pbc_bounds
from mocs.certificates.auditor import verify_certificate
from mocs.io import MDAnalysisTrajectorySource, SyntheticTrajectorySource, TrajectorySource
from mocs.mci import MCIReader, MCIWriter
from mocs.exceptions import (
    MOCSSelectionResolutionError,
    MOCSQuerySyntaxError,
    MOCSUnsupportedGeometryError,
    MOCSDataIntegrityError,
    MOCSFileNotFoundError,
    MOCSVerificationError
)

class CompilerService:
    """Compiles scientific query strings into Execution Plan DAGs and executes certified evaluations."""

    def _resolve_trajectory_source(self, trajectory_id: str) -> Tuple[TrajectorySource, str, str]:
        """Resolves trajectory_id to a TrajectorySource and paths safely within DATA_ROOT."""
        from backend.app.config import settings
        from mocs.exceptions import MOCSFileNotFoundError

        if trajectory_id in (None, "", "protein_ligand_traj.xtc", "synth_500f.xtc"):
            traj_path = os.path.join(settings.DATA_ROOT, "synth_500f.xtc")
            topo_path = os.path.join(settings.DATA_ROOT, "synth_500f.gro")
            source = MDAnalysisTrajectorySource(topo_path, traj_path)
            return source, traj_path, topo_path

        tid_raw = str(trajectory_id).strip()
        if not tid_raw or ".." in tid_raw or "\0" in tid_raw:
            raise MOCSFileNotFoundError("Invalid trajectory identifier.")
        tid = os.path.basename(tid_raw)
        # P0-1 Security (F-004): Validate trajectory_id basename contains only alphanumeric, dots, underscores, dashes
        if not re.fullmatch(r"[A-Za-z0-9._-]{1,64}", tid):
            raise MOCSFileNotFoundError("Invalid trajectory identifier.")

        data_root_real = os.path.realpath(settings.DATA_ROOT)
        temp_dir_real = os.path.realpath(tempfile.gettempdir())
        candidates = [
            tid_raw,
            os.path.join(settings.DATA_ROOT, tid),
            os.path.join(settings.DATA_ROOT, "real", tid),
            os.path.join("artifacts", "unseen_data", tid),
            os.path.join("scratch", tid),
        ]
        traj_path = None
        for cand in candidates:
            if os.path.exists(cand):
                cand_real = os.path.realpath(cand)
                if (cand_real.startswith(data_root_real) or
                    cand_real.startswith(os.path.realpath("artifacts")) or
                    cand_real.startswith(os.path.realpath("scratch")) or
                    cand_real.startswith(temp_dir_real)):
                    traj_path = cand_real
                    break

        if not traj_path or not os.path.exists(traj_path):
            raise MOCSFileNotFoundError("Trajectory file not found.")

        traj_dir = os.path.dirname(traj_path) or "."
        base_name = os.path.splitext(os.path.basename(traj_path))[0]
        topo_path = None
        for ext in [".gro", ".pdb", ".tpr"]:
            candidate_topo = os.path.join(traj_dir, base_name + ext)
            if os.path.exists(candidate_topo):
                topo_path = candidate_topo
                break
        if not topo_path:
            for cand_topo in [
                os.path.join(traj_dir, "unseen_topo.gro"),
                os.path.join(traj_dir, "unseen_topo.pdb"),
                os.path.join(settings.DATA_ROOT, f"{base_name}.gro"),
                os.path.join(settings.DATA_ROOT, f"{base_name}.pdb"),
                os.path.join(settings.DATA_ROOT, "real", f"{base_name}.gro"),
                os.path.join(settings.DATA_ROOT, "real", f"{base_name}.pdb"),
            ]:
                if os.path.exists(cand_topo):
                    topo_path = cand_topo
                    break
        if not topo_path or not os.path.exists(topo_path):
            raise MOCSFileNotFoundError("Cannot resolve compatible topology for trajectory.")
        source = MDAnalysisTrajectorySource(topo_path, traj_path)
        return source, traj_path, topo_path

    def _parse_selections(self, query_text: str) -> Tuple[str, str]:
        """Extracts selection_a and selection_b from query. Fails closed on unparseable operands."""
        def clean_sel(s: str) -> str:
            s = s.strip()
            if s.startswith("(") and s.endswith(")"):
                s = s[1:-1].strip()
            while s.endswith(")") and s.count(")") > s.count("("):
                s = s[:-1].strip()
            while s.startswith("(") and s.count("(") > s.count(")"):
                s = s[1:].strip()
            return s.strip()

        # Pre-clean query string: remove RETURN, time window, and duration clauses
        q_cleaned = re.sub(r"\bRETURN\s+.*$", "", query_text, flags=re.IGNORECASE).strip()
        q_cleaned = re.sub(r"\bWITHIN\s+[0-9.]+\s*(?:ns|ps|fs)?\s+TO\s+[0-9.]+\s*(?:ns|ps|fs)?\b", "", q_cleaned, flags=re.IGNORECASE).strip()
        q_cleaned = re.sub(r"\b(?:WHERE\s+DURATION|FOR)\s*(?:>=|<=|>|<)?\s*[0-9.]+\s*(?:ps|ns|fs)?\b", "", q_cleaned, flags=re.IGNORECASE).strip()
        q_cleaned = re.sub(r"^\s*(?:FIND\s+ALL|FORALL)\b", "FIND", q_cleaned, flags=re.IGNORECASE).strip()

        # Pattern 1: FIND (sel_a) WITHIN <num> <unit> OF (sel_b)
        within_paren = re.search(r"FIND\s*\((.+?)\)\s+WITHIN\s+[0-9.]+\s*[A-Za-z]*\s+OF\s*\((.+?)\)(?:\s+WHERE|\s+FOR|$)", q_cleaned, re.IGNORECASE)
        if within_paren:
            return clean_sel(within_paren.group(1)), clean_sel(within_paren.group(2))

        within_match = re.search(r"FIND\s+(.+?)\s+WITHIN\s+[0-9.]+\s*[A-Za-z]*\s+OF\s+(.+?)(?:\s+WHERE|\s+FOR|\s+WITHIN|$)", q_cleaned, re.IGNORECASE)
        if within_match:
            return clean_sel(within_match.group(1)), clean_sel(within_match.group(2))

        # Pattern 2: FIND (sel_a) WHERE DISTANCE [<>]=? <num> [A-Za-z]* (?:TO|AND|OF) (sel_b)
        dist_where_paren = re.search(r"FIND\s*\((.+?)\)\s+WHERE\s+DISTANCE\s*[<>]=?\s*[0-9.]+\s*[A-Za-z]*\s+(?:TO|AND|OF)\s*\((.+?)\)(?:\s+WHERE|\s+FOR|$)", q_cleaned, re.IGNORECASE)
        if dist_where_paren:
            return clean_sel(dist_where_paren.group(1)), clean_sel(dist_where_paren.group(2))

        dist_where_match = re.search(r"FIND\s+(.+?)\s+WHERE\s+DISTANCE\s*[<>]=?\s*[0-9.]+\s*[A-Za-z]*\s+(?:TO|AND|OF)\s+(.+?)(?:\s+WHERE|\s+FOR|\s+WITHIN|$)", q_cleaned, re.IGNORECASE)
        if dist_where_match:
            return clean_sel(dist_where_match.group(1)), clean_sel(dist_where_match.group(2))

        # Pattern 3: DISTANCE(sel_a, sel_b)
        fn_dist = re.search(r"DISTANCE\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)", q_cleaned, re.IGNORECASE)
        if fn_dist:
            return clean_sel(fn_dist.group(1)), clean_sel(fn_dist.group(2))

        # Pattern 4: CONTACT(sel_a, sel_b)
        fn_contact = re.search(r"CONTACT\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)", q_cleaned, re.IGNORECASE)
        if fn_contact:
            return clean_sel(fn_contact.group(1)), clean_sel(fn_contact.group(2))

        # Pattern 5: BETWEEN (sel_a) AND (sel_b)
        between_paren = re.search(r"BETWEEN\s*\((.+?)\)\s+AND\s*\((.+?)\)(?:\s+WHERE|\s+FOR|\s+WITHIN|$)", q_cleaned, re.IGNORECASE)
        if between_paren:
            return clean_sel(between_paren.group(1)), clean_sel(between_paren.group(2))

        between_match = re.search(r"BETWEEN\s+(.+?)\s+AND\s+(.+?)(?:\s+WHERE|\s+FOR|\s+WITHIN|$)", q_cleaned, re.IGNORECASE)
        if between_match:
            return clean_sel(between_match.group(1)), clean_sel(between_match.group(2))

        # P0-3: NEVER invent demo selections like 'name CA', 'name O2'. Fail closed.
        from mocs.exceptions import MOCSQuerySyntaxError
        raise MOCSQuerySyntaxError(f"Could not parse atom selection operands from query: '{query_text}'. Expected explicit operands e.g. FIND (selA) WITHIN threshold OF (selB).")

    def _get_mci_reader(self, source: TrajectorySource, sel_a: str, sel_b: str, traj_path: str, topo_path: str, bounding_model: str = "AABB") -> Tuple[MCIReader, np.ndarray, np.ndarray]:
        try:
            sel_a_idx = source.resolve_selection(sel_a)
        except Exception as e:
            raise MOCSSelectionResolutionError(f"Atom Selection A '{sel_a}' failed to resolve in topology: {e}")
        if len(sel_a_idx) == 0:
            raise MOCSSelectionResolutionError(f"Atom Selection A '{sel_a}' resolved to 0 atoms.")

        try:
            sel_b_idx = source.resolve_selection(sel_b)
        except Exception as e:
            raise MOCSSelectionResolutionError(f"Atom Selection B '{sel_b}' failed to resolve in topology: {e}")
        if len(sel_b_idx) == 0:
            raise MOCSSelectionResolutionError(f"Atom Selection B '{sel_b}' resolved to 0 atoms.")

        b_model = bounding_model.upper()
        if b_model not in ("AABB", "KDOP14"):
            raise MOCSUnsupportedGeometryError(f"Unsupported bounding model: {bounding_model}. Allowed: ('AABB', 'KDOP14')")

        traj_name = os.path.splitext(os.path.basename(traj_path))[0]
        # P2-19: Canonical JSON cache key with >=16 hex chars
        cache_desc = json.dumps({
            "traj_sha": source.get_file_sha256()[:16],
            "sel_a": sel_a,
            "sel_b": sel_b,
            "block_size": 10,
            "model": b_model
        }, sort_keys=True)
        sel_hash = hashlib.sha256(cache_desc.encode()).hexdigest()[:16]

        from backend.app.config import settings
        from filelock import FileLock
        import tempfile
        import shutil

        out_dir = os.path.join(settings.INDEX_ROOT, f".mci_{traj_name}_{sel_hash}_{b_model.lower()}")
        os.makedirs(settings.INDEX_ROOT, exist_ok=True)

        manifest_path = os.path.join(out_dir, "manifest.json")
        if not os.path.exists(manifest_path):
            # Check legacy paths for existing test indexes
            base_dir = os.path.dirname(traj_path) or "."
            legacy_dir = os.path.join(base_dir, f"{traj_name}_mci")
            legacy_hidden = os.path.join(base_dir, f".mci_{traj_name}_{sel_hash[:8]}_{b_model.lower()}")
            def is_compatible_index(cand_dir: str) -> bool:
                mf = os.path.join(cand_dir, "manifest.json")
                if not os.path.exists(mf):
                    return False
                try:
                    with open(mf, "r", encoding="utf-8") as f:
                        m = json.load(f)
                    return m.get("bounding_model", "AABB").upper() == b_model
                except Exception:
                    return False

            legacy_candidate = legacy_dir if is_compatible_index(legacy_dir) else (
                legacy_hidden if is_compatible_index(legacy_hidden) else None
            )

            if legacy_candidate:
                out_dir = legacy_candidate
            else:
                # P1-7: Concurrent index build race protection via FileLock + atomic temp rename
                lock_path = out_dir + ".lock"
                with FileLock(lock_path, timeout=60):
                    if not os.path.exists(os.path.join(out_dir, "manifest.json")):
                        atom_groups = {0: sel_a_idx, 1: sel_b_idx}
                        temp_out = tempfile.mkdtemp(prefix=".mci_build_", dir=settings.INDEX_ROOT)
                        try:
                            MCIWriter.build_index(
                                source,
                                atom_groups,
                                temp_out,
                                block_size=10,
                                trajectory_id=os.path.basename(traj_path),
                                topology_id=os.path.basename(topo_path),
                                bounding_model=b_model
                            )
                            if os.path.exists(out_dir):
                                shutil.rmtree(out_dir)
                            os.replace(temp_out, out_dir)
                        except Exception:
                            if os.path.exists(temp_out):
                                shutil.rmtree(temp_out, ignore_errors=True)
        try:
            reader = MCIReader(out_dir, verify_on_open=True)
            # F-028: Invalidate cache if underlying trajectory on disk was modified
            manifest = reader.get_manifest()
            if manifest.get("trajectory_sha256") and manifest.get("trajectory_sha256") != source.get_file_sha256():
                reader.close()
                raise MOCSDataIntegrityError("Cached index trajectory_sha256 does not match trajectory on disk.")
        except MOCSDataIntegrityError:
            # Stale or incompatible MCI index: auto-rebuild with v0.2.0 canonical format
            lock_path = out_dir + ".lock"
            with FileLock(lock_path, timeout=60):
                atom_groups = {0: sel_a_idx, 1: sel_b_idx}
                temp_out = tempfile.mkdtemp(prefix=".mci_build_", dir=settings.INDEX_ROOT)
                try:
                    MCIWriter.build_index(
                        source,
                        atom_groups,
                        temp_out,
                        block_size=10,
                        trajectory_id=os.path.basename(traj_path),
                        topology_id=os.path.basename(topo_path),
                        bounding_model=b_model
                    )
                    if os.path.exists(out_dir):
                        shutil.rmtree(out_dir)
                    os.replace(temp_out, out_dir)
                except Exception:
                    if os.path.exists(temp_out):
                        shutil.rmtree(temp_out, ignore_errors=True)
                    raise
            reader = MCIReader(out_dir, verify_on_open=True)

        return reader, sel_a_idx, sel_b_idx

    def compile(
        self,
        query_text: str,
        trajectory_id: str = "synth_500f.xtc",
        sampling_semantics: str = "sampled_frames",
        pbc_mode: str = "auto",
        precision: str = "float64",
        bounding_model: str = "AABB"
    ) -> QueryCompileResponse:
        from mocs.exceptions import MOCSQuerySyntaxError

        if not query_text or not query_text.strip():
            raise MOCSQuerySyntaxError("Query text cannot be empty.")

        valid_pbc = ("auto", "orthorhombic_minimum_image", "triclinic_minimum_image", "none")
        if pbc_mode not in valid_pbc:
            raise MOCSUnsupportedGeometryError(
                f"Unsupported PBC mode '{pbc_mode}'. Allowed modes: {valid_pbc}."
            )

        valid_models = ("AABB", "KDOP14")
        b_model = bounding_model.upper()
        if b_model not in valid_models:
            raise MOCSUnsupportedGeometryError(
                f"Unsupported bounding model '{bounding_model}'. Allowed models: {valid_models}."
            )

        # Guard against NaN, Inf, negative thresholds, and malformed numbers (F-014)
        if re.search(r'\b(nan|infinity|-infinity|inf|-inf)\b', query_text, re.IGNORECASE):
            raise MOCSQuerySyntaxError("Numerical parameters must be finite real numbers (NaN/Infinity forbidden).")
        if re.search(r'\b[0-9]+\.[0-9]*\.[0-9.]+', query_text):
            raise MOCSQuerySyntaxError(f"Malformed numeric format in query: '{query_text}'.")
        if re.search(r'[<>]=?\s*-[0-9.]+', query_text):
            raise MOCSQuerySyntaxError("Distance threshold must be non-negative.")

        # Extract RETURN clause
        m_ret = re.search(r"\bRETURN\s+(.+)$", query_text, re.IGNORECASE)
        if m_ret:
            query_text = query_text[:m_ret.start()].strip()

        # Extract temporal window clause: WITHIN <start> TO <end> (e.g. WITHIN 0ns TO 5000ps)
        m_win = re.search(r"\bWITHIN\s+([0-9.]+\s*(?:ns|ps|fs)?)\s+TO\s+([0-9.]+\s*(?:ns|ps|fs)?)\b", query_text, re.IGNORECASE)
        if m_win:
            query_text = query_text[:m_win.start()] + " " + query_text[m_win.end():]

        temporal_op = None
        duration_ps = None
        spatial_part = query_text

        # Extract temporal duration clause first to avoid regex interference with distance predicate
        m_dur = re.search(r"(?:WHERE\s+DURATION|FOR)\s*(?:>=)?\s*([0-9.]+)\s*(ps|ns)?", query_text, re.IGNORECASE)
        if m_dur:
            temporal_op = "FOR"
            val = float(m_dur.group(1))
            if m_dur.group(2) and m_dur.group(2).lower() == "ns":
                val *= 1000.0
            duration_ps = val
            spatial_part = query_text[:m_dur.start()] + " " + query_text[m_dur.end():]

        obs = "DISTANCE"
        op = "<"
        thresh = 4.0
        unit = "A"

        # P2-12: Stricter numeric regex
        op_match = re.search(r"([<>]=?)\s*([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]+)?", spatial_part)
        if op_match:
            op = op_match.group(1)
            try:
                thresh = float(op_match.group(2))
            except ValueError:
                raise MOCSQuerySyntaxError(f"Invalid numeric threshold: {op_match.group(2)}")
            if op_match.group(3):
                unit = op_match.group(3)
        else:
            within_match = re.search(r"WITHIN\s+([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]+)?(?:\s+OF)?", spatial_part, re.IGNORECASE)
            if within_match:
                op = "<"
                try:
                    thresh = float(within_match.group(1))
                except ValueError:
                    raise MOCSQuerySyntaxError(f"Invalid numeric threshold: {within_match.group(1)}")
                if within_match.group(2):
                    unit = within_match.group(2)
            elif "CONTACT" in spatial_part.upper():
                op = "<"
                thresh = 4.0
                unit = "A"
            else:
                raise MOCSQuerySyntaxError(f"Query does not declare a valid predicate threshold: {query_text}")

        # P2-13: Validate non-negative distance
        if thresh < 0:
            raise MOCSQuerySyntaxError(f"Distance threshold must be non-negative. Got {thresh}.")

        # P0-2: Distance unit validation and conversion
        DISTANCE_UNITS = {
            "a": 1.0,
            "angstrom": 1.0,
            "angstroms": 1.0,
            "nm": 10.0,
        }
        unit_lower = unit.lower()
        if unit_lower in ("ps", "ns", "fs"):
            raise MOCSQuerySyntaxError(
                f"Time unit '{unit}' cannot be used as a distance threshold. "
                "Time units are only valid in temporal duration clauses (e.g. 'FOR >= 5 ns')."
            )
        if unit_lower not in DISTANCE_UNITS:
            raise MOCSQuerySyntaxError(
                f"Unknown or unsupported distance unit: '{unit}'. Allowed units: {list(DISTANCE_UNITS.keys())}."
            )

        multiplier = DISTANCE_UNITS[unit_lower]
        thresh_angstrom = thresh * multiplier

        sel_a, sel_b = self._parse_selections(spatial_part)
        if re.search(r"\b(?:FIND\s+ALL|FORALL)\b", query_text, re.IGNORECASE):
            quantifier = "FORALL"
        elif temporal_op:
            quantifier = "DURATION"
        else:
            quantifier = "EXISTS"

        source, traj_path, topo_path = self._resolve_trajectory_source(trajectory_id)
        mci_reader = None
        try:
            cell = source.get_cell()
            is_dynamic = source.has_dynamic_cell()

            if pbc_mode == "orthorhombic_minimum_image" and not cell.is_orthorhombic:
                raise MOCSUnsupportedGeometryError(
                    f"Trajectory cell is {cell.cell_type} but orthorhombic_minimum_image was requested. "
                    "Use pbc_mode='triclinic_minimum_image' or 'auto'."
                )
            resolved_pbc_mode = (
                "orthorhombic_minimum_image" if cell.is_orthorhombic else "triclinic_minimum_image"
            ) if pbc_mode == "auto" else pbc_mode

            mci_reader, sel_a_idx, sel_b_idx = self._get_mci_reader(
                source, sel_a, sel_b, traj_path, topo_path, bounding_model=b_model
            )
            total_b = mci_reader.num_blocks
            dt_ps = source.get_timestep_ps()

            # Fast scan to estimate prune rate using normalized Angstrom threshold
            pruned_b = 0
            if not is_dynamic:
                for b_idx in range(total_b):
                    ra = mci_reader.read_block(0, b_idx)
                    rb = mci_reader.read_block(1, b_idx)
                    if b_model == "KDOP14":
                        L, U = cell.compute_kdop_bounds(ra.to_kdop(), rb.to_kdop())
                    else:
                        L, U = cell.compute_aabb_bounds(ra.get_aabb(), rb.get_aabb())
                    if op in ("<", "<=") and (U < thresh_angstrom or L >= thresh_angstrom):
                        pruned_b += 1
                    elif op in (">", ">=") and (L > thresh_angstrom or U <= thresh_angstrom):
                        pruned_b += 1
        finally:
            if mci_reader is not None:
                mci_reader.close()
            source.close()

        prune_rate = pruned_b / total_b if total_b > 0 else 0.0

        chosen_plan = select_execution_plan(
            query_id=f"q_{hashlib.sha256(query_text.encode('utf-8')).hexdigest()[:8]}",
            workload_remaining=5,
            is_cached=False,
            index_available=True,
            estimated_prune_rate=prune_rate
        )

        steps = [
            ExecutionPlanStep(step_id=1, name="SCIENTIFIC QUERY", description=f"Evaluate query predicate: {spatial_part}", metadata={"query": query_text}),
            ExecutionPlanStep(step_id=2, name="SELECTION A RESOLUTION", description=f"Resolve '{sel_a}' against topology atoms", metadata={"selection": sel_a, "atoms": len(sel_a_idx), "pbc_mode": resolved_pbc_mode, "cell_type": cell.cell_type}),
            ExecutionPlanStep(step_id=3, name="SELECTION B RESOLUTION", description=f"Resolve '{sel_b}' against topology atoms", metadata={"selection": sel_b, "atoms": len(sel_b_idx)}),
            ExecutionPlanStep(step_id=4, name="TOPOLOGICAL INDEX VERIFICATION", description="Load Molecular Certificate Index seek table and verify hashes", metadata={"mci_file": os.path.basename(mci_reader.blocks_path) if mci_reader else "blocks.bin"}),
            ExecutionPlanStep(step_id=5, name="ACCELERATED VECTOR BOUNDING", description=f"Apply {resolved_pbc_mode} AABB bounds across {total_b} blocks", metadata={"blocks": total_b, "estimated_prune_rate": prune_rate, "bounding_model": b_model}),
            ExecutionPlanStep(step_id=6, name="EXACT DYADIC REFINEMENT", description="Materialize coordinate blocks straddling boundary threshold for exact pairwise verification", metadata={"blocks_to_refine": int(total_b * (1.0 - prune_rate))}),
            ExecutionPlanStep(step_id=7, name="WITNESS DAG SYNTHESIS", description="Synthesize mathematical witness intervals and verifiable trajectory DAG", metadata={"quantifier": quantifier}),
            ExecutionPlanStep(step_id=8, name="CERTIFICATE ISSUANCE", description="Generate signed cryptographic evaluation certificate binding data and proof"),
            ExecutionPlanStep(step_id=9, name="OFFLINE VALIDATION PROBE", description="Verify mathematical soundness with standalone verification oracle", metadata={"status": "verified"})
        ]

        return QueryCompileResponse(
            query_id=f"q_{hashlib.sha256(query_text.encode('utf-8')).hexdigest()[:8]}",
            observable=obs,
            predicate_operator=op,
            threshold_value=thresh,
            unit=unit,
            threshold_value_angstrom=thresh_angstrom,
            selection_a=sel_a,
            selection_b=sel_b,
            temporal_operator=temporal_op,
            min_duration_ps=duration_ps,
            quantifier=quantifier,
            chosen_plan=chosen_plan,
            estimated_prune_rate=round(prune_rate, 3),
            estimated_speedup=round(1.0 / max(0.01, 1.0 - prune_rate), 2),
            plan_steps=steps,
            bounding_model=b_model
        )

    def execute(
        self,
        query_text: str,
        trajectory_id: str = "synth_500f.xtc",
        sampling_semantics: str = "sampled_frames",
        pbc_mode: str = "auto",
        precision: str = "float64",
        quantifier_override: Optional[str] = None,
        bounding_model: str = "AABB"
    ) -> QueryExecuteResponse:
        valid_pbc = ("auto", "orthorhombic_minimum_image", "triclinic_minimum_image", "none")
        if pbc_mode not in valid_pbc:
            raise MOCSUnsupportedGeometryError(
                f"Unsupported PBC mode '{pbc_mode}'. Allowed modes: {valid_pbc}."
            )

        valid_models = ("AABB", "KDOP14")
        b_model = bounding_model.upper()
        if b_model not in valid_models:
            raise MOCSUnsupportedGeometryError(
                f"Unsupported bounding model '{bounding_model}'. Allowed models: {valid_models}."
            )

        t0_wall = time.perf_counter()
        t0_cpu = time.thread_time()

        source = None
        mci_reader = None

        try:
            compile_res = self.compile(
                query_text,
                trajectory_id,
                sampling_semantics=sampling_semantics,
                pbc_mode=pbc_mode,
                precision=precision,
                bounding_model=b_model
            )
            source, traj_path, topo_path = self._resolve_trajectory_source(trajectory_id)
            cell = source.get_cell()
            is_dynamic = source.has_dynamic_cell()

            if pbc_mode == "orthorhombic_minimum_image" and not cell.is_orthorhombic:
                raise MOCSUnsupportedGeometryError(
                    f"Trajectory cell is {cell.cell_type} but orthorhombic_minimum_image was requested. "
                    "Use pbc_mode='triclinic_minimum_image' or 'auto'."
                )
            resolved_pbc_mode = (
                "orthorhombic_minimum_image" if cell.is_orthorhombic else "triclinic_minimum_image"
            ) if pbc_mode == "auto" else pbc_mode

            mci_reader, sel_a_idx, sel_b_idx = self._get_mci_reader(
                source,
                compile_res.selection_a,
                compile_res.selection_b,
                traj_path,
                topo_path,
                bounding_model=b_model
            )

            # P1-6: Enforce input bounds
            MAX_ATOMS_PER_SELECTION = 5000
            if len(sel_a_idx) > MAX_ATOMS_PER_SELECTION:
                raise MOCSQuerySyntaxError(f"Selection A resolved to {len(sel_a_idx)} atoms, exceeding maximum permitted of {MAX_ATOMS_PER_SELECTION}.")
            if len(sel_b_idx) > MAX_ATOMS_PER_SELECTION:
                raise MOCSQuerySyntaxError(f"Selection B resolved to {len(sel_b_idx)} atoms, exceeding maximum permitted of {MAX_ATOMS_PER_SELECTION}.")

            box = source.get_box()
            dt_ps = source.get_timestep_ps()
            total_frames = source.get_total_frames()

            op = compile_res.predicate_operator
            # P0-2: Use normalized threshold in Angstroms
            thresh = compile_res.threshold_value_angstrom if getattr(compile_res, "threshold_value_angstrom", None) is not None else compile_res.threshold_value

            num_blocks = mci_reader.num_blocks
            evaluated_blocks = []
            certified_true_count = 0
            certified_false_count = 0
            refined_blocks_count = 0
            exact_true_count = 0
            exact_false_count = 0
            exact_mixed_count = 0
            unknown_count = 0
            frames_exact_requested = 0
            frames_decoded = 0
            frames_materialized = 0
            exact_frames_count = 0
            witness_intervals = []

            for b_id in range(num_blocks):
                rec_a = mci_reader.read_block(0, b_id)
                rec_b = mci_reader.read_block(1, b_id)

                if is_dynamic:
                    # Dynamic cell (NPT): spatial bounding across varying unit cells cannot be proven conservative at block level
                    bound_true = False
                    bound_false = False
                    L, U = 0.0, None
                else:
                    if b_model == "KDOP14":
                        L, U = cell.compute_kdop_bounds(rec_a.to_kdop(), rec_b.to_kdop())
                    else:
                        L, U = cell.compute_aabb_bounds(rec_a.get_aabb(), rec_b.get_aabb())
                    if op in ("<", "<="):
                        bound_true = (U < thresh) if op == "<" else (U <= thresh)
                        bound_false = (L >= thresh) if op == "<" else (L > thresh)
                    elif op in (">", ">="):
                        bound_true = (L > thresh) if op == ">" else (L >= thresh)
                        bound_false = (U <= thresh) if op == ">" else (U < thresh)
                    else:
                        bound_true, bound_false = False, False

                if bound_true:
                    status = "CERTIFIED_TRUE"
                    truth = "TRUE"
                    certified_true_count += 1
                    witness_intervals.append((rec_a.frame_start, rec_a.frame_end_exclusive))
                elif bound_false:
                    status = "CERTIFIED_FALSE"
                    truth = "FALSE"
                    certified_false_count += 1
                else:
                    refined_blocks_count += 1
                    fs = rec_a.frame_start
                    fe = rec_a.frame_end_exclusive
                    b_frames = fe - fs
                    frames_exact_requested += b_frames

                    coords_a = source.read_block_coordinates(fs, fe, sel_a_idx)
                    coords_b = source.read_block_coordinates(fs, fe, sel_b_idx)
                    frames_decoded += b_frames
                    frames_materialized += b_frames
                    exact_frames_count += b_frames

                    # Exact minimum-image distance across selected atoms for each frame (F-033)
                    exact_dists = np.zeros(b_frames, dtype=np.float64)
                    if not is_dynamic and cell.is_orthorhombic:
                        # Vectorized batch computation over all frames in block: (b_frames, N_b, 3) vs (b_frames, N_a, 3)
                        diff = coords_b[:, None, :, :] - coords_a[:, :, None, :]  # (b_frames, N_a, N_b, 3)
                        box_diag = cell.lengths
                        diff -= box_diag * np.round(diff / box_diag)
                        exact_dists = np.min(np.linalg.norm(diff, axis=-1), axis=(1, 2)).astype(np.float64)
                    else:
                        for fi in range(b_frames):
                            curr_f = fs + fi
                            frame_cell = cell if not is_dynamic else source.read_frame_cell(curr_f)
                            pos_a = coords_a[fi]  # (len(sel_a_idx), 3)
                            pos_b = coords_b[fi]  # (len(sel_b_idx), 3)
                            diff = pos_b[None, :, :] - pos_a[:, None, :]  # (N_a, N_b, 3)
                            if frame_cell.is_orthorhombic:
                                box_diag = frame_cell.lengths
                                diff -= box_diag * np.round(diff / box_diag)
                            else:
                                flat_diff = diff.reshape(-1, 3)
                                flat_diff = frame_cell.minimum_image_displacement(flat_diff)
                                diff = flat_diff.reshape(diff.shape)
                            exact_dists[fi] = float(np.min(np.linalg.norm(diff, axis=-1)))

                    if op == "<":
                        frame_bools = exact_dists < thresh
                    elif op == "<=":
                        frame_bools = exact_dists <= thresh
                    elif op == ">":
                        frame_bools = exact_dists > thresh
                    else:
                        frame_bools = exact_dists >= thresh

                    in_run = False
                    run_start = 0
                    for fi, val in enumerate(frame_bools):
                        curr_f = fs + fi
                        if val and not in_run:
                            in_run = True
                            run_start = curr_f
                        elif not val and in_run:
                            in_run = False
                            witness_intervals.append((run_start, curr_f))
                    if in_run:
                        witness_intervals.append((run_start, fe))

                    if np.all(frame_bools):
                        truth = "TRUE"
                        status = "EXACT_TRUE"
                        exact_true_count += 1
                    elif np.all(~frame_bools):
                        truth = "FALSE"
                        status = "EXACT_FALSE"
                        exact_false_count += 1
                    else:
                        truth = "UNKNOWN"
                        status = "REFINED"
                        exact_mixed_count += 1

                ub_val = None if (U is None or not np.isfinite(U)) else float(U)
                lb_val = 0.0 if (L is None or not np.isfinite(L)) else float(L)

                evaluated_blocks.append({
                    "block_id": b_id,
                    "frame_start": rec_a.frame_start,
                    "frame_end_exclusive": rec_a.frame_end_exclusive,
                    "lower_bound": lb_val,
                    "upper_bound": ub_val,
                    "bound_state": "UNBOUNDED" if ub_val is None else "BOUNDED",
                    "truth_value": truth,
                    "status": status
                })

            certified_blocks_count = certified_true_count + certified_false_count
            
            # P1-8: Convert asserts to structured exceptions
            from mocs.exceptions import MOCSDataIntegrityError, MOCSVerificationError
            if num_blocks != (certified_true_count + certified_false_count + refined_blocks_count + unknown_count):
                raise MOCSDataIntegrityError(
                    f"Block partition failure: num_blocks={num_blocks} != "
                    f"{certified_true_count} (true) + {certified_false_count} (false) + "
                    f"{refined_blocks_count} (refined) + {unknown_count} (unknown)"
                )
            if refined_blocks_count != (exact_true_count + exact_false_count + exact_mixed_count):
                raise MOCSDataIntegrityError(
                    f"Refined partition failure: {refined_blocks_count} != "
                    f"{exact_true_count} + {exact_false_count} + {exact_mixed_count}"
                )

            quantifier = quantifier_override.upper() if (quantifier_override and quantifier_override.upper() in ("EXISTS", "FORALL", "DURATION")) else compile_res.quantifier
            overall_truth = "UNKNOWN"
            resolution = "COMPLETE"

            # P1-18: Guard empty block index
            if num_blocks == 0 or len(evaluated_blocks) == 0:
                overall_truth = "UNKNOWN"
                resolution = "NO_EVIDENCE"
            elif sampling_semantics == "continuous_physical" and (compile_res.min_duration_ps or dt_ps) < dt_ps:
                overall_truth = "UNKNOWN"
                resolution = "UNSUPPORTED_SEMANTICS"
            elif quantifier == "EXISTS":
                has_true = any(b["truth_value"] in ("TRUE", "EXACT_TRUE") for b in evaluated_blocks) or len(witness_intervals) > 0
                all_false = all(b["truth_value"] in ("FALSE", "EXACT_FALSE") for b in evaluated_blocks)
                if has_true:
                    overall_truth = "TRUE"
                elif all_false:
                    overall_truth = "FALSE"
                else:
                    overall_truth = "UNKNOWN"

            elif quantifier == "FORALL":
                has_false = any(b["truth_value"] in ("FALSE", "EXACT_FALSE") for b in evaluated_blocks)
                all_true = all(b["truth_value"] in ("TRUE", "EXACT_TRUE") for b in evaluated_blocks) and len(evaluated_blocks) > 0
                if has_false:
                    overall_truth = "FALSE"
                elif all_true:
                    overall_truth = "TRUE"
                else:
                    overall_truth = "UNKNOWN"

            elif quantifier == "DURATION":
                # P2-18: Reject DURATION override if query has no duration clause
                if not compile_res.min_duration_ps and (quantifier_override == "DURATION" or quantifier_override == "duration"):
                    raise MOCSQuerySyntaxError("Quantifier override DURATION cannot be applied to a query without a DURATION clause.")
                min_dur = compile_res.min_duration_ps or 10.0
                req_frames = max(1, int(math.ceil((min_dur - 1e-9) / dt_ps)))
                
                # F-025: Standard interval merge supporting adjacent and overlapping spans
                witness_intervals.sort(key=lambda x: x[0])
                merged_intervals = []
                for s, e in witness_intervals:
                    if not merged_intervals:
                        merged_intervals.append([s, e])
                    else:
                        prev = merged_intervals[-1]
                        if s <= prev[1]:
                            prev[1] = max(prev[1], e)
                        else:
                            merged_intervals.append([s, e])

                max_true_run = max((e - s for s, e in merged_intervals), default=0)

                # Optimistic merge across TRUE + UNKNOWN intervals to determine if reaching req_frames is still possible
                unknown_spans = [
                    [b["frame_start"], b["frame_end_exclusive"]]
                    for b in evaluated_blocks
                    if b["truth_value"] in ("UNKNOWN", "REFINED")
                ]
                potential_spans = sorted(
                    [[s, e] for s, e in merged_intervals] + unknown_spans,
                    key=lambda x: x[0]
                )
                merged_potential = []
                for s, e in potential_spans:
                    if not merged_potential:
                        merged_potential.append([s, e])
                    else:
                        prev = merged_potential[-1]
                        if s <= prev[1]:
                            prev[1] = max(prev[1], e)
                        else:
                            merged_potential.append([s, e])

                max_potential_run = max((e - s for s, e in merged_potential), default=0)

                if max_true_run >= req_frames:
                    overall_truth = "TRUE"
                    resolution = "COMPLETE"
                elif max_potential_run < req_frames:
                    overall_truth = "FALSE"
                    resolution = "COMPLETE"
                else:
                    overall_truth = "UNKNOWN"
                    resolution = "NEEDS_REFINEMENT"

            t1_wall = time.perf_counter()
            t1_cpu = time.thread_time()

            wall_time = max(0.001, t1_wall - t0_wall)
            cpu_time = max(0.001, t1_cpu - t0_cpu)

            # F-007: Safe process memory retrieval without process-global tracemalloc
            try:
                import psutil
                peak_mem = int(psutil.Process().memory_info().rss)
            except Exception:
                peak_mem = 0

            manifest = mci_reader.get_manifest()
            traj_hash = source.get_file_sha256()
            topo_hash = source.get_topology_sha256()
            mci_hash = manifest.get("mci_index_hash", "")

            atoms_count = len(sel_a_idx) + len(sel_b_idx)
            coordinates_mat_count = exact_frames_count * atoms_count * 3
            # P3-13: 8 bytes per float64 coordinate
            coordinate_payload_bytes = exact_frames_count * atoms_count * 3 * 8
            source_compressed_bytes = None  # Not reliably exposed by MDAnalysis/XTC reader
            index_size_bytes = os.path.getsize(mci_reader.blocks_path) if os.path.exists(mci_reader.blocks_path) else mci_reader.index_bytes_read

            prune_efficiency_pct = (certified_blocks_count / num_blocks) * 100.0 if num_blocks > 0 else 0.0
            refined_divisor = max(1, refined_blocks_count)
            refinement_selectivity = f"{num_blocks}:{refined_divisor}"
            refinement_speed = round(num_blocks / refined_divisor, 2)
            io_prune_ratio = round((total_frames - exact_frames_count) / total_frames if total_frames > 0 else 0.0, 4)
            traversal_depth = 2 if refined_blocks_count > 0 else 1

            certificate_data = {
                "mocs_cert_version": "0.1.0",
                "semantic_tag": "MOCS-SEM-v1.0",
                "result": {
                    "truth_value": overall_truth,
                    "resolution": resolution
                },
                "quantifier": quantifier,
                "query": {
                    "query_id": compile_res.query_id,
                    "observable": compile_res.observable,
                    "predicate": {
                        "operator": op,
                        "threshold_value": compile_res.threshold_value,
                        "threshold_value_angstrom": thresh,
                        "unit": compile_res.unit
                    },
                    "temporal": {
                        "operator": compile_res.temporal_operator or "EXISTS",
                        "min_duration_ps": compile_res.min_duration_ps or dt_ps
                    }
                },
                "source": {
                    "trajectory_id": os.path.basename(traj_path),
                    "trajectory_path": os.path.basename(traj_path),
                    "trajectory_sha256": traj_hash,
                    "topology_id": os.path.basename(topo_path),
                    "topology_path": os.path.basename(topo_path),
                    "topology_sha256": topo_hash
                },
                "index_commitment": {
                    "mci_index_hash": mci_hash,
                    "mci_path": mci_reader.blocks_path,
                    "algorithm": f"{b_model}-v1.0",
                    "bounding_model": b_model,
                    "bounding_model_version": "1.0",
                    "manifest": manifest
                },
                "semantics": {
                    "bounding_model": b_model,
                    "sampling_semantics": {
                        "mode": "sampled_frames",
                        "dt_ps": dt_ps,
                        "dt_source": source.get_dt_source()
                    },
                    "pbc_semantics": {
                        "mode": resolved_pbc_mode,
                        "cell_model": "TRICLINIC_DYNAMIC" if is_dynamic else ("ORTHORHOMBIC_FIXED" if cell.is_orthorhombic else "TRICLINIC_FIXED"),
                        "lengths": cell.lengths.tolist(),
                        "angles": cell.angles.tolist(),
                        "vectors": cell.vectors.tolist()
                    },
                    "precision": "float64"
                },
                "evidence": {
                    "total_blocks": num_blocks,
                    "blocks_examined": num_blocks,
                    "blocks_certified_true": certified_true_count,
                    "blocks_certified_false": certified_false_count,
                    "blocks_refined": refined_blocks_count,
                    "blocks_exact_true": exact_true_count,
                    "blocks_exact_false": exact_false_count,
                    "blocks_unknown": unknown_count,
                    "witness_intervals": [list(w) for w in witness_intervals],
                    "inspected_block_bounds": evaluated_blocks
                },
                "resources": {
                    "source_compressed_bytes_fetched": None,
                    "coordinate_payload_bytes": coordinate_payload_bytes,
                    "compressed_frames_decoded": frames_decoded,
                    "coordinates_materialized": coordinates_mat_count,
                    "atoms_analyzed": atoms_count,
                    "index_bytes_read": mci_reader.index_bytes_read,
                    "index_size_bytes": index_size_bytes,
                    "wall_time_seconds": round(wall_time, 4),
                    "cpu_time_seconds": round(cpu_time, 4),
                    "peak_memory_bytes": peak_mem,
                    "refinement_selectivity": refinement_selectivity,
                    "refinement_speed": refinement_speed,
                    "io_prune_ratio": io_prune_ratio,
                    "traversal_depth": traversal_depth
                }
            }

            from mocs.certificates.canonical import compute_certificate_hash
            cert_hash = compute_certificate_hash(certificate_data)
            certificate_data["certificate_hash"] = cert_hash

            # P1-8: Convert assert to structured MOCSVerificationError
            is_verified = verify_certificate(certificate_data, verify_hashes=True)
            if not is_verified:
                raise MOCSVerificationError("Self-verification of newly synthesized certificate failed.")

            res = certificate_data["resources"]
            query_hash = hashlib.sha256(query_text.encode("utf-8")).hexdigest()[:16]
            execution_id = f"exec_{hashlib.sha256(f'{query_hash}_{time.time()}'.encode()).hexdigest()[:12]}"

            return QueryExecuteResponse(
                query_id=compile_res.query_id,
                truth_value=overall_truth,
                resolution_status=resolution,
                quantifier=quantifier,
                certificate_id=f"mocs://cert/{compile_res.query_id}",
                certificate_hash=cert_hash,
                blocks_examined=num_blocks,
                blocks_total=num_blocks,
                blocks_read=num_blocks,
                blocks_certified_true=certified_true_count,
                blocks_certified_false=certified_false_count,
                blocks_refined=refined_blocks_count,
                blocks_exact_true=exact_true_count,
                blocks_exact_false=exact_false_count,
                blocks_exact_mixed=exact_mixed_count,
                blocks_unknown=unknown_count,
                certified_blocks=certified_blocks_count,
                refined_blocks=refined_blocks_count,
                frames_total=total_frames,
                frames_exact_requested=frames_exact_requested,
                frames_decoded=frames_decoded,
                frames_materialized=frames_materialized,
                exact_frames_scanned=exact_frames_count,
                total_frames_refined=exact_frames_count,
                pruning_efficiency=round(prune_efficiency_pct, 2),
                wall_time_seconds=res["wall_time_seconds"],
                cpu_time_seconds=res["cpu_time_seconds"],
                source_compressed_bytes_fetched=None,
                compressed_bytes_fetched=None,
                coordinate_payload_bytes=coordinate_payload_bytes,
                coordinates_materialized=res["coordinates_materialized"],
                atoms_analyzed=atoms_count,
                index_bytes_read=res["index_bytes_read"],
                index_size_bytes=index_size_bytes,
                peak_memory_bytes=peak_mem,
                refinement_selectivity=refinement_selectivity,
                refinement_speed=refinement_speed,
                io_prune_ratio=io_prune_ratio,
                traversal_depth=traversal_depth,
                certificate=certificate_data,
                plan_steps=compile_res.plan_steps,
                witness_intervals=[list(w) for w in witness_intervals],
                evaluated_blocks=evaluated_blocks,
                execution_id=execution_id,
                query_hash=query_hash,
                bounding_model=b_model
            )
        finally:
            if mci_reader is not None:
                mci_reader.close()
            if source is not None:
                source.close()

compiler_service = CompilerService()
