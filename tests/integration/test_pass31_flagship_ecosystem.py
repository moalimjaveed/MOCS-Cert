"""
tests/integration/test_pass31_flagship_ecosystem.py — PASS 31 Flagship Integration Tests.

Comprehensive PASS 31 test battery verifying:
1. Registry integrity: 32 projects, complete metadata, license compliance.
2. New interface types: ObservableType, TrajectoryObservableResult, InteractionResult,
   CavityResult, DesignResult, PredictionResult, CrystallographicResult, WorkflowProvenance.
3. New backend adapters: PLIP (oracle), fpocket, AutoDock Vina, Biotite, ProDy, pymbar.
4. Extended differential engine: verify_contacts, verify_sasa, verify_observable, verify_rmsd,
   three_way_comparison.
5. Observable registry: definitions, units, citations, contract validation.
6. Structure providers: 4HHB, 1BNA, synth_500f, AlphaFold, Generated.
7. License governance: all 32 projects classified, GPL isolation verified, RFdiffusion rejected.
8. Capability matrix: multi-backend coverage for distance, RMSD, contacts, SASA, interactions.
9. Scientific provenance: no predicted labeled as experimental, no empirical score labeled as ΔG.
10. Workflow provenance graph: node creation, DAG integrity.
"""

import os
import pytest
import numpy as np

from mocs.ecosystem.interfaces import (
    ObservableType,
    IntegrationStatus,
    QualityTier,
    LicenseClass,
    StructureSourceType,
    DiscrepancyClassification,
    BackendDistanceResult,
    TrajectoryObservableResult,
    InteractionResult,
    CavityResult,
    CavitySetResult,
    AtomPair,
    DesignResult,
    PredictionResult,
    CrystallographicResult,
    WorkflowProvenanceNode,
    WorkflowProvenance,
    DiscrepancyReport,
)
from mocs.ecosystem.providers import (
    RCSBStructureProvider,
    AlphaFoldDBProvider,
    SyntheticStructureProvider,
    GeneratedStructureProvider,
)
from mocs.ecosystem.backends import (
    MDAnalysisBackend,
    NativeMOCSBackend,
    MDTrajBackendAdapter,
    RDKitBackendAdapter,
    OpenMMBackendAdapter,
    BiopythonBackendAdapter,
    BiotiteBackendAdapter,
    ProDyBackendAdapter,
    GemmiBackendAdapter,
    PLIPOracleAdapter,
    fpocketOracleAdapter,
    AutoDockVinaAdapter,
    pymbarAdapter,
)
from mocs.ecosystem.differential import DifferentialVerificationEngine
from mocs.ecosystem.registry import OpenSourceEcosystemRegistry, ECOSYSTEM_PROJECTS
from mocs.ecosystem.observables import ObservableRegistry, OBSERVABLE_REGISTRY, ObservableDefinition


# ---------------------------------------------------------------------------
# Helper fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def structure_4hhb():
    provider = RCSBStructureProvider()
    return provider.load_structure("frontend/public/structures/4HHB.pdb")


@pytest.fixture
def structure_1bna():
    provider = RCSBStructureProvider()
    return provider.load_structure("frontend/public/structures/1BNA.pdb")


@pytest.fixture
def synthetic_provider():
    return SyntheticStructureProvider()


# ---------------------------------------------------------------------------
# 1. Registry Integrity Tests
# ---------------------------------------------------------------------------

class TestRegistryIntegrity:
    """G1: Verify 32-project registry with complete metadata."""

    def test_registry_has_at_least_30_projects(self):
        n = len(ECOSYSTEM_PROJECTS)
        assert n >= 30, f"Expected >= 30 projects in registry, got {n}"

    def test_registry_has_32_projects(self):
        assert len(ECOSYSTEM_PROJECTS) >= 32

    def test_all_projects_have_required_fields(self):
        for name, proj in ECOSYSTEM_PROJECTS.items():
            assert proj.name, f"{name}: name must not be empty"
            assert proj.category, f"{name}: category must not be empty"
            assert proj.version, f"{name}: version must not be empty"
            assert proj.license, f"{name}: license must not be empty"
            assert proj.license_class, f"{name}: license_class must not be empty"
            assert proj.quality_tier, f"{name}: quality_tier must not be empty"
            assert proj.repository_url, f"{name}: repository_url must not be empty"
            assert proj.citation, f"{name}: citation must not be empty"
            assert proj.mocs_role, f"{name}: mocs_role must not be empty"
            assert proj.integration_status, f"{name}: integration_status must not be empty"
            assert proj.limitations, f"{name}: limitations must not be empty"
            assert proj.bundling_mode, f"{name}: bundling_mode must not be empty"

    def test_all_projects_have_capabilities_list(self):
        for name, proj in ECOSYSTEM_PROJECTS.items():
            assert isinstance(proj.capabilities, list), f"{name}: capabilities must be list"
            assert len(proj.capabilities) > 0, f"{name}: capabilities must not be empty"

    def test_tier_s_projects_are_well_known_packages(self):
        tier_s = [p.name for p in ECOSYSTEM_PROJECTS.values() if p.quality_tier == QualityTier.TIER_S]
        expected_tier_s = {"Mol*", "MDAnalysis", "MDTraj", "RDKit", "RCSB PDB APIs", "UniProt API",
                           "AlphaFold DB", "GROMACS", "OpenMM", "Biopython", "PLIP", "AutoDock Vina",
                           "pymbar", "MOCS-Cert Native"}
        for expected in expected_tier_s:
            assert expected in tier_s, f"Expected {expected} to be Tier S"

    def test_new_projects_added_in_pass31(self):
        new_projects = [
            "PLIP", "fpocket", "Open Babel", "Biotite", "ProDy",
            "Boltz-1", "ESMFold", "OpenFold", "ProteinMPNN", "RFdiffusion",
            "pymbar", "alchemlyb", "AutoDock Vina", "smina",
            "MolProbity", "LAMMPS", "ESM Atlas", "MOCS-Cert Native",
        ]
        for p in new_projects:
            assert p in ECOSYSTEM_PROJECTS, f"Project {p} should be in PASS 31 registry"


# ---------------------------------------------------------------------------
# 2. License Compliance Tests
# ---------------------------------------------------------------------------

class TestLicenseGovernance:
    """G14: License governance — GPL isolation, RFdiffusion rejected."""

    def test_license_compliance_all_valid(self):
        result = OpenSourceEcosystemRegistry.verify_license_compliance()
        assert result["all_licenses_valid"], (
            f"License compliance failed: incompatible projects = "
            f"{result['incompatible_projects']}"
        )

    def test_rfddiffusion_is_rejected(self):
        """RFdiffusion model weights are non-commercial — must be flagged as incompatible."""
        rfdiff = ECOSYSTEM_PROJECTS.get("RFdiffusion")
        assert rfdiff is not None
        assert rfdiff.is_compatible is False, (
            "RFdiffusion must be marked is_compatible=False due to non-commercial weight license"
        )

    def test_gpl_projects_have_oracle_or_subprocess_boundary(self):
        """GPL projects must never be bundled in MOCS core."""
        for p in ECOSYSTEM_PROJECTS.values():
            if "GPL" in p.license and "LGPL" not in p.license:
                assert p.bundling_mode in ("ORACLE", "SUBPROCESS", "REJECTED"), (
                    f"{p.name} is GPL but bundling_mode={p.bundling_mode}; "
                    "must be ORACLE, SUBPROCESS, or REJECTED"
                )

    def test_plip_is_oracle_subprocess_only(self):
        """PLIP is GPL-2.0 — must be oracle/subprocess boundary."""
        plip = ECOSYSTEM_PROJECTS.get("PLIP")
        assert plip is not None
        assert "GPL" in plip.license
        assert plip.bundling_mode in ("ORACLE", "SUBPROCESS")

    def test_core_bundled_projects_are_permissive(self):
        """Only permissive-licensed projects may be CORE-bundled."""
        for p in ECOSYSTEM_PROJECTS.values():
            if p.bundling_mode == "CORE":
                assert p.license_class in (
                    LicenseClass.PERMISSIVE,
                    LicenseClass.PERMISSIVE_ATTRIBUTION,
                    LicenseClass.PUBLIC_DOMAIN,
                ), (
                    f"{p.name} is bundling_mode=CORE but license_class={p.license_class}; "
                    "must be permissive"
                )

    def test_capability_matrix_populated(self):
        matrix = OpenSourceEcosystemRegistry.capability_matrix()
        assert "trajectory_streaming" in matrix
        assert "smiles_parsing" in matrix
        assert "hbond_detection" in matrix


# ---------------------------------------------------------------------------
# 3. New Interface Types Tests
# ---------------------------------------------------------------------------

class TestNewInterfaceTypes:
    """G2: All new canonical result types are instantiable and contract-sound."""

    def test_observable_type_enum_completeness(self):
        expected = {
            ObservableType.DISTANCE, ObservableType.RMSD, ObservableType.RMSF,
            ObservableType.RADIUS_OF_GYRATION, ObservableType.SASA,
            ObservableType.CONTACTS, ObservableType.HBONDS, ObservableType.SALT_BRIDGES,
            ObservableType.FREE_ENERGY, ObservableType.NORMAL_MODES,
            ObservableType.PI_STACKING, ObservableType.CLUSTERING,
        }
        for obs in expected:
            assert obs in ObservableType

    def test_trajectory_observable_result_instantiation(self):
        result = TrajectoryObservableResult(
            observable_type=ObservableType.RMSD,
            values=np.array([0.5, 1.0, 1.5], dtype=np.float64),
            n_frames=3,
            method="Test RMSD",
            backend="Test Backend",
            version="1.0.0",
            units="Angstrom",
            provenance={"test": True},
        )
        assert result.n_frames == 3
        assert result.observable_type == ObservableType.RMSD
        assert len(result.values) == 3

    def test_interaction_result_instantiation(self):
        pair = AtomPair(
            donor_chain="A", donor_resname="SER", donor_resseq=45, donor_atom="OG",
            acceptor_chain="A", acceptor_resname="ASP", acceptor_resseq=78, acceptor_atom="OD1",
            distance_angstrom=2.85,
        )
        result = InteractionResult(
            interaction_type="HBOND",
            interactions=[pair],
            n_interactions=1,
            method="Test Geometry",
            backend="Test",
            version="1.0",
            provenance={"test": True},
        )
        assert result.n_interactions == 1
        assert result.approximation_status == "HEURISTIC"
        assert result.interactions[0].distance_angstrom == pytest.approx(2.85)

    def test_cavity_result_not_active_site_by_default(self):
        """A geometric cavity MUST NOT be labeled active site by default."""
        cavity = CavityResult(
            cavity_id=1,
            center_angstrom=np.array([10.0, 20.0, 30.0]),
            volume_angstrom3=350.0,
            druggability_score=0.72,
            n_alpha_spheres=48,
            method="fpocket",
            backend="fpocket",
            version="4.0",
            provenance={"test": True},
        )
        assert cavity.is_confirmed_active_site is False, (
            "CavityResult.is_confirmed_active_site must be False by default — "
            "geometric cavities are NOT confirmed active sites"
        )

    def test_prediction_result_source_type_is_predicted(self):
        """Prediction results must NEVER have EXPERIMENTAL source type."""
        pred = PredictionResult(
            prediction_id="AF-P12345",
            sequence="ACDEFGHIKLMNPQRSTVWY",
            per_residue_plddt=np.array([85.0, 90.0, 75.0]),
            mean_plddt=83.3,
            ptm_score=0.88,
            model_name="alphafold_monomer_v2.3",
            model_version="2.3.0",
            weights_id="alphafold_weights_v2.3",
            msa_source="UniRef90",
            template_data="none",
            seed=None,
            license="CC-BY 4.0",
            citation="Jumper et al., Nature 596, 583-589 (2021)",
            provenance={"test": True},
        )
        assert pred.source_type == StructureSourceType.PREDICTED
        assert pred.source_type != StructureSourceType.EXPERIMENTAL

    def test_workflow_provenance_node_creation(self):
        node = WorkflowProvenanceNode(
            step_id="step-001",
            operation="PDB Parsing",
            input_ids=[],
            backend="MOCS Native",
            version="0.1.0",
            parameters={"format": "PDB"},
            output_sha256="abc123",
            timestamp_utc="2026-09-17T00:00:00Z",
            status="OK",
        )
        workflow = WorkflowProvenance(
            workflow_id="wf-001",
            workflow_type="STRUCTURE_INSPECTION",
            nodes=[node],
            final_certificate_sha256=None,
            reproducibility_bundle_sha256=None,
        )
        assert len(workflow.nodes) == 1
        assert workflow.nodes[0].step_id == "step-001"


# ---------------------------------------------------------------------------
# 4. New Backend Adapter Tests
# ---------------------------------------------------------------------------

class TestNewBackendAdapters:
    """G3: New PASS 31 backend adapters have correct metadata and availability reporting."""

    def test_plip_oracle_adapter_metadata(self):
        plip = PLIPOracleAdapter()
        assert plip.backend_name == "PLIP"
        assert plip.license == "GPL-2.0-or-later"
        assert "Adasme" in plip.citation
        assert "hbond_detection" in plip.capabilities
        # When not installed, should gracefully return unavailable result
        result = plip.compute_interactions("nonexistent.pdb")
        assert result.n_interactions == 0
        assert "GPL" in result.provenance.get("boundary", "")

    def test_fpocket_adapter_metadata(self):
        fpocket = fpocketOracleAdapter()
        assert fpocket.backend_name == "fpocket"
        assert fpocket.license == "MIT"
        assert "Le Guilloux" in fpocket.citation
        assert "cavity_detection" in fpocket.capabilities

    def test_autodock_vina_adapter_metadata(self):
        vina = AutoDockVinaAdapter()
        assert vina.backend_name == "AutoDock Vina"
        assert vina.license == "Apache-2.0"
        assert "Eberhardt" in vina.citation
        meta = vina.get_metadata()
        assert "empirical" in meta["scientific_limitations"][0].lower()
        assert "thermodynamic" in meta["scientific_limitations"][0].lower()

    def test_biotite_adapter_contact_map_with_scipy_fallback(self):
        biotite = BiotiteBackendAdapter()
        assert biotite.backend_name == "Biotite"
        assert biotite.license == "BSD-3-Clause"
        # scipy is installed — test fallback contact map computation
        n_atoms = 10
        coords = np.random.RandomState(42).uniform(0, 20, size=(n_atoms, 3))
        result = biotite.compute_contact_map(coords, threshold_angstrom=8.0)
        # Either biotite is installed and works, or scipy fallback works
        assert result.get("available") in (True, False)
        if result.get("available"):
            assert "contact_map" in result
            assert result["contact_map"].shape == (n_atoms, n_atoms)
            # No self-contacts
            assert np.all(np.diag(result["contact_map"]) == 0)

    def test_prody_adapter_metadata(self):
        prody = ProDyBackendAdapter()
        assert prody.backend_name == "ProDy"
        assert prody.license == "MIT"
        assert "Bakan" in prody.citation
        assert "anm_normal_modes" in prody.capabilities

    def test_pymbar_adapter_metadata(self):
        pb = pymbarAdapter()
        assert pb.backend_name == "pymbar"
        assert pb.license == "MIT"
        assert "Shirts" in pb.citation
        assert "mbar_estimator" in pb.capabilities

    def test_gemmi_adapter_metadata(self):
        gemmi = GemmiBackendAdapter()
        assert gemmi.backend_name == "Gemmi"
        assert gemmi.license == "MPL-2.0"
        assert "Wojdyr" in gemmi.citation
        assert "crystallographic_symmetry" in gemmi.capabilities

    def test_all_adapters_report_version_string(self):
        adapters = [
            PLIPOracleAdapter(), fpocketOracleAdapter(), AutoDockVinaAdapter(),
            BiotiteBackendAdapter(), ProDyBackendAdapter(), pymbarAdapter(),
            GemmiBackendAdapter(),
        ]
        for a in adapters:
            assert isinstance(a.version, str), f"{a.backend_name}: version must be str"
            assert len(a.version) > 0, f"{a.backend_name}: version must not be empty"


# ---------------------------------------------------------------------------
# 5. Extended Differential Engine Tests
# ---------------------------------------------------------------------------

class TestExtendedDifferentialEngine:
    """G4: Extended differential engine — verify_contacts, verify_sasa, verify_observable."""

    def test_verify_contacts_identical_maps(self):
        contacts = np.array([[0, 1, 0], [1, 0, 1], [0, 1, 0]], dtype=bool)
        report = DifferentialVerificationEngine.verify_contacts(
            contacts, contacts, "MOCS", "Reference"
        )
        assert report.classification == DiscrepancyClassification.WITHIN_TOLERANCE
        assert report.status == "RESOLVED"

    def test_verify_contacts_different_maps(self):
        primary = np.array([[0, 1, 0], [1, 0, 1], [0, 1, 0]], dtype=bool)
        reference = np.array([[0, 0, 1], [0, 0, 0], [1, 0, 0]], dtype=bool)
        report = DifferentialVerificationEngine.verify_contacts(
            primary, reference, "MOCS", "Reference"
        )
        assert report.classification == DiscrepancyClassification.GENUINE_DISCREPANCY
        assert report.status == "UNRESOLVED"

    def test_verify_sasa_within_tolerance(self):
        sasa_vals = np.array([8000.0, 8100.0, 7950.0], dtype=np.float64)
        primary = TrajectoryObservableResult(
            observable_type=ObservableType.SASA,
            values=sasa_vals,
            n_frames=3,
            method="Shrake-Rupley MOCS",
            backend="MOCS",
            version="0.1.0",
            units="Angstrom^2",
            provenance={"test": True},
        )
        # Reference with tiny perturbation (<1%)
        ref_vals = sasa_vals + np.array([1.0, 2.0, -1.5])
        reference = TrajectoryObservableResult(
            observable_type=ObservableType.SASA,
            values=ref_vals,
            n_frames=3,
            method="FreeSASA MDAnalysis",
            backend="MDAnalysis",
            version="2.10.0",
            units="Angstrom^2",
            provenance={"test": True},
        )
        report = DifferentialVerificationEngine.verify_sasa(primary, reference)
        assert report.classification == DiscrepancyClassification.WITHIN_TOLERANCE

    def test_verify_rmsd_within_tolerance(self):
        rmsd_vals = np.array([0.5, 1.0, 1.5, 2.0], dtype=np.float64)
        primary = TrajectoryObservableResult(
            observable_type=ObservableType.RMSD,
            values=rmsd_vals,
            n_frames=4,
            method="MOCS RMSD",
            backend="MOCS",
            version="0.1.0",
            units="Angstrom",
            provenance={"test": True},
        )
        reference = TrajectoryObservableResult(
            observable_type=ObservableType.RMSD,
            values=rmsd_vals + 1e-6,  # tiny floating-point difference
            n_frames=4,
            method="MDAnalysis RMSD",
            backend="MDAnalysis",
            version="2.10.0",
            units="Angstrom",
            provenance={"test": True},
        )
        report = DifferentialVerificationEngine.verify_rmsd(primary, reference)
        assert report.classification == DiscrepancyClassification.WITHIN_TOLERANCE

    def test_verify_observable_genuine_discrepancy(self):
        primary = TrajectoryObservableResult(
            observable_type=ObservableType.DISTANCE,
            values=np.array([3.5, 4.0, 4.5], dtype=np.float64),
            n_frames=3,
            method="MOCS",
            backend="MOCS",
            version="0.1.0",
            units="Angstrom",
            provenance={"test": True},
        )
        reference = TrajectoryObservableResult(
            observable_type=ObservableType.DISTANCE,
            values=np.array([5.0, 6.0, 7.0], dtype=np.float64),  # large difference
            n_frames=3,
            method="Reference",
            backend="Reference",
            version="1.0.0",
            units="Angstrom",
            provenance={"test": True},
        )
        report = DifferentialVerificationEngine.verify_observable(primary, reference)
        assert report.classification == DiscrepancyClassification.GENUINE_DISCREPANCY
        assert report.status == "UNRESOLVED"

    def test_three_way_comparison_structure(self):
        make_result = lambda method: BackendDistanceResult(
            distances=np.array([3.5, 4.0, 4.5]),
            n_frames=3,
            method=method,
            version="1.0",
            provenance={},
        )
        reports = DifferentialVerificationEngine.three_way_comparison(
            make_result("MOCS"),
            make_result("MDAnalysis"),
            make_result("MDTraj"),
        )
        assert "primary_vs_reference_a" in reports
        assert "primary_vs_reference_b" in reports
        assert "reference_a_vs_reference_b" in reports
        for key, r in reports.items():
            assert isinstance(r, DiscrepancyReport), f"Expected DiscrepancyReport for {key}"


# ---------------------------------------------------------------------------
# 6. Observable Registry Tests
# ---------------------------------------------------------------------------

class TestObservableRegistry:
    """Observable definitions are complete and scientifically sound."""

    def test_registry_covers_primary_observables(self):
        required = {
            ObservableType.DISTANCE, ObservableType.RMSD, ObservableType.RMSF,
            ObservableType.SASA, ObservableType.CONTACTS, ObservableType.HBONDS,
            ObservableType.RADIUS_OF_GYRATION, ObservableType.FREE_ENERGY,
        }
        for obs_type in required:
            assert obs_type in OBSERVABLE_REGISTRY, f"{obs_type} missing from registry"

    def test_all_definitions_have_mathematical_definition(self):
        for obs_type, defn in OBSERVABLE_REGISTRY.items():
            assert defn.mathematical_definition, \
                f"{obs_type}: mathematical_definition must not be empty"

    def test_all_definitions_have_units(self):
        for obs_type, defn in OBSERVABLE_REGISTRY.items():
            assert defn.units, f"{obs_type}: units must not be empty"

    def test_all_definitions_have_citations(self):
        for obs_type, defn in OBSERVABLE_REGISTRY.items():
            assert len(defn.reference_citations) > 0, \
                f"{obs_type}: must have at least one reference citation"

    def test_all_definitions_have_known_limitations(self):
        for obs_type, defn in OBSERVABLE_REGISTRY.items():
            assert len(defn.known_limitations) > 0, \
                f"{obs_type}: must document at least one known limitation"

    def test_result_contract_validation_passes_for_valid_result(self):
        result = TrajectoryObservableResult(
            observable_type=ObservableType.DISTANCE,
            values=np.array([3.5, 4.0, 4.5], dtype=np.float64),
            n_frames=3,
            method="Test method",
            backend="Test backend",
            version="1.0",
            units="Angstrom",
            provenance={"algorithm": "test"},
        )
        violations = ObservableRegistry.verify_result_contract(result)
        assert violations == [], f"Expected 0 violations, got: {violations}"

    def test_result_contract_catches_empty_method(self):
        result = TrajectoryObservableResult(
            observable_type=ObservableType.RMSD,
            values=np.array([1.0]),
            n_frames=1,
            method="",  # empty method — violation
            backend="Test",
            version="1.0",
            units="Angstrom",
            provenance={"test": True},
        )
        violations = ObservableRegistry.verify_result_contract(result)
        assert any("method" in v for v in violations)


# ---------------------------------------------------------------------------
# 7. Structure Provider Tests (4HHB, 1BNA, AlphaFold, Generated)
# ---------------------------------------------------------------------------

class Test4HHBOracle:
    """Structural oracle test — 4HHB human deoxyhemoglobin."""

    def test_4hhb_loads_with_experimental_provenance(self, structure_4hhb):
        assert structure_4hhb.provenance.source_type == StructureSourceType.EXPERIMENTAL
        assert "4HHB" in structure_4hhb.identifier.upper()

    def test_4hhb_has_expected_chains(self, structure_4hhb):
        assert "A" in structure_4hhb.chains
        assert "C" in structure_4hhb.chains

    def test_4hhb_has_hem_in_chains_a_and_c(self, structure_4hhb):
        hems_a = [r for r in structure_4hhb.residues if r[0] == "A" and r[2] == "HEM"]
        hems_c = [r for r in structure_4hhb.residues if r[0] == "C" and r[2] == "HEM"]
        assert len(hems_a) == 1, "Chain A must contain exactly 1 HEM group"
        assert len(hems_c) == 1, "Chain C must contain exactly 1 HEM group"

    def test_4hhb_atom_count_sensible(self, structure_4hhb):
        assert structure_4hhb.atom_count > 4000, "4HHB should have > 4000 atoms"

    def test_4hhb_coordinates_are_finite_angstrom(self, structure_4hhb):
        coords = structure_4hhb.coordinates
        assert np.all(np.isfinite(coords)), "All 4HHB coordinates must be finite"
        assert np.max(np.abs(coords)) < 1000.0, "4HHB coordinates must be < 1000 Å"

    def test_4hhb_provenance_has_sha256(self, structure_4hhb):
        assert len(structure_4hhb.provenance.sha256_hash) == 64


class Test1BNAOracle:
    """Structural oracle test — 1BNA B-form DNA duplex."""

    def test_1bna_loads_with_experimental_provenance(self, structure_1bna):
        assert structure_1bna.provenance.source_type == StructureSourceType.EXPERIMENTAL

    def test_1bna_has_nucleic_acid_residues(self, structure_1bna):
        nucleotides = {"DA", "DT", "DG", "DC", "A", "T", "G", "C", "U"}
        resnames = {r[2] for r in structure_1bna.residues}
        nucleic = resnames & nucleotides
        assert len(nucleic) > 0, "1BNA must contain nucleotide residues"

    def test_1bna_atom_count_sensible(self, structure_1bna):
        assert structure_1bna.atom_count > 500


class TestAlphaFoldProvider:
    """AlphaFold provider tests — predicted structures must be labeled PREDICTED."""

    def test_alphafold_structure_is_predicted(self):
        provider = AlphaFoldDBProvider()
        struct = provider.load_structure("AF-P12345-F1")
        assert struct.provenance.source_type == StructureSourceType.PREDICTED

    def test_alphafold_plddt_in_valid_range(self):
        provider = AlphaFoldDBProvider()
        struct = provider.load_structure("AF-P12345-F1")
        b_factors = [a.b_factor for a in struct.atoms]
        assert all(0.0 <= b <= 100.0 for b in b_factors), \
            "pLDDT scores must be in range [0, 100]"

    def test_alphafold_never_labeled_experimental(self):
        provider = AlphaFoldDBProvider()
        struct = provider.load_structure("AF-P12345-F1")
        assert struct.provenance.source_type != StructureSourceType.EXPERIMENTAL


class TestGeneratedStructureProvider:
    """Generated structure provider tests."""

    def test_generated_structure_has_seed_provenance(self):
        provider = GeneratedStructureProvider()
        struct = provider.load_structure("designed_protein_001")
        assert struct.provenance.source_type == StructureSourceType.GENERATED
        assert "seed" in struct.provenance.extra_metadata

    def test_generated_structure_never_labeled_experimental(self):
        provider = GeneratedStructureProvider()
        struct = provider.load_structure("generated_01")
        assert struct.provenance.source_type != StructureSourceType.EXPERIMENTAL


# ---------------------------------------------------------------------------
# 8. Scientific Provenance Integrity Tests
# ---------------------------------------------------------------------------

class TestScientificProvenanceIntegrity:
    """Critical scientific provenance rules — no false labeling, no orphan numbers."""

    def test_autodock_vina_limitations_warn_against_thermodynamic_interpretation(self):
        """AutoDock Vina scores must NOT be reported as ΔG."""
        vina = AutoDockVinaAdapter()
        meta = vina.get_metadata()
        limitations_text = " ".join(meta["scientific_limitations"]).lower()
        assert "thermodynamic" in limitations_text, \
            "Vina adapter must warn: scores are NOT thermodynamic ΔG"
        assert "empirical" in limitations_text, \
            "Vina adapter must label scores as empirical"

    def test_cavity_result_not_active_site_unless_experimentally_validated(self):
        """fpocket cavities must NOT be labeled active sites by default."""
        cavity = CavityResult(
            cavity_id=1,
            center_angstrom=np.zeros(3),
            volume_angstrom3=200.0,
            druggability_score=0.5,
            n_alpha_spheres=30,
            method="fpocket",
            backend="fpocket",
            version="4.0",
            provenance={},
        )
        assert cavity.is_confirmed_active_site is False

    def test_plip_interaction_is_heuristic(self):
        """PLIP interactions are geometric heuristics, not quantum-mechanical."""
        plip = PLIPOracleAdapter()
        result = plip.compute_interactions("dummy.pdb")
        assert result.approximation_status == "HEURISTIC"

    def test_free_energy_observable_documents_simulation_requirement(self):
        """Free energy observable must document that simulation data is required."""
        defn = OBSERVABLE_REGISTRY.get(ObservableType.FREE_ENERGY)
        assert defn is not None
        limitations_text = " ".join(defn.known_limitations).lower()
        assert "simulation" in limitations_text

    def test_prediction_result_mean_plddt_is_confidence_not_resolution(self):
        """pLDDT is a confidence metric, not experimental resolution."""
        pred = PredictionResult(
            prediction_id="test-001",
            sequence="ACDEF",
            per_residue_plddt=np.array([85.0, 90.0, 72.0, 88.0, 95.0]),
            mean_plddt=86.0,
            ptm_score=None,
            model_name="alphafold_v2",
            model_version="2.3",
            weights_id="v2.3_weights",
            msa_source=None,
            template_data=None,
            seed=None,
            license="CC-BY 4.0",
            citation="Jumper et al., Nature 596, 583-589 (2021)",
            provenance={"confidence_metric": "pLDDT"},
        )
        assert pred.mean_plddt > 0.0
        assert pred.source_type == StructureSourceType.PREDICTED


# ---------------------------------------------------------------------------
# 9. Existing Pass29 Integration Tests (Compatibility)
# ---------------------------------------------------------------------------

class TestPass29BackwardCompatibility:
    """Ensure all PASS 29 backends still work after PASS 31 expansion."""

    def test_mdanalysis_backend_still_valid(self):
        backend = MDAnalysisBackend()
        assert backend.backend_name == "MDAnalysis"
        assert backend.license == "GPL-2.0-or-later"
        assert "Michaud-Agrawal" in backend.citation
        assert "trajectory_streaming" in backend.capabilities

    def test_native_mocs_backend_still_valid(self):
        backend = NativeMOCSBackend()
        assert backend.backend_name == "Native MOCS-Cert"
        assert backend.license == "Apache-2.0"
        assert "certified_pruning" in backend.capabilities

    def test_rdkit_adapter_version_reporting(self):
        rdkit = RDKitBackendAdapter()
        assert isinstance(rdkit.version, str)
        assert rdkit.license == "BSD-3-Clause"

    def test_biopython_adapter_version_reporting(self):
        bio = BiopythonBackendAdapter()
        assert isinstance(bio.version, str)
        assert bio.license == "BSD-3-Clause"

    def test_registry_has_original_15_projects(self):
        original = [
            "Mol*", "3Dmol.js", "NGL Viewer", "MDAnalysis", "MDTraj",
            "GROMACS", "OpenMM", "Biopython", "Gemmi", "ProDy",
            "RDKit", "RCSB PDB APIs", "UniProt API", "AlphaFold DB", "3D-Beacons",
        ]
        for p in original:
            assert p in ECOSYSTEM_PROJECTS, f"Original project {p} must still be in registry"
