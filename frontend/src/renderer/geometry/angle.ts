/**
 * Authoritative Bond Angle and Dihedral (Torsion) Angle Calculations.
 * All operations in Float64, returning degrees.
 * No React, no Mol*, no Three.js.
 */

import { Result, ok, err } from '@mocs/core';
import type { Coord3 } from './types.js';

export function computeAngleDegrees(
  p1: Coord3,
  p2: Coord3, // Vertex
  p3: Coord3
): number {
  const v1x = p1[0] - p2[0];
  const v1y = p1[1] - p2[1];
  const v1z = p1[2] - p2[2];

  const v2x = p3[0] - p2[0];
  const v2y = p3[1] - p2[1];
  const v2z = p3[2] - p2[2];

  const dot = v1x * v2x + v1y * v2y + v1z * v2z;
  const mag1 = Math.sqrt(v1x * v1x + v1y * v1y + v1z * v1z);
  const mag2 = Math.sqrt(v2x * v2x + v2y * v2y + v2z * v2z);

  if (mag1 === 0 || mag2 === 0) return 0;
  const cosTheta = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cosTheta) * 180) / Math.PI;
}

/**
 * Computes angle at vertex B in degrees, returning Result<number>.
 */
export function computeAngle(a: Coord3, b: Coord3, c: Coord3): Result<number> {
  const bax = a[0] - b[0];
  const bay = a[1] - b[1];
  const baz = a[2] - b[2];

  const bcx = c[0] - b[0];
  const bcy = c[1] - b[1];
  const bcz = c[2] - b[2];

  const nba = Math.sqrt(bax * bax + bay * bay + baz * baz);
  const nbc = Math.sqrt(bcx * bcx + bcy * bcy + bcz * bcz);

  if (nba < 1e-10 || nbc < 1e-10) {
    return err(new Error('Degenerate angle: coincident atoms'));
  }

  const dot = bax * bcx + bay * bcy + baz * bcz;
  const cosTheta = Math.max(-1, Math.min(1, dot / (nba * nbc)));
  const angleDegrees = Math.acos(cosTheta) * (180 / Math.PI);

  if (!Number.isFinite(angleDegrees)) {
    return err(new Error('Angle computation yielded non-finite result'));
  }
  return ok(angleDegrees);
}

/**
 * Computes the dihedral (torsion) angle for atoms A-B-C-D in degrees (-180, 180].
 */
export function computeDihedral(
  a: Coord3,
  b: Coord3,
  c: Coord3,
  d: Coord3
): Result<number> {
  const b1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const b2 = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
  const b3 = [d[0] - c[0], d[1] - c[1], d[2] - c[2]];

  // n1 = b1 x b2
  const n1 = [
    b1[1] * b2[2] - b1[2] * b2[1],
    b1[2] * b2[0] - b1[0] * b2[2],
    b1[0] * b2[1] - b1[1] * b2[0],
  ];

  // n2 = b2 x b3
  const n2 = [
    b2[1] * b3[2] - b2[2] * b3[1],
    b2[2] * b3[0] - b2[0] * b3[2],
    b2[0] * b3[1] - b2[1] * b3[0],
  ];

  const nn1 = Math.sqrt(n1[0] * n1[0] + n1[1] * n1[1] + n1[2] * n1[2]);
  const nn2 = Math.sqrt(n2[0] * n2[0] + n2[1] * n2[1] + n2[2] * n2[2]);

  if (nn1 < 1e-10 || nn2 < 1e-10) {
    return err(new Error('Degenerate dihedral: collinear atoms'));
  }

  const cosD = Math.max(-1, Math.min(1, (n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2]) / (nn1 * nn2)));
  // m1 = n1 x normalize(b2)
  const nb2 = Math.sqrt(b2[0] * b2[0] + b2[1] * b2[1] + b2[2] * b2[2]);
  const b2u = [b2[0] / nb2, b2[1] / nb2, b2[2] / nb2];

  const m1 = [
    n1[1] * b2u[2] - n1[2] * b2u[1],
    n1[2] * b2u[0] - n1[0] * b2u[2],
    n1[0] * b2u[1] - n1[1] * b2u[0],
  ];

  const sign = m1[0] * n2[0] + m1[1] * n2[1] + m1[2] * n2[2] < 0 ? -1 : 1;
  const dihedralDegrees = sign * Math.acos(cosD) * (180 / Math.PI);

  if (!Number.isFinite(dihedralDegrees)) {
    return err(new Error('Dihedral computation yielded non-finite result'));
  }
  return ok(dihedralDegrees);
}
