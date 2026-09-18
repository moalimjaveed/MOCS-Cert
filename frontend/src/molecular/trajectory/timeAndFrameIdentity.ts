/**
 * Trajectory Frame Identity & Physical Time Management Engine.
 * 
 * Epistemic Rules:
 * 1. A frame index is NOT automatically physical simulation time.
 * 2. 500 frames does not automatically mean 500 ps.
 * 3. Timestamps must clearly state whether they are 'RECORDED' (from trajectory format headers),
 *    'INFERRED' (from user/metadata timestep parameters), or 'NOT_AVAILABLE'.
 * 4. Irregularly spaced frames require time-weighted statistical analysis.
 */

import type { TrajectoryFrameIdentity, FrameIntervalProfile } from './types';

/**
 * Constructs an authentic, epistemically declared TrajectoryFrameIdentity.
 */
export function createFrameIdentity(
  trajectoryId: string,
  frameIndex: number,
  options?: {
    simulationStep?: number | null;
    physicalTimePs?: number | null;
    timeSource?: 'RECORDED' | 'INFERRED' | 'NOT_AVAILABLE';
    modelIndex?: number;
  }
): TrajectoryFrameIdentity {
  const timePs = options?.physicalTimePs ?? null;
  const timeNs = timePs !== null ? Number((timePs / 1000.0).toFixed(6)) : null;

  return {
    trajectoryId,
    frameIndex,
    simulationStep: options?.simulationStep ?? null,
    physicalTimePs: timePs,
    physicalTimeNs: timeNs,
    timeSource: options?.timeSource ?? (timePs !== null ? 'INFERRED' : 'NOT_AVAILABLE'),
    modelIndex: options?.modelIndex ?? frameIndex,
  };
}

/**
 * Analyzes frame time interval profile to determine whether frames are uniformly
 * or irregularly spaced throughout the trajectory.
 */
export function analyzeFrameIntervals(
  timestampsPs: number[]
): FrameIntervalProfile {
  if (!timestampsPs || timestampsPs.length === 0) {
    return {
      isUniform: true,
      meanIntervalPs: 0,
      minIntervalPs: 0,
      maxIntervalPs: 0,
      timestampsPs: [],
      frameCount: 0,
    };
  }

  if (timestampsPs.length === 1) {
    return {
      isUniform: true,
      meanIntervalPs: 0,
      minIntervalPs: 0,
      maxIntervalPs: 0,
      timestampsPs,
      frameCount: 1,
    };
  }

  const intervals: number[] = [];
  let sumIntervals = 0;
  let minInterval = Infinity;
  let maxInterval = -Infinity;

  for (let i = 0; i < timestampsPs.length - 1; i++) {
    const dt = timestampsPs[i + 1] - timestampsPs[i];
    intervals.push(dt);
    sumIntervals += dt;
    if (dt < minInterval) minInterval = dt;
    if (dt > maxInterval) maxInterval = dt;
  }

  const meanInterval = sumIntervals / intervals.length;

  // Determine if intervals are uniform within floating-point tolerance (1e-4 ps)
  let isUniform = true;
  for (const dt of intervals) {
    if (Math.abs(dt - meanInterval) > 1e-4) {
      isUniform = false;
      break;
    }
  }

  return {
    isUniform,
    meanIntervalPs: Number(meanInterval.toFixed(4)),
    minIntervalPs: Number(minInterval.toFixed(4)),
    maxIntervalPs: Number(maxInterval.toFixed(4)),
    timestampsPs,
    frameCount: timestampsPs.length,
  };
}

/**
 * Calculates time-weighted contact occupancy for irregularly spaced frames:
 *   Occupancy_time = ( sum_{k} dt_k * contact_k ) / ( sum_{k} dt_k )
 */
export function calculateTimeWeightedOccupancy(
  contactFlags: boolean[],
  timestampsPs: number[]
): number {
  if (!contactFlags || !timestampsPs || contactFlags.length !== timestampsPs.length) {
    throw new Error('Contact flags and timestamps arrays must have identical non-zero lengths.');
  }

  const n = contactFlags.length;
  if (n <= 1) {
    return contactFlags[0] ? 1.0 : 0.0;
  }

  let totalDurationPs = 0;
  let activeDurationPs = 0;

  for (let i = 0; i < n - 1; i++) {
    const dt = timestampsPs[i + 1] - timestampsPs[i];
    if (dt > 0) {
      totalDurationPs += dt;
      if (contactFlags[i]) {
        activeDurationPs += dt;
      }
    }
  }

  if (totalDurationPs <= 0) {
    const activeCount = contactFlags.filter(Boolean).length;
    return activeCount / n;
  }

  return Number((activeDurationPs / totalDurationPs).toFixed(4));
}
