/**
 * Periodic Boundary Conditions (PBC) & Molecular Imaging Engine.
 * 
 * Provides authentic physical algorithms for:
 * - Minimum image convention for orthorhombic simulation boxes
 * - Molecule unwrapping across periodic boundaries (preventing artificial bond stretching)
 * - Trajectory-wide temporal unwrapping (continuous coordinate diffusion)
 * - Box centering (positioning molecular centroid at box center [Lx/2, Ly/2, Lz/2])
 * - Box wrapping into [0, L)
 * 
 * Epistemic Mandate: Strictly restricted to orthorhombic periodic boundary conditions.
 * Fails closed with UnsupportedBoxGeometryError when presented with triclinic cells,
 * non-orthogonal unit angles, non-finite values, or degenerate dimensions (<= 0).
 */

import { validateOrthorhombicBox, UnsupportedBoxGeometryError } from '../measurements/calculations';

/**
 * Evaluates 1D minimum image displacement:
 *   dx_pbc = dx - L * round(dx / L)
 * Fails closed if box dimension is non-positive or non-finite.
 */
export function minimumImage1D(dx: number, boxLength: number): number {
  if (boxLength <= 0 || !Number.isFinite(boxLength)) {
    throw new UnsupportedBoxGeometryError(
      `Invalid simulation box dimension: ${boxLength}. Box dimensions must be strictly positive (> 0) and finite.`
    );
  }
  return dx - boxLength * Math.round(dx / boxLength);
}

/**
 * Computes 3D minimum-image vector between point A and point B:
 *   dr = rA - rB
 *   dr_pbc = [minimumImage1D(dr_x, Lx), minimumImage1D(dr_y, Ly), minimumImage1D(dr_z, Lz)]
 */
export function minimumImageVector(
  pA: [number, number, number],
  pB: [number, number, number],
  box: [number, number, number] | any
): [number, number, number] {
  const [boxX, boxY, boxZ] = validateOrthorhombicBox(box);
  return [
    minimumImage1D(pA[0] - pB[0], boxX),
    minimumImage1D(pA[1] - pB[1], boxY),
    minimumImage1D(pA[2] - pB[2], boxZ),
  ];
}

/**
 * Unwraps a bonded chain of atoms within a single frame to eliminate
 * artificial periodic boundary crossing jumps (where bonded atoms appear on
 * opposite sides of the simulation box).
 * 
 * P1-19: Genuine BFS connected-component traversal invariant to bond ordering:
 * Each component is traversed from a root node; each child atom is unwrapped
 * strictly relative to its already-unwrapped parent in the BFS tree.
 */
export function unwrapBondedMolecule(
  coords: Array<[number, number, number]>,
  bonds: Array<[number, number]>,
  box: [number, number, number] | any
): Array<[number, number, number]> {
  const [boxX, boxY, boxZ] = validateOrthorhombicBox(box);
  const validBox = [boxX, boxY, boxZ];

  if (!coords || coords.length <= 1) return coords ? coords.map((p) => [...p]) : [];
  if (!bonds || bonds.length === 0) return coords.map((p) => [...p]);

  const unwrapped = coords.map((p) => [...p] as [number, number, number]);
  const visited = new Uint8Array(coords.length);

  // Build undirected adjacency graph
  const adj = new Map<number, number[]>();
  for (const [atom1, atom2] of bonds) {
    if (atom1 < 0 || atom1 >= coords.length || atom2 < 0 || atom2 >= coords.length || atom1 === atom2) {
      continue;
    }
    if (!adj.has(atom1)) adj.set(atom1, []);
    if (!adj.has(atom2)) adj.set(atom2, []);
    adj.get(atom1)!.push(atom2);
    adj.get(atom2)!.push(atom1);
  }

  // BFS traversal per connected component
  for (let root = 0; root < coords.length; root++) {
    if (visited[root]) continue;
    visited[root] = 1;

    const queue: number[] = [root];
    while (queue.length > 0) {
      const parent = queue.shift()!;
      const parentCoord = unwrapped[parent];
      const neighbors = adj.get(parent) || [];

      for (const child of neighbors) {
        if (!visited[child]) {
          visited[child] = 1;
          const childCoord = unwrapped[child];

          for (let axis = 0; axis < 3; axis++) {
            const boxL = validBox[axis];
            const delta = childCoord[axis] - parentCoord[axis];
            const shift = Math.round(delta / boxL);
            childCoord[axis] -= shift * boxL;
          }

          queue.push(child);
        }
      }
    }
  }

  return unwrapped;
}

/**
 * Continuous trajectory unwrapping across frames:
 * For each atom i across time t = 1 ... M-1:
 *   if |r_i(t) - r_i(t-1)| > L / 2:
 *     r_i(t) -= round( (r_i(t) - r_i(t-1)) / L ) * L
 * 
 * Ensures continuous diffusion coordinates without box-boundary teleportation.
 */
export function unwrapTrajectoryOverTime(
  allFramesCoords: Array<Array<[number, number, number]>>,
  box: [number, number, number] | any
): Array<Array<[number, number, number]>> {
  const [boxX, boxY, boxZ] = validateOrthorhombicBox(box);
  const validBox = [boxX, boxY, boxZ];

  if (!allFramesCoords || allFramesCoords.length <= 1) {
    return allFramesCoords.map((frame) => frame.map((p) => [...p]));
  }

  const numFrames = allFramesCoords.length;
  const numAtoms = allFramesCoords[0].length;
  const unwrappedFrames: Array<Array<[number, number, number]>> = [
    allFramesCoords[0].map((p) => [...p] as [number, number, number]),
  ];

  for (let f = 1; f < numFrames; f++) {
    const prevFrame = unwrappedFrames[f - 1];
    const currFrame = allFramesCoords[f].map((p) => [...p] as [number, number, number]);

    for (let i = 0; i < numAtoms; i++) {
      for (let axis = 0; axis < 3; axis++) {
        const boxL = validBox[axis];
        const delta = currFrame[i][axis] - prevFrame[i][axis];
        const shift = Math.round(delta / boxL);
        currFrame[i][axis] -= shift * boxL;
      }
    }
    unwrappedFrames.push(currFrame);
  }

  return unwrappedFrames;
}

/**
 * Centers molecular coordinates in the simulation box:
 * Translates molecular centroid to [Lx / 2, Ly / 2, Lz / 2].
 */
export function centerMoleculeInBox(
  coords: Array<[number, number, number]>,
  box: [number, number, number] | any
): Array<[number, number, number]> {
  const [boxX, boxY, boxZ] = validateOrthorhombicBox(box);
  if (!coords || coords.length === 0) return [];
  const n = coords.length;
  let sumX = 0, sumY = 0, sumZ = 0;
  for (const [x, y, z] of coords) {
    sumX += x;
    sumY += y;
    sumZ += z;
  }
  const centroid = [sumX / n, sumY / n, sumZ / n];
  const target = [boxX / 2, boxY / 2, boxZ / 2];

  const shift = [
    target[0] - centroid[0],
    target[1] - centroid[1],
    target[2] - centroid[2],
  ];

  return coords.map(([x, y, z]) => [x + shift[0], y + shift[1], z + shift[2]]);
}

/**
 * Wraps all atomic coordinates strictly into the periodic primary box [0, L):
 *   x_wrapped = x - floor(x / L) * L
 * Uses full double precision without premature rounding.
 */
export function wrapCoordinatesIntoPrimaryBox(
  coords: Array<[number, number, number]>,
  box: [number, number, number] | any
): Array<[number, number, number]> {
  const [boxX, boxY, boxZ] = validateOrthorhombicBox(box);
  return coords.map(([x, y, z]) => {
    const wx = x - Math.floor(x / boxX) * boxX;
    const wy = y - Math.floor(y / boxY) * boxY;
    const wz = z - Math.floor(z / boxZ) * boxZ;
    return [wx, wy, wz];
  });
}

function invert3x3(m: number[][]): number[][] {
  const [ [a, b, c], [d, e, f], [g, h, k] ] = m;
  const A = e * k - f * h;
  const B = -(d * k - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12 || !Number.isFinite(det)) {
    throw new UnsupportedBoxGeometryError("Simulation cell is singular, degenerate, or non-invertible.");
  }
  const invDet = 1.0 / det;
  return [
    [A * invDet, (c * h - b * k) * invDet, (b * f - c * e) * invDet],
    [B * invDet, (a * k - c * g) * invDet, (c * d - a * f) * invDet],
    [C * invDet, (b * g - a * h) * invDet, (a * e - b * d) * invDet],
  ];
}

/**
 * Canonical PeriodicCell for general periodic boundary geometry in TypeScript.
 */
export class PeriodicCell {
  readonly matrix: number[][]; // Columns are [a, b, c]
  readonly invMatrix: number[][];
  readonly lengths: [number, number, number];
  readonly angles: [number, number, number];
  readonly volume: number;
  readonly isOrthorhombic: boolean;
  readonly cellType: 'orthorhombic' | 'triclinic';
  private readonly shifts27: Array<[number, number, number]>;

  constructor(matrix: number[][]) {
    this.matrix = matrix;
    const a = [matrix[0][0], matrix[1][0], matrix[2][0]];
    const b = [matrix[0][1], matrix[1][1], matrix[2][1]];
    const c = [matrix[0][2], matrix[1][2], matrix[2][2]];

    const norm = (v: number[]) => Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
    const dot = (u: number[], v: number[]) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

    const la = norm(a);
    const lb = norm(b);
    const lc = norm(c);

    if (la <= 1e-12 || lb <= 1e-12 || lc <= 1e-12) {
      throw new UnsupportedBoxGeometryError(`Degenerate simulation cell lengths: [${la}, ${lb}, ${lc}]`);
    }

    this.lengths = [la, lb, lc];
    this.invMatrix = invert3x3(matrix);

    const cosAlpha = Math.max(-1, Math.min(1, dot(b, c) / (lb * lc)));
    const cosBeta = Math.max(-1, Math.min(1, dot(a, c) / (la * lc)));
    const cosGamma = Math.max(-1, Math.min(1, dot(a, b) / (la * lb)));

    const alpha = (Math.acos(cosAlpha) * 180) / Math.PI;
    const beta = (Math.acos(cosBeta) * 180) / Math.PI;
    const gamma = (Math.acos(cosGamma) * 180) / Math.PI;
    this.angles = [alpha, beta, gamma];

    const isOrtho =
      Math.abs(alpha - 90) <= 1e-3 &&
      Math.abs(beta - 90) <= 1e-3 &&
      Math.abs(gamma - 90) <= 1e-3 &&
      Math.abs(matrix[0][1]) <= 1e-6 &&
      Math.abs(matrix[0][2]) <= 1e-6 &&
      Math.abs(matrix[1][0]) <= 1e-6 &&
      Math.abs(matrix[1][2]) <= 1e-6 &&
      Math.abs(matrix[2][0]) <= 1e-6 &&
      Math.abs(matrix[2][1]) <= 1e-6;

    this.isOrthorhombic = isOrtho;
    this.cellType = isOrtho ? 'orthorhombic' : 'triclinic';
    this.volume = isOrtho ? la * lb * lc : Math.abs(matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1]) - matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0]) + matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0]));

    // Precompute 27 shifts in Cartesian coordinates: n_a * a + n_b * b + n_c * c
    const shifts: Array<[number, number, number]> = [];
    for (let na = -1; na <= 1; na++) {
      for (let nb = -1; nb <= 1; nb++) {
        for (let nc = -1; nc <= 1; nc++) {
          shifts.push([
            na * a[0] + nb * b[0] + nc * c[0],
            na * a[1] + nb * b[1] + nc * c[1],
            na * a[2] + nb * b[2] + nc * c[2],
          ]);
        }
      }
    }
    this.shifts27 = shifts;
  }

  static fromLengthsAndAngles(
    lx: number,
    ly: number,
    lz: number,
    alpha: number = 90,
    beta: number = 90,
    gamma: number = 90
  ): PeriodicCell {
    return PeriodicCell.fromDimensions([lx, ly, lz, alpha, beta, gamma]);
  }

  static fromDimensions(dims: any): PeriodicCell {
    if (!dims) {
      throw new UnsupportedBoxGeometryError("Simulation box definition cannot be null.");
    }
    if (dims instanceof PeriodicCell) {
      return dims;
    }
    if (Array.isArray(dims)) {
      if (dims.length === 3 && Array.isArray(dims[0])) {
        // 3x3 matrix (rows are vectors) -> transpose to columns
        const m = dims as number[][];
        return new PeriodicCell([
          [m[0][0], m[1][0], m[2][0]],
          [m[0][1], m[1][1], m[2][1]],
          [m[0][2], m[1][2], m[2][2]],
        ]);
      }
      if (dims.length === 3) {
        const [lx, ly, lz] = dims;
        return new PeriodicCell([
          [lx, 0, 0],
          [0, ly, 0],
          [0, 0, lz],
        ]);
      }
      if (dims.length === 6) {
        const [lx, ly, lz, alpha, beta, gamma] = dims;
        if (
          Math.abs(alpha - 90) <= 1e-3 &&
          Math.abs(beta - 90) <= 1e-3 &&
          Math.abs(gamma - 90) <= 1e-3
        ) {
          return new PeriodicCell([
            [lx, 0, 0],
            [0, ly, 0],
            [0, 0, lz],
          ]);
        }
        const aRad = (alpha * Math.PI) / 180;
        const bRad = (beta * Math.PI) / 180;
        const gRad = (gamma * Math.PI) / 180;
        const sinG = Math.sin(gRad);
        if (Math.abs(sinG) < 1e-12) {
          throw new UnsupportedBoxGeometryError(`Collinear cell basis: gamma=${gamma}°`);
        }
        const ax = lx, ay = 0, az = 0;
        const bx = ly * Math.cos(gRad), by = ly * sinG, bz = 0;
        const cx = lz * Math.cos(bRad);
        const cy = lz * (Math.cos(aRad) - Math.cos(bRad) * Math.cos(gRad)) / sinG;
        const czSq = lz ** 2 - cx ** 2 - cy ** 2;
        if (czSq < 0) {
          throw new UnsupportedBoxGeometryError("Invalid triclinic cell angles: cannot embed in 3D.");
        }
        const cz = Math.sqrt(Math.max(0, czSq));
        return new PeriodicCell([
          [ax, bx, cx],
          [ay, by, cy],
          [az, bz, cz],
        ]);
      }
    }
    if (typeof dims === 'object') {
      const lx = dims.lx ?? dims.x ?? dims.lengths?.[0] ?? dims.dimensions?.[0];
      const ly = dims.ly ?? dims.y ?? dims.lengths?.[1] ?? dims.dimensions?.[1];
      const lz = dims.lz ?? dims.z ?? dims.lengths?.[2] ?? dims.dimensions?.[2];
      const alpha = dims.alpha ?? dims.angles?.[0] ?? 90;
      const beta = dims.beta ?? dims.angles?.[1] ?? 90;
      const gamma = dims.gamma ?? dims.angles?.[2] ?? 90;
      if (lx && ly && lz) {
        return PeriodicCell.fromDimensions([lx, ly, lz, alpha, beta, gamma]);
      }
    }
    throw new UnsupportedBoxGeometryError("Unrecognized simulation cell dimensions format.");
  }

  get dimensions(): [number, number, number, number, number, number] {
    return [
      this.lengths[0],
      this.lengths[1],
      this.lengths[2],
      this.angles[0],
      this.angles[1],
      this.angles[2],
    ];
  }

  toFractional(r: [number, number, number]): [number, number, number] {
    const m = this.invMatrix;
    return [
      m[0][0] * r[0] + m[0][1] * r[1] + m[0][2] * r[2],
      m[1][0] * r[0] + m[1][1] * r[1] + m[1][2] * r[2],
      m[2][0] * r[0] + m[2][1] * r[1] + m[2][2] * r[2],
    ];
  }

  toCartesian(s: [number, number, number]): [number, number, number] {
    const m = this.matrix;
    return [
      m[0][0] * s[0] + m[0][1] * s[1] + m[0][2] * s[2],
      m[1][0] * s[0] + m[1][1] * s[1] + m[1][2] * s[2],
      m[2][0] * s[0] + m[2][1] * s[1] + m[2][2] * s[2],
    ];
  }

  minimumImageDisplacement(delta: [number, number, number]): [number, number, number] {
    if (this.isOrthorhombic) {
      const [lx, ly, lz] = this.lengths;
      return [
        delta[0] - lx * Math.round(delta[0] / lx),
        delta[1] - ly * Math.round(delta[1] / ly),
        delta[2] - lz * Math.round(delta[2] / lz),
      ];
    }
    const s = this.toFractional(delta);
    const s0: [number, number, number] = [
      s[0] - Math.round(s[0]),
      s[1] - Math.round(s[1]),
      s[2] - Math.round(s[2]),
    ];
    const d0 = this.toCartesian(s0);

    let bestDistSq = Infinity;
    let bestDisp: [number, number, number] = d0;

    for (const sh of this.shifts27) {
      const cx = d0[0] + sh[0];
      const cy = d0[1] + sh[1];
      const cz = d0[2] + sh[2];
      const distSq = cx * cx + cy * cy + cz * cz;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestDisp = [cx, cy, cz];
      }
    }
    return bestDisp;
  }

  minimumImageDistance(delta: [number, number, number]): number {
    const d = this.minimumImageDisplacement(delta);
    return Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
  }

  wrapToCell(cart: [number, number, number]): [number, number, number] {
    const s = this.toFractional(cart);
    const wrappedS: [number, number, number] = [
      s[0] - Math.floor(s[0]),
      s[1] - Math.floor(s[1]),
      s[2] - Math.floor(s[2]),
    ];
    return this.toCartesian(wrappedS);
  }
}

/** Canonical 7 directions for 14-DOP in R^3 */
const INV_SQRT3 = 1.0 / Math.sqrt(3.0);
export const CANONICAL_KDOP14_DIRECTIONS: Array<[number, number, number]> = [
  [1.0, 0.0, 0.0],
  [0.0, 1.0, 0.0],
  [0.0, 0.0, 1.0],
  [INV_SQRT3, INV_SQRT3, INV_SQRT3],
  [INV_SQRT3, INV_SQRT3, -INV_SQRT3],
  [INV_SQRT3, -INV_SQRT3, INV_SQRT3],
  [-INV_SQRT3, INV_SQRT3, INV_SQRT3],
];

export class KDOP14 {
  readonly minProjections: number[];
  readonly maxProjections: number[];
  readonly directions: Array<[number, number, number]>;

  constructor(
    minProjections: number[],
    maxProjections: number[],
    directions: Array<[number, number, number]> = CANONICAL_KDOP14_DIRECTIONS
  ) {
    if (minProjections.length !== 7 || maxProjections.length !== 7) {
      throw new Error(`KDOP14 requires 7 min and 7 max projections, got ${minProjections.length}, ${maxProjections.length}`);
    }
    this.minProjections = [...minProjections];
    this.maxProjections = [...maxProjections];
    this.directions = directions.map(d => [...d] as [number, number, number]);
  }

  static fromCoordinates(coords: Array<[number, number, number]>): KDOP14 {
    if (!coords || coords.length === 0) {
      throw new Error("Cannot construct KDOP14 from empty coordinates array.");
    }
    const mins = new Array(7).fill(Infinity);
    const maxs = new Array(7).fill(-Infinity);

    for (const p of coords) {
      for (let k = 0; k < 7; k++) {
        const u = CANONICAL_KDOP14_DIRECTIONS[k];
        const proj = p[0] * u[0] + p[1] * u[1] + p[2] * u[2];
        if (proj < mins[k]) mins[k] = proj;
        if (proj > maxs[k]) maxs[k] = proj;
      }
    }
    return new KDOP14(mins, maxs);
  }

  aabbVolume(): number {
    const dx = Math.max(0, this.maxProjections[0] - this.minProjections[0]);
    const dy = Math.max(0, this.maxProjections[1] - this.minProjections[1]);
    const dz = Math.max(0, this.maxProjections[2] - this.minProjections[2]);
    return dx * dy * dz;
  }

  computeEuclideanBounds(other: KDOP14): [number, number] {
    const gaps = new Array(7);
    for (let k = 0; k < 7; k++) {
      const g1 = other.minProjections[k] - this.maxProjections[k];
      const g2 = this.minProjections[k] - other.maxProjections[k];
      gaps[k] = Math.max(0, Math.max(g1, g2));
    }
    const lOrtho = Math.sqrt(gaps[0] * gaps[0] + gaps[1] * gaps[1] + gaps[2] * gaps[2]);
    let lDiag = 0;
    for (let k = 3; k < 7; k++) {
      if (gaps[k] > lDiag) lDiag = gaps[k];
    }
    const L = Math.max(lOrtho, lDiag);

    const dxMax = Math.max(
      Math.abs(this.maxProjections[0] - other.minProjections[0]),
      Math.abs(other.maxProjections[0] - this.minProjections[0])
    );
    const dyMax = Math.max(
      Math.abs(this.maxProjections[1] - other.minProjections[1]),
      Math.abs(other.maxProjections[1] - this.minProjections[1])
    );
    const dzMax = Math.max(
      Math.abs(this.maxProjections[2] - other.minProjections[2]),
      Math.abs(other.maxProjections[2] - this.minProjections[2])
    );
    const U = Math.sqrt(dxMax * dxMax + dyMax * dyMax + dzMax * dzMax);
    return [L, U];
  }

  computePeriodicBounds(other: KDOP14, cell: PeriodicCell): [number, number] {
    const ca: [number, number, number] = [
      0.5 * (this.minProjections[0] + this.maxProjections[0]),
      0.5 * (this.minProjections[1] + this.maxProjections[1]),
      0.5 * (this.minProjections[2] + this.maxProjections[2]),
    ];
    const cb: [number, number, number] = [
      0.5 * (other.minProjections[0] + other.maxProjections[0]),
      0.5 * (other.minProjections[1] + other.maxProjections[1]),
      0.5 * (other.minProjections[2] + other.maxProjections[2]),
    ];
    const deltaC: [number, number, number] = [cb[0] - ca[0], cb[1] - ca[1], cb[2] - ca[2]];
    const sc = cell.toFractional(deltaC);
    const k0: [number, number, number] = [Math.round(sc[0]), Math.round(sc[1]), Math.round(sc[2])];

    let minL = Infinity;
    let minU = Infinity;

    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        for (let k = -1; k <= 1; k++) {
          const shiftFrac: [number, number, number] = [k0[0] + i, k0[1] + j, k0[2] + k];
          const shift = cell.toCartesian(shiftFrac);

          const shiftedMins = new Array(7);
          const shiftedMaxs = new Array(7);
          for (let d = 0; d < 7; d++) {
            const u = this.directions[d];
            const sProj = shift[0] * u[0] + shift[1] * u[1] + shift[2] * u[2];
            shiftedMins[d] = other.minProjections[d] - sProj;
            shiftedMaxs[d] = other.maxProjections[d] - sProj;
          }
          const otherShifted = new KDOP14(shiftedMins, shiftedMaxs, this.directions);
          const [ls, us] = this.computeEuclideanBounds(otherShifted);
          if (ls < minL) minL = ls;
          if (us < minU) minU = us;
        }
      }
    }
    const L = Math.max(0, minL);
    const U = Math.max(L, minU);
    return [L, U];
  }

  computeBounds(other: KDOP14, cell?: PeriodicCell): [number, number] {
    if (!cell) return this.computeEuclideanBounds(other);
    return this.computePeriodicBounds(other, cell);
  }
}


