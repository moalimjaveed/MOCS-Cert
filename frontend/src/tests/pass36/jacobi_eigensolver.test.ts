import { describe, it, expect } from 'vitest';
import { computeSymmetricEigenvalues } from '../../molecular/intelligence/numberTheoreticModule';

describe('PASS 36 — Section 17: Jacobi Eigensolver Validation Suite', () => {
  it('1. Zero matrix (all zeros)', () => {
    const A = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const evs = computeSymmetricEigenvalues(A);
    expect(evs).toEqual([0, 0, 0]);
  });

  it('2. Identity matrix (repeated eigenvalue 1.0)', () => {
    const A = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const evs = computeSymmetricEigenvalues(A);
    expect(evs).toEqual([1, 1, 1]);
  });

  it('3. Diagonal matrix (eigenvalues are diagonal entries)', () => {
    const A = [
      [2.5, 0, 0],
      [0, -1.2, 0],
      [0, 0, 5.8],
    ];
    const evs = computeSymmetricEigenvalues(A);
    expect(evs).toEqual([-1.2, 2.5, 5.8]);
  });

  it('4. Path graph P3 Laplacian: L = [[1, -1, 0], [-1, 2, -1], [0, -1, 1]]', () => {
    // Analytical eigenvalues of P3: 0, 1, 3
    const L = [
      [1, -1, 0],
      [-1, 2, -1],
      [0, -1, 1],
    ];
    const evs = computeSymmetricEigenvalues(L);
    expect(evs[0]).toBeCloseTo(0, 3);
    expect(evs[1]).toBeCloseTo(1, 3);
    expect(evs[2]).toBeCloseTo(3, 3);
  });

  it('5. Complete graph K3 Laplacian: L = [[2, -1, -1], [-1, 2, -1], [-1, -1, 2]]', () => {
    // Analytical eigenvalues of K3: 0, 3, 3
    const L = [
      [2, -1, -1],
      [-1, 2, -1],
      [-1, -1, 2],
    ];
    const evs = computeSymmetricEigenvalues(L);
    expect(evs[0]).toBeCloseTo(0, 3);
    expect(evs[1]).toBeCloseTo(3, 3);
    expect(evs[2]).toBeCloseTo(3, 3);
  });

  it('6. Disconnected graph (two isolated components)', () => {
    // Two disconnected K2 components: L is block diagonal with blocks [[1,-1],[-1,1]]
    // Analytical eigenvalues: 0, 0, 2, 2
    const L = [
      [1, -1, 0, 0],
      [-1, 1, 0, 0],
      [0, 0, 1, -1],
      [0, 0, -1, 1],
    ];
    const evs = computeSymmetricEigenvalues(L);
    expect(evs[0]).toBeCloseTo(0, 3);
    expect(evs[1]).toBeCloseTo(0, 3);
    expect(evs[2]).toBeCloseTo(2, 3);
    expect(evs[3]).toBeCloseTo(2, 3);
  });

  it('7. Trace conservation on symmetric random matrix: sum(lambda_i) == Tr(A)', () => {
    // Random symmetric 4x4
    const A = [
      [4.0, 1.2, -0.5, 0.8],
      [1.2, 5.0, 2.1, -1.0],
      [-0.5, 2.1, 3.0, 0.4],
      [0.8, -1.0, 0.4, 2.0],
    ];
    const expectedTrace = 4.0 + 5.0 + 3.0 + 2.0; // 14.0
    const evs = computeSymmetricEigenvalues(A);
    const sumEvs = evs.reduce((a, b) => a + b, 0);
    expect(sumEvs).toBeCloseTo(expectedTrace, 3);

    // Eigenvalues must be sorted ascending
    for (let i = 0; i < evs.length - 1; i++) {
      expect(evs[i]).toBeLessThanOrEqual(evs[i + 1]);
    }
  });
});
