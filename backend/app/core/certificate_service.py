"""Certificate verification and cryptographic auditing service."""

from __future__ import annotations
import os
import json
import hashlib
from typing import Dict, Any, Tuple, Optional
import mocs
from mocs.certificates.auditor import verify_certificate
from mocs.exceptions import MOCSVerificationError, MOCSDataIntegrityError, MOCSFileNotFoundError
from backend.app.config import settings

class CertificateService:
    """Audits execution certificates against formal cryptographic commitments."""

    def verify(self, cert_data: Dict[str, Any], verify_hashes: bool = True) -> Dict[str, Any]:
        diagnostics = []
        source_verified = False
        mci_verified = False
        semantics_verified = False
        evidence_consistent = False

        try:
            # 1. Reject dummy hashes
            traj_hash = cert_data.get("source", {}).get("trajectory_sha256", "")
            if traj_hash == "0" * 64:
                raise MOCSVerificationError("Rejected: Dummy trajectory SHA-256 (all zeros) detected.")
            mci_hash = cert_data.get("index_commitment", {}).get("mci_index_hash", "")
            if mci_hash == "f" * 64:
                raise MOCSVerificationError("Rejected: Dummy MCI hash (all f's) detected.")

            # 2. Semantics validation
            sem = cert_data.get("semantics", {})
            if sem.get("sampling_semantics", {}).get("mode") in ("sampled_frames", "strided_frames"):
                semantics_verified = True
            else:
                diagnostics.append("Unsupported sampling semantics mode.")

            # 3. Evidence consistency audit
            ev = cert_data.get("evidence", {})
            if "blocks_examined" in ev and ev.get("blocks_examined", 0) > 0:
                evidence_consistent = True
            elif "total_blocks" in ev and ev.get("total_blocks", 0) > 0:
                evidence_consistent = True
            else:
                diagnostics.append("Evidence block count missing or zero.")

            # 4. Resolve source paths safely inside allowed data directories (F-004)
            traj_file = cert_data.get("source", {}).get("trajectory_file") or cert_data.get("source", {}).get("trajectory_id") or cert_data.get("source", {}).get("trajectory_path")
            topo_file = cert_data.get("source", {}).get("topology_file") or cert_data.get("source", {}).get("topology_id") or cert_data.get("source", {}).get("topology_path")

            def _safe_resolve_source(filename: Optional[str]) -> Optional[str]:
                if not filename or "\x00" in filename:
                    return None
                base = os.path.basename(filename)
                for d in [settings.DATA_ROOT, "tests/data", "artifacts/unseen_data"]:
                    p = os.path.abspath(os.path.join(d, base))
                    d_abs = os.path.abspath(d)
                    if p.startswith(d_abs) and os.path.isfile(p):
                        return p
                return None

            real_traj = _safe_resolve_source(traj_file)
            real_topo = _safe_resolve_source(topo_file)

            # 5. Cryptographic commitment verification
            if verify_hashes and real_traj and real_topo:
                is_valid = verify_certificate(
                    cert_data,
                    trajectory_path=real_traj,
                    topology_path=real_topo,
                    verify_hashes=True
                )
                source_verified = True
                mci_verified = bool(mci_hash)
            elif verify_hashes and (not real_traj or not real_topo):
                # If hashes requested but source files unavailable, cannot verify source
                is_valid = verify_certificate(cert_data, verify_hashes=False)
                source_verified = False
                mci_verified = False
                diagnostics.append("Source files not found on disk; cryptographic byte audit skipped.")
            else:
                is_valid = verify_certificate(cert_data, verify_hashes=False)
                source_verified = False
                mci_verified = False

            cert_id = cert_data.get("query", {}).get("query_id", "cert_unknown")
            from mocs.certificates.canonical import compute_certificate_hash, verify_certificate_hash
            if "certificate_hash" in cert_data:
                if not verify_certificate_hash(cert_data):
                    raise MOCSVerificationError("Certificate hash mismatch — cryptographic self-commitment payload has been modified.")
                cert_hash = cert_data["certificate_hash"]
            else:
                cert_hash = compute_certificate_hash(cert_data)

            return {
                "is_valid": is_valid,
                "certificate_id": f"mocs://cert/{cert_id}",
                "certificate_hash": cert_hash,
                "source_commitment_verified": source_verified,
                "mci_commitment_verified": mci_verified,
                "semantics_verified": semantics_verified,
                "evidence_consistent": evidence_consistent,
                "diagnostics": diagnostics
            }
        except (MOCSVerificationError, MOCSDataIntegrityError, MOCSFileNotFoundError) as e:
            return {
                "is_valid": False,
                "certificate_id": "invalid",
                "certificate_hash": "",
                "source_commitment_verified": False,
                "mci_commitment_verified": False,
                "semantics_verified": semantics_verified,
                "evidence_consistent": evidence_consistent,
                "diagnostics": [str(e)]
            }

certificate_service = CertificateService()
