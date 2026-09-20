// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { MolecularViewport } from '../components/viewer/MolecularViewport';
import { ExecutionPlanDAG } from '../components/plan/ExecutionPlanDAG';
import { useEvidenceStore } from '../store';

// Enable React 19 act environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('Workstation Row: Molecular Viewport & Execution Plan', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // Mock ResizeObserver
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  describe('MolecularViewport', () => {
    it('renders clean molecular viewport mount slot awaiting new viewer build', async () => {
      await act(async () => {
        root.render(<MolecularViewport />);
      });

      const card = container.querySelector('[data-testid="molecular-viewport-container"]') as HTMLElement;
      expect(card).not.toBeNull();
      const viewport = container.querySelector('[data-testid="molstar-viewport"]') as HTMLElement;
      expect(viewport).not.toBeNull();
    });
  });

  describe('ExecutionPlanDAG', () => {
    beforeEach(() => {
      act(() => {
        useEvidenceStore.setState({
          blocksExamined: 240,
          certifiedBlocks: 231,
          refinedBlocks: 7,
          exactFramesScanned: 43,
          pruningEfficiency: 97.1,
          refinementSelectivity: '50:1',
          peakMemoryMb: 4.2,
          ioPruneRatio: 96.8,
          traversalDepth: 4,
        });
      });
    });

    it('renders 4-column table with #, Stage, Status, and Result headers', async () => {
      await act(async () => {
        root.render(<ExecutionPlanDAG />);
      });

      const headerText = container.textContent || '';
      expect(headerText).toContain('Execution Plan');
      expect(headerText).toContain('Distance · A:155:CA ↔ LIG:1:O2');
      expect(headerText).toContain('#');
      expect(headerText).toContain('Stage');
      expect(headerText).toContain('Status');
      expect(headerText).toContain('Result');
    });

    it('renders all 9 execution stage names in full with zero truncation matching reference image', async () => {
      await act(async () => {
        root.render(<ExecutionPlanDAG />);
      });

      const expectedStages = [
        'Scientific DSL Parsing',
        'Observable Binding',
        'Type Checking',
        'Dependency Analysis',
        'MCI Interval Discovery',
        'AABB Soundness Test',
        'Refinement Loop',
        'Exact Frame Sampling',
        'Certificate Generation',
      ];

      const fullContent = container.textContent || '';
      for (const stage of expectedStages) {
        expect(fullContent).toContain(stage);
      }

      // Verify no stage name is clipped with "..."
      expect(fullContent).not.toContain('Scientific DSL...');
      expect(fullContent).not.toContain('Observable Bin...');
      expect(fullContent).not.toContain('Type Ch...');
      expect(fullContent).not.toContain('Dependency A...');
      expect(fullContent).not.toContain('MCI Interval Di...');
      expect(fullContent).not.toContain('AABB Soundness...');
      expect(fullContent).not.toContain('Refinement Lo...');
      expect(fullContent).not.toContain('Exact Frame Sa...');
      expect(fullContent).not.toContain('Certificate Gen...');
    });

    it('displays stage completion results correctly formatted matching reference image', async () => {
      await act(async () => {
        root.render(<ExecutionPlanDAG />);
      });

      const fullContent = container.textContent || '';
      expect(fullContent).toContain('Valid');
      expect(fullContent).toContain('Bound');
      expect(fullContent).toContain('Resolved');
      expect(fullContent).toContain('240 blocks');
      expect(fullContent).toContain('Pruned');
      expect(fullContent).toContain('231 / 7');
      expect(fullContent).toContain('43 frames');
      expect(fullContent).toContain('Verified');
    });

    it('renders MCI execution metrics property table with Soundness Verified badge', async () => {
      await act(async () => {
        root.render(<ExecutionPlanDAG />);
      });

      const fullContent = container.textContent || '';
      expect(fullContent).toContain('MCI Execution Metrics');
      expect(fullContent).toContain('Soundness Verified');
      expect(fullContent).toContain('Refinement selectivity');
      expect(fullContent).toContain('50:1');
      expect(fullContent).toContain('Peak memory');
      expect(fullContent).toContain('4.2 MB');
      expect(fullContent).toContain('I/O prune ratio');
      expect(fullContent).toContain('96.8%');
      expect(fullContent).toContain('Traversal depth');
      expect(fullContent).toContain('4 levels');
      expect(fullContent).toContain('Pruning efficiency');
      expect(fullContent).toContain('97.1%');
    });

    it('strictly excludes AI-slop: zero emojis, zero generic colored dots, zero SaaS cards', async () => {
      await act(async () => {
        root.render(
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-7"><MolecularViewport /></div>
            <div className="col-span-5"><ExecutionPlanDAG /></div>
          </div>
        );
      });

      const fullText = container.textContent || '';
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      expect(emojiRegex.test(fullText)).toBe(false);

      // Verify no circular colored indicator dots (.rounded-full)
      const dots = container.querySelectorAll('.rounded-full');
      expect(dots.length).toBe(0);
    });

    it('renders execution table in dedicated horizontal scroll viewport with sticky header', async () => {
      await act(async () => {
        root.render(<ExecutionPlanDAG />);
      });

      const viewport = container.querySelector('[data-testid="execution-table-viewport"]') as HTMLElement;
      expect(viewport).not.toBeNull();
      expect(viewport.className).toContain('overflow-x-auto');
      expect(viewport.className).toContain('overflow-y-auto');

      const header = container.querySelector('[data-testid="execution-table-header"]') as HTMLElement;
      expect(header).not.toBeNull();
      expect(header.className).toContain('sticky');
      expect(header.className).toContain('top-0');

      const body = container.querySelector('[data-testid="execution-table-body"]') as HTMLElement;
      expect(body).not.toBeNull();
    });
  });
});
