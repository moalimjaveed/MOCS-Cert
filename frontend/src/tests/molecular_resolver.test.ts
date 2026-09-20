import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  normalizePdbId,
  resolveRcsbStructure,
  InvalidStructureIdError,
} from '../molecular/resolver/resolveRcsbStructure';
import {
  normalizeUniProtId,
  resolveAlphaFoldStructure,
} from '../molecular/resolver/resolveAlphaFoldStructure';
import { rankStructureCandidates } from '../molecular/resolver/rankStructureCandidates';
import {
  resolveStructure,
  clearStructureCache,
  StructureNotFoundError,
} from '../molecular/resolver/resolveStructure';
import {
  computeAtomCoordinatesAABB,
  calculateEuclideanDistance,
} from '../molecular/geometry/coordinateBounds';
import { extractCoordinatesFromMolstarStructure } from '../molecular/geometry/structureBounds';
import { computeMeasurement } from '../molecular/measurements';
import type { StructureCandidate } from '../molecular/types';

describe('Molecular Structure Architecture & Geometry Engine', () => {
  beforeEach(() => {
    clearStructureCache();
    vi.restoreAllMocks();
  });

  describe('1. PDB ID Normalization & Validation', () => {
    it('normalizes valid lowercase and padded PDB IDs to standard uppercase', () => {
      expect(normalizePdbId('4hhb')).toBe('4HHB');
      expect(normalizePdbId('  1stp  ')).toBe('1STP');
      expect(normalizePdbId('3htb')).toBe('3HTB');
      expect(normalizePdbId('7DFG')).toBe('7DFG');
    });

    it('rejects invalid PDB IDs with InvalidStructureIdError', () => {
      expect(() => normalizePdbId('')).toThrow(InvalidStructureIdError);
      expect(() => normalizePdbId('4H')).toThrow(InvalidStructureIdError);
      expect(() => normalizePdbId('4HHB12')).toThrow(InvalidStructureIdError);
      expect(() => normalizePdbId('../../etc/passwd')).toThrow(InvalidStructureIdError);
      expect(() => normalizePdbId('4H-B')).toThrow(InvalidStructureIdError);
      expect(() => normalizePdbId('4H B')).toThrow(InvalidStructureIdError);
    });
  });

  describe('2. RCSB Structure Resolution & Provenance', () => {
    it('generates secure BinaryCIF primary URL and mmCIF fallback URL', () => {
      const { candidate, fallbackCandidate, provenance } = resolveRcsbStructure('4hhb', 'bcif');

      expect(candidate.modelId).toBe('4HHB');
      expect(candidate.source).toBe('rcsb');
      expect(candidate.provider).toBe('RCSB PDB');
      expect(candidate.format).toBe('bcif');
      expect(candidate.url).toBe('https://models.rcsb.org/4HHB.bcif');
      expect(candidate.experimental).toBe(true);

      expect(fallbackCandidate.url).toBe('https://files.rcsb.org/download/4HHB.cif');
      expect(fallbackCandidate.format).toBe('mmcif');
      expect(fallbackCandidate.experimental).toBe(true);

      expect(provenance.source).toBe('rcsb');
      expect(provenance.provider).toBe('RCSB PDB');
      expect(provenance.modelId).toBe('4HHB');
      expect(provenance.experimental).toBe(true);
    });
  });

  describe('3. AlphaFold DB Resolution & Provenance', () => {
    it('normalizes UniProt accession and constructs model URL', () => {
      const { candidate, provenance } = resolveAlphaFoldStructure('p69905');

      expect(candidate.source).toBe('alphafold');
      expect(candidate.provider).toBe('AlphaFold DB');
      expect(candidate.modelId).toBe('AF-P69905-F1');
      expect(candidate.url).toBe('https://alphafold.ebi.ac.uk/files/AF-P69905-F1-model_v6.cif');
      expect(candidate.experimental).toBe(false);

      expect(provenance.experimental).toBe(false);
      expect(provenance.provider).toBe('AlphaFold DB');
    });

    it('rejects invalid UniProt accessions', () => {
      expect(() => normalizeUniProtId('')).toThrow(InvalidStructureIdError);
      expect(() => normalizeUniProtId('P6')).toThrow(InvalidStructureIdError);
      expect(() => normalizeUniProtId('P69905123456')).toThrow(InvalidStructureIdError);
      expect(() => normalizeUniProtId('P6-905')).toThrow(InvalidStructureIdError);
    });
  });

  describe('4. Structure Candidate Ranking', () => {
    it('prioritizes local over explicit PDB over experimental RCSB over AlphaFold predicted', () => {
      const candidates: StructureCandidate[] = [
        {
          id: 'af_1',
          source: 'alphafold',
          provider: 'AlphaFold DB',
          modelId: 'AF-P69905-F1',
          format: 'mmcif',
          url: 'http://af',
          experimental: false,
        },
        {
          id: 'rcsb_1',
          source: 'rcsb',
          provider: 'RCSB PDB',
          modelId: '4HHB',
          format: 'bcif',
          url: 'http://rcsb',
          experimental: true,
        },
        {
          id: 'local_1',
          source: 'local',
          provider: 'Local File',
          modelId: 'custom.cif',
          format: 'mmcif',
          url: 'local://custom.cif',
          experimental: true,
        },
      ];

      const ranked = rankStructureCandidates(candidates);
      expect(ranked[0].id).toBe('local_1');
      expect(ranked[1].id).toBe('rcsb_1');
      expect(ranked[2].id).toBe('af_1');
    });
  });

  describe('5. Real Coordinate Bounds (AABB) Engine', () => {
    it('derives exact bounding box strictly from atom coordinates array', () => {
      const atoms: [number, number, number][] = [
        [10.0, 20.0, 30.0],
        [15.5, 25.0, 35.5],
        [8.0, 18.0, 28.0],
        [12.0, 22.0, 32.0],
      ];

      const aabb = computeAtomCoordinatesAABB(atoms);

      expect(aabb.min).toEqual([8.0, 18.0, 28.0]);
      expect(aabb.max).toEqual([15.5, 25.0, 35.5]);
      expect(aabb.size).toEqual([7.5, 7.0, 7.5]);
      expect(aabb.center).toEqual([11.75, 21.5, 31.75]);
      expect(aabb.radius).toBeGreaterThan(0);
    });

    it('returns zero-volume box for empty coordinate array', () => {
      const aabb = computeAtomCoordinatesAABB([]);
      expect(aabb.min).toEqual([0, 0, 0]);
      expect(aabb.max).toEqual([0, 0, 0]);
      expect(aabb.size).toEqual([0, 0, 0]);
      expect(aabb.radius).toBe(0);
    });
  });

  describe('6. Euclidean Distance Measurement Engine', () => {
    it('calculates spatial Euclidean distance in Ångström', () => {
      const coordA: [number, number, number] = [0.0, 0.0, 0.0];
      const coordB: [number, number, number] = [3.0, 4.0, 0.0];

      const dist = calculateEuclideanDistance(coordA, coordB);
      expect(dist).toBeCloseTo(5.0, 4);

      const m = computeMeasurement(coordA, coordB);
      expect(m.distanceAngstrom).toBeCloseTo(5.0, 4);
      expect(m.label).toBe('5.00 Å');
    });

    it('handles 3D spatial separation accurately', () => {
      const p1: [number, number, number] = [14.2, 28.5, 12.1];
      const p2: [number, number, number] = [16.5, 30.2, 14.3];

      const expected = Math.sqrt((16.5 - 14.2) ** 2 + (30.2 - 28.5) ** 2 + (14.3 - 12.1) ** 2);
      const measured = calculateEuclideanDistance(p1, p2);
      expect(measured).toBeCloseTo(expected, 4);
    });
  });

  describe('7. Central Structure Resolver & Session Cache', () => {
    it('fetches remote structure and caches resolved candidate', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4]).buffer;

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => mockData,
      } as Response);

      const res1 = await resolveStructure({ pdbId: '4HHB' });
      expect(res1.candidate.modelId).toBe('4HHB');
      expect(res1.provenance.experimental).toBe(true);

      // Second call uses session cache (no second fetch)
      const res2 = await resolveStructure({ pdbId: '4HHB' });
      expect(res2.candidate.modelId).toBe('4HHB');
    });

    it('throws StructureNotFoundError on HTTP 404', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(resolveStructure({ pdbId: '9999' })).rejects.toThrow(StructureNotFoundError);
    }, 15000);

    it('aborts cleanly when AbortSignal is cancelled', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        resolveStructure({ pdbId: '4HHB', signal: controller.signal })
      ).rejects.toThrow(/aborted/);
    });

    it('handles local file buffers directly', async () => {
      const buffer = new ArrayBuffer(16);
      const res = await resolveStructure({
        localFile: buffer,
        localFileName: 'synth_500f.bcif',
      });

      expect(res.candidate.source).toBe('local');
      expect(res.candidate.format).toBe('bcif');
      expect(res.provenance.provider).toBe('Local User File');
      expect(res.isBinary).toBe(true);
    });
  });

  describe('8. Structure Coordinate Extraction from Mol* Structure Model', () => {
    it('handles null/undefined structure model gracefully with safe defaults', () => {
      const bounds = extractCoordinatesFromMolstarStructure(null);
      expect(bounds.proteinAtomsCount).toBe(0);
      expect(bounds.ligandAtomsCount).toBe(0);
      expect(bounds.proteinAABB.radius).toBe(0);
    });
  });
});
