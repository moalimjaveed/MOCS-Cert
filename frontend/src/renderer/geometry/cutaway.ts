export interface CutawayCylinderParams {
  readonly type: 'cylinder';
  readonly invert: boolean;
  readonly position: readonly [number, number, number];
  readonly rotation: {
    readonly axis: readonly [number, number, number];
    readonly angle: number; // degrees
  };
  readonly scale: readonly [number, number, number];
}

export interface CutawayOptions {
  /** Radius of the cutaway cylinder in Angstroms. Defaults to 8.5 Å */
  readonly radius?: number;
  /** Distance in front of the target centroid before clipping begins. Defaults to 1.2 Å */
  readonly margin?: number;
  /** Total length of the cutaway cylinder along view direction. Defaults to 50.0 Å */
  readonly length?: number;
}

/**
 * Computes the 3D centroid of one or more target atom positions.
 */
export function computeTargetCentroid(
  positions: readonly (readonly [number, number, number])[]
): [number, number, number] {
  if (positions.length === 0) {
    return [0, 0, 0];
  }
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  for (const pos of positions) {
    sumX += pos[0];
    sumY += pos[1];
    sumZ += pos[2];
  }
  const count = positions.length;
  return [sumX / count, sumY / count, sumZ / count];
}

/**
 * Computes camera-aware cutaway cylinder parameters pointing from the target pocket
 * towards the camera eye, carving foreground obstructions while preserving the pocket.
 */
export function computeCameraCutawayCylinder(
  target: readonly [number, number, number],
  cameraPos: readonly [number, number, number],
  options?: CutawayOptions
): CutawayCylinderParams {
  const radius = options?.radius ?? 8.5;
  const margin = options?.margin ?? 1.2;
  const length = options?.length ?? 50.0;

  // Direction vector from target pocket centroid towards camera
  const vx = cameraPos[0] - target[0];
  const vy = cameraPos[1] - target[1];
  const vz = cameraPos[2] - target[2];
  const len = Math.sqrt(vx * vx + vy * vy + vz * vz);

  const dx = len > 1e-4 ? vx / len : 0;
  const dy = len > 1e-4 ? vy / len : 1;
  const dz = len > 1e-4 ? vz / len : 0;

  // Position: Center of the cylinder
  // The cylinder base starts at (target + d * margin), extending along d for length L.
  // Center is target + d * (margin + L / 2).
  const centerDistance = margin + length / 2;
  const posX = target[0] + dx * centerDistance;
  const posY = target[1] + dy * centerDistance;
  const posZ = target[2] + dz * centerDistance;

  // Rotation: Map canonical cylinder axis (0, 1, 0) to direction vector (dx, dy, dz)
  // Cross product (0, 1, 0) x (dx, dy, dz) = (dz, 0, -dx)
  const wx = dz;
  const wz = -dx;
  const wLen = Math.sqrt(wx * wx + wz * wz);

  let axis: [number, number, number];
  let angleDegrees: number;

  if (wLen < 1e-5) {
    // Collinear with Y axis
    if (dy >= 0) {
      axis = [1, 0, 0];
      angleDegrees = 0;
    } else {
      axis = [1, 0, 0];
      angleDegrees = 180;
    }
  } else {
    axis = [wx / wLen, 0, wz / wLen];
    const cosTheta = Math.max(-1, Math.min(1, dy));
    angleDegrees = Math.acos(cosTheta) * (180 / Math.PI);
  }

  return {
    type: 'cylinder',
    invert: false,
    position: [posX, posY, posZ],
    rotation: {
      axis,
      angle: angleDegrees,
    },
    // Mol* cylinderSD uses scale * 0.5 for size.xy (scale.x * 0.5 = radius, scale.y * 0.5 = half-length)
    scale: [radius * 2, length, radius * 2],
  };
}
