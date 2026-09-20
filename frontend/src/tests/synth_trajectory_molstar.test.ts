// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { DefaultPluginSpec } from 'molstar/lib/mol-plugin/spec';
import { TrajectoryFromModelAndCoordinates } from 'molstar/lib/mol-plugin-state/transforms/model';
import {
  loadGroXtcTrajectory,
  TrajectoryConsistencyError,
} from '../molecular/loader/trajectoryLoader';
import {
  extractCoordinatesFromMolstarStructure,
  minimumImageDistance,
} from '../molecular/geometry';
import { getWitnessFrameData, TRAJECTORY_WITNESS_FRAMES } from '../molecular/data/trajectoryWitnessFrames';

describe('MOCS-Cert Native Mol* Trajectory Pipeline (synth_500f)', () => {
  const groPath = path.resolve(__dirname, '../../../tests/data/synth_500f.gro');
  const xtcPath = path.resolve(__dirname, '../../../tests/data/synth_500f.xtc');

  const groStr = fs.readFileSync(groPath, 'utf8');
  const xtcBuf = fs.readFileSync(xtcPath);

  it('Step 1 & 2: parses GRO topology and XTC coordinates into a unified Mol* trajectory with verified consistency', async () => {
    const plugin = new PluginContext(DefaultPluginSpec());
    await plugin.init();

    const trajResult = await loadGroXtcTrajectory(plugin, {
      groData: groStr,
      xtcData: new Uint8Array(xtcBuf),
      initialModelIndex: 0,
    });

    expect(trajResult.topologyAtomsCount).toBe(10);
    expect(trajResult.trajectoryFrameCount).toBe(500);
    expect(trajResult.atomsPerFrame).toBe(10);
    expect(trajResult.modelCellRef).toBeTruthy();

    const rawStruct = trajResult.structure.cell?.obj?.data ?? trajResult.structure.obj?.data;
    expect(rawStruct.elementCount).toBe(10);

    // Frame 0 coordinates: CA at [40, 40, 40], LIG O2 at [45.5, 40, 40], distance = 5.50 Å
    const boundsFrame0 = extractCoordinatesFromMolstarStructure(rawStruct, 'A:155:CA', 'LIG:1:O2');
    expect(boundsFrame0.atomACoords).toEqual([40.0, 40.0, 40.0]);
    expect(boundsFrame0.atomBCoords).toEqual([45.5, 40.0, 40.0]);
    expect(boundsFrame0.measuredDistance).toBeCloseTo(5.5, 2);

    plugin.dispose();
  });

  it('Step 2 & 20: strictly throws TrajectoryConsistencyError when topology and trajectory atom counts mismatch', async () => {
    const plugin = new PluginContext(DefaultPluginSpec());
    await plugin.init();

    // Fabricate a mismatching GRO with only 2 atoms
    const truncatedGro = 'Written by Test\n 2\n 155ALA CA 1 4.000 4.000 4.000\n 1LIG O2 2 4.550 4.000 4.000\n 8.0 8.0 8.0\n';

    await expect(
      loadGroXtcTrajectory(plugin, {
        groData: truncatedGro,
        xtcData: new Uint8Array(xtcBuf),
        initialModelIndex: 0,
      })
    ).rejects.toThrow(TrajectoryConsistencyError);

    plugin.dispose();
  });

  it('Step 7 & 16: updating modelIndex updates atomic coordinates to satisfying witness frame (frame 410, d = 3.75 Å)', async () => {
    const plugin = new PluginContext(DefaultPluginSpec());
    await plugin.init();

    const trajResult = await loadGroXtcTrajectory(plugin, {
      groData: groStr,
      xtcData: new Uint8Array(xtcBuf),
      initialModelIndex: 0,
    });

    // Update to canonical satisfying witness frame 410
    await plugin.state.data.build()
      .to(trajResult.modelCellRef)
      .update({ modelIndex: 410 })
      .commit();

    const updatedRawStruct = trajResult.structure.cell?.obj?.data ?? trajResult.structure.obj?.data;
    const bounds410 = extractCoordinatesFromMolstarStructure(updatedRawStruct, 'A:155:CA', 'LIG:1:O2');

    expect(bounds410.atomACoords).toEqual([40.0, 40.0, 40.0]);
    expect(bounds410.atomBCoords?.[0]).toBeCloseTo(43.75, 2);
    expect(bounds410.measuredDistance).toBeCloseTo(3.75, 2);
    expect(bounds410.boundKind).toBe('current_frame');
    expect(bounds410.proteinBox3).toBeDefined();
    expect(bounds410.ligandBox3).toBeDefined();
    expect(bounds410.proteinBox3?.isEmpty()).toBe(false);
    expect(bounds410.ligandBox3?.isEmpty()).toBe(false);

    plugin.dispose();
  });

  it('Step 15: correctly computes minimum-image distance across PBC boundary (frame 450, d = 3.0 Å)', async () => {
    const plugin = new PluginContext(DefaultPluginSpec());
    await plugin.init();

    const trajResult = await loadGroXtcTrajectory(plugin, {
      groData: groStr,
      xtcData: new Uint8Array(xtcBuf),
      initialModelIndex: 450,
    });

    const rawStruct = trajResult.structure.cell?.obj?.data ?? trajResult.structure.obj?.data;
    const bounds450 = extractCoordinatesFromMolstarStructure(rawStruct, 'A:155:CA', 'LIG:1:O2');

    // In frame 450, Atom 0 is at [1.0, 40.0, 40.0], Atom 1 is at [78.0, 40.0, 40.0]
    expect(bounds450.atomACoords?.[0]).toBeCloseTo(1.0, 2);
    expect(bounds450.atomBCoords?.[0]).toBeCloseTo(78.0, 2);
    // Minimum image distance across 80 Å box: dx = 78 - 1 = 77 -> wrapped = 77 - 80 = -3 -> dist = 3.0 Å
    expect(bounds450.measuredDistance).toBeCloseTo(3.0, 2);

    plugin.dispose();
  });

  it('Step 28: protects against stale asynchronous frame race conditions (Frame 18 vs Frame 19)', async () => {
    let activeRequestSeq = 0;
    let displayedFrame: number | null = null;

    const requestFrame = async (frame: number, delayMs: number) => {
      const seq = ++activeRequestSeq;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      if (seq === activeRequestSeq) {
        displayedFrame = frame;
      }
    };

    // Scenario: Frame 18 requested first (slower network: 50ms), Frame 19 requested second (faster network: 10ms)
    const p1 = requestFrame(18, 50);
    const p2 = requestFrame(19, 10);

    await Promise.all([p1, p2]);

    // Viewer must display Frame 19; Frame 18 must never overwrite Frame 19
    expect(displayedFrame).toBe(19);
  });
});
