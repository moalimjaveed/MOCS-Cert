/**
 * Canonical Trajectory Frame with Authoritative Float64 Coordinates.
 */
export interface TrajectoryFrame {
  readonly frameNumber: number;
  readonly timePicoseconds: number;
  readonly atomCount: number;
  /**
   * Flat 3D Cartesian coordinates [x0, y0, z0, x1, y1, z1, ...]
   * Length must be atomCount * 3
   */
  readonly coordinates: Float64Array;
  /**
   * 3x3 Simulation Box vectors (lengths in nm or Å) if present
   */
  readonly boxVectors?: Float64Array;
}
