/**
 * frontend/src/workflow/types.ts
 * PASS 30 — Scientific Workflow Engine TypeScript Contracts
 *
 * Mirrors mocs/workflow/{artifacts,steps,provenance,discovery,templates,manifest}.py
 * so the UI can deserialize backend responses with full type safety.
 */

// ─── Artifact Types ──────────────────────────────────────────────────────────

export type ArtifactKind =
  | "STRUCTURE"
  | "TRAJECTORY"
  | "SELECTION"
  | "TRANSFORMED_TRAJECTORY"
  | "ANALYSIS"
  | "COMPARISON"
  | "CERTIFICATE"
  | "EXPORT";

export interface ScientificArtifact {
  artifact_id: string;
  kind: ArtifactKind;
  name: string;
  description: string;
  produced_by_step: string;
  provenance_hash: string;
  created_at: number;
  // subclass fields (present depending on kind)
  source?: string;
  format?: string;
  atom_count?: number;
  frame_count?: number;
  timestep_ps?: number;
  selection_expression?: string;
  selected_atom_count?: number;
  transform_type?: string;
  metric_name?: string;
  metric_value?: number | number[];
  metric_units?: string;
  backend_used?: string;
  comparison_type?: string;
  rmsd_angstrom?: number;
  oracle_backend?: string;
  oracle_value?: number;
  absolute_difference?: number;
  classification?: string;
  workflow_name?: string;
  certificate_digest?: string;
  discrepancy_classification?: string;
  is_certified?: boolean;
  export_format?: string;
  content_digest?: string;
}

// ─── Step Types ──────────────────────────────────────────────────────────────

export type WorkflowStepType =
  | "INGEST"
  | "SELECT"
  | "TRANSFORM"
  | "ANALYZE"
  | "COMPARE"
  | "CERTIFY"
  | "EXPORT"
  | "VALIDATE"
  | "PROVENANCE"
  | "VISUALIZE"
  | "REPORT";

export type WorkflowStepStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED";

export interface WorkflowStep {
  step_id: string;
  step_type: WorkflowStepType;
  name: string;
  description: string;
  status: WorkflowStepStatus;
  inputs: string[];
  outputs: string[];
  backend: string;
  started_at?: number;
  completed_at?: number;
  duration_ms?: number;
  error?: string;
}

// ─── Provenance Graph ─────────────────────────────────────────────────────────

export interface ProvenanceNode {
  node_id: string;
  node_type: "STEP" | "ARTIFACT";
  label: string;
}

export interface ProvenanceEdge {
  from_node: string;
  to_node: string;
  relation: "PRODUCES" | "CONSUMES";
}

export interface ProvenanceGraph {
  workflow_id: string;
  nodes: ProvenanceNode[];
  edges: ProvenanceEdge[];
  artifacts: Record<string, ScientificArtifact>;
  steps: WorkflowStep[];
}

export interface LineageReport {
  target_artifact_id: string;
  causal_chain: string[];
  ancestors: string[];
  oracle_info?: {
    reference_backend: string;
    absolute_difference: number;
    classification: string;
    certificate_digest: string;
  };
}

// ─── Backend Discovery ────────────────────────────────────────────────────────

export type BackendCapabilityState = "AVAILABLE" | "UNAVAILABLE" | "FAILED_SELF_TEST" | "UNSUPPORTED";

export interface BackendStatusRecord {
  backend_id: string;
  name: string;
  role: string;
  state: BackendCapabilityState;
  version: string;
  license: string;
  citation: string;
  smoke_test_passed: boolean;
  smoke_test_latency_ms: number;
  capabilities: string[];
  limitations: string[];
  error_message?: string;
}

// ─── Workflow Templates ───────────────────────────────────────────────────────

export type WorkflowCategory =
  | "COORDINATION_CHEMISTRY"
  | "NUCLEIC_ACID_STRUCTURE"
  | "TRAJECTORY_CERTIFICATION"
  | "LIGAND_ANALYSIS"
  | "CRYSTALLOGRAPHIC_VALIDATION"
  | "STRUCTURE_COMPARISON"
  | "SIMULATION_SETUP";

export interface WorkflowTemplate {
  template_id: string;
  name: string;
  description: string;
  category: WorkflowCategory;
  steps: string[];
  required_inputs: string[];
  expected_outputs: string[];
  example_pdb_ids: string[];
  estimated_duration_s: number;
  backend_requirements: string[];
}

// ─── Workflow Instance ────────────────────────────────────────────────────────

export type WorkflowStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface WorkflowInstance {
  workflow_id: string;
  name: string;
  status: WorkflowStatus;
  template_id?: string;
  started_at: number;
  completed_at?: number;
  error?: string;
  provenance: ProvenanceGraph;
  certificate?: ScientificArtifact;
}

// ─── Reproducibility Manifest ─────────────────────────────────────────────────

export interface ReproducibilityManifest {
  name: string;
  workflow_id: string;
  manifest_digest: string;
  status: WorkflowStatus;
  artifact_count: number;
  backends_used: string[];
  created_at: number;
  artifacts: ScientificArtifact[];
  steps: WorkflowStep[];
  certificate?: ScientificArtifact;
}

// ─── API Request / Response shapes ───────────────────────────────────────────

export interface ReproductionResult {
  reproduced_workflow_id: string;
  status: WorkflowStatus;
  certificate_matched: boolean;
  manifest_digest_verified: boolean;
  artifacts_generated: number;
  reproduction_timestamp: number;
}
