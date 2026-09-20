// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { useUIStore, useEvidenceStore, useViewerStore, useTimelineStore, useScanStore } from '../store';
import { IndexCatalogView } from '../components/views/IndexCatalogView';
import { RefinementExplorerView } from '../components/views/RefinementExplorerView';
import { FormalAuditView } from '../components/views/FormalAuditView';
import { ExecutionBenchmarksView } from '../components/views/ExecutionBenchmarksView';
import { LeftSidebar } from '../components/layout/LeftSidebar';
import { TopBar } from '../components/layout/TopBar';
import { BottomAnalysisPanel } from '../components/evidence/BottomAnalysisPanel';
import { ExecutionPlanDAG } from '../components/plan/ExecutionPlanDAG';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../api/client', () => ({
  fetchBlocks: vi.fn().mockResolvedValue([]),
  fetchTrajectoryMetadata: vi.fn().mockResolvedValue({}),
  fetchBenchmarks: vi.fn().mockResolvedValue({ baselines: [] }),
  compileQuery: vi.fn().mockResolvedValue({ plan_steps: [] }),
  executeQuery: vi.fn().mockResolvedValue({
    query_id: 'q1',
    truth_value: 'TRUE',
    resolution_status: 'COMPLETE',
    quantifier: 'EXISTS',
    pruning_efficiency: 97.1,
    blocks_examined: 240,
    certified_blocks: 231,
    refined_blocks: 7,
    exact_frames_scanned: 43,
  }),
  verifyCertificate: vi.fn().mockResolvedValue({ valid: true }),
}));

import { compileQuery, executeQuery } from '../api/client';

describe('PASS 27: Capability Census & Semantic View Differentiation Forensics', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      useUIStore.setState({
        activeView: 'workstation',
        activeWorkspaceTab: 'Workstation',
        activeSidebarId: 'distance',
        isSidebarCollapsed: false,
        isInspectorOpen: true,
        activeEvidenceTab: 'lattice',
        isAuditorModalOpen: false,
        isCommandPaletteOpen: false,
        isDocumentationModalOpen: false,
      });

      useEvidenceStore.setState({
        queryId: 'q_canonical_dist',
        queryText: 'FIND DISTANCE(A:155:CA, LIG:1:O2) < 4.0 Å',
        operator: 'DISTANCE-v1',
        peakMemoryMb: 4.2,
        ioPruneRatio: 0.968,
        traversalDepth: 4,
        refinementSelectivity: '50:1',
        pruningEfficiency: 97.1,
        blocksExamined: 240,
        certifiedBlocks: 231,
        refinedBlocks: 7,
        exactFramesScanned: 43,
        isExecuting: false,
      });

      useViewerStore.setState({
        selectionA: 'A:155:CA',
        selectionB: 'LIG:1:O2',
      });

      useTimelineStore.setState({
        selectedBlockId: 41,
        blocks: [],
        activeSubBlocks: [],
      });

      useScanStore.setState({
        trajectoryId: 'data/synth_500f.xtc',
        topologyId: 'data/synth_500f.gro',
        totalFrames: 500,
        timeSpanNs: 1000.0,
        timestepPs: 10.0,
        atomCount: 10,
      });
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  describe('1. Top Bar Real Execution vs Dead Timer Check', () => {
    it('executes real query compilation and execution when clicking Run Query instead of arbitrary timer', async () => {
      await act(async () => {
        root.render(<TopBar />);
      });

      const runBtn = container.querySelector('button[title*="Compile and Execute Query"]') as HTMLButtonElement;
      expect(runBtn).not.toBeNull();

      await act(async () => {
        runBtn.click();
      });

      expect(compileQuery).toHaveBeenCalled();
      expect(executeQuery).toHaveBeenCalled();
    });
  });

  describe('2. Observables Group Semantic Differentiation (Distance vs Contact vs HBond)', () => {
    it('differentiates Distance, Contact, and Hydrogen Bond in query, operator, and selection anchors', async () => {
      await act(async () => {
        root.render(<LeftSidebar />);
      });

      // 1. Distance
      const distBtn = container.querySelector('[data-testid="nav-item-distance"]') as HTMLButtonElement;
      await act(async () => {
        distBtn.click();
      });
      expect(useUIStore.getState().activeSidebarId).toBe('distance');
      expect(useEvidenceStore.getState().queryText).toContain('DISTANCE');
      expect(useEvidenceStore.getState().operator).toBe('DISTANCE-v1');
      expect(useViewerStore.getState().selectionA).toBe('A:155:CA');
      expect(useViewerStore.getState().selectionB).toBe('LIG:1:O2');

      // 2. Contact
      const contactBtn = container.querySelector('[data-testid="nav-item-contact"]') as HTMLButtonElement;
      await act(async () => {
        contactBtn.click();
      });
      expect(useUIStore.getState().activeSidebarId).toBe('contact');
      expect(useEvidenceStore.getState().queryText).toContain('CONTACT');
      expect(useEvidenceStore.getState().operator).toBe('CONTACT-v1');
      expect(useViewerStore.getState().selectionA).toBe('PHE89');
      expect(useViewerStore.getState().selectionB).toBe('LIG');

      // 3. Hydrogen Bond
      const hbondBtn = container.querySelector('[data-testid="nav-item-hbond"]') as HTMLButtonElement;
      await act(async () => {
        hbondBtn.click();
      });
      expect(useUIStore.getState().activeSidebarId).toBe('hbond');
      expect(useEvidenceStore.getState().queryText).toContain('HBOND');
      expect(useEvidenceStore.getState().operator).toBe('HBOND-v1');
      expect(useViewerStore.getState().selectionA).toBe('TYR151:OH');
      expect(useViewerStore.getState().selectionB).toBe('LIG:1:O2');
    });
  });

  describe('3. Index Catalog Sub-Workflow Differentiation (MCI vs Selections)', () => {
    it('routes Index Catalog canonically and differentiates subtabs', async () => {
      await act(async () => {
        root.render(<LeftSidebar />);
      });

      // Canonical Index Catalog nav item
      const indexBtn = container.querySelector('[data-testid="nav-item-index"]') as HTMLButtonElement;
      expect(indexBtn).not.toBeNull();
      await act(async () => {
        indexBtn.click();
      });
      expect(useUIStore.getState().activeWorkspaceTab).toBe('Index Catalog');
      expect(useUIStore.getState().activeSidebarId).toBe('index');
    });

    it('renders distinct subtabs in IndexCatalogView according to activeSidebarId', async () => {
      act(() => {
        useUIStore.setState({ activeSidebarId: 'selections' });
      });
      await act(async () => {
        root.render(<IndexCatalogView />);
      });
      expect(container.querySelector('[data-testid="selections-panel"]')).not.toBeNull();

      act(() => {
        useUIStore.setState({ activeSidebarId: 'mci' });
      });
      await act(async () => {
        root.render(<IndexCatalogView />);
      });
      expect(container.querySelector('[data-testid="blocks-table"]')).not.toBeNull();
    });
  });

  describe('4. Refinement Explorer Sub-Workflow Differentiation (Blocks vs Bounds)', () => {
    it('differentiates Blocks vs Bounds in RefinementExplorerView', async () => {
      act(() => {
        useUIStore.setState({ activeSidebarId: 'bounds' });
      });
      await act(async () => {
        root.render(<RefinementExplorerView />);
      });
      expect(container.textContent).toContain('Selected Block 41 Interval Semantics');

      act(() => {
        useUIStore.setState({ activeSidebarId: 'blocks' });
      });
      await act(async () => {
        root.render(<RefinementExplorerView />);
      });
      expect(container.querySelector('[data-testid="timeline-lattice-container"]')).not.toBeNull();
    });
  });

  describe('5. Formal Audit Sub-Workflow Differentiation (Certificates vs Evidence vs Oracle)', () => {
    it('differentiates Certificates, Evidence, and Reference Comparison in FormalAuditView', async () => {
      // 1. Certificates -> cert tab
      act(() => {
        useUIStore.setState({ activeSidebarId: 'certificates' });
      });
      await act(async () => {
        root.render(<FormalAuditView />);
      });
      expect(container.querySelector('[data-testid="formal-verify-btn"]')).not.toBeNull();

      // 2. Reference Comparison -> oracle differential tab
      act(() => {
        useUIStore.setState({ activeSidebarId: 'ref_comp' });
      });
      await act(async () => {
        root.render(<FormalAuditView />);
      });
      expect(container.querySelector('[data-testid="oracle-table"]')).not.toBeNull();

      // 3. Evidence -> invariants tab
      act(() => {
        useUIStore.setState({ activeSidebarId: 'evidence' });
      });
      await act(async () => {
        root.render(<FormalAuditView />);
      });
      expect(container.querySelector('[data-testid="invariants-panel"]')).not.toBeNull();
    });
  });

  describe('6. Execution Benchmarks Sub-Workflow Differentiation (Performance vs I/O Pruning vs Workload)', () => {
    it('renders distinct perspective filters for Performance, I/O Pruning, and Workload', async () => {
      act(() => {
        useUIStore.setState({ activeSidebarId: 'io_pruning' });
      });
      await act(async () => {
        root.render(<ExecutionBenchmarksView />);
      });
      expect(container.textContent).toContain('Avoided trajectory frame decompression');

      act(() => {
        useUIStore.setState({ activeSidebarId: 'workload' });
      });
      await act(async () => {
        root.render(<ExecutionBenchmarksView />);
      });
      expect(container.textContent).toContain('Bounded memory allocation invariant');
    });
  });

  describe('7. Bottom Analysis Panel Math Subtabs (Distance vs AABB Geometry)', () => {
    it('renders distinct formulas and geometry details between Distance Bound and AABB Geometry', async () => {
      await act(async () => {
        root.render(<BottomAnalysisPanel />);
      });

      const certTab = container.querySelector('[data-testid="cert-tab-cert"]') as HTMLButtonElement;
      await act(async () => {
        certTab.click();
      });

      expect(container.querySelector('[data-testid="math-tab-distance"]')).not.toBeNull();

      const aabbTab = container.querySelector('[data-testid="math-tab-aabb"]') as HTMLButtonElement;
      await act(async () => {
        aabbTab.click();
      });

      const mathBox = container.querySelector('[data-testid="math-formulas-box"]');
      expect(mathBox?.textContent).toContain('AABB');
    });
  });

  describe('8. Execution Plan DAG Dynamic Telemetry Binding', () => {
    it('binds real store values for peak memory, I/O prune ratio, and traversal depth', async () => {
      act(() => {
        useEvidenceStore.setState({
          peakMemoryMb: 9.8,
          ioPruneRatio: 0.945,
          traversalDepth: 6,
          refinementSelectivity: '64:1',
          pruningEfficiency: 94.5,
        });
      });

      await act(async () => {
        root.render(<ExecutionPlanDAG />);
      });

      const panel = container.querySelector('[data-testid="mci-metrics-panel"]');
      expect(panel?.textContent).toContain('9.8 MB');
      expect(panel?.textContent).toContain('94.5%');
      expect(panel?.textContent).toContain('6 levels');
      expect(panel?.textContent).toContain('64:1');
    });
  });
});
