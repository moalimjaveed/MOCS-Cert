export interface TopologyAtom {
  readonly index: number;
  readonly name: string;
  readonly element: string;
  readonly chain: string;
  readonly resSeq: number;
  readonly resName: string;
  readonly insCode?: string;
  readonly altLoc?: string;
  readonly entityId?: string;
}

export interface TopologyBond {
  readonly atomA: number;
  readonly atomB: number;
  readonly order: number;
}

export interface Topology {
  readonly atomCount: number;
  readonly atoms: readonly TopologyAtom[];
  readonly bonds: readonly TopologyBond[];
}
