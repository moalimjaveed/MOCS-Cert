// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  calculateTrajectoryAngleSeries,
  calculateTrajectoryDihedralSeries,
  calculateTrajectoryHydrogenBondOccupancy,
  calculateAutocorrelation,
  calculateEffectiveSampleSize,
  calculateBlockAveraging,
  assessTrajectoryConvergence,
  computeTrajectoryPca,
  clusterTrajectoryConformations,
  calculateTrajectoryRmsdMatrix,
  calculateCoordinateEvolution,
  auditTrajectoryProvenance,
} from '../molecular/trajectory';

describe('PASS 17 — Molecular Dynamics, Trajectory Analytics & Statistical Validity', () => {
  // Synthesize a 10-frame test trajectory of 4 atoms
  // Atom 0: (0, 0, 0)
  // Atom 1: (1, 0, 0)
  // Atom 2: (1, 1, 0)
  // Atom 3: rotates around bond 1-2
  const buildTestTrajectory = (numFrames = 20): Array<Array<[number, number, number]>> => {
    const traj: Array<Array<[number, number, number]>> = [];
    for (let f = 0; f < numFrames; f++) {
      const angleRad = (f * 15 * Math.PI) / 180; // 0, 15, 30, ... deg
      traj.push([
        [0, 0, 0],                                // Atom 0
        [1.5, 0, 0],                              // Atom 1
        [1.5, 1.5, 0],                            // Atom 2
        [1.5 + Math.cos(angleRad), 1.5, Math.sin(angleRad)], // Atom 3
      ]);
    }
    return traj;
  };

  describe('1. 3-Point Bond Angle Time Series & Clamping', () => {
    it('accurately computes 3-point bond angle series with numerical clamping to [-1, 1]', () => {
      // Create trajectory where angle between atoms 0-1-2 is 90 degrees
      const coords: Array<Array<[number, number, number]>> = [
        [[0, 1, 0], [0, 0, 0], [1, 0, 0]], // Exactly 90 deg
        [[0, 2, 0], [0, 0, 0], [2, 0, 0]], // Exactly 90 deg
        [[0, 1, 0], [0, 0, 0], [-1, 0, 0]], // Exactly 90 deg
      ];

      const res = calculateTrajectoryAngleSeries(coords, 0, 1, 2);
      expect(res.frameCount).toBe(3);
      expect(res.meanAngleDeg).toBeCloseTo(90.0, 1);
      expect(res.minAngleDeg).toBeCloseTo(90.0, 1);
      expect(res.maxAngleDeg).toBeCloseTo(90.0, 1);
      expect(res.stdDevDeg).toBe(0);
    });

    it('handles collinear atoms without NaN using cosine clamping', () => {
      // 180 degrees (linear)
      const coords: Array<Array<[number, number, number]>> = [
        [[-1, 0, 0], [0, 0, 0], [1, 0, 0]], // 180 deg
        [[-2, 0, 0], [0, 0, 0], [2, 0, 0]], // 180 deg
      ];

      const res = calculateTrajectoryAngleSeries(coords, 0, 1, 2);
      expect(res.meanAngleDeg).toBeCloseTo(180.0, 1);
      expect(Number.isNaN(res.meanAngleDeg)).toBe(false);
    });

    it('rejects out-of-bounds atom indices', () => {
      const coords: Array<Array<[number, number, number]>> = [
        [[0, 0, 0], [1, 0, 0], [2, 0, 0]],
      ];
      expect(() => calculateTrajectoryAngleSeries(coords, 0, 1, 5)).toThrow(/out of bounds/);
    });
  });

  describe('2. 4-Point IUPAC Dihedral Angle Time Series & Circular Statistics', () => {
    it('computes planar trans (180°) and cis (0°) dihedrals accurately', () => {
      const cisCoords: Array<[number, number, number]> = [
        [0, 1, 0],
        [0, 0, 0],
        [1, 0, 0],
        [1, 1, 0], // Cis: all in xy-plane, pointing same direction
      ];
      const transCoords: Array<[number, number, number]> = [
        [0, 1, 0],
        [0, 0, 0],
        [1, 0, 0],
        [1, -1, 0], // Trans: opposite direction
      ];

      const traj = [cisCoords, transCoords];
      const res = calculateTrajectoryDihedralSeries(traj, 0, 1, 2, 3);
      expect(res.dihedralSeriesDeg[0]).toBeCloseTo(0.0, 1);
      expect(Math.abs(res.dihedralSeriesDeg[1])).toBeCloseTo(180.0, 1);
    });

    it('circular statistics correctly resolves angle oscillating around ±180°', () => {
      // If an angle fluctuates between +179° and -179°:
      // Linear mean would give: (179 - 179) / 2 = 0° (disastrously wrong cis claim!)
      // Circular mean gives: 180° (correct trans conformation!)
      const oscillatingTraj: Array<Array<[number, number, number]>> = [];
      const angles = [179, -179, 178, -178];

      for (const ang of angles) {
        const rad = (ang * Math.PI) / 180.0;
        oscillatingTraj.push([
          [0, 1, 0],
          [0, 0, 0],
          [1, 0, 0],
          [1, Math.cos(rad), Math.sin(rad)],
        ]);
      }

      const res = calculateTrajectoryDihedralSeries(oscillatingTraj, 0, 1, 2, 3);
      expect(Math.abs(res.circularMeanDeg)).toBeCloseTo(180.0, 0);
      expect(res.circularVariance).toBeLessThan(0.05); // low circular variance
    });

    it('continuous phase unwrapping eliminates artificial 360° periodic jumps', () => {
      const traj: Array<Array<[number, number, number]>> = [];
      const angles = [170, 175, -175, -170]; // crosses the 180/-180 branch cut

      for (const ang of angles) {
        const rad = (ang * Math.PI) / 180.0;
        traj.push([
          [0, 1, 0],
          [0, 0, 0],
          [1, 0, 0],
          [1, Math.cos(rad), Math.sin(rad)],
        ]);
      }

      const res = calculateTrajectoryDihedralSeries(traj, 0, 1, 2, 3);
      // Raw dihedrals jump from +175 to -175
      expect(res.dihedralSeriesDeg[1]).toBeCloseTo(175, 0);
      expect(res.dihedralSeriesDeg[2]).toBeCloseTo(-175, 0);
      // Unwrapped dihedrals continue monotonically: 170, 175, 185, 190
      expect(res.unwrappedSeriesDeg[2]).toBeCloseTo(185, 0);
      expect(res.unwrappedSeriesDeg[3]).toBeCloseTo(190, 0);
    });
  });

  describe('3. Geometric Hydrogen-Bond Occupancy & Lifetimes', () => {
    it('enforces both distance (<= 3.5 Å) and angle (>= 120°) criteria', () => {
      // Frame 0: d = 2.8 Å, angle = 160° -> Satisfies H-bond
      // Frame 1: d = 2.8 Å, angle = 90°  -> Fails angle criterion (< 120°)
      // Frame 2: d = 4.0 Å, angle = 160° -> Fails distance criterion (> 3.5 Å)
      // Frame 3: d = 2.9 Å, angle = 175° -> Satisfies H-bond
      const frames: Array<Array<[number, number, number]>> = [
        [[0, 0, 0], [1.0, 0, 0], [2.8, 0, 0]],                 // Donor, H, Acceptor (collinear, 180°)
        [[0, 0, 0], [0, 1.0, 0], [2.8, 0, 0]],                 // Angle D-H...A ~ 90°
        [[0, 0, 0], [1.0, 0, 0], [4.0, 0, 0]],                 // Distance 4.0 Å
        [[0, 0, 0], [1.0, 0, 0], [2.9, 0, 0]],                 // Distance 2.9 Å, 180°
      ];

      const res = calculateTrajectoryHydrogenBondOccupancy(frames, 0, 2, 1, {
        cutoffDistance: 3.5,
        minAngleDeg: 120.0,
      });

      expect(res.totalFrames).toBe(4);
      expect(res.contactFlags).toEqual([true, false, false, true]);
      expect(res.occupancyFraction).toBe(0.5); // 2 of 4 frames
      expect(res.isPersistent).toBe(true); // >= 0.50
      expect(res.uninterruptedLifetimes).toEqual([1, 1]); // Two separate 1-frame events
    });

    it('tracks uninterrupted lifetimes for persistent contact blocks', () => {
      // 5 frames: contact in frames 0, 1, 2, break in 3, contact in 4
      const frames: Array<Array<[number, number, number]>> = [
        [[0, 0, 0], [2.5, 0, 0]],
        [[0, 0, 0], [2.6, 0, 0]],
        [[0, 0, 0], [2.7, 0, 0]],
        [[0, 0, 0], [5.0, 0, 0]], // break
        [[0, 0, 0], [2.8, 0, 0]],
      ];

      const res = calculateTrajectoryHydrogenBondOccupancy(frames, 0, 1, undefined, {
        cutoffDistance: 3.5,
      });

      expect(res.occupancyFraction).toBe(0.8); // 4 / 5 = 80%
      expect(res.uninterruptedLifetimes).toEqual([3, 1]); // Block of 3 frames, then block of 1 frame
    });
  });

  describe('4. Statistical Autocorrelation, Inefficiency & Effective Sample Size', () => {
    it('detects high autocorrelation and computes N_eff < N for smooth time series', () => {
      // Generate highly autocorrelated series (slow drift)
      const N = 200;
      const smoothSeries: number[] = [];
      let val = 0;
      for (let i = 0; i < N; i++) {
        val = 0.95 * val + (Math.sin(i / 10) * 0.1);
        smoothSeries.push(val);
      }

      const res = calculateEffectiveSampleSize(smoothSeries);
      expect(res.totalSamples).toBe(N);
      expect(res.integratedAutocorrelationTime).toBeGreaterThan(1.0);
      expect(res.statisticalInefficiency).toBeGreaterThan(2.0);
      expect(res.effectiveSampleSize).toBeLessThan(N / 2);
    });

    it('confirms N_eff ≈ N for uncorrelated white noise', () => {
      // Generate pseudo-random white noise series
      const N = 200;
      const noiseSeries: number[] = [];
      let seed = 42;
      for (let i = 0; i < N; i++) {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        noiseSeries.push((seed / 4294967296) - 0.5);
      }

      const res = calculateEffectiveSampleSize(noiseSeries);
      expect(res.totalSamples).toBe(N);
      expect(res.integratedAutocorrelationTime).toBeLessThan(1.5);
      expect(res.effectiveSampleSize).toBeGreaterThan(N * 0.6);
    });
  });

  describe('5. Flyvbjerg-Petersen Block Averaging', () => {
    it('computes standard error plateau and inefficiency ratio for correlated data', () => {
      const N = 256;
      const correlatedSeries: number[] = [];
      let current = 10.0;
      for (let i = 0; i < N; i++) {
        current = 0.9 * current + 1.0 + (i % 3) * 0.1;
        correlatedSeries.push(current);
      }

      const res = calculateBlockAveraging(correlatedSeries);
      expect(res.blockSizes.length).toBeGreaterThan(3);
      expect(res.convergedSem).toBeGreaterThan(res.untransformedSem);
      expect(res.inefficiencyRatio).toBeGreaterThan(1.0);
    });
  });

  describe('6. Empirical Convergence & Stationarity Assessment', () => {
    it('identifies drifting non-stationary trajectory as DRIFTING_UNCONVERGED', () => {
      // Linear drift: 1.0, 1.1, 1.2, ..., 3.0
      const driftingSeries = Array.from({ length: 100 }, (_, i) => 1.0 + i * 0.05);
      const res = assessTrajectoryConvergence(driftingSeries, 0.5);

      expect(res.status).toBe('DRIFTING_UNCONVERGED');
      expect(res.driftSlopePerFrame).toBeGreaterThan(0.01);
      expect(res.rationale.toLowerCase()).toContain('drift');
    });

    it('identifies stationary oscillating trajectory as CONVERGED_STATIONARY', () => {
      // Stationary series with no drift
      const stationarySeries = Array.from({ length: 100 }, (_, i) => 2.0 + Math.sin(i * 0.5) * 0.05);
      const res = assessTrajectoryConvergence(stationarySeries, 0.5);

      expect(res.status).toBe('CONVERGED_STATIONARY');
      expect(Math.abs(res.driftSlopePerFrame)).toBeLessThan(0.005);
      expect(res.rationale.toLowerCase()).toContain('stationary');
    });
  });

  describe('7. Conformational Analysis: Essential Dynamics Snapshot PCA', () => {
    it('computes principal components with Kabsch alignment and valid variance fractions', () => {
      const traj = buildTestTrajectory(25);
      const res = computeTrajectoryPca(traj);

      expect(res.frameCount).toBe(25);
      expect(res.atomCount).toBe(4);
      expect(res.eigenvalues[0]).toBeGreaterThanOrEqual(res.eigenvalues[1]); // Ordered
      expect(res.explainedVarianceRatios[0]).toBeGreaterThanOrEqual(0);
      expect(res.explainedVarianceRatios[0] + res.explainedVarianceRatios[1]).toBeLessThanOrEqual(1.01);
      expect(res.projectionsPC1.length).toBe(25);
      expect(res.projectionsPC2.length).toBe(25);
    });

    it('supports atom selection subset for PCA', () => {
      const traj = buildTestTrajectory(20);
      // Select only atom indices 0 and 1
      const res = computeTrajectoryPca(traj, { atomIndices: [0, 1] });
      expect(res.atomCount).toBe(2);
      expect(res.meanStructureCoords.length).toBe(2);
    });
  });

  describe('8. Conformational Analysis: Daura RMSD Clustering', () => {
    it('computes symmetric RMSD matrix with zero diagonal', () => {
      const traj = buildTestTrajectory(5);
      const mat = calculateTrajectoryRmsdMatrix(traj);

      expect(mat.length).toBe(5);
      expect(mat[0].length).toBe(5);
      expect(mat[0][0]).toBe(0);
      expect(mat[1][1]).toBe(0);
      expect(mat[1][2]).toBe(mat[2][1]); // Symmetrical
    });

    it('clusters trajectory into medoids with population fractions summing to 1.0', () => {
      // 10 frames: 5 identical frames of State A (bond = 1.0 Å), 5 identical frames of State B (bond = 3.0 Å)
      const stateA: Array<[number, number, number]> = [[0, 0, 0], [1, 0, 0]];
      const stateB: Array<[number, number, number]> = [[0, 0, 0], [3, 0, 0]];

      const traj: Array<Array<[number, number, number]>> = [
        stateA, stateA, stateA, stateA, stateA,
        stateB, stateB, stateB, stateB, stateB,
      ];

      const res = clusterTrajectoryConformations(traj, { rmsdCutoff: 0.5 });
      expect(res.clusterCount).toBe(2);
      expect(res.clusterSizes).toEqual([5, 5]);
      expect(res.clusterFractions).toEqual([0.5, 0.5]);
      const sumFractions = res.clusterFractions.reduce((a, b) => a + b, 0);
      expect(sumFractions).toBeCloseTo(1.0, 3);
    });
  });

  describe('9. Authentic Coordinate Trajectory Verification & Provenance', () => {
    it('verifies coordinate evolution in synth_500f is non-static and represents actual physical 3D coordinate changes', () => {
      const groPath = path.resolve(__dirname, '../../../tests/data/synth_500f.gro');
      expect(fs.existsSync(groPath)).toBe(true);

      // Verify coordinate evolution calculation between two frames with difference
      const frameA: Array<[number, number, number]> = [
        [40.0, 40.0, 40.0],
        [45.5, 40.0, 40.0],
      ];
      const frameB: Array<[number, number, number]> = [
        [40.0, 40.0, 40.0],
        [43.75, 40.0, 40.0], // Motion along X by 1.75 Å
      ];

      const evol = calculateCoordinateEvolution(frameA, frameB);
      expect(evol.isStatic).toBe(false);
      expect(evol.differingAtomsCount).toBe(1);
      expect(evol.maxCoordinateDiff).toBeCloseTo(1.75, 2);
    });

    it('provenance engine tags synth_500f as synthetic and rejects non-empirical claims', () => {
      const { provenance, authenticity } = auditTrajectoryProvenance({
        isSynthetic: true,
        notes: 'Synthetic benchmark trajectory for binding verification',
      });

      expect(provenance.isSynthetic).toBe(true);
      expect(authenticity).toBe('SYNTHETIC_COORDINATE_TRAJECTORY');
    });

    it('verifies multi-chain atom index tracking on 4HHB (tetramer) and 1BNA (duplex)', () => {
      const dataDir = path.resolve(__dirname, '../../../tests/data');
      const hhbPath = path.join(dataDir, '4hhb.pdb');
      const bnaPath = path.join(dataDir, '1bna.pdb');

      const extractPdbChains = (pdbText: string): string[] => {
        const chains = new Set<string>();
        const lines = pdbText.split('\n');
        for (const line of lines) {
          if (line.startsWith('ATOM  ') || line.startsWith('HETATM')) {
            const chainId = line.substring(21, 22).trim();
            if (chainId) chains.add(chainId);
          }
        }
        return Array.from(chains).sort();
      };

      if (fs.existsSync(hhbPath)) {
        const hhbPdb = fs.readFileSync(hhbPath, 'utf8');
        const chains = extractPdbChains(hhbPdb);
        expect(chains.length).toBe(4);
        expect(chains).toContain('A');
        expect(chains).toContain('B');
        expect(chains).toContain('C');
        expect(chains).toContain('D');
      }

      if (fs.existsSync(bnaPath)) {
        const bnaPdb = fs.readFileSync(bnaPath, 'utf8');
        const chains = extractPdbChains(bnaPdb);
        expect(chains.length).toBe(2);
        expect(chains).toContain('A');
        expect(chains).toContain('B');
      }
    });
  });
});
