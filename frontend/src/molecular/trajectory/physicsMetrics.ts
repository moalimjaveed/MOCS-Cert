/**
 * Trajectory Physics & Dynamics Analysis Engine.
 * 
 * Provides authentic mathematical implementations of:
 * - Frame coordinate evolution & static-frame detection
 * - Trajectory RMSD over time (with optional Kabsch rigid-body superposition)
 * - Trajectory RMSF (internal fluctuations with rotational/translational alignment)
 * - Radius of Gyration (mass-weighted vs unweighted geometric centroid)
 * - Dynamic contact occupancy & time-weighted statistics
 * 
 * Epistemic Guard: Operates exclusively on verified frame coordinates.
 * Never computes physics metrics from static structures or interpolated animation frames.
 */

import { calculateWeightedKabschAlignment } from '../protein/alignment';
import { calculateEuclideanDistance, validateOrthorhombicBox } from '../measurements/calculations';
import type {
  TrajectoryCoordinateEvolution,
  TrajectoryRmsdOptions,
  TrajectoryRmsdResult,
  TrajectoryRmsfResult,
  TrajectoryRgResult,
  TrajectoryContactOccupancyOptions,
  TrajectoryContactOccupancyResult,
} from './types';

/**
 * Evaluates coordinate evolution between two discrete trajectory frames.
 * Computes max absolute difference, mean difference, and RMS difference.
 */
export function calculateCoordinateEvolution(
  coordsA: Array<[number, number, number]>,
  coordsB: Array<[number, number, number]>
): TrajectoryCoordinateEvolution {
  if (!coordsA || !coordsB || coordsA.length === 0 || coordsA.length !== coordsB.length) {
    throw new Error(
      `Coordinate evolution evaluation requires non-empty, equal-length coordinate sets (got ${coordsA?.length} and ${coordsB?.length}).`
    );
  }

  const n = coordsA.length;
  let maxDiff = 0;
  let sumDiff = 0;
  let sumSqDiff = 0;
  let differingCount = 0;

  for (let i = 0; i < n; i++) {
    const pA = coordsA[i];
    const pB = coordsB[i];

    if (
      !Number.isFinite(pA[0]) || !Number.isFinite(pA[1]) || !Number.isFinite(pA[2]) ||
      !Number.isFinite(pB[0]) || !Number.isFinite(pB[1]) || !Number.isFinite(pB[2])
    ) {
      throw new Error(`Non-finite coordinate detected at atom index ${i}.`);
    }

    const dist = calculateEuclideanDistance(pA, pB);
    if (dist > maxDiff) maxDiff = dist;
    sumDiff += dist;
    sumSqDiff += dist * dist;
    if (dist > 1e-4) {
      differingCount++;
    }
  }

  const meanDiff = sumDiff / n;
  const rmsDiff = Math.sqrt(sumSqDiff / n);
  const isStatic = maxDiff < 1e-4;

  return {
    maxCoordinateDiff: Number(maxDiff.toFixed(5)),
    meanCoordinateDiff: Number(meanDiff.toFixed(5)),
    rmsCoordinateDiff: Number(rmsDiff.toFixed(5)),
    isStatic,
    differingAtomsCount: differingCount,
    totalAtomsCount: n,
  };
}

/**
 * Computes average coordinates across an array of trajectory frames:
 * <r_i> = (1 / M) * sum_{k=0}^{M-1} r_i(k)
 */
export function computeAverageCoordinates(
  allFramesCoords: Array<Array<[number, number, number]>>
): Array<[number, number, number]> {
  if (!allFramesCoords || allFramesCoords.length === 0) {
    throw new Error('Cannot compute average coordinates from an empty frame set.');
  }

  const numFrames = allFramesCoords.length;
  const numAtoms = allFramesCoords[0].length;
  const avgCoords: Array<[number, number, number]> = [];

  for (let i = 0; i < numAtoms; i++) {
    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;
    for (let f = 0; f < numFrames; f++) {
      const pt = allFramesCoords[f][i];
      sumX += pt[0];
      sumY += pt[1];
      sumZ += pt[2];
    }
    avgCoords.push([sumX / numFrames, sumY / numFrames, sumZ / numFrames]);
  }

  return avgCoords;
}

/**
 * Computes Trajectory Root-Mean-Square Deviation (RMSD) across all frames.
 * 
 * Options allow:
 * - Reference: FIRST_FRAME (frame 0), SELECTED_FRAME (frame k), AVERAGE_STRUCTURE, or EXTERNAL_STRUCTURE
 * - Atom selection subset (e.g. CA or Backbone indices)
 * - Rigid-body alignment (Kabsch) vs raw coordinate difference
 */
export function calculateTrajectoryRmsd(
  allFramesCoords: Array<Array<[number, number, number]>>,
  options: TrajectoryRmsdOptions
): TrajectoryRmsdResult {
  if (!allFramesCoords || allFramesCoords.length === 0) {
    throw new Error('Trajectory coordinate array is empty.');
  }

  const numFrames = allFramesCoords.length;
  const totalAtoms = allFramesCoords[0].length;

  // Filter atom indices if provided
  const filterAtoms = (coords: Array<[number, number, number]>): Array<[number, number, number]> => {
    if (!options.atomIndices || options.atomIndices.length === 0) return coords;
    return options.atomIndices.map((idx) => {
      if (idx < 0 || idx >= totalAtoms) {
        throw new Error(`Atom index ${idx} out of range [0, ${totalAtoms}).`);
      }
      return coords[idx];
    });
  };

  // Determine reference structure
  let refCoords: Array<[number, number, number]>;
  let refLabel: string;

  if (options.referenceType === 'FIRST_FRAME') {
    refCoords = filterAtoms(allFramesCoords[0]);
    refLabel = 'Frame 0 (Initial Coordinate Reference)';
  } else if (options.referenceType === 'SELECTED_FRAME') {
    const idx = options.referenceFrameIndex ?? 0;
    if (idx < 0 || idx >= numFrames) {
      throw new Error(`Reference frame index ${idx} out of range [0, ${numFrames}).`);
    }
    refCoords = filterAtoms(allFramesCoords[idx]);
    refLabel = `Frame ${idx} (Selected Coordinate Reference)`;
  } else if (options.referenceType === 'AVERAGE_STRUCTURE') {
    const rawAvg = computeAverageCoordinates(allFramesCoords);
    refCoords = filterAtoms(rawAvg);
    refLabel = 'Ensemble Average Structure <r>';
  } else if (options.referenceType === 'EXTERNAL_STRUCTURE') {
    if (!options.referenceCoordinates || options.referenceCoordinates.length === 0) {
      throw new Error('External structure reference selected but no referenceCoordinates provided.');
    }
    refCoords = filterAtoms(options.referenceCoordinates);
    refLabel = 'External Reference Structure';
  } else {
    refCoords = filterAtoms(allFramesCoords[0]);
    refLabel = 'Frame 0 (Default)';
  }

  const rmsdSeries: number[] = [];
  let minRmsd = Infinity;
  let maxRmsd = -Infinity;
  let sumRmsd = 0;

  for (let f = 0; f < numFrames; f++) {
    const frameSubset = filterAtoms(allFramesCoords[f]);
    let rmsdVal: number;

    if (options.alignFrames) {
      // Superpose frame onto reference using Horn/Kabsch
      const alignResult = calculateWeightedKabschAlignment(frameSubset, refCoords);
      rmsdVal = alignResult.rmsd;
    } else {
      // Raw coordinate difference without alignment
      let sumSq = 0;
      const n = frameSubset.length;
      for (let i = 0; i < n; i++) {
        const d = calculateEuclideanDistance(frameSubset[i], refCoords[i]);
        sumSq += d * d;
      }
      rmsdVal = Math.sqrt(sumSq / n);
    }

    const roundedVal = Number(rmsdVal.toFixed(4));
    rmsdSeries.push(roundedVal);
    if (roundedVal < minRmsd) minRmsd = roundedVal;
    if (roundedVal > maxRmsd) maxRmsd = roundedVal;
    sumRmsd += roundedVal;
  }

  return {
    rmsdSeries,
    meanRmsd: Number((sumRmsd / numFrames).toFixed(4)),
    minRmsd,
    maxRmsd,
    referenceUsed: refLabel,
    alignmentApplied: options.alignFrames,
    analyzedFrameCount: numFrames,
  };
}

/**
 * Computes Trajectory Root-Mean-Square Fluctuation (RMSF) per atom.
 * 
 * Formula for atom i:
 *   RMSF_i = sqrt( (1 / M) * sum_{k=0}^{M-1} || r_i(k) - <r_i> ||^2 )
 * 
 * Epistemic Mandate: Internal atomic fluctuations must not be confounded by
 * global translation or tumbling. If alignFrames is true (default), each frame is
 * rigidly aligned (Kabsch superposed) to the reference structure before RMSF calculation.
 */
export function calculateTrajectoryRmsf(
  allFramesCoords: Array<Array<[number, number, number]>>,
  options?: {
    alignFrames?: boolean;
    referenceType?: 'AVERAGE_STRUCTURE' | 'FIRST_FRAME';
    atomIndices?: number[];
  }
): TrajectoryRmsfResult {
  if (!allFramesCoords || allFramesCoords.length === 0) {
    throw new Error('Trajectory coordinate array is empty.');
  }

  const numFrames = allFramesCoords.length;
  const totalAtoms = allFramesCoords[0].length;
  const alignFrames = options?.alignFrames ?? true;
  const refType = options?.referenceType ?? 'AVERAGE_STRUCTURE';

  // Extract subset if requested
  const targetIndices = options?.atomIndices ?? Array.from({ length: totalAtoms }, (_, i) => i);

  // 1. Establish reference coordinates
  let referenceCoords: Array<[number, number, number]>;
  if (refType === 'FIRST_FRAME') {
    referenceCoords = allFramesCoords[0].map((p) => [...p] as [number, number, number]);
  } else {
    referenceCoords = computeAverageCoordinates(allFramesCoords);
  }

  // 2. Prepare aligned coordinate sets if requested
  let processedFrames: Array<Array<[number, number, number]>> = allFramesCoords;
  if (alignFrames) {
    processedFrames = allFramesCoords.map((frame) => {
      const align = calculateWeightedKabschAlignment(frame, referenceCoords);
      return align.superposedSourceCoords;
    });

    // Recompute reference (average) on aligned frames for exact variance calculation
    if (refType === 'AVERAGE_STRUCTURE') {
      referenceCoords = computeAverageCoordinates(processedFrames);
    }
  }

  // 3. Compute per-atom RMSF
  const rmsfPerAtom: number[] = [];
  let sumRmsf = 0;
  let minRmsf = Infinity;
  let maxRmsf = -Infinity;

  for (const atomIdx of targetIndices) {
    const refPoint = referenceCoords[atomIdx];
    let sumSqDist = 0;

    for (let f = 0; f < numFrames; f++) {
      const pt = processedFrames[f][atomIdx];
      const dx = pt[0] - refPoint[0];
      const dy = pt[1] - refPoint[1];
      const dz = pt[2] - refPoint[2];
      sumSqDist += dx * dx + dy * dy + dz * dz;
    }

    const rmsf = Number(Math.sqrt(sumSqDist / numFrames).toFixed(4));
    rmsfPerAtom.push(rmsf);
    if (rmsf < minRmsf) minRmsf = rmsf;
    if (rmsf > maxRmsf) maxRmsf = rmsf;
    sumRmsf += rmsf;
  }

  return {
    rmsfPerAtom,
    meanRmsf: Number((sumRmsf / targetIndices.length).toFixed(4)),
    minRmsf: Number(minRmsf.toFixed(4)),
    maxRmsf: Number(maxRmsf.toFixed(4)),
    alignedBeforeRmsf: alignFrames,
    analyzedFrameCount: numFrames,
    referenceStructureUsed: refType,
  };
}

/**
 * Standard elemental atomic weights (IUPAC).
 */
export const CANONICAL_ELEMENT_MASSES: Record<string, number> = {
  H: 1.008,
  C: 12.011,
  N: 14.007,
  O: 15.999,
  P: 30.974,
  S: 32.065,
  FE: 55.845,
  ZN: 65.38,
  MG: 24.305,
  CA: 40.078,
  NA: 22.990,
  CL: 35.453,
  K: 39.098,
};

/**
 * Computes unweighted geometric centroid of a coordinate set.
 */
export function calculateGeometricCentroid(
  coords: Array<[number, number, number]>
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
 * Computes Center of Mass (COM) using atomic masses.
 */
export function calculateCenterOfMass(
  coords: Array<[number, number, number]>,
  masses: number[]
): [number, number, number] {
  if (!coords || coords.length === 0) return [0, 0, 0];
  if (!masses || masses.length !== coords.length) {
    return calculateGeometricCentroid(coords);
  }

  let totalMass = 0;
  let sumX = 0, sumY = 0, sumZ = 0;

  for (let i = 0; i < coords.length; i++) {
    const m = masses[i];
    totalMass += m;
    sumX += coords[i][0] * m;
    sumY += coords[i][1] * m;
    sumZ += coords[i][2] * m;
  }

  if (totalMass <= 0) return calculateGeometricCentroid(coords);
  return [sumX / totalMass, sumY / totalMass, sumZ / totalMass];
}

/**
 * Computes Radius of Gyration (Rg) for a single coordinate set.
 * Supports mass-weighted form or unweighted geometric centroid form.
 */
export function calculateRadiusOfGyration(
  coords: Array<[number, number, number]>,
  masses?: number[]
): { rg: number; center: [number, number, number]; isMassWeighted: boolean } {
  if (!coords || coords.length === 0) {
    return { rg: 0, center: [0, 0, 0], isMassWeighted: false };
  }

  const isMassWeighted = !!masses && masses.length === coords.length;
  if (isMassWeighted) {
    const com = calculateCenterOfMass(coords, masses!);
    let totalMass = 0;
    let sumWeightedSq = 0;

    for (let i = 0; i < coords.length; i++) {
      const m = masses![i];
      totalMass += m;
      const dx = coords[i][0] - com[0];
      const dy = coords[i][1] - com[1];
      const dz = coords[i][2] - com[2];
      sumWeightedSq += m * (dx * dx + dy * dy + dz * dz);
    }

    const rg = Math.sqrt(sumWeightedSq / totalMass);
    return { rg: Number(rg.toFixed(4)), center: com, isMassWeighted: true };
  } else {
    const centroid = calculateGeometricCentroid(coords);
    let sumSq = 0;
    const n = coords.length;

    for (let i = 0; i < n; i++) {
      const dx = coords[i][0] - centroid[0];
      const dy = coords[i][1] - centroid[1];
      const dz = coords[i][2] - centroid[2];
      sumSq += dx * dx + dy * dy + dz * dz;
    }

    const rg = Math.sqrt(sumSq / n);
    return { rg: Number(rg.toFixed(4)), center: centroid, isMassWeighted: false };
  }
}

/**
 * Computes Radius of Gyration (Rg) over an entire trajectory.
 */
export function calculateTrajectoryRadiusOfGyration(
  allFramesCoords: Array<Array<[number, number, number]>>,
  masses?: number[]
): TrajectoryRgResult {
  if (!allFramesCoords || allFramesCoords.length === 0) {
    throw new Error('Trajectory coordinate array is empty.');
  }

  const numFrames = allFramesCoords.length;
  const rgSeries: number[] = [];
  const comSeries: Array<[number, number, number]> = [];
  let minRg = Infinity;
  let maxRg = -Infinity;
  let sumRg = 0;
  let isMassWeighted = false;

  for (let f = 0; f < numFrames; f++) {
    const res = calculateRadiusOfGyration(allFramesCoords[f], masses);
    isMassWeighted = res.isMassWeighted;
    rgSeries.push(res.rg);
    comSeries.push(res.center);

    if (res.rg < minRg) minRg = res.rg;
    if (res.rg > maxRg) maxRg = res.rg;
    sumRg += res.rg;
  }

  return {
    rgSeries,
    meanRg: Number((sumRg / numFrames).toFixed(4)),
    minRg: Number(minRg.toFixed(4)),
    maxRg: Number(maxRg.toFixed(4)),
    massWeighted: isMassWeighted,
    centerOfMassSeries: comSeries,
  };
}

/**
 * Evaluates periodic minimum-image displacement:
 * dx_pbc = dx - L * round(dx / L)
 */
export function minimumImageDisplacement(dx: number, boxL: number): number {
  if (boxL <= 0 || !Number.isFinite(boxL)) return dx;
  return dx - boxL * Math.round(dx / boxL);
}

/**
 * Computes minimum-image Euclidean distance under orthorhombic PBC.
 * Strictly rejects triclinic or non-orthorhombic simulation boxes.
 */
export function calculateMinimumImageDistance(
  pA: [number, number, number],
  pB: [number, number, number],
  box: [number, number, number] | any
): number {
  const [boxX, boxY, boxZ] = validateOrthorhombicBox(box);
  const dx = minimumImageDisplacement(pA[0] - pB[0], boxX);
  const dy = minimumImageDisplacement(pA[1] - pB[1], boxY);
  const dz = minimumImageDisplacement(pA[2] - pB[2], boxZ);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Computes contact occupancy between two specific atoms across trajectory frames.
 */
export function calculateTrajectoryContactOccupancy(
  allFramesCoords: Array<Array<[number, number, number]>>,
  options: TrajectoryContactOccupancyOptions
): TrajectoryContactOccupancyResult {
  if (!allFramesCoords || allFramesCoords.length === 0) {
    throw new Error('Trajectory coordinate array is empty.');
  }

  const numFrames = allFramesCoords.length;
  const numAtoms = allFramesCoords[0].length;
  const { atomAIndex, atomBIndex, cutoffDistance, usePbc, boxDimensions, timestampsPs } = options;

  if (atomAIndex < 0 || atomAIndex >= numAtoms || atomBIndex < 0 || atomBIndex >= numAtoms) {
    throw new Error(`Atom indices [${atomAIndex}, ${atomBIndex}] out of range [0, ${numAtoms}).`);
  }

  const distancePerFrame: number[] = [];
  const contactFlags: boolean[] = [];
  let contactCount = 0;
  let minDistance = Infinity;
  let maxDistance = -Infinity;
  let sumDistance = 0;

  for (let f = 0; f < numFrames; f++) {
    const pA = allFramesCoords[f][atomAIndex];
    const pB = allFramesCoords[f][atomBIndex];

    let dist: number;
    if (usePbc && boxDimensions) {
      dist = calculateMinimumImageDistance(pA, pB, boxDimensions);
    } else {
      dist = calculateEuclideanDistance(pA, pB);
    }

    const roundedDist = Number(dist.toFixed(4));
    distancePerFrame.push(roundedDist);

    if (roundedDist < minDistance) minDistance = roundedDist;
    if (roundedDist > maxDistance) maxDistance = roundedDist;
    sumDistance += roundedDist;

    const inContact = roundedDist <= cutoffDistance;
    contactFlags.push(inContact);
    if (inContact) contactCount++;
  }

  const occupancyFraction = contactCount / numFrames;

  // Compute time-weighted occupancy if timestamps are provided and non-uniform
  let timeWeightedOccupancy: number | undefined;
  if (timestampsPs && timestampsPs.length === numFrames && numFrames > 1) {
    let totalTime = 0;
    let contactTime = 0;
    for (let f = 0; f < numFrames - 1; f++) {
      const dt = timestampsPs[f + 1] - timestampsPs[f];
      if (dt > 0) {
        totalTime += dt;
        if (contactFlags[f]) {
          contactTime += dt;
        }
      }
    }
    if (totalTime > 0) {
      timeWeightedOccupancy = Number((contactTime / totalTime).toFixed(4));
    }
  }

  return {
    occupancyFraction: Number(occupancyFraction.toFixed(4)),
    timeWeightedOccupancy,
    contactFramesCount: contactCount,
    totalFramesCount: numFrames,
    distancePerFrame,
    minDistance: Number(minDistance.toFixed(4)),
    maxDistance: Number(maxDistance.toFixed(4)),
    meanDistance: Number((sumDistance / numFrames).toFixed(4)),
    isPersistent: occupancyFraction >= 0.70,
    isTransient: occupancyFraction < 0.30,
  };
}
