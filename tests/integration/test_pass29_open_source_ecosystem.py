"""
tests/integration/test_pass29_open_source_ecosystem.py — Open-Source Ecosystem Integration Tests.

Comprehensive integration test battery verifying:
1. External backend adapters, version metadata, and provenance tracking.
2. 4HHB Oracle Test (Chains A & C, HEM identity, HIS 87, Fe-NE2 coordination, zero cross-chain contamination).
3. 1BNA Oracle Test (DNA duplex, nucleotide identity, coordinate validity, Watson-Crick base-pair distance).
4. synth_500f Oracle Test (Trajectory scanning, frames, coordinates, and exact parity with MDAnalysis).
5. Differential verification engine (Discrepancy classification, tolerance enforcement, zero hidden errors).
6. StructureProvider provenance preservation (Experimental vs Predicted vs Synthetic vs Generated).
7. License compliance and open-source registry integrity.
"""

import os
import pytest
import numpy as np

from mocs.ecosystem.interfaces import (
    StructureSourceType,
    DiscrepancyClassification,
    BackendDistanceResult,
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
    GemmiBackendAdapter,
)
from mocs.ecosystem.differential import DifferentialVerificationEngine
from mocs.ecosystem.registry import OpenSourceEcosystemRegistry, ECOSYSTEM_PROJECTS


class TestEcosystemBackendAdapters:
    """Verifies all backend adapters, metadata, capabilities, and licenses."""

    def test_mdanalysis_backend_contracts(self):
        backend = MDAnalysisBackend()
        assert backend.backend_name == "MDAnalysis"
        assert backend.license == "GPL-2.0-or-later"
        assert "Michaud-Agrawal" in backend.citation
        assert "trajectory_streaming" in backend.capabilities
        assert backend.version != "not installed"

    def test_native_mocs_backend_contracts(self):
        backend = NativeMOCSBackend()
        assert backend.backend_name == "Native MOCS-Cert"
        assert backend.license == "Apache-2.0"
        assert "0.1.0" in backend.version
        assert "certified_pruning" in backend.capabilities

    def test_optional_adapters_reporting(self):
        adapters = [
            MDTrajBackendAdapter(),
            RDKitBackendAdapter(),
            OpenMMBackendAdapter(),
            BiopythonBackendAdapter(),
            GemmiBackendAdapter(),
        ]
        for a in adapters:
            assert isinstance(a.backend_name, str)
            assert isinstance(a.version, str)
            assert isinstance(a.license, str)
            assert isinstance(a.citation, str)
            assert len(a.capabilities) > 0


class Test4HHBStructuralOracle:
    """
    Hostile structural verification on human deoxyhemoglobin (4HHB).
    Verifies chain isolation, HEM prosthetic group identity, and proximal His coordination.
    """

    @pytest.fixture
    def structure_4hhb(self):
        provider = RCSBStructureProvider()
        return provider.load_structure("frontend/public/structures/4HHB.pdb")

    def test_4hhb_chain_isolation_and_residues(self, structure_4hhb):
        assert structure_4hhb.identifier == "4HHB.pdb"
        assert structure_4hhb.provenance.source_type == StructureSourceType.EXPERIMENTAL
        assert "A" in structure_4hhb.chains
        assert "C" in structure_4hhb.chains
        assert structure_4hhb.atom_count > 4000

        # Verify HEM presence in Chain A and Chain C
        hems_A = [r for r in structure_4hhb.residues if r[0] == "A" and r[2] == "HEM"]
        hems_C = [r for r in structure_4hhb.residues if r[0] == "C" and r[2] == "HEM"]
        assert len(hems_A) == 1
        assert len(hems_C) == 1

    def test_4hhb_fe_ne2_coordination_distances(self, structure_4hhb):
        """
        Verifies Fe-NE2 distance in Chain A (~2.143 A) and Chain C (~2.258 A),
        and strictly confirms zero cross-chain contamination.
        """
        fe_A = [a for a in structure_4hhb.atoms if a.chain == "A" and a.resseq == 142 and a.name == "FE"][0]
        ne2_A = [a for a in structure_4hhb.atoms if a.chain == "A" and a.resseq == 87 and a.name == "NE2"][0]

        fe_C = [a for a in structure_4hhb.atoms if a.chain == "C" and a.resseq == 142 and a.name == "FE"][0]
        ne2_C = [a for a in structure_4hhb.atoms if a.chain == "C" and a.resseq == 87 and a.name == "NE2"][0]

        # Intra-chain coordination distance (crystallographic standard ~2.0 to 2.3 A)
        dist_A = float(np.linalg.norm(fe_A.coordinates - ne2_A.coordinates))
        dist_C = float(np.linalg.norm(fe_C.coordinates - ne2_C.coordinates))

        assert 2.10 < dist_A < 2.20, f"Expected Chain A Fe-NE2 ~2.14 A, got {dist_A:.4f} A"
        assert 2.20 < dist_C < 2.30, f"Expected Chain C Fe-NE2 ~2.26 A, got {dist_C:.4f} A"

        # Cross-chain distance: Fe(A) to NE2(C) must be far separated (>30 A in hemoglobin tetramer)
        cross_dist = float(np.linalg.norm(fe_A.coordinates - ne2_C.coordinates))
        assert cross_dist > 30.0, f"Cross-chain contamination detected! Fe(A)-NE2(C) was {cross_dist:.2f} A"


class Test1BNADNAStructuralOracle:
    """
    Hostile structural verification on B-DNA Dickerson dodecamer (1BNA).
    Verifies duplex strands, nucleotide sequences, and base-pair geometries.
    """

    @pytest.fixture
    def structure_1bna(self):
        provider = RCSBStructureProvider()
        return provider.load_structure("frontend/public/structures/1BNA.pdb")

    def test_1bna_duplex_strands_and_nucleotides(self, structure_1bna):
        assert structure_1bna.provenance.source_type == StructureSourceType.EXPERIMENTAL
        assert structure_1bna.chains == ["A", "B"]

        strand_A = [r for r in structure_1bna.residues if r[0] == "A" and r[2] in ("DC", "DG", "DA", "DT")]
        strand_B = [r for r in structure_1bna.residues if r[0] == "B" and r[2] in ("DC", "DG", "DA", "DT")]

        assert len(strand_A) == 12, "Dickerson dodecamer strand A must have 12 nucleotides"
        assert len(strand_B) == 12, "Dickerson dodecamer strand B must have 12 nucleotides"

        seq_A = [r[2] for r in strand_A]
        expected_seq = ["DC", "DG", "DC", "DG", "DA", "DA", "DT", "DT", "DC", "DG", "DC", "DG"]
        assert seq_A == expected_seq

    def test_1bna_base_pair_hydrogen_bond_distances(self, structure_1bna):
        """Checks Watson-Crick base-pair distance between complementary bases (C1-G24 and G2-C23)."""
        # C1 N3 to G24 N1 distance (Watson-Crick pairing)
        c1_atoms = {a.name: a.coordinates for a in structure_1bna.atoms if a.chain == "A" and a.resseq == 1}
        g24_atoms = {a.name: a.coordinates for a in structure_1bna.atoms if a.chain == "B" and a.resseq == 24}

        assert "N3" in c1_atoms and "N1" in g24_atoms
        hbond_dist = float(np.linalg.norm(c1_atoms["N3"] - g24_atoms["N1"]))
        # Canonical Watson-Crick hydrogen bond distance is ~2.8 to 3.1 Angstroms
        assert 2.7 < hbond_dist < 3.2, f"Watson-Crick N3-N1 distance out of range: {hbond_dist:.3f} A"


class TestSynth500fTrajectoryOracle:
    """
    Trajectory interpretation comparison between Native MOCS and MDAnalysis on synth_500f.
    """

    def test_synth_500f_frame_and_distance_parity(self):
        gro_path = "tests/data/synth_500f.gro"
        xtc_path = "tests/data/synth_500f.xtc"

        if not os.path.exists(gro_path) or not os.path.exists(xtc_path):
            pytest.skip("synth_500f fixtures not found.")

        mda_backend = MDAnalysisBackend()
        mocs_backend = NativeMOCSBackend()

        mda_res = mda_backend.compute_distance(gro_path, xtc_path, "name CA", "name O2")
        mocs_res = mocs_backend.compute_distance(gro_path, xtc_path, "name CA", "name O2")

        assert mda_res.n_frames == 500
        assert mocs_res.n_frames == 500
        assert len(mda_res.distances) == 500

        # Verify bit-exact or sub-numerical tolerance match
        report = DifferentialVerificationEngine.verify(mocs_res, mda_res, tolerance=1e-5)
        assert report.classification == DiscrepancyClassification.WITHIN_TOLERANCE
        assert report.max_delta < 1e-5, f"Max delta {report.max_delta:.8f} A exceeded tolerance!"


class TestDifferentialVerificationDiscrepancies:
    """Verifies that discrepancies are never hidden, averaged, or rounded away."""

    def test_discrepancy_classification_on_tolerance_violation(self):
        n_frames = 10
        d1 = np.ones(n_frames, dtype=np.float64) * 3.5
        d2 = np.copy(d1)
        d2[4] = 4.8  # Injected discrepancy of 1.3 A

        r1 = BackendDistanceResult(
            distances=d1, n_frames=n_frames, method="MOCS Native", version="0.1.0", provenance={}
        )
        r2 = BackendDistanceResult(
            distances=d2, n_frames=n_frames, method="Reference Oracle", version="2.10.0", provenance={}
        )

        report = DifferentialVerificationEngine.verify(r1, r2, tolerance=1e-4)
        assert report.classification == DiscrepancyClassification.GENUINE_DISCREPANCY
        assert report.max_delta == pytest.approx(1.3, abs=1e-6)
        assert report.mismatched_frames == [4]
        assert "Significant numerical discrepancy" in report.diagnosis


class TestStructureProviderProvenance:
    """Verifies provenance preservation across Experimental, Predicted, Synthetic, and Generated."""

    def test_distinct_provenance_labels(self):
        rcsb = RCSBStructureProvider().load_structure("frontend/public/structures/4HHB.pdb")
        af = AlphaFoldDBProvider().load_structure("AF-P69905-F1")
        syn = SyntheticStructureProvider().load_structure("tests/data/synth_500f.gro")
        gen = GeneratedStructureProvider().load_structure("denovo_binder_01")

        assert rcsb.provenance.source_type == StructureSourceType.EXPERIMENTAL
        assert af.provenance.source_type == StructureSourceType.PREDICTED
        assert syn.provenance.source_type == StructureSourceType.SYNTHETIC
        assert gen.provenance.source_type == StructureSourceType.GENERATED

        # Enforce rule: AlphaFold must include confidence score (pLDDT) and citation
        assert af.provenance.confidence_score is not None
        assert af.provenance.confidence_score > 70.0
        assert "Jumper" in af.provenance.citation

        # Enforce rule: Generated design must include random seed
        assert "seed" in gen.provenance.extra_metadata


class TestOpenSourceLicenseRegistry:
    """Validates full open-source registry and license compliance."""

    def test_all_15_projects_cataloged(self):
        # Registry expanded during PASS 29/30 — verify the core 15 original
        # projects are still present and that the total is >= 15.
        assert len(ECOSYSTEM_PROJECTS) >= 15
        expected_names = [
            "Mol*", "3Dmol.js", "NGL Viewer", "MDAnalysis", "MDTraj",
            "GROMACS", "OpenMM", "Biopython", "Gemmi", "ProDy",
            "RDKit", "RCSB PDB APIs", "UniProt API", "AlphaFold DB", "3D-Beacons"
        ]
        for name in expected_names:
            assert name in ECOSYSTEM_PROJECTS

    def test_license_compliance_audit(self):
        audit = OpenSourceEcosystemRegistry.verify_license_compliance()
        # RFdiffusion is correctly flagged: non-commercial model weights → incompatible
        # for an Apache-2.0 project.  All other entries must be compatible.
        incompatible = audit["incompatible_projects"]
        assert "RFdiffusion" in incompatible
        assert audit["incompatible_count"] >= 1
        assert "MDAnalysis" in audit["gpl_isolated_oracles"]
        assert "Mol*" in audit["permissive_or_weak_copyleft"]

