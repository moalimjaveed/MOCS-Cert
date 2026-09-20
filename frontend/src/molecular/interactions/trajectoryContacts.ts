/**
 * MOCS-Cert Trajectory Interaction & Contact Occupancy Engine
 * 
 * Epistemic Rules:
 * 1. Contact occupancy is strictly defined as N_active_frames / M_total_frames.
 * 2. Contact occupancy is NOT binding affinity, association rate (kon), or residence time.
 * 3. Never calculate trajectory statistics from a static single frame.
 */

import { calculateEuclideanDistance } from '../measurements/calculations';
import type { TrajectoryContactOccupancy } from './types';

export interface FrameCoordinateSlice {
  frameIndex: number;
  sourceCoord: [number, number, number];
  targetCoord: [number, number, number];
}

/**
 * Calculates dynamic contact statistics and contact occupancy across trajectory frames.
 */
export function calculateTrajectoryContactOccupancy(
  slices: FrameCoordinateSlice[],
  pairKey: string,
  sourceLabel: string,
  targetLabel: string,
  cutoffAngstroms = 4.0
): TrajectoryContactOccupancy {
  if (!slices || slices.length === 0) {
    return {
      pairKey,
      sourceLabel,
      targetLabel,
      contactCount: 0,
      totalFrames: 0,
      occupancyFraction: 0.0,
      minDistance: 0.0,
      maxDistance: 0.0,
      meanDistance: 0.0,
      disclaimer: 'Zero frames evaluated.',
    };
  }

  let contactCount = 0;
  let minD = Infinity;
  let maxD = -Infinity;
  let sumD = 0;

  for (const s of slices) {
    const d = calculateEuclideanDistance(s.sourceCoord, s.targetCoord);
    if (d <= cutoffAngstroms) {
      contactCount++;
    }
    if (d < minD) minD = d;
    if (d > maxD) maxD = d;
    sumD += d;
  }

  const totalFrames = slices.length;
  const occupancyFraction = Number((contactCount / totalFrames).toFixed(4));
  const meanDistance = Number((sumD / totalFrames).toFixed(2));
  const minDistance = Number(minD.toFixed(2));
  const maxDistance = Number(maxD.toFixed(2));

  const disclaimer =
    `Geometric contact occupancy: ${contactCount} of ${totalFrames} frames (${(occupancyFraction * 100).toFixed(1)}%) ` +
    `within ${cutoffAngstroms} A cutoff. Does not represent kinetic residence time, dissociation rate (koff), or thermodynamic deltaG.`;

  return {
    pairKey,
    sourceLabel,
    targetLabel,
    contactCount,
    totalFrames,
    occupancyFraction,
    minDistance,
    maxDistance,
    meanDistance,
    disclaimer,
  };
}
