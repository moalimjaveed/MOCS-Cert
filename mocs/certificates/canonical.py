"""Canonical JSON serialization for cryptographic commitments (RFC 8785 subset)."""

from __future__ import annotations
import json
import hashlib
import hmac
from typing import Any, Dict


def canonical_json_bytes(obj: Any) -> bytes:
    """
    Deterministic canonical JSON serialization:
    - Sorted keys
    - Compact separators (',', ':')
    - UTF-8 encoding
    - allow_nan=False (rejects NaN/Infinity fail-closed)
    - ensure_ascii=True
    """
    return json.dumps(
        obj,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
        allow_nan=False
    ).encode("utf-8")


def canonical_sha256(obj: Any) -> str:
    """Computes SHA-256 hex digest over canonical JSON bytes."""
    return hashlib.sha256(canonical_json_bytes(obj)).hexdigest()


def compute_certificate_hash(cert_data: Dict[str, Any]) -> str:
    """
    Computes canonical SHA-256 commitment for an execution certificate.
    Excludes self-referential 'certificate_hash' field.
    """
    clean = {k: v for k, v in cert_data.items() if k != "certificate_hash"}
    return canonical_sha256(clean)


def verify_certificate_hash(cert_data: Dict[str, Any]) -> bool:
    """Verifies that the certificate's claimed hash matches its canonical content."""
    claimed = cert_data.get("certificate_hash")
    if not claimed:
        return False
    expected = compute_certificate_hash(cert_data)
    return hmac.compare_digest(str(claimed), str(expected))


def compute_manifest_digest(manifest_dict: Dict[str, Any]) -> str:
    """
    Computes canonical SHA-256 commitment for a workflow manifest.
    Excludes self-referential 'manifest_digest' and runtime 'created_at'.
    """
    clean = {k: v for k, v in manifest_dict.items() if k not in ("manifest_digest", "created_at")}
    return canonical_sha256(clean)


def verify_manifest_digest(manifest_dict: Dict[str, Any]) -> bool:
    """Verifies that the workflow manifest's claimed digest matches its canonical content."""
    claimed = manifest_dict.get("manifest_digest")
    if not claimed:
        return False
    expected = compute_manifest_digest(manifest_dict)
    return hmac.compare_digest(str(claimed), str(expected))
