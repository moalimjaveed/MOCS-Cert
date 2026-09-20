// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { MonacoQueryEditor } from '../components/editor/MonacoQueryEditor';
import { runCanonicalQuery } from '../api/queryExecution';
import * as apiClient from '../api/client';
import { useEvidenceStore, useScanStore, useTimelineStore } from '../store';

// Enable React 19 act environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('PASS 39 — End-to-End Query Execution Rescue & Frontend Modernization', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    act(() => {
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
        blocksTotal: 0,
        certifiedBlocks: 0,
        refinedBlocks: 0,
        exactFramesScanned: 0,
        certificate: null,
        isExecuting: false,
      });
      useScanStore.setState({
        trajectoryId: 'synth_500f.xtc',
        topologyId: 'synth_500f.gro',
        pbcMode: 'orthorhombic_minimum_image',
      });
      useTimelineStore.setState({ selectedBlockId: 0 });
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
    vi.restoreAllMocks();
  });

  it('1. Initializes with honest canonical unexecuted state without fake scientific metrics', async () => {
    await act(async () => {
      root.render(<MonacoQueryEditor />);
    });

    const state = useEvidenceStore.getState();
    expect(state.truthValue).toBe('NO_EXECUTION');
    expect(state.resolutionStatus).toBe('NOT_RUN');
    expect(state.blocksExamined).toBe(0);
    expect(state.certifiedBlocks).toBe(0);
    expect(state.refinedBlocks).toBe(0);
    expect(state.exactFramesScanned).toBe(0);
    expect(state.certificate).toBeNull();
    expect(state.structuredError).toBeNull();

    // Editor rendered with valid canonical initial query
    const editor = container.querySelector('[data-testid="query-workspace-panel"]');
    expect(editor).not.toBeNull();
    expect(state.queryText).toBe('FIND (name CA) WITHIN 4.0A OF (name O2)');
  });

  it('2. Dispatches canonical single-path execution and commits authentic scientific results', async () => {
    const mockCompile = vi.spyOn(apiClient, 'compileQuery').mockResolvedValue({
      query_id: 'q_test_1',
      observable: 'Distance',
      predicate_operator: 'WITHIN',
      threshold_value: 4.0,
      unit: 'ANGSTROM',
      selection_a: 'name CA',
      selection_b: 'name O2',
      quantifier: 'EXISTS',
      chosen_plan: 'INDEX_AABB_PRUNE',
      estimated_prune_rate: 0.98,
      estimated_speedup: 12.5,
      plan_steps: [
        { step_id: 1, name: 'Scientific DSL Parsing', description: 'Valid syntax', status: 'completed' },
        { step_id: 2, name: 'AABB Soundness Test', description: 'AABB envelopes evaluated', status: 'completed' },
      ],
    });

    const mockExecute = vi.spyOn(apiClient, 'executeQuery').mockResolvedValue({
      query_id: 'q_test_1',
      execution_id: 'exec_canonical_42',
      query_hash: 'sha256_canonical_hash_abc',
      certificate_id: 'cert_canonical_123',
      certificate_hash: 'cert_hash_canonical_123',
      truth_value: 'TRUE',
      resolution_status: 'COMPLETE',
      quantifier: 'EXISTS',
      pruning_efficiency: 98.0,
      blocks_examined: 50,
      blocks_total: 50,
      blocks_certified_true: 1,
      blocks_certified_false: 48,
      certified_blocks: 49,
      refined_blocks: 1,
      exact_frames_scanned: 10,
      total_frames_refined: 10,
      witness_intervals: [[410, 415]],
      evaluated_blocks: [
        {
          block_id: 41,
          frame_start: 410,
          frame_end_exclusive: 420,
          lower_bound: 3.75,
          upper_bound: 4.16,
          truth_value: 'TRUE',
          status: 'EXACT_TRUE',
        },
      ],
      source_compressed_bytes_fetched: 256000,
      coordinate_payload_bytes: 480,
      frames_decoded: 10,
      coordinates_materialized: 20,
      atoms_analyzed: 2,
      index_bytes_read: 65536,
      wall_time_seconds: 0.12,
      cpu_time_seconds: 0.11,
      peak_memory_bytes: 5242880,
      refinement_selectivity: '50:1',
      refinement_speed: 12.5,
      io_prune_ratio: 0.98,
      traversal_depth: 4,
      certificate: {
        certificate_hash: 'cert_hash_canonical_123',
        merkle_root: 'merkle_root_456',
        verdict: 'CERTIFIED_TRUE',
      },
    });

    await act(async () => {
      const ok = await runCanonicalQuery('FIND (name CA) WITHIN 4.0A OF (name O2)');
      expect(ok).toBe(true);
    });

    expect(mockCompile).toHaveBeenCalledWith('FIND (name CA) WITHIN 4.0A OF (name O2)', expect.any(Object));
    expect(mockExecute).toHaveBeenCalledWith('FIND (name CA) WITHIN 4.0A OF (name O2)', expect.any(Object));

    const state = useEvidenceStore.getState();
    expect(state.executionStage).toBe('completed');
    expect(state.truthValue).toBe('TRUE');
    expect(state.resolutionStatus).toBe('COMPLETE');
    expect(state.blocksExamined).toBe(50);
    expect(state.certifiedBlocks).toBe(49);
    expect(state.refinedBlocks).toBe(1);
    expect(state.exactFramesScanned).toBe(10);
    expect(state.witnessIntervals).toEqual([[410, 415]]);
    expect(state.certificate).not.toBeNull();
    expect(state.executionId).toBe('exec_canonical_42');

    // Automatically focuses the refined candidate block 41
    expect(useTimelineStore.getState().selectedBlockId).toBe(41);
  });

  it('3. Renders structured INVALID_SELECTION error card with location and remedial action', async () => {
    vi.spyOn(apiClient, 'compileQuery').mockRejectedValue(
      new apiClient.ApiError('Selection A resolved to 0 atoms', 400, {
        errorCode: 'INVALID_SELECTION',
        location: 'Selection A (name INVALID_CA)',
        action: 'Verify atom or residue names against loaded topology.',
        detail: 'Resolved 0 atoms for name INVALID_CA in synth_500f.gro',
      })
    );

    await act(async () => {
      root.render(<MonacoQueryEditor />);
    });

    const runBtn = container.querySelector('[data-testid="compile-execute-btn"]') as HTMLButtonElement;
    expect(runBtn).not.toBeNull();

    await act(async () => {
      runBtn.click();
    });

    const state = useEvidenceStore.getState();
    expect(state.executionStage).toBe('failed');
    expect(state.truthValue).toBe('ERROR');
    expect(state.structuredError).not.toBeNull();
    expect(state.structuredError?.error_code).toBe('INVALID_SELECTION');
    expect(state.structuredError?.location).toContain('Selection A');

    // UI renders the structured scientific error presentation
    const errorCard = container.querySelector('[data-testid="structured-error-card"]');
    expect(errorCard).not.toBeNull();
    expect(errorCard?.textContent).toContain('INVALID_SELECTION');
    expect(errorCard?.textContent).toContain('Selection A');
    expect(errorCard?.textContent).toContain('Verify atom or residue names');
  });

  it('4. Renders structured UNSUPPORTED_GEOMETRY error when non-orthorhombic cell encountered', async () => {
    vi.spyOn(apiClient, 'compileQuery').mockRejectedValue(
      new apiClient.ApiError('Triclinic or non-orthorhombic unit cells are unsupported', 400, {
        errorCode: 'UNSUPPORTED_GEOMETRY',
        location: 'Box Geometry (adk_oplsaa.gro)',
        action: 'Load an orthorhombic trajectory (alpha = beta = gamma = 90 deg).',
        detail: 'Cell angles: alpha=60.0, beta=60.0, gamma=90.0',
      })
    );

    await act(async () => {
      root.render(<MonacoQueryEditor />);
    });

    const runBtn = container.querySelector('[data-testid="compile-execute-btn"]') as HTMLButtonElement;
    await act(async () => {
      runBtn.click();
    });

    const errorCard = container.querySelector('[data-testid="structured-error-card"]');
    expect(errorCard).not.toBeNull();
    expect(errorCard?.textContent).toContain('UNSUPPORTED_GEOMETRY');
    expect(errorCard?.textContent).toContain('Box Geometry');
  });

  it('5. Invalidates previous execution results when user edits query or loads preset', async () => {
    // Put store in completed state
    act(() => {
      useEvidenceStore.setState({
        executionStage: 'completed',
        truthValue: 'TRUE',
        resolutionStatus: 'COMPLETE',
        blocksExamined: 50,
        certificate: { valid: true },
      });
    });

    await act(async () => {
      root.render(<MonacoQueryEditor />);
    });

    // Preset select
    const selectEl = container.querySelector('select[aria-label="Golden Query Presets"]') as HTMLSelectElement;
    expect(selectEl).not.toBeNull();

    await act(async () => {
      // Select Golden Preset 2
      const option = selectEl.options[2];
      selectEl.value = option.value;
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const state = useEvidenceStore.getState();
    expect(state.executionStage).toBe('idle');
    expect(state.truthValue).toBe('NO_EXECUTION');
    expect(state.resolutionStatus).toBe('NOT_RUN');
    expect(state.blocksExamined).toBe(0);
    expect(state.certificate).toBeNull();
  });

  it('6. Discards stale responses from outdated concurrent executions (race protection)', async () => {
    let resolveFirst: (v: any) => void;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    vi.spyOn(apiClient, 'compileQuery').mockResolvedValue({
      query_id: 'q',
      observable: 'Distance',
      predicate_operator: 'WITHIN',
      threshold_value: 4.0,
      unit: 'ANGSTROM',
      selection_a: 'name CA',
      selection_b: 'name O2',
      quantifier: 'EXISTS',
      chosen_plan: 'INDEX_AABB_PRUNE',
      estimated_prune_rate: 0.9,
      estimated_speedup: 10.0,
      plan_steps: [],
    });

    const executeSpy = vi.spyOn(apiClient, 'executeQuery');
    executeSpy.mockImplementation(async (qText: string) => {
      if (qText === 'QUERY_ONE') {
        return firstPromise as any;
      }
      return {
        query_id: 'q_quick',
        execution_id: 'exec_second',
        truth_value: 'FALSE',
        resolution_status: 'COMPLETE',
        pruning_efficiency: 99.0,
        blocks_examined: 50,
        certified_blocks: 50,
        refined_blocks: 0,
        exact_frames_scanned: 0,
        certificate: { cert: 'second' },
      } as any;
    });

    // Dispatch Query 1
    const p1 = runCanonicalQuery('QUERY_ONE');
    
    // Immediately dispatch Query 2
    const p2 = runCanonicalQuery('QUERY_TWO');

    await p2;
    expect(useEvidenceStore.getState().executionId).toBe('exec_second');
    expect(useEvidenceStore.getState().truthValue).toBe('FALSE');

    // Now Query 1 finally resolves late
    resolveFirst!({
      query_id: 'q_slow',
      execution_id: 'exec_first_stale',
      truth_value: 'TRUE',
      resolution_status: 'COMPLETE',
      pruning_efficiency: 50.0,
      blocks_examined: 10,
      certified_blocks: 5,
      refined_blocks: 5,
      exact_frames_scanned: 50,
      certificate: { cert: 'stale' },
    });

    await p1;

    // Stale result MUST have been dropped; state must remain Query 2
    expect(useEvidenceStore.getState().executionId).toBe('exec_second');
    expect(useEvidenceStore.getState().truthValue).toBe('FALSE');
  });
});
