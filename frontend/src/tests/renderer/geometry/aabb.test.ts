import { describe, it, expect } from 'vitest';
import { computeAABB, computeEuclideanDistance, createMeasurementCaliper } from '@mocs/geometry';
import { HHB_4_REFERENCE_DISTANCE } from '@mocs/fixtures';

describe('Gate G2: Geometry Engine Float64 Precision & AABB Bounds', () => {
  it('computes exact authoritative AABB from Float64 coordinates', () => {
    // 3 atoms: [0, 10, -5], [5, 20, 15], [-10, 5, 0]
    const coords = new Float64Array([
      0, 10, -5,
      5, 20, 15,
      -10, 5, 0,
    ]);
    const indices = [0, 1, 2];

    const aabb = computeAABB(coords, indices, {
      frameIdentity: 0,
      componentIdentity: 'test-comp',
      spatialIdentity: 'auth-1',
    });

    expect(aabb.min).toEqual([-10, 5, -5]);
    expect(aabb.max).toEqual([5, 20, 15]);
    expect(aabb.size).toEqual([15, 15, 20]);
    expect(aabb.center).toEqual([-2.5, 12.5, 5]);
    expect(aabb.atomCount).toBe(3);
  });

  it('fails closed when calculating AABB for empty atom indices', () => {
    const coords = new Float64Array([1, 2, 3]);
    expect(() =>
      computeAABB(coords, [], {
        frameIdentity: 0,
        componentIdentity: 'empty',
        spatialIdentity: 'auth-1',
      })
    ).toThrow(/Cannot compute AABB for empty atom set/);
  });

  it('fails closed on non-finite coordinates in AABB calculation', () => {
    const coords = new Float64Array([1, NaN, 3]);
    expect(() =>
      computeAABB(coords, [0], {
        frameIdentity: 0,
        componentIdentity: 'nan-comp',
        spatialIdentity: 'auth-1',
      })
    ).toThrow(/Non-finite coordinate/);
  });

  it('verifies exact analytical distance between A:87:NE2 and HEM:142:FE in 4HHB', () => {
    // Exact 4HHB coordinates from crystallographic data:
    const pHisNE2: [number, number, number] = [-4.116, 12.183, 4.316];
    const pHemeFE: [number, number, number] = [-2.253, 13.064, 4.316];

    const dist = computeEuclideanDistance(pHisNE2, pHemeFE);
    expect(dist).toBeCloseTo(HHB_4_REFERENCE_DISTANCE, 4);

    const caliper = createMeasurementCaliper(
      'c1',
      '4hhb|M1|E1|A:87:HIS.NE2',
      '4hhb|M1|E1|A:142:HEM.FE',
      pHisNE2,
      pHemeFE
    );
    expect(caliper.distanceAngstroms).toBeCloseTo(HHB_4_REFERENCE_DISTANCE, 4);
  });
});
