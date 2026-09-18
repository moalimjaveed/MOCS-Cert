/**
 * MOCS-Cert Molecular Sequence & Annotation Subsystem — Nucleic Acid Sequence Engine
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: IUPAC-IUBMB Nucleic Acid Nomenclature, wwPDB CCD
 * 
 * Enforces:
 * 1. 5' to 3' biological strand directionality.
 * 2. Strand independence (Strand A and Strand B of 1BNA remain distinct).
 * 3. Accurate classification of deoxyribonucleotides, ribonucleotides, and modified bases.
 */

import { MODIFIED_RESIDUE_PARENTS } from './residueIdentity';

export const DEOXYRIBONUCLEOTIDES = new Set(['DA', 'DC', 'DG', 'DT', 'DI']);
export const RIBONUCLEOTIDES = new Set(['A', 'C', 'G', 'U', 'I']);

export const NUCLEIC_1_LETTER_MAP: Record<string, string> = {
  'DA': 'A',
  'DC': 'C',
  'DG': 'G',
  'DT': 'T',
  'DI': 'I',
  'A': 'A',
  'C': 'C',
  'G': 'G',
  'U': 'U',
  'I': 'I',
};

const COMPLEMENT_MAP_DNA: Record<string, string> = {
  'A': 'T',
  'T': 'A',
  'C': 'G',
  'G': 'C',
  'I': 'C',
  'N': 'N',
};

const COMPLEMENT_MAP_RNA: Record<string, string> = {
  'A': 'U',
  'U': 'A',
  'C': 'G',
  'G': 'C',
  'I': 'C',
  'N': 'N',
};

/**
 * Checks if a residue name corresponds to a standard deoxyribonucleotide.
 */
export function isDeoxyribonucleotide(resName: string): boolean {
  return DEOXYRIBONUCLEOTIDES.has(resName.trim().toUpperCase());
}

/**
 * Checks if a residue name corresponds to a standard ribonucleotide.
 */
export function isRibonucleotide(resName: string): boolean {
  return RIBONUCLEOTIDES.has(resName.trim().toUpperCase());
}

/**
 * Checks if a residue name is any nucleic acid (DNA, RNA, or modified).
 */
export function isNucleicAcid(resName: string): boolean {
  const norm = resName.trim().toUpperCase();
  if (DEOXYRIBONUCLEOTIDES.has(norm) || RIBONUCLEOTIDES.has(norm)) {
    return true;
  }
  const mod = MODIFIED_RESIDUE_PARENTS[norm];
  if (mod && (DEOXYRIBONUCLEOTIDES.has(mod.parent) || RIBONUCLEOTIDES.has(mod.parent))) {
    return true;
  }
  return false;
}

/**
 * Converts a nucleic residue name to its 1-letter uppercase base code.
 */
export function getNucleic1LetterCode(resName: string): string {
  const norm = resName.trim().toUpperCase();
  if (NUCLEIC_1_LETTER_MAP[norm]) {
    return NUCLEIC_1_LETTER_MAP[norm];
  }
  const mod = MODIFIED_RESIDUE_PARENTS[norm];
  if (mod) {
    return mod.code1;
  }
  return 'N';
}

/**
 * Returns the Watson-Crick complementary base for a single nucleotide.
 */
export function getWatsonCrickComplement(base1Letter: string, isRNA = false): string {
  const norm = base1Letter.trim().toUpperCase();
  const map = isRNA ? COMPLEMENT_MAP_RNA : COMPLEMENT_MAP_DNA;
  return map[norm] || 'N';
}

/**
 * Generates the reverse complement of a 5' to 3' nucleic acid sequence.
 * Output is also in 5' to 3' direction along the antiparallel strand.
 */
export function generateReverseComplement(sequence5to3: string, isRNA = false): string {
  const clean = sequence5to3.replace(/\s+/g, '').toUpperCase();
  const complementArray: string[] = [];

  // Iterate backwards (3' to 5') and complement to yield 5' to 3' antiparallel sequence
  for (let i = clean.length - 1; i >= 0; i--) {
    complementArray.push(getWatsonCrickComplement(clean[i], isRNA));
  }

  return complementArray.join('');
}

/**
 * Validates a nucleic acid sequence string.
 */
export function validateNucleicSequence(
  sequence: string,
  mode: 'DNA' | 'RNA' | 'ANY' = 'ANY'
): { isValid: boolean; normalizedSequence: string; error?: string } {
  const clean = sequence.replace(/\s+/g, '').toUpperCase();
  if (clean.length === 0) {
    return { isValid: false, normalizedSequence: '', error: 'Nucleic sequence cannot be empty.' };
  }

  const validDNA = /^[ACGTN]+$/;
  const validRNA = /^[ACGUN]+$/;
  const validAny = /^[ACGTUIN]+$/;

  if (mode === 'DNA' && !validDNA.test(clean)) {
    return { isValid: false, normalizedSequence: clean, error: 'Sequence contains non-DNA characters (expected A, C, G, T).' };
  }
  if (mode === 'RNA' && !validRNA.test(clean)) {
    return { isValid: false, normalizedSequence: clean, error: 'Sequence contains non-RNA characters (expected A, C, G, U).' };
  }
  if (mode === 'ANY' && !validAny.test(clean)) {
    return { isValid: false, normalizedSequence: clean, error: 'Sequence contains invalid nucleic acid characters.' };
  }

  return { isValid: true, normalizedSequence: clean };
}
