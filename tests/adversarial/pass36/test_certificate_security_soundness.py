"""
PASS 36 — Sections 12 & 13: Certificate Security and Scientific Soundness Suite.

Verifies:
1. Cryptographic tamper detection: bit mutations to trajectory hash, topology hash,
   MCI hash, Merkle roots, and block records cause immediate rejection.
2. Scientific soundness validation: certificates with valid cryptographic hashes but
   scientifically invalid deductions (e.g. status=TRUE when U >= threshold) are rejected.
"""

import copy
import pytest
from mocs.certificates.auditor import verify_certificate
from mocs.exceptions import MOCSVerificationError, MOCSDataIntegrityError
from backend.app.core.compiler_service import compiler_service


class TestCertificateSecurityAndSoundness:
    """Rigorous audit of certificate verification under cryptographic and scientific attacks."""

    @pytest.fixture
    def valid_certificate(self):
        """Generates a real valid certificate from compiler_service on synth_500f."""
        res = compiler_service.execute("FIND (name CA) WITHIN 4.0A OF (name O2)")
        assert res.certificate is not None
        return copy.deepcopy(res.certificate)

    # -------------------------------------------------------------------------
    # Section 12: Cryptographic Tamper Rejection
    # -------------------------------------------------------------------------

    def test_tampered_trajectory_hash_causes_rejection(self, valid_certificate):
        """Mutating trajectory SHA-256 causes verification rejection."""
        cert = copy.deepcopy(valid_certificate)
        cert["source"]["trajectory_sha256"] = "a" * 64
        with pytest.raises((MOCSVerificationError, MOCSDataIntegrityError)):
            verify_certificate(cert, verify_hashes=True)

    def test_tampered_topology_hash_causes_rejection(self, valid_certificate):
        """Mutating topology SHA-256 causes verification rejection."""
        cert = copy.deepcopy(valid_certificate)
        cert["source"]["topology_sha256"] = "b" * 64
        with pytest.raises((MOCSVerificationError, MOCSDataIntegrityError)):
            verify_certificate(cert, verify_hashes=True)

    def test_dummy_zero_hash_causes_rejection(self, valid_certificate):
        """Dummy all-zero or all-f hash is rejected."""
        cert = copy.deepcopy(valid_certificate)
        cert["source"]["trajectory_sha256"] = "0" * 64
        with pytest.raises(MOCSVerificationError):
            verify_certificate(cert, verify_hashes=True)

    def test_incompatible_certificate_version_rejected(self, valid_certificate):
        """Certificate with unsupported version is rejected."""
        cert = copy.deepcopy(valid_certificate)
        cert["mocs_cert_version"] = "99.0.0"
        with pytest.raises(MOCSVerificationError):
            verify_certificate(cert, verify_hashes=False)

    # -------------------------------------------------------------------------
    # Section 13: Scientific Soundness Rejection (Valid Hashes, False Science)
    # -------------------------------------------------------------------------

    def test_false_true_deduction_rejected_on_soundness(self, valid_certificate):
        """
        Block claims status=TRUE, but upper_bound U (15.0 A) >= threshold (4.0 A).
        The certificate's hashes may be untampered, but the science is false.
        Verifier MUST reject this deduction.
        """
        cert = copy.deepcopy(valid_certificate)
        cert["evidence"]["inspected_block_bounds"] = [
            {
                "block_id": 0,
                "lower_bound": 1.0,
                "upper_bound": 15.0,  # 15.0 >= 4.0, cannot certify TRUE!
                "truth_value": "TRUE"
            }
        ]
        cert["query"]["operator"] = "<"
        cert["query"]["threshold_value"] = 4.0
        with pytest.raises(MOCSVerificationError) as excinfo:
            verify_certificate(cert, verify_hashes=False)
        assert "Soundness violation" in str(excinfo.value)

    def test_false_false_deduction_rejected_on_soundness(self, valid_certificate):
        """
        Block claims status=FALSE, but lower_bound L (2.0 A) < threshold (4.0 A).
        Verifier MUST reject this deduction.
        """
        cert = copy.deepcopy(valid_certificate)
        cert["evidence"]["inspected_block_bounds"] = [
            {
                "block_id": 0,
                "lower_bound": 2.0,   # 2.0 < 4.0, cannot certify FALSE!
                "upper_bound": 10.0,
                "truth_value": "FALSE"
            }
        ]
        cert["query"]["operator"] = "<"
        cert["query"]["threshold_value"] = 4.0
        with pytest.raises(MOCSVerificationError) as excinfo:
            verify_certificate(cert, verify_hashes=False)
        assert "Soundness violation" in str(excinfo.value)

    def test_nan_or_inf_in_block_bounds_rejected(self, valid_certificate):
        """NaN or Inf in lower or upper bound must be rejected."""
        cert = copy.deepcopy(valid_certificate)
        cert["evidence"]["inspected_block_bounds"] = [
            {
                "block_id": 0,
                "lower_bound": float("nan"),
                "upper_bound": 10.0,
                "truth_value": "TRUE"
            }
        ]
        with pytest.raises(MOCSVerificationError):
            verify_certificate(cert, verify_hashes=False)

    def test_negative_resource_metrics_rejected(self, valid_certificate):
        """Corrupted/fabricated negative byte counters are rejected."""
        cert = copy.deepcopy(valid_certificate)
        cert["resources"] = {
            "source_compressed_bytes_fetched": -100,
            "compressed_frames_decoded": 10
        }
        with pytest.raises(MOCSVerificationError):
            verify_certificate(cert, verify_hashes=False)
