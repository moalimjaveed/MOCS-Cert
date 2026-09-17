export type RepresentationType =
  | 'cartoon'
  | 'ball-and-stick'
  | 'stick'
  | 'spacefill'
  | 'backbone'
  | 'surface'
  | 'point'
  | 'off';

export type MaterialPreset = 'diffuse' | 'matte' | 'soft' | 'gloss';

export type QualityLevel = 'performance' | 'balanced' | 'high' | 'publication';

export interface MolecularObject {
  readonly id: string;
  readonly componentKind: 'protein' | 'ligand' | 'nucleic' | 'solvent' | 'ion' | 'other';
  readonly targetComponentId: string;
  readonly visibility: boolean;
  readonly representation: RepresentationType;
  readonly colorTheme: string;
  readonly material: MaterialPreset;
  readonly quality: QualityLevel;
  readonly emphasis?: 'normal' | 'highlight' | 'dim';
}

export interface MolecularScene {
  readonly datasetId: string;
  readonly modelNum: number;
  readonly objects: readonly MolecularObject[];
}
