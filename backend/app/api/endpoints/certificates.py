"""Execution certificate verification endpoints."""

from fastapi import APIRouter
from backend.app.schemas.certificate import CertificateVerifyRequest, CertificateVerifyResponse
from backend.app.core.certificate_service import certificate_service

router = APIRouter()

@router.post("/verify", response_model=CertificateVerifyResponse)
def verify_certificate_endpoint(request: CertificateVerifyRequest):
    """Audits an execution certificate against formal cryptographic commitments."""
    result = certificate_service.verify(request.certificate, verify_hashes=request.verify_hashes)
    return CertificateVerifyResponse(**result)
