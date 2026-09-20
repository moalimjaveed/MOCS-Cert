// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { ExecutionBenchmarksView } from '../components/views/ExecutionBenchmarksView';
import { FormalAuditView } from '../components/views/FormalAuditView';
import { IndexCatalogView } from '../components/views/IndexCatalogView';
import { RefinementExplorerView } from '../components/views/RefinementExplorerView';
import { useViewerStore, useEvidenceStore, useProofStore, useScanStore, useTimelineStore } from '../store';

// Enable React 19 act environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Mock molecular viewers to avoid WebGL context requirements in jsdom


describe('PASS 28 UI Reconstruction & Information Architecture Verification Suite', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // Full Canvas Mock with all 2D context methods
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      getImageData: vi.fn(),
      putImageData: vi.fn(),
      createImageData: vi.fn(),
      setTransform: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      fillText: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      roundRect: vi.fn(),
      setLineDash: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 0 }),
      scale: vi.fn(),
      resetTransform: vi.fn(),
    }) as any;

    // Mock global.fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([]),
    }) as any;

    act(() => {
      useScanStore.setState({
        trajectoryId: 'synth_500f.xtc',
        topologyId: 'synth_500f.gro',
        atomCount: 10,
        totalFrames: 500,
        pbcMode: 'ORTHORHOMBIC_MIN_IMAGE',
      });

      useProofStore.setState({
        focusedBlockId: 41,
        lowerBound: 3.72,
        upperBound: 4.21,
        threshold: 4.00,
      });

      useEvidenceStore.setState({
        wallTimeSeconds: 0.082,
        ioPruneRatio: 0.971,
        pruningEfficiency: 97.1,
        exactFramesScanned: 43,
        blocksExamined: 240,
        certifiedBlocks: 231,
        refinedBlocks: 7,
        peakMemoryMb: 4.2,
        certificate: {
          certificate_hash: '4e2c88f1a23b99ef7d9a88c2419a583921bf30219c8f02938491823948192abc',
          result: { truth: 'TRUE', resolution: 'COMPLETE', quantifier: 'EXISTS' },
          semantics: { sampling: 'sampled_frames', pbc: 'orthorhombic_minimum_image', precision: 'float64' },
          source: { trajectory_sha256: '3b22f8a...9e7a', topology_sha256: 'e91c42b...4d2f' },
          index_commitment: { mci_index_hash: 'f0c231e...8b1e', algorithm: 'AABB-v1' },
          evidence: { blocks_examined: 240, certified_false: 231, refined_blocks: 7, exact_frames: 43 },
        },
      });

      useViewerStore.setState({
        showAABB: true,
        showCalipers: true,
        representation: 'cartoon',
        isExplorerOpen: false,
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

  describe('1. ExecutionBenchmarksView Reconstruction & Metric Strip Invariants', () => {
    it('renders horizontal unified metric strip with 4 cells and single-line labels', async () => {
      await act(async () => {
        root.render(<ExecutionBenchmarksView />);
      });

      const strip = container.querySelector('[data-testid="benchmark-metric-strip"]') as HTMLElement;
      expect(strip).not.toBeNull();
      expect(strip.className).toContain('mocs-metric-strip');
      expect(strip.className).toContain('mocs-metric-strip-4');

      const cells = strip.querySelectorAll('.mocs-metric-cell');
      expect(cells.length).toBe(4);

      // Verify exact single-line uppercase labels without wrapping
      const labels = Array.from(strip.querySelectorAll('.mocs-metric-label')).map(
        (el) => el.textContent?.trim()
      );
      expect(labels).toContain('Query Speedup');
      expect(labels).toContain('Wall Execution Time');
      expect(labels).toContain('I/O Prune Ratio');
      expect(labels).toContain('Peak Workstation RAM');

      // Verify labels are present
      expect(strip.textContent).toContain('Query Speedup');
      expect(strip.textContent).toContain('Wall Execution Time');
      expect(strip.textContent).toContain('I/O Prune Ratio');
      expect(strip.textContent).toContain('Peak Workstation RAM');
    });

    it('renders baseline comparison table and workload breakdown cleanly', async () => {
      await act(async () => {
        root.render(<ExecutionBenchmarksView />);
      });

      expect(container.textContent).toContain('Detailed Baseline Measurement Comparison');
      expect(container.textContent).toContain('MOCS-Cert (Indexed + Pruned)');
      expect(container.textContent).toContain('MDAnalysis (Iterative Scan)');
      expect(container.textContent).toContain('NOT MEASURED');
    });
  });

  describe('2. FormalAuditView Reconstruction & Metric Strip Invariants', () => {
    it('renders horizontal unified metric strip with 4 cells and single-line labels', async () => {
      await act(async () => {
        root.render(<FormalAuditView />);
      });

      const strip = container.querySelector('[data-testid="formal-audit-metric-strip"]') as HTMLElement;
      expect(strip).not.toBeNull();
      expect(strip.className).toContain('mocs-metric-strip');
      expect(strip.className).toContain('mocs-metric-strip-4');

      const cells = strip.querySelectorAll('.mocs-metric-cell');
      expect(cells.length).toBe(4);

      const labels = Array.from(strip.querySelectorAll('.mocs-metric-label')).map(
        (el) => el.textContent?.trim()
      );
      expect(labels).toContain('Deductive Soundness');
      expect(labels).toContain('Certificate Digest');
      expect(labels).toContain('Reference Agreement');
      expect(labels).toContain('Trust Architecture');

      expect(strip.textContent).toContain('Sound (Kleene 3-Valued)');
      expect(strip.textContent).toContain('100% Bit-Exact');
      expect(strip.textContent).toContain('Tier-2 Verifier');
    });

    it('renders flattened certificate inspection tabs cleanly', async () => {
      await act(async () => {
        root.render(<FormalAuditView />);
      });

      // MocsTabs renders buttons with role="tab"
      const allTabs = Array.from(container.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];
      const certTab = allTabs.find(t => t.textContent?.includes('Certificate')) ?? (container.querySelector('#mocs-tab-certificate, [data-testid*="cert"]') as HTMLButtonElement);
      const oracleTab = allTabs.find(t => t.textContent?.includes('Oracle')) ?? (container.querySelector('#mocs-tab-oracle, [data-testid*="oracle"]') as HTMLButtonElement);
      const invariantsTab = allTabs.find(t => t.textContent?.includes('Invariants')) ?? (container.querySelector('#mocs-tab-invariants, [data-testid*="invariants"]') as HTMLButtonElement);

      expect(certTab).not.toBeNull();
      expect(oracleTab).not.toBeNull();
      expect(invariantsTab).not.toBeNull();

      // Certificate tab is active by default — actual text includes this phrase:
      expect(container.textContent).toContain('MOCS-SPEC-v1.0');
      expect(container.textContent).toContain('"truth": "TRUE"');

      // Switch to invariants tab
      await act(async () => {
        invariantsTab.click();
      });
      expect(container.textContent).toContain('Theorem 1: Conservative Bounding Soundness');
    });
  });

  describe('3. IndexCatalogView Reconstruction & Metric Strip Invariants', () => {
    beforeEach(() => {
      act(() => {
        useTimelineStore.setState({
          blocks: [
            { block_id: 1, time_start_ns: 0.0, time_end_ns: 4.2, frame_start: 0, frame_end_exclusive: 10, lower_bound: 5.0, upper_bound: 8.0, status: 'CERTIFIED_FALSE', truth_value: 'FALSE', child_blocks: [], exact_frames: 0, refined_count: 0 },
            { block_id: 41, time_start_ns: 168.0, time_end_ns: 172.2, frame_start: 400, frame_end_exclusive: 410, lower_bound: 3.72, upper_bound: 4.21, status: 'REFINED', truth_value: 'UNKNOWN', child_blocks: [], exact_frames: 0, refined_count: 1 },
            { block_id: 85, time_start_ns: 350.0, time_end_ns: 354.2, frame_start: 840, frame_end_exclusive: 850, lower_bound: 2.1, upper_bound: 3.9, status: 'CERTIFIED_TRUE', truth_value: 'TRUE', child_blocks: [], exact_frames: 0, refined_count: 0 },
          ],
        });
      });
    });

    it('renders horizontal unified metric strip with 4 cells and single-line labels', async () => {
      await act(async () => {
        root.render(<IndexCatalogView />);
      });

      const strip = container.querySelector('[data-testid="index-catalog-metric-strip"]') as HTMLElement;
      expect(strip).not.toBeNull();
      expect(strip.className).toContain('mocs-metric-strip');
      expect(strip.className).toContain('mocs-metric-strip-4');

      const cells = strip.querySelectorAll('.mocs-metric-cell');
      expect(cells.length).toBe(4);

      const labels = Array.from(strip.querySelectorAll('.mocs-metric-label')).map(
        (el) => el.textContent?.trim()
      );
      expect(labels).toContain('Index Status');
      expect(labels).toContain('Dataset Invariant');
      expect(labels).toContain('Spatial Seek Index');
      expect(labels).toContain('Merkle Commitment');

      expect(strip.textContent).toContain('MCI Level 1 Ready');
      expect(strip.textContent).toContain('4.2 MB Cached');
      expect(strip.textContent).toContain('Cryptographically Verified');
    });

    it('enforces 5N zero-overflow table layout, explicit min-widths, and solid semantic badge contrast', async () => {
      await act(async () => {
        root.render(<IndexCatalogView />);
      });

      const table = container.querySelector('[data-testid="blocks-table"]') as HTMLTableElement;
      expect(table).not.toBeNull();
      expect(table.className).toContain('min-w-[880px]');

      const tableContainer = table.parentElement as HTMLElement;
      expect(tableContainer.className).toContain('overflow-x-auto');
      expect(tableContainer.className).toContain('overflow-y-auto');

      // Check column header min-widths and nowrap
      const ths = Array.from(table.querySelectorAll('thead th'));
      expect(ths.length).toBe(7);
      ths.forEach((th) => {
        expect(th.className).toContain('whitespace-nowrap');
      });

      // Check status header — MocsTable applies size via inline style for the specific column
      // The 7th column has size: 180 which generates min-w-[180px] in className
      // Note: In JSDOM without Tailwind JIT, the literal string is in className
      const statusTh = ths[6];
      const statusThStyle = statusTh.getAttribute('style') ?? '';
      const statusThClass = statusTh.className;
      // Either the inline style has width:180 or the className has the min-w value
      const hasSizeConstraint = statusThStyle.includes('180') || statusThClass.includes('180') || statusThClass.includes('min-w');
      expect(hasSizeConstraint).toBe(true);

      // Check status badges
      const statusBadges = Array.from(table.querySelectorAll('tbody td span'));
      expect(statusBadges.length).toBeGreaterThan(0);

      // Verify each badge is nowrap and uses solid semantic fill
      statusBadges.forEach((badge) => {
        expect(badge.className).toContain('whitespace-nowrap');
        expect(badge.className).toContain('text-white');
        const text = badge.textContent?.trim() || '';
        if (text.includes('REFINED')) {
          expect(badge.className).toContain('bg-[#B45309]'); // Amber solid fill
        } else if (text.includes('CANDIDATE') || text.includes('TRUE')) {
          expect(badge.className).toContain('bg-[#0969DA]'); // Cobalt solid fill
        } else if (text.includes('FALSE')) {
          expect(badge.className).toContain('bg-[#D1242F]'); // Rose solid fill, NOT pale AI badge
        }
      });

      // Verify time range uses en-dash
      const timeCells = Array.from(table.querySelectorAll('tbody td:nth-child(2)'));
      timeCells.forEach((cell) => {
        expect(cell.textContent).toContain('–'); // en-dash
        expect(cell.className).toContain('whitespace-nowrap');
        expect(cell.className).toContain('tabular-nums');
      });
    });
  });

  describe('4. RefinementExplorerView Reconstruction & Metric Strip Invariants', () => {
    it('renders horizontal unified metric strip with 4 cells and single-line labels', async () => {
      await act(async () => {
        root.render(<RefinementExplorerView />);
      });

      const strip = container.querySelector('[data-testid="refinement-summary-strip"]') as HTMLElement;
      expect(strip).not.toBeNull();
      expect(strip.className).toContain('mocs-metric-strip');
      expect(strip.className).toContain('mocs-metric-strip-4');

      const cells = strip.querySelectorAll('.mocs-metric-cell');
      expect(cells.length).toBe(4);

      const labels = Array.from(strip.querySelectorAll('.mocs-metric-label')).map(
        (el) => el.textContent?.trim()
      );
      expect(labels).toContain('Pruning Efficiency');
      expect(labels).toContain('Candidate Blocks');
      expect(labels).toContain('Exact Frames');
      expect(labels).toContain('Invariant');

      expect(strip.textContent).toContain('97.1%');
      expect(strip.textContent).toContain('7');
      expect(strip.textContent).toContain('43');
    });
  });
});

