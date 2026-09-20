// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { VerdictCard } from '../components/inspector/VerdictCard';
import { RightInspector } from '../components/layout/RightInspector';
import { ExecutionBenchmarksView } from '../components/views/ExecutionBenchmarksView';
import { RefinementExplorerView } from '../components/views/RefinementExplorerView';
import { FormalAuditView } from '../components/views/FormalAuditView';
import { TopBar } from '../components/layout/TopBar';
import { LeftSidebar } from '../components/layout/LeftSidebar';
import { useEvidenceStore, useProofStore, useScanStore, useUIStore, useTimelineStore } from '../store';
import { resolveEpistemicStatus, EPISTEMIC_REGISTRY } from '../molecular/status/epistemicStatus';

// Enable React 19 act environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;



describe('PASS 43: Adversarial Visual QA & Epistemic UI Integrity Test Suite', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    // Mock HTMLCanvasElement
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      getImageData: vi.fn(),
      putImageData: vi.fn(),
      createImageData: vi.fn(),
      setTransform: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      fillText: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      roundRect: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 0 }),
      scale: vi.fn(),
      resetTransform: vi.fn(),
    }) as any;

    act(() => {
      useScanStore.setState({
        trajectoryId: 'synth_500f.xtc',
        topologyId: 'synth_500f.gro',
        atomCount: 10,
        totalFrames: 500,
        pbcMode: 'orthorhombic_minimum_image',
      });
      useProofStore.getState().resetProof();
      useEvidenceStore.getState().invalidateExecution();
      useTimelineStore.getState().resetTimeline();
      useUIStore.setState({ isSidebarCollapsed: false, isInspectorOpen: true });
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  describe('1. Epistemic Status Presentation Mapping Invariants', () => {
    it('correctly maps all 16 canonical epistemic states without undefined values', () => {
      const states = Object.keys(EPISTEMIC_REGISTRY) as Array<keyof typeof EPISTEMIC_REGISTRY>;
      expect(states.length).toBe(16);

      states.forEach((s) => {
        const item = EPISTEMIC_REGISTRY[s];
        expect(item.label).toBeDefined();
        expect(item.badgeVariant).toBeDefined();
        expect(item.textColor).toBeDefined();
        expect(item.bgColor).toBeDefined();
        expect(item.description).toBeDefined();
        expect(item.description.length).toBeGreaterThan(10);
      });
    });

    it('resolves raw strings safely and rejects unexecuted false positives', () => {
      // Empty / null should return NO_EXECUTION when context.executionId is missing
      const emptyRes = resolveEpistemicStatus(null, { executionId: null });
      expect(emptyRes.state).toBe('NO_EXECUTION');
      expect(emptyRes.label).toBe('AWAITING EXECUTION');

      const notRunRes = resolveEpistemicStatus('NOT_RUN', { executionId: null });
      expect(notRunRes.state).toBe('NO_EXECUTION');

      // Executing context takes precedence
      const execRes = resolveEpistemicStatus('TRUE', { isExecuting: true });
      expect(execRes.state).toBe('PENDING');
      expect(execRes.label).toBe('EXECUTING...');

      // Stale context takes precedence
      const staleRes = resolveEpistemicStatus('TRUE', { isStale: true });
      expect(staleRes.state).toBe('STALE');
      expect(staleRes.label).toBe('STALE / INVALIDATED');

      // Error context takes precedence
      const errRes = resolveEpistemicStatus('TRUE', { hasError: true });
      expect(errRes.state).toBe('FAILED');
      expect(errRes.label).toBe('EXECUTION FAILED');

      // Valid execution identity allows proof states
      const trueRes = resolveEpistemicStatus('TRUE', { executionId: 'exec_123' });
      expect(trueRes.state).toBe('TRUE');
      expect(trueRes.label).toBe('CERTIFIED TRUE');

      const falseRes = resolveEpistemicStatus('FALSE', { executionId: 'exec_123' });
      expect(falseRes.state).toBe('FALSE');
      expect(falseRes.label).toBe('CERTIFIED FALSE');

      const unknownRes = resolveEpistemicStatus('UNKNOWN', { executionId: 'exec_123' });
      expect(unknownRes.state).toBe('UNKNOWN');
      expect(unknownRes.label).toBe('UNKNOWN (Straddles)');
    });
  });

  describe('2. Component-Level Anti-False-Positive Audits', () => {
    it('VerdictCard: never defaults unexecuted/empty state to CERTIFIED TRUE', async () => {
      await act(async () => {
        root.render(<VerdictCard truthValue="" resolutionStatus="NOT_RUN" />);
      });

      const title = container.querySelector('[data-testid="verdict-title"]');
      expect(title?.textContent).not.toBe('CERTIFIED TRUE');
      expect(title?.textContent).toBe('NO EXECUTION');

      const iconBox = container.querySelector('.bg-\\[\\#5C5C5C\\]');
      expect(iconBox).not.toBeNull();
    });

    it('RightInspector: displays neutral "—" for Soundness Proof when executionId is null', async () => {
      act(() => {
        useEvidenceStore.setState({
          executionId: null,
          truthValue: 'NO_EXECUTION',
        });
      });

      await act(async () => {
        root.render(<RightInspector />);
      });

      const provenance = container.querySelector('[data-testid="inspector-section-provenance"]');
      expect(provenance).not.toBeNull();
      expect(provenance?.textContent).not.toContain('100% Zero False Negatives');
      expect(provenance?.textContent).toContain('—');
    });

    it('ExecutionBenchmarksView: displays neutral "Awaiting Execution" for pruning tiers when unexecuted', async () => {
      act(() => {
        useEvidenceStore.setState({
          executionId: null,
          blocksExamined: 0,
          certifiedBlocks: 0,
        });
      });

      await act(async () => {
        root.render(<ExecutionBenchmarksView />);
      });

      // Switch to I/O & Pruning sub-tab
      const tabs = Array.from(container.querySelectorAll('button'));
      const pruningTab = tabs.find((b) => b.textContent?.includes('Pruning'));
      expect(pruningTab).not.toBeUndefined();

      await act(async () => {
        pruningTab?.click();
      });

      expect(container.textContent).toContain('Awaiting Execution');
      expect(container.textContent).not.toContain('Guarded Sound');
    });

    it('RefinementExplorerView: displays neutral "Awaiting Execution" in Invariant cell when unexecuted', async () => {
      act(() => {
        useEvidenceStore.setState({
          executionId: null,
          blocksExamined: 0,
        });
      });

      await act(async () => {
        root.render(<RefinementExplorerView />);
      });

      const strip = container.querySelector('[data-testid="refinement-summary-strip"]');
      expect(strip?.textContent).toContain('Awaiting Execution');
      expect(strip?.textContent).not.toContain('Monotonic Sound');
    });

    it('FormalAuditView: indicates pending execution when certificate is null', async () => {
      act(() => {
        useEvidenceStore.setState({
          certificate: null,
        });
      });

      await act(async () => {
        root.render(<FormalAuditView />);
      });

      const strip = container.querySelector('[data-testid="formal-audit-metric-strip"]');
      expect(strip?.textContent).toContain('Pending');
      expect(strip?.textContent).toContain('Awaiting Query Execution');
    });
  });

  describe('3. Stale State & Invalidation Attack', () => {
    it('editing query text invalidates execution state, certificate, and proof store', () => {
      // Seed store as if a query succeeded
      act(() => {
        useEvidenceStore.setState({
          executionId: 'exec_initial_999',
          queryText: 'FIND (name CA) WITHIN 4.0A OF (name O2)',
          truthValue: 'CERTIFIED TRUE',
          certificate: { certificate_hash: 'abc123hash' },
          blocksExamined: 50,
          certifiedBlocks: 45,
        });
        useProofStore.setState({
          focusedBlockId: 41,
          status: 'CERTIFIED TRUE',
        });
      });

      expect(useEvidenceStore.getState().executionId).toBe('exec_initial_999');

      // Simulate user typing a new character into the query editor
      act(() => {
        useEvidenceStore.getState().setQueryText('FIND (name CA) WITHIN 4.5A OF (name O2)');
      });

      // Assert complete invalidation
      const evState = useEvidenceStore.getState();
      expect(evState.executionId).toBeNull();
      expect(evState.truthValue).toBe('NO_EXECUTION');
      expect(evState.certificate).toBeNull();
      expect(evState.blocksExamined).toBe(0);

      const proofState = useProofStore.getState();
      expect(proofState.status).toBe('NO_EXECUTION');
      expect(proofState.focusedBlockId).toBeNull();
    });
  });

  describe('4. Long-Content & Collapsed Rail Torture', () => {
    it('TopBar handles 150-char trajectory and topology filenames without throwing or overflowing', async () => {
      const longTraj = 'synth_500f_extended_production_md_simulation_with_long_equilibrated_trajectory_name_2026_canonical_npt_ensemble.xtc';
      const longTopo = 'synth_500f_solvated_neutralized_complex_all_atom_charmm36m_extended_topology_header.gro';

      act(() => {
        useScanStore.setState({
          trajectoryId: longTraj,
          topologyId: longTopo,
        });
      });

      await act(async () => {
        root.render(<TopBar />);
      });

      const header = container.querySelector('header');
      expect(header).not.toBeNull();
      expect(header?.children.length).toBe(5);

      // Verify that long strings have title tooltips applied
      const trajSpan = container.querySelector(`span[title="${longTraj}"]`);
      expect(trajSpan).not.toBeNull();
      expect(trajSpan?.className).toContain('truncate');

      const topoSpan = container.querySelector(`span[title="${longTopo}"]`);
      expect(topoSpan).not.toBeNull();
      expect(topoSpan?.className).toContain('truncate');
    });

    it('LeftSidebar in collapsed mode renders title and aria-label on every navigation button', async () => {
      act(() => {
        useUIStore.setState({ isSidebarCollapsed: true });
      });

      await act(async () => {
        root.render(<LeftSidebar />);
      });

      const rail = container.querySelector('[data-testid="left-navigation-rail"]') as HTMLElement;
      expect(rail.className).toContain('w-14');

      const menuItems = container.querySelectorAll('button[role="menuitem"]');
      expect(menuItems.length).toBeGreaterThanOrEqual(10);

      menuItems.forEach((btn) => {

        const title = btn.getAttribute('title');
        const ariaLabel = btn.getAttribute('aria-label');
        expect(title).not.toBeNull();
        expect(title?.length).toBeGreaterThan(0);
        expect(ariaLabel).not.toBeNull();
        expect(ariaLabel?.length).toBeGreaterThan(0);
      });
    });
  });
});
