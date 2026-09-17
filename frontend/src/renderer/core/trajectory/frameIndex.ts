export interface FrameMetadata {
  readonly frameNumber: number;
  readonly timePicoseconds: number;
  readonly byteOffset?: number;
  readonly byteLength?: number;
}

export interface TrajectoryIndex {
  readonly totalFrames: number;
  readonly frames: readonly FrameMetadata[];
  readonly durationPicoseconds: number;
  readonly stepPicoseconds: number;
}
