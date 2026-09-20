"""Pass 37: Cryptographically Self-Consistent False Certificate Rejection Suite.

Adversarial attack model:
An adversary generates mathematically or scientifically FALSE claims, but
recomputes all cryptographic digests (SHA-256 certificate_hash) so the certificate
is internally cryptographically self-consistent.

The independent auditor must reject the scientific lie:
- Case A: False lower bound (violates predicate classification)
- Case B: False upper bound (violates predicate classification)
- Case C: False truth value (claims TRUE without witnesses)
- Case D: False existential FALSE (claims FALSE while positive witness exists)
- Case E: False quantifier (claims FORALL without complete coverage)
- Case F: False duration (claims contiguous persistence but intervals have gaps)
- Case G: False sampling semantics (continuous_physical claimed as TRUE)
- Case H: False threshold contradiction
"""

import copy
import json
import hashlib
import pytest

from backend.app.core.compiler_service import CompilerService
from mocs.certificates.auditor import verify_certificate
from mocs.exceptions import MOCSVerificationError


def recompute_certificate_hash(cert: dict) -> dict:
    """Recomputes internal SHA-256 certificate_hash so the certificate is cryptographically consistent."""
    cert_copy = copy.deepcopy(cert)
    clean_dict = {k: v for k, v in cert_copy.items() if k != "certificate_hash"}
    canonical_json = json.dumps(clean_dict, sort_keys=True).encode("utf-8")
    cert_copy["certificate_hash"] = hashlib.sha256(canonical_json).hexdigest()
    return cert_copy


class TestCertificateRecomputedLies:
    """Verifies that the auditor rejects scientifically false certificates despite valid cryptographic digests."""

    @pytest.fixture
    def baseline_cert(self):
        cs = CompilerService()
        query = "FIND resname ALA and name CA WITHIN 12.0 A OF resname LIG and name O2"
        res = cs.execute(query, "tests/data/synth_50f.xtc")
        return res.certificate

    def test_case_a_false_lower_bound_recomputed_hash(self, baseline_cert):
        """Case A: Lower bound modified to contradict CERTIFIED_FALSE classification."""
        cert = copy.deepcopy(baseline_cert)
        # Force block 0 to be CERTIFIED_FALSE, but set L = 2.0 when threshold is 12.0 (< 12.0)
        cert["evidence"]["inspected_block_bounds"][0]["status"] = "CERTIFIED_FALSE"
        cert["evidence"]["inspected_block_bounds"][0]["lower_bound"] = 2.0  # L=2.0 cannot certify < 12.0 as FALSE!
        cert = recompute_certificate_hash(cert)

        with pytest.raises(MOCSVerificationError) as exc:
            verify_certificate(cert, verify_hashes=False)
        assert "Soundness violation in Block 0" in str(exc.value)

    def test_case_b_false_upper_bound_recomputed_hash(self, baseline_cert):
        """Case B: Upper bound modified to contradict CERTIFIED_TRUE classification."""
        cert = copy.deepcopy(baseline_cert)
        # Force block 0 to be CERTIFIED_TRUE, but set U = 25.0 when threshold is 12.0
        cert["evidence"]["inspected_block_bounds"][0]["status"] = "CERTIFIED_TRUE"
        cert["evidence"]["inspected_block_bounds"][0]["upper_bound"] = 25.0  # U=25.0 cannot certify < 12.0 as TRUE!
        cert = recompute_certificate_hash(cert)

        with pytest.raises(MOCSVerificationError) as exc:
            verify_certificate(cert, verify_hashes=False)
        assert "Soundness violation in Block 0" in str(exc.value)

    def test_case_c_false_existential_true_without_witness(self, baseline_cert):
        """Case C: Claims EXISTS is TRUE, but wipes all witnesses and positive blocks."""
        cert = copy.deepcopy(baseline_cert)
        cert["result"]["truth_value"] = "TRUE"
        # Wipe all witnesses across evidence and proof
        cert["evidence"]["witness_intervals"] = []
        if "proof" in cert:
            cert["proof"]["witness_intervals"] = []
            cert["proof"]["witness"] = None
        for b in cert["evidence"]["inspected_block_bounds"]:
            b["status"] = "EXACT_FALSE"
            b["truth_value"] = "FALSE"
        cert = recompute_certificate_hash(cert)

        with pytest.raises(MOCSVerificationError) as exc:
            verify_certificate(cert, verify_hashes=False)
        assert "requires verified witness block or interval" in str(exc.value)

    def test_case_d_false_existential_false_with_witness(self, baseline_cert):
        """Case D: Claims EXISTS is FALSE, but positive witness is present."""
        cert = copy.deepcopy(baseline_cert)
        cert["result"]["truth_value"] = "FALSE"
        # Leave positive witness interval present
        cert["evidence"]["witness_intervals"] = [(10, 20)]
        cert = recompute_certificate_hash(cert)

        with pytest.raises(MOCSVerificationError) as exc:
            verify_certificate(cert, verify_hashes=False)
        assert "Contradiction: Existential FALSE claimed but positive witness is present" in str(exc.value)

    def test_case_e_false_forall_incomplete_coverage(self, baseline_cert):
        """Case E: Claims FORALL is TRUE, but block bounds only cover half the trajectory."""
        cert = copy.deepcopy(baseline_cert)
        cert["quantifier"] = "FORALL"
        cert["result"]["truth_value"] = "TRUE"
        # Omit blocks
        cert["evidence"]["total_blocks"] = 10
        cert["evidence"]["inspected_block_bounds"] = cert["evidence"]["inspected_block_bounds"][:3]
        cert = recompute_certificate_hash(cert)

        with pytest.raises(MOCSVerificationError) as exc:
            verify_certificate(cert, verify_hashes=False)
        assert "Universal quantifier TRUE requires complete trajectory block coverage" in str(exc.value)

    def test_case_f_false_duration_with_gaps(self, baseline_cert):
        """Case F: Claims DURATION of 500 ps (50 frames), but witness intervals have a gap."""
        cert = copy.deepcopy(baseline_cert)
        cert["quantifier"] = "DURATION"
        cert["query"]["temporal"] = {"operator": "FOR", "min_duration_ps": 500.0}
        # Set block bounds to have a gap: block 0 [0, 20), block 1 [30, 60)
        cert["evidence"]["inspected_block_bounds"] = [
            {"block_id": 0, "frame_start": 0, "frame_end_exclusive": 20, "lower_bound": 1.0, "upper_bound": 10.0, "status": "CERTIFIED_TRUE"},
            {"block_id": 1, "frame_start": 30, "frame_end_exclusive": 60, "lower_bound": 1.0, "upper_bound": 10.0, "status": "CERTIFIED_TRUE"}
        ]
        cert["evidence"]["witness_intervals"] = [(0, 20), (30, 60)]  # Gap from 20 to 30!
        cert = recompute_certificate_hash(cert)

        with pytest.raises(MOCSVerificationError) as exc:
            verify_certificate(cert, verify_hashes=False)
        assert "violates contiguity" in str(exc.value)

    def test_case_g_continuous_physical_claimed_as_true(self, baseline_cert):
        """Case G: Claims continuous physical semantics with TRUE truth value."""
        cert = copy.deepcopy(baseline_cert)
        cert["semantics"]["sampling_semantics"]["mode"] = "continuous_physical"
        cert["result"]["truth_value"] = "TRUE"
        cert["result"]["resolution"] = "COMPLETE"
        cert = recompute_certificate_hash(cert)

        with pytest.raises(MOCSVerificationError) as exc:
            verify_certificate(cert, verify_hashes=False)
        assert "Continuous physical semantics cannot evaluate to TRUE/COMPLETE" in str(exc.value)
