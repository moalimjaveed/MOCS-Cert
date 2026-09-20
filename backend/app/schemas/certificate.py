"""Certificate verification and auditing schemas."""

from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional

class CertificateVerifyRequest(BaseModel):
    certificate: Dict[str, Any]
    verify_hashes: bool = True

class CertificateVerifyResponse(BaseModel):
    is_valid: bool
    certificate_id: str
    certificate_hash: str
    source_commitment_verified: bool
    mci_commitment_verified: bool
    semantics_verified: bool
    evidence_consistent: bool
    diagnostics: List[str] = Field(default_factory=list)

class CertificateResponse(BaseModel):
    certificate_id: str
    certificate_hash: str
    data: Dict[str, Any]
