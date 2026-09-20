/**
 * Atomic B-Factor & Occupancy Forensic Analyzer
 * 
 * Epistemic Mandates:
 * 1. An isotropic B-factor (temperature factor) is an Atomic Displacement Parameter (ADP),
 *    B = 8 * pi^2 * <u^2>. It represents the sum of harmonic thermal vibrations, static
 *    crystal lattice disorder, and coordinate fitting error. It is NOT simply "biological flexibility".
 * 2. Occupancy represents the spatial fraction of unit cells containing the atom in that state.
 *    It is NOT algorithmic confidence or probability of correctness.
 */

import type { BfactorDistribution, OccupancyDistribution } from './types';

export interface QualityAtomRecord {
  bFactor?: number | null;
  occupancy?: number | null;
  altLoc?: string | null;
  atomName?: string | null;
  name?: string | null;
  resName?: string | null;
  element?: string | null;
  isBackbone?: boolean;
}

/**
 * Evaluates the statistical distribution and scientific meaning of atomic B-factors.
 */
export function analyzeBfactorDistribution(
  atoms: QualityAtomRecord[]
): BfactorDistribution {
  if (!atoms || atoms.length === 0) {
    return {
      meanBfactor: 0,
      medianBfactor: 0,
      minBfactor: 0,
      maxBfactor: 0,
      backboneBfactor: null,
      sidechainBfactor: null,
      atomCount: 0,
      interpretation: 'No atomic records evaluated.',
    };
  }

  const validB: number[] = [];
  const backboneB: number[] = [];
  const sidechainB: number[] = [];
  let negativeCount = 0;

  for (const a of atoms) {
    if (typeof a.bFactor === 'number' && Number.isFinite(a.bFactor)) {
      if (a.bFactor < 0) {
        negativeCount++;
        continue;
      }
      validB.push(a.bFactor);
      const name = (a.name || a.atomName || '').toUpperCase().trim();
      const isBb = a.isBackbone !== undefined
        ? a.isBackbone
        : ['N', 'CA', 'C', 'O', 'OXT'].includes(name);

      if (isBb) {
        backboneB.push(a.bFactor);
      } else {
        sidechainB.push(a.bFactor);
      }
    }
  }

  if (validB.length === 0) {
    return {
      meanBfactor: 0,
      medianBfactor: 0,
      minBfactor: 0,
      maxBfactor: 0,
      backboneBfactor: null,
      sidechainBfactor: null,
      atomCount: 0,
      interpretation: negativeCount > 0
        ? `Negative B-factors detected (${negativeCount} atom(s)); no valid non-negative B-factors found in coordinate records.`
        : 'No valid non-negative B-factors found in coordinate records.',
    };
  }

  validB.sort((a, b) => a - b);
  const n = validB.length;
  const sumB = validB.reduce((acc, val) => acc + val, 0);
  const meanB = sumB / n;

  const medianB = n % 2 === 1
    ? validB[Math.floor(n / 2)]
    : (validB[n / 2 - 1] + validB[n / 2]) / 2;

  const bbMean = backboneB.length > 0
    ? Number((backboneB.reduce((acc, v) => acc + v, 0) / backboneB.length).toFixed(2))
    : null;

  const scMean = sidechainB.length > 0
    ? Number((sidechainB.reduce((acc, v) => acc + v, 0) / sidechainB.length).toFixed(2))
    : null;

  let interpretation =
    'Isotropic B-factors are Atomic Displacement Parameters (ADPs) quantifying total mean-square displacement B = 8*pi^2*<u^2> (including thermal motion, lattice disorder, and refinement error). High B does not automatically denote biological flexibility.';
  if (negativeCount > 0) {
    interpretation += ` Negative B-factors detected (${negativeCount} atom(s)); unphysical in harmonic thermal displacement models.`;
  }

  return {
    meanBfactor: Number(meanB.toFixed(2)),
    medianBfactor: Number(medianB.toFixed(2)),
    minBfactor: Number(validB[0].toFixed(2)),
    maxBfactor: Number(validB[n - 1].toFixed(2)),
    backboneBfactor: bbMean,
    sidechainBfactor: scMean,
    atomCount: n,
    interpretation,
  };
}

/**
 * Evaluates atomic occupancies and identifies alternate location states.
 */
export function analyzeOccupancyDistribution(
  atoms: QualityAtomRecord[]
): OccupancyDistribution {
  if (!atoms || atoms.length === 0) {
    return {
      meanOccupancy: 1.0,
      minOccupancy: 1.0,
      maxOccupancy: 1.0,
      fullOccupancyCount: 0,
      partialOccupancyCount: 0,
      zeroOccupancyCount: 0,
      hasAlternateConformations: false,
      altLocIdentifiers: [],
    };
  }

  const validOcc: number[] = [];
  const altLocs = new Set<string>();
  let fullCount = 0;
  let partialCount = 0;
  let zeroCount = 0;

  for (const a of atoms) {
    let occ = typeof a.occupancy === 'number' && Number.isFinite(a.occupancy) ? a.occupancy : 1.0;
    occ = Math.max(0, Math.min(1.0, occ));
    validOcc.push(occ);

    if (occ >= 0.999) {
      fullCount++;
    } else if (occ > 0.001) {
      partialCount++;
    } else {
      zeroCount++;
    }

    if (a.altLoc && a.altLoc.trim() !== '' && a.altLoc.trim() !== '.') {
      altLocs.add(a.altLoc.trim());
    }
  }

  const n = validOcc.length;
  const sumOcc = validOcc.reduce((acc, v) => acc + v, 0);
  const meanOcc = sumOcc / n;
  const minOcc = Math.min(...validOcc);
  const maxOcc = Math.max(...validOcc);

  return {
    meanOccupancy: Number(meanOcc.toFixed(3)),
    minOccupancy: Number(minOcc.toFixed(3)),
    maxOccupancy: Number(maxOcc.toFixed(3)),
    fullOccupancyCount: fullCount,
    partialOccupancyCount: partialCount,
    zeroOccupancyCount: zeroCount,
    hasAlternateConformations: altLocs.size > 0 || partialCount > 0,
    altLocIdentifiers: Array.from(altLocs).sort(),
  };
}
