/**
 * Cryptographic certificate audit types.
 */

export interface CertificateVerifyResponse {
  is_valid: boolean;
  certificate_id: string;
  certificate_hash: string;
  source_commitment_verified: boolean;
  mci_commitment_verified: boolean;
  semantics_verified: boolean;
  evidence_consistent: boolean;
  diagnostics: string[];
}
