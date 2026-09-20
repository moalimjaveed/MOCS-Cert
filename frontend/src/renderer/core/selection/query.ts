export interface ParsedAtomQuery {
  readonly chain?: string;
  readonly resSeq?: number;
  readonly resName?: string;
  readonly atomName?: string;
  readonly altLoc?: string;
  readonly modelNum?: number;
  readonly entityId?: string;
  readonly raw: string;
}
