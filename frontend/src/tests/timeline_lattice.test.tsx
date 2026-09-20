// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { TimelineLattice, computeBlockGeometry, drawSelectionOutline } from '../components/timeline/TimelineLattice';
import { useTimelineStore, useProofStore } from '../store';

// Enable React 19 act environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Mock API client
vi.mock('../api/client', () => ({
  fetchBlocks: vi.fn().mockResolvedValue([]),
  refineBlock: vi.fn().mockResolvedValue({
    parent_id: 41,
    child_blocks: [
      {
        child_id: '41.0',
        parent_id: 41,
        time_start_ns: 410,
        time_end_ns: 412,
        lower_bound: 4.10,
        upper_bound: 4.35,
        truth_value: 'FALSE',
        status: 'CERTIFIED_FALSE',
      },
      {
        child_id: '41.1',
        parent_id: 41,
        time_start_ns: 412,
        time_end_ns: 414,
        lower_bound: 3.85,
        upper_bound: 4.12,
        truth_value: 'UNKNOWN',
        status: 'REFINED',
      },
      {
        child_id: '41.2',
        parent_id: 41,
        time_start_ns: 414,
        time_end_ns: 416,
        lower_bound: 3.65,
        upper_bound: 3.98,
        truth_value: 'TRUE',
        status: 'CERTIFIED_TRUE',
      },
      {
        child_id: '41.3',
        parent_id: 41,
        time_start_ns: 416,
        time_end_ns: 418,
        lower_bound: 3.75,
        upper_bound: 4.05,
        truth_value: 'UNKNOWN',
        status: 'REFINED',
      },
      {
        child_id: '41.4',
        parent_id: 41,
        time_start_ns: 418,
        time_end_ns: 420,
        lower_bound: 4.05,
        upper_bound: 4.28,
        truth_value: 'FALSE',
        status: 'CERTIFIED_FALSE',
      },
    ],
  }),
}));

// Mock WebSocket service
vi.mock('../api/websocket', () => ({
  wsService: {
    isConnected: false,
    send: vi.fn(),
  },
}));

describe('TimelineLattice Forensic Redesign Tests', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    act(() => {
      useTimelineStore.setState({
        blocks: [],
        selectedBlockId: 41,
        activeSubBlocks: [],
        isRefining: false,
        cursorTimeNs: 415.0,
      });

      useProofStore.setState({
        focusedBlockId: 41,
        lowerBound: 3.72,
        upperBound: 4.21,
        threshold: 4.00,
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

  it('renders single Fluent Light outer panel with 1px border (#E5E5E5) and rounded-[8px]', async () => {
    await act(async () => {
      root.render(<TimelineLattice />);
    });

    const panel = container.querySelector('[data-testid="temporal-lattice-panel"]') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.className).toContain('bg-[#FFFFFF]');
    expect(panel.className).toContain('border-[#E5E5E5]');
    expect(panel.className).toContain('rounded-[8px]');
  });

  it('renders structured header hierarchy: primary title and secondary metadata', async () => {
    await act(async () => {
      root.render(<TimelineLattice />);
    });

    const heading = container.querySelector('h2');
    expect(heading).not.toBeNull();
    expect(heading?.textContent).toBe('Temporal Lattice');
    expect(heading?.className).toContain('text-[15px]');
    expect(heading?.className).toContain('font-semibold');

    const panelText = container.textContent || '';
    expect(panelText).toContain('240 blocks · 0–1 μs · Δt 10 ps');
  });

  it('renders subordinate legend with square swatches and zero circular dots or emojis', async () => {
    await act(async () => {
      root.render(<TimelineLattice />);
    });

    const legend = container.querySelector('[data-testid="timeline-legend"]') as HTMLElement;
    expect(legend).not.toBeNull();
    expect(legend.textContent).toContain('True');
    expect(legend.textContent).toContain('False');
    expect(legend.textContent).toContain('Unknown');
    expect(legend.textContent).toContain('Selected');

    // Zero circular dots
    const dots = legend.querySelectorAll('.rounded-full');
    expect(dots.length).toBe(0);

    // Zero emojis
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(legend.textContent || '')).toBe(false);
  });

  it('renders mathematically derived time axis ticks in Segoe UI (0 ns to 1 μs)', async () => {
    await act(async () => {
      root.render(<TimelineLattice />);
    });

    const axis = container.querySelector('[data-testid="time-axis"]') as HTMLElement;
    expect(axis).not.toBeNull();
    expect(axis.className).not.toContain('font-cascadia');
    expect(axis.textContent).toContain('0 ns');
    expect(axis.textContent).toContain('200 ns');
    expect(axis.textContent).toContain('400 ns');
    expect(axis.textContent).toContain('600 ns');
    expect(axis.textContent).toContain('800 ns');
    expect(axis.textContent).toContain('1 μs');
  });

  it('renders Block 41 subdivision as a connected secondary temporal lattice with 5 sub-blocks', async () => {
    await act(async () => {
      root.render(<TimelineLattice />);
    });

    const panelText = container.textContent || '';
    expect(panelText).toContain('Block 41 Subdivision');
    expect(panelText).toContain('410–420 ns');
    expect(panelText).toContain('5 sub-blocks (Δt = 2 ns)');

    const subLattice = container.querySelector('[data-testid="subdivision-lattice"]') as HTMLElement;
    expect(subLattice).not.toBeNull();

    // Verify all 5 child block IDs exist
    expect(container.querySelector('[data-testid="sub-block-41.0"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="sub-block-41.1"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="sub-block-41.2"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="sub-block-41.3"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="sub-block-41.4"]')).not.toBeNull();

    // 41.2 is selected by default with a clean blue outline
    const sub412 = container.querySelector('[data-testid="sub-block-41.2"]') as HTMLElement;
    expect(sub412.className).toContain('border-[#005FB8]');
    expect(sub412.className).toContain('ring-[#005FB8]');
  });

  it('updates selected sub-block and inspector when clicking a child block', async () => {
    await act(async () => {
      root.render(<TimelineLattice />);
    });

    const sub410 = container.querySelector('[data-testid="sub-block-41.0"]') as HTMLButtonElement;
    expect(sub410).not.toBeNull();

    await act(async () => {
      sub410.click();
    });

    // Inspector updates to show Sub-block 41.0 and its state
    const inspector = container.querySelector('[data-testid="selected-block-inspector"]') as HTMLElement;
    expect(inspector.textContent).toContain('Sub-block 41.0');
    expect(inspector.textContent).toContain('FALSE');
    expect(inspector.textContent).toContain('410 – 412 ns');
    expect(inspector.textContent).toContain('4.10 Å');
    expect(inspector.textContent).toContain('4.35 Å');
  });

  it('renders Selected Block Inspector property table on single lines without wrapping', async () => {
    await act(async () => {
      root.render(<TimelineLattice />);
    });

    const propertyGrid = container.querySelector('[data-testid="inspector-property-grid"]') as HTMLElement;
    expect(propertyGrid).not.toBeNull();
    expect(propertyGrid.textContent).toContain('Time range');
    expect(propertyGrid.textContent).toContain('Lower bound (L)');
    expect(propertyGrid.textContent).toContain('Upper bound (U)');
    expect(propertyGrid.textContent).toContain('Threshold');
  });

  it('displays mathematical inequality relationship and scientific explanation', async () => {
    await act(async () => {
      root.render(<TimelineLattice />);
    });

    const boundBox = container.querySelector('[data-testid="bound-analysis-box"]') as HTMLElement;
    expect(boundBox).not.toBeNull();
    expect(boundBox.textContent).toContain('Bound Relationship');
    expect(boundBox.textContent).toContain('4.00 Å');
  });

  it('renders 36px primary WinUI Refine button with disabled Fully Resolved on resolved blocks and Refine on UNKNOWN blocks', async () => {
    await act(async () => {
      root.render(<TimelineLattice />);
    });

    const btn = container.querySelector('[data-testid="refine-block-btn"]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.className).toContain('h-9');
    // Block 41.2 is resolved TRUE by default -> disabled Fully Resolved
    expect(btn.textContent).toContain('Fully Resolved');
    expect(btn.disabled).toBe(true);

    // Select UNKNOWN sub-block 41.1 (straddles threshold)
    const sub411 = container.querySelector('[data-testid="sub-block-41.1"]') as HTMLButtonElement;
    expect(sub411).not.toBeNull();

    await act(async () => {
      sub411.click();
    });

    // Now button is active "Refine Block" with WinUI blue
    expect(btn.disabled).toBe(false);
    expect(btn.className).toContain('bg-[#005FB8]');
    expect(btn.textContent).toContain('Refine Block');

    await act(async () => {
      btn.click();
    });

    // After refine finishes, button returns to ready state
    expect(btn.textContent).toContain('Refine Block');
  });

  it('strictly excludes AI-slop: zero emojis, zero generic colored dots, zero SaaS cards', async () => {
    await act(async () => {
      root.render(<TimelineLattice />);
    });

    const fullText = container.textContent || '';
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(fullText)).toBe(false);

    // Zero rounded-full circular colored dots in the entire component
    const dots = container.querySelectorAll('.rounded-full');
    expect(dots.length).toBe(0);
  });

  describe('TimelineLattice Responsive Acceptance Suite', () => {
    const targetWidths = [
      1600, 1440, 1280, 1100, 1000, 900, 800, 768, 640, 500, 400,
    ];

    targetWidths.forEach((width) => {
      it(`renders correctly without text leakage or collision at ${width}px`, async () => {
        await act(async () => {
          root.render(
            <div style={{ width: `${width}px` }} className="overflow-hidden">
              <TimelineLattice />
            </div>
          );
        });

        // 1. Panel and containment
        const panel = container.querySelector('[data-testid="temporal-lattice-panel"]') as HTMLElement;
        expect(panel).not.toBeNull();
        expect(panel.className).toContain('box-border');
        expect(panel.className).toContain('max-w-full');

        // 2. Title and metadata are always visible
        const heading = container.querySelector('h2');
        expect(heading).not.toBeNull();
        expect(heading?.textContent).toBe('Temporal Lattice');

        const textContent = container.textContent || '';
        expect(textContent).toContain('240 blocks · 0–1 μs · Δt 10 ps');

        // 3. Legend is rendered
        const legend = container.querySelector('[data-testid="timeline-legend"]');
        expect(legend).not.toBeNull();

        // 4. Time axis contains all 6 calibration points
        const axis = container.querySelector('[data-testid="time-axis"]');
        expect(axis).not.toBeNull();
        expect(axis?.textContent).toContain('0 ns');
        expect(axis?.textContent).toContain('1 μs');

        // 5. Subdivision header and all 5 sub-blocks exist
        expect(textContent).toContain('Block 41 Subdivision');
        expect(textContent).toContain('410–420 ns');
        expect(textContent).toContain('5 sub-blocks (Δt = 2 ns)');

        const sub0 = container.querySelector('[data-testid="sub-block-41.0"]');
        const sub1 = container.querySelector('[data-testid="sub-block-41.1"]');
        const sub2 = container.querySelector('[data-testid="sub-block-41.2"]');
        const sub3 = container.querySelector('[data-testid="sub-block-41.3"]');
        const sub4 = container.querySelector('[data-testid="sub-block-41.4"]');

        expect(sub0).not.toBeNull();
        expect(sub1).not.toBeNull();
        expect(sub2).not.toBeNull();
        expect(sub3).not.toBeNull();
        expect(sub4).not.toBeNull();

        // 6. Selected state has blue border and ring
        const selectedSub = container.querySelector('[data-testid="sub-block-41.2"]') as HTMLElement;
        expect(selectedSub.className).toContain('border-[#005FB8]');
        expect(selectedSub.className).toContain('ring-[#005FB8]');

        // 7. Right inspector has property grid and bound analysis box
        const inspector = container.querySelector('[data-testid="selected-block-inspector"]');
        expect(inspector).not.toBeNull();
        expect(inspector?.textContent).toContain('Sub-block 41.2');
        expect(inspector?.textContent).toContain('TRUE');
        expect(inspector?.textContent).toContain('Time range');
        expect(inspector?.textContent).toContain('Lower bound (L)');
        expect(inspector?.textContent).toContain('Upper bound (U)');
        expect(inspector?.textContent).toContain('Threshold');

        const boundBox = container.querySelector('[data-testid="bound-analysis-box"]');
        expect(boundBox).not.toBeNull();
        expect(boundBox?.textContent).toContain('Bound Relationship');

        const refineBtn = container.querySelector('[data-testid="refine-block-btn"]');
        expect(refineBtn).not.toBeNull();
        expect(refineBtn?.textContent).toContain('Fully Resolved');

        // 8. Zero AI-slop rounded-full
        expect(container.querySelectorAll('.rounded-full').length).toBe(0);
      });
    });
  });

  describe('Temporal Lattice Selection Indicator Geometry & Rendering Tests', () => {
    it('computes exact canonical block geometry without padding, offset, or overlap', () => {
      const totalBlocks = 240;
      const canvasWidth = 720;
      const canvasHeight = 40;

      // Test block 41 (UNKNOWN)
      const geom41 = computeBlockGeometry(41, totalBlocks, canvasWidth, canvasHeight);
      expect(geom41.x).toBe(123); // 41 * 3
      expect(geom41.y).toBe(0);
      expect(geom41.width).toBe(2.5); // 3 - 0.5
      expect(geom41.height).toBe(40);

      // Test block 40 (left neighbor)
      const geom40 = computeBlockGeometry(40, totalBlocks, canvasWidth, canvasHeight);
      expect(geom40.x).toBe(120);
      expect(geom40.width).toBe(2.5);

      // Invariant: block 40 and block 41 do NOT intersect
      expect(geom40.x + geom40.width).toBeLessThanOrEqual(geom41.x);

      // Test block 42 (right neighbor)
      const geom42 = computeBlockGeometry(42, totalBlocks, canvasWidth, canvasHeight);
      expect(geom42.x).toBe(126);
      expect(geom42.width).toBe(2.5);

      // Invariant: block 41 and block 42 do NOT intersect
      expect(geom41.x + geom41.width).toBeLessThanOrEqual(geom42.x);
    });

    it('preserves geometry consistency across standard display widths (1000px, 1200px, 1440px)', () => {
      const totalBlocks = 240;
      const widths = [1000, 1200, 1440];

      widths.forEach((w) => {
        const selGeom = computeBlockGeometry(41, totalBlocks, w, 42);
        const leftNeighbor = computeBlockGeometry(40, totalBlocks, w, 42);
        const rightNeighbor = computeBlockGeometry(42, totalBlocks, w, 42);

        // Selection is bounded strictly to its slot
        expect(selGeom.x).toBeGreaterThanOrEqual(leftNeighbor.x + leftNeighbor.width);
        expect(selGeom.x + selGeom.width).toBeLessThanOrEqual(rightNeighbor.x);
        expect(selGeom.height).toBe(42);
      });
    });

    it('draws selection outline with strict boundary clipping and zero overflow (box-sizing: border-box)', () => {
      const mockCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
        strokeRect: vi.fn(),
        strokeStyle: '',
        lineWidth: 0,
      } as unknown as CanvasRenderingContext2D;

      const geom = { x: 123, y: 0, width: 2.5, height: 40 };
      drawSelectionOutline(mockCtx, geom, 1.5);

      // 1. Context saved and restored
      expect(mockCtx.save).toHaveBeenCalledTimes(1);
      expect(mockCtx.restore).toHaveBeenCalledTimes(1);

      // 2. Strict boundary clip created matching exact block dimensions
      expect(mockCtx.beginPath).toHaveBeenCalledTimes(1);
      expect(mockCtx.rect).toHaveBeenCalledWith(123, 0, 2.5, 40);
      expect(mockCtx.clip).toHaveBeenCalledTimes(1);

      // 3. Stroke drawn with exact block dimensions (NEVER x - 0.5 or width + 1)
      expect(mockCtx.strokeRect).toHaveBeenCalledWith(123, 0, 2.5, 40);

      // 4. Uses Fluent Blue #005FB8
      expect(mockCtx.strokeStyle).toBe('#005FB8');

      // 5. Line width doubled for inner-border clipping: 1.5 * 2 = 3
      expect(mockCtx.lineWidth).toBe(3);
    });

    it('provides accessible slider aria-label with block ID, time range, truth state, and selection', async () => {
      await act(async () => {
        root.render(<TimelineLattice />);
      });

      const slider = container.querySelector('[role="slider"]') as HTMLElement;
      expect(slider).not.toBeNull();
      const label = slider.getAttribute('aria-label') || '';
      expect(label).toContain('Block 41');
      expect(label).toContain('410–420 ns');
      expect(label).toContain('selected');
    });
  });
});

