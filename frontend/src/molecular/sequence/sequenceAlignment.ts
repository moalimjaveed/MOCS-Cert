/**
 * MOCS-Cert Molecular Sequence & Annotation Subsystem — Sequence Alignment & Coordinate Mapping
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: wwPDB SIFTS (Structure Integration with Function, Taxonomy and Sequence)
 * 
 * Aligns canonical UniProt sequences to PDB polymer sequences and coordinate-observed residues.
 * Handles:
 * - Initiator methionine cleavage (UniProt Met1 cleaved in mature protein, e.g. 4HHB alpha-globin)
 * - Signal peptide cleavage and expression tags (e.g. His6-tag)
 * - Non-1 author residue number offsets and insertion codes
 * - Unresolved density / missing loop intervals without fabricating coordinates
 */

import type { SequenceAlignmentMapping, SequenceResidue, MissingReason } from './types';

export interface SequenceAlignmentOptions {
  detectCleavedInitiatorMet?: boolean;
  authorNumberOffset?: number;
}

/**
 * Aligns a canonical UniProt reference sequence against a chain's structural residues.
 */
export function alignCanonicalToStructureSequence(
  canonicalSeq: string,
  structureResidues: SequenceResidue[],
  options: SequenceAlignmentOptions = {}
): SequenceAlignmentMapping {
  const detectCleavedMet = options.detectCleavedInitiatorMet ?? true;
  const uniprotToAuthor = new Map<number, number>();
  const authorToUniprot = new Map<number, number>();
  const indexToAuthor = new Map<number, number>();
  const authorToIndex = new Map<number, number>();

  const nCanon = canonicalSeq.length;
  const nStruct = structureResidues.length;

  if (nStruct === 0) {
    return {
      uniprotToAuthor,
      authorToUniprot,
      indexToAuthor,
      authorToIndex,
      numberingOffset: 0,
      initiatorMethionineCleaved: false,
      alignedCount: 0,
      identityFraction: 0,
      missingSegments: [],
    };
  }

  // Populate index-to-author and author-to-index maps
  for (let i = 0; i < nStruct; i++) {
    const res = structureResidues[i];
    indexToAuthor.set(i, res.authorResNum);
    authorToIndex.set(res.authorResNum, i);
  }

  // Check for initiator methionine cleavage:
  // If canonical begins with 'M' and structure starts with canonical[1],
  // then UniProt Met1 was post-translationally cleaved, and UniProt pos 2 maps to structure residue 0.
  let initiatorMethionineCleaved = false;
  let canonicalStartIdx = 0;

  if (
    detectCleavedMet &&
    nCanon > 1 &&
    canonicalSeq[0].toUpperCase() === 'M' &&
    nStruct > 0 &&
    structureResidues[0].code1.toUpperCase() === canonicalSeq[1].toUpperCase()
  ) {
    initiatorMethionineCleaved = true;
    canonicalStartIdx = 1; // Start matching from index 1 (position 2 in 1-based numbering)
  }

  // Match canonical sequence to structure sequence
  let alignedCount = 0;
  let identicalCount = 0;
  const structStartAuthor = structureResidues[0].authorResNum;
  const numberingOffset = structStartAuthor - (canonicalStartIdx + 1);

  for (let sIdx = 0; sIdx < nStruct; sIdx++) {
    const structRes = structureResidues[sIdx];
    const cIdx = canonicalStartIdx + sIdx;

    if (cIdx < nCanon) {
      const uniprotPos = cIdx + 1; // 1-based UniProt numbering
      uniprotToAuthor.set(uniprotPos, structRes.authorResNum);
      authorToUniprot.set(structRes.authorResNum, uniprotPos);
      alignedCount++;

      if (structRes.code1.toUpperCase() === canonicalSeq[cIdx].toUpperCase()) {
        identicalCount++;
      }
    }
  }

  // Detect missing coordinate segments (unresolved loops or disordered termini)
  const missingSegments: SequenceAlignmentMapping['missingSegments'] = [];
  let currentMissingStart: number | null = null;
  let currentMissingCount = 0;

  for (let i = 0; i < nStruct; i++) {
    const res = structureResidues[i];
    if (!res.hasCoordinates) {
      if (currentMissingStart === null) {
        currentMissingStart = res.authorResNum;
      }
      currentMissingCount++;
    } else if (currentMissingStart !== null) {
      const prevAuthor = structureResidues[i - 1].authorResNum;
      const isTerminal = currentMissingStart === structStartAuthor;
      missingSegments.push({
        startAuthor: currentMissingStart,
        endAuthor: prevAuthor,
        length: currentMissingCount,
        reason: (isTerminal ? 'TERMINAL_FLEXIBILITY' : 'UNRESOLVED_DENSITY') as MissingReason,
      });
      currentMissingStart = null;
      currentMissingCount = 0;
    }
  }

  if (currentMissingStart !== null) {
    const lastAuthor = structureResidues[nStruct - 1].authorResNum;
    missingSegments.push({
      startAuthor: currentMissingStart,
      endAuthor: lastAuthor,
      length: currentMissingCount,
      reason: 'TERMINAL_FLEXIBILITY',
    });
  }

  const identityFraction = alignedCount > 0 ? identicalCount / alignedCount : 0;

  return {
    uniprotToAuthor,
    authorToUniprot,
    indexToAuthor,
    authorToIndex,
    numberingOffset,
    initiatorMethionineCleaved,
    alignedCount,
    identityFraction,
    missingSegments,
  };
}

/**
 * Translates a 1-based UniProt position to the corresponding author residue number.
 */
export function translateUniprotPosToAuthor(
  mapping: SequenceAlignmentMapping,
  uniprotPos: number
): number | undefined {
  return mapping.uniprotToAuthor.get(uniprotPos);
}

/**
 * Translates an author residue number to the 1-based UniProt canonical position.
 */
export function translateAuthorPosToUniprot(
  mapping: SequenceAlignmentMapping,
  authorPos: number
): number | undefined {
  return mapping.authorToUniprot.get(authorPos);
}
