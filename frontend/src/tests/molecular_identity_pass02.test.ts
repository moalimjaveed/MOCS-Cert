import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  classifyResidue,
  parseCanonicalSelection,
} from '../molecular/geometry/structuralIdentity';
import {
  buildStructureHierarchyIndex,
  resolveMolecularComponent,
  resolveAllMatchingComponents,
} from '../molecular/geometry/componentPipeline';
import {
  createStaticStructureAABB,
  createCurrentFrameAABB,
  extractCoordinatesFromMolstarStructure,
  extractCoordinatesFrom3DmolModel,
} from '../molecular/geometry/structureBounds';
import { resolveRcsbStructure } from '../molecular/resolver/resolveRcsbStructure';
import { useViewerStore } from '../store/useViewerStore';

describe('PASS 02: Molecular Data Ingestion & Structural Identity Repair', () => {
  beforeEach(() => {
    useViewerStore.setState({
      activeStructureId: '4HHB',
      activeStructureInput: null,
      activeAssemblyId: null,
      boxExtents: [80, 80, 80],
    });
  });

  // Requirement A: Strict Chain Scoping & Non-Contamination (4HHB Chain A HEM 142 vs Chain C HEM 142)
  describe('A: Strict Chain Scoping & Zero Contamination', () => {
    const mockMultiChainStructure = {
      units: [
        {
          elements: [0, 1],
          polymerElements: [0],
          conformation: {
            x: (i: number) => (i === 0 ? 16.894 : 18.362),
            y: (i: number) => (i === 0 ? 20.030 : 18.488),
            z: (i: number) => (i === 0 ? 24.002 : 23.755),
          },
          model: {
            atomicHierarchy: {
              atoms: {
                label_atom_id: { value: (i: number) => (i === 0 ? 'NE2' : 'FE') },
                label_comp_id: { value: (i: number) => (i === 0 ? 'HIS' : 'HEM') },
              },
              residueAtomSegments: { index: [0, 1] },
              chainAtomSegments: { index: [0, 0] },
              chains: { auth_asym_id: { value: () => 'A' } },
              residues: {
                auth_seq_id: { value: (r: number) => (r === 0 ? 87 : 142) },
                pdbx_PDB_ins_code: { value: () => '' },
              },
            },
          },
        },
        {
          elements: [0, 1],
          polymerElements: [0],
          conformation: {
            x: (i: number) => (i === 0 ? 4.251 : 4.445),
            y: (i: number) => (i === 0 ? 24.237 : 23.463),
            z: (i: number) => (i === 0 ? 57.868 : 54.548),
          },
          model: {
            atomicHierarchy: {
              atoms: {
                label_atom_id: { value: (i: number) => (i === 0 ? 'NE2' : 'FE') },
                label_comp_id: { value: (i: number) => (i === 0 ? 'HIS' : 'HEM') },
              },
              residueAtomSegments: { index: [0, 1] },
              chainAtomSegments: { index: [0, 0] },
              chains: { auth_asym_id: { value: () => 'C' } },
              residues: {
                auth_seq_id: { value: (r: number) => (r === 0 ? 87 : 142) },
                pdbx_PDB_ins_code: { value: () => '' },
              },
            },
          },
        },
      ],
    };

    it('resolves Chain A HEM 142 and Chain C HEM 142 as completely independent entities', () => {
      const index = buildStructureHierarchyIndex(mockMultiChainStructure, '4HHB');
      const allHem = resolveAllMatchingComponents(index, 'HEM:142');
      expect(allHem.length).toBe(2);

      const hemA = resolveMolecularComponent(index, 'A:142:FE');
      const hemC = resolveMolecularComponent(index, 'C:142:FE');

      expect(hemA).toBeDefined();
      expect(hemC).toBeDefined();
      expect(hemA?.id.chainId).toBe('A');
      expect(hemC?.id.chainId).toBe('C');

      // Coordinates must never bleed across chains
      expect(hemA?.bounds.raw.center[0]).toBeCloseTo(18.362, 3);
      expect(hemC?.bounds.raw.center[0]).toBeCloseTo(4.445, 3);
      expect(hemA?.bounds.render.box3.intersectsBox(hemC!.bounds.render.box3)).toBe(false);
    });

    it('contextual chain scoping automatically selects the matching chain ligand', () => {
      const boundsA = extractCoordinatesFromMolstarStructure(
        mockMultiChainStructure,
        'A:87:NE2',
        'HEM:142:FE'
      );
      expect(boundsA.atomACoords).toEqual([16.894, 20.030, 24.002]);
      expect(boundsA.atomBCoords).toEqual([18.362, 18.488, 23.755]);
      expect(boundsA.ligandComponent?.id.chainId).toBe('A');

      const boundsC = extractCoordinatesFromMolstarStructure(
        mockMultiChainStructure,
        'C:87:NE2',
        'HEM:142:FE'
      );
      expect(boundsC.atomACoords).toEqual([4.251, 24.237, 57.868]);
      expect(boundsC.atomBCoords).toEqual([4.445, 23.463, 54.548]);
      expect(boundsC.ligandComponent?.id.chainId).toBe('C');
    });
  });

  // Requirement B: Biological Assembly Awareness & Cache Key Differentiation
  describe('B: Biological Assembly Resolution & Cache Differentiation', () => {
    it('generates distinct cache keys for asymmetric unit vs biological assembly', async () => {
      const rcsb1 = resolveRcsbStructure('4HHB', 'bcif');
      const rcsbAsm = resolveRcsbStructure('4HHB', 'bcif', '1');

      expect(rcsb1.candidate.id).not.toBe(rcsbAsm.candidate.id);
      expect(rcsbAsm.candidate.id).toContain('asm1');
      expect(rcsbAsm.candidate.url).toContain('assembly_id=1');
    });

    it('tracks activeAssemblyId in the viewer store', () => {
      useViewerStore.getState().selectStructure('4HHB', { pdbId: '4HHB', assemblyId: '1' });
      expect(useViewerStore.getState().activeAssemblyId).toBe('1');

      useViewerStore.getState().setActiveAssemblyId('2');
      expect(useViewerStore.getState().activeAssemblyId).toBe('2');

      useViewerStore.getState().setActiveAssemblyId(null);
      expect(useViewerStore.getState().activeAssemblyId).toBeNull();
    });
  });

  // Requirement C: Nucleic Acid Classification & Non-Protein Separation
  describe('C & E: Nucleic Acid Classification & Modified Nucleotides', () => {
    it('correctly classifies canonical DNA and RNA residues as nucleic', () => {
      expect(classifyResidue('DA')).toBe('nucleic');
      expect(classifyResidue('DT')).toBe('nucleic');
      expect(classifyResidue('DG')).toBe('nucleic');
      expect(classifyResidue('DC')).toBe('nucleic');
      expect(classifyResidue('A')).toBe('nucleic');
      expect(classifyResidue('U')).toBe('nucleic');
      expect(classifyResidue('G')).toBe('nucleic');
      expect(classifyResidue('C')).toBe('nucleic');
    });

    it('correctly classifies modified nucleic bases (pseudouridine, inosine, methylcytidine) as nucleic', () => {
      expect(classifyResidue('5MC')).toBe('nucleic');
      expect(classifyResidue('OMC')).toBe('nucleic');
      expect(classifyResidue('PSU')).toBe('nucleic');
      expect(classifyResidue('H2U')).toBe('nucleic');
      expect(classifyResidue('1MA')).toBe('nucleic');
      expect(classifyResidue('2MG')).toBe('nucleic');
      expect(classifyResidue('7MG')).toBe('nucleic');
      expect(classifyResidue('I', true)).toBe('nucleic');
      expect(classifyResidue('I', false)).toBe('ion');
      expect(classifyResidue('DI')).toBe('nucleic');
    });

    it('never blindly classifies unknown polymer units as protein', () => {
      // Residues not in the 20 canonical amino acids, common non-standard, or nucleic sets
      expect(classifyResidue('XYZ', false)).toBe('ligand');
      expect(classifyResidue('NAG', true)).toBe('ligand'); // Glycan
    });
  });

  // Requirement D: Extended PDBx / mmCIF IDs
  describe('D: Extended PDBx Identifiers', () => {
    it('resolves modern extended PDB identifiers up to 32 characters', () => {
      const res = resolveRcsbStructure('PDB_00001ABC');
      expect(res.candidate.url).toContain('1ABC');
      expect(res.candidate.id).toContain('1ABC');
    });

    it('resolves standard 4-character PDB identifiers', () => {
      const res = resolveRcsbStructure('1bna');
      expect(res.candidate.url).toContain('1BNA');
    });
  });

  // Requirement F: Crystallization Buffers vs Structural Metal Ions
  describe('F: Buffer Components vs Structural Metal Ions', () => {
    it('classifies crystallization buffers and precipitants as buffer, not ion or ligand', () => {
      expect(classifyResidue('PO4')).toBe('buffer');
      expect(classifyResidue('SO4')).toBe('buffer');
      expect(classifyResidue('CIT')).toBe('buffer');
      expect(classifyResidue('ACT')).toBe('buffer');
      expect(classifyResidue('EDO')).toBe('buffer');
      expect(classifyResidue('PEG')).toBe('buffer');
      expect(classifyResidue('TRS')).toBe('buffer');
      expect(classifyResidue('DTT')).toBe('buffer');
    });

    it('classifies structural metal cations as ion', () => {
      expect(classifyResidue('ZN')).toBe('ion');
      expect(classifyResidue('MG')).toBe('ion');
      expect(classifyResidue('CA')).toBe('ion');
      expect(classifyResidue('FE')).toBe('ion');
      expect(classifyResidue('MN')).toBe('ion');
      expect(classifyResidue('CU')).toBe('ion');
    });
  });

  // Requirement G: Insertion Codes Parsing & Resolution
  describe('G: Insertion Code Support', () => {
    it('correctly parses insertion codes from selection strings', () => {
      const token1 = parseCanonicalSelection('A:87A:NE2');
      expect(token1.chainId).toBe('A');
      expect(token1.residueNumber).toBe(87);
      expect(token1.insertionCode).toBe('A');
      expect(token1.atomName).toBe('NE2');

      const token2 = parseCanonicalSelection('B:142B:CA');
      expect(token2.residueNumber).toBe(142);
      expect(token2.insertionCode).toBe('B');

      const tokenPlain = parseCanonicalSelection('A:87:NE2');
      expect(tokenPlain.residueNumber).toBe(87);
      expect(tokenPlain.insertionCode).toBeUndefined();
    });

    it('differentiates residue 87 from residue 87A in component matching', () => {
      const mockInsStructure = {
        units: [
          {
            elements: [0, 1],
            conformation: {
              x: (i: number) => (i === 0 ? 10.0 : 20.0),
              y: (i: number) => 10.0,
              z: (i: number) => 10.0,
            },
            model: {
              atomicHierarchy: {
                atoms: {
                  label_atom_id: { value: () => 'CA' },
                  label_comp_id: { value: () => 'ALA' },
                },
                residueAtomSegments: { index: [0, 1] },
                chainAtomSegments: { index: [0, 0] },
                chains: { auth_asym_id: { value: () => 'A' } },
                residues: {
                  auth_seq_id: { value: () => 87 },
                  pdbx_PDB_ins_code: { value: (r: number) => (r === 0 ? '' : 'A') },
                },
              },
            },
          },
        ],
      };

      const index = buildStructureHierarchyIndex(mockInsStructure, 'test_ins');
      const compPlain = resolveMolecularComponent(index, 'A:87:CA');
      const compWithIns = resolveMolecularComponent(index, 'A:87A:CA');

      expect(compPlain).toBeDefined();
      expect(compWithIns).toBeDefined();
      expect(compPlain?.id.insertionCode).toBeUndefined();
      expect(compWithIns?.id.insertionCode).toBe('A');
      expect(compPlain?.bounds.raw.center[0]).toBe(10.0);
      expect(compWithIns?.bounds.raw.center[0]).toBe(20.0);
    });
  });

  // Requirement H: Multi-Model Isolation (NMR Ensembles / Alternative Conformations)
  describe('H: Multi-Model Isolation', () => {
    it('isolates components by modelId so different models do not collide', () => {
      const mockEnsemble = {
        units: [
          {
            elements: [0],
            conformation: { x: () => 5.0, y: () => 5.0, z: () => 5.0 },
            model: {
              id: 'model_1',
              atomicHierarchy: {
                atoms: { label_atom_id: { value: () => 'CA' }, label_comp_id: { value: () => 'MET' } },
                residueAtomSegments: { index: [0] },
                chainAtomSegments: { index: [0] },
                chains: { auth_asym_id: { value: () => 'A' } },
                residues: { auth_seq_id: { value: () => 1 }, pdbx_PDB_ins_code: { value: () => '' } },
              },
            },
          },
          {
            elements: [0],
            conformation: { x: () => 15.0, y: () => 15.0, z: () => 15.0 },
            model: {
              id: 'model_2',
              atomicHierarchy: {
                atoms: { label_atom_id: { value: () => 'CA' }, label_comp_id: { value: () => 'MET' } },
                residueAtomSegments: { index: [0] },
                chainAtomSegments: { index: [0] },
                chains: { auth_asym_id: { value: () => 'A' } },
                residues: { auth_seq_id: { value: () => 1 }, pdbx_PDB_ins_code: { value: () => '' } },
              },
            },
          },
        ],
      };

      const index = buildStructureHierarchyIndex(mockEnsemble, 'ensemble');
      expect(index.allComponents.length).toBe(2);
      expect(index.allComponents[0].id.modelId).toBe('model_1');
      expect(index.allComponents[1].id.modelId).toBe('model_2');
      expect(index.allComponents[0].atoms[0].coordinates[0]).toBe(5.0);
      expect(index.allComponents[1].atoms[0].coordinates[0]).toBe(15.0);
    });
  });

  // Requirement I & J: Missing Selection Returning Clean Null (Zero Fake Fallbacks)
  describe('I & J: Truthful Null / Empty Handling Without Hardcoded Fallbacks', () => {
    const mockEmpty = { units: [] };

    it('createStaticStructureAABB returns null coordinates and empty box for non-existent selections', () => {
      const bounds = createStaticStructureAABB(mockEmpty, 'Z:999:CA', 'Z:999:CB');
      expect(bounds.atomACoords).toBeNull();
      expect(bounds.atomBCoords).toBeNull();
      expect(bounds.measuredDistance).toBeNull();
      expect(bounds.proteinBox3?.isEmpty()).toBe(true);
      expect(bounds.ligandBox3?.isEmpty()).toBe(true);
    });

    it('createCurrentFrameAABB returns null coordinates and empty box for non-existent selections', () => {
      const bounds = createCurrentFrameAABB(mockEmpty, 'Z:999:CA', 'Z:999:CB');
      expect(bounds.atomACoords).toBeNull();
      expect(bounds.atomBCoords).toBeNull();
      expect(bounds.measuredDistance).toBeNull();
      expect(bounds.proteinBox3?.isEmpty()).toBe(true);
      expect(bounds.ligandBox3?.isEmpty()).toBe(true);
    });

    it('extractCoordinatesFrom3DmolModel returns null coordinates for non-existent selections', () => {
      const mock3Dmol = { selectedAtoms: () => [] };
      const bounds = extractCoordinatesFrom3DmolModel(mock3Dmol, 'Z:999:CA', 'Z:999:CB');
      expect(bounds.atomACoords).toBeNull();
      expect(bounds.atomBCoords).toBeNull();
      expect(bounds.measuredDistance).toBeNull();
      expect(bounds.proteinBox3?.isEmpty()).toBe(true);
    });
  });

  // Requirement K: Dynamic Box Extents for Minimum Image Distance
  describe('K: Dynamic Minimum-Image Distance Calculation', () => {
    it('supports custom box extents in store and measurement', () => {
      useViewerStore.getState().setBoxExtents([100, 100, 100]);
      expect(useViewerStore.getState().boxExtents).toEqual([100, 100, 100]);

      // Measure two atoms across a 100 Å box boundary: x1 = 2, x2 = 98 -> dx = 96 -> wrapped = 96 - 100 = -4 -> dist = 4.0 Å
      useViewerStore.setState({ measurementToolState: 'selecting-first-atom' });
      useViewerStore.getState().setMeasuringAtom({
        label: 'A:1:CA',
        coords: [2.0, 50.0, 50.0],
        chain: 'A',
        resSeq: 1,
        resName: 'ALA',
        atomName: 'CA',
      });

      useViewerStore.getState().setMeasuringAtom(
        {
          label: 'A:2:CA',
          coords: [98.0, 50.0, 50.0],
          chain: 'A',
          resSeq: 2,
          resName: 'ALA',
          atomName: 'CA',
        },
        true,
        [100, 100, 100]
      );

      expect(useViewerStore.getState().measuredDistance).toBe(4.0);
    });
  });
});
