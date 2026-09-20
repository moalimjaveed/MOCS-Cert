import { SourceAtomId, formatSourceAtomKey } from './sourceAtomId.js';

/**
 * Canonical Spatial Instance Identity.
 * Couples a SourceAtomId with the specific spatial operator instance.
 */
export interface SpatialInstanceId {
  readonly sourceAtomId: SourceAtomId;
  readonly operatorId: string;
  readonly assemblyId: string;
  readonly operatorHash: string; // Authoritative SHA-256 hash
}

export function formatSpatialInstanceKey(id: SpatialInstanceId): string {
  return `${formatSourceAtomKey(id.sourceAtomId)}::ASS[${id.assemblyId}]::OP[${id.operatorId}:${id.operatorHash.slice(0, 12)}]`;
}

export function spatialInstanceIdEquals(a: SpatialInstanceId, b: SpatialInstanceId): boolean {
  return (
    a.operatorHash === b.operatorHash &&
    a.operatorId === b.operatorId &&
    a.assemblyId === b.assemblyId &&
    formatSourceAtomKey(a.sourceAtomId) === formatSourceAtomKey(b.sourceAtomId)
  );
}
