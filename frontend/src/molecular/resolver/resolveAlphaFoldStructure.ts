import type { StructureCandidate, StructureProvenance } from '../types';
import { InvalidStructureIdError } from './resolveRcsbStructure';

// UniProt accessions: standard 6-10 chars (e.g. 'P69905') or isoform (e.g. 'P04637-2')
const UNIPROT_ID_REGEX = /^[A-Z0-9]{6,10}(-[0-9]+)?$/;

// AlphaFold model entity identifier (e.g. 'AF-P69905-F1' or 'AF-P04637-2-F1')
const ALPHAFOLD_MODEL_REGEX = /^AF-[A-Z0-9]{6,10}(?:-[0-9]+)?-F[0-9]+$/;

export interface ParsedAlphaFoldId {
  accession: string;
  fragment: string;
  modelId: string;
  isModelId: boolean;
}

/**
 * Cleanly separates display identifier, UniProt accession, fragment suffix, and canonical model ID.
 */
export function parseAlphaFoldIdentifier(raw: string): ParsedAlphaFoldId {
  if (!raw || !raw.trim()) {
    throw new InvalidStructureIdError('AlphaFold identifier must not be empty.');
  }
  const clean = raw.trim().toUpperCase();

  if (ALPHAFOLD_MODEL_REGEX.test(clean)) {
    // Format: AF-{accession}-F{fragment} or AF-{accession}-{isoform}-F{fragment}
    // E.g. AF-P69905-F1 -> accession 'P69905', fragment 'F1'
    // E.g. AF-P04637-2-F1 -> accession 'P04637-2', fragment 'F1'
    const withoutPrefix = clean.slice(3); // Remove 'AF-'
    const lastDashIdx = withoutPrefix.lastIndexOf('-');
    const fragment = withoutPrefix.slice(lastDashIdx + 1);
    const accession = withoutPrefix.slice(0, lastDashIdx);

    return {
      accession,
      fragment,
      modelId: clean,
      isModelId: true,
    };
  }

  if (UNIPROT_ID_REGEX.test(clean)) {
    return {
      accession: clean,
      fragment: 'F1',
      modelId: `AF-${clean}-F1`,
      isModelId: false,
    };
  }

  throw new InvalidStructureIdError(
    `Invalid AlphaFold or UniProt identifier format: '${raw}'. Expected a UniProt accession (e.g. 'P69905') or AlphaFold model ID (e.g. 'AF-P69905-F1').`
  );
}

export function normalizeUniProtId(rawId: string): string {
  return parseAlphaFoldIdentifier(rawId).accession;
}

export interface AlphaFoldPredictionRecord {
  entryId: string;
  modelEntityId: string;
  latestVersion: number;
  allVersions: number[];
  bcifUrl: string;
  cifUrl: string;
  pdbUrl: string;
  globalMetricValue: number;
  uniprotAccession: string;
  uniprotId: string;
  uniprotDescription: string;
  gene?: string;
  organismScientificName?: string;
  sequence?: string;
  sequenceStart?: number;
  sequenceEnd?: number;
}

/**
 * Queries the official, public, live AlphaFold DB Prediction API.
 * Returns authoritative prediction metadata and canonical URLs for all available model versions.
 */
export async function fetchAlphaFoldPrediction(
  identifier: string,
  signal?: AbortSignal
): Promise<AlphaFoldPredictionRecord[]> {
  const parsed = parseAlphaFoldIdentifier(identifier);
  const apiUrl = `https://alphafold.ebi.ac.uk/api/prediction/${parsed.accession}`;

  const res = await fetch(apiUrl, {
    signal,
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const error: any = new Error(
      `Structure '${identifier}' was not found in AlphaFold DB (HTTP ${res.status}: ${res.statusText}).`
    );
    error.status = res.status;
    error.provider = 'AlphaFold DB';
    error.requestedResource = apiUrl;
    error.code =
      res.status === 404
        ? 'RESOURCE_NOT_FOUND'
        : res.status === 401 || res.status === 403
        ? 'ACCESS_DENIED'
        : res.status === 408
        ? 'TIMEOUT'
        : res.status === 429
        ? 'RATE_LIMITED'
        : res.status >= 500
        ? 'PROVIDER_ERROR'
        : 'INVALID_PROVIDER_RESPONSE';
    error.retryable = res.status === 429 || res.status >= 500 || res.status === 408;
    throw error;
  }

  const data: unknown = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    const emptyError: any = new Error(
      `Structure '${identifier}' has no prediction records in AlphaFold DB.`
    );
    emptyError.status = 404;
    emptyError.code = 'RESOURCE_NOT_FOUND';
    emptyError.provider = 'AlphaFold DB';
    emptyError.requestedResource = apiUrl;
    emptyError.retryable = false;
    throw emptyError;
  }

  return data as AlphaFoldPredictionRecord[];
}

/**
 * Resolves AlphaFold candidate models.
 * AlphaFold DB default active version is Version 6 (v6).
 * Generates primary candidate for v6 and fallback candidates for v5 and v4.
 */
export function resolveAlphaFoldStructure(
  uniprotIdOrModelId: string,
  preferredFormat: 'mmcif' | 'bcif' | 'pdb' = 'mmcif',
  explicitVersion: number | string = 6
): {
  candidate: StructureCandidate;
  fallbackCandidate: StructureCandidate;
  fallbackCandidates: StructureCandidate[];
  provenance: StructureProvenance;
  parsedId: ParsedAlphaFoldId;
} {
  const parsed = parseAlphaFoldIdentifier(uniprotIdOrModelId);
  const { accession, modelId } = parsed;

  const versionTag = typeof explicitVersion === 'number' ? `v${explicitVersion}` : explicitVersion.startsWith('v') ? explicitVersion : `v${explicitVersion}`;

  const ext = preferredFormat === 'bcif' ? 'bcif' : preferredFormat === 'pdb' ? 'pdb' : 'cif';
  const format: 'mmcif' | 'bcif' | 'pdb' = preferredFormat === 'pdb' ? 'pdb' : preferredFormat === 'bcif' ? 'bcif' : 'mmcif';

  // Primary Canonical URL (Version 6 active release)
  const primaryUrl = `https://alphafold.ebi.ac.uk/files/${modelId}-model_${versionTag}.${ext}`;

  // Fallback URLs for earlier versions and alternative formats
  const v5Url = `https://alphafold.ebi.ac.uk/files/${modelId}-model_v5.${ext}`;
  const v4Url = `https://alphafold.ebi.ac.uk/files/${modelId}-model_v4.${ext}`;
  const bcifFallbackUrl = `https://alphafold.ebi.ac.uk/files/${modelId}-model_${versionTag}.bcif`;
  const pdbFallbackUrl = `https://alphafold.ebi.ac.uk/files/${modelId}-model_${versionTag}.pdb`;

  const candidate: StructureCandidate = {
    id: `af_${accession}`,
    source: 'alphafold',
    provider: 'AlphaFold DB',
    modelId,
    format,
    url: primaryUrl,
    experimental: false,
  };

  const v5Candidate: StructureCandidate = {
    id: `af_${accession}_v5`,
    source: 'alphafold',
    provider: 'AlphaFold DB',
    modelId,
    format,
    url: v5Url,
    experimental: false,
  };

  const v4Candidate: StructureCandidate = {
    id: `af_${accession}_v4`,
    source: 'alphafold',
    provider: 'AlphaFold DB',
    modelId,
    format,
    url: v4Url,
    experimental: false,
  };

  const bcifCandidate: StructureCandidate = {
    id: `af_${accession}_bcif`,
    source: 'alphafold',
    provider: 'AlphaFold DB',
    modelId,
    format: 'bcif',
    url: bcifFallbackUrl,
    experimental: false,
  };

  const pdbCandidate: StructureCandidate = {
    id: `af_${accession}_pdb`,
    source: 'alphafold',
    provider: 'AlphaFold DB',
    modelId,
    format: 'pdb',
    url: pdbFallbackUrl,
    experimental: false,
  };

  const provenance: StructureProvenance = {
    source: 'alphafold',
    provider: 'AlphaFold DB',
    modelId,
    format,
    experimental: false,
    sourceUrl: primaryUrl,
  };

  return {
    candidate,
    fallbackCandidate: v5Candidate,
    fallbackCandidates: [v5Candidate, v4Candidate, bcifCandidate, pdbCandidate],
    provenance,
    parsedId: parsed,
  };
}
