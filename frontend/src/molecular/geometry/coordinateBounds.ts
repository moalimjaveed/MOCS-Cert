import * as THREE from 'three';
import type { CoordinateAABB } from '../types';

/**
 * Creates a THREE.Box3 from an array of 3D coordinates using THREE.Box3.setFromPoints.
 * If coords is empty, returns an empty Box3 (min: +inf, max: -inf).
 */
export function createBox3FromCoordinates(
  coords: Array<[number, number, number] | { x: number; y: number; z: number }>
): THREE.Box3 {
  const box = new THREE.Box3();
  if (!coords || coords.length === 0) {
    box.makeEmpty();
    return box;
  }

  const points = coords.map((pt) => {
    if (Array.isArray(pt)) {
      return new THREE.Vector3(pt[0], pt[1], pt[2]);
    }
    return new THREE.Vector3(pt.x, pt.y, pt.z);
  });

  box.setFromPoints(points);
  return box;
}

/**
 * Converts a THREE.Box3 to the serializable CoordinateAABB structure.
 */
export function box3ToCoordinateAABB(box: THREE.Box3): CoordinateAABB {
  if (box.isEmpty()) {
    return {
      min: [0, 0, 0],
      max: [0, 0, 0],
      center: [0, 0, 0],
      size: [0, 0, 0],
      radius: 0,
    };
  }

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);

  return {
    min: [box.min.x, box.min.y, box.min.z],
    max: [box.max.x, box.max.y, box.max.z],
    center: [center.x, center.y, center.z],
    size: [size.x, size.y, size.z],
    radius: sphere.radius,
  };
}

/**
 * Expands a THREE.Box3 by a scalar padding without expanding empty bounds.
 */
export function expandBox3ByScalar(box: THREE.Box3, padding: number): THREE.Box3 {
  if (box.isEmpty()) return box.clone();
  const expanded = box.clone();
  expanded.expandByScalar(padding);
  return expanded;
}

/**
 * Computes CoordinateAABB directly using THREE.Box3 primitives.
 */
export function computeAtomCoordinatesAABB(
  coords: Array<[number, number, number] | { x: number; y: number; z: number }>
): CoordinateAABB {
  const box = createBox3FromCoordinates(coords);
  return box3ToCoordinateAABB(box);
}

export {
  calculateEuclideanDistance,
  calculateMinimumImageDistance as minimumImageDistance,
} from '../measurements';

export interface CanonicalAABB {
  min: [number, number, number];
  max: [number, number, number];
  dimensions: [number, number, number]; // [deltaX, deltaY, deltaZ]
  deltaX: number;                       // max.x - min.x
  deltaY: number;                       // max.y - min.y
  deltaZ: number;                       // max.z - min.z
  center: [number, number, number];     // (min + max) / 2
  volume: number;                       // deltaX * deltaY * deltaZ
  diagonal: number;                     // sqrt(deltaX^2 + deltaY^2 + deltaZ^2)
  atomCount: number;
  isDegenerate: boolean;
  isEmpty: boolean;
}

/**
 * CANONICAL MATHEMATICAL AABB CALCULATION:
 * For an atom coordinate set p_i = (x_i, y_i, z_i):
 *   x_min = min_i(x_i), x_max = max_i(x_i)
 *   y_min = min_i(y_i), y_max = max_i(y_i)
 *   z_min = min_i(z_i), z_max = max_i(z_i)
 *   deltaX = x_max - x_min, deltaY = y_max - y_min, deltaZ = z_max - z_min
 *   c_x = (x_min + x_max) / 2, c_y = (y_min + y_max) / 2, c_z = (z_min + z_max) / 2
 *   V_AABB = deltaX * deltaY * deltaZ
 * 
 * Invariants:
 * - Full floating-point precision (no premature rounding)
 * - Strict non-negativity: deltaX >= 0, deltaY >= 0, deltaZ >= 0
 * - Invariant: min <= max
 * - Handles negative, zero, positive, collinear, planar, and single-atom coordinates
 * - Rejects NaN / Infinity / undefined coordinates
 */
export function computeCanonicalAABB(
  coords: Array<[number, number, number] | { x: number; y: number; z: number }>
): CanonicalAABB {
  if (!coords || coords.length === 0) {
    return {
      min: [0, 0, 0],
      max: [0, 0, 0],
      dimensions: [0, 0, 0],
      deltaX: 0,
      deltaY: 0,
      deltaZ: 0,
      center: [0, 0, 0],
      volume: 0,
      diagonal: 0,
      atomCount: 0,
      isDegenerate: true,
      isEmpty: true,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let validCount = 0;

  for (let i = 0; i < coords.length; i++) {
    const pt = coords[i];
    if (!pt) continue;
    const x = Array.isArray(pt) ? pt[0] : pt.x;
    const y = Array.isArray(pt) ? pt[1] : pt.y;
    const z = Array.isArray(pt) ? pt[2] : pt.z;

    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof z !== 'number' ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(z)
    ) {
      continue;
    }

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
    validCount++;
  }

  if (validCount === 0) {
    return {
      min: [0, 0, 0],
      max: [0, 0, 0],
      dimensions: [0, 0, 0],
      deltaX: 0,
      deltaY: 0,
      deltaZ: 0,
      center: [0, 0, 0],
      volume: 0,
      diagonal: 0,
      atomCount: 0,
      isDegenerate: true,
      isEmpty: true,
    };
  }

  const dx = maxX - minX;
  const dy = maxY - minY;
  const dz = maxZ - minZ;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const diag = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const vol = dx * dy * dz;
  const isDegenerate = validCount <= 2 || dx < 1e-4 || dy < 1e-4 || dz < 1e-4;

  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    dimensions: [dx, dy, dz],
    deltaX: dx,
    deltaY: dy,
    deltaZ: dz,
    center: [cx, cy, cz],
    volume: vol,
    diagonal: diag,
    atomCount: validCount,
    isDegenerate,
    isEmpty: false,
  };
}

/**
 * Computes precision dimensions and volume for a THREE.Box3.
 * Guaranteed unpadded mathematical calculation: deltaX = max.x - min.x.
 */
export function computeBoxDimensions(box: THREE.Box3): {
  deltaX: number;
  deltaY: number;
  deltaZ: number;
  volume: number;
} {
  if (box.isEmpty()) {
    return { deltaX: 0, deltaY: 0, deltaZ: 0, volume: 0 };
  }
  const dx = box.max.x - box.min.x;
  const dy = box.max.y - box.min.y;
  const dz = box.max.z - box.min.z;
  const volume = dx * dy * dz;
  return {
    deltaX: dx,
    deltaY: dy,
    deltaZ: dz,
    volume,
  };
}

/**
 * Computes precision extrema (min/max per axis) for a THREE.Box3.
 */
export function computeBoxExtrema(box: THREE.Box3): {
  min: [number, number, number];
  max: [number, number, number];
} {
  if (box.isEmpty()) {
    return { min: [0, 0, 0], max: [0, 0, 0] };
  }
  return {
    min: [box.min.x, box.min.y, box.min.z],
    max: [box.max.x, box.max.y, box.max.z],
  };
}

/**
 * Constructs 3-axis corner bracket line geometry at each of the 8 vertices of a THREE.Box3.
 * Each corner gets 3 orthogonal arms oriented toward the box interior.
 * This gives a high-precision scientific boundary reticle without visual clutter.
 */
export function createCornerBrackets(
  box: THREE.Box3,
  bracketLength?: number
): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  if (box.isEmpty()) return geom;

  const size = new THREE.Vector3();
  box.getSize(size);

  const minDim = Math.min(size.x, size.y, size.z);
  const defaultLen = Math.min(Math.max(minDim * 0.25, 0.3), 1.2);
  const armLen = bracketLength ?? defaultLen;

  const armX = Math.min(armLen, size.x * 0.45);
  const armY = Math.min(armLen, size.y * 0.45);
  const armZ = Math.min(armLen, size.z * 0.45);

  const positions: number[] = [];

  const xs = [box.min.x, box.max.x];
  const ys = [box.min.y, box.max.y];
  const zs = [box.min.z, box.max.z];

  for (const x of xs) {
    const dirX = x === box.min.x ? 1 : -1;
    for (const y of ys) {
      const dirY = y === box.min.y ? 1 : -1;
      for (const z of zs) {
        const dirZ = z === box.min.z ? 1 : -1;

        // Arm along X
        positions.push(x, y, z, x + dirX * armX, y, z);
        // Arm along Y
        positions.push(x, y, z, x, y + dirY * armY, z);
        // Arm along Z
        positions.push(x, y, z, x, y, z + dirZ * armZ);
      }
    }
  }

  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geom;
}

/**
 * Constructs a 3D crosshair at the AABB centroid (center = (min + max)/2).
 * Labeled explicitly as "AABB center", distinct from center of mass.
 */
export function createCentroidCrosshair(
  center: THREE.Vector3,
  size = 0.5
): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  const positions = [
    // X-axis segment
    center.x - size, center.y, center.z,
    center.x + size, center.y, center.z,
    // Y-axis segment
    center.x, center.y - size, center.z,
    center.x, center.y + size, center.z,
    // Z-axis segment
    center.x, center.y, center.z - size,
    center.x, center.y, center.z + size,
  ];
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geom;
}

/**
 * Constructs miniature local extent axes (X, Y, Z) at a reference point (e.g. box corner or center)
 * to visually communicate the axis-aligned property of the bounding box.
 */
export function createExtentAxes(
  origin: THREE.Vector3,
  length = 1.0
): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  const positions = [
    // X-axis arm
    origin.x, origin.y, origin.z,
    origin.x + length, origin.y, origin.z,
    // Y-axis arm
    origin.x, origin.y, origin.z,
    origin.x, origin.y + length, origin.z,
    // Z-axis arm
    origin.x, origin.y, origin.z,
    origin.x, origin.y, origin.z + length,
  ];
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geom;
}

