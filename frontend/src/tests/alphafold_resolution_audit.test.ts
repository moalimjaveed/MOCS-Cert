// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseAlphaFoldIdentifier,
  normalizeUniProtId,
  resolveAlphaFoldStructure,
  fetchAlphaFoldPrediction,
  AlphaFoldPredictionRecord,
} from '../molecular/resolver/resolveAlphaFoldStructure';
import {
  resolveStructure,
  clearStructureCache,
  StructureNotFoundError,
  StructureAccessDeniedError,
  StructureRateLimitedError,
  StructureProviderError,
  StructureTimeoutError,
  StructureNetworkError,
} from '../molecular/resolver/resolveStructure';
import { resolveStructureSource } from '../molecular/resolver/resolveStructureSource';
import { STRUCTURE_REGISTRY, getStructureMetadata } from '../molecular/data/structureRegistry';
import { InvalidStructureIdError } from '../molecular/resolver/resolveRcsbStructure';

describe('AlphaFold Structure Resolution & Real Provider/Identifier Audit Suite', () => {
  beforeEach(() => {
    clearStructureCache();
  });

  describe('1. Canonical AlphaFold Identifier Parsing & Distinction', () => {
    it('parses bare UniProt accession and differentiates display ID from fetch accession', () => {
      const parsed = parseAlphaFoldIdentifier('P69905');
      expect(parsed.accession).toBe('P69905');
      expect(parsed.fragment).toBe('F1');
      expect(parsed.modelId).toBe('AF-P69905-F1');
      expect(parsed.isModelId).toBe(false);
      expect(normalizeUniProtId('P69905')).toBe('P69905');
    });

    it('parses full AlphaFold model identifier into accession and canonical model entity ID', () => {
      const parsed = parseAlphaFoldIdentifier('AF-P69905-F1');
      expect(parsed.accession).toBe('P69905');
      expect(parsed.fragment).toBe('F1');
      expect(parsed.modelId).toBe('AF-P69905-F1');
      expect(parsed.isModelId).toBe(true);
    });

    it('parses isoform AlphaFold accessions correctly', () => {
      const parsed = parseAlphaFoldIdentifier('AF-P04637-2-F1');
      expect(parsed.accession).toBe('P04637-2');
      expect(parsed.fragment).toBe('F1');
      expect(parsed.modelId).toBe('AF-P04637-2-F1');
    });

    it('rejects malformed or empty identifiers', () => {
      expect(() => parseAlphaFoldIdentifier('')).toThrow(InvalidStructureIdError);
      expect(() => parseAlphaFoldIdentifier('P6')).toThrow(InvalidStructureIdError);
      expect(() => parseAlphaFoldIdentifier('P699051234567')).toThrow(InvalidStructureIdError);
      expect(() => parseAlphaFoldIdentifier('INVALID_NOT_UNIPROT')).toThrow(InvalidStructureIdError);
    });
  });

  describe('2. Provider URL Generation & Version Cascading', () => {
    it('generates canonical Version 6 (v6) active release URL as primary candidate', () => {
      const { candidate, fallbackCandidates } = resolveAlphaFoldStructure('P69905');
      expect(candidate.url).toBe('https://alphafold.ebi.ac.uk/files/AF-P69905-F1-model_v6.cif');
      expect(candidate.format).toBe('mmcif');
      expect(candidate.provider).toBe('AlphaFold DB');

      // Verifies version cascading fallbacks: v5, v4, bcif, pdb
      const urls = fallbackCandidates.map((c) => c.url);
      expect(urls).toContain('https://alphafold.ebi.ac.uk/files/AF-P69905-F1-model_v5.cif');
      expect(urls).toContain('https://alphafold.ebi.ac.uk/files/AF-P69905-F1-model_v4.cif');
      expect(urls).toContain('https://alphafold.ebi.ac.uk/files/AF-P69905-F1-model_v6.bcif');
      expect(urls).toContain('https://alphafold.ebi.ac.uk/files/AF-P69905-F1-model_v6.pdb');
    });

    it('generates binary BCIF candidate when preferred format is bcif', () => {
      const { candidate } = resolveAlphaFoldStructure('P69905', 'bcif');
      expect(candidate.url).toBe('https://alphafold.ebi.ac.uk/files/AF-P69905-F1-model_v6.bcif');
      expect(candidate.format).toBe('bcif');
    });
  });

  describe('3. Live Prediction API Discovery & Metadata Mapping', () => {
    const mockPredictionRecord: AlphaFoldPredictionRecord = {
      entryId: 'AF-P69905-F1',
      modelEntityId: 'AF-P69905-F1',
      latestVersion: 6,
      allVersions: [1, 2, 3, 4, 5, 6],
      bcifUrl: 'https://alphafold.ebi.ac.uk/files/AF-P69905-F1-model_v6.bcif',
      cifUrl: 'https://alphafold.ebi.ac.uk/files/AF-P69905-F1-model_v6.cif',
      pdbUrl: 'https://alphafold.ebi.ac.uk/files/AF-P69905-F1-model_v6.pdb',
      globalMetricValue: 98.06,
      uniprotAccession: 'P69905',
      uniprotId: 'HBA_HUMAN',
      uniprotDescription: 'Hemoglobin subunit alpha',
      gene: 'HBA1',
      organismScientificName: 'Homo sapiens',
    };

    it('resolves structure via prediction API with authentic v6 URL and pLDDT metric', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/api/prediction/')) {
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => [mockPredictionRecord],
          } as any;
        }
        if (urlStr.includes('AF-P69905-F1-model_v6.cif')) {
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            text: async () => 'data_AF_P69905\n# Authentic mmCIF test payload',
          } as any;
        }
        return { ok: false, status: 404, statusText: 'Not Found' } as any;
      });

      try {
        const res = await resolveStructure({ pdbId: 'AF-P69905-F1' });
        expect(res).toBeDefined();
        expect(res.candidate.url).toBe('https://alphafold.ebi.ac.uk/files/AF-P69905-F1-model_v6.cif');
        expect(res.provenance.provider).toBe('AlphaFold DB');
        expect(res.data).toContain('data_AF_P69905');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('resolves bare UniProt accession through AlphaFold provider pathway', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/api/prediction/')) {
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => [mockPredictionRecord],
          } as any;
        }
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => 'data_AF_P69905\nATOM 1 CA VAL A 1 0.0 0.0 0.0',
        } as any;
      });

      try {
        const res = await resolveStructure({ uniprotId: 'P69905', source: 'alphafold' });
        expect(res).toBeDefined();
        expect(res.candidate.modelId).toBe('AF-P69905-F1');
        expect(res.candidate.provider).toBe('AlphaFold DB');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('4. Comprehensive Error Classification & Retry Policy', () => {
    it('classifies 404 response as non-retryable RESOURCE_NOT_FOUND', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn(async (url: any) => {
        return {
          ok: false,
          status: 404,
          statusText: 'Not Found',
        } as any;
      });

      try {
        await expect(resolveStructure({ pdbId: 'AF-Q00000-F1' })).rejects.toThrow(StructureNotFoundError);
        try {
          await resolveStructure({ pdbId: 'AF-Q00000-F1' });
        } catch (err: any) {
          expect(err.code).toBe('RESOURCE_NOT_FOUND');
          expect(err.status).toBe(404);
          expect(err.retryable).toBe(false);
          expect(err.provider).toBe('AlphaFold DB');
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('classifies 403 response as non-retryable ACCESS_DENIED', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn(async () => ({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      } as any));

      try {
        await expect(resolveStructure({ pdbId: 'AF-P69905-F1' })).rejects.toThrow(StructureAccessDeniedError);
        try {
          await resolveStructure({ pdbId: 'AF-P69905-F1' });
        } catch (err: any) {
          expect(err.code).toBe('ACCESS_DENIED');
          expect(err.status).toBe(403);
          expect(err.retryable).toBe(false);
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('classifies 429 response as retryable RATE_LIMITED', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn(async () => ({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as any));

      try {
        await expect(resolveStructure({ pdbId: 'AF-P69905-F1' })).rejects.toThrow(StructureRateLimitedError);
        try {
          await resolveStructure({ pdbId: 'AF-P69905-F1' });
        } catch (err: any) {
          expect(err.code).toBe('RATE_LIMITED');
          expect(err.status).toBe(429);
          expect(err.retryable).toBe(true);
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('classifies 500 response as retryable PROVIDER_ERROR', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn(async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as any));

      try {
        await expect(resolveStructure({ pdbId: 'AF-P69905-F1' })).rejects.toThrow(StructureProviderError);
        try {
          await resolveStructure({ pdbId: 'AF-P69905-F1' });
        } catch (err: any) {
          expect(err.code).toBe('PROVIDER_ERROR');
          expect(err.status).toBe(500);
          expect(err.retryable).toBe(true);
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('classifies 408 response as retryable TIMEOUT', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn(async () => ({
        ok: false,
        status: 408,
        statusText: 'Request Timeout',
      } as any));

      try {
        await expect(resolveStructure({ pdbId: 'AF-P69905-F1' })).rejects.toThrow(StructureTimeoutError);
        try {
          await resolveStructure({ pdbId: 'AF-P69905-F1' });
        } catch (err: any) {
          expect(err.code).toBe('TIMEOUT');
          expect(err.status).toBe(408);
          expect(err.retryable).toBe(true);
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('classifies general network drop as retryable NETWORK_ERROR', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn(async () => {
        throw new TypeError('Failed to fetch (network disconnected)');
      });

      try {
        await expect(resolveStructure({ pdbId: 'AF-P69905-F1' })).rejects.toThrow(StructureNetworkError);
        try {
          await resolveStructure({ pdbId: 'AF-P69905-F1' });
        } catch (err: any) {
          expect(err.code).toBe('NETWORK_ERROR');
          expect(err.retryable).toBe(true);
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('5. Cache Invariants: Never Cache Permanent 404 Errors', () => {
    it('does not poison subsequent retries when a 404 occurs', async () => {
      const originalFetch = globalThis.fetch;
      let attempt = 0;
      globalThis.fetch = vi.fn(async () => {
        attempt++;
        if (attempt === 1) {
          return { ok: false, status: 404, statusText: 'Not Found' } as any;
        }
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => 'data_AF_P69905_recovered\nATOM 1 CA',
        } as any;
      });

      try {
        // Attempt 1 fails with 404
        await expect(resolveStructure({ pdbId: 'AF-P69905-F1' })).rejects.toThrow(StructureNotFoundError);

        // Attempt 2 succeeds because 404 was NOT cached
        const recovered = await resolveStructure({ pdbId: 'AF-P69905-F1' });
        expect(recovered).toBeDefined();
        expect(recovered.data).toContain('data_AF_P69905_recovered');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('6. Provider Resolution Layer (resolveStructureSource)', () => {
    it('resolves AlphaFold structure descriptor with separated displayId and accession', () => {
      const source = resolveStructureSource('AF-P69905-F1');
      expect(source.provider).toBe('alphafold');
      expect(source.providerLabel).toBe('AlphaFold DB');
      expect(source.displayId).toBe('AF-P69905-F1');
      expect(source.accession).toBe('P69905');
      expect(source.modelId).toBe('AF-P69905-F1');
      expect(source.modelVersion).toBe(6);
      expect(source.url).toBe('https://alphafold.ebi.ac.uk/files/AF-P69905-F1-model_v6.cif');
      expect(source.metadataUrl).toBe('https://alphafold.ebi.ac.uk/api/prediction/P69905');
      expect(source.experimental).toBe(false);
    });

    it('resolves RCSB structure descriptor with separated accession and URL', () => {
      const source = resolveStructureSource('4HHB');
      expect(source.provider).toBe('rcsb');
      expect(source.providerLabel).toBe('RCSB PDB');
      expect(source.displayId).toBe('4HHB');
      expect(source.accession).toBe('4HHB');
      expect(source.modelId).toBe('4HHB');
      expect(source.url).toContain('4HHB.bcif');
      expect(source.experimental).toBe(true);
    });
  });

  describe('7. Curated Catalog AlphaFold Metadata Audit', () => {
    it('verifies AF-P69905-F1 metadata reflects canonical v6 values', () => {
      const meta = getStructureMetadata('AF-P69905-F1');
      expect(meta).toBeDefined();
      expect(meta?.provider).toBe('AlphaFold DB');
      expect(meta?.accession).toBe('P69905');
      expect(meta?.modelId).toBe('AF-P69905-F1');
      expect(meta?.modelVersion).toBe(6);
      expect(meta?.description).toContain('AlphaFold v6 Prediction');
      expect(meta?.confidenceMetrics?.plddtAvg).toBe(98.4);
    });

    it('verifies AF-P04637-F1 metadata reflects canonical v6 values', () => {
      const meta = getStructureMetadata('AF-P04637-F1');
      expect(meta).toBeDefined();
      expect(meta?.provider).toBe('AlphaFold DB');
      expect(meta?.accession).toBe('P04637');
      expect(meta?.modelId).toBe('AF-P04637-F1');
      expect(meta?.modelVersion).toBe(6);
      expect(meta?.description).toContain('AlphaFold v6 Prediction');
      expect(meta?.confidenceMetrics?.plddtAvg).toBe(75.1);
    });
  });

  describe('8. Cross-Provider Regression Verification', () => {
    const experimentalCatalog = ['4HHB', '1BNA', '1TUP', '1STP', '1CRN'];

    it.each(experimentalCatalog)('guarantees RCSB structure %s resolves independently', (id) => {
      const source = resolveStructureSource(id);
      expect(source.provider).toBe('rcsb');
      expect(source.providerLabel).toBe('RCSB PDB');
      expect(source.experimental).toBe(true);
      expect(source.accession).toBe(id);
      expect(source.url).toContain(`${id}.bcif`);
    });
  });
});
