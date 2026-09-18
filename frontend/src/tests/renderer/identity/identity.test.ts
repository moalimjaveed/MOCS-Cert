import { describe, it, expect } from 'vitest';
import {
  formatSourceAtomKey,
  sourceAtomIdEquals,
  validateOperatorMatrix,
  computeOperatorHash,
  InvalidOperatorMatrixError,
  SpatialOperator,
} from '@mocs/core';

describe('Gate G1: Scientific Identity & Operator Validation', () => {
  it('formats SourceAtomId into canonical deterministic key', () => {
    const id = {
      dataset: '4hhb',
      model: 1,
      entity: '1',
      chain: 'A',
      seq: 87,
      component: 'HIS',
      atom: 'NE2',
    };
    const key = formatSourceAtomKey(id);
    expect(key).toBe('4hhb|M1|E1|A:87:HIS.NE2');
    expect(sourceAtomIdEquals(id, { ...id })).toBe(true);
  });

  it('fails closed when operator matrix is null, undefined, or wrong length', () => {
    expect(() => validateOperatorMatrix('op1', null)).toThrow(InvalidOperatorMatrixError);
    expect(() => validateOperatorMatrix('op1', new Float64Array(15))).toThrow(InvalidOperatorMatrixError);
    expect(() => validateOperatorMatrix('op1', new Float64Array(17))).toThrow(InvalidOperatorMatrixError);
  });

  it('fails closed when operator matrix contains NaN or Infinity', () => {
    const nanMatrix = new Float64Array(16);
    nanMatrix[5] = NaN;
    expect(() => validateOperatorMatrix('op-nan', nanMatrix)).toThrow(InvalidOperatorMatrixError);

    const infMatrix = new Float64Array(16);
    infMatrix[0] = Infinity;
    expect(() => validateOperatorMatrix('op-inf', infMatrix)).toThrow(InvalidOperatorMatrixError);
  });

  it('computes deterministic SHA-256 cryptographic hash for valid spatial operator', async () => {
    const matrix = new Float64Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
    const op: SpatialOperator = {
      operatorId: 'sym-1',
      assemblyId: '1',
      matrix,
      operatorChain: ['P_1'],
    };

    const hash1 = await computeOperatorHash(op);
    const hash2 = await computeOperatorHash(op);

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);

    // Altering matrix must alter the cryptographic digest
    const alteredMatrix = new Float64Array(matrix);
    alteredMatrix[3] = 10.0;
    const alteredOp: SpatialOperator = { ...op, matrix: alteredMatrix };
    const hashAltered = await computeOperatorHash(alteredOp);

    expect(hashAltered).not.toBe(hash1);
  });
});
