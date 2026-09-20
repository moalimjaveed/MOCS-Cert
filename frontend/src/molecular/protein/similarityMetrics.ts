/**
 * MOCS-Cert Protein Structural Biology — Structural Similarity Metrics Engine
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: TM-score (Zhang & Skolnick 2004), CASP GDT-TS/GDT-HA, dRMSD, Contact-Map Overlap
 */

import { calculateEuclideanDistance } from '../measurements/calculations';

/**
 * Computes characteristic distance d0(L) for TM-score according to Zhang & Skolnick (2004):
 * d0(L) = 1.24 * cbrt(L - 15) - 1.8 for L > 21, or 0.5 for L <= 21.
 */
export function calculateTmScoreD0(targetLength: number): number {
  if (targetLength <= 21) {
    return 0.5;
  }
  const d0 = 1.24 * Math.cbrt(targetLength - 15) - 1.8;
  return Number(Math.max(0.5, d0).toFixed(4));
}

/**
 * Computes authentic Zhang & Skolnick (2004) TM-score:
 * TM-score = (1 / L_target) * sum_i [ 1 / (1 + (d_i / d0)^2) ]
 * 
 * Range: (0, 1.0]. TM-score > 0.5 indicates same global fold (statistically significant).
 */
export function calculateTmScore(
  superposedSourceCoords: [number, number, number][],
  targetCoords: [number, number, number][],
  targetLength: number
): {
  tmScore: number;
  d0: number;
  targetLength: number;
  pairedCount: number;
  isSameFold: boolean;
} {
  const n = superposedSourceCoords.length;
  if (n === 0 || targetLength <= 0) {
    return {
      tmScore: 0,
      d0: 0.5,
      targetLength,
      pairedCount: 0,
      isSameFold: false,
    };
  }

  const d0 = calculateTmScoreD0(targetLength);
  const d0Sq = d0 * d0;
  let sumScore = 0;

  for (let i = 0; i < n; i++) {
    const d = calculateEuclideanDistance(superposedSourceCoords[i], targetCoords[i]);
    const dSq = d * d;
    sumScore += 1 / (1 + dSq / d0Sq);
  }

  const tmScore = Number((sumScore / targetLength).toFixed(4));
  return {
    tmScore: Math.min(1.0, tmScore),
    d0,
    targetLength,
    pairedCount: n,
    isSameFold: tmScore > 0.5,
  };
}

/**
 * Computes Global Distance Test scores (GDT-TS and GDT-HA) used in CASP:
 * GDT-TS = (P1 + P2 + P4 + P8) / 4
 * GDT-HA = (P0.5 + P1 + P2 + P4) / 4
 * where Pd is percentage of residues with d_i <= d Å normalized by targetLength.
 */
export function calculateGdtScores(
  superposedSourceCoords: [number, number, number][],
  targetCoords: [number, number, number][],
  targetLength: number
): {
  gdtTs: number;
  gdtHa: number;
  cutoffs: {
    p0_5: number;
    p1_0: number;
    p2_0: number;
    p4_0: number;
    p8_0: number;
  };
} {
  const n = superposedSourceCoords.length;
  if (n === 0 || targetLength <= 0) {
    return {
      gdtTs: 0,
      gdtHa: 0,
      cutoffs: { p0_5: 0, p1_0: 0, p2_0: 0, p4_0: 0, p8_0: 0 },
    };
  }

  let count0_5 = 0;
  let count1_0 = 0;
  let count2_0 = 0;
  let count4_0 = 0;
  let count8_0 = 0;

  for (let i = 0; i < n; i++) {
    const d = calculateEuclideanDistance(superposedSourceCoords[i], targetCoords[i]);
    if (d <= 0.5) count0_5++;
    if (d <= 1.0) count1_0++;
    if (d <= 2.0) count2_0++;
    if (d <= 4.0) count4_0++;
    if (d <= 8.0) count8_0++;
  }

  const p0_5 = Number(((count0_5 / targetLength) * 100).toFixed(2));
  const p1_0 = Number(((count1_0 / targetLength) * 100).toFixed(2));
  const p2_0 = Number(((count2_0 / targetLength) * 100).toFixed(2));
  const p4_0 = Number(((count4_0 / targetLength) * 100).toFixed(2));
  const p8_0 = Number(((count8_0 / targetLength) * 100).toFixed(2));

  const gdtTs = Number(((p1_0 + p2_0 + p4_0 + p8_0) / 4).toFixed(2));
  const gdtHa = Number(((p0_5 + p1_0 + p2_0 + p4_0) / 4).toFixed(2));

  return {
    gdtTs,
    gdtHa,
    cutoffs: {
      p0_5,
      p1_0,
      p2_0,
      p4_0,
      p8_0,
    },
  };
}

/**
 * Computes full pairwise distance matrix for an array of 3D coordinates:
 * D_ij = ||p_i - p_j||
 */
export function computeDistanceMatrix(
  coords: [number, number, number][]
): number[][] {
  const n = coords.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = calculateEuclideanDistance(coords[i], coords[j]);
      matrix[i][j] = d;
      matrix[j][i] = d;
    }
  }

  return matrix;
}

/**
 * Computes Distance Matrix RMSD (dRMSD) between two paired coordinate sets:
 * dRMSD = sqrt( (1 / (N * (N - 1))) * sum_{i != j} (D_ij^A - D_ij^B)^2 )
 * 
 * Inherent physical property: dRMSD is strictly rotation- and translation-invariant
 * WITHOUT requiring rigid-body superposition!
 */
export function calculateDistanceMatrixRmsd(
  coordsA: [number, number, number][],
  coordsB: [number, number, number][]
): number {
  const n = coordsA.length;
  if (n !== coordsB.length) {
    throw new Error(`dRMSD requires identical point counts: coordsA has ${n}, coordsB has ${coordsB.length}.`);
  }
  if (n <= 1) return 0;

  const matA = computeDistanceMatrix(coordsA);
  const matB = computeDistanceMatrix(coordsB);

  let sumSqDiff = 0;
  let pairCount = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const diff = matA[i][j] - matB[i][j];
      sumSqDiff += diff * diff;
      pairCount++;
    }
  }

  if (pairCount === 0) return 0;
  return Number(Math.sqrt(sumSqDiff / pairCount).toFixed(4));
}

/**
 * Computes binary contact map adjacency matrix:
 * C_ij = 1 if D_ij <= cutoffAngstroms and |i - j| >= minSeqSeparation, else 0.
 */
export function computeContactMatrix(
  coords: [number, number, number][],
  cutoffAngstroms = 8.0,
  minSeqSeparation = 3
): boolean[][] {
  const n = coords.length;
  const matrix: boolean[][] = Array.from({ length: n }, () => new Array(n).fill(false));

  for (let i = 0; i < n; i++) {
    for (let j = i + minSeqSeparation; j < n; j++) {
      const d = calculateEuclideanDistance(coords[i], coords[j]);
      if (d <= cutoffAngstroms) {
        matrix[i][j] = true;
        matrix[j][i] = true;
      }
    }
  }

  return matrix;
}

/**
 * Compares two binary contact matrices and computes Jaccard and Dice similarity coefficients.
 */
export function calculateContactMapSimilarity(
  matrixA: boolean[][],
  matrixB: boolean[][],
  cutoffAngstroms = 8.0
): {
  cutoffAngstroms: number;
  jaccardSimilarity: number;
  diceSimilarity: number;
  contactsSourceCount: number;
  contactsTargetCount: number;
  commonContactsCount: number;
} {
  const n = Math.min(matrixA.length, matrixB.length);
  let contactsA = 0;
  let contactsB = 0;
  let commonContacts = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = matrixA[i][j];
      const b = matrixB[i][j];
      if (a) contactsA++;
      if (b) contactsB++;
      if (a && b) commonContacts++;
    }
  }

  const unionContacts = contactsA + contactsB - commonContacts;
  const jaccard = unionContacts > 0 ? Number((commonContacts / unionContacts).toFixed(4)) : 1.0;
  const dice = contactsA + contactsB > 0 ? Number(((2 * commonContacts) / (contactsA + contactsB)).toFixed(4)) : 1.0;

  return {
    cutoffAngstroms,
    jaccardSimilarity: jaccard,
    diceSimilarity: dice,
    contactsSourceCount: contactsA,
    contactsTargetCount: contactsB,
    commonContactsCount: commonContacts,
  };
}
