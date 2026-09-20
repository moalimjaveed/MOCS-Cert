/**
 * MOCS-Cert Protein Structural Biology — Sequence <-> Structure Mapping Engine
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: wwPDB mmCIF Entity Poly / Coordinate Mapping
 * 
 * Rigorously differentiates primary biological sequence from coordinate-observed sequence.
 * Never fabricates coordinates for unresolved or missing residues.
 */

import type { SequenceStructureMapping, StandardAminoAcid1Letter, StandardAminoAcid3Letter } from './types';
import { ONE_TO_THREE_LETTER_MAP, CANONICAL_AMINO_ACID_MAP } from './classifier';

export interface ResidueCoordinatePresence {
  chainId: string;
  resSeq: number;
  insCode?: string;
  resName: string;
  hasCoordinates: boolean;
  atomCount: number;
  hasAlphaCarbon: boolean;
  hasCompleteBackbone: boolean; // N, CA, C, O all present
}

/**
 * Maps primary sequence to coordinate-observed residues and identifies missing loops/termini.
 */
export function mapSequenceToCoordinates(
  chainId: string,
  primarySequence1Letter: string,
  startResSeq: number,
  observedResidues: Map<number, { resName: string; atomCount: number; hasCA: boolean; hasBackbone: boolean }>
): {
  mapping: SequenceStructureMapping;
  residuePresenceList: ResidueCoordinatePresence[];
  missingCount: number;
  observedCount: number;
} {
  const residuePresenceList: ResidueCoordinatePresence[] = [];
  const missingRanges: SequenceStructureMapping['missingRanges'] = [];

  let currentMissingStart: number | null = null;
  let missingCount = 0;
  let observedCount = 0;
  let observedSeq1Letter = '';

  const totalLength = primarySequence1Letter.length;

  for (let i = 0; i < totalLength; i++) {
    const resSeq = startResSeq + i;
    const char1 = primarySequence1Letter[i].toUpperCase() as StandardAminoAcid1Letter;
    const expectedResName = (ONE_TO_THREE_LETTER_MAP as Record<string, string>)[char1] || 'UNK';

    const obs = observedResidues.get(resSeq);

    if (obs && obs.atomCount > 0) {
      // Coordinate is present!
      observedCount++;
      observedSeq1Letter += char1;

      if (currentMissingStart !== null) {
        missingRanges.push({
          chainId,
          startResSeq: currentMissingStart,
          endResSeq: resSeq - 1,
          length: resSeq - currentMissingStart,
        });
        currentMissingStart = null;
      }

      residuePresenceList.push({
        chainId,
        resSeq,
        resName: obs.resName || expectedResName,
        hasCoordinates: true,
        atomCount: obs.atomCount,
        hasAlphaCarbon: obs.hasCA,
        hasCompleteBackbone: obs.hasBackbone,
      });
    } else {
      // Coordinate is MISSING!
      missingCount++;
      observedSeq1Letter += '-'; // Standard gap character

      if (currentMissingStart === null) {
        currentMissingStart = resSeq;
      }

      residuePresenceList.push({
        chainId,
        resSeq,
        resName: expectedResName,
        hasCoordinates: false,
        atomCount: 0,
        hasAlphaCarbon: false,
        hasCompleteBackbone: false,
      });
    }
  }

  if (currentMissingStart !== null) {
    missingRanges.push({
      chainId,
      startResSeq: currentMissingStart,
      endResSeq: startResSeq + totalLength - 1,
      length: startResSeq + totalLength - currentMissingStart,
    });
  }

  const mapping: SequenceStructureMapping = {
    primarySequence: primarySequence1Letter,
    observedSequence: observedSeq1Letter,
    totalPrimaryLength: totalLength,
    observedLength: observedCount,
    missingRanges,
  };

  return {
    mapping,
    residuePresenceList,
    missingCount,
    observedCount,
  };
}
