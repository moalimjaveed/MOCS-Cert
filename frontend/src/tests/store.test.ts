import { describe, it, expect } from 'vitest';
import {
  useScanStore,
  useViewerStore,
  useTimelineStore,
  useProofStore,
  useUIStore,
  useEvidenceStore,
} from '../store';
import { getEpistemicColor, EPISTEMIC_COLORS } from '../types/epistemic';

describe('Epistemic Color System (RULE.md §03)', () => {
  it('maps TRUE to Deep Cobalt (#0969DA)', () => {
    expect(getEpistemicColor('TRUE')).toBe(EPISTEMIC_COLORS.TRUE);
    expect(getEpistemicColor('CERTIFIED_TRUE')).toBe(EPISTEMIC_COLORS.TRUE);
  });

  it('maps UNKNOWN and REFINED to Amber (#F59E0B)', () => {
    expect(getEpistemicColor('UNKNOWN')).toBe(EPISTEMIC_COLORS.UNKNOWN);
    expect(getEpistemicColor('REFINED')).toBe(EPISTEMIC_COLORS.UNKNOWN);
  });

  it('maps UNRESOLVABLE to Violet (#8B5CF6)', () => {
    expect(getEpistemicColor('UNRESOLVABLE')).toBe(EPISTEMIC_COLORS.UNRESOLVABLE);
  });
});

describe('useScanStore', () => {
  it('initializes with honest unmeasured null metadata parameters (F-005)', () => {
    const state = useScanStore.getState();
    expect(state.trajectoryId).toBeNull();
    expect(state.totalFrames).toBeNull();
    expect(state.atomCount).toBeNull();
    expect(state.timeSpanNs).toBeNull();
    expect(state.metadataStatus).toBe('idle');
    expect(state.mciStatus).toBe('PENDING');
  });

  it('updates metadata cleanly', () => {
    useScanStore.getState().setMetadata({ totalFrames: 200000 });
    expect(useScanStore.getState().totalFrames).toBe(200000);
    // Reset back
    useScanStore.getState().setMetadata({ totalFrames: null });
  });
});

describe('useViewerStore', () => {
  it('toggles AABB cages and distance calipers', () => {
    const initialAABB = useViewerStore.getState().showAABB;
    useViewerStore.getState().toggleAABB();
    expect(useViewerStore.getState().showAABB).toBe(!initialAABB);
    useViewerStore.getState().toggleAABB();
    expect(useViewerStore.getState().showAABB).toBe(initialAABB);
  });

  it('sets representation modes', () => {
    useViewerStore.getState().setRepresentation('sticks');
    expect(useViewerStore.getState().representation).toBe('sticks');
    useViewerStore.getState().setRepresentation('cartoon');
    expect(useViewerStore.getState().representation).toBe('cartoon');
  });

  it('manages measurement tool state machine and computes distance', () => {
    const store = useViewerStore.getState();
    expect(store.measurementToolState).toBe('idle');

    store.startMeasurement();
    expect(useViewerStore.getState().measurementToolState).toBe('selecting-first-atom');
    expect(useViewerStore.getState().measuringAtomA).toBeNull();

    useViewerStore.getState().setMeasuringAtom({
      label: 'A:87:NE2',
      coords: [16.894, 20.03, 24.002],
    });
    expect(useViewerStore.getState().measurementToolState).toBe('selecting-second-atom');
    expect(useViewerStore.getState().measuringAtomA?.label).toBe('A:87:NE2');

    useViewerStore.getState().setMeasuringAtom({
      label: 'HEM:142:FE',
      coords: [18.362, 18.488, 23.755],
    });
    expect(useViewerStore.getState().measurementToolState).toBe('measured');
    expect(useViewerStore.getState().measuringAtomB?.label).toBe('HEM:142:FE');
    expect(useViewerStore.getState().measuredDistance).toBe(2.14);
    expect(useViewerStore.getState().showMeasurementLine).toBe(true);

    useViewerStore.getState().clearMeasurement();
    expect(useViewerStore.getState().measurementToolState).toBe('idle');
    expect(useViewerStore.getState().measuringAtomA).toBeNull();
    expect(useViewerStore.getState().showMeasurementLine).toBe(false);
  });

  it('toggles AABB mode between selection and block', () => {
    expect(useViewerStore.getState().aabbMode).toBe('selection');
    useViewerStore.getState().setAABBMode('block');
    expect(useViewerStore.getState().aabbMode).toBe('block');
    useViewerStore.getState().setAABBMode('selection');
    expect(useViewerStore.getState().aabbMode).toBe('selection');
  });

  it('manages AABB detailed inspection and hover state', () => {
    expect(useViewerStore.getState().isInspectingAABB).toBe(false);
    useViewerStore.getState().toggleInspectingAABB();
    expect(useViewerStore.getState().isInspectingAABB).toBe(true);
    useViewerStore.getState().setInspectingAABB(false);
    expect(useViewerStore.getState().isInspectingAABB).toBe(false);

    expect(useViewerStore.getState().hoveredAABB).toBeNull();
    useViewerStore.getState().setHoveredAABB('protein');
    expect(useViewerStore.getState().hoveredAABB).toBe('protein');
    useViewerStore.getState().setHoveredAABB(null);
    expect(useViewerStore.getState().hoveredAABB).toBeNull();
  });

  it('toggles nucleic, water, and ion visibility independently', () => {
    // Water is hidden by default
    expect(useViewerStore.getState().showWater).toBe(false);
    useViewerStore.getState().toggleWater();
    expect(useViewerStore.getState().showWater).toBe(true);
    useViewerStore.getState().toggleWater();
    expect(useViewerStore.getState().showWater).toBe(false);

    // Nucleic toggle
    expect(useViewerStore.getState().showNucleic).toBe(true);
    useViewerStore.getState().toggleNucleic();
    expect(useViewerStore.getState().showNucleic).toBe(false);
    useViewerStore.getState().toggleNucleic();
    expect(useViewerStore.getState().showNucleic).toBe(true);

    // Ion toggle
    expect(useViewerStore.getState().showIon).toBe(true);
    useViewerStore.getState().toggleIon();
    expect(useViewerStore.getState().showIon).toBe(false);
    useViewerStore.getState().toggleIon();
    expect(useViewerStore.getState().showIon).toBe(true);

    // Nucleic AABB toggle (default false in accordance with analytical overlay suppression)
    expect(useViewerStore.getState().showNucleicAABB).toBe(false);
    useViewerStore.getState().toggleNucleicAABB();
    expect(useViewerStore.getState().showNucleicAABB).toBe(true);
    useViewerStore.getState().toggleNucleicAABB();
    expect(useViewerStore.getState().showNucleicAABB).toBe(false);
  });

  it('supports surface and backbone representation modes', () => {
    useViewerStore.getState().setRepresentation('surface');
    expect(useViewerStore.getState().representation).toBe('surface');
    useViewerStore.getState().setRepresentation('backbone');
    expect(useViewerStore.getState().representation).toBe('backbone');
    useViewerStore.getState().setRepresentation('cartoon');
  });

  it('stores and updates component counts across biopolymer kinds', () => {
    useViewerStore.getState().setComponentCounts({
      protein: 4586,
      nucleic: 855,
      ligand: 0,
      water: 384,
      ion: 3,
      lipid: 0,
      carbohydrate: 0,
    });
    const counts = useViewerStore.getState().componentCounts;
    expect(counts.protein).toBe(4586);
    expect(counts.nucleic).toBe(855);
    expect(counts.water).toBe(384);
    expect(counts.ion).toBe(3);
  });
});

describe('useTimelineStore', () => {
  it('selects blocks and updates playhead', () => {
    useTimelineStore.getState().selectBlock(41);
    expect(useTimelineStore.getState().selectedBlockId).toBe(41);

    useTimelineStore.getState().setCursorTimeNs(415.0);
    expect(useTimelineStore.getState().cursorTimeNs).toBe(415.0);
  });
});

describe('useProofStore (Machine Proof Mode)', () => {
  it('computes straddling status when bounds bracket threshold 4.0 A', () => {
    useProofStore.getState().setFocusedBlock(41, [410.0, 420.0], 3.72, 4.21, 'UNKNOWN');
    const state = useProofStore.getState();
    expect(state.focusedBlockId).toBe(41);
    expect(state.lowerBound).toBe(3.72);
    expect(state.upperBound).toBe(4.21);
    expect(state.status).toBe('UNKNOWN (Straddles Threshold)');
  });

  it('certifies TRUE when upper bound is strictly below threshold', () => {
    useProofStore.getState().setFocusedBlock(25, [250.0, 260.0], 2.80, 3.65, 'CERTIFIED_TRUE');
    const state = useProofStore.getState();
    expect(state.status).toBe('CERTIFIED TRUE');
  });

  it('certifies FALSE when lower bound is at or above threshold', () => {
    useProofStore.getState().setFocusedBlock(5, [50.0, 60.0], 4.50, 5.80, 'CERTIFIED_FALSE');
    const state = useProofStore.getState();
    expect(state.status).toBe('CERTIFIED FALSE');
  });
});

describe('useUIStore', () => {
  it('toggles views between workstation (Fig 2) and exploration (Fig 1)', () => {
    useUIStore.getState().setActiveView('exploration');
    expect(useUIStore.getState().activeView).toBe('exploration');
    useUIStore.getState().setActiveView('workstation');
    expect(useUIStore.getState().activeView).toBe('workstation');
  });
});
