"""
mocs.workflow.artifacts — Immutable Scientific Artifact Model.

Enforces cryptographic immutability, SHA-256 fingerprinting, and strict
type boundaries for all scientific artifacts in MOCS-Cert workflows.
"""

from __future__ import annotations
import hashlib
import json
import time
from abc import ABC
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Any, List, Optional, Tuple, Union
import numpy as np

from mocs.ecosystem.interfaces import CanonicalStructure, DiscrepancyClassification


class ArtifactType(str, Enum):
    STRUCTURE = "StructureArtifact"
    TRAJECTORY = "TrajectoryArtifact"
    SELECTION = "SelectionArtifact"
    TRANSFORMED_TRAJECTORY = "TransformedTrajectoryArtifact"
    ANALYSIS = "AnalysisArtifact"
    COMPARISON = "ComparisonArtifact"
    CERTIFICATE = "CertificateArtifact"
    EXPORT = "ExportArtifact"


def compute_hash(data: Union[str, bytes, dict, list]) -> str:
    """Compute deterministic canonical SHA-256 hash."""
    from mocs.certificates.canonical import canonical_json_bytes
    hasher = hashlib.sha256()
    if isinstance(data, bytes):
        hasher.update(data)
    elif isinstance(data, str):
        hasher.update(data.encode("utf-8"))
    else:
        hasher.update(canonical_json_bytes(data))
    return hasher.hexdigest()


@dataclass(frozen=True)
class ScientificArtifact(ABC):
    """
    Immutable base class for all scientific workflow artifacts.
    Once created, an artifact cannot be modified. Downstream transformations
    must yield new artifacts with updated parent references.
    """
    artifact_id: str
    artifact_type: ArtifactType
    fingerprint: str
    timestamp: float = field(default_factory=time.time)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Serialize artifact metadata to dictionary."""
        d: Dict[str, Any] = {
            "artifact_id": self.artifact_id,
            "artifact_type": self.artifact_type.value,
            "fingerprint": self.fingerprint,
            "timestamp": self.timestamp,
            "metadata": self.metadata,
        }
        for k, v in self.__dict__.items():
            if k not in d and k != "canonical_structure":
                if isinstance(v, (str, int, float, bool, list, dict, type(None))):
                    d[k] = v
                elif isinstance(v, tuple):
                    d[k] = list(v)
                elif hasattr(v, "value"):
                    d[k] = v.value
                elif isinstance(v, np.ndarray):
                    d[k] = v.tolist()
        return d


@dataclass(frozen=True)
class StructureArtifact(ScientificArtifact):
    """Immutable representation of ingested macromolecular structure."""
    identifier: str = ""
    source_type: str = ""
    format: str = "PDB"
    atom_count: int = 0
    chains: Tuple[str, ...] = ()
    residues_count: int = 0
    resolution_angstrom: Optional[float] = None
    canonical_structure: Optional[CanonicalStructure] = None

    @classmethod
    def create(cls, identifier: str, source_type: str, canonical_struct: CanonicalStructure, metadata: Optional[Dict[str, Any]] = None) -> StructureArtifact:
        coords_bytes = canonical_struct.coordinates.tobytes()
        fp = compute_hash({
            "id": identifier,
            "source_type": source_type,
            "atoms": canonical_struct.atom_count,
            "chains": canonical_struct.chains,
            "coords_hash": hashlib.sha256(coords_bytes).hexdigest(),
        })
        aid = f"struct_{fp[:12]}"
        return cls(
            artifact_id=aid,
            artifact_type=ArtifactType.STRUCTURE,
            fingerprint=fp,
            metadata=metadata or {},
            identifier=identifier,
            source_type=source_type,
            atom_count=canonical_struct.atom_count,
            chains=tuple(canonical_struct.chains),
            residues_count=len(canonical_struct.residues),
            resolution_angstrom=canonical_struct.provenance.resolution_angstrom,
            canonical_structure=canonical_struct,
        )


@dataclass(frozen=True)
class TrajectoryArtifact(ScientificArtifact):
    """Immutable representation of raw trajectory dataset."""
    trajectory_path: str = ""
    topology_path: str = ""
    n_frames: int = 0
    time_step_ps: float = 10.0
    time_span_ns: float = 0.0
    box_dimensions: Tuple[float, ...] = ()

    @classmethod
    def create(cls, trajectory_path: str, topology_path: str, n_frames: int, time_step_ps: float = 10.0, box: Optional[np.ndarray] = None, metadata: Optional[Dict[str, Any]] = None) -> TrajectoryArtifact:
        box_tuple = tuple(float(x) for x in box) if box is not None else ()
        fp = compute_hash({
            "traj": trajectory_path,
            "topo": topology_path,
            "frames": n_frames,
            "dt": time_step_ps,
            "box": box_tuple,
        })
        aid = f"traj_{fp[:12]}"
        return cls(
            artifact_id=aid,
            artifact_type=ArtifactType.TRAJECTORY,
            fingerprint=fp,
            metadata=metadata or {},
            trajectory_path=trajectory_path,
            topology_path=topology_path,
            n_frames=n_frames,
            time_step_ps=time_step_ps,
            time_span_ns=(n_frames * time_step_ps) / 1000.0,
            box_dimensions=box_tuple,
        )


@dataclass(frozen=True)
class SelectionArtifact(ScientificArtifact):
    """Immutable typed atom selection."""
    expression: str = ""
    target_structure_fingerprint: str = ""
    selected_atom_indices: Tuple[int, ...] = ()
    selected_chains: Tuple[str, ...] = ()
    selected_residues: Tuple[str, ...] = ()
    ast_representation: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def create(cls, expression: str, target_fp: str, atom_indices: List[int], chains: List[str], residues: List[str], ast_repr: Optional[Dict[str, Any]] = None, metadata: Optional[Dict[str, Any]] = None) -> SelectionArtifact:
        indices_sorted = tuple(sorted(set(atom_indices)))
        fp = compute_hash({
            "expr": expression,
            "target_fp": target_fp,
            "indices": indices_sorted,
            "chains": tuple(sorted(set(chains))),
        })
        aid = f"sel_{fp[:12]}"
        return cls(
            artifact_id=aid,
            artifact_type=ArtifactType.SELECTION,
            fingerprint=fp,
            metadata=metadata or {},
            expression=expression,
            target_structure_fingerprint=target_fp,
            selected_atom_indices=indices_sorted,
            selected_chains=tuple(sorted(set(chains))),
            selected_residues=tuple(sorted(set(residues))),
            ast_representation=ast_repr or {"type": "SelectionExpression", "raw": expression},
        )


@dataclass(frozen=True)
class TransformedTrajectoryArtifact(ScientificArtifact):
    """Immutable derived trajectory produced by explicit transformations."""
    parent_trajectory_id: str = ""
    transformations: Tuple[Dict[str, Any], ...] = ()
    n_frames: int = 0
    frame_stride: int = 1
    box_dimensions: Tuple[float, ...] = ()
    frame_indices: Tuple[int, ...] = ()

    @classmethod
    def create(cls, parent_id: str, transforms: List[Dict[str, Any]], n_frames: int, frame_stride: int = 1, box: Optional[Tuple[float, ...]] = None, frame_indices: Optional[List[int]] = None, metadata: Optional[Dict[str, Any]] = None) -> TransformedTrajectoryArtifact:
        t_tuple = tuple(transforms)
        idx_tuple = tuple(frame_indices) if frame_indices else tuple(range(0, n_frames, frame_stride))
        fp = compute_hash({
            "parent": parent_id,
            "transforms": transforms,
            "frames": n_frames,
            "stride": frame_stride,
            "idx": idx_tuple,
        })
        aid = f"ttraj_{fp[:12]}"
        return cls(
            artifact_id=aid,
            artifact_type=ArtifactType.TRANSFORMED_TRAJECTORY,
            fingerprint=fp,
            metadata=metadata or {},
            parent_trajectory_id=parent_id,
            transformations=t_tuple,
            n_frames=len(idx_tuple),
            frame_stride=frame_stride,
            box_dimensions=box or (),
            frame_indices=idx_tuple,
        )


@dataclass(frozen=True)
class AnalysisArtifact(ScientificArtifact):
    """Immutable scientific calculation result."""
    parent_artifact_ids: Tuple[str, ...] = ()
    observable: str = ""
    value: Any = None
    units: str = "Angstrom"
    algorithm: str = ""
    backend_name: str = ""
    backend_version: str = ""
    parameters: Dict[str, Any] = field(default_factory=dict)
    confidence_limitations: Tuple[str, ...] = ()
    warnings: Tuple[str, ...] = ()

    @classmethod
    def create(
        cls,
        parent_ids: List[str],
        observable: str,
        value: Any,
        units: str,
        algorithm: str,
        backend_name: str,
        backend_version: str,
        parameters: Optional[Dict[str, Any]] = None,
        confidence_limitations: Optional[List[str]] = None,
        warnings: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> AnalysisArtifact:
        # Convert numpy values to serializable structures for hashing
        val_repr = value.tolist() if isinstance(value, np.ndarray) else value
        fp = compute_hash({
            "parents": sorted(parent_ids),
            "observable": observable,
            "value": val_repr if not isinstance(val_repr, list) or len(val_repr) < 100 else [len(val_repr), float(np.mean(val_repr)), float(np.std(val_repr))],
            "units": units,
            "backend": backend_name,
            "version": backend_version,
            "params": parameters or {},
        })
        aid = f"ana_{fp[:12]}"
        return cls(
            artifact_id=aid,
            artifact_type=ArtifactType.ANALYSIS,
            fingerprint=fp,
            metadata=metadata or {},
            parent_artifact_ids=tuple(sorted(parent_ids)),
            observable=observable,
            value=value,
            units=units,
            algorithm=algorithm,
            backend_name=backend_name,
            backend_version=backend_version,
            parameters=parameters or {},
            confidence_limitations=tuple(confidence_limitations or []),
            warnings=tuple(warnings or []),
        )


@dataclass(frozen=True)
class ComparisonArtifact(ScientificArtifact):
    """Immutable differential verification comparison."""
    primary_artifact_id: str = ""
    reference_artifact_id: str = ""
    primary_backend: str = ""
    reference_backend: str = ""
    primary_value: Any = None
    reference_value: Any = None
    absolute_difference: float = 0.0
    relative_difference: float = 0.0
    tolerance: float = 1e-4
    classification: DiscrepancyClassification = DiscrepancyClassification.WITHIN_TOLERANCE
    explanation: str = ""

    @classmethod
    def create(
        cls,
        primary_id: str,
        reference_id: str,
        primary_backend: str,
        reference_backend: str,
        primary_val: Any,
        reference_val: Any,
        abs_diff: float,
        rel_diff: float,
        tolerance: float,
        classification: DiscrepancyClassification,
        explanation: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> ComparisonArtifact:
        fp = compute_hash({
            "pri": primary_id,
            "ref": reference_id,
            "diff": abs_diff,
            "tol": tolerance,
            "cls": classification.value,
        })
        aid = f"cmp_{fp[:12]}"
        return cls(
            artifact_id=aid,
            artifact_type=ArtifactType.COMPARISON,
            fingerprint=fp,
            metadata=metadata or {},
            primary_artifact_id=primary_id,
            reference_artifact_id=reference_id,
            primary_backend=primary_backend,
            reference_backend=reference_backend,
            primary_value=primary_val,
            reference_value=reference_val,
            absolute_difference=abs_diff,
            relative_difference=rel_diff,
            tolerance=tolerance,
            classification=classification,
            explanation=explanation,
        )


@dataclass(frozen=True)
class CertificateArtifact(ScientificArtifact):
    """Immutable scientific certificate binding execution lineage."""
    workflow_id: str = ""
    artifact_ids: Tuple[str, ...] = ()
    input_fingerprints: Tuple[str, ...] = ()
    result_fingerprints: Tuple[str, ...] = ()
    backend_versions: Dict[str, str] = field(default_factory=dict)
    algorithms: Tuple[str, ...] = ()
    oracle_results: Dict[str, Any] = field(default_factory=dict)
    discrepancy_classification: str = "WITHIN_TOLERANCE"
    sha256_digest: str = ""

    @classmethod
    def create(
        cls,
        workflow_id: str,
        artifact_ids: List[str],
        input_fps: List[str],
        result_fps: List[str],
        backend_versions: Dict[str, str],
        algorithms: List[str],
        oracle_results: Dict[str, Any],
        discrepancy_classification: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> CertificateArtifact:
        payload = {
            "workflow_id": workflow_id,
            "artifacts": sorted(artifact_ids),
            "input_fps": sorted(input_fps),
            "result_fps": sorted(result_fps),
            "backends": backend_versions,
            "algorithms": algorithms,
            "oracle": oracle_results,
            "discrepancy": discrepancy_classification,
        }
        digest = compute_hash(payload)
        aid = f"cert_{digest[:12]}"
        return cls(
            artifact_id=aid,
            artifact_type=ArtifactType.CERTIFICATE,
            fingerprint=digest,
            metadata=metadata or {},
            workflow_id=workflow_id,
            artifact_ids=tuple(sorted(artifact_ids)),
            input_fingerprints=tuple(sorted(input_fps)),
            result_fingerprints=tuple(sorted(result_fps)),
            backend_versions=backend_versions,
            algorithms=tuple(algorithms),
            oracle_results=oracle_results,
            discrepancy_classification=discrepancy_classification,
            sha256_digest=digest,
        )


@dataclass(frozen=True)
class ExportArtifact(ScientificArtifact):
    """Immutable exported reproducible bundle."""
    workflow_id: str = ""
    export_format: str = "json"  # json, csv, markdown
    payload_str: str = ""
    sha256_digest: str = ""

    @classmethod
    def create(cls, workflow_id: str, export_format: str, payload_str: str, metadata: Optional[Dict[str, Any]] = None) -> ExportArtifact:
        digest = compute_hash(payload_str.encode("utf-8"))
        aid = f"exp_{digest[:12]}"
        return cls(
            artifact_id=aid,
            artifact_type=ArtifactType.EXPORT,
            fingerprint=digest,
            metadata=metadata or {},
            workflow_id=workflow_id,
            export_format=export_format,
            payload_str=payload_str,
            sha256_digest=digest,
        )
