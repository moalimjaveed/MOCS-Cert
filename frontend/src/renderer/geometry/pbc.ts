/**
 * Periodic Boundary Conditions (PBC) & Minimum-Image Convention.
 * Full orthogonal and triclinic unit cell transformations.
 * All coordinates in Ångströms, Float64 throughout.
 * No React, no Mol*, no Three.js.
 */

import { Result, ok, err } from '@mocs/core';
import type { Coord3 } from './types.js';

export interface UnitCell {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly alpha: number; // in degrees
  readonly beta: number;  // in degrees
  readonly gamma: number; // in degrees
}

/**
 * Basic orthorhombic minimum image convention for displacement vector.
 */
export function applyMinimumImageConvention(
  dr: [number, number, number],
  boxLengths: readonly [number, number, number]
): [number, number, number] {
  let dx = dr[0];
  let dy = dr[1];
  let dz = dr[2];

  const lx = boxLengths[0];
  const ly = boxLengths[1];
  const lz = boxLengths[2];

  if (lx > 0) dx = dx - lx * Math.round(dx / lx);
  if (ly > 0) dy = dy - ly * Math.round(dy / ly);
  if (lz > 0) dz = dz - lz * Math.round(dz / lz);

  return [dx, dy, dz];
}

/**
 * Validates a unit cell for physical plausibility.
 */
export function validateUnitCell(cell: UnitCell): Result<UnitCell> {
  if (cell.a <= 0 || cell.b <= 0 || cell.c <= 0) {
    return err(new Error(`Unit cell lengths must be positive: a=${cell.a}, b=${cell.b}, c=${cell.c}`));
  }
  if (
    cell.alpha <= 0 || cell.alpha >= 180 ||
    cell.beta <= 0 || cell.beta >= 180 ||
    cell.gamma <= 0 || cell.gamma >= 180
  ) {
    return err(new Error(`Unit cell angles must be in (0, 180): alpha=${cell.alpha}, beta=${cell.beta}, gamma=${cell.gamma}`));
  }
  return ok(cell);
}

/**
 * Converts Cartesian coordinates to fractional coordinates under a unit cell.
 * Inverts the standard crystallographic upper-triangular transformation matrix.
 */
export function cartesianToFractional(coord: Coord3, cell: UnitCell): Coord3 {
  const { a, b, c, alpha, beta, gamma } = cell;
  const toRad = Math.PI / 180;
  const cosA = Math.cos(alpha * toRad);
  const cosB = Math.cos(beta * toRad);
  const cosG = Math.cos(gamma * toRad);
  const sinG = Math.sin(gamma * toRad);

  const vol =
    a *
    b *
    c *
    Math.sqrt(Math.max(0, 1 - cosA * cosA - cosB * cosB - cosG * cosG + 2 * cosA * cosB * cosG));

  const [x, y, z] = coord;

  const m00 = a;
  const m01 = b * cosG;
  const m02 = c * cosB;

  const m11 = b * sinG;
  const m12 = (c * (cosA - cosB * cosG)) / sinG;

  const m22 = vol / (a * b * sinG);

  const fz = z / m22;
  const fy = (y - m12 * fz) / m11;
  const fx = (x - m01 * fy - m02 * fz) / m00;

  return [fx, fy, fz];
}

/**
 * Converts fractional coordinates to Cartesian coordinates under a unit cell.
 */
export function fractionalToCartesian(frac: Coord3, cell: UnitCell): Coord3 {
  const { a, b, c, alpha, beta, gamma } = cell;
  const toRad = Math.PI / 180;
  const cosA = Math.cos(alpha * toRad);
  const cosB = Math.cos(beta * toRad);
  const cosG = Math.cos(gamma * toRad);
  const sinG = Math.sin(gamma * toRad);

  const vol =
    a *
    b *
    c *
    Math.sqrt(Math.max(0, 1 - cosA * cosA - cosB * cosB - cosG * cosG + 2 * cosA * cosB * cosG));

  const [fx, fy, fz] = frac;

  const m00 = a;
  const m01 = b * cosG;
  const m02 = c * cosB;

  const m11 = b * sinG;
  const m12 = (c * (cosA - cosB * cosG)) / sinG;

  const m22 = vol / (a * b * sinG);

  const x = m00 * fx + m01 * fy + m02 * fz;
  const y = m11 * fy + m12 * fz;
  const z = m22 * fz;

  return [x, y, z];
}

/**
 * Applies minimum-image convention for both orthogonal and triclinic cells.
 */
export function minimumImageConvention(
  coord: Coord3,
  reference: Coord3,
  cell: UnitCell
): Coord3 {
  const isOrthogonal =
    Math.abs(cell.alpha - 90) < 1e-6 &&
    Math.abs(cell.beta - 90) < 1e-6 &&
    Math.abs(cell.gamma - 90) < 1e-6;

  if (isOrthogonal) {
    const dx = coord[0] - reference[0];
    const dy = coord[1] - reference[1];
    const dz = coord[2] - reference[2];
    return [
      reference[0] + dx - cell.a * Math.round(dx / cell.a),
      reference[1] + dy - cell.b * Math.round(dy / cell.b),
      reference[2] + dz - cell.c * Math.round(dz / cell.c),
    ];
  }

  // General triclinic cell: map to fractional, wrap displacement, map back
  const [fx, fy, fz] = cartesianToFractional(coord, cell);
  const [rx, ry, rz] = cartesianToFractional(reference, cell);
  const dfx = fx - rx;
  const dfy = fy - ry;
  const dfz = fz - rz;
  const wfx = rx + dfx - Math.round(dfx);
  const wfy = ry + dfy - Math.round(dfy);
  const wfz = rz + dfz - Math.round(dfz);
  return fractionalToCartesian([wfx, wfy, wfz], cell);
}

/**
 * Computes the minimum-image distance between two points under PBC.
 */
export function minimumImageDistance(
  a: Coord3,
  b: Coord3,
  cell: UnitCell
): Result<number> {
  const wrapped = minimumImageConvention(b, a, cell);
  const dx = wrapped[0] - a[0];
  const dy = wrapped[1] - a[1];
  const dz = wrapped[2] - a[2];
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (!Number.isFinite(dist)) {
    return err(new Error(`Minimum-image distance is non-finite: ${dist}`));
  }
  return ok(dist);
}
