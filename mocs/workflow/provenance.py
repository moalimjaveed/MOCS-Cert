"""
mocs.workflow.provenance — Provenance Graph and Scientific Lineage Query Engine.

Constructs an auditable DAG tracking immutable artifacts, workflow steps,
and cross-engine derivation chains. Provides scientific lineage query
capabilities ("Where did this value come from?").
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional, Set
import time

from .artifacts import ScientificArtifact, ArtifactType, AnalysisArtifact, ComparisonArtifact, CertificateArtifact
from .steps import WorkflowStep, WorkflowStepType


@dataclass
class LineageReport:
    """Detailed causal chain report answering 'Where did this value come from?'"""
    target_artifact_id: str
    target_artifact_type: str
    target_value: Any
    units: str
    algorithm: str
    backend_name: str
    backend_version: str
    parameters: Dict[str, Any]
    source_artifacts: List[Dict[str, Any]]
    selection_details: Optional[Dict[str, Any]]
    reference_oracle: Optional[Dict[str, Any]]
    certificate_digest: Optional[str]
    lineage_path: List[Dict[str, str]]
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "target_artifact_id": self.target_artifact_id,
            "target_artifact_type": self.target_artifact_type,
            "target_value": self.target_value,
            "units": self.units,
            "algorithm": self.algorithm,
            "backend_name": self.backend_name,
            "backend_version": self.backend_version,
            "parameters": self.parameters,
            "source_artifacts": self.source_artifacts,
            "selection_details": self.selection_details,
            "reference_oracle": self.reference_oracle,
            "certificate_digest": self.certificate_digest,
            "lineage_path": self.lineage_path,
            "timestamp": self.timestamp,
        }


class ProvenanceGraph:
    """
    Directed Acyclic Graph (DAG) of artifacts and workflow execution steps.
    Preserves strict scientific causality: artifacts cannot circularly depend
    on each other.
    """

    def __init__(self, workflow_id: str):
        self.workflow_id = workflow_id
        self.artifacts: Dict[str, ScientificArtifact] = {}
        self.steps: Dict[str, WorkflowStep] = {}
        # Adjacency: artifact_id -> set of child artifact_ids
        self._forward_edges: Dict[str, Set[str]] = {}
        # Reverse: artifact_id -> set of parent artifact_ids
        self._reverse_edges: Dict[str, Set[str]] = {}
        # Step map: output_artifact_id -> step_id that produced it
        self._producing_step: Dict[str, str] = {}

    def add_artifact(self, artifact: ScientificArtifact) -> None:
        """Register an immutable artifact in the DAG."""
        if artifact.artifact_id not in self.artifacts:
            self.artifacts[artifact.artifact_id] = artifact
            self._forward_edges.setdefault(artifact.artifact_id, set())
            self._reverse_edges.setdefault(artifact.artifact_id, set())

    def add_step(self, step: WorkflowStep) -> None:
        """Register an executed workflow step and link its inputs and outputs while preserving DAG acyclicity."""
        # F-065: Enforce acyclicity check before adding edges
        for in_id in step.inputs:
            for out_id in step.outputs:
                # Check if in_id is reachable from out_id in existing forward edges
                stack = [out_id]
                visited = set()
                while stack:
                    curr = stack.pop()
                    if curr == in_id:
                        raise ValueError(
                            f"Provenance DAG cycle detected: adding step '{step.step_id}' ({step.name}) "
                            f"would create a cycle from '{out_id}' to '{in_id}'."
                        )
                    if curr not in visited:
                        visited.add(curr)
                        stack.extend(self._forward_edges.get(curr, ()))

        self.steps[step.step_id] = step
        for in_id in step.inputs:
            self._forward_edges.setdefault(in_id, set())
            for out_id in step.outputs:
                self._forward_edges[in_id].add(out_id)
                self._reverse_edges.setdefault(out_id, set()).add(in_id)
                self._producing_step[out_id] = step.step_id

    def get_parents(self, artifact_id: str) -> List[ScientificArtifact]:
        """Return direct parent artifacts."""
        parent_ids = self._reverse_edges.get(artifact_id, set())
        return [self.artifacts[pid] for pid in parent_ids if pid in self.artifacts]

    def get_children(self, artifact_id: str) -> List[ScientificArtifact]:
        """Return direct child artifacts."""
        child_ids = self._forward_edges.get(artifact_id, set())
        return [self.artifacts[cid] for cid in child_ids if cid in self.artifacts]

    def get_sources(self) -> List[ScientificArtifact]:
        """Return root source artifacts (nodes with no incoming edges)."""
        roots = []
        for aid, parents in self._reverse_edges.items():
            if not parents and aid in self.artifacts:
                roots.append(self.artifacts[aid])
        return roots

    def get_producing_step(self, artifact_id: str) -> Optional[WorkflowStep]:
        """Return the workflow step that generated this artifact."""
        sid = self._producing_step.get(artifact_id)
        return self.steps.get(sid) if sid else None

    def query_lineage(self, artifact_id: str) -> LineageReport:
        """
        Execute an exhaustive causal traceback for a specific scientific value.
        Answers: 'Where did this value come from?'
        """
        if artifact_id not in self.artifacts:
            raise KeyError(f"Artifact '{artifact_id}' not found in provenance graph.")

        target = self.artifacts[artifact_id]

        # Traverse upwards to gather all ancestor artifacts and steps
        ancestor_ids: Set[str] = set()
        queue = [artifact_id]
        while queue:
            curr = queue.pop(0)
            parents = self._reverse_edges.get(curr, set())
            for p in parents:
                if p not in ancestor_ids:
                    ancestor_ids.add(p)
                    queue.append(p)

        ancestors = [self.artifacts[aid] for aid in ancestor_ids if aid in self.artifacts]
        sources = [a for a in ancestors if a.artifact_type in (ArtifactType.STRUCTURE, ArtifactType.TRAJECTORY)]
        if not sources and target.artifact_type in (ArtifactType.STRUCTURE, ArtifactType.TRAJECTORY):
            sources = [target]

        # Find selection details if any
        selections = [a for a in ancestors if a.artifact_type == ArtifactType.SELECTION]
        sel_details = None
        if selections:
            last_sel = selections[-1]
            sel_details = {
                "artifact_id": last_sel.artifact_id,
                "expression": getattr(last_sel, "expression", ""),
                "atom_count": len(getattr(last_sel, "selected_atom_indices", ())),
                "chains": list(getattr(last_sel, "selected_chains", ())),
                "residues": list(getattr(last_sel, "selected_residues", ())),
            }

        # Find differential comparison or oracle cross-check
        comparisons = [a for a in ancestors if a.artifact_type == ArtifactType.COMPARISON]
        if target.artifact_type == ArtifactType.COMPARISON:
            comparisons.append(target)
        oracle_info = None
        if comparisons:
            last_cmp = comparisons[-1]
            oracle_info = {
                "reference_backend": getattr(last_cmp, "reference_backend", ""),
                "reference_value": getattr(last_cmp, "reference_value", None),
                "absolute_difference": getattr(last_cmp, "absolute_difference", 0.0),
                "tolerance": getattr(last_cmp, "tolerance", 1e-4),
                "classification": getattr(last_cmp, "classification", "").value if hasattr(getattr(last_cmp, "classification", ""), "value") else str(getattr(last_cmp, "classification", "")),
                "explanation": getattr(last_cmp, "explanation", ""),
            }

        # Find certificate digest if this lineage has been certified
        certificates = [a for a in self.artifacts.values() if a.artifact_type == ArtifactType.CERTIFICATE]
        cert_digest = None
        if certificates:
            cert_digest = getattr(certificates[-1], "sha256_digest", None)

        # Build causal path sequence iteratively (F-064)
        path = []
        visited = set()
        stack: List[Tuple[str, bool]] = [(artifact_id, False)]
        while stack:
            curr_id, expanded = stack.pop()
            if curr_id in visited:
                continue
            if expanded:
                visited.add(curr_id)
                node = self.artifacts.get(curr_id)
                step = self.get_producing_step(curr_id)
                step_name = step.name if step else ("Initial Ingestion" if not self._reverse_edges.get(curr_id) else "Unlinked Processing")
                backend = step.backend_name if step else ("Environment Provider" if not self._reverse_edges.get(curr_id) else "Unknown Backend")
                path.append({
                    "artifact_id": curr_id,
                    "artifact_type": node.artifact_type.value if node else "Unknown",
                    "label": getattr(node, "observable", getattr(node, "identifier", curr_id)),
                    "step_name": step_name,
                    "backend": backend,
                })
            else:
                stack.append((curr_id, True))
                # Push parents in reverse sorted order so they are processed in sorted order
                for p in sorted(self._reverse_edges.get(curr_id, set()), reverse=True):
                    if p not in visited:
                        stack.append((p, False))

        # Target metadata extraction
        target_val = getattr(target, "value", getattr(target, "primary_value", None))
        units = getattr(target, "units", "Angstrom")
        algorithm = getattr(target, "algorithm", "Deterministic Execution")
        backend_name = getattr(target, "backend_name", "Native MOCS-Cert")
        backend_version = getattr(target, "backend_version", "0.1.0")
        params = getattr(target, "parameters", {})

        return LineageReport(
            target_artifact_id=target.artifact_id,
            target_artifact_type=target.artifact_type.value,
            target_value=target_val,
            units=units,
            algorithm=algorithm,
            backend_name=backend_name,
            backend_version=backend_version,
            parameters=params,
            source_artifacts=[
                {
                    "artifact_id": s.artifact_id,
                    "type": s.artifact_type.value,
                    "identifier": getattr(s, "identifier", getattr(s, "trajectory_path", "")),
                    "fingerprint": s.fingerprint,
                }
                for s in sources
            ],
            selection_details=sel_details,
            reference_oracle=oracle_info,
            certificate_digest=cert_digest,
            lineage_path=path,
        )

    def to_dict(self) -> Dict[str, Any]:
        """Serialize complete DAG to JSON-compatible dictionary."""
        return {
            "workflow_id": self.workflow_id,
            "artifacts": {aid: a.to_dict() for aid, a in self.artifacts.items()},
            "steps": {sid: s.to_dict() for sid, s in self.steps.items()},
            "edges": [
                {"source": src, "target": tgt}
                for src, tgts in self._forward_edges.items()
                for tgt in tgts
            ],
        }
