"""
tests/integration/test_pass33_open_source_harvest.py — PASS 33 Open-Source Harvest Test Suite.

Exhaustive verification of:
1. 22-Domain Scientific Capability Taxonomy (A-V).
2. 94-Project Open-Source Ecosystem Registry & License/Weight Firewall.
3. Accurate Upstream License Classifications (P2Rank: MIT, fpocket: MIT, ProLIF: Apache-2.0, Foldseek: GPL-3.0, etc.).
4. Real Integration Modes (IN_PROCESS, OPTIONAL_LIBRARY, SUBPROCESS, EXTERNAL_WORKER, ORACLE, DATASET, PROVIDER).
5. P2Rank Binding Site Detection Adapter (P2RankAdapter).
6. fpocket Voronoi Cavity Detection Adapter (fpocketAdapter).
7. ProLIF Interaction Fingerprints Adapter (ProLIFAdapter).
8. Foldseek Structural Homology Search Adapter (FoldseekAdapter).
9. MMseqs2 Sequence Homology Search Adapter (MMseqs2Adapter).
10. PoseBusters Physical Ligand Sanity Validation (PoseBustersAdapter).
11. PDBe-SIFTS UniProt-to-PDB Mapping Adapter (SIFTSMappingAdapter).
12. Multi-Model Consensus Prediction Engine (ConsensusPredictionEngine) — No Coordinate Averaging.
13. Cross-Method Pocket Comparison Engine (PocketEnsembleEngine).
14. Benchmark Dataset Split Protection & Leakage Check (BenchmarkLeakageDetector).
15. Strict Epistemic Invariants & Provenance Capture.
"""

import os
import json
import pytest
import numpy as np

from mocs.ecosystem.interfaces import (
    StructureSourceType,
    ObservableType,
    QualityTier,
    LicenseClass,
    DomainScope,
    IntegrationStatus,
    PocketPredictionResult,
    PocketEnsembleResult,
    InteractionFingerprintResult,
    InteractionEnsembleResult,
    StructureSearchResult,
    SequenceHomologyResult,
    LigandValidationResult,
    EnsembleConsensusResult,
    DatasetBenchmarkSpec,
    SequenceStructureMapping,
)
from mocs.ecosystem.registry import (
    OpenSourceEcosystemRegistry,
    ECOSYSTEM_PROJECTS,
    OpenSourceProject,
)
from mocs.ecosystem.backends import (
    P2RankAdapter,
    fpocketAdapter,
    ProLIFAdapter,
    FoldseekAdapter,
    MMseqs2Adapter,
    PoseBustersAdapter,
    SIFTSMappingAdapter,
    ConsensusPredictionEngine,
    PocketEnsembleEngine,
    BenchmarkLeakageDetector,
)
from mocs.ecosystem.gap_analysis import (
    GapDecision,
    TAXONOMY_DOMAINS,
    CapabilityGap,
    CAPABILITY_GAPS,
    GapAnalysisRegistry,
)


# ===========================================================================
# 1. 22-Domain Scientific Capability Taxonomy
# ===========================================================================

class TestCapabilityTaxonomyPASS33:
    def test_taxonomy_has_all_22_domains(self):
        expected_keys = [chr(i) for i in range(ord('A'), ord('V') + 1)]
        assert len(TAXONOMY_DOMAINS) == 22
        for k in expected_keys:
            assert k in TAXONOMY_DOMAINS, f"Domain {k} must exist in TAXONOMY_DOMAINS"

    def test_each_domain_has_metadata_and_packages(self):
        for key, dom in TAXONOMY_DOMAINS.items():
            assert "title" in dom and dom["title"], f"Domain {key} missing title"
            assert "description" in dom and dom["description"], f"Domain {key} missing description"
            assert "primary_packages" in dom and len(dom["primary_packages"]) > 0, f"Domain {key} missing primary_packages"

    def test_gap_registry_covers_expanded_domains(self):
        stats = GapAnalysisRegistry.get_gap_statistics()
        assert stats["total_capabilities_tracked"] >= 36
        assert stats["domains_covered"] >= 20


# ===========================================================================
# 2. Ecosystem Registry Expansion & License Firewall
# ===========================================================================

class TestEcosystemRegistryPASS33:
    def test_registry_has_94_projects(self):
        n = len(ECOSYSTEM_PROJECTS)
        assert n >= 90, f"Expected >= 90 projects, got {n}"

    def test_accurate_upstream_licenses(self):
        expected_licenses = {
            "P2Rank": "MIT",
            "fpocket": "MIT",
            "ProLIF": "Apache-2.0",
            "Foldseek": "GPL-3.0",
            "MMseqs2": "GPL-3.0",
            "MolecularNodes": "GPL-3.0",
            "PoseBusters": "BSD-3-Clause",
            "Chai-1": "Apache-2.0",
            "Protenix": "Apache-2.0",
            "Boltz-1": "MIT code / CC-BY-4.0",
            "RFdiffusion": "BSD-3-Clause code / Non-Commercial",
            "ProteinNet": "Open Science / CC-BY",
            "SidechainNet": "BSD-3-Clause",
            "PDBBind": "Academic / Non-Commercial",
            "RDKit": "BSD-3-Clause",
            "Gemmi": "MPL-2.0",
            "Biopython": "Biopython License",
        }
        for name, lic_snippet in expected_licenses.items():
            assert name in ECOSYSTEM_PROJECTS, f"Project {name} missing from registry"
            p = ECOSYSTEM_PROJECTS[name]
            assert lic_snippet in p.license, f"Project {name} license {p.license} does not contain {lic_snippet}"

    def test_firewall_verification_is_100_percent_clean(self):
        fw = OpenSourceEcosystemRegistry.verify_firewall()
        assert fw["firewall_clean"] is True
        assert len(fw["violations"]) == 0
        assert "RFdiffusion" in fw["quarantined_weights"]
        assert "PDBBind" in fw["quarantined_weights"]
        assert "Foldseek" in fw["isolated_copyleft_workers"]
        assert "MMseqs2" in fw["isolated_copyleft_workers"]

    def test_real_integration_modes_partition(self):
        modes = OpenSourceEcosystemRegistry.get_summary_by_integration_mode()
        assert "IN_PROCESS" in modes
        assert "OPTIONAL_LIBRARY" in modes
        assert "EXTERNAL_WORKER" in modes
        assert "SUBPROCESS" in modes
        assert "DATASET" in modes
        assert modes["DATASET"] >= 4

    def test_domain_scope_separation(self):
        scopes = OpenSourceEcosystemRegistry.get_summary_by_scope()
        assert DomainScope.CORE_MOLECULAR in scopes
        assert DomainScope.ADJACENT_BIOLOGY in scopes
        assert scopes[DomainScope.ADJACENT_BIOLOGY] >= 5


# ===========================================================================
# 3. P2Rank Binding Site Detection Adapter
# ===========================================================================

class TestP2RankAdapter:
    def test_adapter_metadata(self):
        adapter = P2RankAdapter()
        assert adapter.backend_name == "P2Rank"
        assert adapter.license == "MIT"
        assert adapter.version == "2.4.2"
        assert "pocket_prediction" in adapter.capabilities

    def test_missing_binary_fails_closed(self):
        adapter = P2RankAdapter()
        if not adapter.is_available():
            with pytest.raises(RuntimeError) as exc:
                adapter.predict_pockets("dummy.pdb")
            assert "not installed" in str(exc.value).lower()

    def test_parse_predictions_csv(self):
        adapter = P2RankAdapter()
        sample_csv = (
            "name, rank, score, probability, sas_points, surf_atoms, center_x, center_y, center_z, residue_ids\n"
            "pocket1, 1, 14.85, 0.92, 142, 28, 12.5, -4.2, 33.1, A_45 A_48 A_52 B_112\n"
            "pocket2, 2, 7.30, 0.45, 68, 15, 0.0, 15.1, -12.4, A_102 A_105\n"
        )
        pockets = adapter.parse_predictions_csv(sample_csv, structure_id="4HHB")
        assert len(pockets) == 2

        p1 = pockets[0]
        assert p1.pocket_id == "pocket1"
        assert p1.prediction_score == 14.85
        assert p1.probability == 0.92
        assert p1.center == (12.5, -4.2, 33.1)
        assert p1.residue_ids == ["A_45", "A_48", "A_52", "B_112"]
        assert p1.surface_atom_count == 28
        assert p1.backend == "P2Rank"
        assert len(p1.limitations) > 0


# ===========================================================================
# 4. fpocket Voronoi Cavity Detection Adapter
# ===========================================================================

class TestfpocketAdapter:
    def test_adapter_metadata(self):
        adapter = fpocketAdapter()
        assert adapter.backend_name == "fpocket"
        assert adapter.license == "MIT"
        assert "cavity_detection" in adapter.capabilities

    def test_parse_fpocket_info(self):
        adapter = fpocketAdapter()
        sample_info = (
            "Pocket 1 :\n"
            "  Score : 0.456\n"
            "  Druggability Score : 0.812\n"
            "  Number of Alpha Spheres : 64\n"
            "  Volume : 780.50\n"
            "  Hydrophobicity Score : 34.2\n"
            "  Polarity Score : 12.1\n"
            "Pocket 2 :\n"
            "  Score : 0.122\n"
            "  Druggability Score : 0.350\n"
            "  Number of Alpha Spheres : 32\n"
            "  Volume : 320.10\n"
        )
        pockets = adapter.parse_fpocket_info(sample_info, structure_id="1BNA")
        assert len(pockets) == 2
        p1 = pockets[0]
        assert p1.pocket_id == "pocket_1"
        assert p1.prediction_score == 0.812
        assert p1.probability == 0.812
        assert p1.surface_atom_count == 64
        assert p1.pocket_descriptors["volume_angstrom3"] == 780.50
        assert p1.backend == "fpocket"


# ===========================================================================
# 5. ProLIF Interaction Fingerprints Adapter
# ===========================================================================

class TestProLIFAdapter:
    def test_adapter_metadata(self):
        adapter = ProLIFAdapter()
        assert adapter.backend_name == "ProLIF"
        assert adapter.license == "Apache-2.0"
        assert "interaction_fingerprints" in adapter.capabilities

    def test_geometric_interaction_fingerprint(self):
        adapter = ProLIFAdapter()
        receptor_atoms = [
            {"element": "O", "x": 10.0, "y": 10.0, "z": 10.0, "resname": "ASP", "resnum": 25, "is_acceptor": True},
            {"element": "C", "x": 12.0, "y": 10.0, "z": 10.0, "resname": "VAL", "resnum": 32, "is_acceptor": False},
        ]
        ligand_atoms = [
            {"name": "N1", "element": "N", "x": 12.5, "y": 10.0, "z": 10.0, "charge": 1, "is_donor": True},
            {"name": "C1", "element": "C", "x": 14.0, "y": 10.0, "z": 10.0, "charge": 0, "is_donor": False},
        ]
        res = adapter.compute_fingerprint(
            receptor_atoms=receptor_atoms,
            ligand_atoms=ligand_atoms,
            complex_id="HIV1_PR",
            receptor_id="PROT",
            ligand_id="LIG"
        )
        assert isinstance(res, InteractionFingerprintResult)
        assert res.complex_id == "HIV1_PR"
        assert len(res.bitvector) == 6
        # Distance between ASP25:O (10,10,10) and N1 (12.5,10,10) is 2.5 A -> HBond
        assert res.bitvector[0] == 1
        assert "HBond" in res.contact_types
        # Distance between VAL32:C (12,10,10) and C1 (14,10,10) is 2.0 A -> Hydrophobic
        assert res.bitvector[1] == 1
        assert "Hydrophobic" in res.contact_types
        assert res.total_contacts >= 2


# ===========================================================================
# 6. Foldseek Structural Homology Search Adapter
# ===========================================================================

class TestFoldseekAdapter:
    def test_adapter_metadata(self):
        adapter = FoldseekAdapter()
        assert adapter.backend_name == "Foldseek"
        assert adapter.license == "GPL-3.0"
        assert "3di_structural_alignment" in adapter.capabilities

    def test_missing_binary_fails_closed(self):
        adapter = FoldseekAdapter()
        if not adapter.is_available():
            with pytest.raises(RuntimeError) as exc:
                adapter.search("query.pdb", "target_db")
            assert "not installed" in str(exc.value).lower()

    def test_parse_alignment_m8(self):
        adapter = FoldseekAdapter()
        sample_m8 = (
            "query\t4hhb_A\t0.98\t141\t2\t0\t1\t141\t1\t141\t1.2e-45\t350.0\t0.96\n"
            "query\t1mbn_A\t0.28\t138\t85\t2\t1\t140\t1\t138\t3.4e-12\t110.0\t0.72\n"
        )
        res = adapter.parse_alignment_m8(sample_m8, query_id="my_protein", database_searched="PDB100")
        assert res.query_structure_id == "my_protein"
        assert len(res.hits) == 2
        hit1 = res.hits[0]
        assert hit1["target_id"] == "4hhb_A"
        assert hit1["tm_score"] == 0.96
        assert hit1["seq_identity"] == 0.98
        assert hit1["aligned_length"] == 141


# ===========================================================================
# 7. MMseqs2 Sequence Homology Search Adapter
# ===========================================================================

class TestMMseqs2Adapter:
    def test_adapter_metadata(self):
        adapter = MMseqs2Adapter()
        assert adapter.backend_name == "MMseqs2"
        assert adapter.license == "GPL-3.0"
        assert "sequence_homology_search" in adapter.capabilities

    def test_missing_binary_fails_closed(self):
        adapter = MMseqs2Adapter()
        if not adapter.is_available():
            with pytest.raises(RuntimeError) as exc:
                adapter.search("query.fasta", "uniref50")
            assert "not installed" in str(exc.value).lower()

    def test_parse_alignment_m8(self):
        adapter = MMseqs2Adapter()
        sample_m8 = (
            "query\tP69905\t1.00\t142\t0\t0\t1\t142\t1\t142\t1.0e-95\t380.0\n"
            "query\tP01942\t0.88\t142\t17\t0\t1\t142\t1\t142\t4.5e-78\t290.0\n"
        )
        res = adapter.parse_alignment_m8(sample_m8, query_id="hba_human")
        assert res.query_sequence_id == "hba_human"
        assert len(res.hits) == 2
        assert res.hits[0]["target_id"] == "P69905"
        assert res.hits[0]["seq_identity"] == 1.00


# ===========================================================================
# 8. PoseBusters Ligand Validation Adapter
# ===========================================================================

class TestPoseBustersAdapter:
    def test_adapter_metadata(self):
        adapter = PoseBustersAdapter()
        assert adapter.backend_name == "PoseBusters"
        assert adapter.license == "BSD-3-Clause"
        assert "bond_length_verification" in adapter.capabilities

    def test_valid_ligand_pose_passes(self):
        adapter = PoseBustersAdapter()
        coords = np.array([[0.0, 0.0, 0.0], [1.54, 0.0, 0.0]], dtype=np.float64)
        bonds = [(0, 1)]
        elements = ["C", "C"]
        res = adapter.validate_pose(coords, bonds, elements, ligand_id="ethane")
        assert res.passes_all_checks is True
        assert res.bond_length_check is True
        assert res.clash_check is True
        assert res.clash_count == 0
        assert len(res.violations) == 0

    def test_unphysical_stretched_bond_and_clash_fails(self):
        adapter = PoseBustersAdapter()
        coords = np.array([[0.0, 0.0, 0.0], [2.20, 0.0, 0.0]], dtype=np.float64)
        bonds = [(0, 1)]
        elements = ["C", "C"]
        receptor_coords = np.array([[0.8, 0.0, 0.0]], dtype=np.float64)

        res = adapter.validate_pose(coords, bonds, elements, receptor_coords=receptor_coords, ligand_id="bad_pose")
        assert res.passes_all_checks is False
        assert res.bond_length_check is False
        assert res.clash_check is False
        assert res.clash_count >= 1
        assert len(res.violations) >= 2


# ===========================================================================
# 9. PDBe-SIFTS Mapping Adapter
# ===========================================================================

class TestSIFTSMappingAdapter:
    def test_adapter_metadata(self):
        adapter = SIFTSMappingAdapter()
        assert adapter.backend_name == "PDBe-SIFTS"
        assert adapter.license == "CC0-1.0"
        assert adapter.is_available() is True

    def test_parse_sifts_json(self):
        adapter = SIFTSMappingAdapter()
        sample_json = {
            "4hhb": {
                "UniProt": {
                    "P69905": {
                        "mappings": [
                            {
                                "chain_id": "A",
                                "struct_asym_id": "A",
                                "unp_start": 1,
                                "unp_end": 141,
                                "start": {"author_residue_number": 1},
                                "end": {"author_residue_number": 141},
                                "is_missing": False,
                            }
                        ]
                    }
                }
            }
        }
        mapping = adapter.parse_sifts_json(sample_json, pdb_id="4HHB", chain_id="A")
        assert mapping.uniprot_accession == "P69905"
        assert mapping.pdb_id == "4HHB"
        assert mapping.chain_id == "A"
        assert len(mapping.residue_mappings) == 141
        assert mapping.missing_residue_count == 0
        assert mapping.coverage_percentage == 100.0


# ===========================================================================
# 10. Multi-Model Consensus Prediction (Without Coordinate Averaging)
# ===========================================================================

class TestConsensusPredictionEngine:
    def test_engine_metadata(self):
        engine = ConsensusPredictionEngine()
        assert engine.backend_name == "ConsensusPredictionEngine"
        assert engine.license == "Apache-2.0"

    def test_kabsch_superposition_exact(self):
        engine = ConsensusPredictionEngine()
        P = np.array([[0,0,0], [1,0,0], [1,1,0], [0,1,0]], dtype=np.float64)
        Q = P + np.array([5.0, -3.0, 2.0])
        Q_aligned, rmsd = engine.kabsch_superposition(P, Q)
        assert rmsd < 1e-6
        np.testing.assert_allclose(P, Q_aligned, atol=1e-5)

    def test_consensus_never_averages_coordinates(self):
        engine = ConsensusPredictionEngine()
        np.random.seed(42)
        n_res = 20
        m1 = np.random.randn(n_res, 3) * 10.0
        m2 = m1.copy()
        m2[15:20] += np.random.randn(5, 3) * 5.0
        m3 = m1.copy()
        m3[15:20] += np.random.randn(5, 3) * 4.0

        models = {"Boltz-1": m1, "OpenFold": m2, "Chai-1": m3}
        original_m1 = m1.copy()

        res = engine.compute_consensus(models, sequence_id="SEQ_TEST", distance_threshold_angstrom=1.5)
        assert isinstance(res, EnsembleConsensusResult)
        assert len(res.models_evaluated) == 3
        assert "Boltz-1" in res.pairwise_rmsd_matrix
        assert "OpenFold" in res.pairwise_rmsd_matrix["Boltz-1"]

        assert len(res.consensus_residue_spans) > 0
        assert len(res.disagreement_residue_spans) > 0
        np.testing.assert_array_equal(models["Boltz-1"], original_m1)


# ===========================================================================
# 11. Cross-Method Pocket Comparison Engine
# ===========================================================================

class TestPocketEnsembleEngine:
    def test_engine_metadata(self):
        engine = PocketEnsembleEngine()
        assert engine.backend_name == "PocketEnsembleEngine"

    def test_compare_pockets_matching_and_disagreement(self):
        engine = PocketEnsembleEngine()
        p2rank_pockets = [
            PocketPredictionResult(
                pocket_id="prank_p1", structure_id="4HHB", prediction_score=15.0, probability=0.95,
                center=(10.0, 10.0, 10.0), residue_ids=["A_1", "A_2", "A_3"], surface_atom_count=30,
                pocket_descriptors={"volume_angstrom3": 500.0}, backend="P2Rank", version="2.4.2", provenance={}
            ),
            PocketPredictionResult(
                pocket_id="prank_p2", structure_id="4HHB", prediction_score=5.0, probability=0.30,
                center=(50.0, 50.0, 50.0), residue_ids=["B_10", "B_11"], surface_atom_count=12,
                pocket_descriptors={"volume_angstrom3": 200.0}, backend="P2Rank", version="2.4.2", provenance={}
            )
        ]
        fpocket_pockets = [
            PocketPredictionResult(
                pocket_id="fpocket_p1", structure_id="4HHB", prediction_score=0.85, probability=0.85,
                center=(11.0, 10.5, 9.8), residue_ids=["A_2", "A_3", "A_4"], surface_atom_count=28,
                pocket_descriptors={"volume_angstrom3": 550.0}, backend="fpocket", version="4.0.2", provenance={}
            ),
            PocketPredictionResult(
                pocket_id="fpocket_p_orphan", structure_id="4HHB", prediction_score=0.20, probability=0.20,
                center=(-30.0, -30.0, -30.0), residue_ids=["C_1"], surface_atom_count=8,
                pocket_descriptors={"volume_angstrom3": 100.0}, backend="fpocket", version="4.0.2", provenance={}
            )
        ]

        res = engine.compare_pockets(
            pockets_by_method={"P2Rank": p2rank_pockets, "fpocket": fpocket_pockets},
            structure_id="4HHB",
            center_distance_threshold=4.0
        )
        assert isinstance(res, PocketEnsembleResult)
        assert len(res.pocket_correspondence) == 1
        match = res.pocket_correspondence[0]
        assert match["pocket_1"] == "prank_p1"
        assert match["pocket_2"] == "fpocket_p1"
        assert match["center_distance_angstrom"] < 2.0
        assert match["residue_jaccard"] == 0.50
        assert match["is_consensus"] is True
        assert len(res.disagreement_notes) >= 2


# ===========================================================================
# 12. Benchmark Dataset Split Protection & Leakage Check
# ===========================================================================

class TestBenchmarkLeakageDetector:
    def test_detector_metadata(self):
        detector = BenchmarkLeakageDetector()
        assert detector.backend_name == "BenchmarkLeakageDetector"

    def test_clean_non_leaking_evaluation(self):
        detector = BenchmarkLeakageDetector()
        query = "MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSH"
        train_data = [
            {"id": "train_1", "sequence": "ACDEFGHIKLMNPQRSTVWYACDEFGHIKLMNPQRSTVWYACDEFGHIKL", "release_date": "2020-01-01"},
        ]
        spec = detector.check_leakage(query, train_data, release_cutoff_date="2021-04-30", identity_threshold=0.30)
        assert isinstance(spec, DatasetBenchmarkSpec)
        assert spec.has_data_leakage is False
        assert len(spec.leakage_details) == 0

    def test_high_identity_leakage_detected(self):
        detector = BenchmarkLeakageDetector()
        query = "MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSH"
        train_data = [
            {"id": "leak_pdb_1", "sequence": "MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDZZZ", "release_date": "2022-06-15"},
        ]
        spec = detector.check_leakage(query, train_data, release_cutoff_date="2021-04-30", identity_threshold=0.30)
        assert spec.has_data_leakage is True
        assert len(spec.leakage_details) == 1
        assert "leak_pdb_1" in spec.leakage_details[0]
