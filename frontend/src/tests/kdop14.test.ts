import { describe, it, expect } from 'vitest';
import { KDOP14, CANONICAL_KDOP14_DIRECTIONS, PeriodicCell } from '../molecular/trajectory/pbcEngine';

describe('KDOP14 TypeScript Engine', () => {
  it('verifies 7 canonical directions', () => {
    expect(CANONICAL_KDOP14_DIRECTIONS.length).toBe(7);
    expect(CANONICAL_KDOP14_DIRECTIONS[0]).toEqual([1, 0, 0]);
    expect(CANONICAL_KDOP14_DIRECTIONS[1]).toEqual([0, 1, 0]);
    expect(CANONICAL_KDOP14_DIRECTIONS[2]).toEqual([0, 0, 1]);

    const invSqrt3 = 1 / Math.sqrt(3);
    expect(CANONICAL_KDOP14_DIRECTIONS[3][0]).toBeCloseTo(invSqrt3, 6);
    expect(CANONICAL_KDOP14_DIRECTIONS[3][1]).toBeCloseTo(invSqrt3, 6);
    expect(CANONICAL_KDOP14_DIRECTIONS[3][2]).toBeCloseTo(invSqrt3, 6);
  });

  it('constructs KDOP14 from coordinates', () => {
    const coords: Array<[number, number, number]> = [
      [0, 0, 0],
      [10, 0, 0],
      [0, 10, 0],
      [0, 0, 10],
      [10, 10, 10],
    ];
    const kdop = KDOP14.fromCoordinates(coords);
    expect(kdop.minProjections.length).toBe(7);
    expect(kdop.maxProjections.length).toBe(7);
    expect(kdop.minProjections[0]).toBe(0);
    expect(kdop.maxProjections[0]).toBe(10);
    expect(kdop.aabbVolume()).toBe(1000);
  });

  it('computes Euclidean bounds soundly', () => {
    const ptsA: Array<[number, number, number]> = [
      [0, 0, 0],
      [1, 1, 1],
    ];
    const ptsB: Array<[number, number, number]> = [
      [10, 10, 10],
      [11, 11, 11],
    ];
    const kdopA = KDOP14.fromCoordinates(ptsA);
    const kdopB = KDOP14.fromCoordinates(ptsB);

    const [L, U] = kdopA.computeEuclideanBounds(kdopB);
    expect(L).toBeGreaterThan(0);
    expect(U).toBeGreaterThanOrEqual(L);
  });

  it('computes Periodic bounds with orthorhombic cell', () => {
    const cell = PeriodicCell.fromLengthsAndAngles(50, 50, 50, 90, 90, 90);
    const ptsA: Array<[number, number, number]> = [
      [5, 5, 5],
      [10, 10, 10],
    ];
    const ptsB: Array<[number, number, number]> = [
      [40, 40, 40],
      [45, 45, 45],
    ];
    const kdopA = KDOP14.fromCoordinates(ptsA);
    const kdopB = KDOP14.fromCoordinates(ptsB);

    const [L, U] = kdopA.computeBounds(kdopB, cell);
    expect(L).toBeGreaterThan(0);
    expect(U).toBeGreaterThanOrEqual(L);
  });
});
