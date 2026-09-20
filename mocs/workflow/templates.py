"""
mocs.workflow.templates — Reusable Scientific Workflow Templates.

Provides 7 scientifically verified templates for common biophysical
and structural computational workflows.
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Any, List, Optional


@dataclass
class WorkflowTemplate:
    template_id: str
    name: str
    description: str
    category: str
    default_parameters: Dict[str, Any]
    required_backends: List[str]
    pipeline_stages: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "template_id": self.template_id,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "default_parameters": self.default_parameters,
            "required_backends": self.required_backends,
            "pipeline_stages": self.pipeline_stages,
        }


WORKFLOW_TEMPLATES: Dict[str, WorkflowTemplate] = {
    "structure_inspection": WorkflowTemplate(
        template_id="structure_inspection",
        name="Macromolecular Structure Inspection & Coordination Audit",
        description="Ingests experimental PDB structure (e.g., 4HHB), isolates target chains/residues, and measures precise coordination distances with oracle validation.",
        category="Structural Biology",
        default_parameters={
            "structure_id": "4HHB",
            "selection_a": "chain A and resname HEM and name FE",
            "selection_b": "chain A and resname HIS and resid 87 and name NE2",
            "expected_distance_angstrom": 2.14,
            "tolerance_angstrom": 0.05,
        },
        required_backends=["MOCS Native", "MDAnalysis"],
        pipeline_stages=["SOURCE", "INGEST", "VALIDATE", "SELECT", "ANALYZE", "CROSS_CHECK", "CERTIFY", "EXPORT"],
    ),
    "trajectory_analysis": WorkflowTemplate(
        template_id="trajectory_analysis",
        name="Composable Trajectory Analysis & Dynamics Metrics",
        description="Executes PBC unwrapping, reference fitting, and calculates RMSD, RMSF, and Radius of Gyration time series over trajectory frames.",
        category="Molecular Dynamics",
        default_parameters={
            "topology_path": "tests/data/synth_500f.gro",
            "trajectory_path": "tests/data/synth_500f.xtc",
            "frame_stride": 1,
            "fit_to_reference": True,
            "calculate_rg": True,
            "calculate_rmsf": True,
        },
        required_backends=["MOCS Native", "MDAnalysis"],
        pipeline_stages=["SOURCE", "INGEST", "TRANSFORM", "SELECT", "ANALYZE", "CERTIFY", "EXPORT"],
    ),
    "protein_ligand": WorkflowTemplate(
        template_id="protein_ligand",
        name="Protein–Ligand Binding Pocket & Proximity Analysis",
        description="Extracts bound cofactor or synthetic ligand, calculates Morgan fingerprints/scaffold, and evaluates binding site contact distances.",
        category="Cheminformatics",
        default_parameters={
            "structure_id": "4HHB",
            "ligand_resname": "HEM",
            "pocket_cutoff_angstrom": 4.5,
            "compute_fingerprint": True,
        },
        required_backends=["MOCS Native", "RDKit"],
        pipeline_stages=["SOURCE", "INGEST", "SELECT", "ANALYZE", "CROSS_CHECK", "EXPORT"],
    ),
    "structure_comparison": WorkflowTemplate(
        template_id="structure_comparison",
        name="Pairwise Structural Superposition & Discrepancy Analysis",
        description="Maps residue correspondence between Structure A and Structure B, computes optimal Kabsch rotational alignment, and measures per-residue RMSD displacements.",
        category="Structural Bioinformatics",
        default_parameters={
            "structure_a_id": "4HHB",
            "structure_b_id": "1BNA",
            "alignment_atom": "CA",
        },
        required_backends=["MOCS Native"],
        pipeline_stages=["SOURCE", "INGEST", "VALIDATE", "TRANSFORM", "ANALYZE", "EXPORT"],
    ),
    "crystallographic_inspection": WorkflowTemplate(
        template_id="crystallographic_inspection",
        name="Crystallographic Symmetry, Unit-Cell & B-Factor Audit",
        description="Inspects crystallographic unit-cell parameters, space group, experimental resolution, and B-factor statistical distribution.",
        category="Crystallography",
        default_parameters={
            "structure_id": "4HHB",
            "experimental_method": "X-RAY DIFFRACTION",
            "verify_symmetry": True,
        },
        required_backends=["MOCS Native", "Gemmi"],
        pipeline_stages=["SOURCE", "INGEST", "VALIDATE", "ANALYZE", "CERTIFY", "EXPORT"],
    ),
    "trajectory_verification": WorkflowTemplate(
        template_id="trajectory_verification",
        name="Differential Trajectory Verification vs MDAnalysis Reference Oracle",
        description="Runs dual-engine evaluation comparing native MOCS conservative bounding vs MDAnalysis sequential scan, classifying any discrepancies under 10^-4 Å tolerance.",
        category="Verification",
        default_parameters={
            "topology_path": "tests/data/synth_500f.gro",
            "trajectory_path": "tests/data/synth_500f.xtc",
            "selection_a": "index 0",
            "selection_b": "index 1",
            "tolerance_angstrom": 0.0001,
        },
        required_backends=["MOCS Native", "MDAnalysis"],
        pipeline_stages=["SOURCE", "INGEST", "SELECT", "ANALYZE", "CROSS_CHECK", "CERTIFY", "EXPORT"],
    ),
    "scientific_certification": WorkflowTemplate(
        template_id="scientific_certification",
        name="Full-Lineage Scientific Certification & Merkle Commitment",
        description="End-to-end formal certification creating an immutable certificate artifact binding raw data hashes, software versions, oracle verdicts, and cryptographic Merkle roots.",
        category="Certification",
        default_parameters={
            "dataset_name": "synth_500f",
            "include_lineage_dag": True,
            "export_reproducibility_manifest": True,
        },
        required_backends=["MOCS Native", "MDAnalysis"],
        pipeline_stages=["SOURCE", "INGEST", "SELECT", "TRANSFORM", "ANALYZE", "CROSS_CHECK", "CERTIFY", "EXPORT"],
    ),
}


class TemplateLibrary:
    @classmethod
    def get_all(cls) -> List[WorkflowTemplate]:
        return list(WORKFLOW_TEMPLATES.values())

    @classmethod
    def get(cls, template_id: str) -> Optional[WorkflowTemplate]:
        return WORKFLOW_TEMPLATES.get(template_id)
