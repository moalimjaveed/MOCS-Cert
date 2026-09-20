/**
 * MOCS-Cert Protein Structural Biology — Kabsch Structural Alignment & RMSD Engine
 * 
 * Epistemic Status: ESTABLISHED
 * Mathematical Foundation: Kabsch (1976, 1978) / Horn (1987) / Kearsley (1989)
 * 
 * Computes the unique optimal rigid-body 3D rotation and translation that minimizes
 * the Root-Mean-Square Deviation (RMSD) between two paired coordinate sets.
 * Guarantees proper rotations (det(R) = +1, zero reflections).
 */

import type { KabschAlignmentResult } from './types';
import type { WeightedKabschResult, TrimmedRmsdResult, WeightScheme } from './comparisonTypes';
import { calculateEuclideanDistance } from '../measurements/calculations';

/**
 * Computes 3x3 matrix determinant:
 * det(R) = R00*(R11*R22 - R12*R21) - R01*(R10*R22 - R12*R20) + R02*(R10*R21 - R11*R20)
 */
export function computeMatrix3Determinant(
  R: [[number, number, number], [number, number, number], [number, number, number]] | number[][]
): number {
  return (
    R[0][0] * (R[1][1] * R[2][2] - R[1][2] * R[2][1]) -
    R[0][1] * (R[1][0] * R[2][2] - R[1][2] * R[2][0]) +
    R[0][2] * (R[1][0] * R[2][1] - R[1][1] * R[2][0])
  );
}

/**
 * Computes raw (unaligned) coordinate RMSD between two paired coordinate sets:
 * rawRMSD = sqrt( (1/N) * sum_i ||p_i - q_i||^2 )
 */
export function calculateRawCoordinateRmsd(
  coordsA: [number, number, number][],
  coordsB: [number, number, number][]
): number {
  if (!coordsA || !coordsB || coordsA.length === 0 || coordsB.length === 0) {
    return 0;
  }
  if (coordsA.length !== coordsB.length) {
    throw new Error(
      `Coordinate array length mismatch: coordsA has ${coordsA.length} points, coordsB has ${coordsB.length} points. Structural RMSD requires paired coordinates.`
    );
  }

  let sumSq = 0;
  const n = coordsA.length;
  for (let i = 0; i < n; i++) {
    const d = calculateEuclideanDistance(coordsA[i], coordsB[i]);
    sumSq += d * d;
  }
  return Number(Math.sqrt(sumSq / n).toFixed(4));
}

/**
 * Computes geometric centroid of a 3D point set.
 */
export function computePointCentroid(
  coords: [number, number, number][]
): [number, number, number] {
  if (!coords || coords.length === 0) return [0, 0, 0];
  let sumX = 0, sumY = 0, sumZ = 0;
  for (const [x, y, z] of coords) {
    sumX += x;
    sumY += y;
    sumZ += z;
  }
  const n = coords.length;
  return [sumX / n, sumY / n, sumZ / n];
}

/**
 * Computes weighted centroid of a 3D point set.
 */
export function computeWeightedCentroid(
  coords: [number, number, number][],
  weights: number[]
): [number, number, number] {
  const n = coords.length;
  if (n === 0) return [0, 0, 0];
  let sumX = 0, sumY = 0, sumZ = 0;
  let totalW = 0;
  for (let i = 0; i < n; i++) {
    const w = weights[i] ?? 1.0;
    totalW += w;
    sumX += coords[i][0] * w;
    sumY += coords[i][1] * w;
    sumZ += coords[i][2] * w;
  }
  if (totalW === 0) return computePointCentroid(coords);
  return [sumX / totalW, sumY / totalW, sumZ / totalW];
}

/**
 * Multiplies a 4x4 symmetric matrix by a 4D vector.
 */
function multiplyMatrix4Vector4(
  M: number[][],
  v: [number, number, number, number]
): [number, number, number, number] {
  return [
    M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2] + M[0][3] * v[3],
    M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2] + M[1][3] * v[3],
    M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2] + M[2][3] * v[3],
    M[3][0] * v[0] + M[3][1] * v[1] + M[3][2] * v[2] + M[3][3] * v[3],
  ];
}

/**
 * Finds the eigenvector corresponding to the maximum positive eigenvalue of a 4x4 symmetric matrix
 * using power iteration with a positive Gershgorin diagonal shift.
 * 
 * Essential for Horn's quaternion method: guarantees maximizing q^T F q (minimizing RMSD)
 * and eliminates axis-rotation instability or convergence to negative eigenvalues.
 */
function findDominantEigenvector4(M: number[][], maxIterations = 80): [number, number, number, number] {
  // Compute upper bound on matrix norm (Gershgorin row sum)
  let maxRowSum = 0;
  for (let i = 0; i < 4; i++) {
    let rowSum = 0;
    for (let j = 0; j < 4; j++) {
      rowSum += Math.abs(M[i][j]);
    }
    if (rowSum > maxRowSum) maxRowSum = rowSum;
  }
  const mu = maxRowSum + 1.0;

  const shiftedM: number[][] = [
    [M[0][0] + mu, M[0][1], M[0][2], M[0][3]],
    [M[1][0], M[1][1] + mu, M[1][2], M[1][3]],
    [M[2][0], M[2][1], M[2][2] + mu, M[2][3]],
    [M[3][0], M[3][1], M[3][2], M[3][3] + mu],
  ];

  let v: [number, number, number, number] = [1, 0.5, 0.5, 0.5];
  let norm = Math.hypot(...v);
  v = [v[0] / norm, v[1] / norm, v[2] / norm, v[3] / norm];

  for (let iter = 0; iter < maxIterations; iter++) {
    const nextV = multiplyMatrix4Vector4(shiftedM, v);
    const nextNorm = Math.hypot(...nextV);
    if (nextNorm < 1e-12) {
      return [1, 0, 0, 0];
    }
    const normalized: [number, number, number, number] = [
      nextV[0] / nextNorm,
      nextV[1] / nextNorm,
      nextV[2] / nextNorm,
      nextV[3] / nextNorm,
    ];

    const diff = Math.hypot(
      normalized[0] - v[0],
      normalized[1] - v[1],
      normalized[2] - v[2],
      normalized[3] - v[3]
    );
    v = normalized;
    if (diff < 1e-11) break;
  }

  return v;
}

/**
 * Converts a normalized unit quaternion [w, x, y, z] to a 3x3 rotation matrix.
 */
export function quaternionToRotationMatrix(
  q: [number, number, number, number]
): [[number, number, number], [number, number, number], [number, number, number]] {
  const [w, x, y, z] = q;
  return [
    [
      1 - 2 * (y * y + z * z),
      2 * (x * y - w * z),
      2 * (x * z + w * y),
    ],
    [
      2 * (x * y + w * z),
      1 - 2 * (x * x + z * z),
      2 * (y * z - w * x),
    ],
    [
      2 * (x * z - w * y),
      2 * (y * z + w * x),
      1 - 2 * (x * x + y * y),
    ],
  ];
}

/**
 * Applies a 3x3 rotation matrix to a 3D vector.
 */
export function rotateVector3(
  R: [[number, number, number], [number, number, number], [number, number, number]] | number[][],
  v: [number, number, number]
): [number, number, number] {
  return [
    R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2],
    R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2],
    R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2],
  ];
}

/**
 * Applies rigid-body transformation: x' = R * x + t
 */
export function applyRigidTransformation(
  coords: [number, number, number][],
  R: [[number, number, number], [number, number, number], [number, number, number]],
  t: [number, number, number]
): [number, number, number][] {
  return coords.map((p) => {
    const rot = rotateVector3(R, p);
    return [rot[0] + t[0], rot[1] + t[1], rot[2] + t[2]];
  });
}

/**
 * Inverts a rigid transformation:
 * If x' = R x + t, then x = R^T (x' - t) = R^T x' - R^T t
 */
export function invertRigidTransformation(
  R: [[number, number, number], [number, number, number], [number, number, number]],
  t: [number, number, number]
): {
  invR: [[number, number, number], [number, number, number], [number, number, number]];
  invT: [number, number, number];
} {
  // Transpose of orthogonal matrix is its inverse
  const invR: [[number, number, number], [number, number, number], [number, number, number]] = [
    [R[0][0], R[1][0], R[2][0]],
    [R[0][1], R[1][1], R[2][1]],
    [R[0][2], R[1][2], R[2][2]],
  ];
  const rotT = rotateVector3(invR, t);
  const invT: [number, number, number] = [-rotT[0], -rotT[1], -rotT[2]];
  return { invR, invT };
}

/**
 * Performs optimal weighted or unweighted Kabsch structural superposition of sourceCoords onto targetCoords.
 */
export function calculateWeightedKabschAlignment(
  sourceCoords: [number, number, number][],
  targetCoords: [number, number, number][],
  weights?: number[],
  weightScheme: WeightScheme = 'uniform'
): WeightedKabschResult {
  if (!sourceCoords || !targetCoords) {
    throw new Error('Coordinates must not be null or undefined.');
  }
  const n = sourceCoords.length;
  if (n !== targetCoords.length) {
    throw new Error(
      `Kabsch alignment requires identical paired point counts: source has ${n}, target has ${targetCoords.length}.`
    );
  }
  if (n === 0) {
    throw new Error('Cannot align empty coordinate sets.');
  }

  const rawRmsd = calculateRawCoordinateRmsd(sourceCoords, targetCoords);
  const wArray = weights && weights.length === n ? weights : new Array(n).fill(1.0);
  let totalW = 0;
  for (let i = 0; i < n; i++) totalW += wArray[i];
  if (totalW <= 0) totalW = n;

  // 1. Centroids
  const cSource = computeWeightedCentroid(sourceCoords, wArray);
  const cTarget = computeWeightedCentroid(targetCoords, wArray);

  // If single atom, optimal alignment is pure translation to target centroid
  if (n === 1) {
    const translation: [number, number, number] = [
      cTarget[0] - cSource[0],
      cTarget[1] - cSource[1],
      cTarget[2] - cSource[2],
    ];
    return {
      pairedAtomCount: 1,
      rmsd: 0,
      rawRmsd,
      weightedRmsd: 0,
      weightScheme,
      rotationMatrix: [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      translationVector: translation,
      rotationDeterminant: 1.0,
      isProperRotation: true,
      centroidSource: cSource,
      centroidTarget: cTarget,
      superposedSourceCoords: [[...targetCoords[0]]],
    };
  }

  // 2. Center coordinates
  const pCentered: [number, number, number][] = sourceCoords.map(([x, y, z]) => [
    x - cSource[0],
    y - cSource[1],
    z - cSource[2],
  ]);
  const qCentered: [number, number, number][] = targetCoords.map(([x, y, z]) => [
    x - cTarget[0],
    y - cTarget[1],
    z - cTarget[2],
  ]);

  // 3. Compute 3x3 weighted cross-dispersion matrix C = sum(w_i * p_i * q_i^T)
  const C: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < n; i++) {
    const p = pCentered[i];
    const q = qCentered[i];
    const w = wArray[i];
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        C[j][k] += w * p[j] * q[k];
      }
    }
  }

  // 4. Construct Horn 4x4 key matrix F
  const c00 = C[0][0], c01 = C[0][1], c02 = C[0][2];
  const c10 = C[1][0], c11 = C[1][1], c12 = C[1][2];
  const c20 = C[2][0], c21 = C[2][1], c22 = C[2][2];

  const F: number[][] = [
    [
      c00 + c11 + c22,
      c12 - c21,
      c20 - c02,
      c01 - c10,
    ],
    [
      c12 - c21,
      c00 - c11 - c22,
      c01 + c10,
      c20 + c02,
    ],
    [
      c20 - c02,
      c01 + c10,
      -c00 + c11 - c22,
      c12 + c21,
    ],
    [
      c01 - c10,
      c20 + c02,
      c12 + c21,
      -c00 - c11 + c22,
    ],
  ];

  // 5. Dominant eigenvector of F gives optimal unit quaternion
  const qOpt = findDominantEigenvector4(F);

  // 6. Convert quaternion to optimal 3x3 rotation matrix R
  const R = quaternionToRotationMatrix(qOpt);

  // 7. Verify determinant (must be +1.0 for a proper physical rotation, zero reflection)
  const detR = computeMatrix3Determinant(R);
  const isProperRotation = Math.abs(detR - 1.0) < 0.005;

  // 8. Compute translation vector: t = cTarget - R * cSource
  const rotCSource = rotateVector3(R, cSource);
  const translationVector: [number, number, number] = [
    cTarget[0] - rotCSource[0],
    cTarget[1] - rotCSource[1],
    cTarget[2] - rotCSource[2],
  ];

  // 9. Superpose coordinates and compute RMSD
  const superposedSourceCoords: [number, number, number][] = [];
  let sumSqDiff = 0;
  let sumWeightedSqDiff = 0;

  for (let i = 0; i < n; i++) {
    const rotP = rotateVector3(R, pCentered[i]);
    const sx = rotP[0] + cTarget[0];
    const sy = rotP[1] + cTarget[1];
    const sz = rotP[2] + cTarget[2];

    superposedSourceCoords.push([
      Number(sx.toFixed(4)),
      Number(sy.toFixed(4)),
      Number(sz.toFixed(4)),
    ]);

    const dx = sx - targetCoords[i][0];
    const dy = sy - targetCoords[i][1];
    const dz = sz - targetCoords[i][2];
    const distSq = dx * dx + dy * dy + dz * dz;

    sumSqDiff += distSq;
    sumWeightedSqDiff += distSq * wArray[i];
  }

  const rmsd = Number(Math.sqrt(sumSqDiff / n).toFixed(4));
  const weightedRmsd = Number(Math.sqrt(sumWeightedSqDiff / totalW).toFixed(4));

  return {
    pairedAtomCount: n,
    rmsd,
    rawRmsd,
    weightedRmsd,
    weightScheme,
    rotationMatrix: [
      [Number(R[0][0].toFixed(5)), Number(R[0][1].toFixed(5)), Number(R[0][2].toFixed(5))],
      [Number(R[1][0].toFixed(5)), Number(R[1][1].toFixed(5)), Number(R[1][2].toFixed(5))],
      [Number(R[2][0].toFixed(5)), Number(R[2][1].toFixed(5)), Number(R[2][2].toFixed(5))],
    ],
    translationVector: [
      Number(translationVector[0].toFixed(4)),
      Number(translationVector[1].toFixed(4)),
      Number(translationVector[2].toFixed(4)),
    ],
    rotationDeterminant: Number(detR.toFixed(4)),
    isProperRotation,
    centroidSource: [
      Number(cSource[0].toFixed(4)),
      Number(cSource[1].toFixed(4)),
      Number(cSource[2].toFixed(4)),
    ],
    centroidTarget: [
      Number(cTarget[0].toFixed(4)),
      Number(cTarget[1].toFixed(4)),
      Number(cTarget[2].toFixed(4)),
    ],
    superposedSourceCoords,
  };
}

/**
 * Standard Kabsch alignment (backward-compatible signature).
 */
export function calculateKabschAlignment(
  sourceCoords: [number, number, number][],
  targetCoords: [number, number, number][]
): KabschAlignmentResult {
  const res = calculateWeightedKabschAlignment(sourceCoords, targetCoords);
  return {
    pairedAtomCount: res.pairedAtomCount,
    rmsd: res.rmsd,
    rawRmsd: res.rawRmsd,
    rotationMatrix: res.rotationMatrix,
    translationVector: res.translationVector,
    centroidSource: res.centroidSource,
    centroidTarget: res.centroidTarget,
    superposedSourceCoords: res.superposedSourceCoords,
  };
}

/**
 * Computes outlier-trimmed RMSD (e.g. RMSD95 / core RMSD) by excluding the top (100 - percentage)%
 * of worst-fitting pairs. Excluded residue keys are explicitly returned (never silent!).
 */
export function calculateTrimmedRmsd(
  superposedSourceCoords: [number, number, number][],
  targetCoords: [number, number, number][],
  residueKeys?: string[],
  trimmingPercentage = 95
): TrimmedRmsdResult {
  const n = superposedSourceCoords.length;
  if (n === 0) {
    return {
      trimmedRmsd: 0,
      trimmingPercentage,
      includedCount: 0,
      excludedCount: 0,
      excludedResidueKeys: [],
    };
  }

  const pairs: Array<{ index: number; distSq: number; key: string }> = [];
  for (let i = 0; i < n; i++) {
    const d = calculateEuclideanDistance(superposedSourceCoords[i], targetCoords[i]);
    pairs.push({
      index: i,
      distSq: d * d,
      key: residueKeys ? residueKeys[i] : `atom_${i}`,
    });
  }

  // Sort by ascending displacement
  pairs.sort((a, b) => a.distSq - b.distSq);

  const keepCount = Math.max(1, Math.floor((n * trimmingPercentage) / 100));
  const kept = pairs.slice(0, keepCount);
  const excluded = pairs.slice(keepCount);

  let sumSq = 0;
  for (const p of kept) sumSq += p.distSq;

  return {
    trimmedRmsd: Number(Math.sqrt(sumSq / kept.length).toFixed(4)),
    trimmingPercentage,
    includedCount: kept.length,
    excludedCount: excluded.length,
    excludedResidueKeys: excluded.map((e) => e.key),
  };
}

/**
 * Structural alignment helper that extracts matching atoms (e.g. C-alpha)
 * between two structures based on exact residue sequence and atom name correspondence.
 */
export function pairAtomsForAlignment(
  atomsA: Array<{ chain: string; resSeq: number; insCode?: string; atomName: string; coords: [number, number, number] }>,
  atomsB: Array<{ chain: string; resSeq: number; insCode?: string; atomName: string; coords: [number, number, number] }>,
  targetAtomName = 'CA'
): {
  pairedCoordsA: [number, number, number][];
  pairedCoordsB: [number, number, number][];
  pairedLabels: string[];
  unmatchedACount: number;
  unmatchedBCount: number;
} {
  const mapB = new Map<string, [number, number, number]>();
  for (const b of atomsB) {
    if (targetAtomName && b.atomName !== targetAtomName) continue;
    const key = `${b.chain}:${b.resSeq}${b.insCode || ''}:${b.atomName}`;
    mapB.set(key, b.coords);
  }

  const pairedCoordsA: [number, number, number][] = [];
  const pairedCoordsB: [number, number, number][] = [];
  const pairedLabels: string[] = [];
  let matchedBCount = 0;

  for (const a of atomsA) {
    if (targetAtomName && a.atomName !== targetAtomName) continue;
    const key = `${a.chain}:${a.resSeq}${a.insCode || ''}:${a.atomName}`;
    const bCoords = mapB.get(key);
    if (bCoords) {
      pairedCoordsA.push(a.coords);
      pairedCoordsB.push(bCoords);
      pairedLabels.push(key);
      matchedBCount++;
    }
  }

  const totalATarget = atomsA.filter((a) => !targetAtomName || a.atomName === targetAtomName).length;
  const totalBTarget = atomsB.filter((b) => !targetAtomName || b.atomName === targetAtomName).length;

  return {
    pairedCoordsA,
    pairedCoordsB,
    pairedLabels,
    unmatchedACount: totalATarget - pairedCoordsA.length,
    unmatchedBCount: totalBTarget - matchedBCount,
  };
}
