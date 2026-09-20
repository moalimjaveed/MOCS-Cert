/**
 * Authoritative Euclidean Distance & Measurement Caliper.
 */

export interface MeasurementCaliper {
  readonly id: string;
  readonly atomAKey: string;
  readonly atomBKey: string;
  readonly pointA: readonly [number, number, number];
  readonly pointB: readonly [number, number, number];
  readonly distanceAngstroms: number;
}

export function computeEuclideanDistance(
  p1: readonly [number, number, number],
  p2: readonly [number, number, number]
): number {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  const dz = p1[2] - p2[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function createMeasurementCaliper(
  id: string,
  atomAKey: string,
  atomBKey: string,
  pointA: readonly [number, number, number],
  pointB: readonly [number, number, number]
): MeasurementCaliper {
  const d = computeEuclideanDistance(pointA, pointB);
  return {
    id,
    atomAKey,
    atomBKey,
    pointA,
    pointB,
    distanceAngstroms: d,
  };
}
