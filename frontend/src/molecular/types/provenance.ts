import type { StructureSource, StructureFormat } from './structure';

export interface StructureProvenance {
  source: StructureSource;
  provider: string;
  modelId: string;
  format: StructureFormat;
  experimental: boolean;
  title?: string;
  method?: string;
  resolution?: number;
  confidence?: number;
  assemblyId?: string;
  sourceUrl: string;
}
