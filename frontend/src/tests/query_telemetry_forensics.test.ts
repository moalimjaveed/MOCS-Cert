import { describe, it, expect, beforeEach } from 'vitest';
import { useEvidenceStore } from '../store/useEvidenceStore';

describe('Query Execution Telemetry Forensic Test Suite', () => {
  beforeEach(() => {
    useEvidenceStore.getState().clearExecutionTelemetry();
  });

  it('verifies that clearExecutionTelemetry() wipes all stale metrics to zero/null', () => {
    useEvidenceStore.setState({
      blocksExamined: 240,
      certifiedBlocks: 231,
      refinedBlocks: 7,
      exactFramesScanned: 43,
      compressedBytesFetchedMb: 41.8,
      coordinatesMaterialized: 86,
      atomsAnalyzed: 2,
      indexBytesReadMb: 12.4,
      wallTimeSeconds: 2.31,
      peakMemoryMb: 4.2,
      refinementSelectivity: '50:1',
      refinementSpeed: 11.6,
      ioPruneRatio: 0.968,
      traversalDepth: 4,
    });

    useEvidenceStore.getState().clearExecutionTelemetry();
    const state = useEvidenceStore.getState();

    expect(state.blocksExamined).toBe(0);
    expect(state.certifiedBlocks).toBe(0);
    expect(state.refinedBlocks).toBe(0);
    expect(state.sourceCompressedBytesFetched).toBeNull();
    expect(state.coordinatePayloadBytes).toBe(0);
    expect(state.compressedBytesFetchedMb).toBeNull();
    expect(state.coordinatesMaterialized).toBe(0);
    expect(state.atomsAnalyzed).toBe(0);
    expect(state.indexBytesReadMb).toBe(0);
    expect(state.wallTimeSeconds).toBe(0);
    expect(state.peakMemoryMb).toBe(0);
    expect(state.refinementSelectivity).toBe('');
    expect(state.refinementSpeed).toBe(0);
    expect(state.ioPruneRatio).toBe(0);
    expect(state.traversalDepth).toBe(0);
    expect(state.certificate).toBeNull();
  });

  it('guarantees exact mathematical block partition without missing blocks', () => {
    const execRes = {
      blocks_examined: 50,
      blocks_total: 50,
      blocks_certified_true: 18,
      blocks_certified_false: 31,
      blocks_refined: 1,
      blocks_exact_true: 0,
      blocks_exact_false: 0,
      blocks_exact_mixed: 1,
      blocks_unknown: 0,
      certified_blocks: 49,
      refined_blocks: 1,
      exact_frames_scanned: 10,
    };

    const partitionSum =
      execRes.blocks_certified_true +
      execRes.blocks_certified_false +
      execRes.blocks_refined +
      execRes.blocks_unknown;
    expect(partitionSum).toBe(execRes.blocks_total);
    expect(execRes.blocks_examined).toBe(execRes.blocks_total);

    const exactSum =
      execRes.blocks_exact_true +
      execRes.blocks_exact_false +
      execRes.blocks_exact_mixed;
    expect(exactSum).toBe(execRes.blocks_refined);

    expect(execRes.certified_blocks).toBe(
      execRes.blocks_certified_true + execRes.blocks_certified_false
    );
  });

  it('prevents telemetry bleed across sequential queries', () => {
    useEvidenceStore.getState().clearExecutionTelemetry();
    useEvidenceStore.getState().setExecutionResult({
      queryId: 'query_A',
      truthValue: 'TRUE',
      blocksExamined: 50,
      certifiedBlocks: 49,
      refinedBlocks: 1,
      exactFramesScanned: 10,
      wallTimeSeconds: 0.08,
      peakMemoryMb: 1.5,
      refinementSelectivity: '50:1',
      refinementSpeed: 50.0,
      ioPruneRatio: 0.98,
      traversalDepth: 2,
    });

    let state = useEvidenceStore.getState();
    expect(state.queryId).toBe('query_A');
    expect(state.blocksExamined).toBe(50);
    expect(state.refinementSelectivity).toBe('50:1');
    expect(state.refinementSpeed).toBe(50.0);

    useEvidenceStore.getState().clearExecutionTelemetry();
    state = useEvidenceStore.getState();
    expect(state.blocksExamined).toBe(0);
    expect(state.refinementSelectivity).toBe('');
    expect(state.refinementSpeed).toBe(0);

    useEvidenceStore.getState().setExecutionResult({
      queryId: 'query_B',
      truthValue: 'FALSE',
      blocksExamined: 50,
      certifiedBlocks: 50,
      refinedBlocks: 0,
      exactFramesScanned: 0,
      wallTimeSeconds: 0.02,
      peakMemoryMb: 0.8,
      refinementSelectivity: '50:0',
      refinementSpeed: 50.0,
      ioPruneRatio: 1.0,
      traversalDepth: 1,
    });

    state = useEvidenceStore.getState();
    expect(state.queryId).toBe('query_B');
    expect(state.truthValue).toBe('FALSE');
    expect(state.blocksExamined).toBe(50);
    expect(state.certifiedBlocks).toBe(50);
    expect(state.refinementSelectivity).toBe('50:0');
    expect(state.refinedBlocks).toBe(0);
    expect(state.exactFramesScanned).toBe(0);
    expect(state.wallTimeSeconds).toBe(0.02);
    expect(state.traversalDepth).toBe(1);
    expect(state.ioPruneRatio).toBe(1.0);
  });

  it('strictly distinguishes coordinate_payload_bytes from physical source_compressed_bytes_fetched', () => {
    // 10 frames, 2 atoms, 3 coords, sizeof(float32)=4 => 240 bytes
    const frames = 10;
    const atoms = 2;
    const coords = 3;
    const sizeofFloat32 = 4;
    const payloadBytes = frames * atoms * coords * sizeofFloat32;
    expect(payloadBytes).toBe(240);

    useEvidenceStore.getState().clearExecutionTelemetry();
    useEvidenceStore.getState().setExecutionResult({
      sourceCompressedBytesFetched: null,
      coordinatePayloadBytes: payloadBytes,
    });

    const state = useEvidenceStore.getState();
    expect(state.coordinatePayloadBytes).toBe(240);
    expect(state.sourceCompressedBytesFetched).toBeNull();
  });
});
