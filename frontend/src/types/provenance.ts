/**
 * Canonical Execution Identity & Scientific Provenance Models.
 * 
 * Enforces:
 * ONE EXECUTION -> ONE IDENTITY -> ONE CONSISTENT SCIENTIFIC STORY -> ALL VIEWS
 */

export interface ExecutionIdentity {
  /** Unique dataset/trajectory identifier (e.g. 'synth_500f.xtc') */
  dataset_id: string;
  /** Unique topology identifier (e.g. 'synth_500f.gro') */
  topology_id: string;
  /** SHA-256 hash (truncated or full) of the normalized query string */
  query_hash: string;
  /** Monotonic execution token or backend execution UUID ('exec_...') */
  execution_id: string;
  /** SHA-256 digest of the cryptographic certificate, if generated */
  certificate_digest: string | null;
  /** Fingerprint or SHA-256 hash of the execution plan steps */
  plan_hash: string | null;
  /** Monotonically increasing version counter for execution state mutations */
  evidence_version: number;
}

export type ProvenanceScope = 'EXECUTION-SCOPED' | 'DATASET-SCOPED' | 'SYSTEM-SCOPED';

export type ScientificValueClass =
  | 'RAW_SOURCE_DATA'
  | 'COMPUTED_FROM_SOURCE'
  | 'USER_INPUT'
  | 'CONFIGURATION'
  | 'TEST_FIXTURE'
  | 'DOCUMENTATION_EXAMPLE'
  | 'PLACEHOLDER'
  | 'UNKNOWN';

export interface ScientificProvenanceRecord {
  value_id: string;
  label: string;
  value: any;
  value_class: ScientificValueClass;
  scope: ProvenanceScope;
  source: string;
  execution_identity?: ExecutionIdentity | null;
}

/**
 * Creates a canonical ExecutionIdentity instance.
 */
export function createExecutionIdentity(params: {
  dataset_id: string;
  topology_id: string;
  query_hash: string;
  execution_id: string;
  certificate_digest?: string | null;
  plan_hash?: string | null;
  evidence_version?: number;
}): ExecutionIdentity {
  return {
    dataset_id: params.dataset_id,
    topology_id: params.topology_id,
    query_hash: params.query_hash,
    execution_id: params.execution_id,
    certificate_digest: params.certificate_digest || null,
    plan_hash: params.plan_hash || null,
    evidence_version: params.evidence_version ?? 1,
  };
}

/**
 * Validates whether a given target belongs to the currently active execution identity.
 * 
 * Rules:
 * 1. If target is DATASET-SCOPED, only dataset_id and topology_id must match.
 * 2. If target is EXECUTION-SCOPED, execution_id, query_hash, dataset_id, and topology_id must all match.
 */
export function matchesActiveExecution(
  activeIdentity: ExecutionIdentity | null,
  target: {
    dataset_id?: string | null;
    topology_id?: string | null;
    query_hash?: string | null;
    execution_id?: string | null;
    evidence_version?: number;
    scope?: ProvenanceScope;
  }
): boolean {
  if (!activeIdentity) return false;

  // Dataset scope check
  if (target.scope === 'DATASET-SCOPED') {
    if (target.dataset_id && target.dataset_id !== activeIdentity.dataset_id) return false;
    if (target.topology_id && target.topology_id !== activeIdentity.topology_id) return false;
    return true;
  }

  // Execution-scoped check requires exact execution_id match
  if (!target.execution_id || target.execution_id !== activeIdentity.execution_id) {
    return false;
  }

  if (target.query_hash && target.query_hash !== activeIdentity.query_hash) {
    return false;
  }

  if (target.dataset_id && target.dataset_id !== activeIdentity.dataset_id) {
    return false;
  }

  if (target.evidence_version !== undefined && target.evidence_version !== activeIdentity.evidence_version) {
    return false;
  }

  return true;
}

/**
 * Returns true if an entity represents execution-scoped scientific evidence.
 */
export function isExecutionScoped(scopeOrEntity: string): boolean {
  if (scopeOrEntity === 'EXECUTION-SCOPED') return true;
  if (scopeOrEntity === 'DATASET-SCOPED' || scopeOrEntity === 'SYSTEM-SCOPED') return false;

  const executionScopedEntities = [
    'verdict',
    'certificate',
    'execution_plan',
    'witness_intervals',
    'refined_blocks',
    'exact_frames',
    'telemetry',
    'pruning_efficiency',
    'benchmark_trace',
    'proof_state',
  ];
  return executionScopedEntities.includes(scopeOrEntity.toLowerCase());
}
