// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
import {
  SkeletonText,
  SkeletonTitle,
  SkeletonMetric,
  SkeletonTable,
  SkeletonRow,
  SkeletonPanel,
  SkeletonInspector,
  SkeletonViewer,
  SkeletonTree,
  SkeletonQueryEditor,
  useSkeletonDelay,
  SHIMMER_CLASS,
} from '../components/primitives/SkeletonPrimitives';

const SkeletonDelayProbe: React.FC<{ delayMs?: number }> = ({ delayMs = 200 }) => {
  const show = useSkeletonDelay(delayMs);
  if (!show) return <div data-testid="pending-state">Waiting...</div>;
  return <div data-testid="revealed-skeleton">Skeleton Ready</div>;
};

describe('MOCS-Cert Skeleton Primitives Suite (Pass 44)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

  it('1. SkeletonText renders with aria-hidden and shimmer class', async () => {
    await act(async () => {
      root.render(<SkeletonText width="120px" />);
    });
    const el = container.querySelector('span');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('aria-hidden')).toBe('true');
    expect(el?.className).toContain('mocs-skeleton');
  });

  it('2. SkeletonTitle renders h3 element with aria-hidden', async () => {
    await act(async () => {
      root.render(<SkeletonTitle width="200px" />);
    });
    const el = container.querySelector('h3');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('aria-hidden')).toBe('true');
    expect(el?.className).toContain('mocs-skeleton');
  });

  it('3. SkeletonMetric preserves metric cell geometry and static label', async () => {
    await act(async () => {
      root.render(<SkeletonMetric label="I/O SAVINGS" />);
    });
    expect(container.textContent).toContain('I/O SAVINGS');
    const placeholders = container.querySelectorAll('.mocs-skeleton');
    expect(placeholders.length).toBeGreaterThanOrEqual(2);
  });

  it('4. SkeletonTable and SkeletonRow render exact column layout', async () => {
    await act(async () => {
      root.render(<SkeletonTable rows={3} cols={5} />);
    });
    const headerCols = container.querySelectorAll('.bg-\\[\\#FAFAFA\\] .mocs-skeleton');
    expect(headerCols.length).toBe(5);
    const rows = container.querySelectorAll('.divide-y > div');
    expect(rows.length).toBe(3);
  });

  it('5. SkeletonPanel renders panel wrapper with title', async () => {
    await act(async () => {
      root.render(<SkeletonPanel title="Execution DAG" height="220px" />);
    });
    expect(container.textContent).toContain('Execution DAG');
  });

  it('6. SkeletonInspector renders inspector section placeholders', async () => {
    await act(async () => {
      root.render(<SkeletonInspector />);
    });
    const shimmers = container.querySelectorAll('.mocs-skeleton');
    expect(shimmers.length).toBeGreaterThanOrEqual(4);
  });

  it('7. SkeletonViewer renders 3D viewport canvas placeholder', async () => {
    await act(async () => {
      root.render(<SkeletonViewer />);
    });
    expect(container.querySelector('.rounded-full')).not.toBeNull();
  });

  it('8. SkeletonTree renders 5 dyadic sub-block nodes', async () => {
    await act(async () => {
      root.render(<SkeletonTree nodes={5} />);
    });
    const nodes = container.querySelectorAll('.grid > div');
    expect(nodes.length).toBe(5);
  });

  it('9. SkeletonQueryEditor renders Monaco code placeholder lines', async () => {
    await act(async () => {
      root.render(<SkeletonQueryEditor />);
    });
    const lines = container.querySelectorAll('.space-y-1\\.5 > div');
    expect(lines.length).toBe(4);
  });

  it('10. useSkeletonDelay prevents skeleton flash for fast operations', async () => {
    vi.useFakeTimers();
    await act(async () => {
      root.render(<SkeletonDelayProbe delayMs={200} />);
    });

    expect(container.querySelector('[data-testid="pending-state"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="revealed-skeleton"]')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(201);
    });

    expect(container.querySelector('[data-testid="revealed-skeleton"]')).not.toBeNull();
    vi.useRealTimers();
  });
});
