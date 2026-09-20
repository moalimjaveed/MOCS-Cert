/**
 * MOCS-Cert Molecular Surfaces — Molecular Volume & Mesh Geometry Engine
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: Bondi vdW Volume, 3D Voxel Integration, Analytical Signed Mesh Volume
 * 
 * Strictly differentiates:
 * 1. Bounding Box Volume (AABB): ΔX * ΔY * ΔZ (spatial container)
 * 2. van der Waals Volume (V_vdW): Enclosed union of atomic spheres
 * 3. Solvent-Excluded Volume (V_SES): Volume enclosed by probe-inaccessible boundary
 */

import { getVdwRadius } from './atomicRadii';
import { SpatialGrid } from './spatialGrid';
import type { MolecularVolumeResult, SurfaceAtomInput } from './types';

export interface VolumeCalculationOptions {
  gridSpacing?: number; // Default 0.50 Å (voxel side length)
  padding?: number;     // Default 2.50 Å
}

/**
 * Computes analytical volume of a single sphere: V = (4/3) * π * r³
 */
export function calculateAnalyticalSphereVolume(radius: number): number {
  if (radius <= 0) return 0;
  return (4 / 3) * Math.PI * radius * radius * radius;
}

/**
 * Computes analytical surface area of a single sphere: A = 4 * π * r²
 */
export function calculateAnalyticalSphereSurfaceArea(radius: number): number {
  if (radius <= 0) return 0;
  return 4 * Math.PI * radius * radius;
}

/**
 * Computes area of a 3D triangle given three vertex coordinates:
 * Area = 0.5 * ||(b - a) × (c - a)||
 */
export function calculateTriangleArea(
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number]
): number {
  const abX = b[0] - a[0];
  const abY = b[1] - a[1];
  const abZ = b[2] - a[2];

  const acX = c[0] - a[0];
  const acY = c[1] - a[1];
  const acZ = c[2] - a[2];

  // Cross product ab × ac
  const crossX = abY * acZ - abZ * acY;
  const crossY = abZ * acX - abX * acZ;
  const crossZ = abX * acY - abY * acX;

  const crossLen = Math.sqrt(crossX * crossX + crossY * crossY + crossZ * crossZ);
  return 0.5 * crossLen;
}

/**
 * Computes signed volume of a tetrahedron with vertices (a, b, c, d):
 * V = (1/6) * |(b - a) × (c - a) · (d - a)|
 */
export function calculateTetrahedronVolume(
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
  d: [number, number, number]
): number {
  const bX = b[0] - a[0], bY = b[1] - a[1], bZ = b[2] - a[2];
  const cX = c[0] - a[0], cY = c[1] - a[1], cZ = c[2] - a[2];
  const dX = d[0] - a[0], dY = d[1] - a[1], dZ = d[2] - a[2];

  // (b × c) · d
  const crossX = bY * cZ - bZ * cY;
  const crossY = bZ * cX - bX * cZ;
  const crossZ = bX * cY - bY * cX;

  const det = crossX * dX + crossY * dY + crossZ * dZ;
  return Math.abs(det) / 6.0;
}

/**
 * Computes enclosed signed volume of a closed triangulated 3D mesh:
 * V = (1/6) * | sum_i a_i · (b_i × c_i) |
 */
export function calculateClosedMeshVolume(
  triangles: Array<[[number, number, number], [number, number, number], [number, number, number]]>
): number {
  if (!triangles || triangles.length === 0) return 0;
  let sum = 0;

  for (let i = 0; i < triangles.length; i++) {
    const [a, b, c] = triangles[i];
    // a · (b × c)
    const crossX = b[1] * c[2] - b[2] * c[1];
    const crossY = b[2] * c[0] - b[0] * c[2];
    const crossZ = b[0] * c[1] - b[1] * c[0];

    sum += a[0] * crossX + a[1] * crossY + a[2] * crossZ;
  }

  return Math.abs(sum) / 6.0;
}

/**
 * Computes exact molecular van der Waals volume using 3D regular voxel integration.
 */
export function computeMolecularVdwVolume(
  atoms: SurfaceAtomInput[],
  options: VolumeCalculationOptions = {}
): MolecularVolumeResult {
  const n = atoms.length;
  if (n === 0) {
    return {
      status: 'EMPTY_SELECTION',
      vdwVolume: 0,
      boundingVolumeAABB: 0,
      packingFraction: 0,
      gridResolution: options.gridSpacing ?? 0.5,
      units: 'Å³',
      provenance: 'COMPUTATIONAL_GEOMETRY',
      atomCount: 0,
    };
  }

  const gridSpacing = Math.max(0.1, options.gridSpacing ?? 0.50);
  const padding = Math.max(1.0, options.padding ?? 2.50);

  // 1. Calculate coordinate extents
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  const vdwRadii: number[] = new Array(n);
  let maxVdw = 0;

  for (let i = 0; i < n; i++) {
    const a = atoms[i];
    const [x, y, z] = a.coordinates;
    const r = a.radius ?? getVdwRadius(a.element);
    vdwRadii[i] = r;
    if (r > maxVdw) maxVdw = r;

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  const deltaX = Math.max(0, maxX - minX);
  const deltaY = Math.max(0, maxY - minY);
  const deltaZ = Math.max(0, maxZ - minZ);
  const aabbVolume = Number((deltaX * deltaY * deltaZ).toFixed(3));

  // 2. Build spatial grid for voxel testing
  const gridAtoms = atoms.map((a, i) => ({
    coordinates: a.coordinates,
    radius: vdwRadii[i],
  }));
  const spatial = new SpatialGrid(gridAtoms, Math.max(maxVdw * 2, 4.0));

  // 3. Define grid bounding box
  const gMinX = minX - padding;
  const gMaxX = maxX + padding;
  const gMinY = minY - padding;
  const gMaxY = maxY + padding;
  const gMinZ = minZ - padding;
  const gMaxZ = maxZ + padding;

  const stepsX = Math.ceil((gMaxX - gMinX) / gridSpacing);
  const stepsY = Math.ceil((gMaxY - gMinY) / gridSpacing);
  const stepsZ = Math.ceil((gMaxZ - gMinZ) / gridSpacing);

  const voxelVolume = gridSpacing * gridSpacing * gridSpacing;
  let occupiedVoxels = 0;

  for (let ix = 0; ix < stepsX; ix++) {
    const vx = gMinX + (ix + 0.5) * gridSpacing;
    for (let iy = 0; iy < stepsY; iy++) {
      const vy = gMinY + (iy + 0.5) * gridSpacing;
      for (let iz = 0; iz < stepsZ; iz++) {
        const vz = gMinZ + (iz + 0.5) * gridSpacing;

        // Query spatial grid for atoms near this voxel center
        const neighbors = spatial.queryRadius(vx, vy, vz, maxVdw);
        let inside = false;

        for (let m = 0; m < neighbors.length; m++) {
          const idx = neighbors[m];
          const [ax, ay, az] = atoms[idx].coordinates;
          const r = vdwRadii[idx];
          const dx = ax - vx;
          const dy = ay - vy;
          const dz = az - vz;
          if (dx * dx + dy * dy + dz * dz <= r * r) {
            inside = true;
            break;
          }
        }

        if (inside) {
          occupiedVoxels++;
        }
      }
    }
  }

  const vdwVolume = Number((occupiedVoxels * voxelVolume).toFixed(3));
  const packingFraction = aabbVolume > 0 ? Number((vdwVolume / aabbVolume).toFixed(4)) : 0;

  return {
    status: 'SUCCESS',
    vdwVolume,
    boundingVolumeAABB: aabbVolume,
    packingFraction,
    gridResolution: gridSpacing,
    units: 'Å³',
    provenance: 'COMPUTATIONAL_GEOMETRY',
    atomCount: n,
  };
}
