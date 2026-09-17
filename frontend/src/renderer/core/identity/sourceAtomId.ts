/**
 * Canonical Coordinate-Invariant Source Atom Identity.
 * Fully distinguishes all structural dimensions to prevent ambiguous resolution.
 */

export interface SourceAtomId {
  readonly dataset: string;
  readonly model: number;
  readonly entity: string;
  readonly chain: string;
  readonly seq: number;
  readonly insertionCode?: string;
  readonly component: string;
  readonly atom: string;
  readonly altLoc?: string;
}

/**
 * Serializes a SourceAtomId to a canonical deterministic string key.
 */
export function formatSourceAtomKey(id: SourceAtomId): string {
  const ins = id.insertionCode ? `^${id.insertionCode}` : '';
  const alt = id.altLoc ? `@${id.altLoc}` : '';
  return `${id.dataset}|M${id.model}|E${id.entity}|${id.chain}:${id.seq}${ins}:${id.component}.${id.atom}${alt}`;
}

/**
 * Checks equality between two SourceAtomIds.
 */
export function sourceAtomIdEquals(a: SourceAtomId, b: SourceAtomId): boolean {
  return (
    a.dataset === b.dataset &&
    a.model === b.model &&
    a.entity === b.entity &&
    a.chain === b.chain &&
    a.seq === b.seq &&
    (a.insertionCode || '') === (b.insertionCode || '') &&
    a.component === b.component &&
    a.atom === b.atom &&
    (a.altLoc || '') === (b.altLoc || '')
  );
}
