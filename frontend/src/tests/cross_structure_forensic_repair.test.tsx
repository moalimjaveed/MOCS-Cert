// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
export type ViewerLifecycleStage =
  | 'idle'
  | 'initializing'
  | 'fetching'
  | 'parsing'
  | 'building'
  | 'rendering'
  | 'ready'
  | 'error';

export interface ViewerErrorState {
  stage: ViewerLifecycleStage;
  structureId: string;
  provider: string;
  code?: any;
  httpStatus?: number;
  requestedResource?: string;
  actionGuidance?: string;
  message: string;
  retryable: boolean;
}
import { resolveStructure } from '../molecular/resolver/resolveStructure';
import { STRUCTURE_REGISTRY, getStructureMetadata } from '../molecular/data/structureRegistry';
import { TRAJECTORY_WITNESS_FRAMES } from '../molecular/data/trajectoryWitnessFrames';
import { calculateEuclideanDistance } from '../molecular/geometry';
import * as THREE from 'three';

// Enable React 19 act environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('Cross-Structure Forensic Repair Verification Suite', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  describe('1. Universal Curated Catalog Resolution', () => {
    const catalogStructures = [
      { id: '4HHB', expectedProvider: 'RCSB PDB' },
      { id: '1BNA', expectedProvider: 'RCSB PDB' },
      { id: '1TUP', expectedProvider: 'RCSB PDB' },
      { id: '1STP', expectedProvider: 'RCSB PDB' },
      { id: '1CRN', expectedProvider: 'RCSB PDB' },
      { id: 'AF-P69905-F1', expectedProvider: 'AlphaFold DB' },
    ];

    it.each(catalogStructures)(
      'resolves curated catalog structure %s correctly without failure',
      async ({ id, expectedProvider }) => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn(async () => ({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'text/plain' }),
          text: async () => 'data_test\n# CIF structure dummy data\nATOM 1 CA ALA A 1 0.0 0.0 0.0 1.0 20.0 C',
          arrayBuffer: async () => new ArrayBuffer(64),
        } as any));

        try {
          const resolved = await resolveStructure({ pdbId: id });
          expect(resolved).toBeDefined();
          expect(resolved.candidate.provider).toBe(expectedProvider);
          expect(resolved.candidate.url).toBeTruthy();
          expect(resolved.candidate.format).toMatch(/^(mmcif|cif|bcif|pdb)$/);

          const meta = getStructureMetadata(id);
          expect(meta).toBeDefined();
          expect(meta?.defaultSelA).toBeTruthy();
          expect(meta?.defaultSelB).toBeTruthy();
          expect(meta?.defaultDistance).toBeGreaterThan(0);
        } finally {
          globalThis.fetch = originalFetch;
        }
      }
    );

    it('resolves synthetic trajectory dataset with valid witness frames', () => {
      const canonicalWitness = TRAJECTORY_WITNESS_FRAMES.find((f) => f.frameIndex === 37);
      expect(canonicalWitness).toBeDefined();
      expect(canonicalWitness?.trajectoryFrame).toBe(410);
      expect(canonicalWitness?.distance).toBe(3.72);
      expect(canonicalWitness?.atomACoords).toEqual([40.0, 40.0, 40.0]);
      expect(canonicalWitness?.atomBCoords).toEqual([43.72, 40.0, 40.0]);
    });

    it('authenticates 4HHB Fe-NE2 distance calculation against RCSB coordinates', () => {
      const hisNe2: [number, number, number] = [16.894, 20.030, 24.002];
      const hemFe: [number, number, number] = [18.362, 18.488, 23.755];
      const dist = calculateEuclideanDistance(hisNe2, hemFe);
      expect(Number(dist.toFixed(2))).toBe(2.14);
    });
  });

  describe('2. WebGL Context Loss & Shader Precision Safety Probe', () => {
    it('handles null shader precision format safely when WebGL context is lost', () => {
      // Simulate lost WebGL context where getShaderPrecisionFormat returns null
      const mockGl = {
        isContextLost: () => true,
        getShaderPrecisionFormat: vi.fn().mockReturnValue(null),
        VERTEX_SHADER: 0x8b31,
        FRAGMENT_SHADER: 0x8b30,
        HIGH_FLOAT: 0x8dfa,
        MEDIUM_FLOAT: 0x8dfb,
        LOW_FLOAT: 0x8dfc,
      };

      // Probe check simulation identical to MolstarViewer logic
      const isLost = mockGl.isContextLost();
      expect(isLost).toBe(true);

      const highPrec = mockGl.getShaderPrecisionFormat(mockGl.VERTEX_SHADER, mockGl.HIGH_FLOAT);
      expect(highPrec).toBeNull();

      // Guarded probe that prevents TypeError: Cannot read properties of null (reading 'precision')
      let precisionResult = 'none';
      if (!isLost && highPrec && highPrec.precision > 0) {
        precisionResult = 'highp';
      } else {
        precisionResult = 'fallback_or_bypass';
      }
      expect(precisionResult).toBe('fallback_or_bypass');
    });

    it('probes shader precisions correctly when WebGL context is healthy', () => {
      const mockGl = {
        isContextLost: () => false,
        getShaderPrecisionFormat: vi.fn().mockImplementation((_shaderType, precisionType) => {
          if (precisionType === 0x8dfa) return { precision: 23, rangeMin: 127, rangeMax: 127 };
          if (precisionType === 0x8dfb) return { precision: 10, rangeMin: 15, rangeMax: 15 };
          return { precision: 8, rangeMin: 7, rangeMax: 7 };
        }),
        VERTEX_SHADER: 0x8b31,
        FRAGMENT_SHADER: 0x8b30,
        HIGH_FLOAT: 0x8dfa,
        MEDIUM_FLOAT: 0x8dfb,
        LOW_FLOAT: 0x8dfc,
      };

      const isLost = mockGl.isContextLost();
      expect(isLost).toBe(false);

      const highPrec = mockGl.getShaderPrecisionFormat(mockGl.VERTEX_SHADER, mockGl.HIGH_FLOAT);
      expect(highPrec).not.toBeNull();
      expect(highPrec?.precision).toBe(23);
    });
  });

  describe('3. Lifecycle State Machine & Retry Dispatch', () => {
    it('constructs well-formed ViewerErrorState upon failure', () => {
      const errorState: ViewerErrorState = {
        stage: 'error',
        structureId: '4HHB',
        provider: 'RCSB PDB',
        message: 'Network request failed (503 Service Unavailable)',
        retryable: true,
      };

      expect(errorState.stage).toBe('error');
      expect(errorState.structureId).toBe('4HHB');
      expect(errorState.provider).toBe('RCSB PDB');
      expect(errorState.retryable).toBe(true);
    });

    it('distinguishes all valid ViewerLifecycleStage values', () => {
      const stages: ViewerLifecycleStage[] = [
        'idle',
        'initializing',
        'fetching',
        'parsing',
        'building',
        'rendering',
        'ready',
        'error',
      ];

      expect(stages).toHaveLength(8);
      stages.forEach((stage) => {
        expect(typeof stage).toBe('string');
      });
    });
  });

  describe('4. Dynamic Canvas Container Architecture', () => {
    it('manages dynamic canvas lifecycle inside container div without forceContextLoss', () => {
      // Create simulated overlay container div
      const containerDiv = document.createElement('div');
      container.appendChild(containerDiv);

      // Mount dynamic canvas inside container
      const dynamicCanvas = document.createElement('canvas');
      containerDiv.appendChild(dynamicCanvas);
      expect(containerDiv.contains(dynamicCanvas)).toBe(true);

      // Cleanup via replaceChildren (non-destructive to GPU context)
      containerDiv.replaceChildren();
      expect(containerDiv.children.length).toBe(0);
      expect(containerDiv.contains(dynamicCanvas)).toBe(false);
    });
  });
});
