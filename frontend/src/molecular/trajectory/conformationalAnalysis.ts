/**
 * MOCS-Cert Trajectory Conformational Analysis Engine.
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: 
 * - Essential Dynamics / Biomolecular PCA: Amadei et al. (1993) Proteins 17:412-425
 * - Snapshot PCA Method: Sirovich (1987) Q. Appl. Math. 45:561-571
 * - Daura Conformational Clustering: Daura et al. (1999) Angew. Chem. Int. Ed. 38:236-240
 * 
 * Non-Negotiable Scientific Principles:
 * 1. Essential dynamics must operate on rotational/translational superposed coordinates to eliminate trivial rigid-body motions.
 * 2. Clustering must be deterministic and invariant to frame ordering.
 * 3. Never report arbitrary principal components without explaining variance fractions.
 */

import { calculateWeightedKabschAlignment } from '../protein/alignment';
import { calculateEuclideanDistance } from '../measurements/calculations';
import { computeAverageCoordinates } from './physicsMetrics';
import type {
  TrajectoryPcaResult,
  TrajectoryClusterResult,
} from './types';

export interface TrajectoryPcaOptions {
  atomIndices?: number[];
  alignToReference?: boolean; // Default true
  referenceCoords?: Array<[number, number, number]>; // Default: ensemble average structure
  maxIterations?: number; // Power iteration max iterations (default 100)
}

export interface TrajectoryClusteringOptions {
  atomIndices?: number[];
  rmsdCutoff?: number; // Cutoff in Ångströms (default 1.5 Å)
  alignFrames?: boolean; // Rigid-body Kabsch alignment between frame pairs (default true)
}

/**
 * Filters 3D coordinate array to selected atom indices if provided.
 */
function filterCoordinates(
  coords: Array<[number, number, number]>,
  atomIndices?: number[]
): Array<[number, number, number]> {
  if (!atomIndices || atomIndices.length === 0) return coords;
  const n = coords.length;
  return atomIndices.map((idx) => {
    if (idx < 0 || idx >= n) {
      throw new Error(`Atom index ${idx} out of range [0, ${n}).`);
    }
    return coords[idx];
  });
}

/**
 * Computes pairwise RMSD matrix between all frames in a trajectory.
 * Symmetrical M x M matrix with zero diagonal.
 */
export function calculateTrajectoryRmsdMatrix(
  allFramesCoords: Array<Array<[number, number, number]>>,
  options: TrajectoryClusteringOptions = {}
): number[][] {
  if (!allFramesCoords || allFramesCoords.length === 0) {
    throw new Error('Trajectory coordinate array is empty.');
  }

  const numFrames = allFramesCoords.length;
  const align = options.alignFrames ?? true;
  const atomIndices = options.atomIndices;

  // Filter coordinate sets
  const filteredFrames: Array<Array<[number, number, number]>> = [];
  for (let f = 0; f < numFrames; f++) {
    filteredFrames.push(filterCoordinates(allFramesCoords[f], atomIndices));
  }

  const matrix: number[][] = Array.from({ length: numFrames }, () =>
    new Array(numFrames).fill(0)
  );

  for (let i = 0; i < numFrames; i++) {
    for (let j = i + 1; j < numFrames; j++) {
      let rmsd = 0;
      if (align) {
        const res = calculateWeightedKabschAlignment(filteredFrames[i], filteredFrames[j]);
        rmsd = res.rmsd;
      } else {
        let sumSq = 0;
        const nAtoms = filteredFrames[i].length;
        for (let a = 0; a < nAtoms; a++) {
          const d = calculateEuclideanDistance(filteredFrames[i][a], filteredFrames[j][a]);
          sumSq += d * d;
        }
        rmsd = Math.sqrt(sumSq / nAtoms);
      }

      const rounded = Number(rmsd.toFixed(4));
      matrix[i][j] = rounded;
      matrix[j][i] = rounded;
    }
  }

  return matrix;
}

/**
 * Performs Daura RMSD-based conformational clustering on MD trajectory frames.
 * 
 * Algorithm:
 * 1. Count neighbors with RMSD <= cutoff for each unclustered frame.
 * 2. Designate frame with highest neighbor count as cluster medoid.
 * 3. Form cluster with medoid and all its neighbors.
 * 4. Remove cluster frames from pool and repeat until all frames clustered.
 */
export function clusterTrajectoryConformations(
  allFramesCoords: Array<Array<[number, number, number]>>,
  options: TrajectoryClusteringOptions = {}
): TrajectoryClusterResult {
  const numFrames = allFramesCoords.length;
  if (numFrames === 0) {
    return {
      clusterCount: 0,
      clusterMedoids: [],
      clusterAssignments: [],
      clusterSizes: [],
      clusterFractions: [],
      rmsdCutoff: options.rmsdCutoff ?? 1.5,
    };
  }

  const cutoff = options.rmsdCutoff ?? 1.5;
  const rmsdMatrix = calculateTrajectoryRmsdMatrix(allFramesCoords, options);

  const unassigned = new Set<number>();
  for (let f = 0; f < numFrames; f++) unassigned.add(f);

  const clusterMedoids: number[] = [];
  const clusterAssignments: number[] = new Array(numFrames).fill(-1);
  const clusterSizes: number[] = [];
  const clusterFractions: number[] = [];

  let currentClusterIdx = 0;

  while (unassigned.size > 0) {
    // Find candidate among unassigned with the most neighbors in unassigned
    let bestCandidate = -1;
    let maxNeighbors = -1;
    let bestNeighborList: number[] = [];

    for (const i of unassigned) {
      const neighbors: number[] = [];
      for (const j of unassigned) {
        if (i === j || rmsdMatrix[i][j] <= cutoff) {
          neighbors.push(j);
        }
      }
      if (neighbors.length > maxNeighbors) {
        maxNeighbors = neighbors.length;
        bestCandidate = i;
        bestNeighborList = neighbors;
      }
    }

    if (bestCandidate === -1 || bestNeighborList.length === 0) {
      // Fallback for remaining singletons
      const rem = unassigned.values().next().value;
      if (rem !== undefined) {
        bestCandidate = rem;
        bestNeighborList = [rem];
      } else {
        break;
      }
    }

    clusterMedoids.push(bestCandidate);
    clusterSizes.push(bestNeighborList.length);
    clusterFractions.push(Number((bestNeighborList.length / numFrames).toFixed(4)));

    for (const member of bestNeighborList) {
      clusterAssignments[member] = currentClusterIdx;
      unassigned.delete(member);
    }

    currentClusterIdx++;
  }

  return {
    clusterCount: clusterMedoids.length,
    clusterMedoids,
    clusterAssignments,
    clusterSizes,
    clusterFractions,
    rmsdCutoff: cutoff,
  };
}

/**
 * Computes Principal Component Analysis (Essential Dynamics) on MD trajectory.
 * 
 * Uses the Snapshot PCA method (Sirovich, 1987) on Kabsch-superposed coordinates:
 * - Computes Gram matrix K = (1/M) X X^T of size M x M (where M is frame count)
 * - Solves top 2 eigenvalues/eigenvectors using power iteration with deflation
 * - Obtains projection trajectories onto PC1 and PC2
 */
export function computeTrajectoryPca(
  allFramesCoords: Array<Array<[number, number, number]>>,
  options: TrajectoryPcaOptions = {}
): TrajectoryPcaResult {
  if (!allFramesCoords || allFramesCoords.length === 0) {
    throw new Error('Trajectory coordinate array is empty.');
  }

  const numFrames = allFramesCoords.length;
  const atomIndices = options.atomIndices;
  const align = options.alignToReference ?? true;
  const maxIter = options.maxIterations ?? 100;

  // Filter coordinates
  const filteredFrames: Array<Array<[number, number, number]>> = [];
  for (let f = 0; f < numFrames; f++) {
    filteredFrames.push(filterCoordinates(allFramesCoords[f], atomIndices));
  }

  const numAtoms = filteredFrames[0].length;

  if (numFrames < 2) {
    return {
      atomCount: numAtoms,
      frameCount: numFrames,
      eigenvalues: [0, 0],
      explainedVarianceRatios: [0, 0],
      projectionsPC1: [0],
      projectionsPC2: [0],
      meanStructureCoords: filteredFrames[0],
    };
  }

  // 1. Establish reference coordinates for alignment (default: ensemble average)
  let refCoords: Array<[number, number, number]>;
  if (options.referenceCoords) {
    refCoords = filterCoordinates(options.referenceCoords, atomIndices);
  } else {
    refCoords = computeAverageCoordinates(filteredFrames);
  }

  // 2. Rigidly superpose each frame onto reference structure (if align === true)
  const alignedCoords: Array<Array<[number, number, number]>> = [];
  for (let f = 0; f < numFrames; f++) {
    if (align) {
      const alignRes = calculateWeightedKabschAlignment(filteredFrames[f], refCoords);
      alignedCoords.push(alignRes.superposedSourceCoords);
    } else {
      alignedCoords.push(filteredFrames[f]);
    }
  }

  // 3. Compute mean structure <r> across aligned coordinates
  const meanCoords = computeAverageCoordinates(alignedCoords);

  // 4. Flatten coordinates into row vectors of size 3N: X[f] = aligned[f] - mean
  const dim = 3 * numAtoms;
  const X: number[][] = Array.from({ length: numFrames }, () => new Array(dim).fill(0));

  for (let f = 0; f < numFrames; f++) {
    for (let i = 0; i < numAtoms; i++) {
      X[f][3 * i + 0] = alignedCoords[f][i][0] - meanCoords[i][0];
      X[f][3 * i + 1] = alignedCoords[f][i][1] - meanCoords[i][1];
      X[f][3 * i + 2] = alignedCoords[f][i][2] - meanCoords[i][2];
    }
  }

  // 5. Construct Gram matrix K = (1 / M) * X * X^T (M x M)
  const K: number[][] = Array.from({ length: numFrames }, () => new Array(numFrames).fill(0));
  let totalVariance = 0;

  for (let i = 0; i < numFrames; i++) {
    for (let j = i; j < numFrames; j++) {
      let dot = 0;
      for (let d = 0; d < dim; d++) {
        dot += X[i][d] * X[j][d];
      }
      const val = dot / numFrames;
      K[i][j] = val;
      K[j][i] = val;
    }
    totalVariance += K[i][i];
  }

  if (totalVariance < 1e-12) {
    return {
      atomCount: numAtoms,
      frameCount: numFrames,
      eigenvalues: [0, 0],
      explainedVarianceRatios: [0, 0],
      projectionsPC1: new Array(numFrames).fill(0),
      projectionsPC2: new Array(numFrames).fill(0),
      meanStructureCoords: meanCoords,
    };
  }

  // Power iteration helper on M x M symmetric matrix
  const powerIterate = (mat: number[][]): { eigenvalue: number; eigenvector: number[] } => {
    let v = new Array(numFrames).fill(1.0 / Math.sqrt(numFrames));
    let lambda = 0;

    for (let iter = 0; iter < maxIter; iter++) {
      const nextV = new Array(numFrames).fill(0);
      for (let r = 0; r < numFrames; r++) {
        let sum = 0;
        for (let c = 0; c < numFrames; c++) {
          sum += mat[r][c] * v[c];
        }
        nextV[r] = sum;
      }

      let norm = 0;
      for (let r = 0; r < numFrames; r++) norm += nextV[r] * nextV[r];
      norm = Math.sqrt(norm);

      if (norm < 1e-12) {
        break;
      }

      for (let r = 0; r < numFrames; r++) nextV[r] /= norm;
      v = nextV;
    }

    // Rayleigh quotient
    let num = 0;
    for (let r = 0; r < numFrames; r++) {
      let sum = 0;
      for (let c = 0; c < numFrames; c++) {
        sum += mat[r][c] * v[c];
      }
      num += v[r] * sum;
    }
    lambda = Math.max(0, num);

    return { eigenvalue: lambda, eigenvector: v };
  };

  // 6. Find PC1
  const pc1 = powerIterate(K);
  const lambda1 = pc1.eigenvalue;
  const v1 = pc1.eigenvector;

  // 7. Deflate K for PC2: K' = K - lambda1 * (v1 * v1^T)
  const K2: number[][] = Array.from({ length: numFrames }, () => new Array(numFrames).fill(0));
  for (let r = 0; r < numFrames; r++) {
    for (let c = 0; c < numFrames; c++) {
      K2[r][c] = K[r][c] - lambda1 * v1[r] * v1[c];
    }
  }

  const pc2 = powerIterate(K2);
  const lambda2 = pc2.eigenvalue;
  const v2 = pc2.eigenvector;

  // 8. Compute projections onto PC1 and PC2
  // Vector u1 = (1 / sqrt(M * lambda1)) * X^T * v1
  // Projection p1_f = X[f] · u1 = sqrt(M * lambda1) * v1[f]
  const scale1 = Math.sqrt(numFrames * lambda1);
  const scale2 = Math.sqrt(numFrames * lambda2);

  const projectionsPC1: number[] = [];
  const projectionsPC2: number[] = [];

  for (let f = 0; f < numFrames; f++) {
    projectionsPC1.push(Number((scale1 * v1[f]).toFixed(4)));
    projectionsPC2.push(Number((scale2 * v2[f]).toFixed(4)));
  }

  const evr1 = totalVariance > 0 ? Number((lambda1 / totalVariance).toFixed(4)) : 0;
  const evr2 = totalVariance > 0 ? Number((lambda2 / totalVariance).toFixed(4)) : 0;

  return {
    atomCount: numAtoms,
    frameCount: numFrames,
    eigenvalues: [Number(lambda1.toFixed(4)), Number(lambda2.toFixed(4))],
    explainedVarianceRatios: [evr1, evr2],
    projectionsPC1,
    projectionsPC2,
    meanStructureCoords: meanCoords,
  };
}
