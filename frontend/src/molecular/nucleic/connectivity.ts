/**
 * Nucleic Acid Covalent Backbone Connectivity Engine
 * 
 * Enforces genuine chemical connectivity:
 * - Phosphodiester bonds join O3' of nucleotide (i) to P of nucleotide (i+1).
 * - Authentic covalent bond length ~1.60 Å (acceptance window: [1.3, 1.9] Å).
 * - Identifies true chain termination (5' OH vs 5' PO4; 3' OH) without fabricating missing atoms.
 * - Detects structural gaps in experimental crystallographic/cryo-EM densities without inventing false connections.
 * - Strictly prevents creating covalent links between different strands or non-adjacent sequence slots.
 */

import { calculateEuclideanDistance } from '../measurements';
import { normalizeNucleicAtomName } from './classifier';
import type { NucleotideRecord, PhosphodiesterBond } from './types';

export const CANONICAL_PHOSPHODIESTER_LENGTH_ANGSTROMS = 1.60;
export const MIN_COVALENT_P_O3_DISTANCE = 1.30;
export const MAX_COVALENT_P_O3_DISTANCE = 1.90;

/**
 * Traces phosphodiester backbone connectivity along an ordered array of nucleotides.
 * Evaluates the real Euclidean distance between O3' of nucleotide (i) and P of nucleotide (i+1).
 */
export function tracePhosphodiesterBackbone(
  nucleotides: NucleotideRecord[]
): PhosphodiesterBond[] {
  const bonds: PhosphodiesterBond[] = [];
  if (!nucleotides || nucleotides.length < 2) return bonds;

  // Sort by sequence number if not already sorted
  const sorted = [...nucleotides].sort((a, b) => a.residueNumber - b.residueNumber);

  for (let i = 0; i < sorted.length - 1; i++) {
    const upstream = sorted[i];
    const downstream = sorted[i + 1];

    // Strictly enforce same chain
    if (upstream.chainId !== downstream.chainId) {
      continue;
    }

    // Strictly enforce consecutive residue numbering
    if (downstream.residueNumber !== upstream.residueNumber + 1) {
      // Sequence gap detected: do NOT invent a bond!
      continue;
    }

    // Find O3' in upstream nucleotide
    const o3Atom = upstream.atoms.find((a) => normalizeNucleicAtomName(a.atomName) === "O3'");
    // Find P in downstream nucleotide
    const pAtom = downstream.atoms.find((a) => normalizeNucleicAtomName(a.atomName) === 'P');

    if (!o3Atom || !pAtom) {
      // Missing required coordinate: cannot form a verified covalent bond
      continue;
    }

    const dist = calculateEuclideanDistance(o3Atom.coordinates, pAtom.coordinates);
    const isValidCovalent =
      dist >= MIN_COVALENT_P_O3_DISTANCE && dist <= MAX_COVALENT_P_O3_DISTANCE;

    bonds.push({
      upstreamNucleotideId: `${upstream.chainId}:${upstream.residueName}:${upstream.residueNumber}`,
      downstreamNucleotideId: `${downstream.chainId}:${downstream.residueName}:${downstream.residueNumber}`,
      o3AtomCoords: o3Atom.coordinates,
      pAtomCoords: pAtom.coordinates,
      distance: Number(dist.toFixed(3)),
      isValidCovalent,
    });
  }

  return bonds;
}

/**
 * Validates the physical continuity of a nucleic acid strand.
 * Identifies any gaps where distance exceeds the covalent bond tolerance.
 */
export function validateBackboneContinuity(
  nucleotides: NucleotideRecord[]
): {
  isContinuous: boolean;
  totalBonds: number;
  validBonds: number;
  gaps: Array<{
    upstreamRes: number;
    downstreamRes: number;
    distance: number | null;
    reason: string;
  }>;
} {
  const bonds = tracePhosphodiesterBackbone(nucleotides);
  const gaps: Array<{
    upstreamRes: number;
    downstreamRes: number;
    distance: number | null;
    reason: string;
  }> = [];

  const sorted = [...nucleotides].sort((a, b) => a.residueNumber - b.residueNumber);

  for (let i = 0; i < sorted.length - 1; i++) {
    const u = sorted[i];
    const d = sorted[i + 1];

    if (d.residueNumber !== u.residueNumber + 1) {
      gaps.push({
        upstreamRes: u.residueNumber,
        downstreamRes: d.residueNumber,
        distance: null,
        reason: `Sequence gap of ${d.residueNumber - u.residueNumber - 1} unobserved residues`,
      });
      continue;
    }

    const matchingBond = bonds.find(
      (b) =>
        b.upstreamNucleotideId.endsWith(`:${u.residueNumber}`) &&
        b.downstreamNucleotideId.endsWith(`:${d.residueNumber}`)
    );

    if (!matchingBond) {
      gaps.push({
        upstreamRes: u.residueNumber,
        downstreamRes: d.residueNumber,
        distance: null,
        reason: 'Missing O3\' or P atomic coordinates in density',
      });
    } else if (!matchingBond.isValidCovalent) {
      gaps.push({
        upstreamRes: u.residueNumber,
        downstreamRes: d.residueNumber,
        distance: matchingBond.distance,
        reason: `Distance ${matchingBond.distance} Å exceeds covalent tolerance [${MIN_COVALENT_P_O3_DISTANCE}, ${MAX_COVALENT_P_O3_DISTANCE}] Å`,
      });
    }
  }

  const validBonds = bonds.filter((b) => b.isValidCovalent).length;
  const isContinuous = gaps.length === 0 && validBonds === sorted.length - 1;

  return {
    isContinuous,
    totalBonds: bonds.length,
    validBonds,
    gaps,
  };
}
