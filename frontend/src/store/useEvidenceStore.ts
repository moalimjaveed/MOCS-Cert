/**
 * Zustand slice managing query execution plan DAG, structured error state, cryptographic evidence,
 * and canonical execution identity.
 */

import { create } from 'zustand';
import type { ExecutionPlanStep, StructuredExecutionError } from '../types/query';
import type { ExecutionIdentity } from '../types/provenance';
import { useTimelineStore } from './useTimelineStore';
import { useProofStore } from './useProofStore';

export type ExecutionStage = 'idle' | 'compiling' | 'executing' | 'refining' | 'completed' | 'failed';

export interface EvidenceState {
  executionPlan: ExecutionPlanStep[];
  queryId: string;
  queryText: string;
  executionId: string | null;
  queryHash: string | null;
  datasetId: string | null;
  topologyId: string | null;
  planHash: string | null;
  evidenceVersion: number;
  executionStage: ExecutionStage;
  structuredError: StructuredExecutionError | null;
  truthValue: string;
  resolutionStatus: string;
  quantifier: string;
  operator: string;
  semantics: string;
  pbc: string;
  precision: string;
  pruningEfficiency: number;
  blocksExamined: number;
  blocksTotal: number;
  blocksCertifiedTrue: number;
  blocksCertifiedFalse: number;
  certifiedBlocks: number;
  refinedBlocks: number;
  exactFramesScanned: number;
  framesTotal: number;
  framesExactRequested: number;
  witnessIntervals: number[][];
  evaluatedBlocks: any[];
  // Resource usage telemetry
  sourceCompressedBytesFetched?: number | null;
  coordinatePayloadBytes: number;
  compressedBytesFetchedMb: number | string | null;
  compressedFramesDecoded: number;
  coordinatesMaterialized: number;
  atomsAnalyzed: number;
  indexBytesReadMb: number;
  wallTimeSeconds: number;
  cpuTimeSeconds: number;
  peakMemoryMb: number;
  refinementSelectivity: string;
  refinementSpeed: number;
  ioPruneRatio: number;
  traversalDepth: number;
  certificate: Record<string, any> | null;
  isExecuting: boolean;

  // Actions
  setExecutionPlan: (plan: ExecutionPlanStep[]) => void;
  setQueryText: (text: string) => void;
  setExecutionResult: (data: Partial<EvidenceDataFields>) => void;
  setExecutionStage: (stage: ExecutionStage) => void;
  setStructuredError: (err: StructuredExecutionError | null) => void;
  setExecuting: (executing: boolean) => void;
  invalidateExecution: () => void;
  clearExecutionTelemetry: () => void;
  getExecutionIdentity: () => ExecutionIdentity | null;
}

export type EvidenceDataFields = Omit<
  EvidenceState,
  | 'setExecutionPlan'
  | 'setQueryText'
  | 'setExecutionResult'
  | 'setExecutionStage'
  | 'setStructuredError'
  | 'setExecuting'
  | 'invalidateExecution'
  | 'clearExecutionTelemetry'
  | 'getExecutionIdentity'
>;

export const EMPTY_TELEMETRY = {
  sourceCompressedBytesFetched: null,
  coordinatePayloadBytes: 0,
  compressedBytesFetchedMb: null,
  compressedFramesDecoded: 0,
  coordinatesMaterialized: 0,
  atomsAnalyzed: 0,
  indexBytesReadMb: 0,
  wallTimeSeconds: 0,
  cpuTimeSeconds: 0,
  peakMemoryMb: 0,
  refinementSelectivity: '',
  refinementSpeed: 0,
  ioPruneRatio: 0,
  traversalDepth: 0,
} as const;

export const EMPTY_EVIDENCE_DATA: Omit<
  EvidenceDataFields,
  'queryId' | 'queryText' | 'datasetId' | 'topologyId' | 'evidenceVersion' | 'isExecuting' | 'quantifier' | 'operator' | 'semantics' | 'pbc' | 'precision'
> = {
  executionId: null,
  queryHash: null,
  planHash: null,
  executionPlan: [],
  executionStage: 'idle',
  structuredError: null,
  truthValue: 'NO_EXECUTION',
  resolutionStatus: 'NOT_RUN',
  pruningEfficiency: 0,
  blocksExamined: 0,
  blocksTotal: 0,
  blocksCertifiedTrue: 0,
  blocksCertifiedFalse: 0,
  certifiedBlocks: 0,
  refinedBlocks: 0,
  exactFramesScanned: 0,
  framesTotal: 0,
  framesExactRequested: 0,
  witnessIntervals: [],
  evaluatedBlocks: [],
  certificate: null,
  ...EMPTY_TELEMETRY,
};

export const useEvidenceStore = create<EvidenceState>((set, get) => ({
  executionPlan: [],
  queryId: 'q_canonical_dist',
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
  quantifier: 'EXISTS',
  operator: 'DISTANCE-v1',
  semantics: 'sampled_frames',
  pbc: 'orthorhombic_minimum_image',
  precision: 'float64',
  pruningEfficiency: 0,
  blocksExamined: 0,
  blocksTotal: 0,
  blocksCertifiedTrue: 0,
  blocksCertifiedFalse: 0,
  certifiedBlocks: 0,
  refinedBlocks: 0,
  exactFramesScanned: 0,
  framesTotal: 0,
  framesExactRequested: 0,
  witnessIntervals: [],
  evaluatedBlocks: [],
  sourceCompressedBytesFetched: null,
  coordinatePayloadBytes: 0,
  compressedBytesFetchedMb: null,
  compressedFramesDecoded: 0,
  coordinatesMaterialized: 0,
  atomsAnalyzed: 0,
  indexBytesReadMb: 0,
  wallTimeSeconds: 0,
  cpuTimeSeconds: 0,
  peakMemoryMb: 0,
  refinementSelectivity: '',
  refinementSpeed: 0,
  ioPruneRatio: 0,
  traversalDepth: 0,
  certificate: null,
  isExecuting: false,

  setExecutionPlan: (plan) => set((state) => ({ executionPlan: plan, evidenceVersion: state.evidenceVersion + 1 })),

  setQueryText: (text) => {
    const current = get().queryText;
    if (current !== text) {
      try {
        useTimelineStore.getState().clearSubBlocks();
        useProofStore.getState().resetProof();
      } catch (e) {
        // Safe fallback in test environments
      }
      set((state) => ({
        ...EMPTY_EVIDENCE_DATA,
        queryText: text,
        evidenceVersion: state.evidenceVersion + 1,
      }));
    }
  },

  setExecutionResult: (data) => set((state) => ({
    ...state,
    ...data,
    evidenceVersion: state.evidenceVersion + 1,
  })),

  setExecutionStage: (stage) => set({ executionStage: stage }),

  setStructuredError: (err) => set((state) => ({
    structuredError: err,
    evidenceVersion: state.evidenceVersion + 1,
  })),

  setExecuting: (executing) => set({ isExecuting: executing }),

  invalidateExecution: () => {
    try {
      useTimelineStore.getState().clearSubBlocks();
      useProofStore.getState().resetProof();
    } catch (e) {
      // Safe fallback in test environments
    }
    set((state) => ({
      ...EMPTY_EVIDENCE_DATA,
      evidenceVersion: state.evidenceVersion + 1,
    }));
  },

  clearExecutionTelemetry: () => set((state) => ({
    ...EMPTY_TELEMETRY,
    executionStage: 'idle',
    structuredError: null,
    evidenceVersion: state.evidenceVersion + 1,
    blocksExamined: 0,
    blocksTotal: 0,
    blocksCertifiedTrue: 0,
    blocksCertifiedFalse: 0,
    certifiedBlocks: 0,
    refinedBlocks: 0,
    exactFramesScanned: 0,
    framesTotal: 0,
    framesExactRequested: 0,
    witnessIntervals: [],
    evaluatedBlocks: [],
    pruningEfficiency: 0,
    certificate: null,
  })),

  getExecutionIdentity: () => {
    const s = get();
    if (!s.executionId || !s.datasetId) return null;
    return {
      dataset_id: s.datasetId,
      topology_id: s.topologyId || '',
      query_hash: s.queryHash || '',
      execution_id: s.executionId,
      certificate_digest: s.certificate?.certificate_hash || s.certificate?.hash || null,
      plan_hash: s.planHash,
      evidence_version: s.evidenceVersion,
    };
  },
}));
