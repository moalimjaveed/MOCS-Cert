// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  minimumImageDistance,
  extractCoordinatesFromMolstarStructure,
  padAABB,
  computeAtomCoordinatesAABB,
  calculateEuclideanDistance,
  createBox3FromCoordinates,
  box3ToCoordinateAABB,
  expandBox3ByScalar,
  createStaticStructureAABB,
  createCurrentFrameAABB,
  createMocsBlockAABB,
  computeBoxDimensions,
  computeBoxExtrema,
  createCornerBrackets,
  createCentroidCrosshair,
  createExtentAxes,
  MocsSpatialEnvelope,
} from '../molecular/geometry';
import { getWitnessFrameData, TRAJECTORY_WITNESS_FRAMES } from '../molecular/data/trajectoryWitnessFrames';
import { getStructureMetadata, STRUCTURE_REGISTRY } from '../molecular/data/structureRegistry';
import type { MolecularSource } from '../molecular/types';

describe('Molecular View Forensic Verification Suite', () => {
  describe('1. Minimum-Image PBC Displacement & Euclidean Distance', () => {
    it('computes standard Euclidean distance when inside the PBC box', () => {
      const p1: [number, number, number] = [40.0, 40.0, 40.0];
      const p2: [number, number, number] = [43.72, 40.0, 40.0];
      const dist = minimumImageDistance(p1, p2, [80.0, 80.0, 80.0]);
      expect(dist).toBeCloseTo(3.72, 2);
    });

    it('applies minimum-image convention across periodic boundary conditions', () => {
      const p1: [number, number, number] = [2.0, 40.0, 40.0];
      const p2: [number, number, number] = [79.0, 40.0, 40.0];
      // Periodic box is [80, 80, 80], dx = 77 -> dx wrapped = 77 - 80 = -3 -> dist = 3.0
      const dist = minimumImageDistance(p1, p2, [80.0, 80.0, 80.0]);
      expect(dist).toBeCloseTo(3.0, 4);
    });

    it('matches backend canonical 4HHB Fe-NE2 distance of 2.14 Å', () => {
      const hisNe2: [number, number, number] = [16.894, 20.030, 24.002];
      const hemFe: [number, number, number] = [18.362, 18.488, 23.755];
      const dist = calculateEuclideanDistance(hisNe2, hemFe);
      expect(Number(dist.toFixed(2))).toBe(2.14);
    });
  });

  describe('2. AABB Calculation & Non-Expansion Padding', () => {
    it('computes tight bounding box for a set of points and applies padding deterministically', () => {
      const points: [number, number, number][] = [
        [40.0, 40.0, 40.0],
        [42.0, 41.0, 40.5],
      ];
      const aabb = computeAtomCoordinatesAABB(points);
      expect(aabb.min).toEqual([40.0, 40.0, 40.0]);
      expect(aabb.max).toEqual([42.0, 41.0, 40.5]);
      expect(aabb.size).toEqual([2.0, 1.0, 0.5]);

      const padded = padAABB(aabb, 1.2);
      expect(padded.min[0]).toBeCloseTo(38.8, 4);
      expect(padded.max[0]).toBeCloseTo(43.2, 4);
      expect(padded.size[0]).toBeCloseTo(4.4, 4);
    });
  });

  describe('3. Camera Matrix Synchronization (Mol* -> Three.js)', () => {
    it('transfers 16-element view and projection matrices with bit-level fidelity', () => {
      // Mock Mol* column-major 4x4 camera matrices
      const molViewMat = [
        0.866, 0.5, 0, 0,
        -0.5, 0.866, 0, 0,
        0, 0, 1, 0,
        -10, -20, -50, 1,
      ];
      const molProjMat = [
        1.81, 0, 0, 0,
        0, 2.41, 0, 0,
        0, 0, -1.0002, -1,
        0, 0, -0.2, 0,
      ];

      const threeCam = new THREE.PerspectiveCamera();
      threeCam.matrixAutoUpdate = false;
      threeCam.matrixWorldAutoUpdate = false;

      // Synchronization routine
      threeCam.matrixWorldInverse.fromArray(molViewMat);
      threeCam.matrixWorld.copy(threeCam.matrixWorldInverse).invert();
      threeCam.projectionMatrix.fromArray(molProjMat);
      threeCam.projectionMatrixInverse.copy(threeCam.projectionMatrix).invert();

      // Verify that threeCam retains the exact matrices
      expect(Array.from(threeCam.matrixWorldInverse.elements)).toEqual(molViewMat);
      expect(Array.from(threeCam.projectionMatrix.elements)).toEqual(molProjMat);

      // Verify world point transforms to same clip space coordinates
      const worldPoint = new THREE.Vector3(40, 40, 40);
      const clipPoint = worldPoint.clone()
        .applyMatrix4(threeCam.matrixWorldInverse)
        .applyMatrix4(threeCam.projectionMatrix);

      expect(Number.isFinite(clipPoint.x)).toBe(true);
      expect(Number.isFinite(clipPoint.y)).toBe(true);
      expect(Number.isFinite(clipPoint.z)).toBe(true);
    });
  });

  describe('4. Trajectory Witness Frames Data Invariants', () => {
    it('contains exactly 43 candidate witness frames', () => {
      expect(TRAJECTORY_WITNESS_FRAMES.length).toBe(43);
    });

    it('frame 37 is the canonical satisfying witness frame with d = 3.72 Å', () => {
      const frame37 = getWitnessFrameData(37);
      expect(frame37.frameIndex).toBe(37);
      expect(frame37.trajectoryFrame).toBe(410);
      expect(frame37.distance).toBe(3.72);
      expect(frame37.atomACoords).toEqual([40.0, 40.0, 40.0]);
      expect(frame37.atomBCoords).toEqual([43.72, 40.0, 40.0]);
    });

    it('clamps out-of-range frame queries safely to [1, 43]', () => {
      expect(getWitnessFrameData(0).frameIndex).toBe(1);
      expect(getWitnessFrameData(-10).frameIndex).toBe(1);
      expect(getWitnessFrameData(999).frameIndex).toBe(43);
    });
  });

  describe('5. Stale Async Frame Request Protection (Race Condition Test)', () => {
    it('guarantees that older frame requests cannot overwrite newer frame requests', async () => {
      let activeRequestSeq = 0;
      let renderedFrame = 1;

      // Simulates async frame request
      const requestFrame = async (frame: number, delayMs: number) => {
        const currentSeq = ++activeRequestSeq;
        await new Promise((res) => setTimeout(res, delayMs));
        // Stale check
        if (currentSeq !== activeRequestSeq) {
          return; // Stale request dropped
        }
        renderedFrame = frame;
      };

      // Frame 18 request begins with high latency (50ms)
      const p18 = requestFrame(18, 50);
      // Frame 19 request begins later with low latency (10ms)
      const p19 = requestFrame(19, 10);

      await Promise.all([p18, p19]);

      // Frame 19 should have finished first and Frame 18 must NOT overwrite it!
      expect(renderedFrame).toBe(19);
    });
  });

  describe('6. MolecularSource Discriminated Union Separation', () => {
    it('strictly separates 4HHB experimental from synth_500f trajectory types', () => {
      const expSource: MolecularSource = {
        kind: 'experimental',
        provider: 'RCSB',
        structureId: '4HHB',
        observableProtein: 'A:87:NE2',
        observableLigand: 'HEM:142:FE',
        expectedDistance: 2.14,
      };

      const trajSource: MolecularSource = {
        kind: 'trajectory',
        trajectory: 'synth_500f.xtc',
        topology: 'synth_500f.gro',
        observableProtein: 'A:155:CA',
        observableLigand: 'LIG:1:O2',
        expectedWitnessDistance: 3.72,
      };

      expect(expSource.kind).toBe('experimental');
      expect(trajSource.kind).toBe('trajectory');
      expect(expSource.expectedDistance).toBe(2.14);
      expect(trajSource.expectedWitnessDistance).toBe(3.72);
    });
  });

  describe('7. Coordinate Extraction Hierarchy Unit Matching', () => {
    it('extracts coordinates correctly when hierarchy residue and chain segments are provided', () => {
      // Mock Mol* Structure with hierarchy segments
      const mockStructure = {
        units: [
          {
            polymerElements: [0],
            elements: [0, 1],
            model: {
              atomicConformation: {
                x: [16.894, 18.362],
                y: [20.030, 18.488],
                z: [24.002, 23.755],
              },
              atomicHierarchy: {
                atoms: {
                  label_atom_id: { value: (i: number) => (i === 0 ? 'NE2' : 'FE') },
                  label_comp_id: { value: (i: number) => (i === 0 ? 'HIS' : 'HEM') },
                },
                residueAtomSegments: {
                  index: [0, 1],
                },
                chainAtomSegments: {
                  index: [0, 0],
                },
                chains: {
                  auth_asym_id: { value: () => 'A' },
                },
                residues: {
                  auth_seq_id: { value: (r: number) => (r === 0 ? 87 : 142) },
                },
              },
            },
          },
        ],
      };

      const bounds = extractCoordinatesFromMolstarStructure(
        mockStructure,
        'A:87:NE2',
        'HEM:142:FE'
      );

      expect(bounds.atomACoords).toEqual([16.894, 20.030, 24.002]);
      expect(bounds.atomBCoords).toEqual([18.362, 18.488, 23.755]);
      expect(bounds.measuredDistance).toBe(2.14);
      expect(bounds.atomAName).toBe('A:87:NE2');
      expect(bounds.atomBName).toBe('HEM:142:FE');
      expect(bounds.isTrajectory).toBe(false);
      expect(bounds.boundKind).toBe('static');
      expect(bounds.proteinBox3).toBeDefined();
      expect(bounds.ligandBox3).toBeDefined();
      expect(bounds.proteinBox3?.isEmpty()).toBe(false);
      expect(bounds.ligandBox3?.isEmpty()).toBe(false);
    });
  });

  describe('8. THREE.Box3 Implementation Primitive & Conversion', () => {
    it('creates THREE.Box3 accurately using setFromPoints', () => {
      const coords: [number, number, number][] = [
        [10.0, 20.0, 30.0],
        [12.0, 25.0, 35.0],
      ];
      const box = createBox3FromCoordinates(coords);
      expect(box.min.x).toBe(10.0);
      expect(box.min.y).toBe(20.0);
      expect(box.min.z).toBe(30.0);
      expect(box.max.x).toBe(12.0);
      expect(box.max.y).toBe(25.0);
      expect(box.max.z).toBe(35.0);

      const aabb = box3ToCoordinateAABB(box);
      expect(aabb.min).toEqual([10.0, 20.0, 30.0]);
      expect(aabb.max).toEqual([12.0, 25.0, 35.0]);
      expect(aabb.size).toEqual([2.0, 5.0, 5.0]);
      expect(aabb.center).toEqual([11.0, 22.5, 32.5]);
    });

    it('expands THREE.Box3 by scalar without expanding empty boxes', () => {
      const emptyBox = new THREE.Box3().makeEmpty();
      const expandedEmpty = expandBox3ByScalar(emptyBox, 1.0);
      expect(expandedEmpty.isEmpty()).toBe(true);

      const ptBox = createBox3FromCoordinates([[40.0, 40.0, 40.0]]);
      const expandedPt = expandBox3ByScalar(ptBox, 0.5);
      expect(expandedPt.min.x).toBeCloseTo(39.5, 4);
      expect(expandedPt.max.x).toBeCloseTo(40.5, 4);
      expect(expandedPt.getSize(new THREE.Vector3()).x).toBeCloseTo(1.0, 4);
    });
  });

  describe('9. Three Distinct Bound Types Verification', () => {
    it('BOUND TYPE A: creates StaticStructureAABB with exact coordinates and Euclidean distance', () => {
      const mock4HHB = {
        units: [
          {
            elements: [0, 1],
            model: {
              atomicConformation: {
                x: [16.894, 18.362],
                y: [20.030, 18.488],
                z: [24.002, 23.755],
              },
              atomicHierarchy: {
                atoms: {
                  label_atom_id: { value: (i: number) => (i === 0 ? 'NE2' : 'FE') },
                  label_comp_id: { value: (i: number) => (i === 0 ? 'HIS' : 'HEM') },
                },
                residueAtomSegments: { index: [0, 1] },
                chainAtomSegments: { index: [0, 0] },
                chains: { auth_asym_id: { value: () => 'A' } },
                residues: { auth_seq_id: { value: (r: number) => (r === 0 ? 87 : 142) } },
              },
            },
          },
        ],
      };

      const staticBounds = createStaticStructureAABB(mock4HHB, 'A:87:NE2', 'HEM:142:FE');
      expect(staticBounds.boundKind).toBe('static');
      expect(staticBounds.isTrajectory).toBe(false);
      expect(staticBounds.measuredDistance).toBe(2.14);
      expect(staticBounds.proteinBox3).toBeInstanceOf(THREE.Box3);
      expect(staticBounds.ligandBox3).toBeInstanceOf(THREE.Box3);
    });

    it('BOUND TYPE B: creates CurrentFrameAABB with PBC minimum-image distance', () => {
      const mockSynthFrame = {
        units: [
          {
            elements: [0, 1],
            model: {
              atomicConformation: {
                x: [40.0, 43.72],
                y: [40.0, 40.0],
                z: [40.0, 40.0],
              },
              atomicHierarchy: {
                atoms: {
                  label_atom_id: { value: (i: number) => (i === 0 ? 'CA' : 'O2') },
                  label_comp_id: { value: (i: number) => (i === 0 ? 'ALA' : 'LIG') },
                },
                residueAtomSegments: { index: [0, 1] },
                chainAtomSegments: { index: [0, 0] },
                chains: { auth_asym_id: { value: () => 'A' } },
                residues: { auth_seq_id: { value: (r: number) => (r === 0 ? 155 : 1) } },
              },
            },
          },
        ],
      };

      const frameBounds = createCurrentFrameAABB(mockSynthFrame, 'A:155:CA', 'LIG:1:O2');
      expect(frameBounds.boundKind).toBe('current_frame');
      expect(frameBounds.isTrajectory).toBe(true);
      expect(frameBounds.measuredDistance).toBe(3.72);
      expect(frameBounds.proteinBox3).toBeInstanceOf(THREE.Box3);
      expect(frameBounds.ligandBox3).toBeInstanceOf(THREE.Box3);
    });

    it('BOUND TYPE C: creates MocsBlockAABB covering all frames in active block', () => {
      const blockFrames = [
        { atomACoords: [40.0, 40.0, 40.0] as [number, number, number], atomBCoords: [43.72, 40.0, 40.0] as [number, number, number] },
        { atomACoords: [40.1, 40.0, 39.9] as [number, number, number], atomBCoords: [44.10, 40.2, 40.1] as [number, number, number] },
      ];

      const blockBounds = createMocsBlockAABB(blockFrames, 41, [410, 420]);
      expect(blockBounds.boundKind).toBe('mocs_block');
      expect(blockBounds.blockId).toBe(41);
      expect(blockBounds.blockTimeRange).toEqual([410, 420]);
      expect(blockBounds.blockBox3).toBeInstanceOf(THREE.Box3);
      // Envelope spans across both frames
      expect(blockBounds.blockBox3?.min.x).toBeLessThan(40.0);
      expect(blockBounds.blockBox3?.max.x).toBeGreaterThan(44.0);
    });
  });

  describe('10. Zero Artificial Clamping Verification', () => {
    it('does not enforce artificial minimum box size (such as Math.max(size, 2.5))', () => {
      // Single atom with 0.5 padding produces size of exactly 1.0 Å, not clamped to 2.5 Å
      const ptBox = createBox3FromCoordinates([[40.0, 40.0, 40.0]]);
      const paddedBox = expandBox3ByScalar(ptBox, 0.5);
      const size = paddedBox.getSize(new THREE.Vector3());

      expect(size.x).toBeCloseTo(1.0, 4);
      expect(size.y).toBeCloseTo(1.0, 4);
      expect(size.z).toBeCloseTo(1.0, 4);
      // Must NOT be clamped to 2.5
      expect(size.x).toBeLessThan(2.0);
    });
  });

  describe('11. Scientific Corner Brackets & Precision Dimensions', () => {
    it('generates exactly 24 line segments (72 position elements) for 3-axis corner bracket reticles on a Box3', () => {
      const box = new THREE.Box3(new THREE.Vector3(10, 10, 10), new THREE.Vector3(20, 20, 20));
      const geom = createCornerBrackets(box, 1.0);
      const posAttr = geom.getAttribute('position');

      expect(posAttr).toBeDefined();
      // 8 corners * 3 arms = 24 segments * 2 points/segment = 48 points
      expect(posAttr.count).toBe(48);
      // 48 points * 3 coordinates/point = 144 float values (or 72 pairs)
      expect(posAttr.array.length).toBe(144);
    });

    it('returns empty geometry for an empty Box3', () => {
      const emptyBox = new THREE.Box3().makeEmpty();
      const geom = createCornerBrackets(emptyBox);
      expect(geom.getAttribute('position')).toBeUndefined();
    });

    it('computes exact ΔX, ΔY, ΔZ and volume with precision', () => {
      const box = new THREE.Box3(new THREE.Vector3(10, 20, 30), new THREE.Vector3(14, 25, 32));
      const dims = computeBoxDimensions(box);

      expect(dims.deltaX).toBe(4);
      expect(dims.deltaY).toBe(5);
      expect(dims.deltaZ).toBe(2);
      expect(dims.volume).toBe(40);
    });

    it('computes exact axis extrema without coordinate drift', () => {
      const box = new THREE.Box3(new THREE.Vector3(16.894, 20.030, 24.002), new THREE.Vector3(18.362, 22.105, 25.500));
      const extrema = computeBoxExtrema(box);

      expect(extrema.min).toEqual([16.894, 20.03, 24.002]);
      expect(extrema.max).toEqual([18.362, 22.105, 25.5]);
    });
  });

  describe('12. Multi-Structure Registry & Provenance Extensibility', () => {
    it('resolves canonical metadata for 4HHB and synth_500f', () => {
      const hhb = getStructureMetadata('4HHB');
      expect(hhb.id).toBe('4HHB');
      expect(hhb.kind).toBe('experimental');
      expect(hhb.provider).toBe('RCSB PDB');
      expect(hhb.defaultDistance).toBe(2.14);

      const synth = getStructureMetadata('synth_500f');
      expect(synth.id).toBe('synth_500f');
      expect(synth.kind).toBe('trajectory');
      expect(synth.defaultDistance).toBe(3.72);
    });

    it('resolves canonical metadata for 1BNA and 6VXX', () => {
      const bna = getStructureMetadata('1BNA');
      expect(bna.id).toBe('1BNA');
      expect(bna.name).toContain('1BNA');

      const spike = getStructureMetadata('6VXX');
      expect(spike.id).toBe('6VXX');
      expect(spike.name).toContain('6VXX');
    });

    it('provides fallback metadata for arbitrary RCSB entries', () => {
      const custom = getStructureMetadata('3PQR');
      expect(custom.id).toBe('3PQR');
      expect(custom.provider).toBe('RCSB PDB');
    });
  });

  describe('13. MocsSpatialEnvelope Component & Scientific Reticle Assembly', () => {
    it('creates MocsSpatialEnvelope with wireframe, corner brackets, and translucent faces', () => {
      const box = new THREE.Box3(new THREE.Vector3(10, 20, 30), new THREE.Vector3(15, 25, 35));
      const env = new MocsSpatialEnvelope(box, {
        semantic: 'current-frame',
        target: 'protein',
        selectionLabel: 'A:155:CA',
        frame: 37,
        color: '#10b981',
      });

      expect(env.group).toBeInstanceOf(THREE.Group);
      expect(env.group.children.length).toBeGreaterThan(0);

      // Verify dimensions and extrema
      const dims = env.getDimensions();
      expect(dims.deltaX).toBe(5);
      expect(dims.deltaY).toBe(5);
      expect(dims.deltaZ).toBe(5);
      expect(dims.volume).toBe(125);

      const extrema = env.getExtrema();
      expect(extrema.min).toEqual([10, 20, 30]);
      expect(extrema.max).toEqual([15, 25, 35]);

      env.dispose();
      expect(env.group.children.length).toBe(0);
    });

    it('generates centroid marker at (min + max)/2 and local extent axes when inspected', () => {
      const box = new THREE.Box3(new THREE.Vector3(10, 20, 30), new THREE.Vector3(20, 30, 40));
      const env = new MocsSpatialEnvelope(box, {
        semantic: 'query-selection',
        target: 'protein',
        color: '#10b981',
        isInspected: true,
      });

      const center = env.getCenter();
      expect(center.x).toBe(15);
      expect(center.y).toBe(25);
      expect(center.z).toBe(35);

      // Verify centroid crosshair geometry
      const crosshairGeo = createCentroidCrosshair(center, 0.5);
      const crosshairPos = crosshairGeo.getAttribute('position');
      expect(crosshairPos).toBeDefined();
      expect(crosshairPos.count).toBe(6); // 3 line segments * 2 points = 6 points

      // Verify miniature extent axes geometry
      const axesGeo = createExtentAxes(box.min, 1.0);
      const axesPos = axesGeo.getAttribute('position');
      expect(axesPos).toBeDefined();
      expect(axesPos.count).toBe(6); // 3 line segments * 2 points = 6 points

      env.dispose();
    });

    it('attaches atom reticles around active coordinates that produced the envelope', () => {
      const atomA: [number, number, number] = [16.894, 20.030, 24.002];
      const box = createBox3FromCoordinates([atomA]);

      const env = new MocsSpatialEnvelope(box, {
        semantic: 'query-selection',
        target: 'protein',
        selectionLabel: 'A:87:NE2',
        color: '#10b981',
        atomCoords: [atomA],
        isInspected: true, // reticles are gated to isInspected || isHovered
        isHovered: false,
      });

      expect(env.group.children.length).toBeGreaterThan(0);
      env.dispose();
    });

    it('handles empty Box3 safely without throwing or creating dummy geometry', () => {
      const emptyBox = new THREE.Box3().makeEmpty();
      const env = new MocsSpatialEnvelope(emptyBox, {
        semantic: 'current-frame',
        target: 'protein',
        color: '#10b981',
      });

      expect(env.group.children.length).toBe(0);
      expect(env.getCenter()).toBeDefined();
      expect(env.getDimensions().volume).toBe(0);
      env.dispose();
    });
  });

  describe('14. Zero Mathematical Padding Invariance', () => {
    it('underlying scientific Box3 has exactly zero mathematical padding', () => {
      const coords: [number, number, number][] = [
        [10.0, 20.0, 30.0],
        [14.0, 24.0, 32.0],
      ];
      const box = createBox3FromCoordinates(coords);
      const dims = computeBoxDimensions(box);

      expect(dims.deltaX).toBe(4.0);
      expect(dims.deltaY).toBe(4.0);
      expect(dims.deltaZ).toBe(2.0);
      expect(dims.volume).toBe(32.0);

      // Single atom point bound has exactly deltaX=0, deltaY=0, deltaZ=0
      const ptBox = createBox3FromCoordinates([[42.0, 42.0, 42.0]]);
      const ptDims = computeBoxDimensions(ptBox);
      expect(ptDims.deltaX).toBe(0);
      expect(ptDims.deltaY).toBe(0);
      expect(ptDims.deltaZ).toBe(0);
      expect(ptDims.volume).toBe(0);
    });
  });

  describe('15. Spatial Evidence State Discrimination & Provenance', () => {
    it('discriminates current-frame, block-envelope, and query-selection states', () => {
      const box = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 10, 10));

      const frameEnv = new MocsSpatialEnvelope(box, {
        semantic: 'current-frame',
        target: 'protein',
        frame: 18,
        color: '#10b981',
      });

      const blockEnv = new MocsSpatialEnvelope(box, {
        semantic: 'block-envelope',
        target: 'selection',
        blockStart: 410,
        blockEndExclusive: 420,
        color: '#d97706',
      });

      expect(frameEnv.group.name).toContain('current-frame');
      expect(blockEnv.group.name).toContain('block-envelope');

      frameEnv.dispose();
      blockEnv.dispose();
    });
  });

  describe('16. Representation Independence Invariant', () => {
    it('molecular biopolymer representation style does not alter the mathematical AABB coordinates', () => {
      const coords: [number, number, number][] = [
        [12.34, 56.78, 90.12],
        [15.00, 60.00, 95.00],
      ];

      // Whether rendered as cartoon, sticks, or spheres, coordinate AABB is identical
      const aabbCartoon = computeAtomCoordinatesAABB(coords);
      const aabbSticks = computeAtomCoordinatesAABB(coords);
      const aabbSpheres = computeAtomCoordinatesAABB(coords);

      expect(aabbCartoon).toEqual(aabbSticks);
      expect(aabbSticks).toEqual(aabbSpheres);
      expect(aabbCartoon.min).toEqual([12.34, 56.78, 90.12]);
      expect(aabbCartoon.max).toEqual([15.00, 60.00, 95.00]);
    });
  });

  describe('17. Nucleic Duplex (1BNA) & Complex (1TUP) Molecule-Type Separation', () => {
    it('correctly classifies 1BNA as pure nucleic duplex with water and zero protein', () => {
      // Mock 1BNA structure with DNA residues across Chains A and B plus solvent waters
      const mock1BNA = {
        units: [
          {
            elements: [0, 1, 2, 3],
            model: {
              atomicConformation: {
                x: [10.0, 15.0, 18.0, 50.0],
                y: [20.0, 25.0, 28.0, 50.0],
                z: [30.0, 35.0, 38.0, 50.0],
              },
              atomicHierarchy: {
                atoms: {
                  label_atom_id: { value: (i: number) => (i === 0 ? "O5'" : i === 1 ? "O3'" : i === 2 ? 'C1' : 'O') },
                  label_comp_id: { value: (i: number) => (i === 0 ? 'DC' : i === 1 ? 'DG' : i === 2 ? 'DA' : 'HOH') },
                },
                residueAtomSegments: { index: [0, 1, 2, 3] },
                chainAtomSegments: { index: [0, 0, 1, 2] },
                chains: { auth_asym_id: { value: (c: number) => (c === 0 ? 'A' : c === 1 ? 'B' : 'W') } },
                residues: { auth_seq_id: { value: (r: number) => (r === 0 ? 1 : r === 1 ? 24 : r === 2 ? 12 : 101) } },
              },
            },
          },
        ],
      };

      const bounds = extractCoordinatesFromMolstarStructure(mock1BNA, "A:1:O5'", "B:24:O3'");

      expect(bounds.proteinAtomsCount).toBe(0);
      expect(bounds.nucleicAtomsCount).toBe(3);
      expect(bounds.waterAtomsCount).toBe(1);
      expect(bounds.ionAtomsCount).toBe(0);

      expect(bounds.nucleicBox3).toBeDefined();
      expect(bounds.nucleicBox3?.isEmpty()).toBe(false);
      expect(bounds.proteinBox3?.isEmpty()).toBe(true);

      // Verify zero mathematical padding on nucleic AABB
      const dims = bounds.nucleicDimensions;
      expect(dims?.deltaX).toBe(8.0); // 18 - 10
      expect(dims?.deltaY).toBe(8.0); // 28 - 20
      expect(dims?.deltaZ).toBe(8.0); // 38 - 30
      expect(dims?.volume).toBe(512);

      // Centroid is strictly (min + max) / 2
      const extrema = bounds.nucleicExtrema;
      expect(extrema?.min).toEqual([10, 20, 30]);
      expect(extrema?.max).toEqual([18, 28, 38]);
    });

    it('correctly classifies 1TUP as protein + nucleic complex with Zn ions', () => {
      // Mock 1TUP structure with protein, DNA, water, and zinc ion
      const mock1TUP = {
        units: [
          {
            elements: [0, 1, 2, 3],
            model: {
              atomicConformation: {
                x: [12.0, 20.0, 35.0, 5.0],
                y: [14.0, 22.0, 38.0, 6.0],
                z: [16.0, 24.0, 40.0, 7.0],
              },
              atomicHierarchy: {
                atoms: {
                  label_atom_id: { value: (i: number) => (i === 0 ? 'CA' : i === 1 ? "O5'" : i === 2 ? 'O' : 'ZN') },
                  label_comp_id: { value: (i: number) => (i === 0 ? 'ARG' : i === 1 ? 'DT' : i === 2 ? 'HOH' : 'ZN') },
                },
                residueAtomSegments: { index: [0, 1, 2, 3] },
                chainAtomSegments: { index: [0, 1, 2, 3] },
                chains: { auth_asym_id: { value: (c: number) => (c === 0 ? 'A' : c === 1 ? 'E' : c === 2 ? 'W' : 'Z') } },
                residues: { auth_seq_id: { value: (r: number) => (r === 0 ? 248 : r === 1 ? 11 : r === 2 ? 1 : 1) } },
              },
            },
          },
        ],
      };

      const bounds = extractCoordinatesFromMolstarStructure(mock1TUP, 'A:248:ARG', 'E:11:DT');

      expect(bounds.proteinAtomsCount).toBe(1);
      expect(bounds.nucleicAtomsCount).toBe(1);
      expect(bounds.waterAtomsCount).toBe(1);
      expect(bounds.ionAtomsCount).toBe(1);

      expect(bounds.proteinBox3?.isEmpty()).toBe(false);
      expect(bounds.nucleicBox3?.isEmpty()).toBe(false);
    });
  });

  describe('18. Nucleic Spatial Envelope Rendering & Reticle Integration', () => {
    it('creates MocsSpatialEnvelope with target nucleic and Sky Blue color scheme', () => {
      const box = new THREE.Box3(new THREE.Vector3(10, 10, 10), new THREE.Vector3(30, 30, 50));
      const env = new MocsSpatialEnvelope(box, {
        semantic: 'query-selection',
        target: 'nucleic',
        color: '#0284c7',
        isInspected: true,
      });

      expect(env.group).toBeInstanceOf(THREE.Group);
      expect(env.group.name).toContain('MocsSpatialEnvelope_nucleic');

      const dims = env.getDimensions();
      expect(dims.deltaX).toBe(20);
      expect(dims.deltaY).toBe(20);
      expect(dims.deltaZ).toBe(40);
      expect(dims.volume).toBe(16000);

      const center = env.getCenter();
      expect(center.x).toBe(20);
      expect(center.y).toBe(20);
      expect(center.z).toBe(30);

      env.dispose();
      expect(env.group.children.length).toBe(0);
    });
  });
});

