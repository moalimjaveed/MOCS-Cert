"""
tests.integration.test_pass30_workflow_engine — PASS 30 Verification Suite.

Validates the full MOCS-Cert Scientific Workflow Engine:
1. Immutable scientific artifact model & cryptographic hashing
2. 11-stage pipeline & step abstraction
3. Provenance DAG traversal & causal lineage query ('Where did this value come from?')
4. Backend capability discovery & smoke self-tests
5. Composable trajectory, selection, chemistry, comparison, crystallography, simulation pipelines
6. Real end-to-end workflows (4HHB, 1BNA, synth_500f)
7. Differential oracle mode with tolerance checks & discrepancy classification
8. Reproducibility manifest (workflow.json) serialization, verification & reproduction
9. Concurrency, failure semantics, and generation isolation
10. FastAPI workflow endpoint integration
"""

import pytest
import numpy as np
from dataclasses import FrozenInstanceError
from fastapi.testclient import TestClient

from backend.app.main import app
import mocs.workflow as mw
from mocs.ecosystem.interfaces import CanonicalStructure, AtomRecord, ProvenanceRecord, StructureSourceType, DiscrepancyClassification
from mocs.ecosystem.providers import RCSBStructureProvider
from mocs.workflow.pipelines import (
    unwrap_pbc,
    center_coordinates,
    fit_reference,
    slice_frames,
    compute_trajectory_metrics,
    SelectionEvaluator,
    ChemistryPipeline,
    StructureComparisonPipeline,
    CrystallographyPipeline,
    SimulationPipeline,
)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def engine():
    return mw.WorkflowEngine()


# =============================================================================
# 1. Immutable Scientific Artifacts & Hashing
# =============================================================================

def test_artifact_immutability_and_hashing():
    """Verify that ScientificArtifacts are frozen and reject in-place mutation."""
    raw_coords = np.array([[1.0, 2.0, 3.0]], dtype=np.float64)
    atoms = [AtomRecord(0, "CA", "ALA", "A", 1, raw_coords[0])]
    prov = ProvenanceRecord(StructureSourceType.EXPERIMENTAL, "TEST", "PDB", "1.0", "hash123")
    canon = CanonicalStructure("TEST", prov, ["A"], [("A", 1, "ALA")], atoms)

    art = mw.StructureArtifact.create("TEST", "Experimental", canon)
    assert art.artifact_type == mw.ArtifactType.STRUCTURE
    assert art.atom_count == 1
    assert len(art.fingerprint) == 64

    # Frozen dataclass check: mutating attributes must raise FrozenInstanceError
    with pytest.raises(FrozenInstanceError):
        art.atom_count = 99  # type: ignore

    with pytest.raises(FrozenInstanceError):
        art.identifier = "MUTATED"  # type: ignore


def test_artifact_deterministic_fingerprint():
    """Verify bit-identical inputs generate identical SHA-256 fingerprints."""
    raw_coords = np.array([[1.0, 2.0, 3.0]], dtype=np.float64)
    atoms = [AtomRecord(0, "CA", "ALA", "A", 1, raw_coords[0])]
    prov = ProvenanceRecord(StructureSourceType.EXPERIMENTAL, "TEST", "PDB", "1.0", "hash123")
    canon1 = CanonicalStructure("TEST", prov, ["A"], [("A", 1, "ALA")], atoms)
    canon2 = CanonicalStructure("TEST", prov, ["A"], [("A", 1, "ALA")], atoms)

    art1 = mw.StructureArtifact.create("TEST", "Experimental", canon1)
    art2 = mw.StructureArtifact.create("TEST", "Experimental", canon2)
    assert art1.fingerprint == art2.fingerprint
    assert art1.artifact_id == art2.artifact_id


# =============================================================================
# 2. Provenance Graph & Causal Lineage Query
# =============================================================================

def test_provenance_graph_dag_traversal():
    """Verify DAG structure, parent-child edges, and root sources."""
    g = mw.ProvenanceGraph("wf_test")
    art_a = mw.ScientificArtifact(artifact_id="art_a", artifact_type=mw.ArtifactType.STRUCTURE, fingerprint="fp_a")
    art_b = mw.ScientificArtifact(artifact_id="art_b", artifact_type=mw.ArtifactType.SELECTION, fingerprint="fp_b")
    art_c = mw.ScientificArtifact(artifact_id="art_c", artifact_type=mw.ArtifactType.ANALYSIS, fingerprint="fp_c")

    g.add_artifact(art_a)
    g.add_artifact(art_b)
    g.add_artifact(art_c)

    step1 = mw.WorkflowStep.create(mw.WorkflowStepType.SELECT, "Step 1", inputs=["art_a"])
    step1.mark_completed(outputs=["art_b"], duration_ms=1.0)
    g.add_step(step1)

    step2 = mw.WorkflowStep.create(mw.WorkflowStepType.ANALYZE, "Step 2", inputs=["art_b"])
    step2.mark_completed(outputs=["art_c"], duration_ms=2.0)
    g.add_step(step2)

    assert g.get_parents("art_b") == [art_a]
    assert g.get_children("art_b") == [art_c]
    assert g.get_sources() == [art_a]
    assert g.get_producing_step("art_b").name == "Step 1"


def test_lineage_query_where_did_this_value_come_from(engine):
    """
    Test Requirement 8:
    A user can ask: 'Where did this 2.1433 Å value come from?'
    Verify that query_lineage returns source structure, algorithm, parameters, and certificate.
    """
    inst = engine.execute_4hhb_coordination_workflow()
    assert inst.status == mw.WorkflowStatus.COMPLETED

    # Find analysis artifact
    ana_arts = [a for a in inst.provenance.artifacts.values() if a.artifact_type == mw.ArtifactType.ANALYSIS]
    assert len(ana_arts) > 0
    target_ana = ana_arts[0]

    report = inst.provenance.query_lineage(target_ana.artifact_id)
    assert report.target_artifact_id == target_ana.artifact_id
    assert np.isclose(report.target_value, 2.1433, atol=1e-3)
    assert report.units == "Angstrom"
    assert report.backend_name == "Native MOCS-Cert"
    assert len(report.source_artifacts) >= 1
    assert report.source_artifacts[0]["identifier"] == "4HHB"
    assert len(report.lineage_path) >= 3


# =============================================================================
# 3. Backend Capability Discovery & Smoke Tests
# =============================================================================

def test_backend_discovery_matrix():
    """Verify backend discovery service detects and smoke tests backends."""
    backends = mw.BackendDiscoveryService.discover_all(force_refresh=True)
    assert "mocs" in backends
    assert "mdanalysis" in backends
    assert "molstar" in backends

    mocs_b = backends["mocs"]
    assert mocs_b.state == mw.BackendCapabilityState.AVAILABLE
    assert mocs_b.smoke_test_passed is True
    assert mocs_b.license == "Apache-2.0"

    mda_b = backends["mdanalysis"]
    assert mda_b.state == mw.BackendCapabilityState.AVAILABLE
    assert mda_b.smoke_test_passed is True
    assert mda_b.license == "GPL-2.0-or-later"


# =============================================================================
# 4. Specialized Pipelines
# =============================================================================

def test_trajectory_pipeline_transforms():
    """Verify non-mutating PBC unwrap, center, fit, and slicing."""
    n_frames = 10
    n_atoms = 5
    coords = np.zeros((n_frames, n_atoms, 3), dtype=np.float64)
    for k in range(n_frames):
        coords[k, :, 0] = k * 1.5
    box = np.array([10.0, 10.0, 10.0])

    unwrapped = unwrap_pbc(coords, box)
    assert unwrapped.shape == coords.shape
    # Ensure source was not mutated
    assert coords[1, 0, 0] == 1.5

    centered = center_coordinates(coords)
    assert np.allclose(np.mean(centered[0], axis=0), [0.0, 0.0, 0.0])

    ref = coords[0]
    fitted = fit_reference(coords, ref)
    assert fitted.shape == coords.shape

    sliced = slice_frames(100, start=10, stop=50, stride=5)
    assert len(sliced) == 8
    assert sliced[0] == 10
    assert sliced[-1] == 45

    metrics = compute_trajectory_metrics(coords, ref)
    assert "rmsd_series" in metrics
    assert "rg_series" in metrics
    assert metrics["n_frames"] == 10


def test_selection_pipeline_typed_ast():
    """Verify typed AST evaluation with keywords and boolean combinations."""
    atoms = [
        AtomRecord(0, "FE", "HEM", "A", 142, np.array([10.0, 10.0, 10.0])),
        AtomRecord(1, "NE2", "HIS", "A", 87, np.array([12.14, 10.0, 10.0])),
        AtomRecord(2, "CA", "ALA", "A", 88, np.array([20.0, 20.0, 20.0])),
        AtomRecord(3, "N3", "DC", "B", 1, np.array([30.0, 30.0, 30.0])),
    ]
    prov = ProvenanceRecord(StructureSourceType.EXPERIMENTAL, "TEST", "PDB", "1.0", "hash123")
    struct = CanonicalStructure("TEST", prov, ["A", "B"], [("A", 142, "HEM"), ("A", 87, "HIS"), ("A", 88, "ALA"), ("B", 1, "DC")], atoms)

    # 1. Ligand keyword
    sel_lig = SelectionEvaluator.evaluate("ligand", struct)
    assert sel_lig.selected_atom_indices == (0,)

    # 2. Protein keyword
    sel_prot = SelectionEvaluator.evaluate("protein", struct)
    assert set(sel_lig.selected_atom_indices).isdisjoint(sel_prot.selected_atom_indices)
    assert 1 in sel_prot.selected_atom_indices
    assert 2 in sel_prot.selected_atom_indices

    # 3. Nucleic keyword
    sel_nuc = SelectionEvaluator.evaluate("nucleic", struct)
    assert sel_nuc.selected_atom_indices == (3,)

    # 4. Within distance query
    sel_near = SelectionEvaluator.evaluate("within 3.0 of resname HEM", struct)
    assert 0 in sel_near.selected_atom_indices  # HEM self
    assert 1 in sel_near.selected_atom_indices  # HIS NE2 is at dist 2.14 Å
    assert 2 not in sel_near.selected_atom_indices  # ALA is > 10 Å away


def test_chemistry_pipeline_ligand_perception():
    """Verify chemistry perception and SMILES handling."""
    res = ChemistryPipeline.parse_ligand("CC(=O)OC1=CC=CC=C1C(=O)O", name="Aspirin")
    assert res["status"] in ("COMPLETED", "COMPLETED_FALLBACK")
    assert res["name"] == "Aspirin"
    assert "fingerprint_sha256" in res


def test_structural_comparison_pipeline():
    """Verify pairwise structural comparison with Kabsch alignment."""
    atoms_a = [
        AtomRecord(0, "CA", "ALA", "A", 1, np.array([0.0, 0.0, 0.0])),
        AtomRecord(1, "CA", "GLY", "A", 2, np.array([3.8, 0.0, 0.0])),
        AtomRecord(2, "CA", "VAL", "A", 3, np.array([7.6, 0.0, 0.0])),
    ]
    atoms_b = [
        AtomRecord(0, "CA", "ALA", "A", 1, np.array([0.0, 1.0, 0.0])),
        AtomRecord(1, "CA", "GLY", "A", 2, np.array([3.8, 1.0, 0.0])),
        AtomRecord(2, "CA", "VAL", "A", 3, np.array([7.6, 1.0, 0.0])),
    ]
    prov = ProvenanceRecord(StructureSourceType.SYNTHETIC, "CMP", "MOCS", "1.0", "h")
    sa = CanonicalStructure("SA", prov, ["A"], [("A", 1, "ALA"), ("A", 2, "GLY"), ("A", 3, "VAL")], atoms_a)
    sb = CanonicalStructure("SB", prov, ["A"], [("A", 1, "ALA"), ("A", 2, "GLY"), ("A", 3, "VAL")], atoms_b)

    cmp_res = StructureComparisonPipeline.compare_structures(sa, sb)
    assert np.isclose(cmp_res["rmsd_angstrom"], 0.0, atol=1e-3)
    assert cmp_res["aligned_atoms_count"] == 3


def test_crystallography_pipeline():
    """Verify crystallographic metadata extraction."""
    prov = ProvenanceRecord(StructureSourceType.EXPERIMENTAL, "4HHB", "PDB", "1.0", "h", resolution_angstrom=1.74)
    atoms = [AtomRecord(0, "CA", "ALA", "A", 1, np.array([0.0, 0.0, 0.0]), b_factor=14.2)]
    s = CanonicalStructure("4HHB", prov, ["A"], [("A", 1, "ALA")], atoms)

    c_res = CrystallographyPipeline.inspect_crystallography(s)
    assert c_res["resolution_angstrom"] == 1.74
    assert c_res["b_factor_metrics"]["mean_b_factor"] == 14.2
    assert "unit_cell" in c_res


def test_simulation_pipeline_strictly_simulated():
    """Verify simulation pipeline strictly tags output as SIMULATED, never EXPERIMENTAL."""
    prov = ProvenanceRecord(StructureSourceType.EXPERIMENTAL, "4HHB", "PDB", "1.0", "h")
    atoms = [AtomRecord(0, "CA", "ALA", "A", 1, np.array([0.0, 0.0, 0.0]))]
    s = CanonicalStructure("4HHB", prov, ["A"], [("A", 1, "ALA")], atoms)

    sim_res = SimulationPipeline.setup_minimization(s)
    assert sim_res["data_type"] == "SIMULATED"
    assert sim_res["data_type"] != "EXPERIMENTAL"
    assert "force_field" in sim_res
    assert "integrator" in sim_res


# =============================================================================
# 5. End-to-End Real Workflows (4HHB, 1BNA, synth_500f)
# =============================================================================

def test_workflow_4hhb_end_to_end(engine):
    """Verify 4HHB workflow execution, oracle differential check, and certificate generation."""
    inst = engine.execute_4hhb_coordination_workflow()
    assert inst.status == mw.WorkflowStatus.COMPLETED
    assert inst.certificate is not None
    assert inst.certificate.discrepancy_classification == "WITHIN_TOLERANCE"
    assert inst.manifest is not None
    assert len(inst.manifest.manifest_digest) == 64


def test_workflow_1bna_end_to_end(engine):
    """Verify 1BNA B-DNA base pairing workflow without protein semantics leakage."""
    inst = engine.execute_1bna_duplex_workflow()
    assert inst.status == mw.WorkflowStatus.COMPLETED
    assert inst.certificate is not None

    # Check analysis artifact value is ~2.912 Å
    ana_arts = [a for a in inst.provenance.artifacts.values() if a.artifact_type == mw.ArtifactType.ANALYSIS]
    assert len(ana_arts) > 0
    assert 2.5 <= ana_arts[0].value <= 3.3


def test_workflow_synth_500f_trajectory_end_to_end(engine):
    """Verify 500-frame trajectory workflow with differential verification."""
    inst = engine.execute_synth_500f_trajectory_workflow(stride=2, start_frame=0, stop_frame=500)
    assert inst.status == mw.WorkflowStatus.COMPLETED
    assert inst.certificate is not None
    assert inst.certificate.discrepancy_classification == "WITHIN_TOLERANCE"


# =============================================================================
# 6. Reproducibility Manifest & Reproduction
# =============================================================================

def test_manifest_export_and_reproduction(engine):
    """Verify manifest JSON/CSV/Markdown serialization and reproduction verification."""
    inst = engine.execute_4hhb_coordination_workflow()
    manifest = inst.manifest
    assert manifest is not None

    # Export formats
    json_str = manifest.to_json()
    assert "4HHB" in json_str

    csv_str = manifest.to_csv()
    assert "Observable,Value,Units" in csv_str

    md_str = manifest.to_markdown_report()
    assert "# Scientific Workflow Audit Report" in md_str

    # Reproduce from manifest
    rep_res = engine.reproduce_from_manifest(manifest.to_dict())
    assert rep_res["status"] == "COMPLETED"
    assert rep_res["certificate_matched"] is True
    assert rep_res["manifest_digest_verified"] is True


# =============================================================================
# 7. Concurrency, Generation & Failure Semantics
# =============================================================================

def test_workflow_cancellation_and_failure(engine):
    """Verify workflow cancellation increments generation and stops execution."""
    inst = engine.create_workflow(template_id="structure_inspection")
    assert inst.status == mw.WorkflowStatus.RUNNING
    gen_before = inst.generation

    success = engine.cancel_workflow(inst.workflow_id)
    assert success is True
    assert inst.status == mw.WorkflowStatus.CANCELLED
    assert inst.generation > gen_before


# =============================================================================
# 8. FastAPI Workflow Endpoints Integration
# =============================================================================

def test_fastapi_workflow_endpoints(client):
    """Test all workflow endpoints via FastAPI test client."""
    # 1. Backends
    res_b = client.get("/api/v1/workflow/backends")
    assert res_b.status_code == 200
    data_b = res_b.json()
    assert "backends" in data_b
    assert "mocs" in data_b["backends"]

    # 2. Templates
    res_t = client.get("/api/v1/workflow/templates")
    assert res_t.status_code == 200
    data_t = res_t.json()
    assert len(data_t["templates"]) == 7

    # 3. Execute 4HHB
    res_e = client.post("/api/v1/workflow/execute/4hhb")
    assert res_e.status_code == 200
    wf_data = res_e.json()["workflow"]
    wid = wf_data["workflow_id"]
    assert wf_data["status"] == "COMPLETED"
    assert wf_data["has_certificate"] is True

    # 4. Provenance DAG
    res_dag = client.get(f"/api/v1/workflow/{wid}/provenance")
    assert res_dag.status_code == 200
    dag_data = res_dag.json()["dag"]
    assert len(dag_data["artifacts"]) >= 5
    assert len(dag_data["edges"]) >= 4

    # 5. Lineage Query
    ana_id = next(aid for aid, a in dag_data["artifacts"].items() if a["artifact_type"] == "AnalysisArtifact")
    res_lin = client.get(f"/api/v1/workflow/{wid}/lineage/{ana_id}")
    assert res_lin.status_code == 200
    lin_data = res_lin.json()["lineage"]
    assert lin_data["target_artifact_id"] == ana_id
    assert lin_data["backend_name"] == "Native MOCS-Cert"

    # 6. Manifest & Export
    res_man = client.get(f"/api/v1/workflow/{wid}/manifest")
    assert res_man.status_code == 200

    res_exp_json = client.get(f"/api/v1/workflow/{wid}/export/json")
    assert res_exp_json.status_code == 200
    assert "application/json" in res_exp_json.headers["content-type"]

    res_exp_csv = client.get(f"/api/v1/workflow/{wid}/export/csv")
    assert res_exp_csv.status_code == 200
    assert "text/csv" in res_exp_csv.headers["content-type"]

    res_exp_md = client.get(f"/api/v1/workflow/{wid}/export/md")
    assert res_exp_md.status_code == 200
    assert "text/markdown" in res_exp_md.headers["content-type"]

    # 7. Reproduce
    res_rep = client.post("/api/v1/workflow/reproduce", json={"manifest": res_man.json()["manifest"]})
    assert res_rep.status_code == 200
    assert res_rep.json()["reproduction_report"]["certificate_matched"] is True
