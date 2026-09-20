/**
 * frontend/src/workflow/api.ts
 * PASS 30 — Scientific Workflow Engine API Client
 *
 * Typed fetch wrappers for all /api/v1/workflow endpoints.
 * Uses the React Query cache so components can subscribe reactively.
 */

import type {
  BackendStatusRecord,
  WorkflowTemplate,
  WorkflowInstance,
  ProvenanceGraph,
  LineageReport,
  ReproducibilityManifest,
  ReproductionResult,
} from "./types.ts";

import { getApiBaseUrl } from "../api/config";

const getWorkflowBase = () => `${getApiBaseUrl()}/workflow`;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getWorkflowBase()}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`[workflow API] ${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Backend Discovery ────────────────────────────────────────────────────────

export function fetchBackends(
  forceRefresh = false
): Promise<BackendStatusRecord[]> {
  const qs = forceRefresh ? "?force_refresh=true" : "";
  return apiFetch<BackendStatusRecord[]>(`/backends${qs}`);
}

// ─── Workflow Templates ───────────────────────────────────────────────────────

export function fetchTemplates(): Promise<WorkflowTemplate[]> {
  return apiFetch<WorkflowTemplate[]>("/templates");
}

// ─── Workflow Execution ───────────────────────────────────────────────────────

export type WorkflowExecutionType = "4hhb" | "1bna" | "synth_500f";

export function executeWorkflow(
  type: WorkflowExecutionType
): Promise<WorkflowInstance> {
  return apiFetch<WorkflowInstance>(`/execute/${type}`, { method: "POST" });
}

// ─── Workflow Instance ────────────────────────────────────────────────────────

export function fetchWorkflow(
  workflowId: string
): Promise<WorkflowInstance> {
  return apiFetch<WorkflowInstance>(`/${workflowId}`);
}

// ─── Provenance Graph ─────────────────────────────────────────────────────────

export function fetchProvenance(
  workflowId: string
): Promise<ProvenanceGraph> {
  return apiFetch<ProvenanceGraph>(`/provenance/${workflowId}`);
}

// ─── Lineage Query ────────────────────────────────────────────────────────────

export function fetchLineage(artifactId: string): Promise<LineageReport> {
  return apiFetch<LineageReport>(`/lineage/${artifactId}`);
}

// ─── Reproducibility Manifest ─────────────────────────────────────────────────

export function fetchManifest(
  workflowId: string
): Promise<ReproducibilityManifest> {
  return apiFetch<ReproducibilityManifest>(`/manifest/${workflowId}`);
}

export function reproduceFromManifest(
  manifest: ReproducibilityManifest
): Promise<ReproductionResult> {
  return apiFetch<ReproductionResult>("/reproduce", {
    method: "POST",
    body: JSON.stringify(manifest),
  });
}

// ─── Export ───────────────────────────────────────────────────────────────────

export type ExportFormat = "json" | "csv" | "markdown";

export async function exportWorkflow(
  workflowId: string,
  format: ExportFormat
): Promise<string> {
  const res = await fetch(`${getWorkflowBase()}/export/${format}/${workflowId}`);
  if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);
  return res.text();
}
