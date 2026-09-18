/**
 * Molecular Graph, Chemical Connectivity & Bond-Topology Domain Types
 * 
 * Epistemic Rules:
 * 1. 3D proximity is NOT the same thing as chemical connectivity.
 * 2. Coordinates describe WHERE atoms are.
 * 3. Topology describes WHAT atoms are covalently/coordinatively bonded to.
 * 4. Interactions describe WHAT non-covalent phenomena may be occurring between them.
 * 5. Never collapse or conflate these layers.
 */

export type CanonicalAtomKey = string; // Format: `${structureId}:${modelId}:${chainId}:${residueName}:${residueNumber}${insCode ? ':' + insCode : ''}:${atomName}${altLoc ? ':' + altLoc : ''}`
export type CanonicalBondKey = string; // Format: `${atomKeyA} <-> ${atomKeyB}` (lexicographically ordered)

export type BondType =
  | 'COVALENT_SINGLE'
  | 'COVALENT_DOUBLE'
  | 'COVALENT_TRIPLE'
  | 'COVALENT_AROMATIC'
  | 'DISULFIDE'
  | 'PEPTIDE'
  | 'PHOSPHODIESTER'
  | 'GLYCOSIDIC'
  | 'METAL_COORDINATION'
  | 'UNKNOWN';

export type BondSource =
  | 'DEPOSITED_CONECT'
  | 'DEPOSITED_STRUCT_CONN'
  | 'CHEMICAL_COMPONENT_DICTIONARY'
  | 'POLYMERIC_TEMPLATE'
  | 'DISULFIDE_DETECTOR'
  | 'GEOMETRIC_INFERENCE';

export interface TopologyAtom {
  key: CanonicalAtomKey;
  structureId: string;
  modelId: string | number;
  chainId: string;
  residueName: string;
  residueNumber: number;
  insertionCode?: string;
  atomName: string;
  altLoc?: string;
  element: string;
  coordinates: [number, number, number];
  formalCharge?: number;
  isHetero?: boolean;
}

export interface TopologyBond {
  key: CanonicalBondKey;
  atomAKey: CanonicalAtomKey;
  atomBKey: CanonicalAtomKey;
  bondType: BondType;
  bondOrder: number | null; // 1, 2, 3, 1.5 (aromatic), or null for unknown/coordination
  isAromatic: boolean;
  source: BondSource;
  measuredDistance: number; // Euclidean distance ||r_A - r_B|| in Angstroms
  isInterChain: boolean;
  isInterResidue: boolean;
  notes?: string;
}

export interface MolecularRing {
  ringId: string;
  atomKeys: CanonicalAtomKey[];
  size: number; // e.g. 5, 6
  isAromatic: boolean;
  isHeterocyclic: boolean;
  ringType: 'BENZENE' | 'PYRROLE' | 'FURAN' | 'THIOPHENE' | 'IMIDAZOLE' | 'PYRIDINE' | 'PYRIMIDINE' | 'PURINE' | 'PORPHYRIN' | 'GENERAL_CYCLE';
}

export interface ValenceAuditRecord {
  atomKey: CanonicalAtomKey;
  element: string;
  calculatedValence: number;
  expectedValenceRange: [number, number];
  isValenceValid: boolean;
  notes: string;
}

export interface MolecularGraph {
  structureId: string;
  modelId: string | number;
  atoms: Map<CanonicalAtomKey, TopologyAtom>;
  bonds: Map<CanonicalBondKey, TopologyBond>;
  adjacency: Map<CanonicalAtomKey, CanonicalAtomKey[]>;
  rings: MolecularRing[];
  connectedComponents: CanonicalAtomKey[][];
  valences: ValenceAuditRecord[];
  disulfideCount: number;
  peptideBondCount: number;
  phosphodiesterBondCount: number;
  metalCoordinationCount: number;
  warnings: string[];
}
