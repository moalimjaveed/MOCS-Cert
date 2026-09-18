/**
 * MOCS-Cert Protein Structural Biology — Amino Acid Classifier & Identity Engine
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: IUPAC-IUBMB Commission on Biochemical Nomenclature
 */

import type {
  StandardAminoAcid1Letter,
  StandardAminoAcid3Letter,
  AminoAcidClassification,
} from './types';
import type { ValidatedAtom } from '../geometry/structuralIdentity';

export const CANONICAL_AMINO_ACID_MAP: Record<StandardAminoAcid3Letter, StandardAminoAcid1Letter> = {
  ALA: 'A', CYS: 'C', ASP: 'D', GLU: 'E', PHE: 'F',
  GLY: 'G', HIS: 'H', ILE: 'I', LYS: 'K', LEU: 'L',
  MET: 'M', ASN: 'N', PRO: 'P', GLN: 'Q', ARG: 'R',
  SER: 'S', THR: 'T', VAL: 'V', TRP: 'W', TYR: 'Y',
};

export const THREE_TO_ONE_LETTER_MAP: Record<string, string> = CANONICAL_AMINO_ACID_MAP;

export const ONE_TO_THREE_LETTER_MAP: Record<StandardAminoAcid1Letter, StandardAminoAcid3Letter> = {
  A: 'ALA', C: 'CYS', D: 'ASP', E: 'GLU', F: 'PHE',
  G: 'GLY', H: 'HIS', I: 'ILE', K: 'LYS', L: 'LEU',
  M: 'MET', N: 'ASN', P: 'PRO', Q: 'GLN', R: 'ARG',
  S: 'SER', T: 'THR', V: 'VAL', W: 'TRP', Y: 'TYR',
};

export const STANDARD_AMINO_ACIDS = new Set<string>(Object.keys(CANONICAL_AMINO_ACID_MAP));

export const NON_CANONICAL_AMINO_ACIDS: Record<string, { singleLetter: string; parent: string; description: string }> = {
  MSE: { singleLetter: 'M', parent: 'MET', description: 'Selenomethionine' },
  SEC: { singleLetter: 'U', parent: 'CYS', description: 'Selenocysteine (21st amino acid)' },
  PYL: { singleLetter: 'O', parent: 'LYS', description: 'Pyrrolysine (22nd amino acid)' },
  PCA: { singleLetter: 'E', parent: 'GLU', description: 'Pyroglutamic acid (5-oxoproline)' },
  HYP: { singleLetter: 'P', parent: 'PRO', description: '4-hydroxyproline' },
  MLY: { singleLetter: 'K', parent: 'LYS', description: 'N-dimethyl-lysine' },
  FME: { singleLetter: 'M', parent: 'MET', description: 'N-formylmethionine' },
};

export const PTM_AMINO_ACIDS: Record<string, { singleLetter: string; parent: string; modification: string }> = {
  SEP: { singleLetter: 'S', parent: 'SER', modification: 'Phosphorylation (Phosphoserine)' },
  TPO: { singleLetter: 'T', parent: 'THR', modification: 'Phosphorylation (Phosphothreonine)' },
  PTR: { singleLetter: 'Y', parent: 'TYR', modification: 'Phosphorylation (Phosphotyrosine)' },
  CSO: { singleLetter: 'C', parent: 'CYS', modification: 'Oxidation (S-hydroxycysteine)' },
  CME: { singleLetter: 'C', parent: 'CYS', modification: 'Alkylation (S,S-(2-hydroxyethyl)thiocysteine)' },
  OCS: { singleLetter: 'C', parent: 'CYS', modification: 'Oxidation (Cysteinesulfonic acid)' },
  KCX: { singleLetter: 'K', parent: 'LYS', modification: 'Carboxylation (Lysine NZ-carboxylic acid)' },
  LLP: { singleLetter: 'K', parent: 'LYS', modification: 'Cofactor binding (2-lysyl-pyridoxal-5-phosphate)' },
  TYS: { singleLetter: 'Y', parent: 'TYR', modification: 'Sulfation (O-sulfo-L-tyrosine)' },
};

export const AMBIGUOUS_AMINO_ACIDS: Record<string, { singleLetter: string; options: string[] }> = {
  ASX: { singleLetter: 'B', options: ['ASP', 'ASN'] },
  GLX: { singleLetter: 'Z', options: ['GLU', 'GLN'] },
  XLE: { singleLetter: 'J', options: ['LEU', 'ILE'] },
  UNK: { singleLetter: 'X', options: [] },
};

export const PROTEIN_BACKBONE_ATOMS = new Set([
  'N', 'CA', 'C', 'O', 'OXT', 'H', 'H1', 'H2', 'H3', 'HA', 'HA2', 'HA3'
]);

/**
 * Checks if a residue name corresponds to any recognized protein/amino acid entity.
 */
export function isProteinResidue(resName: string): boolean {
  if (!resName) return false;
  const norm = resName.toUpperCase().trim();
  return (
    STANDARD_AMINO_ACIDS.has(norm) ||
    norm in NON_CANONICAL_AMINO_ACIDS ||
    norm in PTM_AMINO_ACIDS ||
    norm in AMBIGUOUS_AMINO_ACIDS
  );
}

/**
 * Classifies an amino acid residue into its specific structural/chemical subtype.
 */
export function classifyAminoAcid(resName: string): {
  classification: AminoAcidClassification;
  singleLetterCode: string;
  isModified: boolean;
  canonicalParent?: string;
  description?: string;
} {
  const norm = (resName || '').toUpperCase().trim();

  if (STANDARD_AMINO_ACIDS.has(norm)) {
    return {
      classification: 'standard',
      singleLetterCode: CANONICAL_AMINO_ACID_MAP[norm as StandardAminoAcid3Letter],
      isModified: false,
    };
  }

  if (norm in NON_CANONICAL_AMINO_ACIDS) {
    const entry = NON_CANONICAL_AMINO_ACIDS[norm];
    return {
      classification: 'non-canonical',
      singleLetterCode: entry.singleLetter,
      isModified: true,
      canonicalParent: entry.parent,
      description: entry.description,
    };
  }

  if (norm in PTM_AMINO_ACIDS) {
    const entry = PTM_AMINO_ACIDS[norm];
    return {
      classification: 'post-translationally-modified',
      singleLetterCode: entry.singleLetter,
      isModified: true,
      canonicalParent: entry.parent,
      description: entry.modification,
    };
  }

  if (norm in AMBIGUOUS_AMINO_ACIDS) {
    const entry = AMBIGUOUS_AMINO_ACIDS[norm];
    return {
      classification: norm === 'UNK' ? 'unknown' : 'ambiguous',
      singleLetterCode: entry.singleLetter,
      isModified: false,
      description: `Ambiguous amino acid (${entry.options.join('/') || 'Unknown'})`,
    };
  }

  return {
    classification: 'unknown',
    singleLetterCode: 'X',
    isModified: false,
    description: `Unrecognized residue '${resName}'`,
  };
}

/**
 * Crucial structural discrimination:
 * Distinguishes Alpha Carbon (CA in protein) from Calcium Ion (Ca / CA).
 * 
 * Contextual Criteria:
 * - If residue is 'CA' or 'CAL', or element is 'CA'/'Ca' without peptide context -> Calcium Ion!
 * - If residue is a protein residue, atom name is 'CA', and element is 'C' (or omitted) -> Alpha Carbon!
 */
export function isAlphaCarbon(
  atomName: string,
  element?: string,
  resName?: string
): boolean {
  const normAtom = (atomName || '').toUpperCase().trim();
  const normElem = (element || '').toUpperCase().trim();
  const normRes = (resName || '').toUpperCase().trim();

  // If the residue itself is Calcium, it's NEVER an alpha carbon
  if (normRes === 'CA' || normRes === 'CAL') {
    return false;
  }

  // If element is explicitly Calcium (Ca), it's not alpha carbon
  if (normElem === 'CA' && normRes !== '' && !isProteinResidue(normRes)) {
    return false;
  }

  // Must have atom name 'CA' in an amino acid context
  if (normAtom === 'CA') {
    if (normElem === 'C' || normElem === '') {
      return normRes === '' || isProteinResidue(normRes);
    }
  }

  return false;
}

/**
 * Distinguishes Calcium Ion (Ca) from Alpha Carbon (CA).
 */
export function isCalciumIon(
  atomName: string,
  element?: string,
  resName?: string
): boolean {
  const normAtom = (atomName || '').toUpperCase().trim();
  const normElem = (element || '').toUpperCase().trim();
  const normRes = (resName || '').toUpperCase().trim();

  if (normRes === 'CA' || normRes === 'CAL') return true;
  if (normElem === 'CA' || normElem === 'CAL') return true;
  if (normAtom === 'CA' && (normElem === 'CA' || !isProteinResidue(normRes))) return true;

  return false;
}

/**
 * Partitions a list of validated atoms for a residue into backbone and sidechain subsets.
 */
export function partitionProteinAtoms(
  atoms: ValidatedAtom[],
  resName: string
): {
  backboneAtoms: ValidatedAtom[];
  sidechainAtoms: ValidatedAtom[];
  alphaCarbon?: ValidatedAtom;
} {
  const backboneAtoms: ValidatedAtom[] = [];
  const sidechainAtoms: ValidatedAtom[] = [];
  let alphaCarbon: ValidatedAtom | undefined;

  for (const atom of atoms) {
    const norm = (atom.atomName || '').toUpperCase().trim();
    if (isAlphaCarbon(norm, atom.element, resName)) {
      alphaCarbon = atom;
      backboneAtoms.push(atom);
    } else if (PROTEIN_BACKBONE_ATOMS.has(norm)) {
      backboneAtoms.push(atom);
    } else {
      sidechainAtoms.push(atom);
    }
  }

  return { backboneAtoms, sidechainAtoms, alphaCarbon };
}
