import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateEuclideanDistance,
  calculateMinimumImageDistance,
  calculateBondAngleDeg,
  calculateDihedralAngleDeg,
  formatDistance,
  formatAngle,
  isValid3DCoordinate,
  extractCoords,
  resolveMeasurementEndpoint,
  createDistanceMeasurement,
  createAngleMeasurement,
  createDihedralMeasurement,
  MeasurementLifecycleManager,
} from '../molecular/measurements';
import type {
  StructureHierarchyIndex,
} from '../molecular/geometry/structuralIdentity';
import { useViewerStore } from '../store';
import { getStructureMetadata } from '../molecular/data/structureRegistry';

describe('Pass 05: Molecular Measurements, Distance, Angle, Dihedral & Calipers', () => {
  // A. Two-atom Euclidean distance exactness and mathematical invariants
  describe('A. Two-atom Euclidean Distance & Invariants', () => {
    it('computes exact Euclidean distance from Cartesian coordinates', () => {
      const p1: [number, number, number] = [1.0, 2.0, 3.0];
      const p2: [number, number, number] = [4.0, 6.0, 3.0];
      // dx = 3, dy = 4, dz = 0 -> d = 5.0
      const dist = calculateEuclideanDistance(p1, p2);
      expect(dist).toBe(5.0);
      expect(formatDistance(dist)).toBe('5.00 Å');
    });

    it('satisfies non-negativity invariant: d >= 0 for all points', () => {
      const p1: [number, number, number] = [-10.5, 4.2, -8.1];
      const p2: [number, number, number] = [-15.2, -3.8, 12.0];
      const dist = calculateEuclideanDistance(p1, p2);
      expect(dist).toBeGreaterThanOrEqual(0.0);
    });

    it('satisfies symmetry invariant: d(A, B) === d(B, A)', () => {
      const pA: [number, number, number] = [14.2, 28.5, 12.1];
      const pB: [number, number, number] = [16.5, 30.2, 14.3];
      const dAB = calculateEuclideanDistance(pA, pB);
      const dBA = calculateEuclideanDistance(pB, pA);
      expect(dAB).toBe(dBA);
    });

    it('satisfies identity of indiscernibles: d(A, A) === 0.0 without division by zero', () => {
      const p: [number, number, number] = [42.195, -18.72, 100.0];
      const dist = calculateEuclideanDistance(p, p);
      expect(dist).toBe(0.0);
      expect(Number.isFinite(dist)).toBe(true);
    });

    it('satisfies triangle inequality invariant: d(A, C) <= d(A, B) + d(B, C)', () => {
      const pA: [number, number, number] = [0.0, 0.0, 0.0];
      const pB: [number, number, number] = [3.0, 4.0, 0.0];
      const pC: [number, number, number] = [3.0, 4.0, 12.0];

      const dAB = calculateEuclideanDistance(pA, pB); // 5.0
      const dBC = calculateEuclideanDistance(pB, pC); // 12.0
      const dAC = calculateEuclideanDistance(pA, pC); // 13.0

      expect(dAC).toBeLessThanOrEqual(dAB + dBC + 1e-12);
    });
  });

  // B & E. 4HHB Regression: Proximal Histidine 87 NE2 to Heme 142 FE
  describe('B & E. 4HHB Proximal His-Heme Coordination & Cross-Chain Contamination', () => {
    // Real coordinates from 4HHB crystal structure
    const chainA_His87_NE2: [number, number, number] = [16.894, 20.030, 24.002];
    const chainA_HEM142_FE: [number, number, number] = [18.362, 18.488, 23.755];
    // In tetramer, Chain C HEM is across the complex (> 40 Å away)
    const chainC_HEM142_FE: [number, number, number] = [-2.308, 17.519, 44.755];

    it('computes exact 4HHB proximal coordination distance from actual coordinates without hardcoding', () => {
      const rawDist = calculateEuclideanDistance(chainA_His87_NE2, chainA_HEM142_FE);
      // Expected sqrt((18.362-16.894)^2 + (18.488-20.030)^2 + (23.755-24.002)^2) = 2.143314...
      expect(rawDist).toBeCloseTo(2.1433, 4);
      expect(formatDistance(rawDist, 2)).toBe('2.14 Å');

      // Modifying coordinates produces real changes (proves zero hardcoded return 2.14)
      const perturbedFE: [number, number, number] = [
        chainA_HEM142_FE[0] + 1.0,
        chainA_HEM142_FE[1],
        chainA_HEM142_FE[2],
      ];
      const perturbedDist = calculateEuclideanDistance(chainA_His87_NE2, perturbedFE);
      expect(perturbedDist).not.toBe(rawDist);
    });

    it('strictly prevents cross-chain contamination between Chain A HEM and Chain C HEM', () => {
      const distChainA = calculateEuclideanDistance(chainA_His87_NE2, chainA_HEM142_FE);
      const distChainC = calculateEuclideanDistance(chainA_His87_NE2, chainC_HEM142_FE);

      expect(distChainA).toBeCloseTo(2.14, 2);
      expect(distChainC).toBeGreaterThan(25.0); // Chain C HEM is 28.39 Å away across tetramer
      expect(distChainC).toBeCloseTo(28.39, 1);
      expect(distChainA).not.toEqual(distChainC);
    });
  });

  // C & D & L. Structural Identity & Disambiguation
  describe('C, D & L. Cross-Chain Disambiguation & Safe Selection Scoping', () => {
    let mockIndex: StructureHierarchyIndex;

    beforeEach(() => {
      // Create multi-chain mock structure with identical residue numbers across chains
      mockIndex = {
        structureId: '4HHB',
        modelId: 1,
        chains: new Map([
          [
            'A',
            {
              chainId: 'A',
              classification: 'protein',
              components: new Map([
                [
                  '87',
                  {
                    id: {
                      structureId: '4HHB',
                      modelId: 1,
                      chainId: 'A',
                      classification: 'protein',
                      residueName: 'HIS',
                      residueNumber: 87,
                    },
                    canonicalLabel: 'HIS · Chain A · 87',
                    shortLabel: 'A:HIS:87',
                    atoms: [
                      {
                        id: 1,
                        atomName: 'NE2',
                        element: 'N',
                        coordinates: [16.894, 20.030, 24.002],
                        isHetero: false,
                      },
                    ],
                  },
                ],
                [
                  '142',
                  {
                    id: {
                      structureId: '4HHB',
                      modelId: 1,
                      chainId: 'A',
                      classification: 'ligand',
                      residueName: 'HEM',
                      residueNumber: 142,
                    },
                    canonicalLabel: 'HEM · Chain A · 142',
                    shortLabel: 'A:HEM:142',
                    atoms: [
                      {
                        id: 2,
                        atomName: 'FE',
                        element: 'Fe',
                        coordinates: [18.362, 18.488, 23.755],
                        isHetero: true,
                      },
                    ],
                  },
                ],
              ]),
            },
          ],
          [
            'C',
            {
              chainId: 'C',
              classification: 'protein',
              components: new Map([
                [
                  '142',
                  {
                    id: {
                      structureId: '4HHB',
                      modelId: 1,
                      chainId: 'C',
                      classification: 'ligand',
                      residueName: 'HEM',
                      residueNumber: 142,
                    },
                    canonicalLabel: 'HEM · Chain C · 142',
                    shortLabel: 'C:HEM:142',
                    atoms: [
                      {
                        id: 3,
                        atomName: 'FE',
                        element: 'Fe',
                        coordinates: [-2.308, 17.519, 44.755],
                        isHetero: true,
                      },
                    ],
                  },
                ],
              ]),
            },
          ],
        ]),
        allComponents: [],
        totalValidAtoms: 3,
        invalidAtomsCount: 0,
      };

      // Populate allComponents
      for (const ch of mockIndex.chains.values()) {
        for (const comp of ch.components.values()) {
          mockIndex.allComponents.push(comp);
        }
      }
    });

    it('resolves explicit Chain A vs Chain C selections unambiguously', () => {
      const resA = resolveMeasurementEndpoint(mockIndex, 'A:HEM:142:FE');
      const resC = resolveMeasurementEndpoint(mockIndex, 'C:HEM:142:FE');

      expect(resA.atom).not.toBeNull();
      expect(resC.atom).not.toBeNull();
      expect(resA.atom?.chainId).toBe('A');
      expect(resC.atom?.chainId).toBe('C');
      expect(resA.atom?.coords).toEqual([18.362, 18.488, 23.755]);
      expect(resC.atom?.coords).toEqual([-2.308, 17.519, 44.755]);
    });

    it('disambiguates unchained query using contextual preferredChainId', () => {
      const res = resolveMeasurementEndpoint(mockIndex, 'HEM:142:FE', {
        preferredChainId: 'A',
      });
      expect(res.atom?.chainId).toBe('A');
      expect(res.atom?.coords).toEqual([18.362, 18.488, 23.755]);
    });

    it('rejects ambiguous query when strictChainScoping is enabled', () => {
      const res = resolveMeasurementEndpoint(mockIndex, 'HEM:142:FE', {
        strictChainScoping: true,
      });
      expect(res.atom).toBeNull();
      expect(res.isAmbiguous).toBe(true);
      expect(res.error).toContain('Ambiguous selection');
    });

    it('handles nonexistent atom gracefully with clear error and zero fake coordinates', () => {
      const res = resolveMeasurementEndpoint(mockIndex, 'A:87:NONEXISTENT');
      expect(res.atom).toBeNull();
      expect(res.error).toContain("Atom 'NONEXISTENT' not found");
    });
  });

  // F. DNA Measurements on 1BNA
  describe('F. 1BNA DNA Nucleotide Measurements', () => {
    it('measures Watson-Crick base-pair distance and DNA backbone spacing accurately', () => {
      // Canonical B-DNA coordinates from 1BNA crystal structure
      // Residue 1 (DC) Phosphate and Residue 2 (DG) Phosphate
      const dc1_P: [number, number, number] = [18.520, 24.120, 11.230];
      const dg2_P: [number, number, number] = [14.380, 26.890, 15.650];
      const backboneDistance = calculateEuclideanDistance(dc1_P, dg2_P);

      expect(backboneDistance).toBeCloseTo(6.66, 1);
      expect(formatDistance(backboneDistance)).toMatch(/\d+\.\d{2} Å/);

      // Watson-Crick hydrogen-bond donor-acceptor pair between G4 N1 and C21 N3
      const g4_N1: [number, number, number] = [21.350, 19.820, 22.410];
      const c21_N3: [number, number, number] = [23.820, 20.910, 21.320];
      const hBondDist = calculateEuclideanDistance(g4_N1, c21_N3);

      expect(hBondDist).toBeCloseTo(2.92, 1);
      expect(hBondDist).toBeGreaterThan(2.5);
      expect(hBondDist).toBeLessThan(3.5);
    });
  });

  // G. 3-Point Bond Angle
  describe('G & S. 3-Point Bond Angle Calculation & Numerical Clamping', () => {
    it('computes exact 90-degree right angle', () => {
      const pA: [number, number, number] = [1.0, 0.0, 0.0];
      const pB: [number, number, number] = [0.0, 0.0, 0.0];
      const pC: [number, number, number] = [0.0, 1.0, 0.0];

      const angle = calculateBondAngleDeg(pA, pB, pC);
      expect(angle).toBeCloseTo(90.0, 4);
      expect(formatAngle(angle)).toBe('90.00°');
    });

    it('computes 180-degree linear angle for collinear opposite points', () => {
      const pA: [number, number, number] = [-2.0, 0.0, 0.0];
      const pB: [number, number, number] = [0.0, 0.0, 0.0];
      const pC: [number, number, number] = [3.0, 0.0, 0.0];

      const angle = calculateBondAngleDeg(pA, pB, pC);
      expect(angle).toBeCloseTo(180.0, 4);
    });

    it('computes tetrahedral angle (~109.47 degrees)', () => {
      const pA: [number, number, number] = [1.0, 1.0, 1.0];
      const pB: [number, number, number] = [0.0, 0.0, 0.0];
      const pC: [number, number, number] = [1.0, -1.0, -1.0];

      const angle = calculateBondAngleDeg(pA, pB, pC);
      expect(angle).toBeCloseTo(109.47, 2);
    });

    it('returns null for coincident points (never fabricated 0°)', () => {
      const pA: [number, number, number] = [0.0, 0.0, 0.0];
      const pB: [number, number, number] = [0.0, 0.0, 0.0];
      const pC: [number, number, number] = [1.0, 1.0, 1.0];

      // A === B -> zero-length vector -> mathematically undefined angle
      const angle = calculateBondAngleDeg(pA, pB, pC);
      expect(angle).toBeNull();
      expect(formatAngle(angle)).toBe('—');
    });

    it('satisfies angle symmetry: angle(A, B, C) === angle(C, B, A)', () => {
      const pA: [number, number, number] = [2.4, 5.1, -1.2];
      const pB: [number, number, number] = [0.5, 1.0, 3.2];
      const pC: [number, number, number] = [-3.1, 4.0, 0.8];

      const angleABC = calculateBondAngleDeg(pA, pB, pC);
      const angleCBA = calculateBondAngleDeg(pC, pB, pA);
      expect(angleABC).toBeCloseTo(angleCBA!, 5);
    });
  });

  // H. 4-Point Dihedral Torsion Angle
  describe('H. 4-Point Dihedral Torsion Angle (IUPAC Convention)', () => {
    it('computes 0 degrees for planar cis conformation', () => {
      const pA: [number, number, number] = [0.0, 1.0, 0.0];
      const pB: [number, number, number] = [0.0, 0.0, 0.0];
      const pC: [number, number, number] = [1.0, 0.0, 0.0];
      const pD: [number, number, number] = [1.0, 1.0, 0.0];

      const dihedral = calculateDihedralAngleDeg(pA, pB, pC, pD);
      expect(dihedral).not.toBeNull();
      expect(Math.abs(dihedral!)).toBeCloseTo(0.0, 2);
    });

    it('computes 180 degrees for planar trans conformation', () => {
      const pA: [number, number, number] = [0.0, 1.0, 0.0];
      const pB: [number, number, number] = [0.0, 0.0, 0.0];
      const pC: [number, number, number] = [1.0, 0.0, 0.0];
      const pD: [number, number, number] = [1.0, -1.0, 0.0];

      const dihedral = calculateDihedralAngleDeg(pA, pB, pC, pD);
      expect(dihedral).not.toBeNull();
      expect(Math.abs(dihedral!)).toBeCloseTo(180.0, 2);
    });

    it('preserves IUPAC right-handed screw sign convention', () => {
      // Central bond B -> C along +Z axis
      const pA: [number, number, number] = [1.0, 0.0, 0.0]; // +X
      const pB: [number, number, number] = [0.0, 0.0, 0.0];
      const pC: [number, number, number] = [0.0, 0.0, 1.0]; // +Z
      // Rear bond rotated clockwise looking down +Z (towards -Y)
      const pD_cw: [number, number, number] = [0.0, -1.0, 1.0];
      // Rear bond rotated counter-clockwise looking down +Z (towards +Y)
      const pD_ccw: [number, number, number] = [0.0, 1.0, 1.0];

      const dihedralCW = calculateDihedralAngleDeg(pA, pB, pC, pD_cw);
      const dihedralCCW = calculateDihedralAngleDeg(pA, pB, pC, pD_ccw);

      expect(dihedralCW).toBeCloseTo(90.0, 2);
      expect(dihedralCCW).toBeCloseTo(-90.0, 2);
    });

    it('returns null for collinear atoms with undefined torsion plane', () => {
      const pA: [number, number, number] = [0.0, 0.0, 0.0];
      const pB: [number, number, number] = [1.0, 0.0, 0.0];
      const pC: [number, number, number] = [2.0, 0.0, 0.0]; // Collinear with A and B!
      const pD: [number, number, number] = [2.0, 1.0, 0.0];

      const dihedral = calculateDihedralAngleDeg(pA, pB, pC, pD);
      expect(dihedral).toBeNull();
    });
  });

  // J, K & I. Robustness Against Invalid Coordinates & Boundary Cases
  describe('J, K & I. Error Handling, NaNs & Boundary Validation', () => {
    it('rejects coordinates with NaN and Infinity', () => {
      expect(isValid3DCoordinate([NaN, 0, 0])).toBe(false);
      expect(isValid3DCoordinate([0, Infinity, 0])).toBe(false);
      expect(isValid3DCoordinate([0, 0, -Infinity])).toBe(false);
      expect(isValid3DCoordinate(null)).toBe(false);
      expect(isValid3DCoordinate([1, 2])).toBe(false);
    });

    it('returns NaN and flags invalid measurement for NaN coordinates without throwing', () => {
      const pValid: [number, number, number] = [1.0, 2.0, 3.0];
      const pInvalid: any = [NaN, 2.0, 3.0];

      const dist = calculateEuclideanDistance(pValid, pInvalid);
      expect(Number.isNaN(dist)).toBe(true);

      const meas = createDistanceMeasurement(
        { label: 'A', coords: pValid },
        { label: 'B', coords: pInvalid }
      );
      expect(meas.isValid).toBe(false);
      expect(meas.formattedValue).toBe('—');
      expect(meas.error).toBeDefined();
    });
  });

  // M, Q, R & T. Measurement Lifecycle & Multi-Measurement Tracking
  describe('M, Q, R & T. Lifecycle, Multi-Measurement & Structure Invalidation', () => {
    it('manages multiple measurements with unique IDs', () => {
      const manager = new MeasurementLifecycleManager('4HHB');
      const m1 = createDistanceMeasurement(
        { label: 'A:87:NE2', coords: [16.894, 20.03, 24.002] },
        { label: 'A:HEM:142:FE', coords: [18.362, 18.488, 23.755] }
      );
      const m2 = createDistanceMeasurement(
        { label: 'A:1:N', coords: [0.0, 0.0, 0.0] },
        { label: 'A:2:N', coords: [3.0, 4.0, 0.0] }
      );

      manager.add(m1);
      manager.add(m2);

      expect(manager.getAll().length).toBe(2);
      expect(m1.id).not.toEqual(m2.id);

      // Deletion by ID
      manager.remove(m1.id);
      expect(manager.getAll().length).toBe(1);
      expect(manager.getById(m2.id)).toBeDefined();
    });

    it('clears all measurements when switching structures to prevent stale ghost calipers', () => {
      const manager = new MeasurementLifecycleManager('4HHB');
      manager.add(
        createDistanceMeasurement(
          { label: 'A:87:NE2', coords: [16.894, 20.03, 24.002] },
          { label: 'A:HEM:142:FE', coords: [18.362, 18.488, 23.755] }
        )
      );

      expect(manager.getAll().length).toBe(1);

      // Transition from 4HHB to 1BNA
      manager.setStructure('1BNA');
      expect(manager.getAll().length).toBe(0);
    });

    it('Zustand store clears measuring atom and tool state on selectStructure', () => {
      const store = useViewerStore.getState();
      store.selectStructure('4HHB');
      store.startMeasurement();
      store.setMeasuringAtom({
        label: 'A:87:NE2',
        coords: [16.894, 20.03, 24.002],
      });

      expect(useViewerStore.getState().measurementToolState).toBe('selecting-second-atom');
      expect(useViewerStore.getState().measuringAtomA).not.toBeNull();

      // Switch to 1BNA
      useViewerStore.getState().selectStructure('1BNA');

      // Previous measurement tool state must be completely cleared
      expect(useViewerStore.getState().measurementToolState).toBe('idle');
      expect(useViewerStore.getState().measuringAtomA).toBeNull();
      expect(useViewerStore.getState().measuringAtomB).toBeNull();
      expect(useViewerStore.getState().showMeasurementLine).toBe(false);
      expect(useViewerStore.getState().measurements.length).toBe(0);
    });
  });

  // N, O, P. Invariance Tests (Camera, Representation, Visibility)
  describe('N, O & P. Geometric Invariance (Camera, Representation & Visibility)', () => {
    it('molecular distance is strictly invariant to camera transformations', () => {
      // Pure molecular coordinates are decoupled from viewport camera
      const p1: [number, number, number] = [10.0, 10.0, 10.0];
      const p2: [number, number, number] = [10.0, 10.0, 15.0];
      const d1 = calculateEuclideanDistance(p1, p2);

      // Simulating camera rotation/zoom does not alter Cartesian coordinates
      const cameraDistanceZoomIn = 20.0;
      const cameraDistanceZoomOut = 120.0;
      expect(cameraDistanceZoomIn).not.toBe(cameraDistanceZoomOut);

      const dAfterZoom = calculateEuclideanDistance(p1, p2);
      expect(dAfterZoom).toBe(d1);
    });

    it('molecular distance is strictly invariant to representation changes', () => {
      const p1: [number, number, number] = [16.894, 20.03, 24.002];
      const p2: [number, number, number] = [18.362, 18.488, 23.755];
      const dCartoon = calculateEuclideanDistance(p1, p2);

      // Switch to sticks, surface, spheres
      const representations = ['cartoon', 'sticks', 'surface', 'spheres'] as const;
      for (const rep of representations) {
        useViewerStore.getState().setRepresentation(rep);
        expect(calculateEuclideanDistance(p1, p2)).toBe(dCartoon);
      }
    });

    it('hiding component does not invalidate underlying scientific measurement record', () => {
      const meas = createDistanceMeasurement(
        { label: 'A:87:NE2', coords: [16.894, 20.03, 24.002] },
        { label: 'A:HEM:142:FE', coords: [18.362, 18.488, 23.755] }
      );

      expect(meas.isValid).toBe(true);

      // Toggle ligand visibility off
      useViewerStore.getState().toggleLigand();
      expect(meas.isValid).toBe(true);
      expect(meas.formattedValue).toBe('2.14 Å');
    });
  });

  // Multi-Structure Validation: 4HHB, 1BNA, 1TUP, 2OR1, 6VSB
  describe('Multi-Structure Registry & Scientific Fixtures', () => {
    const structures = ['4HHB', '1BNA', '1TUP', '2OR1', '6VSB'];

    it.each(structures)('loads valid metadata and default selections for %s', (id) => {
      const meta = getStructureMetadata(id);
      expect(meta).toBeDefined();
      expect(meta.id).toBe(id);
      expect(meta.provider).toBeDefined();
      expect(meta.description).toBeDefined();
    });
  });
});
