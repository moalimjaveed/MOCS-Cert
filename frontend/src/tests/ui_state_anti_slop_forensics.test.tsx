// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { TopBar } from '../components/layout/TopBar';
import { MonacoQueryEditor } from '../components/editor/MonacoQueryEditor';
import { BottomAnalysisPanel } from '../components/evidence/BottomAnalysisPanel';
import { MolecularViewport } from '../components/viewer/MolecularViewport';
import { useEvidenceStore } from '../store';

// Enable React 19 act environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('UI State, Surface, Typography & Anti-AI-Slop Forensic Suite', () => {
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
    vi.restoreAllMocks();
  });

  it('1. TopBar "Index ready · Source verified" uses solid Deep Cobalt fill and white text', async () => {
    await act(async () => {
      root.render(<TopBar />);
    });

    const indexBadge = container.querySelector('.bg-\\[\\#0969DA\\]');
    expect(indexBadge).not.toBeNull();
    expect(indexBadge?.textContent).toContain('Index ready');
    expect(indexBadge?.textContent).toContain('Source verified');
    expect(indexBadge?.className).toContain('text-white');
    expect(indexBadge?.className).not.toContain('bg-[#F8FAFC]');
    expect(indexBadge?.className).not.toContain('text-[#0969DA]');
  });

  it('2. MonacoQueryEditor "Valid query · Sound" uses solid green fill and white text', async () => {
    act(() => {
      useEvidenceStore.setState({
        queryText: 'FIND DISTANCE(A:155:CA, LIG:1:O2) < 4.0 Å',
        executionPlan: [
          { step_id: 1, name: 'AST Syntax Validation', description: 'Valid AST', status: 'completed' },
        ],
      });
    });

    await act(async () => {
      root.render(<MonacoQueryEditor />);
    });

    const statusBadge = container.querySelector('[data-testid="query-status-badge"]');
    expect(statusBadge).not.toBeNull();
    expect(statusBadge?.textContent).toContain('Valid query · Sound');
    expect(statusBadge?.className).toContain('text-white');

    const statusModule = container.querySelector('[data-testid="query-status-module"]');
    expect(statusModule).not.toBeNull();
    expect(statusModule?.className).toContain('bg-[#0969DA]');
    expect(statusModule?.className).not.toContain('text-[#0969DA]');
  });

  it('3. BottomAnalysisPanel "UNKNOWN" uses solid amber badge with white text', async () => {
    await act(async () => {
      root.render(<BottomAnalysisPanel />);
    });

    const unknownBadge = container.querySelector('[data-testid="bottom-panel-unknown-badge"]') as HTMLElement;
    expect(unknownBadge).not.toBeNull();
    expect(unknownBadge.textContent?.trim()).toBe('UNKNOWN');
    expect(unknownBadge.className).toContain('bg-[#B45309]');
    expect(unknownBadge.className).toContain('text-white');
    expect(unknownBadge.className).not.toContain('text-[#D97706]');
  });

  it('4. Rendered elements have ZERO pastel background classes (bg-[#EFF6FF], bg-[#F0FDF4], bg-[#FFFBEB], bg-[#FEF2F2])', async () => {
    await act(async () => {
      root.render(
        <div>
          <TopBar />
          <MonacoQueryEditor />
          <MolecularViewport />
          <BottomAnalysisPanel />
        </div>
      );
    });

    const pastels = ['bg-[#EFF6FF]', 'bg-[#F0FDF4]', 'bg-[#FFFBEB]', 'bg-[#FEF2F2]', 'bg-[#EBF3FC]', 'bg-[#F5F3FF]'];
    const allElements = container.querySelectorAll('*');

    let violations: string[] = [];
    allElements.forEach((el) => {
      const cls = el.getAttribute('class') || '';
      for (const p of pastels) {
        if (cls.includes(p)) {
          violations.push(`${el.tagName} (${el.getAttribute('data-testid') || 'no-id'}): contains ${p}`);
        }
      }
    });

    expect(violations).toEqual([]);
  });
});
