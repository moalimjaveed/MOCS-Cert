/**
 * Scientific AABB (Axis-Aligned Bounding Box) computation.
 * Operates strictly on authoritative Float64 coordinate arrays.
 */

export interface ScientificAABB {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
  readonly center: readonly [number, number, number];
  readonly size: readonly [number, number, number];
  readonly atomCount: number;
  readonly frameIdentity: number;
  readonly componentIdentity: string;
  readonly spatialIdentity: string;
}

export interface AABBMeta {
  readonly frameIdentity: number;
  readonly componentIdentity: string;
  readonly spatialIdentity: string;
}

/**
 * Computes authoritative AABB from coordinates and selected atom indices.
 * Fails closed if indices are empty or coordinates contain NaN / Infinity.
 */
export function computeAABB(
  coordinates: Float64Array,
  indices: ArrayLike<number>,
  meta: AABBMeta
): ScientificAABB {
  const count = indices.length;
  if (count === 0) {
    throw new Error(`Cannot compute AABB for empty atom set (component: '${meta.componentIdentity}')`);
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < count; i++) {
    const idx = indices[i];
    const offset = idx * 3;

    if (offset + 2 >= coordinates.length) {
      throw new Error(`Atom index ${idx} out of coordinate bounds (length: ${coordinates.length})`);
    }

    const x = coordinates[offset];
    const y = coordinates[offset + 1];
    const z = coordinates[offset + 2];

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      throw new Error(`Non-finite coordinate detected at atom index ${idx}: [${x}, ${y}, ${z}]`);
    }

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;

    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  const sizeX = maxX - minX;
  const sizeY = maxY - minY;
  const sizeZ = maxZ - minZ;

  const centerX = minX + sizeX * 0.5;
  const centerY = minY + sizeY * 0.5;
  const centerZ = minZ + sizeZ * 0.5;

  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    center: [centerX, centerY, centerZ],
    size: [sizeX, sizeY, sizeZ],
    atomCount: count,
    frameIdentity: meta.frameIdentity,
    componentIdentity: meta.componentIdentity,
    spatialIdentity: meta.spatialIdentity,
  };
}

/**
 * Computes AABB for all atoms in a contiguous Float64Array.
 */
export function computeAABBAll(
  coordinates: Float64Array,
  meta: AABBMeta
): ScientificAABB {
  const totalAtoms = Math.floor(coordinates.length / 3);
  const indices = new Uint32Array(totalAtoms);
  for (let i = 0; i < totalAtoms; i++) {
    indices[i] = i;
  }
  return computeAABB(coordinates, indices, meta);
}

import { Result, ok, err } from '@mocs/core';

/**
 * Computes AABB from discrete 3D point array with optional padding.
 * Returns Result<ScientificAABB> following the fail-closed contract.
 */
export function computePointAABB(
  points: readonly (readonly [number, number, number])[],
  meta: Partial<AABBMeta> = {},
  padding = 0
): Result<ScientificAABB> {
  if (!points || points.length === 0) {
    return err(new Error('Cannot compute AABB for empty coordinate set'));
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (!pt || pt.length < 3) {
      return err(new Error(`Invalid point at index ${i}`));
    }
    const [x, y, z] = pt;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return err(new Error(`Non-finite coordinate detected at point index ${i}: [${x}, ${y}, ${z}]`));
    }

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;

    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  minX -= padding;
  minY -= padding;
  minZ -= padding;
  maxX += padding;
  maxY += padding;
  maxZ += padding;

  const sizeX = maxX - minX;
  const sizeY = maxY - minY;
  const sizeZ = maxZ - minZ;

  return ok({
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    center: [minX + sizeX * 0.5, minY + sizeY * 0.5, minZ + sizeZ * 0.5],
    size: [sizeX, sizeY, sizeZ],
    atomCount: points.length,
    frameIdentity: meta.frameIdentity ?? 0,
    componentIdentity: meta.componentIdentity ?? 'CUSTOM',
    spatialIdentity: meta.spatialIdentity ?? 'default',
  });
}

/**
 * Tests point containment within an AABB (inclusive boundaries).
 */
export function testPointInAABB(
  point: readonly [number, number, number],
  aabb: ScientificAABB
): { isInside: boolean; isOnBoundary: boolean } {
  const [x, y, z] = point;
  const [minX, minY, minZ] = aabb.min;
  const [maxX, maxY, maxZ] = aabb.max;

  const isInside =
    x >= minX && x <= maxX &&
    y >= minY && y <= maxY &&
    z >= minZ && z <= maxZ;

  const eps = 1e-6;
  const isOnBoundary =
    isInside &&
    (Math.abs(x - minX) < eps || Math.abs(x - maxX) < eps ||
     Math.abs(y - minY) < eps || Math.abs(y - maxY) < eps ||
     Math.abs(z - minZ) < eps || Math.abs(z - maxZ) < eps);

  return { isInside, isOnBoundary };
}
