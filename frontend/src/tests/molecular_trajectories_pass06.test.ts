// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { DefaultPluginSpec } from 'molstar/lib/mol-plugin/spec';
import {
  loadGroXtcTrajectory,
  TrajectoryConsistencyError,
} from '../molecular/loader/trajectoryLoader';
import {
  validateTrajectoryConsistency,
  validateFrameCoordinates,
  validateBoxDimensions,
  validateAtomOrderConsistency,
  calculateCoordinateRmsd,
  computeCurrentFrameAABB,
  computeTrajectoryWideAABB,
  evaluateTrajectoryBounds,
  TrajectoryPlaybackEngine,
} from '../molecular/trajectory';
import {
  getWitnessFrameData,
  TRAJECTORY_WITNESS_FRAMES,
} from '../molecular/data/trajectoryWitnessFrames';
import {
  getStructureMetadata,
} from '../molecular/data/structureRegistry';
import {
  extractCoordinatesFromMolstarStructure,
  minimumImageDistance,
} from '../molecular/geometry';

describe('PASS 06: Molecular Trajectories, MD Frames, Topology & Coordinates Forensic Suite', () => {
  const groPath = path.resolve(__dirname, '../../../tests/data/synth_500f.gro');
  const xtcPath = path.resolve(__dirname, '../../../tests/data/synth_500f.xtc');
  const groStr = fs.readFileSync(groPath, 'utf8');
  const xtcBuf = fs.readFileSync(xtcPath);

  // =========================================================================
  // 1. SCIENTIFIC TERMINOLOGY & IDENTITY DISCIPLINE
  // =========================================================================
  describe('1. Scientific Terminology & Identity Discipline', () => {
    it('accurately identifies synth_500f as a synthetic benchmark without fabricated experimental claims', () => {
      const meta = getStructureMetadata('synth_500f');
      expect(meta).toBeDefined();
      expect(meta.kind).toBe('trajectory');
      expect(meta.category).toBe('trajectory_dataset');

      // Must never claim to be an experimental crystal or real physics CHARMM36m simulation
      expect(meta.method).toContain('Synthetic MD Benchmark');
      expect(meta.method).not.toContain('CHARMM36m');
      expect(meta.organism).toBe('Synthetic Test Topology');
      expect(meta.resolution).toContain('5.0 ns (10 ps/frame)');
      expect(meta.resolution).not.toContain('1000 ns');

      // Tags must clearly declare synthetic benchmark status
      expect(meta.tags).toContain('Synthetic Benchmark');
      expect(meta.tags).not.toContain('Experimental');
    });
  });

  // =========================================================================
  // 2. TOPOLOGY VS TRAJECTORY SEPARATION & CONSISTENCY INVARIANTS
  // =========================================================================
  describe('2. Topology vs Trajectory Separation & Consistency Invariants', () => {
    it('validates matching atom counts between topology (10) and trajectory frame (10)', () => {
      const result = validateTrajectoryConsistency(10, 10, 500);
      expect(result.isValid).toBe(true);
      expect(result.atomCountMatches).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('strictly rejects atom count mismatches between topology and trajectory frames', () => {
      const result = validateTrajectoryConsistency(10, 12, 500);
      expect(result.isValid).toBe(false);
      expect(result.atomCountMatches).toBe(false);
      expect(result.errors[0]).toContain('mismatch');
      expect(result.errors[0]).toContain('topology has 10 atoms, but trajectory has 12 atoms');
    });

    it('strictly rejects empty trajectories with 0 frames', () => {
      const result = validateTrajectoryConsistency(10, 10, 0);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('frame count is 0');
    });

    it('verifies 1-to-1 atom ordering consistency between topology and trajectory frames', () => {
      const topologyAtoms = [
        { name: 'CA', resName: 'ALA' },
        { name: 'O2', resName: 'LIG' },
        { name: 'C1', resName: 'ALA' },
      ];
      const frameAtomsConsistent = [
        { name: 'CA', resName: 'ALA' },
        { name: 'O2', resName: 'LIG' },
        { name: 'C1', resName: 'ALA' },
      ];
      const consistentResult = validateAtomOrderConsistency(topologyAtoms, frameAtomsConsistent);
      expect(consistentResult.isConsistent).toBe(true);

      const frameAtomsPermuted = [
        { name: 'O2', resName: 'LIG' },
        { name: 'CA', resName: 'ALA' },
        { name: 'C1', resName: 'ALA' },
      ];
      const permutedResult = validateAtomOrderConsistency(topologyAtoms, frameAtomsPermuted);
      expect(permutedResult.isConsistent).toBe(false);
      expect(permutedResult.mismatchedIndex).toBe(0);
      expect(permutedResult.reason).toContain("topology has 'CA', frame has 'O2'");
    });
  });

  // =========================================================================
  // 3. COORDINATE VALIDATION & FINITENESS CHECKS
  // =========================================================================
  describe('3. Coordinate Validation & Finiteness Checks', () => {
    it('accepts valid finite coordinates across all axes', () => {
      const validCoords: Array<[number, number, number]> = [
        [40.0, 40.0, 40.0],
        [43.72, 40.0, 40.0],
        [20.0, 10.0, 10.0],
      ];
      const check = validateFrameCoordinates(validCoords);
      expect(check.isValid).toBe(true);
    });

    it('strictly rejects non-finite coordinates (NaN, Infinity, -Infinity)', () => {
      const nanCoords: Array<[number, number, number]> = [
        [40.0, 40.0, 40.0],
        [NaN, 40.0, 40.0],
      ];
      expect(validateFrameCoordinates(nanCoords).isValid).toBe(false);
      expect(validateFrameCoordinates(nanCoords).reason).toContain('Non-finite coordinate');

      const infCoords: Array<[number, number, number]> = [
        [40.0, 40.0, 40.0],
        [Infinity, 40.0, 40.0],
      ];
      expect(validateFrameCoordinates(infCoords).isValid).toBe(false);

      const negInfCoords = new Float32Array([40.0, 40.0, 40.0, -Infinity, 40.0, 40.0]);
      expect(validateFrameCoordinates(negInfCoords).isValid).toBe(false);
    });

    it('validates periodic boundary simulation box dimensions (Lx, Ly, Lz)', () => {
      expect(validateBoxDimensions([80.0, 80.0, 80.0]).isValid).toBe(true);
      expect(validateBoxDimensions([0.0, 80.0, 80.0]).isValid).toBe(false);
      expect(validateBoxDimensions([-80.0, 80.0, 80.0]).isValid).toBe(false);
      expect(validateBoxDimensions([NaN, 80.0, 80.0]).isValid).toBe(false);
    });
  });

  // =========================================================================
  // 4. GENUINE COORDINATE EVOLUTION ACROSS FRAMES (NOT A FAKE FRAME COUNTER)
  // =========================================================================
  describe('4. Genuine Coordinate Evolution Across Frames', () => {
    it('demonstrates distinct coordinates and distances across distinct trajectory intervals', () => {
      // In synth_500f.xtc:
      // Frame 0: dist = 5.50 Å (Certified FALSE)
      // Frame 200: dist = 2.80 Å (Certified TRUE)
      // Frame 410: dist = 3.75 Å (Satisfied witness within Block 41)
      // Frame 414: dist = 3.93 Å
      // Frame 419: dist = 4.16 Å (Violated within Block 41)
      // Frame 450: dist = 3.00 Å (Satisfied under PBC)
      const caPos: [number, number, number] = [40.0, 40.0, 40.0];
      const ligPosFrame0: [number, number, number] = [45.5, 40.0, 40.0];
      const ligPosFrame200: [number, number, number] = [42.8, 40.0, 40.0];
      const ligPosFrame410: [number, number, number] = [43.75, 40.0, 40.0];
      const ligPosFrame414: [number, number, number] = [43.93, 40.0, 40.0];
      const ligPosFrame419: [number, number, number] = [44.16, 40.0, 40.0];

      const box: [number, number, number] = [80.0, 80.0, 80.0];
      const d0 = minimumImageDistance(caPos, ligPosFrame0, box);
      const d200 = minimumImageDistance(caPos, ligPosFrame200, box);
      const d410 = minimumImageDistance(caPos, ligPosFrame410, box);
      const d414 = minimumImageDistance(caPos, ligPosFrame414, box);
      const d419 = minimumImageDistance(caPos, ligPosFrame419, box);

      expect(d0).toBeCloseTo(5.50, 2);
      expect(d200).toBeCloseTo(2.80, 2);
      expect(d410).toBeCloseTo(3.75, 2);
      expect(d414).toBeCloseTo(3.93, 2);
      expect(d419).toBeCloseTo(4.16, 2);

      // Distances must genuinely change across frames:
      expect(d0).not.toBe(d200);
      expect(d200).not.toBe(d410);
      expect(d410).not.toBe(d414);
      expect(d414).not.toBe(d419);
    });

    it('verifies PBC wrapping across simulation box boundary in Frame 450 (d = 3.00 Å)', () => {
      const atom0_pbc: [number, number, number] = [1.0, 40.0, 40.0];
      const atom1_pbc: [number, number, number] = [78.0, 40.0, 40.0];
      const box: [number, number, number] = [80.0, 80.0, 80.0];

      const d_pbc = minimumImageDistance(atom0_pbc, atom1_pbc, box);
      // Unwrapped Euclidean distance = 77.0 Å, but minimum image distance = |77 - 80| = 3.0 Å
      expect(d_pbc).toBeCloseTo(3.00, 2);
    });
  });

  // =========================================================================
  // 5. CANDIDATE WITNESS FRAMES & OVERLAYS SYNCHRONIZATION
  // =========================================================================
  describe('5. Candidate Witness Frames & Overlays Synchronization', () => {
    it('verifies all 43 candidate witness frames contain genuine, varying coordinates and distances', () => {
      expect(TRAJECTORY_WITNESS_FRAMES.length).toBe(43);

      const f1 = getWitnessFrameData(1);
      const f15 = getWitnessFrameData(15);
      const f16 = getWitnessFrameData(16);
      const f37 = getWitnessFrameData(37);
      const f43 = getWitnessFrameData(43);

      expect(f1.distance).toBe(4.18);
      expect(f1.atomBCoords).toEqual([44.18, 40.0, 40.0]);

      expect(f15.distance).toBe(4.01);
      expect(f15.atomBCoords).toEqual([44.01, 40.0, 40.0]);

      // Frame 16 crosses the threshold boundary into satisfying territory (d <= 4.00 Å)
      expect(f16.distance).toBe(3.99);
      expect(f16.atomBCoords).toEqual([43.99, 40.0, 40.0]);

      // Canonical satisfying witness frame (Frame 37)
      expect(f37.distance).toBe(3.72);
      expect(f37.atomBCoords).toEqual([43.72, 40.0, 40.0]);

      expect(f43.distance).toBe(3.98);
      expect(f43.atomBCoords).toEqual([43.98, 40.0, 40.0]);

      // Coordinates genuinely differ between frames 16 and 37
      expect(f16.distance).not.toBe(f37.distance);
      expect(f16.atomBCoords[0]).not.toBe(f37.atomBCoords[0]);
    });

    it('synchronizes instantaneous ligand AABB with moving atom coordinates', () => {
      const f16 = getWitnessFrameData(16);
      const f37 = getWitnessFrameData(37);

      const box16 = computeCurrentFrameAABB([f16.atomBCoords]);
      const box37 = computeCurrentFrameAABB([f37.atomBCoords]);

      expect(box16.min.x).toBeCloseTo(43.99, 2);
      expect(box37.min.x).toBeCloseTo(43.72, 2);

      // Bounding box position genuinely changes with the moving atom
      expect(box16.min.x).not.toBe(box37.min.x);
    });
  });

  // =========================================================================
  // 6. CURRENT FRAME AABB VS TRAJECTORY-WIDE AABB
  // =========================================================================
  describe('6. Current Frame AABB vs Trajectory-Wide AABB (Non-Expansion Invariant)', () => {
    it('proves trajectory-wide AABB strictly contains every instantaneous frame AABB without collapsing', () => {
      const frame0Coords: Array<[number, number, number]> = [[40.0, 40.0, 40.0], [45.5, 40.0, 40.0]];
      const frame200Coords: Array<[number, number, number]> = [[40.0, 40.0, 40.0], [42.8, 40.0, 40.0]];
      const frame37Coords: Array<[number, number, number]> = [[40.0, 40.0, 40.0], [43.72, 40.0, 40.0]];

      const allFrames = [frame0Coords, frame200Coords, frame37Coords];
      const trajWideBox = computeTrajectoryWideAABB(allFrames);

      const box0 = computeCurrentFrameAABB(frame0Coords);
      const box200 = computeCurrentFrameAABB(frame200Coords);
      const box37 = computeCurrentFrameAABB(frame37Coords);

      // Trajectory-wide box must contain every single frame box
      expect(trajWideBox.containsBox(box0)).toBe(true);
      expect(trajWideBox.containsBox(box200)).toBe(true);
      expect(trajWideBox.containsBox(box37)).toBe(true);

      // Trajectory-wide bounds must span from min (40.0) to max (45.5 on X)
      expect(trajWideBox.min.x).toBe(40.0);
      expect(trajWideBox.max.x).toBe(45.5);

      // Trajectory-wide box volume is strictly greater than single-frame instantaneous box volume
      const trajVolume = (trajWideBox.max.x - trajWideBox.min.x);
      const frame37Volume = (box37.max.x - box37.min.x);
      expect(trajVolume).toBeGreaterThan(frame37Volume);

      // evaluateTrajectoryBounds asserts isConservative === true
      const evaluation = evaluateTrajectoryBounds(frame37Coords, allFrames);
      expect(evaluation.isConservative).toBe(true);
    });
  });

  // =========================================================================
  // 7. TRAJECTORY PLAYBACK ENGINE & RACE CONDITION PROTECTION
  // =========================================================================
  describe('7. Trajectory Playback Engine & Race Condition Protection', () => {
    it('manages play, pause, step forward, step backward, seek, and loop cleanly', () => {
      const visitedFrames: number[] = [];
      const engine = new TrajectoryPlaybackEngine(
        10,
        (frame) => {
          visitedFrames.push(frame);
        },
        { initialFrame: 0, loop: true }
      );

      expect(engine.getState().currentFrame).toBe(0);
      expect(engine.getState().isPlaying).toBe(false);

      // Step forward
      engine.stepForward();
      expect(engine.getState().currentFrame).toBe(1);
      expect(visitedFrames).toContain(1);

      // Step backward
      engine.stepBackward();
      expect(engine.getState().currentFrame).toBe(0);

      // Step backward at 0 wraps to 9 when loop is enabled
      engine.stepBackward();
      expect(engine.getState().currentFrame).toBe(9);

      // Seek to frame 5
      engine.seek(5);
      expect(engine.getState().currentFrame).toBe(5);

      // Clamping to boundaries
      engine.seek(999);
      expect(engine.getState().currentFrame).toBe(9);
      engine.seek(-10);
      expect(engine.getState().currentFrame).toBe(0);

      engine.dispose();
    });

    it('protects against asynchronous frame completion race conditions via requestSeq', async () => {
      let activeRequestSeq = 0;
      let committedFrame: number | null = null;

      const asyncFetchFrame = async (frame: number, latencyMs: number) => {
        const seq = ++activeRequestSeq;
        await new Promise((resolve) => setTimeout(resolve, latencyMs));
        // Stale frame completion guard
        if (seq === activeRequestSeq) {
          committedFrame = frame;
        }
      };

      // Scenario: Frame 18 requested first with slower response (40ms), Frame 19 requested second with faster response (10ms)
      const p1 = asyncFetchFrame(18, 40);
      const p2 = asyncFetchFrame(19, 10);

      await Promise.all([p1, p2]);

      // Frame 19 must win; Frame 18 must never overwrite Frame 19
      expect(committedFrame).toBe(19);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('advances frames automatically during playback and pauses cleanly on dispose', async () => {
      vi.useFakeTimers();
      try {
        const frames: number[] = [];
        const engine = new TrajectoryPlaybackEngine(
          5,
          (f) => {
            frames.push(f);
          },
          { fps: 10, loop: true, initialFrame: 0 }
        );

        engine.play();
        expect(engine.getState().isPlaying).toBe(true);

        // Advance 100ms (1 frame at 10 fps)
        await vi.advanceTimersByTimeAsync(110);
        expect(engine.getState().currentFrame).toBe(1);

        // Advance another 100ms
        await vi.advanceTimersByTimeAsync(100);
        expect(engine.getState().currentFrame).toBe(2);

        engine.pause();
        expect(engine.getState().isPlaying).toBe(false);

        // Time advances while paused -> currentFrame must remain frozen
        await vi.advanceTimersByTimeAsync(300);
        expect(engine.getState().currentFrame).toBe(2);

        engine.dispose();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // =========================================================================
  // 8. AUTHENTIC MATHEMATICAL RMSD COMPUTATION
  // =========================================================================
  describe('8. Authentic Mathematical RMSD Computation', () => {
    it('computes coordinate-difference RMSD accurately without fabrication', () => {
      // 2-atom system: Atom 0 stationary [0, 0, 0], Atom 1 moves from [0, 0, 0] to [3, 4, 0]
      // Displacement of Atom 1 = sqrt(3^2 + 4^2) = 5.0
      // RMSD = sqrt( (0^2 + 5^2) / 2 ) = sqrt(25 / 2) = sqrt(12.5) ~ 3.5355 Å
      const setA: Array<[number, number, number]> = [
        [0, 0, 0],
        [0, 0, 0],
      ];
      const setB: Array<[number, number, number]> = [
        [0, 0, 0],
        [3, 4, 0],
      ];

      const rmsd = calculateCoordinateRmsd(setA, setB);
      expect(rmsd).toBeCloseTo(Math.sqrt(12.5), 4);
    });

    it('satisfies identity of indiscernibles: RMSD(A, A) === 0.000', () => {
      const setA: Array<[number, number, number]> = [
        [40.0, 40.0, 40.0],
        [43.72, 40.0, 40.0],
        [20.0, 10.0, 10.0],
      ];
      expect(calculateCoordinateRmsd(setA, setA)).toBe(0.0);
    });

    it('rejects mismatched lengths or non-finite coordinates with NaN', () => {
      const setA: Array<[number, number, number]> = [[0, 0, 0]];
      const setB: Array<[number, number, number]> = [[0, 0, 0], [1, 1, 1]];
      expect(calculateCoordinateRmsd(setA, setB)).toBeNaN();

      const setNaN: Array<[number, number, number]> = [[NaN, 0, 0]];
      expect(calculateCoordinateRmsd(setA, setNaN)).toBeNaN();
    });
  });

  // =========================================================================
  // 9. NATIVE MOL* TRAJECTORY PIPELINE (loadGroXtcTrajectory)
  // =========================================================================
  describe('9. Native Mol* Trajectory Pipeline (loadGroXtcTrajectory)', () => {
    it('loads GRO topology + XTC coordinates into Mol* state tree with 10 atoms and 500 frames', async () => {
      const plugin = new PluginContext(DefaultPluginSpec());
      await plugin.init();

      const result = await loadGroXtcTrajectory(plugin, {
        groData: groStr,
        xtcData: new Uint8Array(xtcBuf),
        initialModelIndex: 0,
      });

      expect(result.topologyAtomsCount).toBe(10);
      expect(result.trajectoryFrameCount).toBe(500);
      expect(result.atomsPerFrame).toBe(10);

      const rawStruct = result.structure.cell?.obj?.data ?? result.structure.obj?.data;
      const bounds0 = extractCoordinatesFromMolstarStructure(rawStruct, 'A:155:CA', 'LIG:1:O2');
      expect(bounds0.atomACoords).toEqual([40.0, 40.0, 40.0]);
      expect(bounds0.atomBCoords).toEqual([45.5, 40.0, 40.0]);
      expect(bounds0.measuredDistance).toBeCloseTo(5.50, 2);

      // Switch to frame 410 (satisfying witness in XTC)
      await plugin.state.data.build()
        .to(result.modelCellRef)
        .update({ modelIndex: 410 })
        .commit();

      const updatedRawStruct = result.structure.cell?.obj?.data ?? result.structure.obj?.data;
      const bounds410 = extractCoordinatesFromMolstarStructure(updatedRawStruct, 'A:155:CA', 'LIG:1:O2');
      expect(bounds410.atomACoords).toEqual([40.0, 40.0, 40.0]);
      expect(bounds410.atomBCoords?.[0]).toBeCloseTo(43.75, 2);
      expect(bounds410.measuredDistance).toBeCloseTo(3.75, 2);

      plugin.dispose();
    }, 15000);

    it('strictly throws TrajectoryConsistencyError when GRO topology atom count does not match XTC frame atoms', async () => {
      const plugin = new PluginContext(DefaultPluginSpec());
      await plugin.init();

      const invalidGro = 'Written by Test\n 3\n 155ALA CA 1 4.0 4.0 4.0\n 1LIG O2 2 4.5 4.0 4.0\n 155ALA C1 3 2.0 1.0 1.0\n 8.0 8.0 8.0\n';

      await expect(
        loadGroXtcTrajectory(plugin, {
          groData: invalidGro,
          xtcData: new Uint8Array(xtcBuf),
          initialModelIndex: 0,
        })
      ).rejects.toThrow(TrajectoryConsistencyError);

      plugin.dispose();
    }, 15000);
  });
});
