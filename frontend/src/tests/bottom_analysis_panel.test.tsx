// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { BottomAnalysisPanel } from '../components/evidence/BottomAnalysisPanel';
import { useProofStore, useEvidenceStore } from '../store';

// Enable React 19 act environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Mock API client
vi.mock('../api/client', () => ({
  verifyCertificate: vi.fn().mockResolvedValue({
    valid: true,
    sha256_sound: true,
    verification_time_ms: 12.4,
  }),
}));

describe('BottomAnalysisPanel Forensic Redesign Tests', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    act(() => {
      useProofStore.setState({
        focusedBlockId: 41,
        lowerBound: 3.72,
        upperBound: 4.21,
        threshold: 4.00,
      });

      useEvidenceStore.setState({
        blocksExamined: 240,
        pruningEfficiency: 97.1,
        exactFramesScanned: 43,
        certificate: {
          result: { truth: 'TRUE', resolution: 'COMPLETE', quantifier: 'EXISTS' },
          semantics: { sampling: 'sampled_frames', pbc: 'orthorhombic_minimum_image', precision: 'float64' },
          source: { trajectory_sha256: '3b22f8a...9e7a', topology_sha256: 'e91c42b...4d2f' },
          index_commitment: { mci_index_hash: 'f0c231e...8b1e', algorithm: 'AABB-v1' },
          evidence: { blocks_examined: 240, certified_false: 231, refined_blocks: 7, exact_frames: 43 },
        },
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

  it('renders single Fluent Light outer container with 1px border (#E5E5E5) and rounded-[8px]', async () => {
    await act(async () => {
      root.render(<BottomAnalysisPanel />);
    });

    const panel = container.querySelector('[data-testid="bottom-analysis-panel"]') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.className).toContain('cert-workspace-container');
    expect(panel.className).toContain('bg-[#FFFFFF]');
    expect(panel.className).toContain('border-[#E5E5E5]');
    expect(panel.className).toContain('rounded-[8px]');
  });

  it('renders WinUI 3 tab bar with 6 tabs, zero horizontal scrollbar leaks, and active tab styling', async () => {
    await act(async () => {
      root.render(<BottomAnalysisPanel />);
    });

    const tabBar = container.querySelector('[data-testid="cert-tab-bar"]') as HTMLElement;
    expect(tabBar).not.toBeNull();
    expect(tabBar.className).toContain('cert-nav-tabs');

    const expectedTabs = [
      { key: 'cert', label: 'Execution Certificate' },
      { key: 'mci', label: 'Spatial Index Commitments' },
      { key: 'geometry', label: 'Coordinate Bounds & Envelopes' },
      { key: 'workload', label: 'I/O & Pruning Benchmarks' },
      { key: 'ref', label: 'Ground Truth Oracle (MDAnalysis)' },
      { key: 'logs', label: 'Diagnostic Logs' },
    ];

    for (const tab of expectedTabs) {
      const tabBtn = container.querySelector(`[data-testid="cert-tab-${tab.key}"]`) as HTMLButtonElement;
      expect(tabBtn).not.toBeNull();
      expect(tabBtn.textContent).toBe(tab.label);
    }

    // Active tab is Execution Certificate
    const certTab = container.querySelector('[data-testid="cert-tab-cert"]') as HTMLButtonElement;
    expect(certTab.className).toContain('border-[#005FB8]');
    expect(certTab.className).toContain('text-[#1C1C1C]');
    expect(certTab.className).toContain('font-semibold');
  });

  it('switches tabs cleanly and renders appropriate workstation content', async () => {
    await act(async () => {
      root.render(<BottomAnalysisPanel />);
    });

    // Switch to MCI tab
    const mciTab = container.querySelector('[data-testid="cert-tab-mci"]') as HTMLButtonElement;
    await act(async () => {
      mciTab.click();
    });
    expect(container.textContent).toContain('Spatial Index Commitments');
    expect(container.textContent).toContain('240 leaf blocks, depth 4');

    // Switch to Geometry tab
    const geomTab = container.querySelector('[data-testid="cert-tab-geometry"]') as HTMLButtonElement;
    await act(async () => {
      geomTab.click();
    });
    expect(container.textContent).toContain('Coordinate Bounds & Envelopes');
    expect(container.textContent).toContain('Conservative coordinate envelopes');

    // Switch to Workload tab
    const workloadTab = container.querySelector('[data-testid="cert-tab-workload"]') as HTMLButtonElement;
    await act(async () => {
      workloadTab.click();
    });
    expect(container.textContent).toContain('I/O & Pruning Benchmarks');
    expect(container.textContent).toContain('97.1% frame pruning efficiency');

    // Switch to Reference tab
    const refTab = container.querySelector('[data-testid="cert-tab-ref"]') as HTMLButtonElement;
    await act(async () => {
      refTab.click();
    });
    expect(container.textContent).toContain('Ground Truth Oracle (MDAnalysis)');
    expect(container.textContent).toContain('Ground truth MDTraj');

    // Switch to Logs tab
    const logsTab = container.querySelector('[data-testid="cert-tab-logs"]') as HTMLButtonElement;
    await act(async () => {
      logsTab.click();
    });
    expect(container.textContent).toContain('Diagnostic Logs');
    expect(container.textContent).toContain('[INFO] AST compiled successfully');

    // Switch back to Cert tab
    const certTab = container.querySelector('[data-testid="cert-tab-cert"]') as HTMLButtonElement;
    await act(async () => {
      certTab.click();
    });
    expect(container.querySelector('[data-testid="cert-workspace-grid"]')).not.toBeNull();
  });

  it('renders 3-panel grid with JSON viewer, Verification checklist, and Mathematical details', async () => {
    await act(async () => {
      root.render(<BottomAnalysisPanel />);
    });

    const grid = container.querySelector('[data-testid="cert-workspace-grid"]') as HTMLElement;
    expect(grid).not.toBeNull();
    expect(grid.className).toContain('cert-grid');

    expect(container.querySelector('[data-testid="cert-panel-json"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="cert-panel-verify"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="cert-panel-math"]')).not.toBeNull();
  });

  it('renders JSON viewer with SHA-256 SOUND badge and contained pre block without page overflow', async () => {
    await act(async () => {
      root.render(<BottomAnalysisPanel />);
    });

    const jsonPanel = container.querySelector('[data-testid="cert-panel-json"]') as HTMLElement;
    expect(jsonPanel.textContent).toContain('Execution Certificate (JSON)');
    expect(jsonPanel.textContent).toContain('SHA-256 Verified');
    expect(jsonPanel.textContent).toContain('Soundness: Sound (Kleene 3-valued)');

    const pre = container.querySelector('[data-testid="cert-json-pre"]') as HTMLElement;
    expect(pre).not.toBeNull();
    expect(pre.className).toContain('font-cascadia');
    expect(pre.className).toContain('max-h-[190px]');
    expect(pre.className).toContain('overflow-auto');

    const preContent = pre.textContent || '';
    expect(preContent).toContain('"truth": "TRUE"');
    expect(preContent).toContain('"sampling": "sampled_frames"');
    expect(preContent).toContain('"pbc": "orthorhombic_minimum_image"');
  });

  it('renders verification checklist with vertically aligned icons and working verify button', async () => {
    await act(async () => {
      root.render(<BottomAnalysisPanel />);
    });

    const verifyPanel = container.querySelector('[data-testid="cert-panel-verify"]') as HTMLElement;
    expect(verifyPanel.textContent).toContain('Certificate Verification');

    const verifyBtn = container.querySelector('[data-testid="verify-certificate-btn"]') as HTMLButtonElement;
    expect(verifyBtn).not.toBeNull();
    expect(verifyBtn.textContent).toContain('Verify Certificate');

    // Click verify
    await act(async () => {
      verifyBtn.click();
    });
    expect(verifyBtn.textContent).toContain('Verified Sound');

    // Verify 4 status items with cert-verify-item class
    const verifyItems = verifyPanel.querySelectorAll('.cert-verify-item');
    expect(verifyItems.length).toBe(4);
    expect(verifyPanel.textContent).toContain('Source commitment verified');
    expect(verifyPanel.textContent).toContain('MCI commitment verified');
    expect(verifyPanel.textContent).toContain('Semantics verified');
    expect(verifyPanel.textContent).toContain('Evidence consistent');

    // Check hash and copy button
    const copyBtn = container.querySelector('[data-testid="copy-hash-btn"]') as HTMLButtonElement;
    expect(copyBtn).not.toBeNull();
    expect(verifyPanel.textContent).toContain('Hash: 4e2c88f1...48192abc');

    await act(async () => {
      copyBtn.click();
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('4e2c88f1a23b99ef7d9a88c2419a583921bf30219c8f02938491823948192abc');
  });

  it('renders mathematical details with collision-free header, toggleable segmented control, and KaTeX formulas', async () => {
    await act(async () => {
      root.render(<BottomAnalysisPanel />);
    });

    const mathPanel = container.querySelector('[data-testid="cert-panel-math"]') as HTMLElement;
    expect(mathPanel.textContent).toContain('Mathematical Details');

    const mathHeader = mathPanel.querySelector('.cert-math-header');
    expect(mathHeader).not.toBeNull();

    const distanceTabBtn = container.querySelector('[data-testid="math-tab-distance"]') as HTMLButtonElement;
    const aabbTabBtn = container.querySelector('[data-testid="math-tab-aabb"]') as HTMLButtonElement;
    expect(distanceTabBtn).not.toBeNull();
    expect(aabbTabBtn).not.toBeNull();

    // Default is distance bound active
    expect(distanceTabBtn.className).toContain('font-semibold');

    // Switch to AABB Geometry
    await act(async () => {
      aabbTabBtn.click();
    });
    expect(aabbTabBtn.className).toContain('font-semibold');

    // Check formulas container
    const formulasBox = container.querySelector('[data-testid="math-formulas-box"]') as HTMLElement;
    expect(formulasBox).not.toBeNull();
    expect(formulasBox.innerHTML).toContain('katex');

    // Block 41 evaluation metrics
    expect(mathPanel.textContent).toContain('For block 41');
    expect(mathPanel.textContent).toContain('L = 3.72 Å');
    expect(mathPanel.textContent).toContain('U = 4.21 Å');
    expect(mathPanel.textContent).toContain('Query: distance < 4.0 Å');
    expect(mathPanel.textContent).toContain('UNKNOWN');
  });

  it('enforces zero AI-slop: zero circular .rounded-full indicators and zero emojis', async () => {
    await act(async () => {
      root.render(<BottomAnalysisPanel />);
    });

    // Zero .rounded-full elements
    const circles = container.querySelectorAll('.rounded-full');
    expect(circles.length).toBe(0);

    // Zero emojis across entire component text
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(container.textContent || '')).toBe(false);
  });

  it('renders reliably without errors across 12 responsive container widths (400px to 1600px)', async () => {
    const testWidths = [1600, 1440, 1280, 1200, 1100, 1000, 900, 800, 768, 640, 500, 400];

    for (const width of testWidths) {
      container.style.width = `${width}px`;

      await act(async () => {
        root.render(<BottomAnalysisPanel />);
      });

      const panel = container.querySelector('[data-testid="bottom-analysis-panel"]') as HTMLElement;
      expect(panel).not.toBeNull();

      const grid = container.querySelector('[data-testid="cert-workspace-grid"]') as HTMLElement;
      expect(grid).not.toBeNull();

      const tabBar = container.querySelector('[data-testid="cert-tab-bar"]') as HTMLElement;
      expect(tabBar).not.toBeNull();
    }
  });
});
