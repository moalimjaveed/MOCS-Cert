/**
 * Protein Sequence Validator & Sequence-Structure Correspondence Auditor
 * 
 * Strict forensic validation of:
 * - IUPAC standard 20 amino acid character integrity
 * - Non-standard code rejection with exact position reporting
 * - FASTA header separation and whitespace sanitization
 * - 1-to-1 sequence-to-structure residue correspondence
 */

import type { PlddtResidueScore } from './types';

export const IUPAC_STANDARD_20_AA = new Set([
  'A', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L',
  'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'V', 'W', 'Y',
]);

export const STANDARD_AA_NAMES: Record<string, string> = {
  A: 'ALA', C: 'CYS', D: 'ASP', E: 'GLU', F: 'PHE',
  G: 'GLY', H: 'HIS', I: 'ILE', K: 'LYS', L: 'LEU',
  M: 'MET', N: 'ASN', P: 'PRO', Q: 'GLN', R: 'ARG',
  S: 'SER', T: 'THR', V: 'VAL', W: 'TRP', Y: 'TYR',
};

export interface CleanSequenceOptions {
  minLength?: number;
  maxLength?: number;
  allowFastaHeader?: boolean;
}

export interface CleanSequenceResult {
  cleanSequence: string;
  header?: string;
  residueCount: number;
}

/**
 * Validates and sanitizes a raw protein sequence string.
 * Enforces IUPAC standard 20 amino acids; rejects ambiguous / non-standard codes
 * (B, Z, J, X, U, O, numbers, special characters) with detailed diagnostic feedback.
 */
export function cleanAndValidateProteinSequence(
  rawInput: string,
  options: CleanSequenceOptions = {}
): CleanSequenceResult {
  const { minLength = 5, maxLength = 2000, allowFastaHeader = true } = options;

  if (!rawInput || typeof rawInput !== 'string' || rawInput.trim().length === 0) {
    throw new Error('Protein sequence is empty.');
  }

  let text = rawInput.trim();
  let header: string | undefined;

  // Extract FASTA header if present
  if (text.startsWith('>')) {
    if (!allowFastaHeader) {
      throw new Error('FASTA headers are not permitted in raw sequence mode.');
    }
    const newlineIdx = text.indexOf('\n');
    if (newlineIdx === -1) {
      throw new Error('Invalid FASTA format: Header line without sequence content.');
    }
    header = text.slice(1, newlineIdx).trim();
    text = text.slice(newlineIdx + 1);
  }

  // Strip whitespace, tabs, carriage returns, newlines
  const stripped = text.replace(/[\s\r\n\t]/g, '');

  if (stripped.length === 0) {
    throw new Error('Protein sequence content is empty.');
  }

  // Search for invalid characters with exact positions
  const invalidOccurrences: Array<{ char: string; position: number }> = [];
  const cleanChars: string[] = [];

  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i].toUpperCase();
    if (IUPAC_STANDARD_20_AA.has(ch)) {
      cleanChars.push(ch);
    } else {
      invalidOccurrences.push({ char: stripped[i], position: i + 1 });
    }
  }

  if (invalidOccurrences.length > 0) {
    const summary = invalidOccurrences
      .slice(0, 5)
      .map((item) => `'${item.char}' at position ${item.position}`)
      .join(', ');
    const moreCount = invalidOccurrences.length > 5 ? ` (+${invalidOccurrences.length - 5} more)` : '';
    throw new Error(
      `Sequence contains invalid amino acid characters: ${summary}${moreCount}. Standard 20 IUPAC amino acids required.`
    );
  }

  const cleanSequence = cleanChars.join('');

  if (cleanSequence.length < minLength) {
    throw new Error(
      `Sequence too short (${cleanSequence.length} aa). Minimum required length is ${minLength} amino acids.`
    );
  }

  if (cleanSequence.length > maxLength) {
    throw new Error(
      `Sequence exceeds maximum permitted length of ${maxLength} amino acids (received ${cleanSequence.length} aa).`
    );
  }

  return {
    cleanSequence,
    header,
    residueCount: cleanSequence.length,
  };
}

export interface CorrespondenceMismatch {
  index: number;
  sequenceResidue: string;
  structureResidueName: string;
  structureResidueLetter: string;
  residueNumber: number;
}

export interface SequenceStructureCorrespondence {
  matches: boolean;
  sequenceLength: number;
  structureResidueCount: number;
  mismatches: CorrespondenceMismatch[];
  diagnosticMessage: string;
}

/**
 * Audits 1-to-1 correspondence between input sequence and extracted structure residues.
 * Catches dropped residues, coordinate truncation, or sequence swaps.
 */
export function validateSequenceStructureCorrespondence(
  sequence: string,
  residueScores: PlddtResidueScore[]
): SequenceStructureCorrespondence {
  const sequenceLength = sequence.length;
  const structureResidueCount = residueScores.length;
  const mismatches: CorrespondenceMismatch[] = [];

  if (sequenceLength !== structureResidueCount) {
    return {
      matches: false,
      sequenceLength,
      structureResidueCount,
      mismatches: [],
      diagnosticMessage: `Length mismatch: Input sequence has ${sequenceLength} residues, but structure model contains ${structureResidueCount} residues.`,
    };
  }

  for (let i = 0; i < sequenceLength; i++) {
    const seqChar = sequence[i].toUpperCase();
    const structScore = residueScores[i];
    const structChar = structScore.singleLetterCode;

    if (seqChar !== structChar) {
      mismatches.push({
        index: i,
        sequenceResidue: seqChar,
        structureResidueName: structScore.residueName,
        structureResidueLetter: structChar,
        residueNumber: structScore.residueNumber,
      });
    }
  }

  const matches = mismatches.length === 0;
  const diagnosticMessage = matches
    ? `Verified exact 1-to-1 sequence-structure correspondence for all ${sequenceLength} residues.`
    : `Encountered ${mismatches.length} residue identity mismatches between input sequence and structural model.`;

  return {
    matches,
    sequenceLength,
    structureResidueCount,
    mismatches,
    diagnosticMessage,
  };
}
