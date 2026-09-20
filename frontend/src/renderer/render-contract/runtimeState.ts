export interface RendererRuntimeState {
  readonly renderer: string;
  readonly dataset: string;
  readonly model: number;
  readonly frame: number;
  readonly sceneRevision: number;
  readonly representationCount: number;
  readonly componentCount: number;
  readonly selectionCount: number;
  readonly aabbCount: number;
  readonly caliperCount: number;
  readonly reticleCount: number;
  readonly webglContextCount: number;
  readonly fps?: number;
  readonly lastRenderDurationMs?: number;
}
