import type { StructureSource, StructureFormat } from './structure';

export interface StructureCandidate {
  id: string;
  source: StructureSource;
  provider: string;
  modelId: string;
  format: StructureFormat;
  url: string;
  experimental: boolean;
  assemblyId?: string;
  modelIndex?: number;
  sequenceIdentity?: number;
  coverage?: number;
  resolution?: number;
  plddt?: number;
}
