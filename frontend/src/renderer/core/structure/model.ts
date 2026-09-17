/**
 * Canonical 3D Structural Model with Authoritative Float64 Coordinates.
 */
export interface StructureModel {
  readonly modelNum: number;
  readonly atomCount: number;
  /**
   * Interleaved 3D Cartesian coordinates [x0, y0, z0, x1, y1, z1, ...] in Float64Array.
   * Length must be exactly atomCount * 3.
   */
  readonly coordinates: Float64Array;
}
