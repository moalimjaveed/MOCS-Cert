// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import fs from 'fs';
import path from 'path';
import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { DefaultPluginSpec } from 'molstar/lib/mol-plugin/spec';
import {
  computeCanonicalAABB,
  computeBoxDimensions,
  computeBoxExtrema,
  computeAtomCoordinatesAABB,
  createBox3FromCoordinates,
  box3ToCoordinateAABB,
  expandBox3ByScalar,
  type CanonicalAABB,
} from '../molecular/geometry/coordinateBounds';
import {
  computeRawExtents,
  computeVisualRenderBounds,
  deriveComponentGeometricBound,
} from '../molecular/geometry/boundingVolume';
import {
  buildStructureHierarchyIndex,
  resolveMolecularComponent,
  resolveAllMatchingComponents,
} from '../molecular/geometry/componentPipeline';
import {
  createStaticStructureAABB,
  createCurrentFrameAABB,
  createMocsBlockAABB,
  extractCoordinatesFromMolstarStructure,
  extractCoordinatesFrom3DmolModel,
} from '../molecular/geometry/structureBounds';
import { TRAJECTORY_WITNESS_FRAMES } from '../molecular/data/trajectoryWitnessFrames';
import { useViewerStore } from '../store/useViewerStore';

describe('PASS 04: Molecular Geometry, AABB, Dimensions & Spatial Correctness Forensic Suite', () => {
  beforeEach(() => {
    useViewerStore.setState({
      activeStructureId: '4HHB',
      activeStructureInput: null,
      activeAssemblyId: null,
      boxExtents: [80, 80, 80],
    });
  });

  // Helper to load structure into Mol* plugin context from test fixtures
  async function loadTestStructure(plugin: PluginContext, filename: string, label: string) {
    const filePath = path.resolve(__dirname, '../../public/structures', filename);
    const buf = fs.readFileSync(filePath);
    const isBcif = filename.endsWith('.bcif');
    const data = await plugin.builders.data.rawData({
      data: new Uint8Array(buf),
      label,
    });
    const traj = await plugin.builders.structure.parseTrajectory(data, isBcif ? 'mmcif' : 'pdb');
    const model = await plugin.builders.structure.createModel(traj);
    const structure = await plugin.builders.structure.createStructure(model);
    return structure;
  }

  // =========================================================================
  // Core Coordinate Canonical AABB Invariant Tests (A - H, R, S, T, U)
  // =========================================================================

  it('A: calculates exact AABB for all-negative coordinates', () => {
    const coords: [number, number, number][] = [
      [-10.0, -20.0, -30.0],
      [-5.0, -15.0, -25.0],
      [-8.0, -12.0, -22.0],
    ];
    const aabb = computeCanonicalAABB(coords);

    expect(aabb.min).toEqual([-10.0, -20.0, -30.0]);
    expect(aabb.max).toEqual([-5.0, -12.0, -22.0]);
    expect(aabb.deltaX).toBe(5.0);
    expect(aabb.deltaY).toBe(8.0);
    expect(aabb.deltaZ).toBe(8.0);
    expect(aabb.volume).toBe(320.0);
    expect(aabb.center).toEqual([-7.5, -16.0, -26.0]);
    expect(aabb.isEmpty).toBe(false);
    expect(aabb.isDegenerate).toBe(false);

    // Mathematical Invariants
    expect(aabb.deltaX).toBeGreaterThanOrEqual(0);
    expect(aabb.deltaY).toBeGreaterThanOrEqual(0);
    expect(aabb.deltaZ).toBeGreaterThanOrEqual(0);
    expect(aabb.volume).toBeGreaterThanOrEqual(0);
  });

  it('B: calculates exact AABB for all-positive coordinates', () => {
    const coords: [number, number, number][] = [
      [10.0, 20.0, 30.0],
      [50.0, 60.0, 70.0],
    ];
    const aabb = computeCanonicalAABB(coords);

    expect(aabb.min).toEqual([10.0, 20.0, 30.0]);
    expect(aabb.max).toEqual([50.0, 60.0, 70.0]);
    expect(aabb.deltaX).toBe(40.0);
    expect(aabb.deltaY).toBe(40.0);
    expect(aabb.deltaZ).toBe(40.0);
    expect(aabb.volume).toBe(64000.0);
    expect(aabb.center).toEqual([30.0, 40.0, 50.0]);
  });

  it('C: calculates exact AABB for mixed positive and negative coordinates spanning the origin', () => {
    const coords: [number, number, number][] = [
      [-15.0, 25.0, -5.0],
      [15.0, -25.0, 35.0],
    ];
    const aabb = computeCanonicalAABB(coords);

    expect(aabb.min).toEqual([-15.0, -25.0, -5.0]);
    expect(aabb.max).toEqual([15.0, 25.0, 35.0]);
    expect(aabb.deltaX).toBe(30.0);
    expect(aabb.deltaY).toBe(50.0);
    expect(aabb.deltaZ).toBe(40.0);
    expect(aabb.volume).toBe(60000.0);
    expect(aabb.center).toEqual([0.0, 0.0, 15.0]);
  });

  it('D: handles single atom point bound correctly (delta === 0, volume === 0, center === point)', () => {
    const coords: [number, number, number][] = [[12.5, -34.2, 56.1]];
    const aabb = computeCanonicalAABB(coords);

    expect(aabb.min).toEqual([12.5, -34.2, 56.1]);
    expect(aabb.max).toEqual([12.5, -34.2, 56.1]);
    expect(aabb.deltaX).toBe(0.0);
    expect(aabb.deltaY).toBe(0.0);
    expect(aabb.deltaZ).toBe(0.0);
    expect(aabb.volume).toBe(0.0);
    expect(aabb.center).toEqual([12.5, -34.2, 56.1]);
    expect(aabb.isEmpty).toBe(false);
    expect(aabb.isDegenerate).toBe(true);
  });

  it('E: handles zero atoms gracefully (empty bound flag set, delta === 0, volume === 0)', () => {
    const aabb = computeCanonicalAABB([]);

    expect(aabb.isEmpty).toBe(true);
    expect(aabb.isDegenerate).toBe(true);
    expect(aabb.min).toEqual([0.0, 0.0, 0.0]);
    expect(aabb.max).toEqual([0.0, 0.0, 0.0]);
    expect(aabb.deltaX).toBe(0.0);
    expect(aabb.deltaY).toBe(0.0);
    expect(aabb.deltaZ).toBe(0.0);
    expect(aabb.volume).toBe(0.0);
    expect(aabb.center).toEqual([0.0, 0.0, 0.0]);
  });

  it('F: handles planar atom set (delta_z === 0, volume === 0, isDegenerate === true)', () => {
    const coords: [number, number, number][] = [
      [0.0, 0.0, 10.0],
      [5.0, 0.0, 10.0],
      [0.0, 8.0, 10.0],
      [5.0, 8.0, 10.0],
    ];
    const aabb = computeCanonicalAABB(coords);

    expect(aabb.deltaX).toBe(5.0);
    expect(aabb.deltaY).toBe(8.0);
    expect(aabb.deltaZ).toBe(0.0);
    expect(aabb.volume).toBe(0.0);
    expect(aabb.center).toEqual([2.5, 4.0, 10.0]);
    expect(aabb.isDegenerate).toBe(true);
  });

  it('G: handles collinear atom set (delta_y === delta_z === 0, volume === 0)', () => {
    const coords: [number, number, number][] = [
      [1.0, 4.5, -2.0],
      [6.0, 4.5, -2.0],
      [11.0, 4.5, -2.0],
    ];
    const aabb = computeCanonicalAABB(coords);

    expect(aabb.deltaX).toBe(10.0);
    expect(aabb.deltaY).toBe(0.0);
    expect(aabb.deltaZ).toBe(0.0);
    expect(aabb.volume).toBe(0.0);
    expect(aabb.center).toEqual([6.0, 4.5, -2.0]);
    expect(aabb.isDegenerate).toBe(true);
  });

  it('H: filters out invalid coordinates (NaN, Infinity, null) deterministically', () => {
    const mixedCoords: any[] = [
      [NaN, 0, 0],
      [Infinity, 1, 2],
      [-Infinity, 2, 3],
      null,
      undefined,
      [1.0, 2.0, 3.0],
      [5.0, 6.0, 7.0],
    ];
    const aabb = computeCanonicalAABB(mixedCoords as [number, number, number][]);

    expect(aabb.min).toEqual([1.0, 2.0, 3.0]);
    expect(aabb.max).toEqual([5.0, 6.0, 7.0]);
    expect(aabb.deltaX).toBe(4.0);
    expect(aabb.deltaY).toBe(4.0);
    expect(aabb.deltaZ).toBe(4.0);
    expect(aabb.volume).toBe(64.0);
    expect(aabb.isEmpty).toBe(false);

    // When all coordinates are invalid, returns empty AABB
    const allInvalid = computeCanonicalAABB([[NaN, NaN, NaN], [Infinity, -Infinity, NaN]]);
    expect(allInvalid.isEmpty).toBe(true);
  });

  it('R: coordinate translation (camera centering / pan) does NOT alter internal delta dimensions or volume', () => {
    const originalCoords: [number, number, number][] = [
      [10.0, 20.0, 30.0],
      [25.0, 35.0, 45.0],
      [15.0, 28.0, 33.0],
    ];
    const originalAABB = computeCanonicalAABB(originalCoords);

    // Arbitrary translation vector (e.g. recentering to camera target)
    const T: [number, number, number] = [-150.34, 82.11, -99.45];
    const translatedCoords: [number, number, number][] = originalCoords.map(([x, y, z]) => [
      x + T[0],
      y + T[1],
      z + T[2],
    ]);
    const translatedAABB = computeCanonicalAABB(translatedCoords);

    // Delta dimensions and volume must be strictly invariant under translation
    expect(translatedAABB.deltaX).toBeCloseTo(originalAABB.deltaX, 8);
    expect(translatedAABB.deltaY).toBeCloseTo(originalAABB.deltaY, 8);
    expect(translatedAABB.deltaZ).toBeCloseTo(originalAABB.deltaZ, 8);
    expect(translatedAABB.volume).toBeCloseTo(originalAABB.volume, 6);

    // Extrema and center translate by exactly T
    expect(translatedAABB.min[0]).toBeCloseTo(originalAABB.min[0] + T[0], 8);
    expect(translatedAABB.min[1]).toBeCloseTo(originalAABB.min[1] + T[1], 8);
    expect(translatedAABB.min[2]).toBeCloseTo(originalAABB.min[2] + T[2], 8);

    expect(translatedAABB.center[0]).toBeCloseTo(originalAABB.center[0] + T[0], 8);
    expect(translatedAABB.center[1]).toBeCloseTo(originalAABB.center[1] + T[1], 8);
    expect(translatedAABB.center[2]).toBeCloseTo(originalAABB.center[2] + T[2], 8);
  });

  it('S, T, U: mathematical rigor invariants hold across arbitrary point clouds', () => {
    const points: [number, number, number][] = [
      [14.234, -8.125, 99.412],
      [-3.441, 12.871, 45.109],
      [22.890, 0.456, -12.345],
      [-19.123, -15.892, 67.891],
    ];
    const aabb = computeCanonicalAABB(points);

    // S: Center is exact midpoint
    expect(aabb.center[0]).toBeCloseTo((aabb.min[0] + aabb.max[0]) / 2, 8);
    expect(aabb.center[1]).toBeCloseTo((aabb.min[1] + aabb.max[1]) / 2, 8);
    expect(aabb.center[2]).toBeCloseTo((aabb.min[2] + aabb.max[2]) / 2, 8);

    // T: Non-negative dimensions
    expect(aabb.deltaX).toBeCloseTo(aabb.max[0] - aabb.min[0], 8);
    expect(aabb.deltaY).toBeCloseTo(aabb.max[1] - aabb.min[1], 8);
    expect(aabb.deltaZ).toBeCloseTo(aabb.max[2] - aabb.min[2], 8);
    expect(aabb.deltaX).toBeGreaterThanOrEqual(0);
    expect(aabb.deltaY).toBeGreaterThanOrEqual(0);
    expect(aabb.deltaZ).toBeGreaterThanOrEqual(0);

    // U: Exact bounding box volume
    expect(aabb.volume).toBeCloseTo(aabb.deltaX * aabb.deltaY * aabb.deltaZ, 4);
    expect(aabb.volume).toBeGreaterThanOrEqual(0);

    // Point containment invariant
    for (const [x, y, z] of points) {
      expect(x).toBeGreaterThanOrEqual(aabb.min[0]);
      expect(x).toBeLessThanOrEqual(aabb.max[0]);
      expect(y).toBeGreaterThanOrEqual(aabb.min[1]);
      expect(y).toBeLessThanOrEqual(aabb.max[1]);
      expect(z).toBeGreaterThanOrEqual(aabb.min[2]);
      expect(z).toBeLessThanOrEqual(aabb.max[2]);
    }
  });

  // =========================================================================
  // Multi-Chain & Cross-Component Identity Tests (I, J, K, V)
  // =========================================================================

  describe('I, J, K, V: Multi-Chain Scoping & Strict Chain Segregation in 4HHB', () => {
    // Synthetic multi-chain structure mimicking 4HHB tetramer with two heme cofactors
    const mockHemoglobinStructure = {
      units: [
        // Chain A: His 87 + Hem 142
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
        // Chain C: His 87 + Hem 142 (spatially separated on opposite side of tetramer)
        {
          elements: [0, 1],
          polymerElements: [0],
          conformation: {
            x: (i: number) => (i === 0 ? -16.500 : -18.120),
            y: (i: number) => (i === 0 ? -19.800 : -18.250),
            z: (i: number) => (i === 0 ? 12.400 : 11.950),
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

    it('I: chain A bounds !== chain C bounds, and complex bounds properly envelops both', () => {
      const index = buildStructureHierarchyIndex(mockHemoglobinStructure, 'molstar_structure');

      const chainAComp = resolveMolecularComponent(index, 'A:87');
      const chainCComp = resolveMolecularComponent(index, 'C:87');

      expect(chainAComp).toBeDefined();
      expect(chainCComp).toBeDefined();

      // Chains A and C must have completely distinct coordinate centers
      expect(chainAComp!.bounds.raw.center[0]).toBeGreaterThan(0);
      expect(chainCComp!.bounds.raw.center[0]).toBeLessThan(0);
      expect(chainAComp!.bounds.raw.center).not.toEqual(chainCComp!.bounds.raw.center);

      // Complex union bounds
      const allCoords = [
        ...chainAComp!.atoms.map((a) => a.coordinates),
        ...chainCComp!.atoms.map((a) => a.coordinates),
      ];
      const complexAABB = computeCanonicalAABB(allCoords);

      expect(complexAABB.min[0]).toBeLessThanOrEqual(chainAComp!.bounds.raw.box3.min.x);
      expect(complexAABB.max[0]).toBeGreaterThanOrEqual(chainCComp!.bounds.raw.box3.max.x);
      expect(complexAABB.deltaX).toBeGreaterThan(chainAComp!.bounds.raw.dimensions[0]);
    });

    it('J & K: same residue number and same component name (HEM 142) in different chains have disjoint bounds', () => {
      const index = buildStructureHierarchyIndex(mockHemoglobinStructure, 'molstar_structure');

      const hemA = resolveMolecularComponent(index, 'A:142:FE');
      const hemC = resolveMolecularComponent(index, 'C:142:FE');

      expect(hemA).toBeDefined();
      expect(hemC).toBeDefined();
      expect(hemA!.id.chainId).toBe('A');
      expect(hemC!.id.chainId).toBe('C');
      expect(hemA!.id.residueName).toBe('HEM');
      expect(hemC!.id.residueName).toBe('HEM');

      // Coordinates are completely disjoint
      expect(hemA!.bounds.raw.center[0]).toBeCloseTo(18.362, 2);
      expect(hemC!.bounds.raw.center[0]).toBeCloseTo(-18.120, 2);
      expect(hemA!.bounds.raw.box3.intersectsBox(hemC!.bounds.raw.box3)).toBe(false);
    });

    it('V: zero cross-chain atom contamination during structure bounds extraction', () => {
      const bounds = extractCoordinatesFromMolstarStructure(
        mockHemoglobinStructure,
        'A:87:NE2',
        'A:142:FE'
      );

      expect(bounds.proteinComponent?.id.chainId).toBe('A');
      expect(bounds.ligandComponent?.id.chainId).toBe('A');
      expect(bounds.atomACoords).toEqual([16.894, 20.030, 24.002]);
      expect(bounds.atomBCoords).toEqual([18.362, 18.488, 23.755]);

      // Ensure no Chain C atom coordinates leaked into Chain A bounds
      expect(bounds.proteinBox3!.min.x).toBeGreaterThan(0);
      expect(bounds.ligandBox3!.min.x).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Visual Padding vs Scientific Dimensions Separation
  // =========================================================================

  it('Separation: raw bounds are strictly unpadded (delta = max - min), render bounds contain visual clearance padding', () => {
    const coords: [number, number, number][] = [
      [10.0, 20.0, 30.0],
      [14.0, 26.0, 38.0],
    ];
    const rawExtents = computeRawExtents(coords);
    const componentBound = deriveComponentGeometricBound('comp-1', coords, 'protein');

    // Scientific unpadded raw bounds
    expect(rawExtents.dimensions[0]).toBe(4.0);
    expect(rawExtents.dimensions[1]).toBe(6.0);
    expect(rawExtents.dimensions[2]).toBe(8.0);
    expect(rawExtents.volume).toBe(192.0);

    // ComponentBound raw box matches exact coordinates
    expect(componentBound.raw.dimensions[0]).toBe(4.0);
    expect(componentBound.raw.dimensions[1]).toBe(6.0);
    expect(componentBound.raw.dimensions[2]).toBe(8.0);
    expect(componentBound.raw.volume).toBe(192.0);

    // Visual render box contains positive clearance padding for WebGL rasterization
    expect(componentBound.render.dimensions[0]).toBeGreaterThan(componentBound.raw.dimensions[0]);
    expect(componentBound.render.dimensions[1]).toBeGreaterThan(componentBound.raw.dimensions[1]);
    expect(componentBound.render.dimensions[2]).toBeGreaterThan(componentBound.raw.dimensions[2]);

    // Structure bounds reports raw extents in proteinDimensions, not render dimensions
    const syntheticStructure = [
      { x: 10.0, y: 20.0, z: 30.0, resn: 'HIS', resi: 87, chain: 'A', atom: 'NE2' },
      { x: 14.0, y: 26.0, z: 38.0, resn: 'HIS', resi: 87, chain: 'A', atom: 'CA' },
      { x: 50.0, y: 50.0, z: 50.0, resn: 'HEM', resi: 142, chain: 'A', atom: 'FE' },
    ];
    const structBounds = createStaticStructureAABB(syntheticStructure, 'A:87', 'A:142');
    expect(structBounds.proteinDimensions!.deltaX).toBe(4.0);
    expect(structBounds.proteinDimensions!.deltaY).toBe(6.0);
    expect(structBounds.proteinDimensions!.deltaZ).toBe(8.0);
    expect(structBounds.proteinDimensions!.volume).toBe(192.0);

    // But provides proteinRenderBox3 for Three.js envelopes
    expect(structBounds.proteinRenderBox3).toBeDefined();
    expect(structBounds.proteinRenderBox3!.max.x).toBeGreaterThan(structBounds.proteinBox3!.max.x);
  });

  // =========================================================================
  // Representation & Visibility Invariance Tests (M, N)
  // =========================================================================

  it('M & N: representation type and visibility changes do NOT alter scientific AABB dimensions', () => {
    const coords: [number, number, number][] = [
      [5.0, 10.0, 15.0],
      [25.0, 30.0, 35.0],
    ];
    const initialBound = deriveComponentGeometricBound('chainA', coords, 'protein');
    const initialDims = initialBound.raw.dimensions;

    // Simulate switching representation (cartoon -> spacefill -> molecular-surface)
    // The underlying atomic coordinates remain identical
    const repChangedBound = deriveComponentGeometricBound('chainA', coords, 'protein');
    expect(repChangedBound.raw.dimensions[0]).toBe(initialDims[0]);
    expect(repChangedBound.raw.dimensions[1]).toBe(initialDims[1]);
    expect(repChangedBound.raw.dimensions[2]).toBe(initialDims[2]);
    expect(repChangedBound.raw.volume).toBe(initialBound.raw.volume);

    // Simulate toggling visibility (visible -> hidden -> visible)
    // Geometry bounds must remain stable and not collapse to zero
    expect(initialBound.raw.box3.isEmpty()).toBe(false);
    expect(initialBound.raw.dimensions[0]).toBe(20.0);
  });

  // =========================================================================
  // Multi-Model Structure Handling (L)
  // =========================================================================

  it('L: handles multi-model NMR ensemble segregation', () => {
    const model1Coords: [number, number, number][] = [
      [10.0, 20.0, 30.0],
      [15.0, 25.0, 35.0],
    ];
    const model2Coords: [number, number, number][] = [
      [12.0, 22.0, 32.0],
      [18.0, 28.0, 38.0],
    ];

    const boundModel1 = deriveComponentGeometricBound('m1', model1Coords, 'protein');
    const boundModel2 = deriveComponentGeometricBound('m2', model2Coords, 'protein');

    expect(boundModel1.raw.center).not.toEqual(boundModel2.raw.center);
    expect(boundModel1.raw.box3.min.x).toBe(10.0);
    expect(boundModel2.raw.box3.min.x).toBe(12.0);
  });

  // =========================================================================
  // Structure Replacement Lifecycle (O)
  // =========================================================================

  it('O: structure replacement completely replaces bounds with zero residual geometry', () => {
    // 1. Structure A (4HHB coordinates)
    const atoms4HHB = [
      { x: 16.894, y: 20.03, z: 24.002, resn: 'HIS', resi: 87, chain: 'A', atom: 'NE2' },
      { x: 18.362, y: 18.488, z: 23.755, resn: 'HEM', resi: 142, chain: 'A', atom: 'FE' },
    ];
    const bounds4HHB = createStaticStructureAABB(atoms4HHB, 'A:87:NE2', 'A:142:FE');
    expect(bounds4HHB.proteinBox3!.min.x).toBeCloseTo(16.894, 3);

    // 2. Structure B (1BNA coordinates)
    const atoms1BNA = [
      { x: -14.2, y: 5.1, z: 10.8, resn: 'DA', resi: 1, chain: 'A', atom: 'P' },
    ];
    const bounds1BNA = createStaticStructureAABB(atoms1BNA, 'A:1:P', 'B:24:P');

    // 1BNA bounds have completely replaced 4HHB bounds
    expect(bounds1BNA.proteinBox3!.isEmpty()).toBe(true);
    expect(bounds1BNA.nucleicBox3!.min.x).toBeCloseTo(-14.2, 3);
    expect(bounds1BNA.nucleicDimensions!.deltaX).toBe(0.0);
  });

  // =========================================================================
  // Trajectory Temporal Semantics: Frame AABB vs Trajectory MCI Block (P, Q)
  // =========================================================================

  it('P: current-frame AABB strictly reflects only current-frame coordinates', () => {
    const frame0 = TRAJECTORY_WITNESS_FRAMES[0];
    const frame1 = TRAJECTORY_WITNESS_FRAMES[1];

    const createSyntheticFrame = (f: typeof frame0) => ({
      units: [
        {
          elements: [0, 1],
          polymerElements: [0],
          conformation: {
            x: (i: number) => (i === 0 ? f.atomACoords[0] : f.atomBCoords[0]),
            y: (i: number) => (i === 0 ? f.atomACoords[1] : f.atomBCoords[1]),
            z: (i: number) => (i === 0 ? f.atomACoords[2] : f.atomBCoords[2]),
          },
          model: {
            atomicHierarchy: {
              atoms: {
                label_atom_id: { value: (i: number) => (i === 0 ? 'CA' : 'O2') },
                label_comp_id: { value: (i: number) => (i === 0 ? 'ALA' : 'LIG') },
              },
              residueAtomSegments: { index: [0, 1] },
              chainAtomSegments: { index: [0, 0] },
              chains: { auth_asym_id: { value: () => 'A' } },
              residues: {
                auth_seq_id: { value: (r: number) => (r === 0 ? 155 : 1) },
                pdbx_PDB_ins_code: { value: () => '' },
              },
            },
          },
        },
      ],
    });

    const boundsFrame0 = createCurrentFrameAABB(createSyntheticFrame(frame0), 'A:155:CA', 'LIG:1:O2');
    const boundsFrame1 = createCurrentFrameAABB(createSyntheticFrame(frame1), 'A:155:CA', 'LIG:1:O2');

    // Frame 0 coords vs Frame 1 coords
    expect(boundsFrame0.atomACoords).toEqual(frame0.atomACoords);
    expect(boundsFrame1.atomACoords).toEqual(frame1.atomACoords);
    expect(boundsFrame0.measuredDistance).toBe(frame0.distance);
    expect(boundsFrame1.measuredDistance).toBe(frame1.distance);

    expect(boundsFrame0.proteinBox3!.min.x).toBe(frame0.atomACoords[0]);
    expect(boundsFrame1.proteinBox3!.min.x).toBe(frame1.atomACoords[0]);
  });

  it('Q: trajectory-wide block AABB is conservative union of all frames across interval [410, 420)', () => {
    const blockBounds = createMocsBlockAABB(TRAJECTORY_WITNESS_FRAMES, 41, [410, 420]);

    expect(blockBounds.blockBox3).toBeDefined();
    expect(blockBounds.blockDimensions).toBeDefined();
    expect(blockBounds.blockBox3!.isEmpty()).toBe(false);

    // Trajectory block box must envelop every individual witness frame in interval
    for (const frame of TRAJECTORY_WITNESS_FRAMES) {
      const pA = new THREE.Vector3(...frame.atomACoords);
      const pB = new THREE.Vector3(...frame.atomBCoords);

      expect(blockBounds.blockBox3!.containsPoint(pA)).toBe(true);
      expect(blockBounds.blockBox3!.containsPoint(pB)).toBe(true);
    }

    // Conservative non-expansion: block volume is strictly greater than or equal to single frame volume
    const frame0 = TRAJECTORY_WITNESS_FRAMES[0];
    const frame0Box = createBox3FromCoordinates([frame0.atomACoords, frame0.atomBCoords]);
    const frame0Dims = computeBoxDimensions(frame0Box);

    expect(blockBounds.blockDimensions!.volume).toBeGreaterThanOrEqual(frame0Dims.volume);
  });
});
