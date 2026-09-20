// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useViewerStore } from '../store/useViewerStore';
import { MolecularViewport } from '../components/viewer/MolecularViewport';
import type { MolecularSelection } from '../molecular/types';

// Enable React 19 act environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('Molecular Live Selection & Picking Integration Suite', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    // Clean initial store state
    act(() => {
      useViewerStore.getState().selectStructure('4HHB');
      useViewerStore.getState().clearSelections();
      useViewerStore.getState().clearMeasurement();
      useViewerStore.getState().setSelectedEntity(null);
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const mockSelection: MolecularSelection = {
    structureId: '4HHB',
    modelIndex: 1,
    chainId: 'A',
    residueId: 87,
    residueName: 'HIS',
    atomName: 'NE2',
    element: 'N',
    coordinates: [12.345, -4.567, 8.901],
    bFactor: 24.5,
    occupancy: 1.0,
    entityType: 'protein',
    formattedLabel: 'A:87:NE2',
    displayLabel: 'Chain A · HIS 87 · NE2',
  };

  const mockSecondSelection: MolecularSelection = {
    structureId: '4HHB',
    modelIndex: 1,
    chainId: 'A',
    residueId: 142,
    residueName: 'HEM',
    atomName: 'FE',
    element: 'FE',
    coordinates: [14.485, -4.567, 8.901], // distance = 2.14 Å
    bFactor: 18.2,
    occupancy: 1.0,
    entityType: 'ligand',
    formattedLabel: 'A:142:FE',
    displayLabel: 'Chain A · HEM 142 · FE',
  };

  it('updates store state when selecting and clearing an entity', () => {
    act(() => {
      useViewerStore.getState().setSelectedEntity(mockSelection);
    });

    const state = useViewerStore.getState();
    expect(state.selectedEntity).toEqual(mockSelection);
    expect(state.selectionA).toBe('A:87:NE2');

    act(() => {
      useViewerStore.getState().setSelectedEntity(null);
    });

    const clearedState = useViewerStore.getState();
    expect(clearedState.selectedEntity).toBeNull();
    expect(clearedState.selectionA).toBe('');
  });

  it('seamlessly drives caliper distance measurement across two picked entities', () => {
    // 1. Start measurement
    act(() => {
      useViewerStore.getState().startMeasurement();
    });
    expect(useViewerStore.getState().measurementToolState).toBe('selecting-first-atom');

    // 2. Pick first atom
    act(() => {
      useViewerStore.getState().setSelectedEntity(mockSelection);
    });
    const stateAfterFirst = useViewerStore.getState();
    expect(stateAfterFirst.measurementToolState).toBe('selecting-second-atom');
    expect(stateAfterFirst.measuringAtomA?.label).toBe('A:87:NE2');

    // 3. Pick second atom
    act(() => {
      useViewerStore.getState().setSelectedEntity(mockSecondSelection);
    });
    const stateAfterSecond = useViewerStore.getState();
    expect(stateAfterSecond.measurementToolState).toBe('measured');
    expect(stateAfterSecond.measuringAtomB?.label).toBe('A:142:FE');
    expect(stateAfterSecond.measuredDistance).toBe(2.14);
    expect(stateAfterSecond.showMeasurementLine).toBe(true);
    expect(stateAfterSecond.measurements.length).toBe(1);
    expect(stateAfterSecond.measurements[0].rawValue).toBeCloseTo(2.14, 2);
    expect(stateAfterSecond.measurements[0].formattedValue).toBe('2.14 Å');
  });

  it('completely invalidates selection and measurement states when switching structures', () => {
    act(() => {
      useViewerStore.getState().setSelectedEntity(mockSelection);
      useViewerStore.getState().setSelections('A:87:NE2', 'A:142:FE');
      useViewerStore.getState().setMeasuredDistance(2.14);
    });

    expect(useViewerStore.getState().selectedEntity).not.toBeNull();
    expect(useViewerStore.getState().selectionA).toBe('A:87:NE2');

    // Switch structure to 1BNA
    act(() => {
      useViewerStore.getState().selectStructure('1BNA');
    });

    const newState = useViewerStore.getState();
    expect(newState.activeStructureId).toBe('1BNA');
    expect(newState.selectedEntity).toBeNull();
    expect(newState.selectionA).toBe('');
    expect(newState.selectionB).toBe('');
    expect(newState.measuredDistance).toBe(0);
    expect(newState.measurements.length).toBe(0);
    expect(newState.measurementToolState).toBe('idle');
  });

  it('renders Contextual Identification Window inside viewport when entity is picked', async () => {
    await act(async () => {
      root.render(<MolecularViewport />);
    });

    // Initially, context panel should NOT be visible
    expect(container.querySelector('[data-testid="molecular-context-panel"]')).toBeNull();

    // Pick an atom
    act(() => {
      useViewerStore.getState().setSelectedEntity(mockSelection);
    });

    // Panel should now be rendered inside viewport
    const contextPanel = container.querySelector('[data-testid="molecular-context-panel"]');
    expect(contextPanel).not.toBeNull();

    // Verify authentic atomic properties
    const entityBadge = contextPanel?.querySelector('[data-testid="context-panel-entity-type"]');
    expect(entityBadge?.textContent?.trim()).toBe('protein');

    const displayLabel = contextPanel?.querySelector('[data-testid="context-panel-display-label"]');
    expect(displayLabel?.textContent?.trim()).toBe('Chain A · HIS 87 · NE2');

    const atomName = contextPanel?.querySelector('[data-testid="context-panel-atom-name"]');
    expect(atomName?.textContent?.trim()).toBe('NE2');

    const element = contextPanel?.querySelector('[data-testid="context-panel-element"]');
    expect(element?.textContent?.trim()).toBe('N');

    const residue = contextPanel?.querySelector('[data-testid="context-panel-residue"]');
    expect(residue?.textContent?.trim()).toBe('HIS 87');

    const coords = contextPanel?.querySelector('[data-testid="context-panel-coordinates"]');
    expect(coords?.textContent).toContain('12.35');
    expect(coords?.textContent).toContain('-4.57');
    expect(coords?.textContent).toContain('8.90');

    const chain = contextPanel?.querySelector('[data-testid="context-panel-chain"]');
    expect(chain?.textContent?.trim()).toBe('A');

    const bFactor = contextPanel?.querySelector('[data-testid="context-panel-bfactor"]');
    expect(bFactor?.textContent?.trim()).toBe('24.5 Å²');

    const occupancy = contextPanel?.querySelector('[data-testid="context-panel-occupancy"]');
    expect(occupancy?.textContent?.trim()).toBe('1.00');

    // Action buttons must exist
    expect(contextPanel?.querySelector('[data-testid="context-panel-focus-btn"]')).not.toBeNull();
    expect(contextPanel?.querySelector('[data-testid="context-panel-measure-btn"]')).not.toBeNull();
    expect(contextPanel?.querySelector('[data-testid="context-panel-clear-btn"]')).not.toBeNull();
    expect(contextPanel?.querySelector('[data-testid="context-panel-close-btn"]')).not.toBeNull();

    // Click close button
    const closeBtn = contextPanel?.querySelector('[data-testid="context-panel-close-btn"]') as HTMLButtonElement;
    act(() => {
      closeBtn.click();
    });

    expect(container.querySelector('[data-testid="molecular-context-panel"]')).toBeNull();
  });

  it('action buttons on context panel operate correctly (Clear dismisses, Measure starts measurement)', async () => {
    await act(async () => {
      root.render(<MolecularViewport />);
    });

    act(() => {
      useViewerStore.getState().setSelectedEntity(mockSelection);
    });

    const contextPanel = container.querySelector('[data-testid="molecular-context-panel"]');
    expect(contextPanel).not.toBeNull();

    // Click Clear button
    const clearBtn = contextPanel?.querySelector('[data-testid="context-panel-clear-btn"]') as HTMLButtonElement;
    act(() => {
      clearBtn.click();
    });

    expect(useViewerStore.getState().selectedEntity).toBeNull();
    expect(container.querySelector('[data-testid="molecular-context-panel"]')).toBeNull();

    // Re-select and click Measure button
    act(() => {
      useViewerStore.getState().setSelectedEntity(mockSelection);
    });

    const measureBtn = container.querySelector('[data-testid="context-panel-measure-btn"]') as HTMLButtonElement;
    act(() => {
      measureBtn.click();
    });

    // Measurement flow should now be waiting for second atom
    expect(useViewerStore.getState().measurementToolState).toBe('selecting-second-atom');
    expect(useViewerStore.getState().measuringAtomA?.label).toBe('A:87:NE2');
  });

  it('renders dynamic structure switcher buttons reflecting recentStructures and switches cleanly', async () => {
    await act(async () => {
      root.render(<MolecularViewport />);
    });

    const hhbBtn = container.querySelector('[data-testid="source-mode-4hhb"]');
    const synthBtn = container.querySelector('[data-testid="source-mode-synth"]');
    const bnaBtn = container.querySelector('[data-testid="source-mode-1bna"]');

    expect(hhbBtn).not.toBeNull();
    expect(synthBtn).not.toBeNull();
    expect(bnaBtn).not.toBeNull();

    // Switch to 1BNA
    act(() => {
      (bnaBtn as HTMLButtonElement).click();
    });

    expect(useViewerStore.getState().activeStructureId).toBe('1BNA');
  });
});
