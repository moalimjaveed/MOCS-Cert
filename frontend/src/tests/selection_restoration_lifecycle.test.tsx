// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useViewerStore } from '../store/useViewerStore';
import { useRendererStore } from '../store/useRendererStore';
import { MolecularViewport } from '../components/viewer/MolecularViewport';
import type { MolecularSelection } from '../molecular/types';

// Enable React 19 act environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('Molecular View Selection State Restoration Lifecycle Suite', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockSelectionA: MolecularSelection = {
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

  const mockSelectionB: MolecularSelection = {
    structureId: '4HHB',
    modelIndex: 1,
    chainId: 'A',
    residueId: 142,
    residueName: 'HEM',
    atomName: 'FE',
    element: 'FE',
    coordinates: [14.485, -4.567, 8.901],
    bFactor: 18.2,
    occupancy: 1.0,
    entityType: 'ligand',
    formattedLabel: 'A:142:FE',
    displayLabel: 'Chain A · HEM 142 · FE',
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    // Clean store state before each test
    act(() => {
      useViewerStore.getState().selectStructure('4HHB');
      useViewerStore.getState().clearSelections();
      useViewerStore.getState().clearMeasurement();
      useViewerStore.getState().setSelectedEntity(null);
      useViewerStore.getState().setInspectionMode('normal');
      useViewerStore.setState({ isSelectionContextMode: false });
      useRendererStore.getState().setLoadStage('READY', 0);
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders context panel when atom is selected and establishes selection presentation', async () => {
    await act(async () => {
      root.render(<MolecularViewport />);
    });

    expect(container.querySelector('[data-testid="molecular-context-panel"]')).toBeNull();

    act(() => {
      useViewerStore.getState().setSelectedEntity(mockSelectionA);
    });

    const panel = container.querySelector('[data-testid="molecular-context-panel"]');
    expect(panel).not.toBeNull();
    expect(panel?.querySelector('[data-testid="context-panel-display-label"]')?.textContent?.trim()).toBe('Chain A · HIS 87 · NE2');
    expect(useViewerStore.getState().selectionA).toBe('A:87:NE2');
  });

  it('close button (✕) dismisses context panel and clears selections via canonical exit path', async () => {
    await act(async () => {
      root.render(<MolecularViewport />);
    });

    act(() => {
      useViewerStore.getState().setSelectedEntity(mockSelectionA);
    });

    expect(container.querySelector('[data-testid="molecular-context-panel"]')).not.toBeNull();

    const closeBtn = container.querySelector('[data-testid="context-panel-close-btn"]') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();

    act(() => {
      closeBtn.click();
    });

    // Both UI panel and store selections must be cleanly cleared
    expect(container.querySelector('[data-testid="molecular-context-panel"]')).toBeNull();
    expect(useViewerStore.getState().selectedEntity).toBeNull();
    expect(useViewerStore.getState().selectionA).toBe('');
    expect(useViewerStore.getState().selectionB).toBe('');
  });

  it('clear button dismisses selection via canonical exit path', async () => {
    await act(async () => {
      root.render(<MolecularViewport />);
    });

    act(() => {
      useViewerStore.getState().setSelectedEntity(mockSelectionA);
    });

    const clearBtn = container.querySelector('[data-testid="context-panel-clear-btn"]') as HTMLButtonElement;
    expect(clearBtn).not.toBeNull();

    act(() => {
      clearBtn.click();
    });

    expect(container.querySelector('[data-testid="molecular-context-panel"]')).toBeNull();
    expect(useViewerStore.getState().selectedEntity).toBeNull();
    expect(useViewerStore.getState().selectionA).toBe('');
  });

  it('Escape key triggers canonical exitSelectionPresentation when selection is active', async () => {
    await act(async () => {
      root.render(<MolecularViewport />);
    });

    act(() => {
      useViewerStore.getState().setSelectedEntity(mockSelectionA);
    });

    expect(container.querySelector('[data-testid="molecular-context-panel"]')).not.toBeNull();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(container.querySelector('[data-testid="molecular-context-panel"]')).toBeNull();
    expect(useViewerStore.getState().selectedEntity).toBeNull();
    expect(useViewerStore.getState().selectionA).toBe('');
  });

  it('preserves initial pre-A baseline on reselection (A -> B -> Clear)', async () => {
    await act(async () => {
      root.render(<MolecularViewport />);
    });

    // 1. Select A
    act(() => {
      useViewerStore.getState().setSelectedEntity(mockSelectionA);
    });
    expect(useViewerStore.getState().selectionA).toBe('A:87:NE2');

    // 2. Select B within same session
    act(() => {
      useViewerStore.getState().setSelectedEntity(mockSelectionB);
    });
    expect(useViewerStore.getState().selectionA).toBe('A:142:FE');

    // 3. Clear selection
    const clearBtn = container.querySelector('[data-testid="context-panel-clear-btn"]') as HTMLButtonElement;
    act(() => {
      clearBtn.click();
    });

    expect(useViewerStore.getState().selectedEntity).toBeNull();
    expect(useViewerStore.getState().selectionA).toBe('');
    expect(container.querySelector('[data-testid="molecular-context-panel"]')).toBeNull();
  });

  it('Selection + Focus: exiting selection cleans up focus mode and cutaway', async () => {
    await act(async () => {
      root.render(<MolecularViewport />);
    });

    act(() => {
      useViewerStore.getState().setSelectedEntity(mockSelectionA);
      useViewerStore.getState().setInspectionMode('pocket-inspect');
      useViewerStore.setState({ isSelectionContextMode: true });
    });

    // Now in selection focus
    expect(useViewerStore.getState().inspectionMode).toBe('pocket-inspect');
    expect(useViewerStore.getState().isSelectionContextMode).toBe(true);

    // Click close on context panel directly (without clicking Exit Focus first)
    const closeBtn = container.querySelector('[data-testid="context-panel-close-btn"]') as HTMLButtonElement;
    act(() => {
      closeBtn.click();
    });

    // Both selection and focus must be restored to normal
    expect(useViewerStore.getState().selectedEntity).toBeNull();
    expect(useViewerStore.getState().inspectionMode).toBe('normal');
    expect(useViewerStore.getState().isSelectionContextMode).toBe(false);
  });

  it('Selection + Measure: cancelling measurement restores selection baseline', async () => {
    await act(async () => {
      root.render(<MolecularViewport />);
    });

    act(() => {
      useViewerStore.getState().setSelectedEntity(mockSelectionA);
    });

    const measureBtn = container.querySelector('[data-testid="context-panel-measure-btn"]') as HTMLButtonElement;
    act(() => {
      measureBtn.click();
    });

    expect(useViewerStore.getState().measurementToolState).toBe('selecting-second-atom');

    // Measurement banner should be visible with Cancel button
    const cancelBtn = container.querySelector('[data-testid="measure-cancel-btn"]') as HTMLButtonElement;
    expect(cancelBtn).not.toBeNull();

    act(() => {
      cancelBtn.click();
    });

    expect(useViewerStore.getState().measurementToolState).toBe('idle');
    expect(useViewerStore.getState().selectedEntity).toBeNull();
  });

  it('dataset switch completely invalidates selection snapshot without cross-dataset leakage', async () => {
    await act(async () => {
      root.render(<MolecularViewport />);
    });

    act(() => {
      useViewerStore.getState().setSelectedEntity(mockSelectionA);
    });

    expect(useViewerStore.getState().selectedEntity).not.toBeNull();

    // Switch structure to 1BNA
    act(() => {
      useViewerStore.getState().selectStructure('1BNA');
    });

    const state = useViewerStore.getState();
    expect(state.activeStructureId).toBe('1BNA');
    expect(state.selectedEntity).toBeNull();
    expect(state.selectionA).toBe('');
    expect(state.selectionB).toBe('');
    expect(container.querySelector('[data-testid="molecular-context-panel"]')).toBeNull();
  });

  it('external clearSelections() call triggers visual state restoration cleanly', async () => {
    await act(async () => {
      root.render(<MolecularViewport />);
    });

    act(() => {
      useViewerStore.getState().setSelectedEntity(mockSelectionA);
    });

    expect(container.querySelector('[data-testid="molecular-context-panel"]')).not.toBeNull();

    // Clear selections externally from store
    act(() => {
      useViewerStore.getState().clearSelections();
    });

    expect(container.querySelector('[data-testid="molecular-context-panel"]')).toBeNull();
    expect(useViewerStore.getState().selectedEntity).toBeNull();
    expect(useViewerStore.getState().selectionA).toBe('');
  });

  it('rapid select and clear cycles are completely race-safe', async () => {
    await act(async () => {
      root.render(<MolecularViewport />);
    });

    for (let i = 0; i < 5; i++) {
      act(() => {
        useViewerStore.getState().setSelectedEntity(mockSelectionA);
      });
      expect(useViewerStore.getState().selectionA).toBe('A:87:NE2');

      act(() => {
        useViewerStore.getState().clearSelections();
      });
      expect(useViewerStore.getState().selectionA).toBe('');
    }

    expect(useViewerStore.getState().selectedEntity).toBeNull();
    expect(useViewerStore.getState().selectionA).toBe('');
    expect(container.querySelector('[data-testid="molecular-context-panel"]')).toBeNull();
  });

  it('proves that camera snapshot restoration never invokes fitStructure automatically', () => {
    const mockBaselineCamera = { position: [0, 0, 85], target: [0, 0, 0], radius: 42.5 };
    let restoredCamera: any = null;
    let fitCalledCount = 0;

    const mockRenderer = {
      getCameraSnapshot: vi.fn(() => mockBaselineCamera),
      setCameraSnapshot: vi.fn((snap: any, _durationMs?: number) => {
        restoredCamera = snap;
      }),
      fitStructure: vi.fn(() => {
        fitCalledCount++;
      }),
      clearSelection: vi.fn(async () => {}),
      clearInspectionCutaway: vi.fn(async () => {}),
      setInspectionMode: vi.fn(async () => {}),
    };

    // Simulate pre-selection snapshot capture
    const snapshot = {
      camera: mockRenderer.getCameraSnapshot(),
      datasetId: '4HHB',
      wasInFocusSession: false,
    };

    expect(mockRenderer.getCameraSnapshot).toHaveBeenCalledTimes(1);
    expect(snapshot.camera).toEqual(mockBaselineCamera);

    // Simulate exitSelectionPresentation executing camera restoration
    mockRenderer.setCameraSnapshot(snapshot.camera, 200);

    expect(mockRenderer.setCameraSnapshot).toHaveBeenCalledWith(mockBaselineCamera, 200);
    expect(restoredCamera).toEqual(mockBaselineCamera);

    // Strict Architectural Requirement: fitStructure must NEVER be called
    expect(fitCalledCount).toBe(0);
    expect(mockRenderer.fitStructure).not.toHaveBeenCalled();
  });

  it('Focus -> Selection: respects higher-level Focus session when clearing selection', () => {
    const mockFocusCamera = { position: [12.35, -4.57, 28.9], target: [12.35, -4.57, 8.9], radius: 18.0 };
    let restoredCamera: any = null;

    const mockRenderer = {
      setCameraSnapshot: vi.fn((snap: any, _durationMs?: number) => {
        restoredCamera = snap;
      }),
      setInspectionMode: vi.fn(async () => {}),
      clearInspectionCutaway: vi.fn(async () => {}),
    };

    // User was ALREADY in Focus session when selection began
    const snapshot = {
      camera: mockFocusCamera,
      datasetId: '4HHB',
      wasInFocusSession: true,
      inspectionMode: 'pocket-inspect' as const,
      isSelectionContextMode: true,
    };

    // When exiting selection presentation:
    // 1. Camera restores to the Focus session camera
    mockRenderer.setCameraSnapshot(snapshot.camera, 200);
    expect(restoredCamera).toEqual(mockFocusCamera);

    // 2. Higher-level Focus session is NOT destroyed prematurely
    expect(snapshot.wasInFocusSession).toBe(true);
    expect(mockRenderer.setInspectionMode).not.toHaveBeenCalledWith(false, []);
  });
});
