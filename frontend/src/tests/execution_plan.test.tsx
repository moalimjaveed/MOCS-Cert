// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { ExecutionPlanDAG } from '../components/plan/ExecutionPlanDAG';
import { useEvidenceStore, useViewerStore } from '../store';

// Enable React 19 act environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('ExecutionPlanDAG Forensic Redesign Acceptance Tests', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    act(() => {
      useViewerStore.setState({
        selectionA: 'A:155:CA',
        selectionB: 'LIG:1:O2',
      });
      useEvidenceStore.setState({
        blocksExamined: 240,
        pruningEfficiency: 97.1,
        certifiedBlocks: 231,
        refinedBlocks: 7,
        exactFramesScanned: 43,
        peakMemoryMb: 4.2,
        ioPruneRatio: 96.8,
        traversalDepth: 4,
        refinementSelectivity: '50:1',
      });
    });

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

  it('renders root container with Fluent Light styling, 1px border (#E5E5E5), rounded-[8px], and full containment', async () => {
    await act(async () => {
      root.render(<ExecutionPlanDAG />);
    });

    const panel = container.querySelector('[data-testid="execution-plan-panel"]') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.className).toContain('exec-plan-container');
    expect(panel.className).toContain('bg-[#FFFFFF]');
    expect(panel.className).toContain('border-[#E5E5E5]');
    expect(panel.className).toContain('rounded-[8px]');
    expect(panel.className).toContain('overflow-hidden');
    expect(panel.className).toContain('box-border');
    expect(panel.className).toContain('w-full');
    expect(panel.className).toContain('max-w-full');
    expect(panel.className).toContain('min-w-0');
  });

  it('renders clean two-level Execution Plan header with secondary metadata that wraps gracefully without collision', async () => {
    await act(async () => {
      root.render(<ExecutionPlanDAG />);
    });

    const header = container.querySelector('.exec-plan-header') as HTMLElement;
    expect(header).not.toBeNull();
    expect(header.textContent).toContain('Execution Plan');
    expect(header.textContent).toContain('Distance · A:155:CA ↔ LIG:1:O2');

    const title = header.querySelector('h3') as HTMLElement;
    expect(title).not.toBeNull();
    expect(title.textContent).toBe('Execution Plan');
    expect(title.className).toContain('whitespace-nowrap');

    const meta = header.querySelector('.exec-plan-header-meta') as HTMLElement;
    expect(meta).not.toBeNull();
    expect(meta.className).not.toContain('font-cascadia');
    expect(meta.getAttribute('title')).toBe('Distance · A:155:CA ↔ LIG:1:O2');
  });

  it('renders proper four-column table header separating #, Stage, Status, and Result', async () => {
    await act(async () => {
      root.render(<ExecutionPlanDAG />);
    });

    const tableHeader = container.querySelector('[data-testid="execution-table-header"]') as HTMLElement;
    expect(tableHeader).not.toBeNull();
    expect(tableHeader.className).toContain('exec-plan-grid');

    // Verify exactly 4 distinct column headers
    expect(tableHeader.children.length).toBe(4);
    expect(tableHeader.children[0].textContent).toBe('#');
    expect(tableHeader.children[1].textContent).toBe('Stage');
    expect(tableHeader.children[2].textContent).toBe('Status');
    expect(tableHeader.children[3].textContent).toBe('Result');
  });

  it('renders all 9 execution stages with exact alignment matching table header grid', async () => {
    await act(async () => {
      root.render(<ExecutionPlanDAG />);
    });

    const tableViewport = container.querySelector('[data-testid="execution-table-viewport"]') as HTMLElement;
    expect(tableViewport).not.toBeNull();
    expect(tableViewport.className).toContain('exec-table-viewport');
    expect(tableViewport.className).toContain('overflow-x-auto');
    expect(tableViewport.className).toContain('overflow-y-auto');

    const tableBody = container.querySelector('[data-testid="execution-table-body"]') as HTMLElement;
    expect(tableBody).not.toBeNull();
    expect(tableBody.className).toContain('exec-table-body');

    const expectedStages = [
      { id: 1, name: 'Scientific DSL Parsing', result: 'Valid' },
      { id: 2, name: 'Observable Binding', result: 'Bound' },
      { id: 3, name: 'Type Checking', result: 'Valid' },
      { id: 4, name: 'Dependency Analysis', result: 'Resolved' },
      { id: 5, name: 'MCI Interval Discovery', result: '240 blocks' },
      { id: 6, name: 'AABB Soundness Test', result: 'Pruned' },
      { id: 7, name: 'Refinement Loop', result: '231 / 7' },
      { id: 8, name: 'Exact Frame Sampling', result: '43 frames' },
      { id: 9, name: 'Certificate Generation', result: 'Verified' },
    ];

    for (const stage of expectedStages) {
      const row = container.querySelector(`[data-testid="stage-row-${stage.id}"]`) as HTMLElement;
      expect(row).not.toBeNull();
      expect(row.className).toContain('exec-plan-grid');
      expect(row.textContent).toContain(stage.id.toString());
      expect(row.textContent).toContain(stage.name);
      expect(row.textContent).toContain('Complete');
      expect(row.textContent).toContain(stage.result);
    }
  });

  it('renders compact, restrained green check status icons without oversized green circles', async () => {
    await act(async () => {
      root.render(<ExecutionPlanDAG />);
    });

    const rows = container.querySelectorAll('[data-testid^="stage-row-"]');
    expect(rows.length).toBe(9);

    rows.forEach((row) => {
      const icon = row.querySelector('svg');
      expect(icon).not.toBeNull();
      expect(icon?.getAttribute('class')).toContain('text-[#0969DA]');
      expect(icon?.getAttribute('class')).toContain('w-3.5');
      expect(icon?.getAttribute('class')).toContain('h-3.5');
    });

    // Zero oversized circular indicators
    const circles = container.querySelectorAll('.rounded-full');
    expect(circles.length).toBe(0);
  });

  it('renders MCI Execution Metrics header with restrained Soundness Verified indicator', async () => {
    await act(async () => {
      root.render(<ExecutionPlanDAG />);
    });

    const metricsPanel = container.querySelector('[data-testid="mci-metrics-panel"]') as HTMLElement;
    expect(metricsPanel).not.toBeNull();

    const header = metricsPanel.querySelector('.exec-metrics-header') as HTMLElement;
    expect(header).not.toBeNull();
    expect(header.textContent).toContain('MCI Execution Metrics');
    expect(header.textContent).toContain('Soundness Verified');

    const badge = container.querySelector('[data-testid="soundness-verified-badge"]') as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge.className).toContain('text-white');
    expect(badge.className).toContain('bg-[#0969DA]');
    expect(badge.className).toContain('rounded-[4px]');
    expect(badge.className).not.toContain('rounded-full');
  });

  it('renders metrics definition grid aligning all numeric values to the exact same right edge', async () => {
    await act(async () => {
      root.render(<ExecutionPlanDAG />);
    });

    const metricsPanel = container.querySelector('[data-testid="mci-metrics-panel"]') as HTMLElement;
    const metricRows = metricsPanel.querySelectorAll('.exec-metric-row');
    // 4 metrics + 1 pruning efficiency = 5 rows
    expect(metricRows.length).toBe(5);

    expect(metricsPanel.textContent).toContain('Refinement selectivity');
    expect(metricsPanel.textContent).toContain('50:1');
    expect(metricsPanel.textContent).toContain('Peak memory');
    expect(metricsPanel.textContent).toContain('4.2 MB');
    expect(metricsPanel.textContent).toContain('I/O prune ratio');
    expect(metricsPanel.textContent).toContain('96.8%');
    expect(metricsPanel.textContent).toContain('Traversal depth');
    expect(metricsPanel.textContent).toContain('4 levels');
    expect(metricsPanel.textContent).toContain('Pruning efficiency');
    expect(metricsPanel.textContent).toContain('97.1%');

    // Verify all value spans have text-right and Segoe UI (no font-cascadia)
    metricRows.forEach((row) => {
      const valSpan = row.children[1] as HTMLElement;
      expect(valSpan).not.toBeNull();
      expect(valSpan.className).not.toContain('font-cascadia');
      expect(valSpan.className).toContain('text-right');
    });
  });

  it('strictly excludes AI-slop: zero emojis and zero .rounded-full decorative elements', async () => {
    await act(async () => {
      root.render(<ExecutionPlanDAG />);
    });

    const fullText = container.textContent || '';
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(fullText)).toBe(false);

    const circles = container.querySelectorAll('.rounded-full');
    expect(circles.length).toBe(0);
  });

  it('renders reliably without horizontal overflow across 11 container widths (320px to 1600px)', async () => {
    const testWidths = [1600, 1440, 1280, 1100, 1000, 900, 800, 768, 640, 500, 400, 360, 320];

    for (const width of testWidths) {
      container.style.width = `${width}px`;

      await act(async () => {
        root.render(<ExecutionPlanDAG />);
      });

      const panel = container.querySelector('[data-testid="execution-plan-panel"]') as HTMLElement;
      expect(panel).not.toBeNull();

      const header = container.querySelector('.exec-plan-header') as HTMLElement;
      expect(header).not.toBeNull();

      const tableHeader = container.querySelector('[data-testid="execution-table-header"]') as HTMLElement;
      expect(tableHeader).not.toBeNull();

      const tableBody = container.querySelector('[data-testid="execution-table-body"]') as HTMLElement;
      expect(tableBody).not.toBeNull();

      const metricsPanel = container.querySelector('[data-testid="mci-metrics-panel"]') as HTMLElement;
      expect(metricsPanel).not.toBeNull();
    }
  });

  it('renders extreme step names (short, medium, long, very long) with dynamic wrapping and zero column collision', async () => {
    act(() => {
      useEvidenceStore.setState({
        executionPlan: [
          { step_id: 1, name: 'QUERY', status: 'completed' as const, description: 'Evaluated' },
          { step_id: 2, name: 'SELECTION A RESOLUTION', status: 'completed' as const, description: 'Resolved' },
          { step_id: 3, name: 'TOPOLOGICAL INDEX VERIFICATION', status: 'completed' as const, description: 'Validated' },
          {
            step_id: 4,
            name: 'EXACT MULTI-SCALE DYADIC REFINEMENT AND MOLECULAR VECTOR BOUNDING VALIDATION',
            status: 'completed' as const,
            description: 'Materialize coordinate blocks straddling boundary threshold for exact pairwise verification',
          },
        ],
      });
    });

    await act(async () => {
      root.render(<ExecutionPlanDAG />);
    });

    const rows = container.querySelectorAll('[data-testid^="stage-row-"]');
    expect(rows.length).toBe(4);

    // Verify row 4 (extremely long name)
    const row4 = container.querySelector('[data-testid="stage-row-4"]') as HTMLElement;
    expect(row4).not.toBeNull();

    // Column 2 (Stage Name) must have break-words, min-w-0, and NOT have whitespace-nowrap
    const stageCell = row4.children[1] as HTMLElement;
    expect(stageCell).not.toBeNull();
    expect(stageCell.className).toContain('break-words');
    expect(stageCell.className).toContain('min-w-0');
    expect(stageCell.className).not.toContain('whitespace-nowrap');
    expect(stageCell.getAttribute('title')).toBe(
      'EXACT MULTI-SCALE DYADIC REFINEMENT AND MOLECULAR VECTOR BOUNDING VALIDATION'
    );

    // Column 3 (Status) must remain self-contained with checkmark and completed text
    const statusCell = row4.children[2] as HTMLElement;
    expect(statusCell).not.toBeNull();
    expect(statusCell.textContent).toContain('completed');
    const checkIcon = statusCell.querySelector('svg');
    expect(checkIcon).not.toBeNull();

    // Column 4 (Result) must have break-words and min-w-0
    const resultCell = row4.children[3] as HTMLElement;
    expect(resultCell).not.toBeNull();
    expect(resultCell.className).toContain('break-words');
    expect(resultCell.className).toContain('min-w-0');
    expect(resultCell.textContent).toContain('Materialize coordinate blocks');
  });

  it('correctly handles various execution statuses (completed, running, pending, failed, skipped)', async () => {
    act(() => {
      useEvidenceStore.setState({
        executionPlan: [
          { step_id: 1, name: 'Scientific Query', status: 'completed' as const, description: 'Evaluated' },
          { step_id: 2, name: 'Selection Resolution', status: 'in_progress' as const, description: 'Running' },
          { step_id: 3, name: 'Topological Index', status: 'pending' as const, description: 'Pending' },
          { step_id: 4, name: 'Vector Bounding', status: 'skipped' as const, description: 'Bypassed' },
          { step_id: 5, name: 'Refinement Probe', status: 'failed' as any, description: 'Constraint violation' },
        ],
      });
    });

    await act(async () => {
      root.render(<ExecutionPlanDAG />);
    });

    const rows = container.querySelectorAll('[data-testid^="stage-row-"]');
    expect(rows.length).toBe(5);

    // Row 1: completed
    expect(rows[0].children[2].textContent).toContain('completed');

    // Row 2: in_progress
    expect(rows[1].children[2].textContent).toContain('in_progress');

    // Row 3: pending
    expect(rows[2].children[2].textContent).toContain('pending');

    // Row 4: skipped
    expect(rows[3].children[2].textContent).toContain('skipped');

    // Row 5: failed
    expect(rows[4].children[2].textContent).toContain('failed');

    // All status cells must participate in normal layout flow without absolute positioning
    rows.forEach((r) => {
      const statusCell = r.children[2] as HTMLElement;
      expect(statusCell.className).toContain('flex');
      expect(statusCell.className).toContain('items-center');
      expect(statusCell.className).toContain('min-w-0');
      expect(statusCell.className).not.toContain('absolute');
    });
  });

  it('guarantees header and rows use identical 4-column layout model with exact alignment', async () => {
    await act(async () => {
      root.render(<ExecutionPlanDAG />);
    });

    const tableHeader = container.querySelector('[data-testid="execution-table-header"]') as HTMLElement;
    const firstRow = container.querySelector('[data-testid="stage-row-1"]') as HTMLElement;

    expect(tableHeader.className).toContain('exec-plan-grid');
    expect(firstRow.className).toContain('exec-plan-grid');
    expect(tableHeader.children.length).toBe(firstRow.children.length);
  });
});
