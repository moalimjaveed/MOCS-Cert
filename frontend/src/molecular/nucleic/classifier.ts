/**
 * Nucleic Acid Classification & Sugar Chemistry Discrimination Engine
 * 
 * Enforces strict biochemical differentiation:
 * 1. DNA vs RNA:
 *    - Chemical level: Deoxyribose (lacking 2'-hydroxyl O2') vs Ribose (containing 2'-hydroxyl O2')
 *    - Base level: Thymine (DT / T) in DNA vs Uracil (U / RU) in RNA
 *    - PDBx / mmCIF level: 'DA', 'DC', 'DG', 'DT' vs 'A', 'C', 'G', 'U'
 * 2. Unambiguous residue categorization preserving modified bases (5MC, PSU, etc.)
 * 3. Separation of backbone atoms (phosphate + pentose sugar) from aromatic base rings.
 */

import type { ValidatedAtom } from '../geometry';
import type { NucleicType, NucleotideBaseType, SugarType } from './types';

export const DNA_SPECIFIC_RESIDUES = new Set([
  'DA', 'DC', 'DG', 'DT', 'DI',
  'dAMP', 'dCMP', 'dGMP', 'dTMP',
  'THY'
]);

export const RNA_SPECIFIC_RESIDUES = new Set([
  'RA', 'RC', 'RG', 'RU',
  'U', 'URA', 'PSU', 'H2U', '4SU', 'DHU', 'OMU'
]);

export const AMBIGUOUS_NUCLEIC_RESIDUES = new Set([
  'A', 'C', 'G', 'I',
  'ADE', 'CYT', 'GUA'
]);

export const MODIFIED_NUCLEIC_RESIDUES = new Set([
  '5MC', 'OMC', '5MU', 'PSU', 'H2U', '1MA', '2MG', '7MG', 'M2G',
  'OMG', 'A2M', 'YYG', '4SU', 'DHU', 'CH', '1MG', '2MA',
  '6MA', '6MI', 'RIA', 'MIA', 'UR3', '4PC', 'QUO', 'MNU'
]);

export const NUCLEIC_BACKBONE_ATOMS = new Set([
  // Phosphate group
  'P', 'OP1', 'OP2', 'O1P', 'O2P', 'HOP2', 'HOP3',
  // Pentose sugar (primed or asterisk convention)
  "O5'", "C5'", "C4'", "O4'", "C3'", "O3'", "C2'", "C1'", "O2'",
  'O5*', 'C5*', 'C4*', 'O4*', 'C3*', 'O3*', 'C2*', 'C1*', 'O2*',
]);

/**
 * Normalizes atom name by replacing asterisk with prime if applicable.
 */
export function normalizeNucleicAtomName(atomName: string): string {
  if (!atomName) return '';
  return atomName.trim().replace(/\*/g, "'").toUpperCase();
}

/**
 * Detects whether a set of nucleotide atoms belongs to Ribose (RNA) or Deoxyribose (DNA).
 * Evaluates the definitive chemical criterion: presence of the 2'-hydroxyl oxygen atom (O2' / O2*).
 */
export function detectRiboseVsDeoxyribose(atoms: ValidatedAtom[]): SugarType {
  if (!atoms || atoms.length === 0) return 'indeterminate';

  const normalizedNames = new Set(atoms.map((a) => normalizeNucleicAtomName(a.atomName)));

  // Chemical proof: 2'-hydroxyl is uniquely present in Ribose (RNA)
  if (normalizedNames.has("O2'")) {
    return 'ribose';
  }

  // If the pentose ring carbons C1', C2', C3', C4' are present but O2' is absent, it is Deoxyribose (DNA)
  if (normalizedNames.has("C1'") && normalizedNames.has("C2'") && normalizedNames.has("C3'")) {
    return 'deoxyribose';
  }

  return 'indeterminate';
}

/**
 * Classifies a nucleic acid residue as DNA, RNA, or hybrid.
 * Prioritizes chemical sugar verification (O2' presence) over naming conventions.
 */
export function classifyNucleicType(
  resName: string,
  atoms?: ValidatedAtom[]
): NucleicType {
  const norm = (resName || '').toUpperCase().trim();

  // 1. If atoms are provided, inspect authentic sugar chemistry first
  if (atoms && atoms.length > 0) {
    const sugar = detectRiboseVsDeoxyribose(atoms);
    if (sugar === 'ribose') return 'rna';
    if (sugar === 'deoxyribose') return 'dna';
  }

  // 2. Definitive DNA residues
  if (DNA_SPECIFIC_RESIDUES.has(norm)) {
    return 'dna';
  }

  // 3. Definitive RNA residues
  if (RNA_SPECIFIC_RESIDUES.has(norm)) {
    return 'rna';
  }

  // 4. Modified residues (check specific parentage)
  if (MODIFIED_NUCLEIC_RESIDUES.has(norm)) {
    if (norm === '5MC' || norm === '5MU') {
      // 5MC can appear in DNA or RNA, 5MU is RNA (ribothymidine)
      return norm === '5MU' ? 'rna' : 'dna';
    }
    return 'rna'; // vast majority of modified bases in PDB are in tRNA/rRNA
  }

  // 5. Ambiguous legacy codes (A, C, G) - if not chemically proven, mark unspecified
  if (AMBIGUOUS_NUCLEIC_RESIDUES.has(norm)) {
    return 'unspecified';
  }

  return 'unspecified';
}

/**
 * Categorizes a nucleotide's nitrogenous base into canonical purine/pyrimidine families.
 */
export function classifyNucleotideBase(resName: string): {
  canonicalBase: NucleotideBaseType;
  isModified: boolean;
  isPurine: boolean;
  isPyrimidine: boolean;
} {
  const norm = (resName || '').toUpperCase().trim();

  // Adenine
  if (['DA', 'A', 'ADE', 'dAMP', '1MA', '6MA', 'RIA', 'MIA'].includes(norm)) {
    const isModified = ['1MA', '6MA', 'RIA', 'MIA'].includes(norm);
    return { canonicalBase: isModified ? 'modified' : 'A', isModified, isPurine: true, isPyrimidine: false };
  }

  // Cytosine
  if (['DC', 'C', 'CYT', 'dCMP', '5MC', 'OMC', 'CH', '4PC'].includes(norm)) {
    const isModified = ['5MC', 'OMC', 'CH', '4PC'].includes(norm);
    return { canonicalBase: isModified ? 'modified' : 'C', isModified, isPurine: false, isPyrimidine: true };
  }

  // Guanine
  if (['DG', 'G', 'GUA', 'dGMP', '2MG', '7MG', 'M2G', 'OMG', '1MG', '2MA', 'YYG', 'QUO'].includes(norm)) {
    const isModified = !['DG', 'G', 'GUA', 'dGMP'].includes(norm);
    return { canonicalBase: isModified ? 'modified' : 'G', isModified, isPurine: true, isPyrimidine: false };
  }

  // Thymine (DNA)
  if (['DT', 'T', 'THY', 'dTMP', '5MU'].includes(norm)) {
    const isModified = norm === '5MU';
    return { canonicalBase: isModified ? 'modified' : 'T', isModified, isPurine: false, isPyrimidine: true };
  }

  // Uracil (RNA)
  if (['U', 'RU', 'URA', 'PSU', 'H2U', '4SU', 'DHU', 'UR3', 'MNU', 'OMU'].includes(norm)) {
    const isModified = !['U', 'RU', 'URA'].includes(norm);
    return { canonicalBase: isModified ? 'modified' : 'U', isModified, isPurine: false, isPyrimidine: true };
  }

  // Inosine (wobble purine)
  if (['I', 'DI', '6MI'].includes(norm)) {
    return { canonicalBase: 'I', isModified: norm === '6MI', isPurine: true, isPyrimidine: false };
  }

  return { canonicalBase: 'unknown', isModified: false, isPurine: false, isPyrimidine: false };
}

/**
 * Checks whether a given residue is any recognized nucleic acid (canonical or modified).
 */
export function isNucleicResidue(resName: string): boolean {
  const norm = (resName || '').toUpperCase().trim();
  return (
    DNA_SPECIFIC_RESIDUES.has(norm) ||
    RNA_SPECIFIC_RESIDUES.has(norm) ||
    AMBIGUOUS_NUCLEIC_RESIDUES.has(norm) ||
    MODIFIED_NUCLEIC_RESIDUES.has(norm)
  );
}

/**
 * Checks whether a given residue is a DNA residue.
 */
export function isDnaResidue(resName: string): boolean {
  const norm = (resName || '').toUpperCase().trim();
  return DNA_SPECIFIC_RESIDUES.has(norm);
}

/**
 * Checks whether a given residue is an RNA residue.
 */
export function isRnaResidue(resName: string): boolean {
  const norm = (resName || '').toUpperCase().trim();
  return RNA_SPECIFIC_RESIDUES.has(norm);
}

/**
 * Checks whether a given residue is a non-canonical or chemically modified nucleotide.
 */
export function isModifiedNucleotide(resName: string): boolean {
  const norm = (resName || '').toUpperCase().trim();
  return MODIFIED_NUCLEIC_RESIDUES.has(norm);
}

/**
 * Separates nucleotide atoms into backbone atoms (phosphate + sugar) and base atoms.
 */
export function partitionNucleotideAtoms(atoms: ValidatedAtom[]): {
  backboneAtoms: ValidatedAtom[];
  baseAtoms: ValidatedAtom[];
} {
  const backboneAtoms: ValidatedAtom[] = [];
  const baseAtoms: ValidatedAtom[] = [];

  for (const atom of atoms) {
    const normName = normalizeNucleicAtomName(atom.atomName);
    if (NUCLEIC_BACKBONE_ATOMS.has(normName)) {
      backboneAtoms.push(atom);
    } else {
      baseAtoms.push(atom);
    }
  }

  return { backboneAtoms, baseAtoms };
}
