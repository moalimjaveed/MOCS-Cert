/**
 * Applies a 4x4 row-major affine matrix to a 3D point [x, y, z].
 */
export function applyMatrix4ToPoint(
  matrix: Float64Array,
  point: readonly [number, number, number]
): [number, number, number] {
  const x = point[0];
  const y = point[1];
  const z = point[2];

  const rx = matrix[0] * x + matrix[1] * y + matrix[2] * z + matrix[3];
  const ry = matrix[4] * x + matrix[5] * y + matrix[6] * z + matrix[7];
  const rz = matrix[8] * x + matrix[9] * y + matrix[10] * z + matrix[11];
  const rw = matrix[12] * x + matrix[13] * y + matrix[14] * z + matrix[15];

  const w = rw !== 0 ? rw : 1;
  return [rx / w, ry / w, rz / w];
}
