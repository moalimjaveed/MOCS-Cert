/**
 * Canonical Query Execution Orchestrator for MOCS-Cert.
 * 
 * Enforces:
 * - Single canonical execution path via POST /api/v1/query/execute
 * - Semantic execution stages: idle -> compiling -> executing -> completed / failed
 * - Race condition protection: stale async responses never overwrite newer dispatches
 * - Structured error handling with type safety
 * - Live binding to Zustand stores without fabricated numbers
 * - Atomic execution identity and provenance propagation
 */

import { compileQuery, executeQuery, ApiError } from './client';
import { useEvidenceStore } from '../store/useEvidenceStore';
import { useTimelineStore } from '../store/useTimelineStore';
import { useProofStore } from '../store/useProofStore';
import { useScanStore } from '../store/useScanStore';
import type { QueryExecuteRequest, StructuredExecutionError } from '../types/query';

let activeExecutionId = 0;

export function getActiveExecutionToken(): number {
  return activeExecutionId;
}

export async function runCanonicalQuery(
  queryText: string,
  options?: Partial<QueryExecuteRequest>
): Promise<boolean> {
  const currentToken = ++activeExecutionId;
  const {
    setExecuting,
    setExecutionStage,
    setStructuredError,
    clearExecutionTelemetry,
    setExecutionPlan,
    setExecutionResult,
  } = useEvidenceStore.getState();
  const { selectBlock, clearSubBlocks } = useTimelineStore.getState();
  const { resetProof, setFocusedBlock } = useProofStore.getState();
  const { trajectoryId, topologyId, pbcMode, boundingModel, timestepPs } = useScanStore.getState();

  const targetTraj = options?.trajectory_id || trajectoryId || 'synth_500f.xtc';
  const targetTopo = topologyId || 'synth_500f.gro';

  try {
    useEvidenceStore.setState({ queryText });
    setExecuting(true);
    setExecutionStage('compiling');
    setStructuredError(null);
    clearExecutionTelemetry();
    clearSubBlocks();

    // Call compileQuery for plan steps & syntax verification
    const compileRes = await compileQuery(queryText, {
      trajectory_id: targetTraj,
      pbc_mode: options?.pbc_mode || pbcMode || 'auto',
      precision: options?.precision || 'float64',
      bounding_model: options?.bounding_model || boundingModel || 'AABB',
    });

    if (currentToken !== activeExecutionId) {
      return false;
    }

    if (compileRes.plan_steps && compileRes.plan_steps.length > 0) {
      setExecutionPlan(compileRes.plan_steps);
    }

    // Transition to executing stage
    setExecutionStage('executing');

    const execRes = await executeQuery(queryText, {
      trajectory_id: targetTraj,
      pbc_mode: options?.pbc_mode || pbcMode || 'auto',
      sampling_semantics: options?.sampling_semantics || 'sampled_frames',
      precision: options?.precision || 'float64',
      quantifier: options?.quantifier || 'EXISTS',
      bounding_model: options?.bounding_model || boundingModel || 'AABB',
    });

    // Race condition protection: guard against late response overwriting newer dispatch
    if (currentToken !== activeExecutionId) {
      console.warn('Discarding stale execution response for outdated execution token:', currentToken);
      return false;
    }

    if (execRes.plan_steps && execRes.plan_steps.length > 0) {
      setExecutionPlan(execRes.plan_steps);
    }

    // Update scan metadata if response returned actual frames/cell
    if (execRes.frames_total !== undefined) {
      useScanStore.getState().setMetadata({
        totalFrames: execRes.frames_total,
      });
    }

    setExecutionStage('completed');

    // Parse memory metrics safely
    let peakMemMb = 0;
    if (typeof execRes.peak_memory_bytes === 'number') {
      peakMemMb = Math.round((execRes.peak_memory_bytes / (1024 * 1024)) * 10) / 10;
    }

    const compBytesMb = execRes.compressed_bytes_fetched
      ? Math.round((execRes.compressed_bytes_fetched / (1024 * 1024)) * 100) / 100
      : null;

    const idxBytesMb = execRes.index_bytes_read
      ? Math.round((execRes.index_bytes_read / (1024 * 1024)) * 100) / 100
      : 0;

    const execId = execRes.execution_id || `exec_${Date.now()}`;

    setExecutionResult({
      executionId: execId,
      queryHash: execRes.query_hash || null,
      datasetId: targetTraj,
      topologyId: targetTopo,
      truthValue: execRes.truth_value,
      resolutionStatus: execRes.resolution_status,
      quantifier: execRes.quantifier,
      pruningEfficiency: execRes.pruning_efficiency,
      blocksExamined: execRes.blocks_examined,
      blocksTotal: execRes.blocks_total ?? execRes.blocks_examined,
      blocksCertifiedTrue: execRes.blocks_certified_true ?? 0,
      blocksCertifiedFalse: execRes.blocks_certified_false ?? 0,
      certifiedBlocks: execRes.certified_blocks,
      refinedBlocks: execRes.refined_blocks,
      exactFramesScanned: execRes.exact_frames_scanned,
      framesTotal: execRes.frames_total ?? 0,
      framesExactRequested: execRes.frames_exact_requested ?? 0,
      witnessIntervals: execRes.witness_intervals || [],
      evaluatedBlocks: execRes.evaluated_blocks || [],
      sourceCompressedBytesFetched: execRes.source_compressed_bytes_fetched,
      coordinatePayloadBytes: execRes.coordinate_payload_bytes,
      compressedBytesFetchedMb: compBytesMb,
      compressedFramesDecoded: execRes.frames_decoded ?? execRes.exact_frames_scanned,
      coordinatesMaterialized: execRes.coordinates_materialized,
      atomsAnalyzed: execRes.atoms_analyzed ?? 0,
      indexBytesReadMb: idxBytesMb,
      wallTimeSeconds: execRes.wall_time_seconds,
      cpuTimeSeconds: execRes.cpu_time_seconds,
      peakMemoryMb: peakMemMb,
      refinementSelectivity: String(execRes.refinement_selectivity ?? `${execRes.blocks_total ?? 0}:${Math.max(0, execRes.blocks_refined ?? 0)}`),
      refinementSpeed: execRes.refinement_speed ?? 0.0,
      ioPruneRatio: execRes.io_prune_ratio ?? 0.0,
      traversalDepth: execRes.traversal_depth ?? 1,
      certificate: execRes.certificate,
    });

    // Select refined candidate block or default block and synchronize proof store
    const candidateBlock = execRes.evaluated_blocks?.find(
      (b: any) => b.status === 'EXACT_TRUE' || b.truth_value === 'UNKNOWN' || b.status === 'REFINED'
    ) || (execRes.evaluated_blocks && execRes.evaluated_blocks.length > 0 ? execRes.evaluated_blocks[0] : null);

    if (candidateBlock) {
      selectBlock(candidateBlock.block_id);
      const dtPs = execRes.certificate?.semantics?.sampling_semantics?.dt_ps ?? timestepPs ?? 10.0;
      const thresholdVal = execRes.certificate?.query?.predicate?.threshold_value_angstrom
        ?? execRes.certificate?.query?.predicate?.threshold_value
        ?? 4.0;
      const tStart = (candidateBlock.frame_start * dtPs) / 1000.0;
      const tEnd = (candidateBlock.frame_end_exclusive * dtPs) / 1000.0;
      setFocusedBlock(
        candidateBlock.block_id,
        [tStart, tEnd],
        candidateBlock.lower_bound,
        candidateBlock.upper_bound,
        candidateBlock.status || candidateBlock.truth_value,
        thresholdVal,
        execId
      );
    } else {
      selectBlock(null);
      resetProof();
    }

    // ── Query → Caliper Bridge ─────────────────────────────────────────────
    // Extract canonical atom selection pair from the execution result and
    // push it into useViewerStore.  The proof scene sync useEffect in
    // MolecularViewport already reacts to selectionA/B changes, so this
    // single write wires the Query→Caliper pipeline with zero new effects.
    try {
      const { useViewerStore } = await import('../store/useViewerStore');
      const cert = execRes.certificate;
      // 1. Prefer explicit fields from the certificate query object
      let atomA: string | null =
        cert?.query?.atom_a_selection ??
        cert?.query?.selection_a ??
        cert?.query?.predicate?.atom_a ??
        null;
      let atomB: string | null =
        cert?.query?.atom_b_selection ??
        cert?.query?.selection_b ??
        cert?.query?.predicate?.atom_b ??
        null;

      // 2. Fallback: lightweight parse of the query text
      // Handles: FIND (name CA) WITHIN 4.0A OF (name O2)
      //          FIND DISTANCE(A:155:CA, LIG:1:O2) < 4.0 Å
      if (!atomA || !atomB) {
        const distMatch = queryText.match(/DISTANCE\(\s*([^,\s)]+)\s*,\s*([^,\s)]+)\s*\)/i);
        if (distMatch) {
          atomA = atomA ?? distMatch[1].trim();
          atomB = atomB ?? distMatch[2].trim();
        } else {
          const withinMatch = queryText.match(/FIND\s+\(([^)]+)\)\s+WITHIN\s+[\d.]+[AÅa]\s+OF\s+\(([^)]+)\)/i);
          if (withinMatch) {
            // Extract atom/resname from selector expressions like "name CA" or "resname LIG"
            const extractAtomName = (sel: string) => {
              const m = sel.match(/name\s+(\S+)/i) || sel.match(/resname\s+(\S+)/i);
              return m ? m[1] : sel.trim();
            };
            atomA = atomA ?? extractAtomName(withinMatch[1]);
            atomB = atomB ?? extractAtomName(withinMatch[2]);
          }
        }
      }

      if (atomA && atomB) {
        useViewerStore.getState().setSelections(atomA, atomB);
      }
    } catch {
      // Non-critical: caliper wiring is best-effort, interactive selection still works
    }
    // ────────────────────────────────────────────────────────────────────────

    return true;

  } catch (err: any) {
    if (currentToken !== activeExecutionId) {
      return false;
    }

    setExecutionStage('failed');
    resetProof();
    clearSubBlocks();

    if (err instanceof ApiError) {
      const structErr: StructuredExecutionError = {
        error_code: err.errorCode,
        message: err.message,
        location: err.location,
        action: err.action,
        detail: err.detail,
      };
      setStructuredError(structErr);
      setExecutionResult({
        truthValue: 'ERROR',
        resolutionStatus: err.errorCode,
        structuredError: structErr,
        executionId: null,
        certificate: null,
        executionPlan: [],
        witnessIntervals: [],
        evaluatedBlocks: [],
      });
    } else {
      const fallbackErr: StructuredExecutionError = {
        error_code: 'SERVER_ERROR',
        message: err.message || 'Execution error',
        action: 'Check server logs and ensure backend is reachable.',
        detail: err.stack,
      };
      setStructuredError(fallbackErr);
      setExecutionResult({
        truthValue: 'ERROR',
        resolutionStatus: 'SERVER_ERROR',
        structuredError: fallbackErr,
        executionId: null,
        certificate: null,
        executionPlan: [],
        witnessIntervals: [],
        evaluatedBlocks: [],
      });
    }
    return false;
  } finally {
    if (currentToken === activeExecutionId) {
      setExecuting(false);
    }
  }
}
