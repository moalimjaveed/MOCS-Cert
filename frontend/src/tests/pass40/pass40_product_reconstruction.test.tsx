// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { getPresetsForDataset, MonacoQueryEditor } from '../../components/editor/MonacoQueryEditor';
import { IndexCatalogView } from '../../components/views/IndexCatalogView';
import { RefinementExplorerView } from '../../components/views/RefinementExplorerView';
import { ExecutionBenchmarksView } from '../../components/views/ExecutionBenchmarksView';
import { FormalAuditView } from '../../components/views/FormalAuditView';
import { useEvidenceStore, useScanStore, useTimelineStore, useUIStore, useProofStore } from '../../store';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('PASS 40 — Frontend Product Reconstruction & Component Contracts', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    // Reset stores
    act(() => {
      useScanStore.setState({
        trajectoryId: 'synth_500f.xtc',
        topologyId: 'synth_500f.gro',
        totalFrames: 500,
        atomCount: 10,
        pbcMode: 'orthorhombic_minimum_image',
      });

      useEvidenceStore.setState({
        queryText: 'FIND (name CA) WITHIN 4.0A OF (name O2)',
        executionId: null,
        queryHash: null,
        executionStage: 'idle',
        structuredError: null,
        truthValue: 'NO_EXECUTION',
        resolutionStatus: 'NOT_RUN',
        pruningEfficiency: 0,
        blocksExamined: 0,
        certifiedBlocks: 0,
        refinedBlocks: 0,
        exactFramesScanned: 0,
        certificate: null,
      });

      useProofStore.setState({
        focusedBlockId: 41,
        lowerBound: 3.72,
        upperBound: 4.21,
        threshold: 4.00,
      });

      useTimelineStore.setState({
        selectedBlockId: 41,
        blocks: [],
      });
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  describe('1. Dataset-Aware Query Presets Architecture', () => {
    it('generates canonical golden corpus presets for synth_500f', () => {
      const presets = getPresetsForDataset('synth_500f.xtc', 'synth_500f.gro');
      expect(presets.length).toBeGreaterThanOrEqual(10);
      expect(presets[0].query).toContain('name CA');
      expect(presets[0].query).toContain('name O2');
    });

    it('generates nucleic-specific presets for 1bna', () => {
      const presets = getPresetsForDataset('1bna.xtc', '1bna.pdb');
      expect(presets.length).toBeGreaterThanOrEqual(2);
      expect(presets[0].query).toContain("name C1'");
      expect(presets[1].query).toContain('resname DA');
    });

    it('generates heme-specific presets for 4hhb', () => {
      const presets = getPresetsForDataset('4hhb.xtc', '4hhb.pdb');
      expect(presets.length).toBeGreaterThanOrEqual(2);
      expect(presets[0].query).toContain('name FE');
      expect(presets[1].query).toContain('resname HEM');
    });

    it('generates unsupported geometry preset for adk_oplsaa', () => {
      const presets = getPresetsForDataset('tests/data/real/adk_oplsaa.xtc', 'adk_oplsaa.gro');
      expect(presets.length).toBeGreaterThanOrEqual(1);
      expect(presets[0].label).toContain('Unsupported Geometry');
    });
  });

  describe('2. Dual Invalidation Contract on Dataset Switch', () => {
    it('invalidates execution identity and updates query when dataset switches', async () => {
      // Set an active execution
      act(() => {
        useEvidenceStore.setState({
          executionId: 'exec_test_previous',
          truthValue: 'TRUE',
          pruningEfficiency: 95.0,
          blocksExamined: 50,
          certificate: { certificate_hash: 'abc123' },
        });
      });

      await act(async () => {
        root.render(<MonacoQueryEditor />);
      });

      expect(useEvidenceStore.getState().executionId).toBe('exec_test_previous');

      // Switch dataset to 1bna
      act(() => {
        useScanStore.setState({
          trajectoryId: '1bna.xtc',
          topologyId: '1bna.pdb',
        });
      });

      await act(async () => {
        root.render(<MonacoQueryEditor />);
      });

      // Assert Dual Invalidation occurred
      expect(useEvidenceStore.getState().executionId).toBeNull();
      expect(useEvidenceStore.getState().certificate).toBeNull();
      expect(useEvidenceStore.getState().truthValue).toBe('NO_EXECUTION');
      expect(useEvidenceStore.getState().queryText).toContain("name C1'");
    });
  });

  describe('3. Truthful Empty States (Rule 8)', () => {
    it('renders NO REFINEMENT YET in RefinementExplorerView when unexecuted', async () => {
      await act(async () => {
        root.render(<RefinementExplorerView />);
      });

      const banner = container.querySelector('[data-testid="no-refinement-banner"]');
      expect(banner).not.toBeNull();
      expect(banner?.textContent).toContain('NO REFINEMENT YET');
    });

    it('renders CERTIFICATE NOT GENERATED in FormalAuditView when certificate is null', async () => {
      await act(async () => {
        root.render(<FormalAuditView />);
      });

      expect(container.textContent).toContain('CERTIFICATE NOT GENERATED');
      expect(container.textContent).toContain('MOCS-SPEC-v1.0');
    });

    it('renders NOT MEASURED in ExecutionBenchmarksView when unexecuted', async () => {
      act(() => {
        useUIStore.setState({ activeSidebarId: 'io_pruning' });
      });

      await act(async () => {
        root.render(<ExecutionBenchmarksView />);
      });

      expect(container.textContent).toContain('NOT MEASURED');
      expect(container.textContent).toContain('Awaiting execution');
    });
  });

  describe('4. Purge of Legacy Mock Literals (Rule 9)', () => {
    it('does not contain hardcoded 231 of 240 blocks in unexecuted state', async () => {
      act(() => {
        useUIStore.setState({ activeSidebarId: 'io_pruning' });
      });

      await act(async () => {
        root.render(<ExecutionBenchmarksView />);
      });

      expect(container.textContent).not.toContain('231 of 240 blocks');
      expect(container.textContent).not.toContain('457 of 500 frames skipped');
    });

    it('renders live execution metrics in ExecutionBenchmarksView when populated', async () => {
      act(() => {
        useUIStore.setState({ activeSidebarId: 'io_pruning' });
        useEvidenceStore.setState({
          executionId: 'exec_live_123',
          blocksExamined: 50,
          certifiedBlocks: 45,
          refinedBlocks: 5,
          exactFramesScanned: 10,
          framesTotal: 500,
          pruningEfficiency: 90.0,
          indexBytesReadMb: 1.25,
        });
      });

      await act(async () => {
        root.render(<ExecutionBenchmarksView />);
      });

      expect(container.textContent).toContain('45 of 50 blocks (90.0%)');
      expect(container.textContent).toContain('90.0% Block Prune Rate');
      expect(container.textContent).toContain('490 of 500 frames skipped (98.0%)');
    });
  });
});
