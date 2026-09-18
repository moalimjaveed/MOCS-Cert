/**
 * Trajectory Pairwise Contact Map Engine.
 * 
 * Computes time-averaged inter-atomic distance matrix and contact frequency matrix
 * across all evaluated trajectory frames.
 */

import { calculateEuclideanDistance } from '../measurements/calculations';
import { calculateMinimumImageDistance } from './physicsMetrics';
import type { TrajectoryContactMapResult } from './types';

/**
 * Computes pairwise contact frequency matrix and average distance matrix across frames.
 */
export function calculateTrajectoryContactMap(
  allFramesCoords: Array<Array<[number, number, number]>>,
  cutoffDistance: number,
  boxDimensions?: [number, number, number]
): TrajectoryContactMapResult {
  if (!allFramesCoords || allFramesCoords.length === 0) {
    throw new Error('Trajectory coordinate array is empty.');
  }

  const numFrames = allFramesCoords.length;
  const numAtoms = allFramesCoords[0].length;

  const averageDistanceMatrix: number[][] = Array.from({ length: numAtoms }, () =>
    new Array(numAtoms).fill(0)
  );
  const contactFrequencyMatrix: number[][] = Array.from({ length: numAtoms }, () =>
    new Array(numAtoms).fill(0)
  );

  for (let f = 0; f < numFrames; f++) {
    const frame = allFramesCoords[f];
    for (let i = 0; i < numAtoms; i++) {
      for (let j = i + 1; j < numAtoms; j++) {
        let dist: number;
        if (boxDimensions) {
          dist = calculateMinimumImageDistance(frame[i], frame[j], boxDimensions);
        } else {
          dist = calculateEuclideanDistance(frame[i], frame[j]);
        }

        averageDistanceMatrix[i][j] += dist;
        if (dist <= cutoffDistance) {
          contactFrequencyMatrix[i][j] += 1;
        }
      }
    }
  }

  // Finalize averages and symmetrize
  for (let i = 0; i < numAtoms; i++) {
    averageDistanceMatrix[i][i] = 0;
    contactFrequencyMatrix[i][i] = 1.0;

    for (let j = i + 1; j < numAtoms; j++) {
      const avgDist = Number((averageDistanceMatrix[i][j] / numFrames).toFixed(3));
      const freq = Number((contactFrequencyMatrix[i][j] / numFrames).toFixed(4));

      averageDistanceMatrix[i][j] = avgDist;
      averageDistanceMatrix[j][i] = avgDist;

      contactFrequencyMatrix[i][j] = freq;
      contactFrequencyMatrix[j][i] = freq;
    }
  }

  return {
    atomCount: numAtoms,
    averageDistanceMatrix,
    contactFrequencyMatrix,
    cutoffDistance,
    analyzedFrameCount: numFrames,
  };
}
