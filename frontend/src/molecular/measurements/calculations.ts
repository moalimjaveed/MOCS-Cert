/**
 * Canonical Molecular Measurement Mathematical Engine
 * 
 * Epistemic Status: ESTABLISHED
 * 
 * Provides pure mathematical implementations for molecular geometry:
 * - Euclidean distance (direct arithmetic, zero allocations, guards against NaN/Inf)
 * - Periodic Boundary Condition (PBC) minimum-image distance for orthorhombic boxes
 * - 3-Point Bond Angle (dot product clamped to [-1, 1], returns null for coincident/degenerate geometry)
 * - 4-Point Dihedral Angle (IUPAC right-handed screw convention, returns null for collinear/degenerate geometry)
 * - Number formatting for scientific display (Å and °)
 */

export type CoordinateLike =
  | [number, number, number]
  | { x: number; y: number; z: number };

/**
 * Validates that a 3D coordinate consists of 3 finite floating-point numbers.
 * Rejects NaN, Infinity, -Infinity, null, and undefined.
 */
export function isValid3DCoordinate(coord: any): boolean {
  if (!coord) return false;
  if (Array.isArray(coord)) {
    return (
      coord.length >= 3 &&
      typeof coord[0] === 'number' &&
      typeof coord[1] === 'number' &&
      typeof coord[2] === 'number' &&
      Number.isFinite(coord[0]) &&
      Number.isFinite(coord[1]) &&
      Number.isFinite(coord[2])
    );
  }
  if (typeof coord === 'object') {
    return (
      typeof coord.x === 'number' &&
      typeof coord.y === 'number' &&
      typeof coord.z === 'number' &&
      Number.isFinite(coord.x) &&
      Number.isFinite(coord.y) &&
      Number.isFinite(coord.z)
    );
  }
  return false;
}

/**
 * Extracts a [number, number, number] tuple from any CoordinateLike input.
 * Returns null if the coordinate is invalid or non-finite.
 */
export function extractCoords(coord: CoordinateLike | any): [number, number, number] | null {
  if (!isValid3DCoordinate(coord)) return null;
  if (Array.isArray(coord)) {
    return [coord[0], coord[1], coord[2]];
  }
  return [coord.x, coord.y, coord.z];
}

/**
 * Calculates standard Euclidean distance between two 3D coordinates.
 * d = sqrt((x2-x1)^2 + (y2-y1)^2 + (z2-z1)^2)
 * 
 * Invariants:
 * - d(A, A) === 0.0 (no division by zero)
 * - d(A, B) === d(B, A) (symmetry)
 * - d(A, B) >= 0.0 (non-negativity)
 * - d(A, C) <= d(A, B) + d(B, C) (triangle inequality)
 * - Returns NaN if either coordinate is invalid or non-finite.
 */
export function calculateEuclideanDistance(
  coordA: CoordinateLike,
  coordB: CoordinateLike
): number {
  const pA = extractCoords(coordA);
  const pB = extractCoords(coordB);

  if (!pA || !pB) {
    return NaN;
  }

  const dx = pB[0] - pA[0];
  const dy = pB[1] - pA[1];
  const dz = pB[2] - pA[2];

  if (dx === 0 && dy === 0 && dz === 0) {
    return 0.0;
  }

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export class UnsupportedBoxGeometryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedBoxGeometryError';
  }
}

/**
 * Validates that a simulation box conforms strictly to orthorhombic PBC.
 * Rejects triclinic boxes (matrices with non-zero off-diagonals or unit cell angles != 90 deg)
 * and degenerate/non-finite dimensions.
 */
export function validateOrthorhombicBox(box: any): [number, number, number] {
  if (!box) {
    throw new UnsupportedBoxGeometryError('Simulation box definition cannot be null or undefined.');
  }

  // 1. Array format: [Lx, Ly, Lz] or 3x3 matrix [[Lx, 0, 0], [0, Ly, 0], [0, 0, Lz]]
  if (Array.isArray(box)) {
    if (box.length === 3 && Array.isArray(box[0])) {
      const m = box as number[][];
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          if (i !== j && Math.abs(m[i]?.[j] || 0) > 1e-5) {
            throw new UnsupportedBoxGeometryError(
              `Triclinic and non-orthorhombic simulation cells are unsupported. Off-diagonal cell element [${i},${j}] = ${m[i]?.[j]} exceeds tolerance.`
            );
          }
        }
      }
      return validateOrthorhombicBox([m[0][0], m[1][1], m[2][2]]);
    }

    if (box.length !== 3) {
      throw new UnsupportedBoxGeometryError(`Box dimension vector must have exactly 3 elements, found ${box.length}.`);
    }

    const [bx, by, bz] = box;
    if (!Number.isFinite(bx) || !Number.isFinite(by) || !Number.isFinite(bz)) {
      throw new UnsupportedBoxGeometryError(`Box dimensions contain non-finite numbers: [${bx}, ${by}, ${bz}].`);
    }
    if (bx <= 0 || by <= 0 || bz <= 0) {
      throw new UnsupportedBoxGeometryError(`Box dimensions must be strictly positive (> 0), received [${bx}, ${by}, ${bz}].`);
    }

    return [bx, by, bz];
  }

  // 2. Object format: { lx, ly, lz, alpha, beta, gamma } or { dimensions, angles }
  if (typeof box === 'object') {
    const alpha = box.alpha ?? 90;
    const beta = box.beta ?? 90;
    const gamma = box.gamma ?? 90;

    if (Math.abs(alpha - 90) > 1e-4 || Math.abs(beta - 90) > 1e-4 || Math.abs(gamma - 90) > 1e-4) {
      throw new UnsupportedBoxGeometryError(
        `Non-orthogonal unit cell angles (alpha=${alpha}°, beta=${beta}°, gamma=${gamma}°) are unsupported. Only orthorhombic PBC boxes (90°, 90°, 90°) are supported.`
      );
    }

    const dims = box.dimensions || [box.lx ?? box.x, box.ly ?? box.y, box.lz ?? box.z];
    return validateOrthorhombicBox(dims);
  }

  throw new UnsupportedBoxGeometryError('Unrecognized simulation box format.');
}

/**
 * Banker's rounding (round-half-to-even), matching NumPy np.round and Python MOCS backend.
 */
export function roundHalfEven(x: number): number {
  if (x < 0) {
    return -roundHalfEven(-x);
  }
  const floor = Math.floor(x);
  const diff = x - floor;
  if (Math.abs(diff - 0.5) < 1e-12) {
    return floor % 2 === 0 ? floor : floor + 1;
  }
  return Math.round(x);
}

/**
 * Calculates Euclidean distance with periodic boundary condition (PBC) minimum-image convention.
 * Strictly supports orthorhombic simulation boxes and rejects triclinic cells.
 * Requires explicit simulation box dimensions (never fabricates defaults) and uses banker's rounding.
 */
export function calculateMinimumImageDistance(
  coordA: CoordinateLike,
  coordB: CoordinateLike,
  box: [number, number, number] | number[][] | any
): number {
  if (box === undefined || box === null) {
    throw new UnsupportedBoxGeometryError('Periodic boundary condition distance requires an explicit simulation box.');
  }

  const pA = extractCoords(coordA);
  const pB = extractCoords(coordB);

  if (!pA || !pB) {
    throw new Error('Invalid coordinate input provided to calculateMinimumImageDistance.');
  }

  const [boxX, boxY, boxZ] = validateOrthorhombicBox(box);

  let dx = pB[0] - pA[0];
  let dy = pB[1] - pA[1];
  let dz = pB[2] - pA[2];

  dx -= roundHalfEven(dx / boxX) * boxX;
  dy -= roundHalfEven(dy / boxY) * boxY;
  dz -= roundHalfEven(dz / boxZ) * boxZ;

  if (dx === 0 && dy === 0 && dz === 0) {
    return 0.0;
  }

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Computes 3-point bond angle: A -> B -> C (vertex at B) in degrees.
 * u = A - B
 * v = C - B
 * theta = arccos( (u . v) / (|u| * |v|) )
 * 
 * Invariants:
 * - Numerical stability: dot product clamped to [-1.0, 1.0] before arccos
 * - Range: [0.0°, 180.0°]
 * - Symmetry: angle(A, B, C) === angle(C, B, A)
 * - Degenerate cases: returns null if A=B or C=B (never a fabricated 0°)
 */
export function calculateBondAngleDeg(
  coordA: CoordinateLike,
  coordB: CoordinateLike,
  coordC: CoordinateLike
): number | null {
  const pA = extractCoords(coordA);
  const pB = extractCoords(coordB);
  const pC = extractCoords(coordC);

  if (!pA || !pB || !pC) return null;

  // Vectors u = A - B, v = C - B
  const ux = pA[0] - pB[0];
  const uy = pA[1] - pB[1];
  const uz = pA[2] - pB[2];

  const vx = pC[0] - pB[0];
  const vy = pC[1] - pB[1];
  const vz = pC[2] - pB[2];

  const magUSq = ux * ux + uy * uy + uz * uz;
  const magVSq = vx * vx + vy * vy + vz * vz;

  // Reject zero-length vectors (coincident points)
  if (magUSq < 1e-16 || magVSq < 1e-16) {
    return null;
  }

  const magU = Math.sqrt(magUSq);
  const magV = Math.sqrt(magVSq);

  const dot = ux * vx + uy * vy + uz * vz;
  const cosTheta = dot / (magU * magV);

  // Clamp strictly to [-1, 1] for numerical stability
  const clampedCos = Math.max(-1.0, Math.min(1.0, cosTheta));
  const rad = Math.acos(clampedCos);

  return (rad * 180.0) / Math.PI;
}

/**
 * Computes 4-point dihedral / torsion angle: A - B - C - D in degrees.
 * Follows the standard IUPAC right-handed screw convention in [-180.0°, +180.0°].
 * 
 * Algorithm:
 * b1 = B - A
 * b2 = C - B
 * b3 = D - C
 * n1 = b1 x b2
 * n2 = b2 x b3
 * m1 = n1 x (b2 / |b2|)
 * x = n1 . n2
 * y = m1 . n2
 * phi = atan2(y, x)
 * 
 * Invariants:
 * - Cis / eclipsed (A and D in same plane on same side): 0.0°
 * - Trans (A and D on opposite sides): ±180.0°
 * - Clockwise rotation of rear bond C-D looking down B-C: positive angle
 * - Collinear atoms or degenerate planes (|n1| = 0 or |n2| = 0): returns null (undefined geometry)
 */
export function calculateDihedralAngleDeg(
  coordA: CoordinateLike,
  coordB: CoordinateLike,
  coordC: CoordinateLike,
  coordD: CoordinateLike
): number | null {
  const pA = extractCoords(coordA);
  const pB = extractCoords(coordB);
  const pC = extractCoords(coordC);
  const pD = extractCoords(coordD);

  if (!pA || !pB || !pC || !pD) return null;

  // b1 = B - A
  const b1x = pB[0] - pA[0];
  const b1y = pB[1] - pA[1];
  const b1z = pB[2] - pA[2];

  // b2 = C - B
  const b2x = pC[0] - pB[0];
  const b2y = pC[1] - pB[1];
  const b2z = pC[2] - pB[2];

  // b3 = D - C
  const b3x = pD[0] - pC[0];
  const b3y = pD[1] - pC[1];
  const b3z = pD[2] - pC[2];

  const magB2Sq = b2x * b2x + b2y * b2y + b2z * b2z;
  if (magB2Sq < 1e-16) return null; // Zero-length central bond
  const magB2 = Math.sqrt(magB2Sq);

  // n1 = b1 x b2
  const n1x = b1y * b2z - b1z * b2y;
  const n1y = b1z * b2x - b1x * b2z;
  const n1z = b1x * b2y - b1y * b2x;

  // n2 = b2 x b3
  const n2x = b2y * b3z - b2z * b3y;
  const n2y = b2z * b3x - b2x * b3z;
  const n2z = b2x * b3y - b2y * b3x;

  const magN1Sq = n1x * n1x + n1y * n1y + n1z * n1z;
  const magN2Sq = n2x * n2x + n2y * n2y + n2z * n2z;

  // Collinear triples (A-B-C or B-C-D) have undefined normal planes
  if (magN1Sq < 1e-16 || magN2Sq < 1e-16) {
    return null;
  }

  // Normalized central bond unit vector uB2 = b2 / |b2|
  const uB2x = b2x / magB2;
  const uB2y = b2y / magB2;
  const uB2z = b2z / magB2;

  // m1 = n1 x uB2
  const m1x = n1y * uB2z - n1z * uB2y;
  const m1y = n1z * uB2x - n1x * uB2z;
  const m1z = n1x * uB2y - n1y * uB2x;

  // x = n1 . n2
  const x = n1x * n2x + n1y * n2y + n1z * n2z;

  // y = m1 . n2
  const y = m1x * n2x + m1y * n2y + m1z * n2z;

  const phiRad = Math.atan2(y, x);
  return (phiRad * 180.0) / Math.PI;
}

/**
 * Formats a distance in Ångström for visual display.
 * Only rounds at format time; never during calculation.
 */
export function formatDistance(
  dist: number | null | undefined,
  precision: number = 2
): string {
  if (dist == null || !Number.isFinite(dist)) return '—';
  return `${dist.toFixed(precision)} Å`;
}

/**
 * Formats an angle in degrees for visual display.
 */
export function formatAngle(
  angleDeg: number | null | undefined,
  precision: number = 2
): string {
  if (angleDeg == null || !Number.isFinite(angleDeg)) return '—';
  return `${angleDeg.toFixed(precision)}°`;
}

export interface MeasurementResult {
  coordA: [number, number, number];
  coordB: [number, number, number];
  distanceAngstrom: number;
  label: string;
}

export function computeMeasurement(
  coordA: [number, number, number],
  coordB: [number, number, number]
): MeasurementResult {
  const d = calculateEuclideanDistance(coordA, coordB);
  return { coordA, coordB, distanceAngstrom: d, label: `${d.toFixed(2)} Å` };
}

