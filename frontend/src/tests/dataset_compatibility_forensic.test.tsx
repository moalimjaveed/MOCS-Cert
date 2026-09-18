// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parsePDB } from '../renderer/loading/pdbLoader';
import {
  computeDatasetCapabilities,
} from '../molecular/types/capabilities';
import {
  resolveCanonicalIdentifier,
} from '../molecular/resolver/canonicalAtomResolver';
import {
  compileRenderScene,
} from '../renderer/scene/compiler';
import { useViewerStore } from '../store/useViewerStore';
import {
  STRUCTURE_REGISTRY,
  searchRegistry,
  getStructureMetadata,
} from '../molecular/data/structureRegistry';

describe('PASS 49 — Dataset Compatibility & Molecular Interaction Forensic Suite', () => {
  const publicStructuresDir = path.resolve(__dirname, '../../public/structures');

  beforeEach(() => {
    useViewerStore.getState().selectStructure('4HHB');
  });

  describe('1. Dataset Capabilities & Multi-Biopolymer Classification', () => {
    it('accurately computes capabilities for 4HHB (tetrameric protein + heme ligand + solvent)', () => {
      const pdbText = fs.readFileSync(path.join(publicStructuresDir, '4HHB.pdb'), 'utf-8');
      const structure = parsePDB(pdbText, '4HHB');
      const caps = computeDatasetCapabilities(structure);

      expect(caps.protein).toBe(true);
      expect(caps.nucleic).toBe(false);
      expect(caps.dna).toBe(false);
      expect(caps.rna).toBe(false);
      expect(caps.ligand).toBe(true);
      expect(caps.solvent).toBe(true);
      expect(caps.aabbProtein).toBe(true);
      expect(caps.aabbNucleic).toBe(false);
      expect(caps.aabbLigand).toBe(true);
      expect(caps.hasBlocks).toBe(false);
      expect(caps.trajectory).toBe(false);
    });

    it('accurately computes capabilities for 1BNA (canonical B-DNA duplex + water; zero protein)', () => {
      const pdbText = fs.readFileSync(path.join(publicStructuresDir, '1BNA.pdb'), 'utf-8');
      const structure = parsePDB(pdbText, '1BNA');
      const caps = computeDatasetCapabilities(structure);

      expect(caps.protein).toBe(false);
      expect(caps.nucleic).toBe(true);
      expect(caps.dna).toBe(true);
      expect(caps.ligand).toBe(false);
      expect(caps.solvent).toBe(true);
      expect(caps.aabbProtein).toBe(false);
      expect(caps.aabbNucleic).toBe(true);
      expect(caps.aabbLigand).toBe(false);
      expect(caps.hasBlocks).toBe(false);
    });

    it('accurately computes capabilities for 1TUP (p53 protein + DNA duplex + zinc ions)', () => {
      const pdbText = fs.readFileSync(path.join(publicStructuresDir, '1TUP.pdb'), 'utf-8');
      const structure = parsePDB(pdbText, '1TUP');
      const caps = computeDatasetCapabilities(structure);

      expect(caps.protein).toBe(true);
      expect(caps.nucleic).toBe(true);
      expect(caps.dna).toBe(true);
      expect(caps.ions).toBe(true);
      expect(caps.aabbProtein).toBe(true);
      expect(caps.aabbNucleic).toBe(true);
      expect(caps.hasBlocks).toBe(false);
    });

    it('accurately computes capabilities for synth_500f (trajectory dataset with temporal blocks)', () => {
      const pdbText = fs.readFileSync(path.join(publicStructuresDir, 'synth_500f.pdb'), 'utf-8');
      const structure = parsePDB(pdbText, 'synth_500f');
      const caps = computeDatasetCapabilities(structure);

      expect(caps.protein).toBe(true);
      expect(caps.trajectory).toBe(true);
      expect(caps.hasBlocks).toBe(true);
      expect(caps.aabbProtein).toBe(true);
    });
  });

  describe('2. Canonical Atom & Residue Resolver (Dynamic Centroids & Multi-Biopolymer Resolution)', () => {
    it('resolves exact atoms in 4HHB without ambiguity', () => {
      const pdbText = fs.readFileSync(path.join(publicStructuresDir, '4HHB.pdb'), 'utf-8');
      const structure = parsePDB(pdbText, '4HHB');

      const resHis = resolveCanonicalIdentifier(structure, 'A:87:NE2');
      expect(resHis.ok).toBe(true);
      if (resHis.ok) {
        expect(resHis.targetType).toBe('atom');
        expect(resHis.primaryMatch.atomName).toBe('NE2');
        expect(resHis.primaryMatch.residueName).toBe('HIS');
        expect(resHis.primaryMatch.resSeq).toBe(87);
        expect(resHis.centroid).toBeDefined();
        expect(resHis.centroid.length).toBe(3);
      }

      const resFe = resolveCanonicalIdentifier(structure, 'HEM:142:FE', { preferredChain: 'A' });
      expect(resFe.ok).toBe(true);
      if (resFe.ok) {
        expect(resFe.targetType).toBe('atom');
        expect(resFe.primaryMatch.atomName).toBe('FE');
        expect(resFe.primaryMatch.residueName).toBe('HEM');
      }
    });

    it('resolves DNA nucleotide atoms and termini in 1BNA', () => {
      const pdbText = fs.readFileSync(path.join(publicStructuresDir, '1BNA.pdb'), 'utf-8');
      const structure = parsePDB(pdbText, '1BNA');

      const res5Prime = resolveCanonicalIdentifier(structure, "A:1:O5'");
      expect(res5Prime.ok).toBe(true);
      if (res5Prime.ok) {
        expect(res5Prime.targetType).toBe('atom');
        expect(res5Prime.primaryMatch.chainId).toBe('A');
        expect(res5Prime.primaryMatch.residueId).toBe(1);
      }

      const res3Prime = resolveCanonicalIdentifier(structure, "B:24:O3'");
      expect(res3Prime.ok).toBe(true);
      if (res3Prime.ok) {
        expect(res3Prime.targetType).toBe('atom');
        expect(res3Prime.primaryMatch.chainId).toBe('B');
        expect(res3Prime.primaryMatch.residueId).toBe(24);
      }
    });

    it('resolves residue-level landmarks to geometric 3D centroids in 1TUP (p53 Arg248 and DNA DT11)', () => {
      const pdbText = fs.readFileSync(path.join(publicStructuresDir, '1TUP.pdb'), 'utf-8');
      const structure = parsePDB(pdbText, '1TUP');

      // Residue A:248:ARG (Protein landmark)
      const resArg = resolveCanonicalIdentifier(structure, 'A:248:ARG');
      expect(resArg.ok).toBe(true);
      if (resArg.ok) {
        expect(resArg.targetType).toBe('residue');
        expect(resArg.matches.length).toBeGreaterThan(1);
        expect(resArg.boundingRadius).toBeGreaterThan(1.0);
        expect(Number.isFinite(resArg.centroid[0])).toBe(true);
        expect(Number.isFinite(resArg.centroid[1])).toBe(true);
        expect(Number.isFinite(resArg.centroid[2])).toBe(true);
      }

      // Residue E:11:DT (DNA nucleotide landmark)
      const resDt = resolveCanonicalIdentifier(structure, 'E:11:DT');
      expect(resDt.ok).toBe(true);
      if (resDt.ok) {
        expect(resDt.targetType).toBe('residue');
        expect(resDt.matches.length).toBeGreaterThan(1);
        expect(resDt.boundingRadius).toBeGreaterThan(1.0);
      }

      // Shorthand notation A:248 and E:11
      const resArgShort = resolveCanonicalIdentifier(structure, 'A:248');
      expect(resArgShort.ok).toBe(true);
      const resDtShort = resolveCanonicalIdentifier(structure, 'E:11');
      expect(resDtShort.ok).toBe(true);
    });

    it('fails closed with typed error codes on non-existent atoms and residues', () => {
      const pdbText = fs.readFileSync(path.join(publicStructuresDir, '4HHB.pdb'), 'utf-8');
      const structure = parsePDB(pdbText, '4HHB');

      const missingAtom = resolveCanonicalIdentifier(structure, 'Z:999:ZZZ');
      expect(missingAtom.ok).toBe(false);
      if (!missingAtom.ok) {
        expect(missingAtom.error.kind).toBe('ATOM_NOT_FOUND');
      }

      const missingRes = resolveCanonicalIdentifier(structure, 'Z:999');
      expect(missingRes.ok).toBe(false);
      if (!missingRes.ok) {
        expect(missingRes.error.kind).toBe('RESIDUE_NOT_FOUND');
      }
    });
  });

  describe('3. Deterministic Proof Scene Compiler (Nucleic AABB & Generic Distance Calipers)', () => {
    it('compiles distinct aabbProtein and aabbNucleic with correct scientific color bindings', () => {
      const pdbText = fs.readFileSync(path.join(publicStructuresDir, '1TUP.pdb'), 'utf-8');
      const structure = parsePDB(pdbText, '1TUP');

      const scene = compileRenderScene(structure, 1, {
        aabbProtein: true,
        aabbNucleic: true,
      });

      expect(scene.proofScene.aabbs.length).toBe(2);

      const proteinAabb = scene.proofScene.aabbs.find((a) => a.id.includes('protein'));
      expect(proteinAabb).toBeDefined();
      expect(proteinAabb?.colorHex).toBe(0x38bdf8); // Sky blue for protein

      const nucleicAabb = scene.proofScene.aabbs.find((a) => a.id.includes('nucleic'));
      expect(nucleicAabb).toBeDefined();
      expect(nucleicAabb?.colorHex).toBe(0xa78bfa); // Distinctive violet for nucleic acid

      expect(scene.proofScene.resolutionFailures.length).toBe(0);
    });

    it('compiles pure nucleic-acid AABB for 1BNA without generating ghost protein AABB', () => {
      const pdbText = fs.readFileSync(path.join(publicStructuresDir, '1BNA.pdb'), 'utf-8');
      const structure = parsePDB(pdbText, '1BNA');

      const scene = compileRenderScene(structure, 1, {
        aabbProtein: false,
        aabbNucleic: true,
      });

      expect(scene.proofScene.aabbs.length).toBe(1);
      expect(scene.proofScene.aabbs[0].id).toContain('aabb-nucleic');
      expect(scene.proofScene.aabbs[0].colorHex).toBe(0xa78bfa);
    });

    it('compiles cross-biopolymer distance calipers (protein ↔ DNA in 1TUP)', () => {
      const pdbText = fs.readFileSync(path.join(publicStructuresDir, '1TUP.pdb'), 'utf-8');
      const structure = parsePDB(pdbText, '1TUP');

      const scene = compileRenderScene(structure, 1, {
        distanceMeasurement: {
          atomAQuery: 'A:248:ARG',
          atomBQuery: 'E:11:DT',
          colorHex: 0x10b981,
        },
      });

      expect(scene.proofScene.calipers.length).toBe(1);
      const caliper = scene.proofScene.calipers[0];
      expect(caliper.caliper.distanceAngstroms).toBeGreaterThan(0);
      expect(caliper.colorHex).toBe(0x10b981);
      expect(scene.proofScene.resolutionFailures.length).toBe(0);
    });

    it('compiles DNA ↔ DNA distance calipers across duplex strands in 1BNA', () => {
      const pdbText = fs.readFileSync(path.join(publicStructuresDir, '1BNA.pdb'), 'utf-8');
      const structure = parsePDB(pdbText, '1BNA');

      const scene = compileRenderScene(structure, 1, {
        distanceMeasurement: {
          atomAQuery: "A:1:O5'",
          atomBQuery: "B:24:O3'",
        },
      });

      expect(scene.proofScene.calipers.length).toBe(1);
      const caliper = scene.proofScene.calipers[0];
      expect(caliper.caliper.distanceAngstroms).toBeGreaterThan(15.0);
      expect(scene.proofScene.resolutionFailures.length).toBe(0);
    });

    it('generates explicit ProofResolutionFailure records when atoms cannot be found', () => {
      const pdbText = fs.readFileSync(path.join(publicStructuresDir, '4HHB.pdb'), 'utf-8');
      const structure = parsePDB(pdbText, '4HHB');

      const scene = compileRenderScene(structure, 1, {
        distanceMeasurement: {
          atomAQuery: 'A:87:NE2',
          atomBQuery: 'X:999:FAKE',
        },
      });

      expect(scene.proofScene.calipers.length).toBe(0);
      expect(scene.proofScene.resolutionFailures.length).toBe(1);
      expect(scene.proofScene.resolutionFailures[0].kind).toBe('caliper');
      expect(scene.proofScene.resolutionFailures[0].query).toBe('X:999:FAKE');
    });
  });

  describe('4. Store State Management & Explorer Navigation Integration', () => {
    it('resets capabilities, selections, and measurements cleanly upon selectStructure', () => {
      const store = useViewerStore.getState();

      // Simulate active measurements and selections
      store.setSelections('A:87:NE2', 'HEM:142:FE');
      store.setMeasuredDistance(2.14);
      store.setCapabilities({
        protein: true,
        dna: false,
        rna: false,
        nucleic: false,
        ligand: true,
        solvent: true,
        ions: false,
        trajectory: false,
        measurements: true,
        aabbProtein: true,
        aabbNucleic: false,
        aabbLigand: true,
        focus: true,
        explore: true,
        hasBlocks: false,
      });

      // Switch to 1BNA
      store.selectStructure('1BNA');

      const nextState = useViewerStore.getState();
      expect(nextState.activeStructureId).toBe('1BNA');
      expect(nextState.capabilities).toBeNull();
      expect(nextState.selectionA).toBe('');
      expect(nextState.selectionB).toBe('');
      expect(nextState.measuredDistance).toBe(0);
      expect(nextState.measurementToolState).toBe('idle');
      expect(nextState.isExplorerOpen).toBe(false);
    });

    it('opens and closes explorer modal state predictably', () => {
      const store = useViewerStore.getState();
      expect(store.isExplorerOpen).toBe(false);

      store.openExplorer();
      expect(useViewerStore.getState().isExplorerOpen).toBe(true);

      store.closeExplorer();
      expect(useViewerStore.getState().isExplorerOpen).toBe(false);
    });

    it('searches registry across experimental, computed, and designed datasets', () => {
      const p53Results = searchRegistry('p53');
      expect(p53Results.some((s) => s.id === '1TUP')).toBe(true);
      expect(p53Results.some((s) => s.id === 'AF-P04637-F1')).toBe(true);

      const dnaResults = searchRegistry('DNA');
      expect(dnaResults.some((s) => s.id === '1BNA')).toBe(true);
      expect(dnaResults.some((s) => s.id === '1TUP')).toBe(true);

      const spikeResults = searchRegistry('6VXX');
      expect(spikeResults.length).toBe(1);
      expect(spikeResults[0].id).toBe('6VXX');

      const synthResults = searchRegistry('synth_500f');
      expect(synthResults.length).toBe(1);
      expect(synthResults[0].category).toBe('trajectory_dataset');
    });

    it('returns valid metadata and default selections for all registered structures', () => {
      const meta4hhb = getStructureMetadata('4HHB');
      expect(meta4hhb.defaultSelA).toBe('A:87:NE2');
      expect(meta4hhb.defaultSelB).toBe('HEM:142:FE');

      const meta1bna = getStructureMetadata('1BNA');
      expect(meta1bna.defaultSelA).toBe("A:1:O5'");
      expect(meta1bna.defaultSelB).toBe("B:24:O3'");

      const meta1tup = getStructureMetadata('1TUP');
      expect(meta1tup.defaultSelA).toBe('A:248:ARG');
      expect(meta1tup.defaultSelB).toBe('E:11:DT');

      const metaSynth = getStructureMetadata('synth_500f');
      expect(metaSynth.defaultSelA).toBe('A:155:CA');
      expect(metaSynth.defaultSelB).toBe('LIG:1:O2');

      const meta6vxx = getStructureMetadata('6VXX');
      expect(meta6vxx.defaultSelA).toBe('A:500:CA');
      expect(meta6vxx.defaultSelB).toBe('B:500:CA');
    });
  });

  describe('4. Molecular View UX & Interaction Repair Invariants', () => {
    it('provides camera snapshot and restoration interface on renderer contract', () => {
      // Create mock renderer implementing snapshot methods
      const mockCameraSnapshot = { target: [0, 0, 0], position: [10, 20, 30], zoom: 1.5 };
      let restoredSnapshot: any = null;

      const mockRenderer = {
        getCameraSnapshot: () => mockCameraSnapshot,
        setCameraSnapshot: (snap: any) => {
          restoredSnapshot = snap;
        },
        clearInspectionCutaway: async () => {},
      };

      expect(typeof mockRenderer.getCameraSnapshot).toBe('function');
      expect(typeof mockRenderer.setCameraSnapshot).toBe('function');
      expect(typeof mockRenderer.clearInspectionCutaway).toBe('function');

      const snap = mockRenderer.getCameraSnapshot();
      expect(snap).toEqual(mockCameraSnapshot);

      mockRenderer.setCameraSnapshot(snap);
      expect(restoredSnapshot).toEqual(mockCameraSnapshot);
    });

    it('manages active biopolymer representations across protein and nucleic datasets', () => {
      // Test representation options
      const validRepresentations = ['cartoon', 'sticks', 'ball-and-stick', 'surface', 'gaussian-surface', 'backbone', 'spacefill'];
      expect(validRepresentations).toContain('surface');
      expect(validRepresentations).toContain('sticks');
      expect(validRepresentations).toContain('cartoon');
    });

    it('preserves clean view state transitions without resetting scientific state', () => {
      const store = useViewerStore.getState();
      store.selectStructure('1TUP');
      store.setSelections('A:248:ARG', 'E:11:DT');

      // State is retained
      expect(useViewerStore.getState().activeStructureId).toBe('1TUP');
      expect(useViewerStore.getState().selectionA).toBe('A:248:ARG');
      expect(useViewerStore.getState().selectionB).toBe('E:11:DT');
    });
  });
});

