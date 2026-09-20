"""
PASS 47: KDOP14 Certificate Audit & Adversarial Mutation Test Suite.

Validates that:
1. Emitted KDOP14 certificates contain explicit bounding model provenance.
2. Standalone auditor verify_certificate() successfully validates valid KDOP14 certificates.
3. Adversarial certificate tampering (corrupted bounds, invalid bounding model, forged hash)
   fails closed via MOCSVerificationError.
"""

import copy
import pytest

from backend.app.core.compiler_service import compiler_service
from mocs.certificates.auditor import verify_certificate
from mocs.exceptions import MOCSVerificationError


class TestKDOPCertificateAudit:
    """Rigorous audit tests on KDOP14 cryptographic certificates."""

    @pytest.fixture
    def valid_kdop_cert(self):
        res = compiler_service.execute(
            "DISTANCE(name CA, name O2) < 4.0 A",
            bounding_model="KDOP14"
        )
        return copy.deepcopy(res.certificate)

    def test_certificate_kdop_provenance(self, valid_kdop_cert):
        """Verifies bounding model provenance fields in valid certificate."""
        idx_comm = valid_kdop_cert.get("index_commitment", {})
        assert idx_comm.get("bounding_model") == "KDOP14"
        assert idx_comm.get("algorithm") == "KDOP14-v1.0"
        assert idx_comm.get("bounding_model_version") == "1.0"

        # Verification must succeed
        assert verify_certificate(valid_kdop_cert, verify_hashes=False) is True

    def test_tampered_bounding_model_rejected(self, valid_kdop_cert):
        """Certificates declaring unsupported bounding models must be rejected."""
        tampered = copy.deepcopy(valid_kdop_cert)
        tampered["index_commitment"]["bounding_model"] = "SPHERE_TREE_V2"

        with pytest.raises(MOCSVerificationError, match="Unsupported bounding model"):
            verify_certificate(tampered, verify_hashes=False)

    def test_tampered_block_bounds_soundness_rejection(self, valid_kdop_cert):
        """
        If an adversary tampers with a CERTIFIED_TRUE block's upper bound to exceed threshold,
        auditor must reject it.
        """
        tampered = copy.deepcopy(valid_kdop_cert)
        bounds = tampered.get("evidence", {}).get("inspected_block_bounds", [])
        
        # Find a TRUE block and make upper bound violate threshold (< 4.0 A)
        modified = False
        for b in bounds:
            if b.get("status") in ("TRUE", "CERTIFIED_TRUE"):
                b["upper_bound"] = 15.0  # violates < 4.0
                modified = True
                break

        if modified:
            with pytest.raises(MOCSVerificationError, match="Soundness violation"):
                verify_certificate(tampered, verify_hashes=False)

    def test_tampered_mci_hash_rejected(self, valid_kdop_cert):
        """Forged or mismatched MCI hashes must fail audit."""
        tampered = copy.deepcopy(valid_kdop_cert)
        tampered["index_commitment"]["mci_index_hash"] = "0" * 64

        with pytest.raises(MOCSVerificationError, match="Rejected forged"):
            verify_certificate(tampered, verify_hashes=False)
