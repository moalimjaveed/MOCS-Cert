import type {
  StructureCandidate,
  StructureProvenance,
  StructureSource,
  StructureFormat,
  StructureErrorCode,
} from '../types';
import { resolveRcsbStructure } from './resolveRcsbStructure';
import {
  resolveAlphaFoldStructure,
  parseAlphaFoldIdentifier,
  fetchAlphaFoldPrediction,
  AlphaFoldPredictionRecord,
} from './resolveAlphaFoldStructure';
import { rankStructureCandidates } from './rankStructureCandidates';
import { resolveProteinSequenceFold } from './resolveSequenceFold';
import { resolveDesignCandidate, isDesignCandidate } from './resolveDesignCandidate';
import { resolveThreeBeaconsStructure } from './resolveThreeBeaconsStructure';

import {
  validateStructureDescriptor,
  normalizeStructureSource,
  StructureDescriptor,
} from './structureDescriptor';

export class StructureNotFoundError extends Error {
  code: StructureErrorCode = 'RESOURCE_NOT_FOUND';
  status: number = 404;
  provider: string;
  requestedResource?: string;
  retryable: boolean = false;
  constructor(message: string, provider: string = 'Provider', requestedResource?: string) {
    super(message);
    this.name = 'StructureNotFoundError';
    this.provider = provider;
    this.requestedResource = requestedResource;
  }
}

export class StructureAccessDeniedError extends Error {
  code: StructureErrorCode = 'ACCESS_DENIED';
  status: number = 403;
  provider: string;
  requestedResource?: string;
  retryable: boolean = false;
  constructor(message: string, provider: string = 'Provider', requestedResource?: string) {
    super(message);
    this.name = 'StructureAccessDeniedError';
    this.provider = provider;
    this.requestedResource = requestedResource;
  }
}

export class StructureRateLimitedError extends Error {
  code: StructureErrorCode = 'RATE_LIMITED';
  status: number = 429;
  provider: string;
  requestedResource?: string;
  retryable: boolean = true;
  constructor(message: string, provider: string = 'Provider', requestedResource?: string) {
    super(message);
    this.name = 'StructureRateLimitedError';
    this.provider = provider;
    this.requestedResource = requestedResource;
  }
}

export class StructureProviderError extends Error {
  code: StructureErrorCode = 'PROVIDER_ERROR';
  status: number;
  provider: string;
  requestedResource?: string;
  retryable: boolean = true;
  constructor(message: string, status: number = 500, provider: string = 'Provider', requestedResource?: string) {
    super(message);
    this.name = 'StructureProviderError';
    this.status = status;
    this.provider = provider;
    this.requestedResource = requestedResource;
  }
}

export class StructureTimeoutError extends Error {
  code: StructureErrorCode = 'TIMEOUT';
  status: number = 408;
  provider: string;
  requestedResource?: string;
  retryable: boolean = true;
  constructor(message: string, provider: string = 'Provider', requestedResource?: string) {
    super(message);
    this.name = 'StructureTimeoutError';
    this.provider = provider;
    this.requestedResource = requestedResource;
  }
}

export class StructureNetworkError extends Error {
  code: StructureErrorCode = 'NETWORK_ERROR';
  provider: string;
  requestedResource?: string;
  retryable: boolean = true;
  constructor(message: string, provider: string = 'Provider', requestedResource?: string) {
    super(message);
    this.name = 'StructureNetworkError';
    this.provider = provider;
    this.requestedResource = requestedResource;
  }
}

export interface ResolveStructureInput {
  localFile?: File | Blob | ArrayBuffer;
  localFileName?: string;
  datasetId?: string;
  pdbId?: string;
  uniprotId?: string;
  modelArchiveId?: string;
  sequence?: string;
  sequenceName?: string;
  assemblyId?: string;
  modelIndex?: number;
  source?: StructureSource;
  preferredFormat?: StructureFormat;
  customData?: string | ArrayBuffer | Uint8Array;
  candidate?: StructureCandidate;
  signal?: AbortSignal;
}

export interface ResolvedStructure {
  candidate: StructureCandidate;
  provenance: StructureProvenance;
  data: ArrayBuffer | Uint8Array | string;
  isBinary: boolean;
}

// In-memory session cache (guaranteed never to cache negative 404 responses)
const structureCache = new Map<string, ResolvedStructure>();

export function clearStructureCache(): void {
  structureCache.clear();
}

export async function resolveStructure(
  input: ResolveStructureInput
): Promise<ResolvedStructure> {
  const validated = validateStructureDescriptor(input);
  const {
    localFile,
    localFileName,
    datasetId,
    pdbId,
    uniprotId,
    modelArchiveId,
    sequence,
    sequenceName,
    customData,
    candidate,
    signal,
  } = validated;

  if (signal?.aborted) {
    throw new DOMException('Structure loading aborted.', 'AbortError');
  }

  // 1. Direct Custom Data (Uploaded or Programmatically Generated)
  if (customData) {
    const modelId = pdbId || localFileName || 'custom_model';
    const isBinary = customData instanceof ArrayBuffer || customData instanceof Uint8Array;
    const format = input.preferredFormat || (isBinary ? 'bcif' : 'pdb');
    const customCandidate: StructureCandidate = {
      id: `custom_${modelId}`,
      source: input.source ? normalizeStructureSource(input.source) : 'local',
      provider: input.source ? String(input.source).toUpperCase() : 'Custom Data',
      modelId,
      format,
      url: `memory://${modelId}`,
      experimental: true,
    };
    const customProvenance: StructureProvenance = {
      source: customCandidate.source,
      provider: customCandidate.provider,
      modelId,
      format,
      experimental: true,
      sourceUrl: customCandidate.url,
    };
    return {
      candidate: customCandidate,
      provenance: customProvenance,
      data: customData,
      isBinary,
    };
  }

  // 2. Sequence Input (ESMFold pipeline)
  if (sequence) {
    const res = await resolveProteinSequenceFold(sequence, sequenceName || 'ESMFold_Prediction', signal);
    return {
      candidate: res.candidate,
      provenance: res.provenance,
      data: res.pdbText,
      isBinary: false,
    };
  }

  // 3. Local File Upload
  if (localFile) {
    const fileName = localFileName || (localFile as File).name || 'local_structure.cif';
    const isBinary = fileName.endsWith('.bcif');
    const format = fileName.endsWith('.bcif')
      ? 'bcif'
      : fileName.endsWith('.pdb')
      ? 'pdb'
      : 'mmcif';

    let buffer: ArrayBuffer;
    if (localFile instanceof ArrayBuffer) {
      buffer = localFile;
    } else {
      buffer = await (localFile as Blob).arrayBuffer();
    }

    const localCandidate: StructureCandidate = {
      id: `local_${fileName}`,
      source: 'local',
      provider: 'Local File',
      modelId: fileName,
      format,
      url: `local://${fileName}`,
      experimental: true,
    };

    const localProvenance: StructureProvenance = {
      source: 'local',
      provider: 'Local User File',
      modelId: fileName,
      format,
      experimental: true,
      sourceUrl: `local://${fileName}`,
    };

    return {
      candidate: localCandidate,
      provenance: localProvenance,
      data: buffer,
      isBinary,
    };
  }

  // 4. De Novo Design Candidates (RFdiffusion, ProteinMPNN, Boltz)
  if (pdbId && isDesignCandidate(pdbId)) {
    const { candidate: designCandidate, provenance, pdbText } = resolveDesignCandidate(pdbId);
    return {
      candidate: designCandidate,
      provenance,
      data: pdbText,
      isBinary: false,
    };
  }

  // 5. Candidate Resolution List
  const candidateList: StructureCandidate[] = [];
  let candidateProvenance: StructureProvenance | null = null;

  if (candidate) {
    candidateList.push(candidate);
    candidateProvenance = {
      source: candidate.source,
      provider: candidate.provider,
      modelId: candidate.modelId,
      format: candidate.format,
      experimental: candidate.experimental,
      sourceUrl: candidate.url,
    };
  } else if (datasetId || (pdbId && (pdbId.startsWith('synth_') || pdbId.endsWith('.pdb') || pdbId.endsWith('.gro')))) {
    const rawId = (datasetId || pdbId!).trim();
    const cleanId = rawId.replace(/\.(gro|pdb)$/, '');
    const modelId = `${cleanId}.gro`;
    const format = 'pdb';
    const localCandidate: StructureCandidate = {
      id: `mocs_topology_${cleanId}`,
      source: 'local',
      provider: 'MOCS Verified',
      modelId,
      format,
      url: `/structures/${cleanId}.pdb`,
      experimental: false,
    };
    candidateList.push(localCandidate);
    candidateProvenance = {
      source: 'local',
      provider: 'MOCS Verified',
      modelId,
      format,
      experimental: false,
      sourceUrl: `/structures/${cleanId}.pdb`,
    };
  } else if (
    (pdbId && (pdbId.startsWith('AF-') || pdbId.startsWith('af-') || input.source === 'alphafold')) ||
    uniprotId
  ) {
    // Canonical AlphaFold DB Resolution
    const rawTarget = (pdbId || uniprotId)!.trim();
    const parsed = parseAlphaFoldIdentifier(rawTarget);

    let apiRecords: AlphaFoldPredictionRecord[] | null = null;
    try {
      apiRecords = await fetchAlphaFoldPrediction(parsed.accession, signal);
    } catch (apiErr: any) {
      if (apiErr.name === 'AbortError') throw apiErr;
      if (apiErr.status === 404) {
        throw new StructureNotFoundError(
          `Structure '${rawTarget}' was not found in AlphaFold DB (HTTP 404).`,
          'AlphaFold DB',
          `https://alphafold.ebi.ac.uk/api/prediction/${parsed.accession}`
        );
      }
      if (apiErr.status === 401 || apiErr.status === 403) {
        throw new StructureAccessDeniedError(apiErr.message, 'AlphaFold DB', apiErr.requestedResource);
      }
      // If network is offline, timeout, or rate-limited during API check, proceed to versioned file candidates
    }

    if (apiRecords && apiRecords.length > 0) {
      // Find matching fragment/entry or take primary monomer
      const match =
        apiRecords.find((r) => r.entryId === parsed.modelId || r.modelEntityId === parsed.modelId) ||
        apiRecords[0];

      const pref = input.preferredFormat;
      const primaryUrl = pref === 'bcif' ? match.bcifUrl : pref === 'pdb' ? match.pdbUrl : match.cifUrl;
      const primaryFormat: StructureFormat = pref === 'bcif' ? 'bcif' : pref === 'pdb' ? 'pdb' : 'mmcif';

      const liveCandidate: StructureCandidate = {
        id: `af_${match.uniprotAccession}`,
        source: 'alphafold',
        provider: 'AlphaFold DB',
        modelId: match.entryId || parsed.modelId,
        format: primaryFormat,
        url: primaryUrl,
        experimental: false,
      };

      candidateList.push(liveCandidate);

      // Alternative format fallbacks
      if (match.bcifUrl && primaryFormat !== 'bcif') {
        candidateList.push({
          id: `af_${match.uniprotAccession}_bcif`,
          source: 'alphafold',
          provider: 'AlphaFold DB',
          modelId: match.entryId || parsed.modelId,
          format: 'bcif',
          url: match.bcifUrl,
          experimental: false,
        });
      }
      if (match.cifUrl && primaryFormat !== 'mmcif') {
        candidateList.push({
          id: `af_${match.uniprotAccession}_cif`,
          source: 'alphafold',
          provider: 'AlphaFold DB',
          modelId: match.entryId || parsed.modelId,
          format: 'mmcif',
          url: match.cifUrl,
          experimental: false,
        });
      }

      candidateProvenance = {
        source: 'alphafold',
        provider: 'AlphaFold DB',
        modelId: match.entryId || parsed.modelId,
        format: primaryFormat,
        experimental: false,
        sourceUrl: primaryUrl,
      };
    } else {
      // Static candidate fallback: v6 active primary, falling back to v5 and v4
      const { candidate: afCandidate, fallbackCandidates, provenance } = resolveAlphaFoldStructure(
        parsed.accession,
        (input.preferredFormat as any) || 'mmcif'
      );
      candidateList.push(afCandidate, ...fallbackCandidates);
      candidateProvenance = provenance;
    }
  } else if (modelArchiveId || (pdbId && (pdbId.toUpperCase().startsWith('MA-') || pdbId.toLowerCase().startsWith('ma_')))) {
    const rawMaId = modelArchiveId || pdbId!;
    const cleanId = rawMaId.trim().toLowerCase();
    const maCandidate: StructureCandidate = {
      id: `ma_${cleanId}`,
      source: 'model_archive',
      provider: 'ModelArchive',
      modelId: cleanId,
      format: 'mmcif',
      url: `https://www.modelarchive.org/api/projects/${cleanId}?type=file&format=mmcif`,
      experimental: false,
    };
    candidateList.push(maCandidate);
    candidateProvenance = {
      source: 'model_archive',
      provider: 'ModelArchive',
      modelId: cleanId,
      format: 'mmcif',
      experimental: false,
      sourceUrl: maCandidate.url,
    };
  } else if (pdbId) {
    const rcsbFormat: 'bcif' | 'mmcif' | 'pdb' =
      input.preferredFormat === 'pdb'
        ? 'pdb'
        : input.preferredFormat === 'mmcif' || input.preferredFormat === 'cif'
        ? 'mmcif'
        : 'bcif';
    const { candidate: rcsbPrimary, fallbackCandidate, provenance } = resolveRcsbStructure(
      pdbId,
      rcsbFormat,
      input.assemblyId
    );
    if (!input.assemblyId || input.assemblyId === 'deposited') {
      const cleanId = rcsbPrimary.modelId;
      candidateList.push({
        id: `local_bundled_${cleanId}`,
        source: 'local',
        provider: 'RCSB PDB',
        modelId: cleanId,
        format: 'bcif',
        url: `/structures/${cleanId}.bcif`,
        experimental: true,
      });
    }
    candidateList.push(rcsbPrimary, fallbackCandidate);
    candidateProvenance = provenance;
  } else {
    throw new StructureNotFoundError(
      'No structure identifier provided. Please specify a PDB ID, UniProt ID, sequence, or local structure file.'
    );
  }

  const ranked = rankStructureCandidates(candidateList);

  const getCacheKey = (c: StructureCandidate) =>
    `${c.source}_${c.modelId}_${c.format}${input.assemblyId && input.assemblyId !== 'deposited' ? `_asm${input.assemblyId}` : ''}${input.modelIndex !== undefined ? `_m${input.modelIndex}` : ''}`;

  // Check Cache first across all candidates (cached entries are strictly successful structures)
  for (const candidate of ranked) {
    const cacheKey = getCacheKey(candidate);
    if (structureCache.has(cacheKey)) {
      return structureCache.get(cacheKey)!;
    }
  }

  // 6. Fetch structure with fallback
  let lastError: Error | null = null;

  for (let i = 0; i < ranked.length; i++) {
    const selectedCandidate = ranked[i];
    const cacheKey = getCacheKey(selectedCandidate);
    const fetchUrl = selectedCandidate.url;
    const isBinary = selectedCandidate.format === 'bcif';
    const providerLabel = selectedCandidate.provider || selectedCandidate.source || 'Remote Provider';

    try {
      const res = await fetch(fetchUrl, {
        signal,
        headers: isBinary
          ? { Accept: 'application/octet-stream' }
          : { Accept: 'chemical/x-mmcif, text/plain, */*' },
      });

      if (!res.ok) {
        if (res.status === 404) {
          if (selectedCandidate.source === 'local') {
            // Local file not bundled; proceed to remote RCSB
            continue;
          }
          // If there are further candidate URLs for the same provider (e.g. older versions or other formats), try them
          const hasMoreSameProviderCandidates = ranked.slice(i + 1).some((c) => c.source === selectedCandidate.source);
          if (hasMoreSameProviderCandidates) {
            continue;
          }
          throw new StructureNotFoundError(
            `Structure '${selectedCandidate.modelId}' was not found in ${providerLabel} (HTTP 404).`,
            providerLabel,
            fetchUrl
          );
        }
        if (res.status === 401 || res.status === 403) {
          throw new StructureAccessDeniedError(
            `Access denied to structure '${selectedCandidate.modelId}' from ${providerLabel} (HTTP ${res.status}).`,
            providerLabel,
            fetchUrl
          );
        }
        if (res.status === 408) {
          throw new StructureTimeoutError(
            `Timeout fetching structure '${selectedCandidate.modelId}' from ${providerLabel} (HTTP 408).`,
            providerLabel,
            fetchUrl
          );
        }
        if (res.status === 429) {
          throw new StructureRateLimitedError(
            `Rate limited by ${providerLabel} (HTTP 429). Please wait before retrying.`,
            providerLabel,
            fetchUrl
          );
        }
        if (res.status >= 500) {
          throw new StructureProviderError(
            `Provider error from ${providerLabel} (HTTP ${res.status}: ${res.statusText}).`,
            res.status,
            providerLabel,
            fetchUrl
          );
        }
        throw new StructureNetworkError(
          `Failed to fetch structure from ${providerLabel} (HTTP ${res.status}: ${res.statusText}).`,
          providerLabel,
          fetchUrl
        );
      }

      const data = isBinary ? await res.arrayBuffer() : await res.text();

      const resolved: ResolvedStructure = {
        candidate: selectedCandidate,
        provenance: candidateProvenance || {
          source: selectedCandidate.source,
          provider: providerLabel,
          modelId: selectedCandidate.modelId,
          format: selectedCandidate.format,
          experimental: selectedCandidate.experimental,
          sourceUrl: selectedCandidate.url,
        },
        data,
        isBinary,
      };

      // Only successful structures are placed into cache
      structureCache.set(cacheKey, resolved);
      return resolved;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }
      if (
        err instanceof StructureNotFoundError ||
        err instanceof StructureAccessDeniedError
      ) {
        throw err;
      }
      lastError =
        err instanceof StructureNetworkError ||
        err instanceof StructureRateLimitedError ||
        err instanceof StructureProviderError ||
        err instanceof StructureTimeoutError
          ? err
          : new StructureNetworkError(
              `Network failure connecting to ${providerLabel}: ${err.message || 'Unknown network error'}`,
              providerLabel,
              fetchUrl
            );
    }
  }

  if (lastError) {
    throw lastError;
  }
  throw new StructureNotFoundError('No structure candidate could be resolved.');
}
