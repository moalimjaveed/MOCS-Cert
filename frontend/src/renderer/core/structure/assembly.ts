import { SpatialOperator } from '../identity/operator.js';

export interface BiologicalAssembly {
  readonly id: string;
  readonly name: string;
  readonly operators: readonly SpatialOperator[];
}
