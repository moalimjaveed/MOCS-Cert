/**
 * Coordinate-difference RMSD calculation between atom selections.
 * Formula: RMSD = sqrt( (1/N) * sum_i || r_A_i - r_B_i ||^2 )
 * Float64 throughout.
 */

import { Result, ok, err } from '@mocs/core';
import type { Coord3 } from './types.js';

export interface RMSDResult {
  readonly rmsdAngstrom: number;
  readonly atomCount: number;
}

export function computeRMSD(
  coordsA: readonly Coord3[],
  coordsB: readonly Coord3[]
): Result<RMSDResult> {
  if (!coordsA || !coordsB || coordsA.length === 0 || coordsB.length === 0) {
    return err(new Error('RMSD requires non-empty coordinate sets'));
  }
  if (coordsA.length !== coordsB.length) {
    return err(new Error(`RMSD coordinate sets have different lengths: ${coordsA.length} vs ${coordsB.length}`));
  }

  const n = coordsA.length;
  let sumSq = 0;

  for (let i = 0; i < n; i++) {
    const ptA = coordsA[i];
    const ptB = coordsB[i];

    if (!ptA || !ptB) {
      return err(new Error(`Invalid coordinate point at index ${i}`));
    }

    const [ax, ay, az] = ptA;
    const [bx, by, bz] = ptB;

    if (
      !Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(az) ||
      !Number.isFinite(bx) || !Number.isFinite(by) || !Number.isFinite(bz)
    ) {
      return err(new Error(`Non-finite coordinate detected at atom index ${i}`));
    }

    const dx = ax - bx;
    const dy = ay - by;
    const dz = az - bz;
    sumSq += dx * dx + dy * dy + dz * dz;
  }

  const rmsd = Math.sqrt(sumSq / n);
  if (!Number.isFinite(rmsd)) {
    return err(new Error('RMSD computation yielded non-finite result'));
  }

  return ok({ rmsdAngstrom: rmsd, atomCount: n });
}
