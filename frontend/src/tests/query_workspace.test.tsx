// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { MonacoQueryEditor } from '../components/editor/MonacoQueryEditor';
import { useEvidenceStore, useScanStore, useTimelineStore } from '../store';

// Enable React 19 act environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('MonacoQueryEditor Forensic Query Workspace Tests', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    act(() => {
      useEvidenceStore.setState({
        queryText: 'FIND (RES :LIG AND ATOM :N*) WITHIN 4.0 Å OF\n     (RES :TYR151 AND ATOM :OH)\n     WHERE DURATION ≥ 5 ns',
        executionPlan: [],
        isExecuting: false,
      });
      useScanStore.setState({ timestepPs: 10, pbcMode: 'ORTHORHOMBIC_MIN_IMAGE' });
      useTimelineStore.setState({ selectedBlockId: 41 });
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

  it('renders two-column grid layout with shared top baseline (Query ~58%, Contract ~42%)', async () => {
    await act(async () => {
      root.render(<MonacoQueryEditor />);
    });

    const panel = container.querySelector('[data-testid="query-workspace-panel"]') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.className).toContain('bg-[#FFFFFF]');
    expect(panel.className).toContain('rounded-[8px]');
    expect(panel.className).toContain('border-[#E5E5E5]');
    expect(panel.className).toContain('p-5');

    // 12-column grid container with items-start top baseline
    const grid = panel.querySelector('.grid') as HTMLElement;
    expect(grid).not.toBeNull();
    expect(grid.className).toContain('lg:grid-cols-12');
    expect(grid.className).toContain('items-start');

    // Query column (~58% = col-span-7)
    const queryCol = grid.querySelector('.lg\\:col-span-7') as HTMLElement;
    expect(queryCol).not.toBeNull();

    // Observable Contract column (~42% = col-span-5)
    const contractCol = grid.querySelector('.lg\\:col-span-5') as HTMLElement;
    expect(contractCol).not.toBeNull();
  });

  it('renders numbered scientific code editor with Cascadia Code font and auto-formatted line numbers (01, 02, 03)', async () => {
    await act(async () => {
      root.render(<MonacoQueryEditor />);
    });

    // Heading "Query"
    const heading = container.querySelector('h2');
    expect(heading).not.toBeNull();
    expect(heading?.textContent).toBe('Query');
    expect(heading?.className).toContain('text-[16px]');
    expect(heading?.className).toContain('font-semibold');

    // Line numbers
    const lineNumbers = container.querySelector('[data-testid="editor-line-numbers"]') as HTMLElement;
    expect(lineNumbers).not.toBeNull();
    expect(lineNumbers.textContent).toContain('01');
    expect(lineNumbers.textContent).toContain('02');
    expect(lineNumbers.textContent).toContain('03');
    expect(lineNumbers.className).toContain('font-cascadia');

    // Textarea
    const textarea = container.querySelector('[data-testid="query-textarea"]') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.getAttribute('aria-label')).toBe('Scientific Query Editor');
    expect(textarea.className).toContain('font-cascadia');
    expect(textarea.value).toContain('FIND (RES :LIG AND ATOM :N*) WITHIN 4.0 Å OF');
  });

  it('renders Observable Contract properties in a clean, non-card 2-column table with Segoe UI values', async () => {
    await act(async () => {
      root.render(<MonacoQueryEditor />);
    });

    // Heading "Observable Contract"
    const heading = container.querySelector('h3');
    expect(heading).not.toBeNull();
    expect(heading?.textContent).toBe('Observable Contract');
    expect(heading?.className).toContain('text-[15px]');

    // Property table
    const table = container.querySelector('[data-testid="contract-properties"]') as HTMLElement;
    expect(table).not.toBeNull();

    // Verify all 5 canonical properties
    expect(container.querySelector('[data-testid="contract-val-quantifier"]')?.textContent).toBe('EXISTS');
    expect(container.querySelector('[data-testid="contract-val-semantics"]')?.textContent).toBe('SAMPLED_FRAMES');
    expect(container.querySelector('[data-testid="contract-val-sampling"]')?.textContent).toBe('Δt = 10 ps');
    expect(container.querySelector('[data-testid="contract-val-pbc"]')?.textContent).toBe('ORTHORHOMBIC_MIN_IMAGE');
    expect(container.querySelector('[data-testid="contract-val-precision"]')?.textContent).toBe('FLOAT64');

    // Values use Segoe UI font (no font-cascadia)
    const quantifierEl = container.querySelector('[data-testid="contract-val-quantifier"]') as HTMLElement;
    expect(quantifierEl.className).not.toContain('font-cascadia');
    expect(quantifierEl.className).toContain('font-medium');
  });

  it('renders 36px primary WinUI Compile & Execute button aligned with bottom of contract', async () => {
    const handleExecute = vi.fn();
    await act(async () => {
      root.render(<MonacoQueryEditor onExecute={handleExecute} />);
    });

    const btn = container.querySelector('[data-testid="compile-execute-btn"]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('aria-label')).toBe('Compile and Execute Query');
    expect(btn.className).toContain('h-9');
    expect(btn.className).toContain('bg-[#005FB8]');
    expect(btn.textContent).toContain('Compile & Execute');

    await act(async () => {
      btn.click();
    });

    expect(handleExecute).toHaveBeenCalledTimes(1);
    expect(handleExecute).toHaveBeenCalledWith(useEvidenceStore.getState().queryText);
  });

  it('executes query when Ctrl+Enter or Cmd+Enter is pressed in the editor', async () => {
    const handleExecute = vi.fn();
    await act(async () => {
      root.render(<MonacoQueryEditor onExecute={handleExecute} />);
    });

    const textarea = container.querySelector('[data-testid="query-textarea"]') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();

    // Simulate Ctrl+Enter keydown
    await act(async () => {
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
    });

    expect(handleExecute).toHaveBeenCalledTimes(1);
  });

  it('displays executing state (Compiling…) and disables action button during execution', async () => {
    act(() => {
      useEvidenceStore.setState({ isExecuting: true });
    });

    await act(async () => {
      root.render(<MonacoQueryEditor />);
    });

    const btn = container.querySelector('[data-testid="compile-execute-btn"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain('Compiling…');
  });

  it('displays subtle compilation status badge when execution plan exists without green card slop', async () => {
    act(() => {
      useEvidenceStore.setState({
        executionPlan: [
          { step_id: 1, name: 'Query Compiler', description: 'Compiled AST', status: 'completed' },
        ],
      });
    });

    await act(async () => {
      root.render(<MonacoQueryEditor />);
    });

    const badge = container.querySelector('[data-testid="query-status-badge"]') as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('Valid query · Sound');
    expect(badge.className).toContain('text-white');
    const module = container.querySelector('[data-testid="query-status-module"]') as HTMLElement;
    expect(module).not.toBeNull();
    expect(module.className).toContain('bg-[#0969DA]');
  });

  it('strictly excludes AI-slop: zero emojis, zero colored dots, zero pills', async () => {
    await act(async () => {
      root.render(<MonacoQueryEditor />);
    });

    const fullText = container.textContent || '';
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(fullText)).toBe(false);

    // No colored dots
    const dots = container.querySelectorAll('.rounded-full');
    expect(dots.length).toBe(0);
  });

  it('enforces container-query containment, min-h-[140px] editor surface, and dedicated internal scroll viewport', async () => {
    await act(async () => {
      root.render(<MonacoQueryEditor />);
    });

    const panel = container.querySelector('[data-testid="query-workspace-panel"]') as HTMLElement;
    expect(panel.className).toContain('query-workspace-container');
    expect(panel.className).toContain('max-w-full');
    expect(panel.className).toContain('min-w-0');
    expect(panel.className).toContain('box-border');

    // Editor container has min-height: 140px
    const editorBox = panel.querySelector('.min-h-\\[140px\\]') as HTMLElement;
    expect(editorBox).not.toBeNull();
    expect(editorBox.className).toContain('overflow-hidden');

    // Dedicated internal code viewport with horizontal scrolling
    const codeViewport = editorBox.querySelector('.overflow-x-auto') as HTMLElement;
    expect(codeViewport).not.toBeNull();
    expect(codeViewport.className).toContain('max-w-full');

    // Full-width Compile & Execute button contained in the contract column
    const btn = container.querySelector('[data-testid="compile-execute-btn"]') as HTMLButtonElement;
    expect(btn.className).toContain('w-full');
  });

  it('enforces shared-baseline 2-column grid definition list for contract properties', async () => {
    await act(async () => {
      root.render(<MonacoQueryEditor />);
    });

    const propertyRows = container.querySelectorAll('[data-testid="contract-properties"] > div');
    expect(propertyRows.length).toBe(5);

    propertyRows.forEach((row) => {
      const el = row as HTMLElement;
      expect(el.className).toContain('grid');
      expect(el.className).toContain('grid-cols-[minmax(0,1fr)_auto]');
      expect(el.className).toContain('items-baseline');
      expect(el.className).toContain('gap-4');
    });
  });

  describe('IDE-Grade Scroll Container Architecture Tests', () => {
    it('anchors horizontal scrollbar strictly at the bottom of the editor container', async () => {
      await act(async () => {
        root.render(<MonacoQueryEditor />);
      });

      const textarea = container.querySelector('[data-testid="query-textarea"]') as HTMLTextAreaElement;
      expect(textarea).not.toBeNull();

      // Textarea fills 100% of container height (h-full min-h-0) so scrollbar sits flush at bottom edge
      expect(textarea.className).toContain('h-full');
      expect(textarea.className).toContain('min-h-0');
      expect(textarea.className).toContain('w-full');
      expect(textarea.className).toContain('overflow-x-auto');
      expect(textarea.className).toContain('overflow-y-auto');
      expect(textarea.className).toContain('custom-editor-scrollbar');

      // Uses wrap="off" and whitespace-pre for authentic IDE code editor behavior
      expect(textarea.getAttribute('wrap')).toBe('off');
      expect(textarea.className).toContain('whitespace-pre');

      // Outer container has clipping and intentional height
      const editorBox = textarea.parentElement as HTMLElement;
      expect(editorBox.className).toContain('overflow-hidden');
      expect(editorBox.className).toContain('min-h-[140px]');
      expect(editorBox.className).toContain('border-[#E5E5E5]');
      expect(editorBox.className).toContain('rounded-[4px]');
    });

    it('isolates line-number gutter with fixed width and prevents horizontal scroll contamination', async () => {
      await act(async () => {
        root.render(<MonacoQueryEditor />);
      });

      const gutter = container.querySelector('[data-testid="editor-line-numbers"]') as HTMLElement;
      expect(gutter).not.toBeNull();

      // Fixed width w-10 with vertical divider border
      expect(gutter.className).toContain('w-10');
      expect(gutter.className).toContain('shrink-0');
      expect(gutter.className).toContain('border-r');
      expect(gutter.className).toContain('border-[#E5E5E5]');

      // Gutter has overflow-hidden so it never scrolls horizontally
      expect(gutter.className).toContain('overflow-hidden');
    });

    it('ensures query text starts with padding-left and never clips underneath the gutter', async () => {
      await act(async () => {
        root.render(<MonacoQueryEditor />);
      });

      const textarea = container.querySelector('[data-testid="query-textarea"]') as HTMLTextAreaElement;
      expect(textarea.className).toContain('pl-3');
      expect(textarea.className).toContain('pt-2.5');

      const gutter = container.querySelector('[data-testid="editor-line-numbers"]') as HTMLElement;
      expect(gutter.className).toContain('pt-2.5');
    });
  });
});
