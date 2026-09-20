// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  // Identity
  classifyResidue,
  normalizeChainId,
  validateCoordinates,
  parseCanonicalSelection,
  type MolecularComponentId,
  type ValidatedAtom,
  type IndexedComponent,
  type StructureHierarchyIndex,

  // Geometry
  computeRawExtents,
  calculateControlledPadding,
  computeVisualRenderBounds,
  computeOrientedBoundingBox,
  type ComponentGeometricBound,

  // Pipeline
  buildStructureHierarchyIndex,
  resolveMolecularComponent,
  resolveAllMatchingComponents,
  createGroupBound,
  computeComponentBounds,

  // Structure Bounds
  createStaticStructureAABB,
  createCurrentFrameAABB,
  extractCoordinatesFromMolstarStructure,
} from '../molecular/geometry';

// Real 4HHB coordinates from RCSB (selected representative atoms for exact extents)
const HHB_HEM_A_ATOMS: Array<{ serial: number; atom: string; resn: string; chain: string; resi: number; x: number; y: number; z: number }> = [
  { serial: 4389, atom: 'CHA', resn: 'HEM', chain: 'A', resi: 142, x: 18.675, y: 18.641, z: 20.464 },
  { serial: 4390, atom: 'CHB', resn: 'HEM', chain: 'A', resi: 142, x: 20.996, y: 20.564, z: 24.241 },
  { serial: 4391, atom: 'CHC', resn: 'HEM', chain: 'A', resi: 142, x: 18.666, y: 17.711, z: 27.273 },
  { serial: 4392, atom: 'CHD', resn: 'HEM', chain: 'A', resi: 142, x: 16.693, y: 15.349, z: 23.426 },
  { serial: 4397, atom: 'CMA', resn: 'HEM', chain: 'A', resi: 142, x: 22.334, y: 21.915, z: 21.498 }, // X max
  { serial: 4400, atom: 'CGA', resn: 'HEM', chain: 'A', resi: 142, x: 21.309, y: 22.355, z: 16.897 },
  { serial: 4401, atom: 'O1A', resn: 'HEM', chain: 'A', resi: 142, x: 20.230, y: 21.524, z: 16.437 },
  { serial: 4402, atom: 'O2A', resn: 'HEM', chain: 'A', resi: 142, x: 19.899, y: 22.984, z: 16.799 }, // Y max
  { serial: 4409, atom: 'CBB', resn: 'HEM', chain: 'A', resi: 142, x: 21.385, y: 19.628, z: 29.745 }, // Z max
  { serial: 4415, atom: 'CAC', resn: 'HEM', chain: 'A', resi: 142, x: 15.919, y: 13.759, z: 25.843 },
  { serial: 4416, atom: 'CBC', resn: 'HEM', chain: 'A', resi: 142, x: 15.748, y: 12.753, z: 24.871 }, // X min, Y min
  { serial: 4426, atom: 'O1D', resn: 'HEM', chain: 'A', resi: 142, x: 18.067, y: 18.528, z: 15.922 }, // Z min
  { serial: 4431, atom: 'FE',  resn: 'HEM', chain: 'A', resi: 142, x: 18.362, y: 18.488, z: 23.755 }, // Fe center
];

const HHB_HEM_C_ATOMS: Array<{ serial: number; atom: string; resn: string; chain: string; resi: number; x: number; y: number; z: number }> = [
  { serial: 5361, atom: 'CHA', resn: 'HEM', chain: 'C', resi: 142, x:  4.251, y: 24.237, z: 57.868 },
  { serial: 5362, atom: 'CHB', resn: 'HEM', chain: 'C', resi: 142, x:  2.656, y: 26.418, z: 53.811 },
  { serial: 5363, atom: 'CHC', resn: 'HEM', chain: 'C', resi: 142, x:  3.909, y: 22.343, z: 51.451 },
  { serial: 5364, atom: 'CHD', resn: 'HEM', chain: 'C', resi: 142, x:  5.199, y: 20.082, z: 55.472 },
  { serial: 5369, atom: 'CMA', resn: 'HEM', chain: 'C', resi: 142, x:  1.983, y: 28.371, z: 56.084 },
  { serial: 5374, atom: 'O2A', resn: 'HEM', chain: 'C', resi: 142, x:  4.343, y: 29.355, z: 60.524 }, // Y max
  { serial: 5381, atom: 'CBB', resn: 'HEM', chain: 'C', resi: 142, x:  1.687, y: 24.897, z: 48.641 }, // X min, Z min
  { serial: 5388, atom: 'CBC', resn: 'HEM', chain: 'C', resi: 142, x:  4.661, y: 16.883, z: 52.628 }, // Y min
  { serial: 5393, atom: 'CMD', resn: 'HEM', chain: 'C', resi: 142, x:  5.894, y: 19.560, z: 58.433 }, // X max
  { serial: 5398, atom: 'O2D', resn: 'HEM', chain: 'C', resi: 142, x:  4.388, y: 21.393, z: 62.880 }, // Z max
  { serial: 5403, atom: 'FE',  resn: 'HEM', chain: 'C', resi: 142, x:  4.445, y: 23.463, z: 54.548 }, // Fe center
];

const HHB_HEM_B_ATOMS: Array<{ serial: number; atom: string; resn: string; chain: string; resi: number; x: number; y: number; z: number }> = [
  { serial: 5356, atom: 'NA', resn: 'HEM', chain: 'B', resi: 148, x: 20.024, y:  2.942, z: 58.603 },
  { serial: 5357, atom: 'NB', resn: 'HEM', chain: 'B', resi: 148, x: 19.891, y:  3.489, z: 55.821 },
  { serial: 5360, atom: 'FE', resn: 'HEM', chain: 'B', resi: 148, x: 19.264, y:  4.466, z: 57.461 },
];

const HHB_HEM_D_ATOMS: Array<{ serial: number; atom: string; resn: string; chain: string; resi: number; x: number; y: number; z: number }> = [
  { serial: 5443, atom: 'NA', resn: 'HEM', chain: 'D', resi: 148, x: -2.975, y:  3.248, z: 23.071 },
  { serial: 5444, atom: 'NB', resn: 'HEM', chain: 'D', resi: 148, x: -2.569, y:  4.252, z: 25.747 },
  { serial: 5447, atom: 'FE', resn: 'HEM', chain: 'D', resi: 148, x: -1.727, y:  4.699, z: 23.942 },
];

describe('Molecular Structural Identity & Universal Bounding-Volume Verification Suite', () => {

  describe('TEST 1: 4HHB Chain A HEM 142 (Strict Chain Isolation & Compact Volume)', () => {
    it('isolates Chain A HEM 142 to its tight ~6.6 x 10.2 x 13.8 Å volume with zero Chain C contamination', () => {
      // Build index containing both Chain A and Chain C
      const mock4HHB = [...HHB_HEM_A_ATOMS, ...HHB_HEM_C_ATOMS];
      const index = buildStructureHierarchyIndex(mock4HHB, '4HHB', 1);

      // Resolve Chain A HEM 142 explicitly
      const hemA = resolveMolecularComponent(index, 'A:HEM:142');
      expect(hemA).not.toBeNull();
      expect(hemA!.id.chainId).toBe('A');
      expect(hemA!.id.residueName).toBe('HEM');
      expect(hemA!.id.residueNumber).toBe(142);
      expect(hemA!.atoms.length).toBe(HHB_HEM_A_ATOMS.length);

      // Verify exact raw extents match real RCSB coordinates
      const raw = hemA!.bounds.raw;
      expect(raw.min[0]).toBeCloseTo(15.75, 2); // X min
      expect(raw.max[0]).toBeCloseTo(22.33, 2); // X max
      expect(raw.min[1]).toBeCloseTo(12.75, 2); // Y min
      expect(raw.max[1]).toBeCloseTo(22.98, 2); // Y max
      expect(raw.min[2]).toBeCloseTo(15.92, 2); // Z min
      expect(raw.max[2]).toBeCloseTo(29.75, 2); // Z max

      // Dimensions are compact (NOT the 47 Å diagonal slice of the old bug)
      expect(raw.dimensions[0]).toBeCloseTo(6.59, 2);
      expect(raw.dimensions[1]).toBeCloseTo(10.23, 2);
      expect(raw.dimensions[2]).toBeCloseTo(13.82, 2);

      // Center is around [19.04, 17.86, 22.84]
      expect(raw.center[0]).toBeCloseTo(19.04, 1);
      expect(raw.center[1]).toBeCloseTo(17.87, 1);
      expect(raw.center[2]).toBeCloseTo(22.84, 1);

      // Zero atoms from Chain C (Z coordinates of Chain A are all < 30 Å, Chain C are > 48 Å)
      for (const a of hemA!.atoms) {
        expect(a.coordinates[2]).toBeLessThan(35.0);
      }

      // Controlled visual padding is strictly non-expansive
      const padding = hemA!.bounds.render.padding;
      expect(padding).toBeGreaterThanOrEqual(0.15);
      expect(padding).toBeLessThanOrEqual(0.60);
    });
  });

  describe('TEST 2: 4HHB Chain C HEM 142 (Isolated at Z ≈ 58 Å, Never Merged with Chain A)', () => {
    it('isolates Chain C HEM 142 at Z ≈ 58 Å and keeps it strictly separated from Chain A HEM 142', () => {
      const mock4HHB = [...HHB_HEM_A_ATOMS, ...HHB_HEM_C_ATOMS];
      const index = buildStructureHierarchyIndex(mock4HHB, '4HHB', 1);

      const hemC = resolveMolecularComponent(index, 'C:HEM:142');
      expect(hemC).not.toBeNull();
      expect(hemC!.id.chainId).toBe('C');
      expect(hemC!.id.residueName).toBe('HEM');
      expect(hemC!.id.residueNumber).toBe(142);
      expect(hemC!.atoms.length).toBe(HHB_HEM_C_ATOMS.length);

      const raw = hemC!.bounds.raw;
      expect(raw.min[0]).toBeCloseTo(1.69, 2); // X min
      expect(raw.max[0]).toBeCloseTo(5.89, 2); // X max
      expect(raw.min[1]).toBeCloseTo(16.88, 2); // Y min
      expect(raw.max[1]).toBeCloseTo(29.36, 2); // Y max
      expect(raw.min[2]).toBeCloseTo(48.64, 2); // Z min
      expect(raw.max[2]).toBeCloseTo(62.88, 2); // Z max

      // Z coordinates are isolated at ~58 Å (distanced from Chain A by >30 Å)
      expect(raw.center[2]).toBeCloseTo(55.76, 1);
      for (const a of hemC!.atoms) {
        expect(a.coordinates[2]).toBeGreaterThan(45.0);
      }
    });
  });

  describe('TEST 3: 4HHB A+B+C+D (Four Independent Heme Groups Without Cross-Subunit Bleed)', () => {
    it('indexes all 4 heme groups into distinct components with independent bounding volumes', () => {
      const mock4HHB = [
        ...HHB_HEM_A_ATOMS,
        ...HHB_HEM_B_ATOMS,
        ...HHB_HEM_C_ATOMS,
        ...HHB_HEM_D_ATOMS,
      ];
      const index = buildStructureHierarchyIndex(mock4HHB, '4HHB', 1);

      const allHemes = resolveAllMatchingComponents(index, 'HEM');
      expect(allHemes.length).toBe(4);

      const chainIds = allHemes.map((h) => h.id.chainId).sort();
      expect(chainIds).toEqual(['A', 'B', 'C', 'D']);

      // Each heme has its own distinct center in 3D space
      const centers = allHemes.map((h) => h.bounds.raw.center);
      for (let i = 0; i < centers.length; i++) {
        for (let j = i + 1; j < centers.length; j++) {
          const dx = centers[i][0] - centers[j][0];
          const dy = centers[i][1] - centers[j][1];
          const dz = centers[i][2] - centers[j][2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          expect(dist).toBeGreaterThan(10.0); // Distinct subunits separated by >10 Å
        }
      }
    });
  });

  describe('TEST 4: Duplicate Residue Numbers Across Chains Never Merged', () => {
    it('keeps identical residue sequence numbers in different chains completely isolated', () => {
      const mockMultiChain = [
        { serial: 1, atom: 'CA', resn: 'LYS', chain: 'A', resi: 15, x: 10, y: 10, z: 10 },
        { serial: 2, atom: 'NZ', resn: 'LYS', chain: 'A', resi: 15, x: 12, y: 10, z: 10 },
        { serial: 3, atom: 'CA', resn: 'LYS', chain: 'B', resi: 15, x: 50, y: 50, z: 50 },
        { serial: 4, atom: 'NZ', resn: 'LYS', chain: 'B', resi: 15, x: 52, y: 50, z: 50 },
      ];
      const index = buildStructureHierarchyIndex(mockMultiChain, 'TEST_DUP', 1);

      const lysA = resolveMolecularComponent(index, 'A:15');
      const lysB = resolveMolecularComponent(index, 'B:15');

      expect(lysA).not.toBeNull();
      expect(lysB).not.toBeNull();
      expect(lysA!.id.chainId).toBe('A');
      expect(lysB!.id.chainId).toBe('B');
      expect(lysA!.atoms.length).toBe(2);
      expect(lysB!.atoms.length).toBe(2);

      expect(lysA!.bounds.raw.max[0]).toBeCloseTo(12.0, 2);
      expect(lysB!.bounds.raw.min[0]).toBeCloseTo(50.0, 2);
    });
  });

  describe('TEST 5: Duplicate Ligand Names Across Chains', () => {
    it('resolves duplicate ligand names with context scoping and supports multi-component queries', () => {
      const mockMultiChain = [
        ...HHB_HEM_A_ATOMS,
        ...HHB_HEM_C_ATOMS,
      ];
      const index = buildStructureHierarchyIndex(mockMultiChain, '4HHB', 1);

      // Context-aware resolution by chainId
      const hemInC = resolveMolecularComponent(index, 'HEM:142', { chainId: 'C' });
      expect(hemInC).not.toBeNull();
      expect(hemInC!.id.chainId).toBe('C');

      // Spatial proximity resolution (reference coordinates near Chain A)
      const hemNearA = resolveMolecularComponent(index, 'HEM:142', { coords: [19, 18, 23] });
      expect(hemNearA).not.toBeNull();
      expect(hemNearA!.id.chainId).toBe('A');

      // Global match finds both without merging
      const allHem142 = resolveAllMatchingComponents(index, 'HEM:142');
      expect(allHem142.length).toBe(2);
      expect(allHem142[0].id.chainId).not.toBe(allHem142[1].id.chainId);
    });
  });

  describe('TEST 6: Single Atom Selection & Degenerate Geometries', () => {
    it('guarantees zero-size raw mathematical extents while providing 0.35 Å visual thickness for WebGL', () => {
      const singleFe: ValidatedAtom[] = [
        { id: 1, atomName: 'FE', element: 'FE', coordinates: [18.362, 18.488, 23.755], isHetero: true },
      ];

      const raw = computeRawExtents(singleFe);
      expect(raw.dimensions[0]).toBe(0);
      expect(raw.dimensions[1]).toBe(0);
      expect(raw.dimensions[2]).toBe(0);
      expect(raw.volume).toBe(0);
      expect(raw.diagonal).toBe(0);
      expect(raw.isDegenerate).toBe(true);

      // Visual render bounds ensure minimum thickness of 0.35 Å for rasterization
      const render = computeVisualRenderBounds(raw);
      expect(render.dimensions[0]).toBeGreaterThanOrEqual(0.35);
      expect(render.dimensions[1]).toBeGreaterThanOrEqual(0.35);
      expect(render.dimensions[2]).toBeGreaterThanOrEqual(0.35);
      expect(render.box3.isEmpty()).toBe(false);

      // Center remains exact
      const center = render.box3.getCenter(new THREE.Vector3());
      expect(center.x).toBeCloseTo(18.362, 3);
      expect(center.y).toBeCloseTo(18.488, 3);
      expect(center.z).toBeCloseTo(23.755, 3);
    });
  });

  describe('TEST 7: Trajectory Current-Frame vs Trajectory-Wide Bounds', () => {
    it('computes dynamic, frame-specific bounding volumes that update with motion', () => {
      const frame0 = [
        { serial: 1, atom: 'CA', resn: 'ALA', chain: 'A', resi: 155, x: 40.0, y: 40.0, z: 40.0 },
        { serial: 2, atom: 'O2', resn: 'LIG', chain: 'A', resi: 1,   x: 45.5, y: 40.0, z: 40.0 },
      ];
      const frame410 = [
        { serial: 1, atom: 'CA', resn: 'ALA', chain: 'A', resi: 155, x: 40.0, y: 40.0, z: 40.0 },
        { serial: 2, atom: 'O2', resn: 'LIG', chain: 'A', resi: 1,   x: 43.75, y: 40.0, z: 40.0 },
      ];

      const bounds0 = createCurrentFrameAABB(frame0, 'A:155:CA', 'LIG:1:O2');
      const bounds410 = createCurrentFrameAABB(frame410, 'A:155:CA', 'LIG:1:O2');

      expect(bounds0.atomBCoords?.[0]).toBeCloseTo(45.5, 2);
      expect(bounds410.atomBCoords?.[0]).toBeCloseTo(43.75, 2);
      expect(bounds0.measuredDistance).toBeCloseTo(5.5, 2);
      expect(bounds410.measuredDistance).toBeCloseTo(3.75, 2);
      expect(bounds0.boundKind).toBe('current_frame');
      expect(bounds410.boundKind).toBe('current_frame');
    });
  });

  describe('TEST 8: Multi-Model Isolation (Ensemble / Alternative Conformations)', () => {
    it('scopes components strictly to modelId so ensemble models are not conflated', () => {
      const model1Atoms = [
        { serial: 1, atom: 'CA', resn: 'PHE', chain: 'A', resi: 1, x: 10, y: 10, z: 10 },
      ];
      const model2Atoms = [
        { serial: 1, atom: 'CA', resn: 'PHE', chain: 'A', resi: 1, x: 25, y: 25, z: 25 },
      ];

      const indexModel1 = buildStructureHierarchyIndex(model1Atoms, 'NMR_ENS', 1);
      const indexModel2 = buildStructureHierarchyIndex(model2Atoms, 'NMR_ENS', 2);

      const compM1 = resolveMolecularComponent(indexModel1, 'A:1');
      const compM2 = resolveMolecularComponent(indexModel2, 'A:1');

      expect(compM1!.id.modelId).toBe(1);
      expect(compM2!.id.modelId).toBe(2);
      expect(compM1!.bounds.raw.center[0]).toBeCloseTo(10.0, 2);
      expect(compM2!.bounds.raw.center[0]).toBeCloseTo(25.0, 2);
    });
  });

  describe('TEST 9: Rotated Molecule Alignment with OBB (PCA)', () => {
    it('computes tight Oriented Bounding Box via PCA eigendecomposition that is more compact than AABB', () => {
      // Create a 1D rod aligned along the diagonal [1, 1, 1]
      const diagonalRod: ValidatedAtom[] = [];
      for (let t = -10; t <= 10; t++) {
        diagonalRod.push({
          id: t + 10,
          atomName: 'C',
          element: 'C',
          coordinates: [t * 2, t * 2, t * 2],
          isHetero: false,
        });
      }

      const raw = computeRawExtents(diagonalRod);
      const obb = computeOrientedBoundingBox(diagonalRod);

      // AABB spans from -20 to +20 on all 3 axes: size = [40, 40, 40], volume = 64,000
      expect(raw.volume).toBeCloseTo(64000, 0);

      expect(obb).toBeDefined();
      // OBB major axis is aligned with [1, 1, 1], transverse axes are near zero
      // OBB volume: 8 * hx * hy * hz should be dramatically smaller than AABB volume!
      const obbVolume = 8 * obb!.halfSizes[0] * obb!.halfSizes[1] * obb!.halfSizes[2];
      expect(obbVolume).toBeLessThan(raw.volume * 0.05);

      // First principal axis is collinear with [1, 1, 1] / sqrt(3)
      const invSqrt3 = 1 / Math.sqrt(3);
      const axis0 = obb!.axes[0];
      const dot = Math.abs(axis0[0] * invSqrt3 + axis0[1] * invSqrt3 + axis0[2] * invSqrt3);
      expect(dot).toBeCloseTo(1.0, 2); // Perfectly parallel to diagonal
    });
  });

  describe('TEST 10: Invalid Coordinates Rejection & Robustness', () => {
    it('strictly rejects non-finite coordinates (NaN, Infinity) and handles empty inputs safely', () => {
      expect(validateCoordinates(NaN, 1, 2)).toBeNull();
      expect(validateCoordinates(1, Infinity, 2)).toBeNull();
      expect(validateCoordinates(1, 2, -Infinity)).toBeNull();
      expect(validateCoordinates(1, 2, 3)).toEqual([1, 2, 3]);

      const dirtyAtoms = [
        { serial: 1, atom: 'CA', resn: 'ALA', chain: 'A', resi: 1, x: 10, y: 10, z: 10 },
        { serial: 2, atom: 'CB', resn: 'ALA', chain: 'A', resi: 1, x: NaN, y: 10, z: 10 },
        { serial: 3, atom: 'C',  resn: 'ALA', chain: 'A', resi: 1, x: 12, y: Infinity, z: 10 },
        { serial: 4, atom: 'N',  resn: 'ALA', chain: 'A', resi: 1, x: 8,  y: 10, z: 10 },
      ];

      const index = buildStructureHierarchyIndex(dirtyAtoms, 'DIRTY_TEST', 1);
      expect(index.totalValidAtoms).toBe(2);
      expect(index.invalidAtomsCount).toBe(2);

      const comp = resolveMolecularComponent(index, 'A:1');
      expect(comp).not.toBeNull();
      expect(comp!.atoms.length).toBe(2);
      expect(comp!.bounds.raw.min[0]).toBe(8);
      expect(comp!.bounds.raw.max[0]).toBe(10);
    });
  });

  describe('TEST 11: Artificial / Generated / Synthetic Structures', () => {
    it('indexes arbitrary coarse-grained beads and synthetic docking poses with group bounding', () => {
      const syntheticPose = [
        { serial: 1, atom: 'BEAD1', resn: 'DRG', chain: 'Z', resi: 999, isHetero: true, x: 100, y: 100, z: 100 },
        { serial: 2, atom: 'BEAD2', resn: 'DRG', chain: 'Z', resi: 999, isHetero: true, x: 105, y: 102, z: 101 },
        { serial: 3, atom: 'P1',    resn: 'LIG', chain: 'Z', resi: 1000, isHetero: true, x: 110, y: 100, z: 100 },
      ];

      const index = buildStructureHierarchyIndex(syntheticPose, 'SYNTH_DRG', 1);
      const drg = resolveMolecularComponent(index, 'Z:DRG:999');
      const lig = resolveMolecularComponent(index, 'Z:LIG:1000');

      expect(drg).not.toBeNull();
      expect(lig).not.toBeNull();
      expect(drg!.id.classification).toBe('ligand');

      // Test group bounding of multiple components
      const group = createGroupBound([drg!, lig!], 'Synthetic Complex');
      expect(group.raw.min[0]).toBe(100);
      expect(group.raw.max[0]).toBe(110);
      expect(group.memberComponentIds.length).toBe(2);
    });
  });

  describe('TEST 12: Invariant Assertions (Non-Expansion, Partition, Finite Coordinates)', () => {
    it('strictly satisfies all mathematical invariants of the canonical bounding volume system', () => {
      const structure = [
        ...HHB_HEM_A_ATOMS,
        ...HHB_HEM_B_ATOMS,
        ...HHB_HEM_C_ATOMS,
        ...HHB_HEM_D_ATOMS,
      ];
      const index = buildStructureHierarchyIndex(structure, '4HHB_INVARIANTS', 1);

      // Invariant A: Partition - every valid atom belongs to exactly one component
      let sumAtoms = 0;
      for (const comp of index.allComponents) {
        sumAtoms += comp.atoms.length;
      }
      expect(sumAtoms).toBe(index.totalValidAtoms);

      // Invariant B: Monotonic non-expansion - raw bounds contain all atoms with zero margin
      for (const comp of index.allComponents) {
        const compBound = computeComponentBounds(comp);
        const bounds = compBound.raw;
        for (const a of comp.atoms) {
          expect(a.coordinates[0]).toBeGreaterThanOrEqual(bounds.min[0] - 1e-6);
          expect(a.coordinates[0]).toBeLessThanOrEqual(bounds.max[0] + 1e-6);
          expect(a.coordinates[1]).toBeGreaterThanOrEqual(bounds.min[1] - 1e-6);
          expect(a.coordinates[1]).toBeLessThanOrEqual(bounds.max[1] + 1e-6);
          expect(a.coordinates[2]).toBeGreaterThanOrEqual(bounds.min[2] - 1e-6);
          expect(a.coordinates[2]).toBeLessThanOrEqual(bounds.max[2] + 1e-6);
        }
      }

      // Invariant C: Controlled padding formula
      for (const comp of index.allComponents) {
        const compBound = computeComponentBounds(comp);
        const raw = compBound.raw;
        const render = compBound.render;
        const expectedPadding = calculateControlledPadding(raw.diagonal);
        expect(render.padding).toBe(expectedPadding);
        expect(render.padding).toBeGreaterThanOrEqual(0.15);
        expect(render.padding).toBeLessThanOrEqual(0.60);
      }

      // Invariant D: Finite coordinates - all bounds dimensions are strictly positive and finite
      for (const comp of index.allComponents) {
        const compBound = computeComponentBounds(comp);
        for (let dim = 0; dim < 3; dim++) {
          expect(Number.isFinite(compBound.raw.dimensions[dim])).toBe(true);
          expect(compBound.raw.dimensions[dim]).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(compBound.render.dimensions[dim])).toBe(true);
          expect(compBound.render.dimensions[dim]).toBeGreaterThanOrEqual(0.35);
        }
      }
    });
  });

});
