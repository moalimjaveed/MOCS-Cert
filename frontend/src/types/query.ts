/**
 * Query compilation and execution type definitions.
 */

export interface ExecutionPlanStep {
  step_id: number;
  name: string;
  description: string;
  status: 'completed' | 'in_progress' | 'pending' | 'skipped';
  metadata?: Record<string, any>;
}

export type BoundingModel = 'AABB' | 'KDOP14';

export interface QueryCompileResponse {
  query_id: string;
  observable: string;
  predicate_operator: string;
  threshold_value: number;
  unit: string;
  selection_a: string;
  selection_b: string;
  temporal_operator?: string | null;
  min_duration_ps?: number | null;
  quantifier: string;
  chosen_plan: string;
  estimated_prune_rate: number;
  estimated_speedup: number;
  plan_steps: ExecutionPlanStep[];
  bounding_model?: BoundingModel;
}

export interface QueryExecuteResponse {
  query_id: string;
  truth_value: string;
  resolution_status: string;
  quantifier: string;
  certificate_id: string;
  certificate_hash: string;
  blocks_examined: number;
  blocks_total?: number;
  blocks_read?: number;
  blocks_certified_true?: number;
  blocks_certified_false?: number;
  blocks_refined?: number;
  blocks_exact_true?: number;
  blocks_exact_false?: number;
  blocks_exact_mixed?: number;
  blocks_unknown?: number;
  certified_blocks: number;
  refined_blocks: number;
  frames_total?: number;
  frames_exact_requested?: number;
  frames_decoded?: number;
  frames_materialized?: number;
  exact_frames_scanned: number;
  total_frames_refined: number;
  pruning_efficiency: number;
  wall_time_seconds: number;
  cpu_time_seconds: number;
  source_compressed_bytes_fetched?: number | null;
  compressed_bytes_fetched?: number | null;
  coordinate_payload_bytes?: number;
  coordinates_materialized: number;
  atoms_analyzed?: number;
  index_bytes_read: number;
  index_size_bytes?: number;
  peak_memory_bytes: number;
  refinement_selectivity?: string;
  refinement_speed?: number;
  io_prune_ratio?: number;
  traversal_depth?: number;
  certificate: Record<string, any>;
  plan_steps?: ExecutionPlanStep[];
  witness_intervals?: number[][];
  evaluated_blocks?: Array<{
    block_id: number;
    frame_start: number;
    frame_end_exclusive: number;
    lower_bound: number;
    upper_bound: number;
    truth_value: string;
    status: string;
  }>;
  execution_id?: string;
  query_hash?: string;
  bounding_model?: BoundingModel;
}

export interface QueryExecuteRequest {
  query_text: string;
  trajectory_id?: string;
  sampling_semantics?: string;
  pbc_mode?: string;
  precision?: string;
  quantifier?: string;
  bounding_model?: BoundingModel;
}

export type ExecutionErrorCode =
  | 'PARSE_FAILED'
  | 'INVALID_SELECTION'
  | 'UNSUPPORTED_GEOMETRY'
  | 'UNSUPPORTED_SEMANTICS'
  | 'MISSING_DATA'
  | 'MODEL_UNAVAILABLE'
  | 'VERIFICATION_FAILED'
  | 'INVALID_REQUEST_SCHEMA'
  | 'SERVER_ERROR';

export interface StructuredExecutionError {
  error_code: ExecutionErrorCode;
  message: string;
  location?: string;
  action?: string;
  detail?: string;
  error_type?: string;
  request_id?: string;
}

