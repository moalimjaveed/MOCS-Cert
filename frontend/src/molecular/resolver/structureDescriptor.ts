import { z } from 'zod';
import type { StructureSource, StructureFormat } from '../types';

export class InvalidStructureDescriptorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStructureDescriptorError';
  }
}

export const StructureSourceSchema = z.enum([
  'local',
  'rcsb',
  'alphafold',
  'three_beacons',
  'model_archive',
  'esmfold',
  'rfdiffusion',
  'proteinmpnn',
  'boltz',
  'computed',
  'trajectory',
]);

export const StructureFormatSchema = z.enum([
  'bcif',
  'mmcif',
  'cif',
  'pdb',
  'gro',
]);

export const StructureDescriptorSchema = z.object({
  pdbId: z.string().trim().min(1).optional(),
  modelArchiveId: z.string().trim().min(1).optional(),
  datasetId: z.string().trim().min(1).optional(),
  uniprotId: z.string().trim().min(1).optional(),
  source: StructureSourceSchema.optional(),
  customData: z.union([z.string(), z.instanceof(ArrayBuffer), z.instanceof(Uint8Array)]).optional(),
  localFile: z.any().optional(),
  localFileName: z.string().optional(),
  sequence: z.string().trim().optional(),
  sequenceName: z.string().trim().optional(),
  assemblyId: z.string().trim().optional(),
  modelIndex: z.number().int().nonnegative().optional(),
  preferredFormat: StructureFormatSchema.optional(),
  candidate: z.any().optional(),
  signal: z.any().optional(),
});

export type StructureDescriptor = z.infer<typeof StructureDescriptorSchema>;

/**
 * Maps raw provider strings, user selections, and legacy source tokens into canonical StructureSource enum values.
 */
export function normalizeStructureSource(rawProviderOrSource?: string): StructureSource {
  if (!rawProviderOrSource) return 'local';
  const norm = rawProviderOrSource.trim().toLowerCase();

  if (norm.includes('rcsb') || norm === 'pdb' || norm.includes('redo')) {
    return 'rcsb';
  }
  if (norm.includes('alphafold') || norm === 'af') {
    return 'alphafold';
  }
  if (norm.includes('modelarchive') || norm.includes('model_archive')) {
    return 'model_archive';
  }
  if (norm.includes('rfdiffusion') || norm.includes('ipd')) {
    return 'rfdiffusion';
  }
  if (norm.includes('proteinmpnn')) {
    return 'proteinmpnn';
  }
  if (norm.includes('boltz')) {
    return 'boltz';
  }
  if (norm.includes('gromacs') || norm.includes('xtc') || norm.includes('trajectory')) {
    return 'trajectory';
  }
  if (norm.includes('esmfold') || norm.includes('esm')) {
    return 'esmfold';
  }
  if (norm.includes('beacons') || norm.includes('three_beacons')) {
    return 'three_beacons';
  }
  if (norm === 'computed') {
    return 'computed';
  }
  return 'local';
}

/**
 * Validates and normalizes an incoming structure descriptor against canonical invariants.
 */
export function validateStructureDescriptor(input: unknown): StructureDescriptor {
  if (!input || typeof input !== 'object') {
    throw new InvalidStructureDescriptorError(
      'Structure descriptor must be a non-null object.'
    );
  }

  const raw = input as Record<string, any>;
  const normalizedInput: Record<string, any> = { ...raw };

  if (raw.source && typeof raw.source === 'string') {
    normalizedInput.source = normalizeStructureSource(raw.source);
  }

  const parseResult = StructureDescriptorSchema.safeParse(normalizedInput);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new InvalidStructureDescriptorError(`Invalid structure descriptor: ${errorDetails}`);
  }

  const validated = parseResult.data;

  const hasIdentifier = Boolean(
    validated.pdbId ||
    validated.modelArchiveId ||
    validated.datasetId ||
    validated.uniprotId ||
    validated.sequence ||
    validated.localFile ||
    validated.customData ||
    validated.candidate
  );

  if (!hasIdentifier) {
    throw new InvalidStructureDescriptorError(
      'Structure descriptor must specify at least one target identifier: pdbId, modelArchiveId, datasetId, uniprotId, sequence, localFile, or customData.'
    );
  }

  return validated;
}
