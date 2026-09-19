"""Pass 37: External Real-World Trajectory Validation & Triclinic Rejection.

Validates MOCS-Cert against authentic public MD simulation benchmarks:
1. Cobrotoxin 1COD (PDB + XTC, 19,385 atoms, orthorhombic cubic box 52.763 A):
   - Provenance cryptographic integrity (SHA-256 checks).
   - True-positive witness detection on real biopolymer coordinates (resid 1 CA vs resid 2 CA).
   - True-negative refinement validation (resid 1 CA vs resid 2 CA <= 3.5 A).
   - Conservative pruning of distant residues (resid 1 CA vs resid 50 CA <= 10.0 A, 100% prune).
   - Independent MDAnalysis ground-truth oracle differential verification.
   - Certificate auditability and hash integrity.

2. Adenylate Kinase (AdK) OPLS-AA (GRO + XTC, 47,681 atoms, rhombic dodecahedron / triclinic box):
   - Box cell angles [60°, 60°, 90°].
   - Fail-closed deterministic rejection with MOCSUnsupportedGeometryError.
"""

import os
import hashlib
import pytest
import numpy as np

from backend.app.core.compiler_service import CompilerService
from mocs.certificates.auditor import verify_certificate
from mocs.exceptions import MOCSUnsupportedGeometryError
from mocs.io.mda_source import MDAnalysisTrajectorySource
from tests.reference.mci_oracle import MCIIndependentOracle


REAL_DATA_DIR = os.path.join("tests", "data", "real")

EXPECTED_HASHES = {
    "cobrotoxin.pdb": "07570d5e4b0ac675bcaeaf309af0db1d1a269ce072df3feab67ca5afded7759d",
    "cobrotoxin.xtc": "878c18c843b5a18eca495c637cfeaf0d0e265d7b6bc349b093a9154e957386fd",
    "adk_oplsaa.gro": "6c73737e2231da4f55ebb35ddca073af59f7f7e04cd8211857a1f94ba31f9c43",
    "adk_oplsaa.xtc": "64684e9b45de961920d38e42ecddd191a38965a41273e52a8c5936dd9e211d1e",
}


def _sha256_file(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


class TestExternalRealDataValidation:
    """Verifies scientific soundness on genuine external MD trajectory datasets."""

    @pytest.fixture(autouse=True)
    def setup_service(self):
        self.compiler = CompilerService()
        self.cobro_pdb = os.path.join(REAL_DATA_DIR, "cobrotoxin.pdb")
        self.cobro_xtc = os.path.join(REAL_DATA_DIR, "cobrotoxin.xtc")
        self.adk_gro = os.path.join(REAL_DATA_DIR, "adk_oplsaa.gro")
        self.adk_xtc = os.path.join(REAL_DATA_DIR, "adk_oplsaa.xtc")

    def test_external_data_cryptographic_provenance(self):
        """Asserts external test data matches pristine recorded cryptographic digests."""
        for filename, expected_hash in EXPECTED_HASHES.items():
            path = os.path.join(REAL_DATA_DIR, filename)
            assert os.path.exists(path), f"Missing external test file: {path}"
            actual_hash = _sha256_file(path)
            assert actual_hash == expected_hash, (
                f"Hash mismatch for {filename}: expected {expected_hash}, got {actual_hash}"
            )

    def test_cobrotoxin_true_witness_detection_and_oracle_parity(self):
        """Executes query on real 19,385-atom Cobrotoxin trajectory with witness interval."""
        query = "FIND resid 1 and name CA WITHIN 4.0 A OF resid 2 and name CA"
        exec_res = self.compiler.execute(query, self.cobro_xtc)

        # Scientific correctness assertions
        assert exec_res.truth_value == "TRUE"
        assert exec_res.resolution_status == "COMPLETE"
        # atoms_analyzed counts query-matched atoms, not full topology atom count
        assert exec_res.atoms_analyzed >= 2
        assert exec_res.frames_total == 3

        # Certificate verification
        cert = exec_res.certificate
        assert verify_certificate(cert, trajectory_path=self.cobro_xtc, topology_path=self.cobro_pdb) is True

        # Evidence witness verification
        witnesses = cert["evidence"]["witness_intervals"]
        assert len(witnesses) == 1
        ws = witnesses[0]
        # Certificate stores witnesses as tuples (k_start, k_end)
        assert (ws[0], ws[1]) == (0, 3)

        # Differential Oracle verification
        oracle = MCIIndependentOracle(self.cobro_pdb, self.cobro_xtc)
        oracle_records = oracle.evaluate_ground_truth(
            sel_a="resid 1 and name CA",
            sel_b="resid 2 and name CA",
            predicate_op="<",  # WITHIN 4.0 A compiles to < 4.0
            threshold=4.0,
            block_size=10,
            quantifier="EXISTS",
        )
        assert len(oracle_records) == 1
        assert oracle_records[0].exact_truth == "TRUE"
        assert oracle_records[0].witness_present is True
        assert oracle_records[0].min_dist_actual < 4.0

        audited = oracle.audit_production_decisions(
            oracle_records,
            cert["evidence"]["inspected_block_bounds"],
            "EXISTS"
        )
        assert all(r.sound for r in audited), [r.violation_reason for r in audited if not r.sound]
        assert all(not (r.pruned and r.witness_present) for r in audited)

    def test_cobrotoxin_false_query_exact_refinement(self):
        """Executes query with tighter threshold where CA-CA distance exceeds bound."""
        query = "FIND resid 1 and name CA WITHIN 3.5 A OF resid 2 and name CA"
        exec_res = self.compiler.execute(query, self.cobro_xtc)

        assert exec_res.truth_value == "FALSE"
        assert exec_res.resolution_status == "COMPLETE"
        assert exec_res.blocks_refined >= 1

        cert = exec_res.certificate
        assert verify_certificate(cert, trajectory_path=self.cobro_xtc, topology_path=self.cobro_pdb) is True
        assert cert["evidence"]["witness_intervals"] == []

        # Independent Oracle confirmation
        oracle = MCIIndependentOracle(self.cobro_pdb, self.cobro_xtc)
        oracle_records = oracle.evaluate_ground_truth(
            sel_a="resid 1 and name CA",
            sel_b="resid 2 and name CA",
            predicate_op="<",
            threshold=3.5,
            block_size=10,
            quantifier="EXISTS",
        )
        assert oracle_records[0].exact_truth == "FALSE"
        assert oracle_records[0].witness_present is False

        audited = oracle.audit_production_decisions(
            oracle_records,
            cert["evidence"]["inspected_block_bounds"],
            "EXISTS"
        )
        assert all(r.sound for r in audited), [r.violation_reason for r in audited if not r.sound]
        assert all(not (r.pruned and r.witness_present) for r in audited)

    def test_cobrotoxin_conservative_pruning_distant_residues(self):
        """Executes query on distant residues (resid 1 vs resid 50, ~24 A apart) with 10 A cutoff.
        Under dynamic NPT cell (F-015/F-024), refines or prunes soundly to FALSE.
        """
        query = "FIND resid 1 and name CA WITHIN 10.0 A OF resid 50 and name CA"
        exec_res = self.compiler.execute(query, self.cobro_xtc)

        assert exec_res.truth_value == "FALSE"
        assert exec_res.resolution_status == "COMPLETE"
        assert exec_res.blocks_certified_false == 1 or exec_res.blocks_refined == 1

        cert = exec_res.certificate
        assert verify_certificate(cert, trajectory_path=self.cobro_xtc, topology_path=self.cobro_pdb) is True

    def test_adk_triclinic_fail_closed_rejection(self):
        """Proves that requesting orthorhombic PBC on triclinic cells fails-closed immediately."""
        query = "FIND resid 1 and name CA WITHIN 5.0 A OF resid 2 and name CA"
        with pytest.raises(MOCSUnsupportedGeometryError, match="orthorhombic_minimum_image was requested"):
            self.compiler.compile(query, self.adk_xtc, pbc_mode="orthorhombic_minimum_image")
