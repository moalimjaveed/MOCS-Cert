"""
tests/integration/test_pass32_maximum_capability.py — PASS 32 Maximum Capability Test Suite.

Comprehensive verification of:
1. 16-Domain Scientific Capability Taxonomy (A–P).
2. 46-Project Open-Source Ecosystem Registry Expansion.
3. License and Model Weight Firewall (Code vs Weight Separation).
4. Cryo-EM 3D Density Map Parsing via mrcfile (MRCMapAdapter).
5. Deep Learning Sequence Design (ProteinMPNNAdapter).
6. Biomolecular Complex Cofolding (BoltzAdapter).
7. External-Worker Docking Isolation (SminaDockingAdapter).
8. Capability Gap Analysis Decisions (INTEGRATE, DELEGATE, REJECT, etc.).
9. 8-Dimension Internal Engineering Scorecard.
10. Strict Provenance and Biophysical Unit Invariants.
"""

import os
import tempfile
import pytest
import numpy as np

from mocs.ecosystem.interfaces import (
    StructureSourceType,
    ObservableType,
    QualityTier,
    LicenseClass,
    IntegrationStatus,
    CryoEMMapResult,
    SequenceDesignResult,
    ComplexPredictionResult,
    DockingPoseResult,
    DockingResultSet,
)
from mocs.ecosystem.registry import (
    OpenSourceEcosystemRegistry,
    ECOSYSTEM_PROJECTS,
    OpenSourceProject,
)
from mocs.ecosystem.backends import (
    MRCMapAdapter,
    ProteinMPNNAdapter,
    BoltzAdapter,
    SminaDockingAdapter,
)
from mocs.ecosystem.gap_analysis import (
    GapDecision,
    TAXONOMY_DOMAINS,
    CapabilityGap,
    CAPABILITY_GAPS,
    GapAnalysisRegistry,
)


# ===========================================================================
# 1. 16-Domain Scientific Capability Taxonomy
# ===========================================================================

class TestCapabilityTaxonomy:
    def test_taxonomy_has_all_16_domains(self):
        expected_keys = [chr(i) for i in range(ord('A'), ord('P') + 1)]
        assert len(TAXONOMY_DOMAINS) >= 16
        for k in expected_keys:
            assert k in TAXONOMY_DOMAINS, f"Domain {k} must be in TAXONOMY_DOMAINS"

    def test_each_domain_has_metadata_and_packages(self):
        for key, dom in TAXONOMY_DOMAINS.items():
            assert "title" in dom and dom["title"], f"Domain {key} missing title"
            assert "description" in dom and dom["description"], f"Domain {key} missing description"
            assert "primary_packages" in dom and len(dom["primary_packages"]) > 0, f"Domain {key} missing packages"

    def test_gap_registry_covers_all_domains(self):
        stats = GapAnalysisRegistry.get_gap_statistics()
        assert stats["domains_covered"] >= 16
        assert stats["total_capabilities_tracked"] >= 24


# ===========================================================================
# 2. Ecosystem Registry Expansion
# ===========================================================================

class TestEcosystemRegistryExpansion:
    def test_registry_has_at_least_45_projects(self):
        n = len(ECOSYSTEM_PROJECTS)
        assert n >= 45, f"Expected >= 45 projects in PASS 32 registry, got {n}"

    def test_pass32_added_projects_exist(self):
        required = [
            "mrcfile", "cctbx", "PyHMMER", "DeepChem", "TorchANI",
            "PySCF", "TemPy", "OpenFold", "Boltz-1", "ProteinMPNN",
            "smina", "gnina", "DiffDock", "ESMFold", "NAMD",
        ]
        for p in required:
            assert p in ECOSYSTEM_PROJECTS, f"Project {p} must exist in ECOSYSTEM_PROJECTS"

    def test_domain_filtering_works_for_all_keys(self):
        for key in [chr(i) for i in range(ord('A'), ord('P') + 1)]:
            projects = OpenSourceEcosystemRegistry.get_by_domain(key)
            assert len(projects) > 0, f"Domain {key} returned zero projects"


# ===========================================================================
# 3. License and Model Weight Firewall
# ===========================================================================

class TestLicenseAndWeightFirewall:
    def test_firewall_verification_passes_with_zero_violations(self):
        fw = OpenSourceEcosystemRegistry.verify_firewall()
        assert fw["valid"] is True, f"Firewall violations detected: {fw['violations']}"
        assert len(fw["violations"]) == 0
        assert fw["core_clean_apache2"] is True

    def test_rfdiffusion_quarantined_due_to_non_commercial_weights(self):
        rf = ECOSYSTEM_PROJECTS["RFdiffusion"]
        assert rf.bundling_mode == "REJECTED"
        assert rf.commercial_use_allowed is False
        assert rf.is_compatible is False
        assert "Non-Commercial" in str(rf.weights_license)

        fw = OpenSourceEcosystemRegistry.verify_firewall()
        assert "RFdiffusion" in fw["quarantined_artifacts"]

    def test_namd_quarantined_due_to_academic_license(self):
        namd = ECOSYSTEM_PROJECTS["NAMD"]
        assert namd.bundling_mode == "REJECTED"
        assert namd.commercial_use_allowed is False
        assert namd.is_compatible is False

        fw = OpenSourceEcosystemRegistry.verify_firewall()
        assert "NAMD" in fw["quarantined_artifacts"]

    def test_copyleft_tools_are_isolated_to_subprocess_or_oracle(self):
        fw = OpenSourceEcosystemRegistry.verify_firewall()
        isolated = fw["isolated_copyleft_workers"]
        for expected in ["PLIP", "Open Babel", "smina", "gnina", "TemPy", "MDAnalysis"]:
            assert expected in isolated, f"Expected copyleft tool {expected} to be isolated"


# ===========================================================================
# 4. Cryo-EM Density Map Adapter (mrcfile)
# ===========================================================================

class TestCryoEMMapAdapter:
    def test_mrc_adapter_is_available(self):
        adapter = MRCMapAdapter()
        assert adapter.is_available() is True
        assert adapter.license == "BSD-3-Clause"

    def test_synthetic_map_creation_and_reading(self):
        adapter = MRCMapAdapter()
        with tempfile.NamedTemporaryFile(suffix=".mrc", delete=False) as tf:
            temp_path = tf.name

        try:
            adapter.create_synthetic_map(temp_path, shape=(12, 12, 12), voxel_size=1.25, space_group=19)
            res = adapter.read_map(temp_path, map_id="test_density_map")

            assert isinstance(res, CryoEMMapResult)
            assert res.grid_dimensions == (12, 12, 12)
            assert res.voxel_size == (1.25, 1.25, 1.25)
            assert res.space_group == 19
            assert res.format == "MRC2014"
            assert res.backend == "mrcfile"
            assert np.isfinite(res.density_min)
            assert np.isfinite(res.density_max)
            assert np.isfinite(res.density_mean)
            assert np.isfinite(res.density_rms)
            assert len(res.limitations) > 0
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)


# ===========================================================================
# 5. Protein Sequence Design (ProteinMPNN)
# ===========================================================================

class TestProteinMPNNAdapter:
    def test_protein_mpnn_metadata(self):
        adapter = ProteinMPNNAdapter()
        assert adapter.license == "MIT"
        assert adapter.version == "v1.0.1"
        assert "inverse_folding" in adapter.capabilities

    def test_protein_mpnn_unavailable_by_default(self):
        adapter = ProteinMPNNAdapter()
        # In default environment without weights path, must report unavailable
        if not os.environ.get("PROTEINMPNN_WEIGHTS"):
            assert adapter.is_available() is False
            import pytest
            with pytest.raises(RuntimeError, match="ProteinMPNN is not available"):
                adapter.design_sequence("4HHB_A", "VLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHF")

    def test_design_sequence_deterministic_seed_with_weights(self, tmp_path, monkeypatch):
        weights_file = tmp_path / "vanilla_model_30_010.pt"
        weights_file.write_text("dummy_weights")
        monkeypatch.setenv("PROTEINMPNN_WEIGHTS", str(weights_file))

        adapter = ProteinMPNNAdapter()
        assert adapter.is_available() is True
        native_seq = "VLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHF"

        res1 = adapter.design_sequence("4HHB_A", native_seq, temperature=0.1, seed=42)
        res2 = adapter.design_sequence("4HHB_A", native_seq, temperature=0.1, seed=42)

        assert isinstance(res1, SequenceDesignResult)
        assert res1.designed_sequence == res2.designed_sequence
        assert res1.sequence_recovery == res2.sequence_recovery
        assert res1.target_structure_id == "4HHB_A"
        assert res1.model_name == "ProteinMPNN"
        assert 40.0 <= res1.sequence_recovery <= 90.0

    def test_fixed_positions_are_preserved(self, tmp_path, monkeypatch):
        weights_file = tmp_path / "vanilla_model_30_010.pt"
        weights_file.write_text("dummy_weights")
        monkeypatch.setenv("PROTEINMPNN_WEIGHTS", str(weights_file))

        adapter = ProteinMPNNAdapter()
        native_seq = "VLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHF"
        fixed = [0, 1, 2, 3, 4]

        res = adapter.design_sequence("4HHB_A", native_seq, temperature=0.1, seed=123, fixed_positions=fixed)
        for idx in fixed:
            assert res.designed_sequence[idx] == native_seq[idx], f"Position {idx} should be fixed"


# ===========================================================================
# 6. Biomolecular Complex Prediction (Boltz-1)
# ===========================================================================

class TestBoltzAdapter:
    def test_boltz_metadata(self):
        adapter = BoltzAdapter()
        assert adapter.license == "MIT"
        assert "protein_protein_complex" in adapter.capabilities
        assert "protein_dna_complex" in adapter.capabilities
        assert "protein_ligand_complex" in adapter.capabilities

    def test_boltz_unavailable_by_default(self):
        adapter = BoltzAdapter()
        if not os.environ.get("BOLTZ_WEIGHTS"):
            assert adapter.is_available() is False
            import pytest
            with pytest.raises(RuntimeError, match="Boltz-1 is not available"):
                adapter.predict_complex("complex_ab_lig", [{"chain": "A", "type": "protein", "sequence": "MKVL"}])

    def test_complex_prediction_output_contract_with_weights(self, tmp_path, monkeypatch):
        weights_file = tmp_path / "boltz1.pt"
        weights_file.write_text("dummy_weights")
        monkeypatch.setenv("BOLTZ_WEIGHTS", str(weights_file))

        adapter = BoltzAdapter()
        assert adapter.is_available() is True
        entities = [
            {"chain": "A", "type": "protein", "sequence": "MKVLWAALLVTFLAGCQAKVEQAVETEPEPELRQQTEWQSGQ"},
            {"chain": "B", "type": "protein", "sequence": "MKVLWAALLVTFLAGCQAKVEQAVETEPEPELRQQTEWQSGQ"},
            {"chain": "C", "type": "ligand", "smiles": "CC(=O)OC1=CC=CC=C1C(=O)O"},
        ]

        res = adapter.predict_complex("complex_ab_lig", entities, seed=42, num_recycles=3)
        assert isinstance(res, ComplexPredictionResult)
        assert res.complex_id == "complex_ab_lig"
        assert 0.0 <= res.iptm_score <= 1.0
        assert 0.0 <= res.ptm_score <= 1.0
        assert 0.0 <= res.mean_plddt <= 100.0
        assert res.source_type == StructureSourceType.PREDICTED
        assert res.source_type != StructureSourceType.EXPERIMENTAL


# ===========================================================================
# 7. Smina Docking Subprocess Isolation
# ===========================================================================

class TestSminaDockingAdapter:
    def test_smina_metadata_and_isolation(self):
        adapter = SminaDockingAdapter()
        meta = adapter.get_metadata()
        assert meta["license"] == "GPL-2.0"
        assert meta["bundling_mode"] == "SUBPROCESS"
        assert any("NOT thermodynamic free energy" in lim for lim in meta["scientific_limitations"])


# ===========================================================================
# 8. Gap Analysis Decisions
# ===========================================================================

class TestGapAnalysisDecisions:
    def test_all_gaps_have_valid_decisions(self):
        for gap in CAPABILITY_GAPS:
            assert isinstance(gap.decision, GapDecision)
            assert gap.decision_rationale, f"Gap {gap.capability} missing decision rationale"

    def test_rfdiffusion_decision_is_reject(self):
        gaps = GapAnalysisRegistry.get_by_domain("H")
        rf_gap = next(g for g in gaps if "RFdiffusion" in g.capability or "RFdiffusion" in g.best_open_source)
        assert rf_gap.decision == GapDecision.REJECT
        assert "non-commercial" in rf_gap.decision_rationale.lower()

    def test_mrc_map_decision_is_integrate(self):
        gaps = GapAnalysisRegistry.get_by_domain("K")
        mrc_gap = next(g for g in gaps if "mrcfile" in g.best_open_source)
        assert mrc_gap.decision == GapDecision.INTEGRATE


# ===========================================================================
# 9. Open-Source Engineering Scorecard
# ===========================================================================

class TestScorecard:
    def test_scorecard_has_all_projects(self):
        sc = OpenSourceEcosystemRegistry.get_scorecard()
        assert len(sc) == len(ECOSYSTEM_PROJECTS)

    def test_scorecard_dimensions_are_scored(self):
        sc = OpenSourceEcosystemRegistry.get_scorecard()
        required_dims = [
            "scientific_maturity", "reproducibility", "documentation",
            "interoperability", "license_compatibility", "maintenance",
            "testability", "mocs_integration_difficulty",
        ]
        for name, entry in sc.items():
            for dim in required_dims:
                assert dim in entry, f"Project {name} missing scorecard dimension {dim}"
                score = entry[dim]
                assert 1 <= score <= 5, f"Project {name} dimension {dim} has invalid score {score}"


# ===========================================================================
# 10. Canonical Interfaces & Provenance Contracts
# ===========================================================================

class TestCanonicalInterfaces:
    def test_observable_type_has_pass32_enums(self):
        assert hasattr(ObservableType, "CRYO_EM_MAP")
        assert hasattr(ObservableType, "SEQUENCE_DESIGN")
        assert hasattr(ObservableType, "COMPLEX_PREDICTION")
        assert hasattr(ObservableType, "DOCKING")

    def test_docking_result_set_instantiation(self):
        pose = DockingPoseResult(
            pose_id="pose_1",
            ligand_id="LIG_01",
            pose_index=1,
            affinity_kcal_mol=-8.4,
            rmsd_to_reference=1.2,
            scoring_function="vinardo",
            box_center=(10.0, 15.0, 20.0),
            box_size=(20.0, 20.0, 20.0),
            backend="smina",
            version="2020.12",
            provenance={"seed": 42},
            limitations=["Empirical score in kcal/mol is NOT thermodynamic ΔG"],
        )
        dset = DockingResultSet(
            docking_id="dock_run_1",
            receptor_id="4HHB",
            ligand_id="HEM",
            poses=[pose],
            best_affinity_kcal_mol=-8.4,
            scoring_function="vinardo",
            backend="smina",
            version="2020.12",
            provenance={"search_exhaustiveness": 8},
        )
        assert len(dset.poses) == 1
        assert dset.best_affinity_kcal_mol == -8.4
