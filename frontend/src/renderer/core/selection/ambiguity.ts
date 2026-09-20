import { SourceAtomId } from '../identity/sourceAtomId.js';

export interface ResolvedAtomMatch {
  readonly atomIndex: number;
  readonly sourceAtomId: SourceAtomId;
  readonly position: readonly [number, number, number];
}
