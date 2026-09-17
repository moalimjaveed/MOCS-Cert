export interface RendererCapabilities {
  readonly name: string;
  readonly supportsCustomShapes: boolean;
  readonly supportsDirectCoordinateUpdates: boolean;
  readonly supportsSecondaryStructure: boolean;
  readonly supportsSurfaces: boolean;
  readonly supportsInstancing: boolean;
  readonly maxTextureSize: number;
}
