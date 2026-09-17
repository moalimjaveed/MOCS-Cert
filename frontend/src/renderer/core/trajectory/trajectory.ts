import { TrajectoryFrame } from './frame.js';
import { TrajectoryIndex } from './frameIndex.js';

export interface CanonicalTrajectory {
  readonly id: string;
  readonly atomCount: number;
  readonly index: TrajectoryIndex;
  getFrame(frameNumber: number): Promise<TrajectoryFrame>;
}
