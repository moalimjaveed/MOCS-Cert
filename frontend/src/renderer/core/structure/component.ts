export type ComponentKind = 'protein' | 'ligand' | 'nucleic' | 'solvent' | 'ion' | 'other';

export interface StructuralComponent {
  readonly id: string;
  readonly kind: ComponentKind;
  readonly name: string;
  readonly atomIndices: Uint32Array; // indices into topology.atoms
}
