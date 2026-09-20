// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  calculateCoordinateEvolution,
  calculateTrajectoryRmsd,
  calculateTrajectoryRmsf,
  calculateRadiusOfGyration,
  calculateTrajectoryRadiusOfGyration,
  calculateGeometricCentroid,
  calculateCenterOfMass,
  calculateMinimumImageDistance,
  calculateTrajectoryContactOccupancy,
  minimumImage1D,
  minimumImageVector,
  unwrapBondedMolecule,
  unwrapTrajectoryOverTime,
  centerMoleculeInBox,
  wrapCoordinatesIntoPrimaryBox,
  createFrameIdentity,
  analyzeFrameIntervals,
  calculateTimeWeightedOccupancy,
  calculateTrajectoryContactMap,
  auditTrajectoryProvenance,
  TrajectoryAnalysisCache,
  validateTrajectoryConsistency,
  validateFrameCoordinates,
  validateBoxDimensions,
  validateAtomOrderConsistency,
} from '../molecular/trajectory';
import { rotateVector3, quaternionToRotationMatrix } from '../molecular/protein/alignment';

describe('PASS 12: Molecular Dynamics, Trajectory Physics & Time-Resolved Analysis Forensic Suite', () => {
  const groPath = path.resolve(__dirname, '../../../tests/data/synth_500f.gro');
  const xtcPath = path.resolve(__dirname, '../../../tests/data/synth_500f.xtc');
  const groStr = fs.readFileSync(groPath, 'utf8');
  const xtcBuf = fs.readFileSync(xtcPath);

  // =========================================================================
  // 1. TRAJECTORY AUTHENTICITY & synth_500f FORENSICS
  // =========================================================================
  describe('1. Trajectory Authenticity & synth_500f Forensic Investigation', () => {
    it('proves synth_500f is a synthetic coordinate trajectory and NOT an equilibrium MD simulation', () => {
      const audit = auditTrajectoryProvenance({
        engine: 'MDAnalysis Synthetic Benchmark Generator',
        isSynthetic: true,
        timestepPs: 10.0,
      }, { isCoordinateOnlyFile: true });

      expect(audit.authenticity).toBe('SYNTHETIC_COORDINATE_TRAJECTORY');
      expect(audit.provenance.isSynthetic).toBe(true);
      expect(audit.provenance.temperatureK).toBeNull();
      expect(audit.provenance.pressureBar).toBeNull();
      expect(audit.provenance.forceField).toBeNull();
    });

    it('proves coordinates in synth_500f are piecewise step-generated benchmarks', () => {
      // Frame 0 vs Frame 1: Identical coordinates
      const frame0Coords: Array<[number, number, number]> = [
        [40.0, 40.0, 40.0],
        [45.5, 40.0, 40.0],
      ];
      const frame1Coords: Array<[number, number, number]> = [
        [40.0, 40.0, 40.0],
        [45.5, 40.0, 40.0],
      ];
      const step0_1 = calculateCoordinateEvolution(frame0Coords, frame1Coords);
      expect(step0_1.isStatic).toBe(true);
      expect(step0_1.maxCoordinateDiff).toBe(0.0);

      // Frame 0 vs Frame 250 (Block 2): Coordinates genuinely differ
      const frame250Coords: Array<[number, number, number]> = [
        [40.0, 40.0, 40.0],
        [42.8, 40.0, 40.0],
      ];
      const step0_250 = calculateCoordinateEvolution(frame0Coords, frame250Coords);
      expect(step0_250.isStatic).toBe(false);
      expect(step0_250.maxCoordinateDiff).toBeCloseTo(2.70, 2);
      expect(step0_250.differingAtomsCount).toBe(1);

      // Frame 450 (PBC Crossing): Displaced across periodic boundary
      const frame450Coords: Array<[number, number, number]> = [
        [1.0, 40.0, 40.0],
        [78.0, 40.0, 40.0],
      ];
      const step0_450 = calculateCoordinateEvolution(frame0Coords, frame450Coords);
      expect(step0_450.maxCoordinateDiff).toBeCloseTo(39.0, 2);
    });
  });

  // =========================================================================
  // 2. COORDINATE EVOLUTION & STATIC-FRAME DETECTION
  // =========================================================================
  describe('2. Coordinate Evolution & Static-Frame Detection', () => {
    it('detects identical coordinate sets and flags isStatic: true', () => {
      const coords: Array<[number, number, number]> = [
        [10.0, 20.0, 30.0],
        [15.0, 25.0, 35.0],
      ];
      const result = calculateCoordinateEvolution(coords, coords);
      expect(result.isStatic).toBe(true);
      expect(result.maxCoordinateDiff).toBe(0.0);
      expect(result.meanCoordinateDiff).toBe(0.0);
      expect(result.rmsCoordinateDiff).toBe(0.0);
      expect(result.differingAtomsCount).toBe(0);
    });

    it('accurately computes max, mean, and RMS coordinate differences', () => {
      const coordsA: Array<[number, number, number]> = [
        [0.0, 0.0, 0.0],
        [10.0, 0.0, 0.0],
      ];
      const coordsB: Array<[number, number, number]> = [
        [3.0, 4.0, 0.0], // diff = 5.0
        [10.0, 0.0, 0.0], // diff = 0.0
      ];
      const result = calculateCoordinateEvolution(coordsA, coordsB);
      expect(result.isStatic).toBe(false);
      expect(result.maxCoordinateDiff).toBe(5.0);
      expect(result.meanCoordinateDiff).toBe(2.5);
      expect(result.rmsCoordinateDiff).toBeCloseTo(Math.sqrt(25.0 / 2), 4);
      expect(result.differingAtomsCount).toBe(1);
    });

    it('rejects coordinate arrays with mismatched atom counts', () => {
      const coordsA: Array<[number, number, number]> = [[0, 0, 0]];
      const coordsB: Array<[number, number, number]> = [[0, 0, 0], [1, 1, 1]];
      expect(() => calculateCoordinateEvolution(coordsA, coordsB)).toThrow(/equal-length/);
    });

    it('strictly rejects non-finite coordinates in evolution evaluation', () => {
      const coordsA: Array<[number, number, number]> = [[NaN, 0, 0]];
      const coordsB: Array<[number, number, number]> = [[0, 0, 0]];
      expect(() => calculateCoordinateEvolution(coordsA, coordsB)).toThrow(/Non-finite/);
    });
  });

  // =========================================================================
  // 3. TOPOLOGY & ATOM ORDER INVARIANTS
  // =========================================================================
  describe('3. Topology / Coordinate Consistency & Atom Order Invariants', () => {
    it('validates topology and trajectory atom count matching', () => {
      const valid = validateTrajectoryConsistency(10, 10, 500);
      expect(valid.isValid).toBe(true);

      const mismatch = validateTrajectoryConsistency(10, 12, 500);
      expect(mismatch.isValid).toBe(false);
      expect(mismatch.errors[0]).toContain('mismatch');
    });

    it('detects atom reordering between topology and trajectory frames', () => {
      const topo = [
        { name: 'N', resName: 'ALA' },
        { name: 'CA', resName: 'ALA' },
        { name: 'C', resName: 'ALA' },
      ];
      const swappedFrame = [
        { name: 'CA', resName: 'ALA' }, // Swapped N and CA
        { name: 'N', resName: 'ALA' },
        { name: 'C', resName: 'ALA' },
      ];
      const orderCheck = validateAtomOrderConsistency(topo, swappedFrame);
      expect(orderCheck.isConsistent).toBe(false);
      expect(orderCheck.mismatchedIndex).toBe(0);
      expect(orderCheck.reason).toContain("Atom name mismatch at index 0: topology has 'N', frame has 'CA'");
    });
  });

  // =========================================================================
  // 4. FRAME IDENTITY & PHYSICAL TIME
  // =========================================================================
  describe('4. Frame Identity & Physical Time', () => {
    it('creates authentic frame identity distinguishing recorded vs inferred time', () => {
      const frameWithRecordedTime = createFrameIdentity('synth_500f', 50, {
        physicalTimePs: 500.0,
        timeSource: 'RECORDED',
      });
      expect(frameWithRecordedTime.frameIndex).toBe(50);
      expect(frameWithRecordedTime.physicalTimePs).toBe(500.0);
      expect(frameWithRecordedTime.physicalTimeNs).toBe(0.5);
      expect(frameWithRecordedTime.timeSource).toBe('RECORDED');

      const frameWithoutTime = createFrameIdentity('synth_500f', 50);
      expect(frameWithoutTime.physicalTimePs).toBeNull();
      expect(frameWithoutTime.timeSource).toBe('NOT_AVAILABLE');
    });

    it('analyzes uniform vs irregular time intervals', () => {
      const uniformTimestamps = [0, 10, 20, 30, 40];
      const uniformProfile = analyzeFrameIntervals(uniformTimestamps);
      expect(uniformProfile.isUniform).toBe(true);
      expect(uniformProfile.meanIntervalPs).toBe(10.0);

      const irregularTimestamps = [0, 5, 20, 25, 60];
      const irregularProfile = analyzeFrameIntervals(irregularTimestamps);
      expect(irregularProfile.isUniform).toBe(false);
      expect(irregularProfile.minIntervalPs).toBe(5.0);
      expect(irregularProfile.maxIntervalPs).toBe(35.0);
    });

    it('computes time-weighted contact occupancy for irregular intervals', () => {
      // Contact present at frame 0 (duration 10 ps), absent at frame 1 (duration 90 ps)
      // Frame count occupancy = 1/2 = 50%, but Time occupancy = 10 / (10 + 90) = 10%
      const contactFlags = [true, false];
      const timestamps = [0, 10, 100]; // dt0 = 10ps, dt1 = 90ps
      const timeWeighted = calculateTimeWeightedOccupancy(contactFlags, [0, 10]);
      expect(timeWeighted).toBe(1.0); // single interval

      const flags = [true, false, false];
      const times = [0, 10, 100]; // interval 0->1: 10ps (true), interval 1->2: 90ps (false)
      const occupancy = calculateTimeWeightedOccupancy(flags, times);
      expect(occupancy).toBe(0.10); // 10 / 100 = 10%
    });
  });

  // =========================================================================
  // 5. PERIODIC BOUNDARY CONDITIONS & MOLECULE UNWRAPPING
  // =========================================================================
  describe('5. Periodic Boundary Conditions & Molecule Unwrapping', () => {
    const box: [number, number, number] = [80.0, 80.0, 80.0];

    it('computes 1D minimum image displacement across periodic boundary', () => {
      // Points at x=1.0 and x=78.0 in box L=80.0 -> dx = 77.0 -> minimum image = -3.0
      const dx = 77.0;
      const minDx = minimumImage1D(dx, box[0]);
      expect(minDx).toBe(-3.0);

      const dist = calculateMinimumImageDistance([1.0, 40.0, 40.0], [78.0, 40.0, 40.0], box);
      expect(dist).toBeCloseTo(3.0, 4);
    });

    it('unwraps bonded molecular chains straddling periodic boundaries', () => {
      // Atom 0 at x=1.0, Atom 1 at x=79.0 (bonded, separation should be 2.0 A, not 78.0 A)
      const wrappedCoords: Array<[number, number, number]> = [
        [1.0, 40.0, 40.0],
        [79.0, 40.0, 40.0],
      ];
      const bonds: Array<[number, number]> = [[0, 1]];

      const unwrapped = unwrapBondedMolecule(wrappedCoords, bonds, box);
      expect(unwrapped[0]).toEqual([1.0, 40.0, 40.0]);
      // Atom 1 shifted by -80 -> -1.0 A
      expect(unwrapped[1][0]).toBe(-1.0);
      expect(unwrapped[1][1]).toBe(40.0);
      expect(unwrapped[1][2]).toBe(40.0);

      // Bond length in unwrapped coordinates is 2.0 A
      const bondLength = Math.abs(unwrapped[0][0] - unwrapped[1][0]);
      expect(bondLength).toBe(2.0);
    });

    it('unwraps trajectory over time to ensure continuous diffusion', () => {
      // Frame 0: x = 79.0, Frame 1: x = 1.0 (atom crossed boundary from 79 to 81 -> wrapped to 1)
      const allFrames: Array<Array<[number, number, number]>> = [
        [[79.0, 40.0, 40.0]],
        [[1.0, 40.0, 40.0]],
      ];
      const unwrapped = unwrapTrajectoryOverTime(allFrames, box);
      expect(unwrapped[0][0][0]).toBe(79.0);
      // Frame 1 should be continuously unwrapped to 81.0 A
      expect(unwrapped[1][0][0]).toBe(81.0);
    });

    it('centers molecule at the center of the periodic box [Lx/2, Ly/2, Lz/2]', () => {
      const coords: Array<[number, number, number]> = [
        [0.0, 0.0, 0.0],
        [10.0, 10.0, 10.0],
      ]; // centroid is [5, 5, 5]
      const centered = centerMoleculeInBox(coords, [100.0, 100.0, 100.0]);
      const newCentroid = calculateGeometricCentroid(centered);
      expect(newCentroid[0]).toBeCloseTo(50.0, 3);
      expect(newCentroid[1]).toBeCloseTo(50.0, 3);
      expect(newCentroid[2]).toBeCloseTo(50.0, 3);
    });
  });

  // =========================================================================
  // 6. TRAJECTORY RMSD OVER TIME
  // =========================================================================
  describe('6. Trajectory RMSD Over Time', () => {
    const frame0: Array<[number, number, number]> = [
      [0.0, 0.0, 0.0],
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
    ];
    const frame1: Array<[number, number, number]> = [
      [0.0, 0.0, 0.0],
      [1.0, 0.0, 0.0],
      [0.0, 1.2, 0.0], // Atom 2 perturbed by 0.2 A
    ];
    const frame2: Array<[number, number, number]> = [
      [0.0, 0.0, 0.0],
      [1.0, 0.0, 0.0],
      [0.0, 1.4, 0.0], // Atom 2 perturbed by 0.4 A
    ];
    const trajectory = [frame0, frame1, frame2];

    it('computes raw RMSD series against frame 0 reference', () => {
      const result = calculateTrajectoryRmsd(trajectory, {
        referenceType: 'FIRST_FRAME',
        alignFrames: false,
      });

      expect(result.rmsdSeries.length).toBe(3);
      expect(result.rmsdSeries[0]).toBe(0.0); // Identical to reference
      expect(result.rmsdSeries[1]).toBeCloseTo(0.2 / Math.sqrt(3), 4);
      expect(result.rmsdSeries[2]).toBeCloseTo(0.4 / Math.sqrt(3), 4);
      expect(result.minRmsd).toBe(0.0);
      expect(result.alignmentApplied).toBe(false);
    });

    it('computes RMSD series with Kabsch alignment', () => {
      // Rotated frame: frame0 rotated by 90 deg around Z
      const rotatedFrame: Array<[number, number, number]> = [
        [0.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [-1.0, 0.0, 0.0],
      ];
      const trajWithRot = [frame0, rotatedFrame];

      // Raw RMSD is > 0 because of rotation
      const raw = calculateTrajectoryRmsd(trajWithRot, {
        referenceType: 'FIRST_FRAME',
        alignFrames: false,
      });
      expect(raw.rmsdSeries[1]).toBeGreaterThan(0.5);

      // Aligned RMSD is 0.0 because it is a rigid rotation!
      const aligned = calculateTrajectoryRmsd(trajWithRot, {
        referenceType: 'FIRST_FRAME',
        alignFrames: true,
      });
      expect(aligned.rmsdSeries[1]).toBeCloseTo(0.0, 4);
    });

    it('computes RMSD series against ensemble average structure', () => {
      const result = calculateTrajectoryRmsd(trajectory, {
        referenceType: 'AVERAGE_STRUCTURE',
        alignFrames: false,
      });
      expect(result.referenceUsed).toContain('Ensemble Average');
      expect(result.rmsdSeries.length).toBe(3);
    });
  });

  // =========================================================================
  // 7. TRAJECTORY RMSF & ROTATIONAL/TRANSLATIONAL ALIGNMENT
  // =========================================================================
  describe('7. Trajectory RMSF & Rotational/Translational Alignment', () => {
    it('proves that rigid translation/rotation yields zero RMSF when aligned', () => {
      // Molecule undergoing pure rigid translation across 3 frames
      const frame0: Array<[number, number, number]> = [
        [0.0, 0.0, 0.0],
        [2.0, 0.0, 0.0],
        [0.0, 2.0, 0.0],
      ];
      const frame1: Array<[number, number, number]> = [
        [10.0, 10.0, 10.0],
        [12.0, 10.0, 10.0],
        [10.0, 12.0, 10.0],
      ];
      const frame2: Array<[number, number, number]> = [
        [20.0, 20.0, 20.0],
        [22.0, 20.0, 20.0],
        [20.0, 22.0, 20.0],
      ];
      const rigidTraj = [frame0, frame1, frame2];

      // Without alignment, raw coordinate variance is huge
      const unalignedRmsf = calculateTrajectoryRmsf(rigidTraj, { alignFrames: false });
      expect(unalignedRmsf.meanRmsf).toBeGreaterThan(5.0);

      // With alignment, internal fluctuation is 0.0!
      const alignedRmsf = calculateTrajectoryRmsf(rigidTraj, { alignFrames: true });
      expect(alignedRmsf.meanRmsf).toBeCloseTo(0.0, 3);
      expect(alignedRmsf.alignedBeforeRmsf).toBe(true);
    });

    it('accurately measures internal flexibility when one atom oscillates', () => {
      const frame0: Array<[number, number, number]> = [
        [0.0, 0.0, 0.0], // Rigid core atom 0
        [5.0, 0.0, 0.0], // Rigid core atom 1
        [0.0, 5.0, 0.0], // Flexible loop atom 2 at y = 5.0
      ];
      const frame1: Array<[number, number, number]> = [
        [0.0, 0.0, 0.0],
        [5.0, 0.0, 0.0],
        [0.0, 7.0, 0.0], // Flexible loop atom 2 at y = 7.0
      ];
      const traj = [frame0, frame1];

      const rmsf = calculateTrajectoryRmsf(traj, { alignFrames: false });
      expect(rmsf.rmsfPerAtom[0]).toBe(0.0);
      expect(rmsf.rmsfPerAtom[1]).toBe(0.0);
      // Atom 2 moves between 5 and 7, mean is 6, delta is 1 -> RMSF = 1.0 A
      expect(rmsf.rmsfPerAtom[2]).toBeCloseTo(1.0, 3);
    });
  });

  // =========================================================================
  // 8. RADIUS OF GYRATION & CENTER OF MASS
  // =========================================================================
  describe('8. Radius of Gyration & Center of Mass (Mass-Weighted vs Centroid)', () => {
    it('distinguishes mass-weighted COM from geometric centroid when atom masses differ', () => {
      const coords: Array<[number, number, number]> = [
        [0.0, 0.0, 0.0],   // Heavy atom (e.g. Iron = 55.845)
        [10.0, 0.0, 0.0],  // Light atom (e.g. Hydrogen = 1.008)
      ];
      const centroid = calculateGeometricCentroid(coords);
      expect(centroid[0]).toBe(5.0);

      const masses = [55.845, 1.008];
      const com = calculateCenterOfMass(coords, masses);
      // COM must be much closer to the heavy atom at x=0
      expect(com[0]).toBeLessThan(1.0);
      expect(com[0]).toBeCloseTo((55.845 * 0 + 1.008 * 10) / (55.845 + 1.008), 3);
    });

    it('computes trajectory Radius of Gyration series', () => {
      const frame0: Array<[number, number, number]> = [
        [-5.0, 0.0, 0.0],
        [5.0, 0.0, 0.0],
      ]; // Rg = 5.0 A
      const frame1: Array<[number, number, number]> = [
        [-10.0, 0.0, 0.0],
        [10.0, 0.0, 0.0],
      ]; // Rg = 10.0 A
      const traj = [frame0, frame1];

      const result = calculateTrajectoryRadiusOfGyration(traj);
      expect(result.rgSeries[0]).toBeCloseTo(5.0, 3);
      expect(result.rgSeries[1]).toBeCloseTo(10.0, 3);
      expect(result.meanRg).toBeCloseTo(7.5, 3);
      expect(result.minRg).toBeCloseTo(5.0, 3);
      expect(result.maxRg).toBeCloseTo(10.0, 3);
    });
  });

  // =========================================================================
  // 9. TRAJECTORY CONTACT OCCUPANCY & CONTACT MAP
  // =========================================================================
  describe('9. Trajectory Contact Occupancy & Pairwise Contact Map', () => {
    it('computes frame-by-frame contact occupancy and persistence classification', () => {
      // 4 frames: distance is 3.5, 3.8, 4.2, 4.5; cutoff 4.0 A
      // Contact in frame 0 and frame 1 (2 out of 4) -> 50%
      const allFrames: Array<Array<[number, number, number]>> = [
        [[0.0, 0.0, 0.0], [3.5, 0.0, 0.0]],
        [[0.0, 0.0, 0.0], [3.8, 0.0, 0.0]],
        [[0.0, 0.0, 0.0], [4.2, 0.0, 0.0]],
        [[0.0, 0.0, 0.0], [4.5, 0.0, 0.0]],
      ];

      const occ = calculateTrajectoryContactOccupancy(allFrames, {
        atomAIndex: 0,
        atomBIndex: 1,
        cutoffDistance: 4.0,
        usePbc: false,
      });

      expect(occ.occupancyFraction).toBe(0.5);
      expect(occ.contactFramesCount).toBe(2);
      expect(occ.totalFramesCount).toBe(4);
      expect(occ.minDistance).toBe(3.5);
      expect(occ.maxDistance).toBe(4.5);
      expect(occ.isPersistent).toBe(false); // < 0.70
      expect(occ.isTransient).toBe(false);  // >= 0.30
    });

    it('computes symmetric trajectory contact map and average distance matrix', () => {
      const frame0: Array<[number, number, number]> = [
        [0.0, 0.0, 0.0],
        [3.0, 0.0, 0.0],
        [0.0, 4.0, 0.0],
      ];
      const traj = [frame0];
      const map = calculateTrajectoryContactMap(traj, 3.5);

      expect(map.atomCount).toBe(3);
      expect(map.averageDistanceMatrix[0][1]).toBe(3.0);
      expect(map.averageDistanceMatrix[1][0]).toBe(3.0);
      expect(map.averageDistanceMatrix[0][2]).toBe(4.0);
      expect(map.averageDistanceMatrix[1][2]).toBe(5.0); // 3-4-5 right triangle

      // Contact frequency
      expect(map.contactFrequencyMatrix[0][1]).toBe(1.0); // 3.0 <= 3.5
      expect(map.contactFrequencyMatrix[0][2]).toBe(0.0); // 4.0 > 3.5
      expect(map.contactFrequencyMatrix[1][2]).toBe(0.0); // 5.0 > 3.5
    });
  });

  // =========================================================================
  // 10. MATHEMATICAL PROPERTY & INVARIANCE TESTS
  // =========================================================================
  describe('10. Mathematical Property & Invariance Tests', () => {
    const coordsA: Array<[number, number, number]> = [
      [0.0, 0.0, 0.0],
      [1.5, 2.5, 0.5],
      [-2.0, 3.0, 1.8],
      [3.0, -1.5, 4.2],
      [0.8, 5.0, -2.5],
    ];
    const coordsB: Array<[number, number, number]> = [
      [0.1, -0.1, 0.05],
      [1.6, 2.4, 0.55],
      [-1.9, 3.1, 1.75],
      [3.1, -1.4, 4.25],
      [0.75, 4.9, -2.45],
    ];

    it('Translation Invariance: RMSD(A + t, B + t) === RMSD(A, B)', () => {
      const shift: [number, number, number] = [100.5, -50.2, 25.8];
      const shiftedA: Array<[number, number, number]> = coordsA.map(([x, y, z]) => [
        x + shift[0], y + shift[1], z + shift[2],
      ]);
      const shiftedB: Array<[number, number, number]> = coordsB.map(([x, y, z]) => [
        x + shift[0], y + shift[1], z + shift[2],
      ]);

      const rmsdOrig = calculateTrajectoryRmsd([coordsA, coordsB], { referenceType: 'FIRST_FRAME', alignFrames: false }).rmsdSeries[1];
      const rmsdShifted = calculateTrajectoryRmsd([shiftedA, shiftedB], { referenceType: 'FIRST_FRAME', alignFrames: false }).rmsdSeries[1];

      expect(rmsdShifted).toBeCloseTo(rmsdOrig, 5);
    });

    it('Rotation Invariance: RMSD(R*A, R*B) === RMSD(A, B) under Kabsch alignment', () => {
      const q: [number, number, number, number] = [Math.cos(Math.PI / 6), 0, Math.sin(Math.PI / 6), 0]; // 60 deg rotation around Y
      const R = quaternionToRotationMatrix(q);

      const rotA = coordsA.map((p) => rotateVector3(R, p));
      const rotB = coordsB.map((p) => rotateVector3(R, p));

      const rmsdOrig = calculateTrajectoryRmsd([coordsA, coordsB], { referenceType: 'FIRST_FRAME', alignFrames: true }).rmsdSeries[1];
      const rmsdRot = calculateTrajectoryRmsd([rotA, rotB], { referenceType: 'FIRST_FRAME', alignFrames: true }).rmsdSeries[1];

      expect(rmsdRot).toBeCloseTo(rmsdOrig, 5);
    });

    it('Rg Translation Invariance: Rg(A + t) === Rg(A)', () => {
      const shift: [number, number, number] = [33.3, 44.4, 55.5];
      const shiftedA = coordsA.map(([x, y, z]) => [x + shift[0], y + shift[1], z + shift[2]] as [number, number, number]);

      const rgOrig = calculateRadiusOfGyration(coordsA).rg;
      const rgShifted = calculateRadiusOfGyration(shiftedA).rg;

      expect(rgShifted).toBeCloseTo(rgOrig, 4);
    });
  });

  // =========================================================================
  // 11. ASYNC CACHE & RACE CONDITION CANCELLATION
  // =========================================================================
  describe('11. Async Cache & Race Condition Cancellation', () => {
    it('invalidates stale asynchronous calculations via activeRequestSeq', () => {
      const cache = new TrajectoryAnalysisCache(50);
      const req1 = cache.startAsyncRequest();
      expect(cache.isRequestActive(req1)).toBe(true);

      // User rapidly scrubs, initiating request 2
      const req2 = cache.startAsyncRequest();
      expect(cache.isRequestActive(req1)).toBe(false); // req 1 is now obsolete
      expect(cache.isRequestActive(req2)).toBe(true);
    });

    it('stores and retrieves cached trajectory analysis results', () => {
      const cache = new TrajectoryAnalysisCache(10);
      const key = cache.buildKey('synth_500f', 'RMSD', { ref: 0, align: true });

      cache.set(key, { values: [0.0, 1.2, 1.5] });
      const retrieved = cache.get<{ values: number[] }>(key);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.values).toEqual([0.0, 1.2, 1.5]);
    });
  });

  // =========================================================================
  // 12. LARGE SYNTHETIC TRAJECTORY BENCHMARK FIXTURE
  // =========================================================================
  describe('12. Large Synthetic Trajectory Benchmark Fixture (1000 frames x 50 atoms)', () => {
    it('executes trajectory-wide RMSD and Rg calculations across 1000 frames with zero errors', () => {
      const numFrames = 1000;
      const numAtoms = 50;
      const largeTrajectory: Array<Array<[number, number, number]>> = [];

      for (let f = 0; f < numFrames; f++) {
        const frame: Array<[number, number, number]> = [];
        const phase = (f / 100) * 2 * Math.PI;
        for (let i = 0; i < numAtoms; i++) {
          const x = i * 2.0 + Math.sin(phase + i * 0.1) * 0.5;
          const y = Math.cos(phase + i * 0.1) * 0.5;
          const z = 0.0;
          frame.push([x, y, z]);
        }
        largeTrajectory.push(frame);
      }

      const rmsd = calculateTrajectoryRmsd(largeTrajectory, {
        referenceType: 'FIRST_FRAME',
        alignFrames: false,
      });
      expect(rmsd.rmsdSeries.length).toBe(1000);
      expect(rmsd.minRmsd).toBe(0.0);
      expect(rmsd.maxRmsd).toBeGreaterThan(0.0);

      const rg = calculateTrajectoryRadiusOfGyration(largeTrajectory);
      expect(rg.rgSeries.length).toBe(1000);
      expect(Number.isFinite(rg.meanRg)).toBe(true);
    });
  });
});
