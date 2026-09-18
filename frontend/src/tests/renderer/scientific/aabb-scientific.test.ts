import { describe, it, expect } from 'vitest';
import { computePointAABB, testPointInAABB } from '@mocs/geometry';

describe('AABB Scientific Validation & Invariants', () => {
  it('computes tight AABB for a simple set of coordinates', () => {
    const coords = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ] as [number, number, number][];
    const result = computePointAABB(coords, {}, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.min).toEqual([1, 2, 3]);
    expect(result.value.max).toEqual([7, 8, 9]);
    expect(result.value.center).toEqual([4, 5, 6]);
    expect(result.value.size).toEqual([6, 6, 6]);
    expect(result.value.atomCount).toBe(3);
  });

  it('fails closed on empty coordinate set', () => {
    const result = computePointAABB([], {}, 0);
    expect(result.ok).toBe(false);
  });

  it('fails closed on NaN or Infinity coordinate', () => {
    const resultNaN = computePointAABB([[1, NaN, 3]], {}, 0);
    expect(resultNaN.ok).toBe(false);

    const resultInf = computePointAABB([[1, 2, Infinity]], {}, 0);
    expect(resultInf.ok).toBe(false);
  });

  it('handles single-atom degenerate point input', () => {
    const result = computePointAABB([[5, 5, 5]], {}, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.min).toEqual([5, 5, 5]);
    expect(result.value.max).toEqual([5, 5, 5]);
    expect(result.value.size).toEqual([0, 0, 0]);
    expect(result.value.atomCount).toBe(1);
  });

  it('applies padding correctly', () => {
    const result = computePointAABB(
      [
        [0, 0, 0],
        [10, 10, 10],
      ],
      {},
      2
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.min).toEqual([-2, -2, -2]);
    expect(result.value.max).toEqual([12, 12, 12]);
  });

  it('golden reference: 4HHB Heme active center coordinates', () => {
    const coords: [number, number, number][] = [
      [17.14, 6.59, 14.79], // FE
      [15.72, 7.82, 14.79], // NA
      [18.56, 7.82, 14.79], // NB
      [17.14, 5.36, 14.79], // NC
      [17.14, 7.82, 13.37], // ND
    ];
    const result = computePointAABB(coords, {}, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.atomCount).toBe(5);
    expect(result.value.min[0]).toBeCloseTo(15.72, 2);
    expect(result.value.max[0]).toBeCloseTo(18.56, 2);
  });

  it('verifies point containment and boundaries', () => {
    const aabbRes = computePointAABB(
      [
        [0, 0, 0],
        [10, 10, 10],
      ],
      {},
      0
    );
    expect(aabbRes.ok).toBe(true);
    if (!aabbRes.ok) return;

    // Interior point
    const inside = testPointInAABB([5, 5, 5], aabbRes.value);
    expect(inside.isInside).toBe(true);
    expect(inside.isOnBoundary).toBe(false);

    // Exterior point
    const outside = testPointInAABB([11, 5, 5], aabbRes.value);
    expect(outside.isInside).toBe(false);

    // Boundary point
    const boundary = testPointInAABB([0, 5, 5], aabbRes.value);
    expect(boundary.isInside).toBe(true);
    expect(boundary.isOnBoundary).toBe(true);
  });
});
