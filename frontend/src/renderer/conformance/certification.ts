/**
 * @mocs/conformance — Certification State Machine
 *
 * Enforces that CERTIFIED status can never be obtained while conformance
 * or cryptographic integrity invariants are violated.
 */

import { ConformanceReport } from './invariants.js';

export type CertificationStatus =
  | 'CERTIFIED'
  | 'FAILED_CONFORMANCE'
  | 'FAILED_INTEGRITY'
  | 'UNVERIFIED';

export interface CertificationEvaluation {
  readonly status: CertificationStatus;
  readonly certified: boolean;
  readonly reason: string;
  readonly evaluatedAt: string;
}

/**
 * Pure function deriving system certification.
 * Fail-Closed Rule: certified === true iff conformance passes AND cryptographic integrity holds.
 */
export function evaluateCertification(
  conformance: ConformanceReport,
  ledgerIntegrity: boolean
): CertificationEvaluation {
  const timestamp = new Date().toISOString();

  if (!conformance.isConformant) {
    return {
      status: 'FAILED_CONFORMANCE',
      certified: false,
      reason: `Renderer state diverged from scientific specification: ${conformance.discrepancies.join('; ')}`,
      evaluatedAt: timestamp,
    };
  }

  if (!ledgerIntegrity) {
    return {
      status: 'FAILED_INTEGRITY',
      certified: false,
      reason: 'Cryptographic ledger integrity check failed: hash chain or record tampering detected',
      evaluatedAt: timestamp,
    };
  }

  return {
    status: 'CERTIFIED',
    certified: true,
    reason: 'All renderer proof invariants and cryptographic hash chains verified conformant',
    evaluatedAt: timestamp,
  };
}
