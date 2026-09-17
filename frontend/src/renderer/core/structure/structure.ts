import { Topology } from './topology.js';
import { StructureModel } from './model.js';
import { StructuralComponent } from './component.js';
import { BiologicalAssembly } from './assembly.js';

export interface CanonicalStructure {
  readonly datasetId: string;
  readonly topology: Topology;
  readonly models: readonly StructureModel[];
  readonly components: readonly StructuralComponent[];
  readonly assemblies: readonly BiologicalAssembly[];
  readonly defaultModelIndex: number;
}
