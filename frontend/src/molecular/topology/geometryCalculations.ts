/**
 * Molecular Geometry & Coordinate Calculations Engine
 * 
 * Epistemic Rules:
 * 1. Bond angles require explicit clamping to [-1.0, 1.0] before arccos to prevent NaN
 *    from tiny floating-point numerical excursions.
 * 2. Dihedrals must follow IUPAC right-handed screw convention.
 * 3. Trajectory bond lengths evolve over time: L_e(t) = ||r_i(t) - r_j(t)||.
 */

import {
  calculateEuclideanDistance,
  calculateBondAngleDeg,
  calculateDihedralAngleDeg,
} from '../measurements/calculations';

export { calculateBondAngleDeg };

/**
 * Calculates the Euclidean bond length between two 3D coordinates in Angstroms.
 */
export function calculateBondLength(
  coordA: [number, number, number],
  coordB: [number, number, number]
): number {
  return Number(calculateEuclideanDistance(coordA, coordB).toFixed(3));
}

/**
 * Computes 4-point IUPAC dihedral angle in degrees [-180, 180].
 */
export function calculateDihedralDeg(
  coord1: [number, number, number],
  coord2: [number, number, number],
  coord3: [number, number, number],
  coord4: [number, number, number]
): number | null {
  return calculateDihedralAngleDeg(coord1, coord2, coord3, coord4);
}
