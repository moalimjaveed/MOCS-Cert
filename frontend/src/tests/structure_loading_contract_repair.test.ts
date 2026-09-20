// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { DefaultPluginSpec } from 'molstar/lib/mol-plugin/spec';
import {
  validateStructureDescriptor,
  normalizeStructureSource,
  InvalidStructureDescriptorError,
} from '../molecular/resolver/structureDescriptor';
import {
  resolveStructure,
  clearStructureCache,
  StructureNotFoundError,
} from '../molecular/resolver/resolveStructure';
import { useViewerStore } from '../store/useViewerStore';
import { STRUCTURE_REGISTRY, getStructureMetadata } from '../molecular/data/structureRegistry';

describe('PASS 48 — Structure Loading Contract & Forensic Repair Suite', () => {
  beforeEach(() => {
    clearStructureCache();
  });

  describe('1. Structure Descriptor Zod Validation & Source Normalization', () => {
    it('normalizes provider strings into canonical StructureSource enum values', () => {
      expect(normalizeStructureSource('RCSB PDB')).toBe('rcsb');
      expect(normalizeStructureSource('AlphaFold DB')).toBe('alphafold');
      expect(normalizeStructureSource('ModelArchive')).toBe('model_archive');
      expect(normalizeStructureSource('RFdiffusion / IPD')).toBe('rfdiffusion');
      expect(normalizeStructureSource('ProteinMPNN')).toBe('proteinmpnn');
      expect(normalizeStructureSource('Boltz-1')).toBe('boltz');
      expect(normalizeStructureSource('GROMACS / XTC')).toBe('trajectory');
      expect(normalizeStructureSource('ESMFold')).toBe('esmfold');
      expect(normalizeStructureSource('3D-Beacons')).toBe('three_beacons');
      expect(normalizeStructureSource(undefined)).toBe('local');
    });

    it('validates canonical structure descriptors successfully', () => {
      const d1 = validateStructureDescriptor({ pdbId: '4HHB', source: 'rcsb pdb' as any });
      expect(d1.pdbId).toBe('4HHB');
      expect(d1.source).toBe('rcsb');

      const d2 = validateStructureDescriptor({
        pdbId: 'custom_upload',
        customData: 'ATOM      1  N   ALA A   1      11.104  13.201  10.000  1.00 20.00           N',
      });
      expect(d2.pdbId).toBe('custom_upload');
      expect(typeof d2.customData).toBe('string');

      const d3 = validateStructureDescriptor({
        sequence: 'MKVEELAKKIEEELAKKLAEEVAKKG',
        sequenceName: 'TestFold',
      });
      expect(d3.sequence).toBe('MKVEELAKKIEEELAKKLAEEVAKKG');
      expect(d3.sequenceName).toBe('TestFold');
    });

    it('rejects invalid or empty descriptors with typed InvalidStructureDescriptorError', () => {
      expect(() => validateStructureDescriptor(null)).toThrow(InvalidStructureDescriptorError);
      expect(() => validateStructureDescriptor({})).toThrow(InvalidStructureDescriptorError);
      expect(() => validateStructureDescriptor({ preferredFormat: 'pdb' })).toThrow(
        InvalidStructureDescriptorError
      );
    });
  });

  describe('2. Direct In-Memory Custom Data Resolution (No Network / No Regex Failure)', () => {
    it('resolves in-memory text customData directly without external HTTP query', async () => {
      const samplePdb = 'ATOM      1  CA  MET A   1       0.000   0.000   0.000  1.00 50.00           C\nEND';
      const resolved = await resolveStructure({
        pdbId: 'local_custom_peptide.pdb',
        source: 'local',
        customData: samplePdb,
      });

      expect(resolved).toBeDefined();
      expect(resolved.candidate.id).toBe('custom_local_custom_peptide.pdb');
      expect(resolved.candidate.format).toBe('pdb');
      expect(resolved.candidate.url).toBe('memory://local_custom_peptide.pdb');
      expect(resolved.data).toBe(samplePdb);
      expect(resolved.isBinary).toBe(false);
    });

    it('resolves in-memory binary ArrayBuffer customData directly', async () => {
      const buffer = new Uint8Array([0, 1, 2, 3, 4]).buffer;
      const resolved = await resolveStructure({
        pdbId: 'local_binary.bcif',
        source: 'local',
        preferredFormat: 'bcif',
        customData: buffer,
      });

      expect(resolved).toBeDefined();
      expect(resolved.candidate.format).toBe('bcif');
      expect(resolved.isBinary).toBe(true);
      expect(resolved.data).toBe(buffer);
    });
  });

  describe('3. ModelArchive & De Novo Design Candidate Routing Invariants', () => {
    it('routes MA-CP-001 correctly to ModelArchive instead of failing 4-char PDB regex', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn(async (url: any) => {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => 'data_ma_cp_001\n# mmCIF model archive dummy content',
        } as any;
      });

      try {
        const resolved = await resolveStructure({
          pdbId: 'MA-CP-001',
          source: 'model_archive',
        });
        expect(resolved).toBeDefined();
        expect(resolved.candidate.source).toBe('model_archive');
        expect(resolved.candidate.url).toContain('modelarchive.org/api/projects/ma-cp-001');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('resolves RFD-BINDER-01 de novo candidate with genuine synthetic PDB backbone', async () => {
      const resolved = await resolveStructure({ pdbId: 'RFD-BINDER-01' });
      expect(resolved).toBeDefined();
      expect(resolved.candidate.source).toBe('rfdiffusion');
      expect(typeof resolved.data).toBe('string');
      expect(resolved.data).toContain('ATOM');
      expect(resolved.data).toContain('MET');
    });

    it('resolves ProteinMPNN and Boltz-1 de novo design candidates', async () => {
      const pmpnn = await resolveStructure({ pdbId: 'PMPNN-DES-42' });
      expect(pmpnn.candidate.source).toBe('proteinmpnn');
      expect(typeof pmpnn.data).toBe('string');

      const boltz = await resolveStructure({ pdbId: 'BOLTZ-COMP-01' });
      expect(boltz.candidate.source).toBe('boltz');
      expect(typeof boltz.data).toBe('string');
    });
  });

  describe('4. useViewerStore State Protection & recentStructures Invariants', () => {
    it('guarantees recentStructures contains zero undefined items when selecting structures', () => {
      const store = useViewerStore.getState();
      
      // Select known structure
      store.selectStructure('4HHB');
      let recents = useViewerStore.getState().recentStructures;
      expect(recents.every((s) => s && s.id && s.name)).toBe(true);

      // Select an unmapped custom structure
      store.selectStructure('custom_unknown_123');
      recents = useViewerStore.getState().recentStructures;
      expect(recents.every((s) => s && s.id && s.name)).toBe(true);
      expect(recents.some((s) => s.id === 'custom_unknown_123')).toBe(true);
      expect(recents.find((s) => s.id === 'custom_unknown_123')?.name).toBeDefined();
    });
  });

  describe('5. Mol* Representation Builder Safety (Zero undefined.name Crashes)', () => {
    it('safely builds representation when given valid and edge-case parameters', async () => {
      const plugin = new PluginContext(DefaultPluginSpec());
      await plugin.init();

      const bcifPath = path.resolve(__dirname, '../../public/structures/4HHB.bcif');
      const bcifBuf = fs.readFileSync(bcifPath);

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () =>
        ({
          ok: true,
          status: 200,
          statusText: 'OK',
          arrayBuffer: async () => bcifBuf.buffer.slice(bcifBuf.byteOffset, bcifBuf.byteOffset + bcifBuf.byteLength),
          text: async () => '',
        } as any);

      try {
        const resolved = await resolveStructure({ pdbId: '4HHB' });
        const rawPayload = new Uint8Array(resolved.data as ArrayBuffer);

        const data = await plugin.builders.data.rawData({
          data: rawPayload,
          label: resolved.candidate.modelId,
        });

        const trajectory = await plugin.builders.structure.parseTrajectory(data, 'mmcif');
        const model = await plugin.builders.structure.createModel(trajectory);
        const structure = await plugin.builders.structure.createStructure(model);

        // Verify defensive representation creation helper — matches MolstarViewer.tsx pattern
        const safeAddRepr = async (
          comp: any,
          reprProps: { type: string; color?: string; typeParams?: any }
        ) => {
          if (!comp) return;
          const reprReg = plugin.representation.structure.registry;
          const colorReg = plugin.representation.structure.themes.colorThemeRegistry;
          const isTypeSupported = Boolean(
            reprProps.type &&
            reprReg.types.some((entry: any) => entry[0] === reprProps.type)
          );
          // CRITICAL: use registry.get() — do NOT use registry.default.name
          let usedType = reprProps.type;
          if (!isTypeSupported) {
            const cartoonEntry = reprReg.get?.('cartoon' as any);
            usedType = cartoonEntry ? 'cartoon' : (reprReg.types?.[0]?.[0] ?? 'cartoon');
          }
          const isColorSupported = Boolean(
            reprProps.color &&
            colorReg.types.some((entry: any) => entry[0] === reprProps.color)
          );
          const safeColor = isColorSupported
            ? reprProps.color
            : (reprReg.get?.(usedType as any)?.defaultColorTheme?.name ?? 'element-symbol');

          await plugin.builders.structure.representation.addRepresentation(comp, {
            type: usedType as any,
            color: safeColor as any,
            typeParams: reprProps.typeParams,
          });
        };

        const proteinComp = await plugin.builders.structure.tryCreateComponentStatic(
          structure,
          'protein'
        );
        expect(proteinComp).toBeDefined();

        // Standard biopolymer representation
        await safeAddRepr(proteinComp, { type: 'cartoon', color: 'chain-id' });

        // Non-existent color theme: MUST NOT throw 'Cannot read properties of undefined (reading name)'
        await safeAddRepr(proteinComp, { type: 'cartoon', color: 'non_existent_color_theme' as any });

        // Non-existent representation type: MUST NOT throw
        await safeAddRepr(proteinComp, { type: 'non_existent_type' as any, color: 'chain-id' });
      } finally {
        globalThis.fetch = originalFetch;
        plugin.dispose();
      }
    });
  });

  describe('6. Mol* v5.11 Registry Runtime Contract Verification', () => {
    it('documents the actual runtime shape of plugin.representation.structure.registry', async () => {
      const plugin = new PluginContext(DefaultPluginSpec());
      await plugin.init();
      try {
        const reg = plugin.representation.structure.registry;
        const colorReg = plugin.representation.structure.themes.colorThemeRegistry;

        // ─── Shape assertions ─────────────────────────────────────────────────
        // registry must be a non-null object
        expect(reg).toBeDefined();
        expect(typeof reg).toBe('object');

        // registry.types must be iterable as array-like (of 2-tuple entries)
        expect(Array.isArray(reg.types)).toBe(true);
        expect(reg.types.length).toBeGreaterThan(0);
        // Each entry is [string, provider]
        const firstEntry = reg.types[0];
        expect(typeof firstEntry[0]).toBe('string');

        // 'cartoon' MUST be a registered type (it is the required fallback)
        const hasCartoon = reg.types.some((e: any) => e[0] === 'cartoon');
        expect(hasCartoon).toBe(true);

        // registry.get() is the canonical type lookup
        expect(typeof reg.get).toBe('function');
        const cartoonProvider = reg.get('cartoon' as any);
        expect(cartoonProvider).toBeDefined();
        // Provider has a name property
        expect(typeof cartoonProvider.name).toBe('string');
        expect(cartoonProvider.name).toBe('cartoon');

        // ─── CRITICAL: registry.default.name is NOT guaranteed ───────────────
        // Do not rely on this. Document what it actually is at runtime.
        const hasDefault = 'default' in reg;
        console.info(`[REGISTRY CONTRACT] registry.default exists: ${hasDefault}, value: ${JSON.stringify(reg.default)}`);
        // We do NOT assert registry.default.name === anything — it is not the canonical API.
        // The application code uses registry.get('cartoon') instead.

        // ─── Color theme registry ─────────────────────────────────────────────
        expect(colorReg).toBeDefined();
        expect(Array.isArray(colorReg.types)).toBe(true);
        expect(colorReg.types.length).toBeGreaterThan(0);
        const hasChainId = colorReg.types.some((e: any) => e[0] === 'chain-id');
        const hasElementSymbol = colorReg.types.some((e: any) => e[0] === 'element-symbol');
        expect(hasChainId).toBe(true);
        expect(hasElementSymbol).toBe(true);

        // ─── defaultColorTheme via registry.get() ────────────────────────────
        const cartoon = reg.get('cartoon' as any);
        const defaultColorThemeName = cartoon?.defaultColorTheme?.name;
        console.info(`[REGISTRY CONTRACT] cartoon.defaultColorTheme.name: ${defaultColorThemeName}`);
        // Must be a string — our fallback '?? element-symbol' may or may not be needed
        expect(typeof defaultColorThemeName === 'string' || defaultColorThemeName === undefined).toBe(true);

        // ─── Record all registered representation types (forensic evidence) ──
        const typeNames = reg.types.map((e: any) => e[0]);
        console.info(`[REGISTRY CONTRACT] Mol* v5.11 registered repr types: ${typeNames.join(', ')}`);
        expect(typeNames).toContain('cartoon');
        expect(typeNames).toContain('ball-and-stick');
      } finally {
        plugin.dispose();
      }
    });
  });
});

