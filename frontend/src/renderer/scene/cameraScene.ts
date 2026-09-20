export type CameraProjectionMode = 'perspective' | 'orthographic';

export interface CameraScene {
  readonly projection: CameraProjectionMode;
  readonly fovDegrees?: number;
  readonly target?: readonly [number, number, number];
  readonly position?: readonly [number, number, number];
  readonly up?: readonly [number, number, number];
}
