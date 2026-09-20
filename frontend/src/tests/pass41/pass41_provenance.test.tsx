// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import {
  createExecutionIdentity,
  matchesActiveExecution,
  isExecutionScoped,
} from '../../types/provenance';
import {
  useEvidenceStore,
  useScanStore,
  useTimelineStore,
  useUIStore,
  useProofStore,
} from '../../store';
import { BottomAnalysisPanel } from '../../components/evidence/BottomAnalysisPanel';
import { ExecutionPlanDAG } from '../../components/plan/ExecutionPlanDAG';
import { IndexCatalogView } from '../../components/views/IndexCatalogView';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('PASS 41 — Scientific Provenance & Cross-View Invariants', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

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
        datasetId: 'synth_500f.xtc',
        topologyId: 'synth_500f.gro',
        planHash: null,
        evidenceVersion: 1,
        executionStage: 'idle',
        structuredError: null,
        truthValue: 'NO_EXECUTION',
        resolutionStatus: 'NOT_RUN',
        pruningEfficiency: 0,
        blocksExamined: 0,
        certifiedBlocks: 0,
        refinedBlocks: 0,
        exactFramesScanned: 0,
        peakMemoryMb: 0,
        ioPruneRatio: 0,
        traversalDepth: 0,
        refinementSelectivity: '',
        certificate: null,
      });

      useProofStore.getState().resetProof();
      useTimelineStore.getState().resetTimeline();
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('1. ExecutionIdentity model strictly matches active execution and rejects stale identity', () => {
    const idA = createExecutionIdentity({
      dataset_id: 'synth_500f.xtc',
      topology_id: 'synth_500f.gro',
      query_hash: 'hash_q1_ca_o2',
      execution_id: 'exec_001',
      certificate_digest: 'digest_001_abc',
      evidence_version: 1,
    });

    const idB = createExecutionIdentity({
      dataset_id: 'synth_500f.xtc',
      topology_id: 'synth_500f.gro',
      query_hash: 'hash_q2_ca_o2',
      execution_id: 'exec_002',
      certificate_digest: 'digest_002_def',
      evidence_version: 2,
    });

    expect(matchesActiveExecution(idA, idA)).toBe(true);
    expect(matchesActiveExecution(idA, idB)).toBe(false);

    // Stale execution ID fails even if dataset and query hash match
    const staleId = { ...idA, execution_id: 'exec_000_stale' };
    expect(matchesActiveExecution(staleId, idA)).toBe(false);

    // Different evidence version fails
    const newVersionId = { ...idA, evidence_version: 5 };
    expect(matchesActiveExecution(newVersionId, idA)).toBe(false);
  });

  it('2. ProvenanceScope correctly categorizes execution vs dataset-scoped views', () => {
    expect(isExecutionScoped('EXECUTION-SCOPED')).toBe(true);
    expect(isExecutionScoped('DATASET-SCOPED')).toBe(false);
    expect(isExecutionScoped('SYSTEM-SCOPED')).toBe(false);
  });

  it('3. useEvidenceStore.getExecutionIdentity returns canonical identity only when executed', () => {
    // Initial state: not executed
    expect(useEvidenceStore.getState().getExecutionIdentity()).toBeNull();

    // After execution completion
    act(() => {
      useEvidenceStore.setState({
        executionId: 'exec_live_123',
        queryHash: 'qhash_abc',
        certificate: {
          certificate_hash: 'cert_hash_999',
          digest: 'cert_hash_999',
        },
        executionStage: 'completed',
      });
    });

    const identity = useEvidenceStore.getState().getExecutionIdentity();
    expect(identity).not.toBeNull();
    expect(identity?.execution_id).toBe('exec_live_123');
    expect(identity?.query_hash).toBe('qhash_abc');
    expect(identity?.dataset_id).toBe('synth_500f.xtc');
    expect(identity?.certificate_digest).toBe('cert_hash_999');
  });

  it('4. Editing query text atomically invalidates execution identity, certificate, and increments version', () => {
    // Set up executed state
    act(() => {
      useEvidenceStore.setState({
        executionId: 'exec_live_123',
        queryHash: 'qhash_abc',
        evidenceVersion: 1,
        truthValue: 'CERTIFIED TRUE',
        resolutionStatus: 'COMPLETE',
        certificate: { certificate_hash: 'cert_123' },
      });
    });

    expect(useEvidenceStore.getState().getExecutionIdentity()).not.toBeNull();

    // User edits query text without executing
    act(() => {
      useEvidenceStore.getState().setQueryText('FIND (name N) WITHIN 3.5A OF (name O)');
    });

    const state = useEvidenceStore.getState();
    expect(state.queryText).toBe('FIND (name N) WITHIN 3.5A OF (name O)');
    expect(state.executionId).toBeNull();
    expect(state.queryHash).toBeNull();
    expect(state.certificate).toBeNull();
    expect(state.truthValue).toBe('NO_EXECUTION');
    expect(state.resolutionStatus).toBe('NOT_RUN');
    expect(state.evidenceVersion).toBe(2);
    expect(state.getExecutionIdentity()).toBeNull();
  });

  it('5. Invalidation wipe clears proof and timeline sub-blocks without orphan data', () => {
    // Simulate dyadic refinement state
    act(() => {
      useTimelineStore.setState({
        selectedBlockId: 41,
        activeSubBlocks: [
          {
            child_id: '41.0',
            parent_id: 41,
            frame_start: 410,
            frame_end_exclusive: 415,
            lower_bound: 3.8,
            upper_bound: 4.2,
            truth_value: 'UNKNOWN',
            status: 'REFINED',
          },
        ],
        isRefining: true,
      });

      useProofStore.setState({
        focusedBlockId: 41,
        lowerBound: 3.8,
        upperBound: 4.2,
        threshold: 4.0,
      });
    });

    expect(useTimelineStore.getState().activeSubBlocks.length).toBe(1);

    // Trigger reset on query change or invalidation
    act(() => {
      useTimelineStore.getState().clearSubBlocks();
      useProofStore.getState().resetProof();
    });

    expect(useTimelineStore.getState().activeSubBlocks.length).toBe(0);
    expect(useProofStore.getState().lowerBound).toBe(0);
    expect(useProofStore.getState().upperBound).toBe(0);
    expect(useProofStore.getState().threshold).toBe(0);
  });

  it('6. BottomAnalysisPanel honestly renders unexecuted state without fake fallback hash or numbers', async () => {
    await act(async () => {
      root.render(<BottomAnalysisPanel />);
    });

    const jsonPanel = container.querySelector('[data-testid="cert-panel-json"]') as HTMLElement;
    expect(jsonPanel).not.toBeNull();
    expect(jsonPanel.textContent).toContain('Pending Execution');
    expect(jsonPanel.textContent).toContain('Soundness: Unverified');

    const pre = container.querySelector('[data-testid="cert-json-pre"]') as HTMLElement;
    expect(pre.textContent).toContain('CERTIFICATE NOT GENERATED');

    const verifyBtn = container.querySelector('[data-testid="verify-certificate-btn"]') as HTMLButtonElement;
    expect(verifyBtn.disabled).toBe(true);

    const hashDisplay = container.querySelector('[data-testid="cert-hash-display"]') as HTMLElement;
    expect(hashDisplay.textContent).toContain('Hash: NONE (Awaiting execution)');
  });

  it('7. ExecutionPlanDAG honestly renders pending stages and awaiting execution when unexecuted', async () => {
    await act(async () => {
      root.render(<ExecutionPlanDAG />);
    });

    const badge = container.querySelector('[data-testid="soundness-verified-badge"]') as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain('Awaiting Execution');

    const body = container.querySelector('[data-testid="execution-table-body"]') as HTMLElement;
    expect(body).not.toBeNull();
    expect(body.textContent).toContain('Pending');

    const metricsPanel = container.querySelector('[data-testid="mci-metrics-panel"]') as HTMLElement;
    expect(metricsPanel.textContent).toContain('—'); // Unexecuted metrics show em-dash
  });

  it('8. IndexCatalogView renders empty block table without manufacturing fake 24 blocks', async () => {
    await act(async () => {
      root.render(<IndexCatalogView />);
    });

    const table = container.querySelector('[data-testid="blocks-table"]') as HTMLTableElement;
    expect(table).not.toBeNull();

    // Table rows should be 0 because store.blocks is empty
    const rows = table.querySelectorAll('tbody tr');
    expect(rows.length).toBe(0);

    const tabHeader = container.querySelector('[data-testid="index-catalog-tabs"]') as HTMLElement;
    expect(tabHeader.textContent).toContain('Block Seek Table (0)');
  });
});
