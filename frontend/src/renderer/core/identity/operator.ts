import { InvalidOperatorMatrixError } from '../errors/errors.js';
import { sha256Hex } from './hash.js';

/**
 * Canonical 4x4 Affine Spatial Operator.
 * Represents symmetry transformations, crystallographic packing, or assemblies.
 */
export interface SpatialOperator {
  readonly operatorId: string;
  readonly assemblyId: string;
  readonly matrix: Float64Array; // Must have length 16, row-major
  readonly operatorChain: readonly string[];
}

/**
 * Validates a spatial operator matrix.
 * Fails closed on missing elements, non-16 length, NaN, or Infinity.
 */
export function validateOperatorMatrix(operatorId: string, matrix: Float64Array | null | undefined): void {
  if (!matrix) {
    throw new InvalidOperatorMatrixError(operatorId, 'Matrix is null or undefined');
  }
  if (matrix.length !== 16) {
    throw new InvalidOperatorMatrixError(operatorId, `Matrix length is ${matrix.length}, expected 16`);
  }
  for (let i = 0; i < 16; i++) {
    const val = matrix[i];
    if (typeof val !== 'number' || Number.isNaN(val) || !Number.isFinite(val)) {
      throw new InvalidOperatorMatrixError(operatorId, `Element at index ${i} is non-finite: ${val}`);
    }
  }
}

/**
 * Computes canonical cryptographic SHA-256 hash for a SpatialOperator.
 */
export async function computeOperatorHash(operator: SpatialOperator): Promise<string> {
  validateOperatorMatrix(operator.operatorId, operator.matrix);

  // Canonical serialization: operatorId|assemblyId|matrix_values|chain
  const matrixStr = Array.from(operator.matrix)
    .map((v) => v.toFixed(8))
    .join(',');
  const chainStr = operator.operatorChain.join('->');
  const payload = `OP:${operator.operatorId}|ASS:${operator.assemblyId}|M:[${matrixStr}]|CHAIN:${chainStr}`;

  return sha256Hex(payload);
}
