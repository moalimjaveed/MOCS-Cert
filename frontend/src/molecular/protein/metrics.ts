/**
 * MOCS-Cert Protein Structural Biology — Structural Metrics Engine
 * 
 * Epistemic Status: ESTABLISHED
 * Mathematical Definitions: IUPAC & Standard Biophysical Definitions
 */

import { calculateEuclideanDistance } from '../measurements/calculations';
import type { ProteinStructuralMetrics } from './types';

const ATOMIC_MASSES: Record<string, number> = {
  H: 1.008,
  C: 12.011,
  N: 14.007,
  O: 15.999,
  S: 32.065,
  P: 30.974,
  FE: 55.845,
  ZN: 65.38,
  MG: 24.305,
  CA: 40.078,
  SE: 78.96,
};

export interface MetricAtomInput {
  coords: [number, number, number];
  element?: string;
  resSeq?: number;
  atomName?: string;
  chainId?: string;
}

/**
 * Computes standard geometric center (centroid) of a set of 3D points.
 */
export function calculateProteinCentroid(
  coords: [number, number, number][]
): [number, number, number] {
  if (!coords || coords.length === 0) return [0, 0, 0];
  let sumX = 0, sumY = 0, sumZ = 0;
  for (const [x, y, z] of coords) {
    sumX += x;
    sumY += y;
    sumZ += z;
  }
  const n = coords.length;
  return [sumX / n, sumY / n, sumZ / n];
}

/**
 * Computes Center of Mass (COM) using element atomic masses.
 */
export function calculateCenterOfMass(
  atoms: MetricAtomInput[]
): [number, number, number] {
  if (!atoms || atoms.length === 0) return [0, 0, 0];
  let totalMass = 0;
  let sumX = 0, sumY = 0, sumZ = 0;

  for (const a of atoms) {
    const elem = (a.element || 'C').toUpperCase().trim();
    const mass = ATOMIC_MASSES[elem] || 12.011;
    totalMass += mass;
    sumX += a.coords[0] * mass;
    sumY += a.coords[1] * mass;
    sumZ += a.coords[2] * mass;
  }

  if (totalMass === 0) return [0, 0, 0];
  return [sumX / totalMass, sumY / totalMass, sumZ / totalMass];
}

/**
 * Computes unweighted Radius of Gyration:
 * Rg = sqrt( (1/N) * sum_i ||r_i - r_centroid||^2 )
 */
export function calculateRadiusOfGyration(
  coords: [number, number, number][]
): number {
  if (!coords || coords.length === 0) return 0;
  const centroid = calculateProteinCentroid(coords);
  let sumSq = 0;
  for (const [x, y, z] of coords) {
    const dx = x - centroid[0];
    const dy = y - centroid[1];
    const dz = z - centroid[2];
    sumSq += dx * dx + dy * dy + dz * dz;
  }
  return Number(Math.sqrt(sumSq / coords.length).toFixed(3));
}

/**
 * Computes mass-weighted Radius of Gyration:
 * Rg_mass = sqrt( (sum_i m_i ||r_i - r_com||^2) / sum_i m_i )
 */
export function calculateMassWeightedRadiusOfGyration(
  atoms: MetricAtomInput[]
): number {
  if (!atoms || atoms.length === 0) return 0;
  const com = calculateCenterOfMass(atoms);
  let totalMass = 0;
  let sumWeightedSq = 0;

  for (const a of atoms) {
    const elem = (a.element || 'C').toUpperCase().trim();
    const mass = ATOMIC_MASSES[elem] || 12.011;
    totalMass += mass;
    const dx = a.coords[0] - com[0];
    const dy = a.coords[1] - com[1];
    const dz = a.coords[2] - com[2];
    sumWeightedSq += mass * (dx * dx + dy * dy + dz * dz);
  }

  if (totalMass === 0) return 0;
  return Number(Math.sqrt(sumWeightedSq / totalMass).toFixed(3));
}

/**
 * Computes End-to-End Distance between N-terminal CA and C-terminal CA.
 * Returns null if fewer than 2 CA coordinates are provided.
 */
export function calculateEndToEndDistance(
  orderedCaCoords: [number, number, number][]
): number | null {
  if (!orderedCaCoords || orderedCaCoords.length < 2) {
    return null;
  }
  const nTermCa = orderedCaCoords[0];
  const cTermCa = orderedCaCoords[orderedCaCoords.length - 1];
  return Number(calculateEuclideanDistance(nTermCa, cTermCa).toFixed(2));
}

/**
 * Computes Secondary Structure Fractions: % alpha-helix, % beta-strand, % coil.
 */
export function calculateSecondaryStructureFractions(
  assignments: Array<'alpha-helix' | '3-10-helix' | 'pi-helix' | 'beta-strand' | 'turn' | 'coil' | 'unassigned'>
): {
  helixFraction: number;
  sheetFraction: number;
  coilFraction: number;
} {
  if (!assignments || assignments.length === 0) {
    return { helixFraction: 0, sheetFraction: 0, coilFraction: 0 };
  }

  let helixCount = 0;
  let sheetCount = 0;
  let coilCount = 0;

  for (const t of assignments) {
    if (t === 'alpha-helix' || t === '3-10-helix' || t === 'pi-helix') {
      helixCount++;
    } else if (t === 'beta-strand') {
      sheetCount++;
    } else {
      coilCount++;
    }
  }

  const n = assignments.length;
  return {
    helixFraction: Number((helixCount / n).toFixed(3)),
    sheetFraction: Number((sheetCount / n).toFixed(3)),
    coilFraction: Number((coilCount / n).toFixed(3)),
  };
}
