"""Pass 37: Provenance DAG & Merkle Integrity Adversarial Test Suite.

Audits the Provenance Chain:
RAW INPUT
    ↓
trajectory hash
    ↓
topology hash
    ↓
MCI records
    ↓
Merkle leaves
    ↓
Merkle root
    ↓
execution certificate

Verifies that modifying ANY upstream input makes downstream certificates unverifiable.
"""

import os
import copy
import shutil
import pytest
import numpy as np

from backend.app.core.compiler_service import CompilerService
from mocs.certificates.auditor import verify_certificate
from mocs.exceptions import MOCSDataIntegrityError, MOCSVerificationError


class TestProvenanceMerkleTamper:
    """Rigorous adversarial tests of the MOCS-Cert provenance DAG."""

    @pytest.fixture
    def baseline_execution(self, tmp_path):
        """Executes a real query on synth_50f.xtc to produce a verified certificate."""
        cs = CompilerService()
        query = "FIND resname ALA and name CA WITHIN 12.0 A OF resname LIG and name O2"
        res = cs.execute(query, "tests/data/synth_50f.xtc")

        # Copy data files to isolated temp directory for mutation tests
        traj_copy = str(tmp_path / "traj.xtc")
        topo_copy = str(tmp_path / "topo.gro")
        shutil.copyfile("tests/data/synth_50f.xtc", traj_copy)
        shutil.copyfile("tests/data/synth_50f.gro", topo_copy)

        cert = copy.deepcopy(res.certificate)
        # Point cert to copied files
        cert["source"]["trajectory_path"] = traj_copy
        cert["source"]["topology_path"] = topo_copy

        # Verify baseline passes
        assert verify_certificate(cert, trajectory_path=traj_copy, topology_path=topo_copy) is True

        return {
            "cert": cert,
            "traj_path": traj_copy,
            "topo_path": topo_copy
        }

    def test_trajectory_byte_mutation_invalidates_provenance(self, baseline_execution):
        """Modifying 1 byte in trajectory file invalidates certificate verification."""
        traj_path = baseline_execution["traj_path"]
        cert = baseline_execution["cert"]

        with open(traj_path, "r+b") as f:
            f.seek(100)
            b = f.read(1)
            f.seek(100)
            f.write(bytes([b[0] ^ 0xFF]))

        with pytest.raises(MOCSDataIntegrityError) as exc:
            verify_certificate(cert, trajectory_path=traj_path, topology_path=baseline_execution["topo_path"])
        assert "Trajectory SHA-256 mismatch" in str(exc.value)

    def test_topology_byte_mutation_invalidates_provenance(self, baseline_execution):
        """Modifying 1 byte in topology file invalidates certificate verification."""
        topo_path = baseline_execution["topo_path"]
        cert = baseline_execution["cert"]

        with open(topo_path, "r+b") as f:
            f.seek(20)
            b = f.read(1)
            f.seek(20)
            f.write(bytes([b[0] ^ 0xFF]))

        with pytest.raises(MOCSDataIntegrityError) as exc:
            verify_certificate(cert, trajectory_path=baseline_execution["traj_path"], topology_path=topo_path)
        assert "Topology SHA-256 mismatch" in str(exc.value)

    def test_forged_dummy_hash_fails_closed(self, baseline_execution):
        """Forged zeroed or 0xff trajectory hashes are rejected by auditor."""
        cert = copy.deepcopy(baseline_execution["cert"])
        cert["source"]["trajectory_sha256"] = "0" * 64

        with pytest.raises(MOCSVerificationError) as exc:
            verify_certificate(cert)
        assert "Rejected dummy/forged trajectory SHA-256" in str(exc.value)

    def test_forged_mci_index_hash_fails_closed(self, baseline_execution):
        """Forged zeroed or 0xff MCI hashes are rejected by auditor."""
        cert = copy.deepcopy(baseline_execution["cert"])
        cert["index_commitment"]["mci_index_hash"] = "f" * 64

        with pytest.raises(MOCSVerificationError) as exc:
            verify_certificate(cert)
        assert "Rejected forged MCI index hash" in str(exc.value)

    def test_mci_manifest_commitment_mismatch(self, baseline_execution):
        """Discrepancy between certificate index hash and manifest commitment fails."""
        cert = copy.deepcopy(baseline_execution["cert"])
        cert["index_commitment"]["mci_index_hash"] = "a" * 64
        cert["index_commitment"]["manifest"] = {"mci_index_hash": "b" * 64}

        with pytest.raises(MOCSVerificationError) as exc:
            verify_certificate(cert)
        assert "MCI index commitment mismatch" in str(exc.value)
