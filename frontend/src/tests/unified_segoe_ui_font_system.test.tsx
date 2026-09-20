// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { MonacoQueryEditor } from '../components/editor/MonacoQueryEditor';
import { BottomAnalysisPanel } from '../components/evidence/BottomAnalysisPanel';
import { useEvidenceStore } from '../store/useEvidenceStore';

// Enable React 19 act environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('Unified Segoe UI Variable Typography System Test Suite', () => {
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

    useEvidenceStore.setState({
      executionPlan: [
        { step_id: 1, name: 'AST Verification', description: 'AST test', status: 'completed' },
        { step_id: 2, name: 'Spatial Bounds Checking', description: 'Spatial test', status: 'completed' },
      ],
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('1. Query Editor Code Font: MonacoQueryEditor textarea and line numbers use premier developer code font stack with tabular-nums', async () => {
    await act(async () => {
      root.render(<MonacoQueryEditor />);
    });

    const lineNumbers = container.querySelector('[data-testid="editor-line-numbers"]') as HTMLElement;
    expect(lineNumbers).not.toBeNull();
    expect(lineNumbers.className).toContain('font-cascadia');
    expect(lineNumbers.className).toContain('font-code');
    expect(lineNumbers.className).not.toContain('font-ui');
    expect(lineNumbers.className).toContain('tabular-nums');

    const textarea = container.querySelector('[data-testid="query-textarea"]') as HTMLElement;
    expect(textarea).not.toBeNull();
    expect(textarea.className).toContain('font-cascadia');
    expect(textarea.className).toContain('font-code');
    expect(textarea.className).not.toContain('font-ui');
    expect(textarea.className).toContain('tabular-nums');
  });

  it('2. Code JSON: Execution certificate and diagnostic logs use premier developer code font stack', async () => {
    await act(async () => {
      root.render(<BottomAnalysisPanel />);
    });

    const pre = container.querySelector('[data-testid="cert-json-pre"]') as HTMLElement;
    expect(pre).not.toBeNull();
    expect(pre.className).toContain('font-cascadia');
    expect(pre.className).toContain('font-code');
    expect(pre.className).not.toContain('font-ui');
  });
});
