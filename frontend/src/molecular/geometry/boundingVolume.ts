import * as THREE from 'three';
import type { ValidatedAtom, MolecularComponentId, ComponentClassification } from './structuralIdentity';
import { computeCanonicalAABB } from './coordinateBounds';

/**
 * Raw unpadded mathematical extents of a molecular component.
 */
export interface RawGeometricExtents {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
  dimensions: [number, number, number]; // [deltaX, deltaY, deltaZ]
  diagonal: number;
  volume: number;
  atomCount: number;
  isDegenerate: boolean;
  box3: THREE.Box3;
}

/**
 * Visual rendering extents with controlled scientific padding and minimum rasterization thickness.
 */
export interface VisualRenderBounds {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
  dimensions: [number, number, number];
  padding: number;
  box3: THREE.Box3;
}

/**
 * Oriented Bounding Box (OBB) derived via Principal Component Analysis (PCA).
 */
export interface OrientedBoundingBox {
  center: [number, number, number];
  halfSizes: [number, number, number];
  axes: [
    [number, number, number], // Primary principal axis
    [number, number, number], // Secondary principal axis
    [number, number, number]  // Tertiary principal axis
  ];
  rotationMatrix: number[];   // 16-element column-major 4x4 matrix
}

export interface ComponentGeometricBound {
  kind: 'component';
  componentId: MolecularComponentId;
  label: string;
  raw: RawGeometricExtents;
  render: VisualRenderBounds;
  obb?: OrientedBoundingBox;
}

export interface GroupGeometricBound {
  kind: 'group';
  groupLabel: string;
  memberComponentIds: MolecularComponentId[];
  raw: RawGeometricExtents;
  render: VisualRenderBounds;
  components: ComponentGeometricBound[];
}

/**
 * Centralized Scientific Controlled Padding Policy:
 * 
 * Padding is:
 * - Scale-aware (scales gently with component diagonal)
 * - Clamped between 0.15 Å and 0.60 Å
 * - Independent of screen resolution, camera zoom, or protein size
 */
export function calculateControlledPadding(diagonal: number): number {
  if (!Number.isFinite(diagonal) || diagonal <= 0) return 0.2;
  const padding = diagonal * 0.035;
  return Math.min(0.6, Math.max(0.15, Number(padding.toFixed(3))));
}

/**
 * Computes raw unpadded mathematical extents from validated atom coordinates.
 * Strictly guarantees zero artificial inflation of scientific metrics.
 */
export function computeRawExtents(
  atoms: Array<ValidatedAtom | [number, number, number]>
): RawGeometricExtents {
  if (!atoms || atoms.length === 0) {
    return {
      min: [0, 0, 0],
      max: [0, 0, 0],
      center: [0, 0, 0],
      dimensions: [0, 0, 0],
      diagonal: 0,
      volume: 0,
      atomCount: 0,
      isDegenerate: true,
      box3: new THREE.Box3().makeEmpty(),
    };
  }

  const coords = atoms.map((a) => (Array.isArray(a) ? a : (a as ValidatedAtom).coordinates));
  const c = computeCanonicalAABB(coords);

  const box3 = c.isEmpty
    ? new THREE.Box3().makeEmpty()
    : new THREE.Box3(
        new THREE.Vector3(c.min[0], c.min[1], c.min[2]),
        new THREE.Vector3(c.max[0], c.max[1], c.max[2])
      );

  return {
    min: c.min,
    max: c.max,
    center: c.center,
    dimensions: c.dimensions,
    diagonal: c.diagonal,
    volume: c.volume,
    atomCount: c.atomCount,
    isDegenerate: c.isDegenerate,
    box3,
  };
}

/**
 * Factory helper to derive a complete ComponentGeometricBound with both raw and render bounds.
 */
export function deriveComponentGeometricBound(
  label: string,
  coords: Array<[number, number, number] | ValidatedAtom>,
  classification: ComponentClassification = 'protein',
  chainId: string = 'A',
  seqNumber: number = 1
): ComponentGeometricBound {
  const raw = computeRawExtents(coords);
  const render = computeVisualRenderBounds(raw);
  const obb = computeOrientedBoundingBox(coords);

  return {
    kind: 'component',
    componentId: {
      structureId: 'structure',
      modelId: 1,
      chainId,
      residueName: label,
      residueNumber: seqNumber,
      insertionCode: '',
      classification,
    },
    label,
    raw,
    render,
    obb,
  };
}

/**
 * Computes visual render bounds with controlled scientific padding.
 * For degenerate geometries (e.g. single atoms or planar rings), ensures
 * a minimal rendering thickness (0.35 Å) solely for WebGL rasterization,
 * without altering raw scientific extents.
 */
export function computeVisualRenderBounds(
  raw: RawGeometricExtents
): VisualRenderBounds {
  if (raw.atomCount === 0) {
    const emptyBox = new THREE.Box3().makeEmpty();
    return {
      min: [0, 0, 0],
      max: [0, 0, 0],
      center: [0, 0, 0],
      dimensions: [0, 0, 0],
      padding: 0,
      box3: emptyBox,
    };
  }

  const padding = calculateControlledPadding(raw.diagonal);
  const minThickness = 0.35; // Minimal rendering thickness for WebGL geometry

  let rdx = raw.dimensions[0] + padding * 2;
  let rdy = raw.dimensions[1] + padding * 2;
  let rdz = raw.dimensions[2] + padding * 2;

  // Ensure planar/linear/single-atom components rasterize with visible thickness
  if (rdx < minThickness) rdx = minThickness;
  if (rdy < minThickness) rdy = minThickness;
  if (rdz < minThickness) rdz = minThickness;

  const halfX = rdx / 2;
  const halfY = rdy / 2;
  const halfZ = rdz / 2;

  const cx = raw.center[0];
  const cy = raw.center[1];
  const cz = raw.center[2];

  const rMin: [number, number, number] = [
    Number((cx - halfX).toFixed(3)),
    Number((cy - halfY).toFixed(3)),
    Number((cz - halfZ).toFixed(3)),
  ];
  const rMax: [number, number, number] = [
    Number((cx + halfX).toFixed(3)),
    Number((cy + halfY).toFixed(3)),
    Number((cz + halfZ).toFixed(3)),
  ];

  const box3 = new THREE.Box3(
    new THREE.Vector3(rMin[0], rMin[1], rMin[2]),
    new THREE.Vector3(rMax[0], rMax[1], rMax[2])
  );

  return {
    min: rMin,
    max: rMax,
    center: [cx, cy, cz],
    dimensions: [Number(rdx.toFixed(3)), Number(rdy.toFixed(3)), Number(rdz.toFixed(3))],
    padding,
    box3,
  };
}

/**
 * Symmetric 3x3 Jacobi Eigendecomposition.
 * Diagonalizes real symmetric matrix A, returning eigenvalues and eigenvectors.
 */
function jacobi3x3(A: number[][]): { eigenvalues: number[]; eigenvectors: number[][] } {
  const V = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const d = [A[0][0], A[1][1], A[2][2]];
  const maxIter = 50;

  for (let iter = 0; iter < maxIter; iter++) {
    // Find largest off-diagonal element
    let p = 0;
    let q = 1;
    let maxOff = Math.abs(A[0][1]);
    if (Math.abs(A[0][2]) > maxOff) {
      maxOff = Math.abs(A[0][2]);
      p = 0;
      q = 2;
    }
    if (Math.abs(A[1][2]) > maxOff) {
      maxOff = Math.abs(A[1][2]);
      p = 1;
      q = 2;
    }

    if (maxOff < 1e-7) break;

    const app = A[p][p];
    const aqq = A[q][q];
    const apq = A[p][q];

    const phi = 0.5 * Math.atan2(2 * apq, aqq - app);
    const c = Math.cos(phi);
    const s = Math.sin(phi);

    // Givens rotation update
    for (let i = 0; i < 3; i++) {
      if (i !== p && i !== q) {
        const aip = A[i][p];
        const aiq = A[i][q];
        A[i][p] = A[p][i] = c * aip - s * aiq;
        A[i][q] = A[q][i] = s * aip + c * aiq;
      }
    }

    A[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
    A[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
    A[p][q] = A[q][p] = 0;

    for (let i = 0; i < 3; i++) {
      const vip = V[i][p];
      const viq = V[i][q];
      V[i][p] = c * vip - s * viq;
      V[i][q] = s * vip + c * viq;
    }
  }

  d[0] = A[0][0];
  d[1] = A[1][1];
  d[2] = A[2][2];

  return { eigenvalues: d, eigenvectors: V };
}

/**
 * Computes Oriented Bounding Box (OBB) using Principal Component Analysis (PCA).
 * Extracts principal coordinate axes from atom spatial covariance matrix.
 */
export function computeOrientedBoundingBox(
  atoms: Array<ValidatedAtom | [number, number, number]>
): OrientedBoundingBox | undefined {
  const coords: [number, number, number][] = atoms
    .map((a) => (Array.isArray(a) ? a : a.coordinates))
    .filter((pt) => pt && pt.every(Number.isFinite));

  if (coords.length < 3) return undefined;

  const N = coords.length;
  let cx = 0;
  let cy = 0;
  let cz = 0;

  for (let i = 0; i < N; i++) {
    cx += coords[i][0];
    cy += coords[i][1];
    cz += coords[i][2];
  }
  cx /= N;
  cy /= N;
  cz /= N;

  // Covariance matrix
  let cxx = 0;
  let cxy = 0;
  let cxz = 0;
  let cyy = 0;
  let cyz = 0;
  let czz = 0;

  for (let i = 0; i < N; i++) {
    const rx = coords[i][0] - cx;
    const ry = coords[i][1] - cy;
    const rz = coords[i][2] - cz;

    cxx += rx * rx;
    cxy += rx * ry;
    cxz += rx * rz;
    cyy += ry * ry;
    cyz += ry * rz;
    czz += rz * rz;
  }

  const cov = [
    [cxx / N, cxy / N, cxz / N],
    [cxy / N, cyy / N, cyz / N],
    [cxz / N, cyz / N, czz / N],
  ];

  const { eigenvalues, eigenvectors } = jacobi3x3(cov);

  // Sort eigenvectors in descending order of eigenvalues
  const order = [0, 1, 2].sort((a, b) => eigenvalues[b] - eigenvalues[a]);

  const u0: [number, number, number] = [
    eigenvectors[0][order[0]],
    eigenvectors[1][order[0]],
    eigenvectors[2][order[0]],
  ];
  const u1: [number, number, number] = [
    eigenvectors[0][order[1]],
    eigenvectors[1][order[1]],
    eigenvectors[2][order[1]],
  ];

  // u2 = u0 x u1 to maintain right-handed coordinate system
  const u2: [number, number, number] = [
    u0[1] * u1[2] - u0[2] * u1[1],
    u0[2] * u1[0] - u0[0] * u1[2],
    u0[0] * u1[1] - u0[1] * u1[0],
  ];

  const axes: [[number, number, number], [number, number, number], [number, number, number]] = [
    u0,
    u1,
    u2,
  ];

  // Project points onto principal axes
  let minU0 = Infinity;
  let maxU0 = -Infinity;
  let minU1 = Infinity;
  let maxU1 = -Infinity;
  let minU2 = Infinity;
  let maxU2 = -Infinity;

  for (let i = 0; i < N; i++) {
    const rx = coords[i][0] - cx;
    const ry = coords[i][1] - cy;
    const rz = coords[i][2] - cz;

    const p0 = rx * u0[0] + ry * u0[1] + rz * u0[2];
    const p1 = rx * u1[0] + ry * u1[1] + rz * u1[2];
    const p2 = rx * u2[0] + ry * u2[1] + rz * u2[2];

    if (p0 < minU0) minU0 = p0;
    if (p0 > maxU0) maxU0 = p0;
    if (p1 < minU1) minU1 = p1;
    if (p1 > maxU1) maxU1 = p1;
    if (p2 < minU2) minU2 = p2;
    if (p2 > maxU2) maxU2 = p2;
  }

  const h0 = Math.max((maxU0 - minU0) / 2, 0.2);
  const h1 = Math.max((maxU1 - minU1) / 2, 0.2);
  const h2 = Math.max((maxU2 - minU2) / 2, 0.2);

  const midU0 = (minU0 + maxU0) / 2;
  const midU1 = (minU1 + maxU1) / 2;
  const midU2 = (minU2 + maxU2) / 2;

  const obbCenter: [number, number, number] = [
    Number((cx + midU0 * u0[0] + midU1 * u1[0] + midU2 * u2[0]).toFixed(3)),
    Number((cy + midU0 * u0[1] + midU1 * u1[1] + midU2 * u2[1]).toFixed(3)),
    Number((cz + midU0 * u0[2] + midU1 * u1[2] + midU2 * u2[2]).toFixed(3)),
  ];

  // 4x4 column-major rotation matrix
  const rotMat = [
    u0[0], u0[1], u0[2], 0,
    u1[0], u1[1], u1[2], 0,
    u2[0], u2[1], u2[2], 0,
    0, 0, 0, 1,
  ];

  return {
    center: obbCenter,
    halfSizes: [Number(h0.toFixed(3)), Number(h1.toFixed(3)), Number(h2.toFixed(3))],
    axes,
    rotationMatrix: rotMat,
  };
}
