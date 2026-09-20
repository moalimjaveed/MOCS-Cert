/**
 * MOCS-Cert — Scientific Invariants Verification
 *
 * Invariant checks for identity, geometry, and evidence records.
 * No React, no Mol*, no Three.js.
 */

import type { EvidenceRecord } from './types.js';

export interface InvariantViolation {
  readonly invariant: string;
  readonly message: string;
}

export function checkAABBInvariants(aabb: {
  min: readonly [number, number, number];
  max: readonly [number, number, number];
  atomCount?: number;
  padding?: number;
}): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const [minX, minY, minZ] = aabb.min;
  const [maxX, maxY, maxZ] = aabb.max;

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(minZ)) {
    violations.push({ invariant: 'AABB_MIN_FINITE', message: `AABB min is non-finite: [${minX}, ${minY}, ${minZ}]` });
  }
  if (!Number.isFinite(maxX) || !Number.isFinite(maxY) || !Number.isFinite(maxZ)) {
    violations.push({ invariant: 'AABB_MAX_FINITE', message: `AABB max is non-finite: [${maxX}, ${maxY}, ${maxZ}]` });
  }
  if (maxX < minX) violations.push({ invariant: 'AABB_MAX_GTE_MIN_X', message: `max.x (${maxX}) < min.x (${minX})` });
  if (maxY < minY) violations.push({ invariant: 'AABB_MAX_GTE_MIN_Y', message: `max.y (${maxY}) < min.y (${minY})` });
  if (maxZ < minZ) violations.push({ invariant: 'AABB_MAX_GTE_MIN_Z', message: `max.z (${maxZ}) < min.z (${minZ})` });
  if (aabb.atomCount !== undefined && aabb.atomCount <= 0) {
    violations.push({ invariant: 'AABB_ATOM_COUNT_POSITIVE', message: `atomCount must be > 0: ${aabb.atomCount}` });
  }
  if (aabb.padding !== undefined && aabb.padding < 0) {
    violations.push({ invariant: 'AABB_PADDING_NON_NEGATIVE', message: `padding must be >= 0: ${aabb.padding}` });
  }

  return violations;
}

export function checkEvidenceRecordInvariants(record: EvidenceRecord): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  if (!record.evidenceId) violations.push({ invariant: 'EVIDENCE_ID_REQUIRED', message: 'evidenceId is empty' });
  if (!record.scientificDigest) violations.push({ invariant: 'EVIDENCE_SCIENTIFIC_DIGEST_REQUIRED', message: 'scientificDigest is empty' });
  if (!record.provenanceDigest) violations.push({ invariant: 'EVIDENCE_PROVENANCE_DIGEST_REQUIRED', message: 'provenanceDigest is empty' });
  if (record.supersedes !== null && record.supersededBy !== null && record.supersedes === record.supersededBy) {
    violations.push({ invariant: 'EVIDENCE_CYCLIC_SUPERSEDE', message: 'Record cannot supersede itself' });
  }
  return violations;
}
