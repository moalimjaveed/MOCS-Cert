/**
 * Trajectory Bounding Volume Engine.
 * 
 * Enforces strict scientific distinction between:
 * 1. Current Frame AABB: Instantaneous bounding box tightly enclosing atoms at frame k.
 * 2. Trajectory-Wide AABB: Conservative bounding envelope spanning all evaluated frames
 *    in a simulation or block interval (e.g. Block 41 [410 - 420 ns]).
 * 
 * Invariant: Trajectory-wide AABB must contain every individual frame's AABB:
 *   AABB_trajectory >= Union_{k} AABB_frame(k)
 * and must NEVER collapse to a single frame's instantaneous bounds.
 */

import * as THREE from 'three';
import {
  createBox3FromCoordinates,
  computeBoxDimensions,
  computeBoxExtrema,
} from '../geometry/coordinateBounds';

export interface TrajectoryBoundsPair {
  currentFrameBox: THREE.Box3;
  trajectoryWideBox: THREE.Box3;
  currentFrameDimensions: { deltaX: number; deltaY: number; deltaZ: number; volume: number };
  trajectoryWideDimensions: { deltaX: number; deltaY: number; deltaZ: number; volume: number };
  isConservative: boolean;
}

/**
 * Computes the tight instantaneous AABB for atoms in the current frame.
 */
export function computeCurrentFrameAABB(
  coords: Array<[number, number, number]>
): THREE.Box3 {
  return createBox3FromCoordinates(coords);
}

/**
 * Computes the conservative trajectory-wide or block envelope spanning all frames.
 */
export function computeTrajectoryWideAABB(
  allFramesCoords: Array<Array<[number, number, number]>>
): THREE.Box3 {
  const unionBox = new THREE.Box3().makeEmpty();
  for (const frameCoords of allFramesCoords) {
    const frameBox = createBox3FromCoordinates(frameCoords);
    if (!frameBox.isEmpty()) {
      unionBox.union(frameBox);
    }
  }
  return unionBox;
}

/**
 * Evaluates and compares current frame bounds vs trajectory-wide bounds.
 * Verifies the conservative non-expansion / containment invariant.
 */
export function evaluateTrajectoryBounds(
  currentFrameCoords: Array<[number, number, number]>,
  allFramesCoords: Array<Array<[number, number, number]>>
): TrajectoryBoundsPair {
  const currentFrameBox = computeCurrentFrameAABB(currentFrameCoords);
  const trajectoryWideBox = computeTrajectoryWideAABB(allFramesCoords);

  const currentFrameDimensions = computeBoxDimensions(currentFrameBox);
  const trajectoryWideDimensions = computeBoxDimensions(trajectoryWideBox);

  // Invariant verification: Trajectory-wide box must contain current frame box
  const isConservative =
    trajectoryWideBox.containsBox(currentFrameBox) ||
    (currentFrameBox.isEmpty() && !trajectoryWideBox.isEmpty());

  return {
    currentFrameBox,
    trajectoryWideBox,
    currentFrameDimensions,
    trajectoryWideDimensions,
    isConservative,
  };
}
