/**
 * Nucleic Acid Base-Pairing & Hydrogen-Bonding Forensic Engine
 * 
 * Epistemic Status: STRICT BIOPHYSICAL DISCRIMINATION
 * 
 * Enforces rigorous criteria:
 * 1. Distinguishes covalent backbone connectivity from non-covalent hydrogen bonding and base pairing.
 * 2. Watson-Crick Canonical Geometry:
 *    - A-T (DNA) / A-U (RNA): 2 hydrogen bonds (N1...N3, N6...O4)
 *    - G-C: 3 hydrogen bonds (O6...N4, N1...N3, N2...O2)
 * 3. Never labels two arbitrary atoms as a base pair merely due to Euclidean proximity (< 4 Å).
 *    Requires matching biochemical donor-acceptor atom pairs.
 * 4. Honest handling of unmodeled hydrogens in crystallographic structures:
 *    - Explicitly marks whether proton positions are experimentally measured.
 *    - Heavy-atom donor-acceptor distances are evaluated against biophysical bounds [2.5, 3.4] Å.
 */

import { calculateEuclideanDistance } from '../measurements';
import { normalizeNucleicAtomName, classifyNucleotideBase } from './classifier';
import type { NucleotideRecord, BasePairInteraction } from './types';

export interface HeavyAtomHydrogenBond {
  donorAtom: string;
  acceptorAtom: string;
  distance: number;
  donorCoords: [number, number, number];
  acceptorCoords: [number, number, number];
  isValidHeavyAtomDistance: boolean;
}

export interface DetailedBasePairResult {
  pair: BasePairInteraction;
  heavyAtomHBonds: HeavyAtomHydrogenBond[];
  experimentalHydrogensPresent: boolean;
  angularCheckSupported: boolean;
  unsupportedReason?: string;
}

// Canonical Watson-Crick heavy-atom donor-acceptor definitions
// Distances in high-resolution crystals typically lie in 2.6 - 3.2 Å
export const MIN_HEAVY_ATOM_HBOND_DIST = 2.50;
export const MAX_HEAVY_ATOM_HBOND_DIST = 3.40;

interface PairDefinition {
  base1: string;
  base2: string;
  donorAcceptorPairs: Array<[string, string]>; // [atomFromBase1, atomFromBase2]
  isWatsonCrick: boolean;
}

const CANONICAL_WC_PAIRS: PairDefinition[] = [
  // A - T (DNA)
  {
    base1: 'A',
    base2: 'T',
    donorAcceptorPairs: [
      ['N1', 'N3'], // Acceptor N1(A) ... Donor N3-H(T)
      ['N6', 'O4'], // Donor N6-H(A) ... Acceptor O4(T)
    ],
    isWatsonCrick: true,
  },
  // T - A (DNA)
  {
    base1: 'T',
    base2: 'A',
    donorAcceptorPairs: [
      ['N3', 'N1'],
      ['O4', 'N6'],
    ],
    isWatsonCrick: true,
  },
  // A - U (RNA)
  {
    base1: 'A',
    base2: 'U',
    donorAcceptorPairs: [
      ['N1', 'N3'],
      ['N6', 'O4'],
    ],
    isWatsonCrick: true,
  },
  // U - A (RNA)
  {
    base1: 'U',
    base2: 'A',
    donorAcceptorPairs: [
      ['N3', 'N1'],
      ['O4', 'N6'],
    ],
    isWatsonCrick: true,
  },
  // G - C (DNA/RNA)
  {
    base1: 'G',
    base2: 'C',
    donorAcceptorPairs: [
      ['O6', 'N4'], // Acceptor O6(G) ... Donor N4-H(C)
      ['N1', 'N3'], // Donor N1-H(G) ... Acceptor N3(C)
      ['N2', 'O2'], // Donor N2-H(G) ... Acceptor O2(C)
    ],
    isWatsonCrick: true,
  },
  // C - G (DNA/RNA)
  {
    base1: 'C',
    base2: 'G',
    donorAcceptorPairs: [
      ['N4', 'O6'],
      ['N3', 'N1'],
      ['O2', 'N2'],
    ],
    isWatsonCrick: true,
  },
  // G - U (RNA Wobble)
  {
    base1: 'G',
    base2: 'U',
    donorAcceptorPairs: [
      ['N1', 'O2'],
      ['O6', 'N3'],
    ],
    isWatsonCrick: false,
  },
  // U - G (RNA Wobble)
  {
    base1: 'U',
    base2: 'G',
    donorAcceptorPairs: [
      ['O2', 'N1'],
      ['N3', 'O6'],
    ],
    isWatsonCrick: false,
  },
];

/**
 * Evaluates whether two nucleotides form a scientifically valid base pair.
 * Requires complementary donor-acceptor heavy atom pairs within biophysical distance tolerance [2.5, 3.4] Å.
 */
export function evaluateBasePair(
  nuc1: NucleotideRecord,
  nuc2: NucleotideRecord
): DetailedBasePairResult | null {
  // Base pairing requires distinct strands or distant sequence positions (in RNA hairpins)
  if (nuc1.chainId === nuc2.chainId && Math.abs(nuc1.residueNumber - nuc2.residueNumber) < 3) {
    return null; // Nearby nucleotides in same strand are stacked or covalently adjacent, NOT base-paired
  }

  const baseInfo1 = classifyNucleotideBase(nuc1.residueName);
  const baseInfo2 = classifyNucleotideBase(nuc2.residueName);

  const b1 = baseInfo1.canonicalBase;
  const b2 = baseInfo2.canonicalBase;

  const pairDef = CANONICAL_WC_PAIRS.find(
    (p) => p.base1 === b1 && p.base2 === b2
  );

  if (!pairDef) {
    return null; // Not a recognized complementary base combination
  }

  // Check if experimental hydrogen atoms exist
  const hasH1 = nuc1.atoms.some((a) => a.element.toUpperCase() === 'H');
  const hasH2 = nuc2.atoms.some((a) => a.element.toUpperCase() === 'H');
  const experimentalHydrogensPresent = hasH1 || hasH2;

  const heavyHBonds: HeavyAtomHydrogenBond[] = [];

  for (const [targetAtom1, targetAtom2] of pairDef.donorAcceptorPairs) {
    const a1 = nuc1.atoms.find(
      (a) => normalizeNucleicAtomName(a.atomName) === targetAtom1
    );
    const a2 = nuc2.atoms.find(
      (a) => normalizeNucleicAtomName(a.atomName) === targetAtom2
    );

    if (a1 && a2) {
      const d = calculateEuclideanDistance(a1.coordinates, a2.coordinates);
      const isValid = d >= MIN_HEAVY_ATOM_HBOND_DIST && d <= MAX_HEAVY_ATOM_HBOND_DIST;
      if (isValid) {
        heavyHBonds.push({
          donorAtom: `${nuc1.chainId}:${nuc1.residueNumber}:${targetAtom1}`,
          acceptorAtom: `${nuc2.chainId}:${nuc2.residueNumber}:${targetAtom2}`,
          distance: Number(d.toFixed(2)),
          donorCoords: a1.coordinates,
          acceptorCoords: a2.coordinates,
          isValidHeavyAtomDistance: true,
        });
      }
    }
  }

  // Base pair requires at least 2 valid heavy-atom hydrogen bonds (or 1 for non-canonical candidate)
  const minRequiredBonds = pairDef.isWatsonCrick ? 2 : 1;
  if (heavyHBonds.length < minRequiredBonds) {
    return null;
  }

  const avgDist =
    heavyHBonds.reduce((sum, b) => sum + b.distance, 0) / heavyHBonds.length;

  const pairType = pairDef.isWatsonCrick
    ? 'Watson-Crick'
    : (b1 === 'G' && b2 === 'U') || (b1 === 'U' && b2 === 'G')
    ? 'Wobble'
    : 'candidate';

  const pair: BasePairInteraction = {
    strand1ChainId: nuc1.chainId,
    resSeq1: nuc1.residueNumber,
    base1: b1,
    strand2ChainId: nuc2.chainId,
    resSeq2: nuc2.residueNumber,
    base2: b2,
    pairType,
    hBondCount: heavyHBonds.length,
    geometryDistance: Number(avgDist.toFixed(2)),
    isStandardPair: pairDef.isWatsonCrick,
  };

  return {
    pair,
    heavyAtomHBonds: heavyHBonds,
    experimentalHydrogensPresent,
    angularCheckSupported: experimentalHydrogensPresent,
    unsupportedReason: experimentalHydrogensPresent
      ? undefined
      : 'Angular donor-hydrogen-acceptor verification unsupported because experimental hydrogen coordinates are absent in crystallographic model',
  };
}

/**
 * Scans all cross-strand nucleotide combinations to identify authentic complementary base pairs.
 */
export function identifyDuplexBasePairs(
  strand1Nucleotides: NucleotideRecord[],
  strand2Nucleotides: NucleotideRecord[]
): DetailedBasePairResult[] {
  const results: DetailedBasePairResult[] = [];

  for (const n1 of strand1Nucleotides) {
    for (const n2 of strand2Nucleotides) {
      const bp = evaluateBasePair(n1, n2);
      if (bp) {
        results.push(bp);
      }
    }
  }

  return results;
}
