/**
 * MOCS-Cert Canonical Distance, Coordinate & Contact Geometry Engine
 * 
 * Strict invariants:
 * 1. Coordinates must come from canonical 3D coordinates (never screen pixels or AABB centers).
 * 2. Rejects NaN, Infinity, and invalid coordinate types.
 * 3. Handles alternate locations deterministically without duplicate distance inflation.
 * 4. Multi-chain preservation: records actual chain IDs for interfacial binding sites.
 */

import { calculateEuclideanDistance } from '../measurements/calculations';
import type { ValidatedAtom, IndexedComponent } from '../geometry/structuralIdentity';
import type { ContactAtomDetail } from './types';

export interface RawAtomCoord {
  chainId: string;
  resSeq: number;
  resName: string;
  insCode?: string;
  atomName: string;
  element: string;
  coordinates: [number, number, number];
  isHetero: boolean;
  altLoc?: string;
}

/**
 * Validates that an atom has strictly finite, real 3D coordinates.
 */
export function isValidAtomCoord(atom: RawAtomCoord | any): boolean {
  if (!atom || !atom.coordinates || !Array.isArray(atom.coordinates)) return false;
  const [x, y, z] = atom.coordinates;
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z);
}

/**
 * Deterministically filters alternate conformations to a single canonical conformer per atom.
 * Prioritizes blank altLoc (' ') or 'A', eliminating double-counting of multiple conformations.
 */
export function filterCanonicalAltLocs<T extends { atomName: string; altLoc?: string }>(
  atoms: T[]
): T[] {
  const byName = new Map<string, T>();
  for (const a of atoms) {
    const name = a.atomName.toUpperCase().trim();
    const existing = byName.get(name);
    if (!existing) {
      byName.set(name, a);
    } else {
      // Prioritize blank, then 'A'
      const exLoc = (existing.altLoc || '').trim().toUpperCase();
      const currLoc = (a.altLoc || '').trim().toUpperCase();
      if (!currLoc || (currLoc === 'A' && exLoc !== '')) {
        byName.set(name, a);
      }
    }
  }
  return Array.from(byName.values());
}

/**
 * Computes 3D cross product: u x v
 */
export function vectorCross(
  u: [number, number, number],
  v: [number, number, number]
): [number, number, number] {
  return [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
}

/**
 * Computes 3D dot product: u . v
 */
export function vectorDot(
  u: [number, number, number],
  v: [number, number, number]
): number {
  return u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
}

/**
 * Computes Euclidean norm ||v||
 */
export function vectorNorm(v: [number, number, number]): number {
  return Math.hypot(v[0], v[1], v[2]);
}

/**
 * Computes unit normal vector of a triangle defined by 3 points.
 */
export function computePlaneNormal(
  p1: [number, number, number],
  p2: [number, number, number],
  p3: [number, number, number]
): [number, number, number] | null {
  const v1: [number, number, number] = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
  const v2: [number, number, number] = [p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2]];
  const normal = vectorCross(v1, v2);
  const n = vectorNorm(normal);
  if (n < 1e-9) return null; // Degenerate collinear points
  return [normal[0] / n, normal[1] / n, normal[2] / n];
}

/**
 * Computes angle between two normal vectors in degrees [0, 90] (taking absolute dot product).
 */
export function angleBetweenNormalsDeg(
  n1: [number, number, number],
  n2: [number, number, number]
): number {
  const cos = Math.min(1.0, Math.max(0.0, Math.abs(vectorDot(n1, n2))));
  return (Math.acos(cos) * 180.0) / Math.PI;
}

/**
 * Computes angle formed by 3 atoms: A - B - C with vertex at B.
 * Returns angle in degrees [0, 180].
 */
export function computeAngleDegrees(
  posA: [number, number, number],
  posB: [number, number, number],
  posC: [number, number, number]
): number {
  const v1: [number, number, number] = [posA[0] - posB[0], posA[1] - posB[1], posA[2] - posB[2]];
  const v2: [number, number, number] = [posC[0] - posB[0], posC[1] - posB[1], posC[2] - posB[2]];
  const norm1 = vectorNorm(v1);
  const norm2 = vectorNorm(v2);
  if (norm1 < 1e-9 || norm2 < 1e-9) return 0.0;
  const cos = Math.min(1.0, Math.max(-1.0, vectorDot(v1, v2) / (norm1 * norm2)));
  return (Math.acos(cos) * 180.0) / Math.PI;
}
