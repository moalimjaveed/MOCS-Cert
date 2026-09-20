/**
 * Canonical Molecular Structural Identity Engine
 * 
 * Enforces the fundamental scientific principle:
 * Structure -> Model -> Entity/Polymer -> Chain/Asym ID -> Component/Residue -> Sequence/Insertion -> Atom Set
 * 
 * Strictly prohibits identifying molecular components solely by loose strings
 * (e.g. `seq === 142` or `comp === 'HEM'`) without chain and model scoping.
 */

export type ComponentClassification =
  | 'protein'
  | 'nucleic'
  | 'ligand'
  | 'cofactor'
  | 'ion'
  | 'buffer'
  | 'solvent'
  | 'custom';

export interface MolecularComponentId {
  structureId: string;
  modelId: string | number;
  chainId: string;
  entityId?: string | number;
  classification: ComponentClassification;
  nucleicType?: 'dna' | 'rna' | 'hybrid' | 'unspecified';
  residueName: string;
  residueNumber: number;
  resSeq?: number;
  resName?: string;
  insertionCode?: string;
  atomNames?: string[];
}

export interface CanonicalSelectionToken {
  raw: string;
  chainId?: string;
  resName?: string;
  resSeq?: number;
  residueNumber?: number; // Alias for resSeq
  insCode?: string;
  insertionCode?: string; // Alias for insCode
  atomName?: string;
  isExplicitChain: boolean;
}

export interface ValidatedAtom {
  id: number | string;
  atomName: string;
  element: string;
  coordinates: [number, number, number];
  isHetero: boolean;
  occupancy?: number;
  bFactor?: number;
  altLoc?: string;
}

export interface IndexedComponent {
  id: MolecularComponentId;
  canonicalLabel: string; // e.g. "HEM · Chain A · 142"
  shortLabel: string;     // e.g. "A:HEM:142"
  atoms: ValidatedAtom[];
}

export interface StructureHierarchyIndex {
  structureId: string;
  modelId: string | number;
  chains: Map<string, {
    chainId: string;
    components: Map<string, IndexedComponent>;
    classification: 'protein' | 'nucleic' | 'hetero' | 'mixed';
  }>;
  allComponents: IndexedComponent[];
  totalValidAtoms: number;
  invalidAtomsCount: number;
}

export const PROTEIN_RESIDUES = new Set([
  // 20 Standard canonical amino acids
  'ALA', 'ARG', 'ASN', 'ASP', 'CYS', 'GLN', 'GLU', 'GLY', 'HIS', 'ILE',
  'LEU', 'LYS', 'MET', 'PHE', 'PRO', 'SER', 'THR', 'TRP', 'TYR', 'VAL',
  // Genetically encoded / common non-canonical amino acids
  'MSE', 'SEC', 'PYL', 'UNK', 'ASX', 'GLX', 'XLE', 'PCA', 'HYP', 'MLY', 'FME',
  // Phosphorylated / modified amino acids
  'SEP', 'TPO', 'PTR', 'CSO', 'CME', 'OCS', 'KCX', 'LLP', 'TYS'
]);

import {
  DNA_SPECIFIC_RESIDUES,
  RNA_SPECIFIC_RESIDUES,
  AMBIGUOUS_NUCLEIC_RESIDUES,
  MODIFIED_NUCLEIC_RESIDUES,
} from '../nucleic/classifier';

export const NUCLEIC_RESIDUES = new Set([
  ...DNA_SPECIFIC_RESIDUES,
  ...RNA_SPECIFIC_RESIDUES,
  ...AMBIGUOUS_NUCLEIC_RESIDUES,
  ...MODIFIED_NUCLEIC_RESIDUES,
]);

export const WATER_RESIDUES = new Set([
  'HOH', 'WAT', 'H2O', 'DOD', 'TIP', 'TIP3', 'SOL', 'H3O', 'OH'
]);

export const ION_RESIDUES = new Set([
  // Metal cations and mono/divalent elemental ions
  'ZN', 'MG', 'CA', 'NA', 'CL', 'FE', 'FE2', 'MN', 'K', 'CU', 'CU1',
  'NI', 'CO', 'CD', 'PB', 'HG', 'PT', 'SR', 'BA', 'BR', 'IOD', 'LI', 'CS'
]);

export const BUFFER_RESIDUES = new Set([
  // Crystallization additives, cryoprotectants, and buffer counterions
  'PO4', 'SO4', 'CIT', 'ACT', 'EDO', 'PEG', 'DMS', 'GOL', 'FMT',
  'TRS', 'MES', 'HEPES', 'BME', 'DTT', 'MPD', 'PGE', 'PG4', 'EPE'
]);

export const GLYCAN_RESIDUES = new Set([
  // Carbohydrates, branched oligosaccharides, and glycan post-translational modifications
  'NAG', 'MAN', 'BMA', 'FUC', 'GAL', 'GLC', 'SIA', 'NDG', 'FUL', 'A2G'
]);

export const COFACTOR_RESIDUES = new Set([
  // Hemes and porphyrins
  'HEM', 'HEA', 'HEB', 'HEC',
  // Nucleotide-derived coenzymes
  'NAD', 'NAP', 'NADP', 'FAD', 'FMN', 'ATP', 'ADP', 'AMP', 'ANP', 'GTP', 'GDP',
  'SAM', 'SAH', 'COA', 'ACO', 'PLP', 'TPP', 'THF', 'BTN', 'F420', 'PQQ', 'MGD'
]);

/**
 * Classifies a residue into its biochemical role with strict polymer distinction.
 * Avoids blindly categorizing unknown polymers as protein.
 */
export function classifyResidue(
  resName: string,
  isPolymer = false,
  chemicalTypeHint?: string
): ComponentClassification {
  const norm = (resName || '').toUpperCase().trim();

  if (WATER_RESIDUES.has(norm)) return 'solvent';
  if (BUFFER_RESIDUES.has(norm)) return 'buffer';
  if (GLYCAN_RESIDUES.has(norm)) return 'ligand';
  if (norm === 'I') return isPolymer ? 'nucleic' : 'ion';
  if (ION_RESIDUES.has(norm)) return 'ion';
  if (COFACTOR_RESIDUES.has(norm)) return 'cofactor';
  if (NUCLEIC_RESIDUES.has(norm)) return 'nucleic';
  if (PROTEIN_RESIDUES.has(norm)) return 'protein';

  // Chemical type hint from mmCIF or Mol* if provided
  if (chemicalTypeHint) {
    const hint = chemicalTypeHint.toLowerCase();
    if (hint.includes('nucleotide') || hint.includes('rna') || hint.includes('dna')) return 'nucleic';
    if (hint.includes('peptide') || hint.includes('amino') || hint.includes('protein')) return 'protein';
    if (hint.includes('ion')) return 'ion';
    if (hint.includes('water')) return 'solvent';
  }

  // If flagged as polymer, check if residue conforms to nucleic naming convention
  if (isPolymer) {
    if (norm.startsWith('D') && norm.length <= 2) return 'nucleic';
    if (['A', 'C', 'G', 'U', 'I'].includes(norm)) return 'nucleic';
    // For unknown polymers that do not match standard amino acids or nucleic acids,
    // preserve uncertainty rather than blindly forcing into 'protein'
    return 'custom';
  }

  return 'ligand';
}

/**
 * Validates that 3D coordinates are strictly finite real numbers.
 * Rejects NaN, Infinity, null, undefined, and non-numeric types.
 */
export function validateCoordinates(
  x: any,
  y: any,
  z: any
): [number, number, number] | null {
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof z !== 'number' ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(z)
  ) {
    return null;
  }
  return [x, y, z];
}

/**
 * Normalizes a chain identifier string (defaults to 'A' if missing/empty).
 */
export function normalizeChainId(chainId: string | null | undefined): string {
  if (!chainId) return 'A';
  const trimmed = chainId.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : 'A';
}

/**
 * Robustly parses a selection string into a structured CanonicalSelectionToken.
 * 
 * Supports standard formats:
 * - "A:87:NE2"        -> chain: A, resSeq: 87, atom: NE2
 * - "A:HEM:142:FE"    -> chain: A, resName: HEM, resSeq: 142, atom: FE
 * - "A:HEM:142"       -> chain: A, resName: HEM, resSeq: 142 (whole component)
 * - "A:87"            -> chain: A, resSeq: 87 (whole residue)
 * - "HEM:142:FE"      -> resName: HEM, resSeq: 142, atom: FE (chain omitted!)
 * - "HEM:142"         -> resName: HEM, resSeq: 142 (chain omitted!)
 * - "A:1:O5'"         -> chain: A, resSeq: 1, atom: O5'
 */
function parseSeqAndIns(str: string): { seq?: number; ins?: string } {
  if (!str) return {};
  const m = str.trim().match(/^([+-]?\d+)([A-Za-z])?$/);
  if (m) {
    return { seq: parseInt(m[1], 10), ins: m[2] ? m[2].toUpperCase() : undefined };
  }
  const n = parseInt(str, 10);
  return isNaN(n) ? {} : { seq: n };
}

function _parseCanonicalSelection(selStr: string): CanonicalSelectionToken {
  const raw = (selStr || '').trim();
  if (!raw) {
    return { raw: '', isExplicitChain: false };
  }

  const parts = raw.split(':').map((p) => p.trim());

  if (parts.length === 1) {
    const single = parts[0];
    const { seq, ins } = parseSeqAndIns(single);
    if (seq !== undefined) {
      return { raw, resSeq: seq, insCode: ins, isExplicitChain: false };
    }
    // Single character is typically a chain; multiple letters is residue name
    if (single.length === 1 && /^[A-Za-z0-9]$/.test(single)) {
      return { raw, chainId: single, isExplicitChain: true };
    }
    return { raw, resName: single.toUpperCase(), isExplicitChain: false };
  }

  if (parts.length === 2) {
    // Could be "Chain:ResSeq" (e.g. "A:87", "A:87A") or "ResName:ResSeq" (e.g. "HEM:142")
    const [p0, p1] = parts;
    const { seq: num, ins } = parseSeqAndIns(p1);

    // In 2-part selections (e.g. "A:87" vs "HEM:142"), 1-letter prefix is ALWAYS chain ID.
    if (p0.length === 1) {
      return {
        raw,
        chainId: p0,
        resSeq: num,
        insCode: ins,
        isExplicitChain: true,
      };
    }

    const isKnownRes = COFACTOR_RESIDUES.has(p0.toUpperCase()) ||
      PROTEIN_RESIDUES.has(p0.toUpperCase()) ||
      NUCLEIC_RESIDUES.has(p0.toUpperCase()) ||
      BUFFER_RESIDUES.has(p0.toUpperCase()) ||
      ION_RESIDUES.has(p0.toUpperCase()) ||
      ['LIG', 'UNL', 'DRG', 'MOL', 'UNK'].includes(p0.toUpperCase()) ||
      p0.length >= 3;

    if (!isKnownRes && p0.length === 2 && /^[A-Za-z][0-9A-Za-z]$/.test(p0)) {
      return {
        raw,
        chainId: p0,
        resSeq: num,
        insCode: ins,
        isExplicitChain: true,
      };
    }

    // ResName:ResSeq (e.g. "HEM:142", "LIG:1")
    return {
      raw,
      resName: p0.toUpperCase(),
      resSeq: num,
      insCode: ins,
      isExplicitChain: false,
    };
  }

  if (parts.length === 3) {
    // Could be:
    // 1. "Chain:ResSeq:Atom" (e.g. "A:87:NE2", "A:87A:NE2", "A:155:CA")
    // 2. "Chain:ResName:ResSeq" (e.g. "A:HEM:142")
    // 3. "ResName:ResSeq:Atom" (e.g. "HEM:142:FE", "LIG:1:O2" - chain omitted!)
    const [p0, p1, p2] = parts;
    const { seq: num1, ins: ins1 } = parseSeqAndIns(p1);
    const { seq: num2, ins: ins2 } = parseSeqAndIns(p2);

    // Case 1: "Chain:ResSeq:Atom" or "ResName:ResSeq:Atom" (p1 is number/ins, p2 is atom string)
    if (num1 !== undefined && num2 === undefined) {
      if (p0.length === 1) {
        return {
          raw,
          chainId: p0,
          resSeq: num1,
          insCode: ins1,
          atomName: p2,
          isExplicitChain: true,
        };
      }

      const isKnownRes = COFACTOR_RESIDUES.has(p0.toUpperCase()) ||
        PROTEIN_RESIDUES.has(p0.toUpperCase()) ||
        NUCLEIC_RESIDUES.has(p0.toUpperCase()) ||
        BUFFER_RESIDUES.has(p0.toUpperCase()) ||
        ION_RESIDUES.has(p0.toUpperCase()) ||
        ['LIG', 'UNL', 'DRG', 'MOL', 'UNK'].includes(p0.toUpperCase()) ||
        p0.length >= 3;

      if (isKnownRes) {
        return {
          raw,
          resName: p0.toUpperCase(),
          resSeq: num1,
          insCode: ins1,
          atomName: p2,
          isExplicitChain: false,
        };
      }
      return {
        raw,
        chainId: p0,
        resSeq: num1,
        insCode: ins1,
        atomName: p2,
        isExplicitChain: true,
      };
    }

    // Case 2: "Chain:ResName:ResSeq" (p1 is string, p2 is number/ins)
    if (num1 === undefined && num2 !== undefined) {
      return {
        raw,
        chainId: p0,
        resName: p1.toUpperCase(),
        resSeq: num2,
        insCode: ins2,
        isExplicitChain: true,
      };
    }

    return {
      raw,
      chainId: p0,
      resSeq: num1,
      insCode: ins1,
      atomName: p2,
      isExplicitChain: true,
    };
  }

  if (parts.length >= 4) {
    // "Chain:ResName:ResSeq:Atom" (e.g. "A:HEM:142:FE")
    const [p0, p1, p2, p3] = parts;
    const { seq: num, ins } = parseSeqAndIns(p2);
    return {
      raw,
      chainId: p0,
      resName: p1.toUpperCase(),
      resSeq: num,
      insCode: ins,
      atomName: p3,
      isExplicitChain: true,
    };
  }

  return { raw, isExplicitChain: false };
}

export function parseCanonicalSelection(selStr: string): CanonicalSelectionToken {
  const token = _parseCanonicalSelection(selStr);
  if (token.resSeq !== undefined && token.residueNumber === undefined) {
    token.residueNumber = token.resSeq;
  }
  if (token.insCode !== undefined && token.insertionCode === undefined) {
    token.insertionCode = token.insCode;
  }
  return token;
}

export type SelectionSafetyClassification =
  | 'STRUCTURALLY_SAFE'
  | 'POTENTIALLY_AMBIGUOUS'
  | 'INCORRECT';

/**
 * Classifies the structural safety of a selection string according to MOCS-Cert principles:
 * - STRUCTURALLY_SAFE: Fully qualified with explicit chain identifier AND residue sequence number
 *   (e.g., "A:87:NE2", "A:HEM:142:FE", "A:1:O5'"). Unambiguously targets a single residue in a multi-chain assembly.
 * - POTENTIALLY_AMBIGUOUS: Missing chain context (e.g. "HEM:142:FE", "87", "HEM") or broad polymer/chain-only
 *   (e.g., "A", "polymer"). In multi-chain oligomers like 4HHB tetramer, this risks cross-chain collision.
 * - INCORRECT: Empty, invalid format, or malformed syntax.
 */
export function classifySelectionSafety(
  selection: string | CanonicalSelectionToken
): SelectionSafetyClassification {
  const token = typeof selection === 'string' ? parseCanonicalSelection(selection) : selection;
  if (!token || !token.raw || token.raw.trim().length === 0) {
    return 'INCORRECT';
  }

  const raw = token.raw.trim();
  if (raw.includes('::') || raw.startsWith(':') || raw.endsWith(':')) {
    return 'INCORRECT';
  }

  // Fully qualified: explicit chain + residue sequence number
  if (token.isExplicitChain && token.chainId && token.resSeq !== undefined) {
    return 'STRUCTURALLY_SAFE';
  }

  // Any selection without chain, or without residue number, is ambiguous in multi-chain biopolymers
  return 'POTENTIALLY_AMBIGUOUS';
}
