// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { DyadicZoomLattice } from '../components/timeline/DyadicZoomLattice';
import { RefinementExplorerView } from '../components/views/RefinementExplorerView';
import { useTimelineStore, useProofStore, useEvidenceStore } from '../store';

// Enable React 19 act environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Mock api client to avoid network errors in jsdom
vi.mock('../api/client', () => ({
  fetchBlocks: vi.fn().mockResolvedValue([]),
  refineBlock: vi.fn().mockResolvedValue({ child_blocks: [] }),
}));

describe('PASS 43B.2: Refinement Explorer Final Geometry Rebuild Test Suite', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      useTimelineStore.setState({
        selectedBlockId: 41,
        activeSubBlocks: [],
        isRefining: false,
      });

      useProofStore.setState({
        focusedBlockId: 41,
        lowerBound: 3.65,
        upperBound: 4.35,
        threshold: 4.0,
      });

      useEvidenceStore.setState({
        executionId: 'exec-test-43b2',
        blocksExamined: 240,
        certifiedBlocks: 231,
        refinedBlocks: 7,
        exactFramesScanned: 43,
        pruningEfficiency: 96.2,
      });
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders all 5 canonical dyadic sub-blocks with intentional "SUB 41.x" titles and equal geometry', async () => {
    await act(async () => {
      root.render(<DyadicZoomLattice />);
    });

    const tree = container.querySelector('[data-testid="dyadic-refinement-tree"]');
    expect(tree).not.toBeNull();

    const expectedIds = ['41.0', '41.1', '41.2', '41.3', '41.4'];
    expectedIds.forEach((id) => {
      const card = container.querySelector(`[data-testid="dyadic-sub-block-${id}"]`);
      expect(card).not.toBeNull();
      // Equal height and flex-col layout
      expect(card?.className).toContain('min-h-[118px]');
      expect(card?.className).toContain('flex-col');

      // Intentional compact title: "SUB 41.x", never "SUB-BLOCK", never clipped as "SUB-BLO..."
      expect(card?.textContent).toContain(`SUB ${id}`);
      expect(card?.textContent).not.toContain(`SUB-BLOCK ${id}`);
      expect(card?.textContent).not.toContain('SUB-BLO...');
    });
  });

  it('guarantees header uses grid-cols-[minmax(0,1fr)_auto] preventing badge clipping', async () => {
    await act(async () => {
      root.render(<DyadicZoomLattice />);
    });

    const subBlock412 = container.querySelector('[data-testid="dyadic-sub-block-41.2"]') as HTMLElement;
    expect(subBlock412).not.toBeNull();

    // First child of card is the header grid
    const header = subBlock412.firstElementChild as HTMLElement;
    expect(header).not.toBeNull();
    expect(header.className).toContain('grid');
    expect(header.className).toContain('grid-cols-[minmax(0,1fr)_auto]');
  });

  it('applies non-layout-affecting selection outline via inset box-shadow (zero border-width shift)', async () => {
    await act(async () => {
      root.render(<DyadicZoomLattice />);
    });

    // Default selected child is 41.2
    const selected = container.querySelector('[data-testid="dyadic-sub-block-41.2"]') as HTMLElement;
    const unselected = container.querySelector('[data-testid="dyadic-sub-block-41.0"]') as HTMLElement;

    expect(selected.getAttribute('aria-pressed')).toBe('true');
    expect(unselected.getAttribute('aria-pressed')).toBe('false');

    // Selection uses inset shadow and border-[#005FB8] without changing box-sizing
    expect(selected.className).toContain('shadow-[inset_0_0_0_1.5px_#005FB8]');
    expect(selected.className).not.toContain('border-2');
    expect(selected.className).not.toContain('border-3');
    expect(selected.className).not.toContain('border-4');
  });

  it('guarantees rigid metadata grid alignment with fixed 58px label column and min-width: 0', async () => {
    await act(async () => {
      root.render(<DyadicZoomLattice />);
    });

    const cards = container.querySelectorAll('button[data-testid^="dyadic-sub-block-"]');
    expect(cards.length).toBe(5);

    cards.forEach((card) => {
      expect(card.innerHTML).toContain('grid-cols-[58px_minmax(0,1fr)]');
      expect(card.textContent).toContain('INTERVAL');
      expect(card.textContent).toContain('FRAMES');
      expect(card.textContent).toContain('OFFSET');
    });
  });

  it('renders solid epistemic status badges per RULE.md color system', async () => {
    await act(async () => {
      root.render(<DyadicZoomLattice />);
    });

    // 41.0 is FALSE -> bg-[#E11D48]
    const cardFalse = container.querySelector('[data-testid="dyadic-sub-block-41.0"]') as HTMLElement;
    expect(cardFalse.innerHTML).toContain('bg-[#E11D48]');
    expect(cardFalse.textContent).toContain('FALSE');

    // 41.1 is UNKNOWN -> bg-[#D97706]
    const cardUnknown = container.querySelector('[data-testid="dyadic-sub-block-41.1"]') as HTMLElement;
    expect(cardUnknown.innerHTML).toContain('bg-[#D97706]');
    expect(cardUnknown.textContent).toContain('UNKNOWN');

    // 41.2 is TRUE -> bg-[#0969DA]
    const cardTrue = container.querySelector('[data-testid="dyadic-sub-block-41.2"]') as HTMLElement;
    expect(cardTrue.innerHTML).toContain('bg-[#0969DA]');
    expect(cardTrue.textContent).toContain('TRUE');
  });

  it('renders two-level parent node separating primary range from computational parameters', async () => {
    await act(async () => {
      root.render(<DyadicZoomLattice />);
    });

    expect(container.textContent).toContain('Parent Block 41');
    expect(container.textContent).toContain('410.0–420.0 ns');
    expect(container.textContent).toContain('[3.65, 4.35] Å');
    expect(container.textContent).toContain('5 Sub-blocks');
    expect(container.textContent).toContain('Δt = 2.0 ns');
    expect(container.textContent).toContain('Level 0 (Coarse Bound) → Level 1 (Dyadic Fine Evaluation)');
  });

  it('contains dedicated internal refinement viewport preventing window-level overflow', async () => {
    await act(async () => {
      root.render(<DyadicZoomLattice />);
    });

    const viewport = container.querySelector('.refinement-viewport');
    expect(viewport).not.toBeNull();
    expect(viewport?.className).toContain('overflow-x-auto');
    expect(viewport?.innerHTML).toContain('min-w-[960px]');
  });

  it('renders SVG branching tree connector communicating dyadic subdivision', async () => {
    await act(async () => {
      root.render(<DyadicZoomLattice />);
    });

    const svg = container.querySelector('[data-testid="dyadic-tree-connector-svg"]');
    expect(svg).not.toBeNull();
    const lines = svg?.querySelectorAll('line');
    // 1 center stem + 1 horizontal branch + 5 child drops = 7 lines
    expect(lines?.length).toBe(7);
  });

  it('triggers onChildSelect callback with frame range on sub-block click', async () => {
    const onSelectMock = vi.fn();

    await act(async () => {
      root.render(<DyadicZoomLattice onChildSelect={onSelectMock} />);
    });

    const card413 = container.querySelector('[data-testid="dyadic-sub-block-41.3"]') as HTMLElement;
    expect(card413).not.toBeNull();

    await act(async () => {
      card413.click();
    });

    expect(onSelectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        child_id: '41.3',
        frame_start: 41600,
        frame_end_exclusive: 41800,
      })
    );
  });

  it('RefinementExplorerView connects selected child to TimelineLattice highlight', async () => {
    await act(async () => {
      root.render(<RefinementExplorerView />);
    });

    expect(container.querySelector('[data-testid="refinement-explorer-view"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="dyadic-refinement-tree"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="temporal-lattice-panel"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="interval-semantics-card"]')).not.toBeNull();

    // Click 41.4 to test context connection
    const card414 = container.querySelector('[data-testid="dyadic-sub-block-41.4"]') as HTMLElement;
    await act(async () => {
      card414.click();
    });

    // Timeline panel should update with sub-block context
    const timelinePanel = container.querySelector('[data-testid="temporal-lattice-panel"]');
    expect(timelinePanel?.textContent).toContain('Sub-block 41.4');
  });
});
