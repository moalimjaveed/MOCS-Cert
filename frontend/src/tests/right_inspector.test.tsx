// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { RightInspector } from '../components/layout/RightInspector';
import { VerdictCard } from '../components/inspector/VerdictCard';
import { useEvidenceStore, useUIStore } from '../store';

// Enable React 19 act environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('RightInspector - Forensic WinUI 3 Responsive Rebuild', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    // Reset stores to default state
    useEvidenceStore.setState({
      truthValue: 'CERTIFIED TRUE',
      resolutionStatus: 'COMPLETE',
      quantifier: 'EXISTS',
      operator: 'DISTANCE-v1',
      semantics: 'sampled_frames',
      pbc: 'orthorhombic_minimum_image',
      precision: 'float64',
      blocksExamined: 240,
      certifiedBlocks: 231,
      refinedBlocks: 7,
      exactFramesScanned: 43,
      sourceCompressedBytesFetched: 41.8,
      compressedBytesFetchedMb: 41.8,
      coordinatePayloadBytes: 240,
      compressedFramesDecoded: 43,
      coordinatesMaterialized: 86,
      atomsAnalyzed: 2,
      indexBytesReadMb: 12.4,
      wallTimeSeconds: 2.31,
    });

    useUIStore.setState({
      isCommandPaletteOpen: false,
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders the strict 4-tier scientific information hierarchy in canonical order', async () => {
    await act(async () => {
      root.render(<RightInspector />);
    });

    const sections = container.querySelectorAll('section');
    expect(sections.length).toBe(4);

    expect(sections[0].getAttribute('data-testid')).toBe('inspector-section-result');
    expect(sections[1].getAttribute('data-testid')).toBe('inspector-section-contract');
    expect(sections[2].getAttribute('data-testid')).toBe('inspector-section-evidence');
    expect(sections[3].getAttribute('data-testid')).toBe('inspector-section-resources');

    // Section headings
    expect(sections[0].textContent).toContain('Result');
    expect(sections[1].textContent).toContain('Query Contract');
    expect(sections[2].textContent).toContain('Evidence');
    expect(sections[3].textContent).toContain('Resource Usage');
  });

  it('guarantees exactly ONE occurrence of CERTIFIED TRUE with zero duplicated text', async () => {
    await act(async () => {
      root.render(<RightInspector />);
    });

    const fullText = container.textContent || '';
    const occurrences = (fullText.match(/CERTIFIED TRUE/g) || []).length;
    expect(occurrences).toBe(1);

    // Check that duplicated "CERTIFIED CERTIFIED" does NOT exist
    expect(fullText).not.toContain('CERTIFIED CERTIFIED');

    const verdictTitle = container.querySelector('[data-testid="verdict-title"]');
    expect(verdictTitle).not.toBeNull();
    expect(verdictTitle?.textContent?.trim()).toBe('CERTIFIED TRUE');

    const resolutionEl = container.querySelector('[data-testid="verdict-resolution"]');
    expect(resolutionEl).not.toBeNull();
    expect(resolutionEl?.textContent?.trim()).toBe('Resolution: COMPLETE');
  });

  it('supports all canonical truth states without altering layout', async () => {
    // 1. CERTIFIED FALSE
    await act(async () => {
      useEvidenceStore.setState({ truthValue: 'FALSE', resolutionStatus: 'COMPLETE' });
      root.render(<RightInspector />);
    });
    expect(container.querySelector('[data-testid="verdict-title"]')?.textContent?.trim()).toBe('CERTIFIED FALSE');

    // 2. UNKNOWN
    await act(async () => {
      useEvidenceStore.setState({ truthValue: 'UNKNOWN', resolutionStatus: 'UNRESOLVED' });
      root.render(<RightInspector />);
    });
    expect(container.querySelector('[data-testid="verdict-title"]')?.textContent?.trim()).toBe('UNKNOWN');

    // 3. UNSUPPORTED
    await act(async () => {
      useEvidenceStore.setState({ truthValue: 'UNSUPPORTED', resolutionStatus: 'REJECTED' });
      root.render(<RightInspector />);
    });
    expect(container.querySelector('[data-testid="verdict-title"]')?.textContent?.trim()).toBe('UNSUPPORTED');

    // 4. ERROR
    await act(async () => {
      useEvidenceStore.setState({ truthValue: 'ERROR', resolutionStatus: 'FAILED' });
      root.render(<RightInspector />);
    });
    expect(container.querySelector('[data-testid="verdict-title"]')?.textContent?.trim()).toBe('ERROR');
  });

  it('renders Query Contract with all 5 canonical properties and ensures full PBC accessibility', async () => {
    await act(async () => {
      root.render(<RightInspector />);
    });

    const contractSec = container.querySelector('[data-testid="inspector-section-contract"]');
    expect(contractSec).not.toBeNull();

    expect(container.querySelector('[data-testid="contract-quantifier"]')?.textContent).toContain('EXISTS');
    expect(container.querySelector('[data-testid="contract-operator"]')?.textContent).toContain('DISTANCE-v1');
    expect(container.querySelector('[data-testid="contract-semantics"]')?.textContent).toContain('sampled_frames');
    expect(container.querySelector('[data-testid="contract-precision"]')?.textContent).toContain('float64');

    // Full PBC canonical value must be fully present and accessible via title tooltip
    const pbcEl = container.querySelector('[data-testid="contract-pbc"]');
    expect(pbcEl).not.toBeNull();
    expect(pbcEl?.textContent).toContain('orthorhombic_minimum_image');
    expect(pbcEl?.querySelector('span[title="orthorhombic_minimum_image"]')).not.toBeNull();
  });

  it('renders Evidence section with live execution metrics aligned in clean property rows', async () => {
    await act(async () => {
      root.render(<RightInspector />);
    });

    const evidenceSec = container.querySelector('[data-testid="inspector-section-evidence"]');
    expect(evidenceSec).not.toBeNull();

    expect(container.querySelector('[data-testid="evidence-blocks-examined"]')?.textContent).toContain('240');
    expect(container.querySelector('[data-testid="evidence-certified-false"]')?.textContent).toContain('231');
    expect(container.querySelector('[data-testid="evidence-refined-blocks"]')?.textContent).toContain('7');
    expect(container.querySelector('[data-testid="evidence-exact-frames"]')?.textContent).toContain('43');
    expect(evidenceSec?.textContent).not.toContain('Shown once');
    expect(evidenceSec?.textContent).not.toContain('no longer repeats');
  });

  it('renders Resource Usage as secondary telemetry with lower visual weight', async () => {
    await act(async () => {
      root.render(<RightInspector />);
    });

    const resSec = container.querySelector('[data-testid="inspector-section-resources"]');
    expect(resSec).not.toBeNull();

    expect(container.querySelector('[data-testid="resource-compressed-bytes"]')?.textContent).toContain('41.8 MB');
    expect(container.querySelector('[data-testid="resource-coordinate-payload"]')?.textContent).toContain('240 B');
    expect(container.querySelector('[data-testid="resource-frames-decoded"]')?.textContent).toContain('43');
    expect(container.querySelector('[data-testid="resource-coordinates-materialized"]')?.textContent).toContain('86');
    expect(container.querySelector('[data-testid="resource-atoms-analyzed"]')?.textContent).toContain('2');
    expect(container.querySelector('[data-testid="resource-index-bytes"]')?.textContent).toContain('12.4 MB');
    expect(container.querySelector('[data-testid="resource-wall-time"]')?.textContent).toContain('2.31 s');
  });

  it('displays "Not measured" when source compressed bytes fetched is null', async () => {
    await act(async () => {
      useEvidenceStore.setState({
        sourceCompressedBytesFetched: null,
        coordinatePayloadBytes: 240,
      });
      root.render(<RightInspector />);
    });

    expect(container.querySelector('[data-testid="resource-compressed-bytes"]')?.textContent).toContain('Not measured');
    expect(container.querySelector('[data-testid="resource-coordinate-payload"]')?.textContent).toContain('240 B');
  });

  it('ensures all property values are right-aligned and share the same right edge', async () => {
    await act(async () => {
      root.render(<RightInspector />);
    });

    const propertyRows = container.querySelectorAll('[data-property-row="true"]');
    expect(propertyRows.length).toBe(17);

    propertyRows.forEach((row) => {
      const valEl = row.children[1] as HTMLElement;
      expect(valEl).not.toBeNull();
      expect(valEl.className).toContain('text-right');
      expect(valEl.className).toContain('min-w-0');
      // Must not use monospace
      expect(valEl.className).not.toContain('font-cascadia');
      expect(valEl.className).not.toContain('font-mono');
    });
  });

  it('provides a functional search launcher connecting to CommandPalette on click', async () => {
    await act(async () => {
      root.render(<RightInspector />);
    });

    const searchBtn = container.querySelector('div[role="button"][aria-label*="Search"]') as HTMLElement;
    expect(searchBtn).not.toBeNull();
    expect(searchBtn.textContent).toContain('Query molecular observable...');
    expect(searchBtn.textContent).toContain('Ctrl+K');

    expect(useUIStore.getState().isCommandPaletteOpen).toBe(false);

    // Click search box
    await act(async () => {
      searchBtn.click();
    });

    expect(useUIStore.getState().isCommandPaletteOpen).toBe(true);
  });

  it('renders without horizontal overflow or clipping across 320px, 360px, 400px, 480px, 560px container widths', async () => {
    const widths = [320, 360, 400, 480, 560];

    for (const w of widths) {
      container.style.width = `${w}px`;
      await act(async () => {
        root.render(<RightInspector />);
      });

      const aside = container.querySelector('aside') as HTMLElement;
      expect(aside).not.toBeNull();
      expect(aside.className).toContain('overflow-x-hidden');
      expect(aside.className).toContain('overflow-y-auto');

      // Zero AI-slop: 0 emojis, 0 .rounded-full
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      expect(emojiRegex.test(container.textContent || '')).toBe(false);
      expect(container.querySelectorAll('.rounded-full').length).toBe(0);
    }
  });

  it('respects isInspectorOpen and unmounts cleanly when closed', async () => {
    act(() => {
      useUIStore.setState({ isInspectorOpen: false });
    });

    await act(async () => {
      root.render(<RightInspector />);
    });

    const aside = container.querySelector('[data-testid="right-inspector"]');
    expect(aside).toBeNull();
  });

  it('provides accessible close button and backdrop that close the inspector on click', async () => {
    act(() => {
      useUIStore.setState({ isInspectorOpen: true });
    });

    await act(async () => {
      root.render(<RightInspector />);
    });

    const closeBtn = container.querySelector('[data-testid="close-inspector-btn"]') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();

    // Click close button
    await act(async () => {
      closeBtn.click();
    });

    expect(useUIStore.getState().isInspectorOpen).toBe(false);

    // Re-open and test backdrop click
    act(() => {
      useUIStore.setState({ isInspectorOpen: true });
    });

    await act(async () => {
      root.render(<RightInspector />);
    });

    const backdrop = container.querySelector('[data-testid="inspector-backdrop"]') as HTMLElement;
    expect(backdrop).not.toBeNull();

    await act(async () => {
      backdrop.click();
    });

    expect(useUIStore.getState().isInspectorOpen).toBe(false);
  });
});
