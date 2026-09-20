/**
 * MOCS-Cert Trajectory Time-Series Analytics Engine.
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: IUPAC Dihedral Conventions, Circular Statistics (Fisher, 1993), Geometric H-Bond Criteria
 * 
 * Provides:
 * 1. 3-point Bond Angle Time Series with numerical [-1, 1] cosine clamping
 * 2. 4-point Dihedral Angle Time Series with phase unwrapping and circular statistics
 * 3. Hydrogen-Bond Occupancy and persistence analysis
 */

import { calculateEuclideanDistance } from '../measurements/calculations';
import { calculateMinimumImageDistance } from './physicsMetrics';
import type {
  TrajectoryAngleResult,
  TrajectoryDihedralResult,
  TrajectoryHbondResult,
} from './types';

/**
 * Computes 3-point bond angle in degrees across all trajectory frames:
 *   cos(theta) = ((A - B) · (C - B)) / (||A - B|| * ||C - B||)
 */
export function calculateTrajectoryAngleSeries(
  allFramesCoords: Array<Array<[number, number, number]>>,
  atomAIndex: number,
  atomBIndex: number,
  atomCIndex: number
): TrajectoryAngleResult {
  if (!allFramesCoords || allFramesCoords.length === 0) {
    throw new Error('Trajectory coordinate array is empty.');
  }

  const numFrames = allFramesCoords.length;
  const numAtoms = allFramesCoords[0].length;

  if (
    atomAIndex < 0 || atomAIndex >= numAtoms ||
    atomBIndex < 0 || atomBIndex >= numAtoms ||
    atomCIndex < 0 || atomCIndex >= numAtoms
  ) {
    throw new Error(`Angle atom indices [${atomAIndex}, ${atomBIndex}, ${atomCIndex}] out of bounds [0, ${numAtoms}).`);
  }

  const angleSeriesDeg: number[] = [];
  let sumAngle = 0;
  let minAngle = Infinity;
  let maxAngle = -Infinity;

  const radToDeg = 180.0 / Math.PI;

  for (let f = 0; f < numFrames; f++) {
    const pA = allFramesCoords[f][atomAIndex];
    const pB = allFramesCoords[f][atomBIndex];
    const pC = allFramesCoords[f][atomCIndex];

    const baX = pA[0] - pB[0], baY = pA[1] - pB[1], baZ = pA[2] - pB[2];
    const bcX = pC[0] - pB[0], bcY = pC[1] - pB[1], bcZ = pC[2] - pB[2];

    const lenBA = Math.sqrt(baX * baX + baY * baY + baZ * baZ);
    const lenBC = Math.sqrt(bcX * bcX + bcY * bcY + bcZ * bcZ);

    let angleDeg = 0;
    if (lenBA > 1e-6 && lenBC > 1e-6) {
      const dot = baX * bcX + baY * bcY + baZ * bcZ;
      // Numerical clamping to [-1.0, 1.0] avoids NaN from slight float rounding
      const clampedCos = Math.max(-1.0, Math.min(1.0, dot / (lenBA * lenBC)));
      angleDeg = Math.acos(clampedCos) * radToDeg;
    }

    const rounded = Number(angleDeg.toFixed(2));
    angleSeriesDeg.push(rounded);
    sumAngle += rounded;
    if (rounded < minAngle) minAngle = rounded;
    if (rounded > maxAngle) maxAngle = rounded;
  }

  const meanAngle = Number((sumAngle / numFrames).toFixed(2));

  // Compute standard deviation
  let sumSqDev = 0;
  for (let f = 0; f < numFrames; f++) {
    const diff = angleSeriesDeg[f] - meanAngle;
    sumSqDev += diff * diff;
  }
  const stdDev = Number(Math.sqrt(sumSqDev / numFrames).toFixed(2));

  return {
    atomIndices: [atomAIndex, atomBIndex, atomCIndex],
    angleSeriesDeg,
    meanAngleDeg: meanAngle,
    stdDevDeg: stdDev,
    minAngleDeg: minAngle,
    maxAngleDeg: maxAngle,
    frameCount: numFrames,
  };
}

/**
 * Computes 4-point IUPAC dihedral angle in degrees across all trajectory frames:
 * Incorporates circular statistics and continuous phase unwrapping.
 */
export function calculateTrajectoryDihedralSeries(
  allFramesCoords: Array<Array<[number, number, number]>>,
  atomAIndex: number,
  atomBIndex: number,
  atomCIndex: number,
  atomDIndex: number
): TrajectoryDihedralResult {
  if (!allFramesCoords || allFramesCoords.length === 0) {
    throw new Error('Trajectory coordinate array is empty.');
  }

  const numFrames = allFramesCoords.length;
  const numAtoms = allFramesCoords[0].length;

  if (
    atomAIndex < 0 || atomAIndex >= numAtoms ||
    atomBIndex < 0 || atomBIndex >= numAtoms ||
    atomCIndex < 0 || atomCIndex >= numAtoms ||
    atomDIndex < 0 || atomDIndex >= numAtoms
  ) {
    throw new Error(`Dihedral atom indices [${atomAIndex}, ${atomBIndex}, ${atomCIndex}, ${atomDIndex}] out of bounds [0, ${numAtoms}).`);
  }

  const dihedralSeriesDeg: number[] = [];
  const unwrappedSeriesDeg: number[] = [];
  let minAngle = Infinity;
  let maxAngle = -Infinity;

  let sumSin = 0;
  let sumCos = 0;
  const degToRad = Math.PI / 180.0;
  const radToDeg = 180.0 / Math.PI;

  let prevAngle = 0;

  for (let f = 0; f < numFrames; f++) {
    const pA = allFramesCoords[f][atomAIndex];
    const pB = allFramesCoords[f][atomBIndex];
    const pC = allFramesCoords[f][atomCIndex];
    const pD = allFramesCoords[f][atomDIndex];

    // Vectors b1 = B - A, b2 = C - B, b3 = D - C
    const b1x = pB[0] - pA[0], b1y = pB[1] - pA[1], b1z = pB[2] - pA[2];
    const b2x = pC[0] - pB[0], b2y = pC[1] - pB[1], b2z = pC[2] - pB[2];
    const b3x = pD[0] - pC[0], b3y = pD[1] - pC[1], b3z = pD[2] - pC[2];

    // n1 = b1 × b2
    const n1x = b1y * b2z - b1z * b2y;
    const n1y = b1z * b2x - b1x * b2z;
    const n1z = b1x * b2y - b1y * b2x;

    // n2 = b2 × b3
    const n2x = b2y * b3z - b2z * b3y;
    const n2y = b2z * b3x - b2x * b3z;
    const n2z = b2x * b3y - b2y * b3x;

    // m1 = (b2 / ||b2||) × n1
    const lenB2 = Math.sqrt(b2x * b2x + b2y * b2y + b2z * b2z);
    const uB2x = lenB2 > 1e-6 ? b2x / lenB2 : 0;
    const uB2y = lenB2 > 1e-6 ? b2y / lenB2 : 0;
    const uB2z = lenB2 > 1e-6 ? b2z / lenB2 : 0;

    const m1x = uB2y * n1z - uB2z * n1y;
    const m1y = uB2z * n1x - uB2x * n1z;
    const m1z = uB2x * n1y - uB2y * n1x;

    const x = n1x * n2x + n1y * n2y + n1z * n2z;
    const y = m1x * n2x + m1y * n2y + m1z * n2z;

    const angleDeg = Math.atan2(y, x) * radToDeg;
    const rounded = Number(angleDeg.toFixed(2));
    dihedralSeriesDeg.push(rounded);

    if (rounded < minAngle) minAngle = rounded;
    if (rounded > maxAngle) maxAngle = rounded;

    // Accumulate circular statistics
    const rad = rounded * degToRad;
    sumSin += Math.sin(rad);
    sumCos += Math.cos(rad);

    // Continuous unwrapping: eliminate sudden ±360 jumps
    if (f === 0) {
      unwrappedSeriesDeg.push(rounded);
      prevAngle = rounded;
    } else {
      let diff = rounded - (prevAngle % 360);
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      const unwrapped = prevAngle + diff;
      unwrappedSeriesDeg.push(Number(unwrapped.toFixed(2)));
      prevAngle = unwrapped;
    }
  }

  // Circular mean: atan2(sum(sin), sum(cos))
  const circularMeanRad = Math.atan2(sumSin / numFrames, sumCos / numFrames);
  const circularMeanDeg = Number((circularMeanRad * radToDeg).toFixed(2));

  // Circular variance: S = 1 - R, where R = sqrt(meanCos² + meanSin²)
  const meanSin = sumSin / numFrames;
  const meanCos = sumCos / numFrames;
  const R = Math.sqrt(meanSin * meanSin + meanCos * meanCos);
  const circularVariance = Number(Math.max(0, Math.min(1.0, 1.0 - R)).toFixed(4));

  return {
    atomIndices: [atomAIndex, atomBIndex, atomCIndex, atomDIndex],
    dihedralSeriesDeg,
    unwrappedSeriesDeg,
    circularMeanDeg,
    circularVariance,
    minAngleDeg: minAngle,
    maxAngleDeg: maxAngle,
    frameCount: numFrames,
  };
}

export interface HydrogenBondAnalysisOptions {
  cutoffDistance?: number;   // Default 3.50 Å (Donor-Acceptor)
  minAngleDeg?: number;      // Default 120.0° (Donor-H...Acceptor)
  usePbc?: boolean;
  boxDimensions?: [number, number, number];
}

/**
 * Evaluates hydrogen-bond occupancy and lifetime persistence over a trajectory.
 * Requires both distance and angular geometric criteria when hydrogen coordinates exist.
 */
export function calculateTrajectoryHydrogenBondOccupancy(
  allFramesCoords: Array<Array<[number, number, number]>>,
  donorIndex: number,
  acceptorIndex: number,
  hydrogenIndex?: number,
  options: HydrogenBondAnalysisOptions = {}
): TrajectoryHbondResult {
  if (!allFramesCoords || allFramesCoords.length === 0) {
    throw new Error('Trajectory coordinate array is empty.');
  }

  const numFrames = allFramesCoords.length;
  const numAtoms = allFramesCoords[0].length;
  const cutoffDist = options.cutoffDistance ?? 3.50;
  const minAngleDeg = options.minAngleDeg ?? 120.0;
  const usePbc = options.usePbc ?? false;
  const box = options.boxDimensions;

  if (donorIndex < 0 || donorIndex >= numAtoms || acceptorIndex < 0 || acceptorIndex >= numAtoms) {
    throw new Error(`H-bond atom indices [${donorIndex}, ${acceptorIndex}] out of bounds.`);
  }

  const hasH = hydrogenIndex !== undefined && hydrogenIndex >= 0 && hydrogenIndex < numAtoms;

  const distanceSeries: number[] = [];
  const angleSeriesDeg: number[] = [];
  const contactFlags: boolean[] = [];

  let contactCount = 0;
  let sumDistance = 0;
  let sumAngle = 0;

  // Uninterrupted lifetime tracker
  const uninterruptedLifetimes: number[] = [];
  let currentLifetime = 0;

  const radToDeg = 180.0 / Math.PI;

  for (let f = 0; f < numFrames; f++) {
    const pD = allFramesCoords[f][donorIndex];
    const pA = allFramesCoords[f][acceptorIndex];

    // 1. Distance check
    let dist: number;
    if (usePbc && box) {
      dist = calculateMinimumImageDistance(pD, pA, box);
    } else {
      dist = calculateEuclideanDistance(pD, pA);
    }
    dist = Number(dist.toFixed(3));
    distanceSeries.push(dist);
    sumDistance += dist;

    // 2. Angle check (if hydrogen index provided)
    let isAngleSatisfied = true;
    if (hasH) {
      const pH = allFramesCoords[f][hydrogenIndex!];
      // Vectors: hd = D - H, ha = A - H
      const hdX = pD[0] - pH[0], hdY = pD[1] - pH[1], hdZ = pD[2] - pH[2];
      const haX = pA[0] - pH[0], haY = pA[1] - pH[1], haZ = pA[2] - pH[2];
      const lenHD = Math.sqrt(hdX * hdX + hdY * hdY + hdZ * hdZ);
      const lenHA = Math.sqrt(haX * haX + haY * haY + haZ * haZ);

      let angleDeg = 0;
      if (lenHD > 1e-6 && lenHA > 1e-6) {
        const dot = hdX * haX + hdY * haY + hdZ * haZ;
        const clamped = Math.max(-1.0, Math.min(1.0, dot / (lenHD * lenHA)));
        angleDeg = Math.acos(clamped) * radToDeg;
      }
      angleDeg = Number(angleDeg.toFixed(2));
      angleSeriesDeg.push(angleDeg);
      sumAngle += angleDeg;

      if (angleDeg < minAngleDeg) {
        isAngleSatisfied = false;
      }
    }

    const isContact = dist <= cutoffDist && isAngleSatisfied;
    contactFlags.push(isContact);

    if (isContact) {
      contactCount++;
      currentLifetime++;
    } else if (currentLifetime > 0) {
      uninterruptedLifetimes.push(currentLifetime);
      currentLifetime = 0;
    }
  }

  if (currentLifetime > 0) {
    uninterruptedLifetimes.push(currentLifetime);
  }

  const occupancyFraction = Number((contactCount / numFrames).toFixed(4));
  const meanDistance = Number((sumDistance / numFrames).toFixed(3));
  const meanAngleDeg = hasH ? Number((sumAngle / numFrames).toFixed(2)) : undefined;

  return {
    donorIndex,
    hydrogenIndex,
    acceptorIndex,
    occupancyFraction,
    distanceSeries,
    angleSeriesDeg: hasH ? angleSeriesDeg : undefined,
    contactFlags,
    totalFrames: numFrames,
    meanDistance,
    meanAngleDeg,
    uninterruptedLifetimes,
    isPersistent: occupancyFraction >= 0.50,
  };
}
