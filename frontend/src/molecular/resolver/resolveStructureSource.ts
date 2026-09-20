import type { StructureSource, StructureFormat } from '../types';
import { getStructureMetadata } from '../data/structureRegistry';
import { resolveRcsbStructure } from './resolveRcsbStructure';
import { resolveAlphaFoldStructure, parseAlphaFoldIdentifier } from './resolveAlphaFoldStructure';
import { normalizeStructureSource, type StructureDescriptor } from './structureDescriptor';

export interface CanonicalStructureSourceDescriptor {
  displayId: string;
  displayName: string;
  provider: StructureSource;
  providerLabel: string;
  accession: string;
  modelId: string;
  modelVersion?: number | string;
  url: string;
  format: StructureFormat;
  metadataUrl?: string;
  experimental: boolean;
  resolution?: string;
  computationalMetric?: string;
}

/**
 * Central provider-resolution layer.
 * Resolves any catalog item, raw identifier, or input descriptor into a canonical source descriptor.
 * Decouples React UI components from provider-specific URL construction rules.
 */
export function resolveStructureSource(
  input: string | StructureDescriptor
): CanonicalStructureSourceDescriptor {
  const rawId = typeof input === 'string' ? input.trim() : input.pdbId || input.uniprotId || input.datasetId || '';
  const explicitSource = typeof input === 'object' && input.source ? normalizeStructureSource(input.source) : undefined;
  const catalogMeta = getStructureMetadata(rawId);

  // 1. Synthetic / Local Trajectories
  if (rawId.startsWith('synth_') || explicitSource === 'trajectory') {
    const cleanId = rawId.replace(/\.(gro|pdb|xtc)$/, '');
    return {
      displayId: rawId,
      displayName: catalogMeta?.name || `${rawId} (Trajectory Dataset)`,
      provider: 'trajectory',
      providerLabel: 'GROMACS / XTC',
      accession: cleanId,
      modelId: `${cleanId}.gro`,
      url: `/structures/${cleanId}.pdb`,
      format: 'pdb',
      experimental: false,
      resolution: catalogMeta?.resolution,
      computationalMetric: catalogMeta?.computationalMetric,
    };
  }

  // 2. AlphaFold DB Structures
  if (
    explicitSource === 'alphafold' ||
    rawId.startsWith('AF-') ||
    rawId.startsWith('af-') ||
    (typeof input === 'object' && input.uniprotId)
  ) {
    const parsed = parseAlphaFoldIdentifier(rawId);
    const { candidate, provenance } = resolveAlphaFoldStructure(
      parsed.accession,
      (typeof input === 'object' && (input.preferredFormat as any)) || 'mmcif'
    );

    return {
      displayId: catalogMeta?.displayId || parsed.modelId,
      displayName: catalogMeta?.name || `AlphaFold ${parsed.accession}`,
      provider: 'alphafold',
      providerLabel: 'AlphaFold DB',
      accession: parsed.accession,
      modelId: parsed.modelId,
      modelVersion: catalogMeta?.modelVersion || 6,
      url: candidate.url,
      format: candidate.format,
      metadataUrl: `https://alphafold.ebi.ac.uk/api/prediction/${parsed.accession}`,
      experimental: false,
      resolution: catalogMeta?.resolution,
      computationalMetric: catalogMeta?.computationalMetric || 'pLDDT High Confidence',
    };
  }

  // 3. ModelArchive Structures
  if (explicitSource === 'model_archive' || rawId.toUpperCase().startsWith('MA-') || rawId.toLowerCase().startsWith('ma_')) {
    const cleanMaId = rawId.toLowerCase();
    const url = `https://www.modelarchive.org/api/projects/${cleanMaId}?type=file&format=mmcif`;
    return {
      displayId: rawId,
      displayName: catalogMeta?.name || `ModelArchive ${rawId}`,
      provider: 'model_archive',
      providerLabel: 'ModelArchive',
      accession: cleanMaId,
      modelId: cleanMaId,
      url,
      format: 'mmcif',
      metadataUrl: url,
      experimental: false,
      resolution: catalogMeta?.resolution,
      computationalMetric: catalogMeta?.computationalMetric,
    };
  }

  // 4. RCSB Experimental Structures (Default)
  const preferredFormat: 'bcif' | 'mmcif' | 'pdb' =
    typeof input === 'object' && input.preferredFormat === 'pdb'
      ? 'pdb'
      : typeof input === 'object' && input.preferredFormat === 'mmcif'
      ? 'mmcif'
      : 'bcif';

  const { candidate, provenance } = resolveRcsbStructure(
    rawId,
    preferredFormat,
    typeof input === 'object' ? input.assemblyId : undefined
  );

  return {
    displayId: rawId.toUpperCase(),
    displayName: catalogMeta?.name || `${rawId.toUpperCase()} (Experimental)`,
    provider: 'rcsb',
    providerLabel: 'RCSB PDB',
    accession: candidate.modelId,
    modelId: candidate.modelId,
    url: candidate.url,
    format: candidate.format,
    metadataUrl: `https://data.rcsb.org/rest/v1/core/entry/${candidate.modelId}`,
    experimental: true,
    resolution: catalogMeta?.resolution,
  };
}
