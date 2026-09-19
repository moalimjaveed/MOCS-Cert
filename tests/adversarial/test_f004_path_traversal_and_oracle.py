"""
Adversarial tests for F-004:
- Path traversal rejection (../../, Windows absolute paths, null bytes)
- No server filesystem path leakage in error responses
- No SHA-256 oracle (error responses must not echo server file hashes)
"""

import pytest
import os
from backend.app.core.compiler_service import CompilerService
from backend.app.core.certificate_service import CertificateService
from mocs.certificates.auditor import audit_data_provenance, verify_certificate
from mocs.exceptions import MOCSFileNotFoundError, MOCSDataIntegrityError


def test_compiler_service_path_traversal_rejection():
    compiler = CompilerService()
    
    # 1. Directory traversal
    with pytest.raises(MOCSFileNotFoundError) as exc_info:
        compiler._resolve_trajectory_source("../../../../etc/passwd")
    assert "passwd" not in str(exc_info.value)
    assert "/" not in str(exc_info.value)

    # 2. Windows absolute path
    with pytest.raises(MOCSFileNotFoundError) as exc_info:
        compiler._resolve_trajectory_source("C:\\Windows\\System32\\cmd.exe")
    assert "System32" not in str(exc_info.value)

    # 3. Null byte injection
    with pytest.raises(MOCSFileNotFoundError) as exc_info:
        compiler._resolve_trajectory_source("synth_500f.xtc\x00.evil")
    assert "evil" not in str(exc_info.value)


def test_no_sha256_oracle_on_tampered_digest():
    """Verify that file hash mismatch does NOT leak the actual server file digest."""
    manifest = {
        "source": {
            "trajectory_size_bytes": os.path.getsize("tests/data/synth_500f.xtc"),
            "trajectory_sha256": "0" * 64, # Wrong hash
            "topology_sha256": "0" * 64,
        }
    }
    with pytest.raises(MOCSDataIntegrityError) as exc_info:
        audit_data_provenance(
            {"source": manifest["source"]},
            "tests/data/synth_500f.xtc",
            "tests/data/synth_500f.gro"
        )
    msg = str(exc_info.value)
    # The message must NOT leak 'Found: <hash>'
    assert "Found:" not in msg
    assert "Expected:" not in msg
    assert "Trajectory content does not match the certificate commitment." in msg


def test_certificate_service_sandboxing():
    """Verify certificate_service does not probe arbitrary filesystem paths."""
    cert_service = CertificateService()
    tampered_cert = {
        "source": {
            "trajectory_path": "C:\\Windows\\System32\\cmd.exe",
            "topology_path": "C:\\Windows\\System32\\calc.exe",
        },
        "query": {"query_id": "test_q"},
        "evidence": {"blocks_examined": 1}
    }
    # verify must not access or verify Windows system files as sources
    res = cert_service.verify(tampered_cert, verify_hashes=True)
    assert res["source_commitment_verified"] is False
