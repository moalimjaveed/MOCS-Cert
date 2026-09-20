import { MaterialPreset, QualityLevel } from '@mocs/scene';

export interface MaterialParameters {
  readonly preset: MaterialPreset;
  readonly metalness: number;
  readonly roughness: number;
  readonly bumpiness?: number;
}

export const MATERIAL_PRESETS: Record<MaterialPreset, MaterialParameters> = {
  soft: { preset: 'soft', metalness: 0.05, roughness: 0.65 },
  matte: { preset: 'matte', metalness: 0.0, roughness: 0.9 },
  diffuse: { preset: 'diffuse', metalness: 0.0, roughness: 0.5 },
  gloss: { preset: 'gloss', metalness: 0.15, roughness: 0.25 },
};

export interface QualityParameters {
  readonly level: QualityLevel;
  readonly pixelRatio: number;
  readonly sampleCount: number;
  readonly enableShadows: boolean;
  readonly enableOcclusion: boolean;
}

export const QUALITY_PRESETS: Record<QualityLevel, QualityParameters> = {
  performance: { level: 'performance', pixelRatio: 1.0, sampleCount: 1, enableShadows: false, enableOcclusion: false },
  balanced: { level: 'balanced', pixelRatio: 1.0, sampleCount: 2, enableShadows: false, enableOcclusion: true },
  high: { level: 'high', pixelRatio: 1.5, sampleCount: 4, enableShadows: true, enableOcclusion: true },
  publication: { level: 'publication', pixelRatio: 2.0, sampleCount: 8, enableShadows: true, enableOcclusion: true },
};

export interface VisibilityFilter {
  readonly protein: boolean;
  readonly ligand: boolean;
  readonly nucleic: boolean;
  readonly solvent: boolean;
  readonly ions: boolean;
  readonly hydrogens: boolean;
}

export const DEFAULT_VISIBILITY: VisibilityFilter = {
  protein: true,
  ligand: true,
  nucleic: true,
  solvent: false,
  ions: false,
  hydrogens: false,
};
