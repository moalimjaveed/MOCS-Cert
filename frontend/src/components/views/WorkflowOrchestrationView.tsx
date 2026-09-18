/**
 * WorkflowOrchestrationView.tsx
 * PASS 30 / Scientific Workflows & Ecosystem Orchestration Suite
 *
 * Provides:
 *   1. Backend Discovery Matrix   — ecosystem backends discovered and smoke-tested
 *   2. Workflow Execution Panel   — run 4HHB / 1BNA / synth_500f certified workflows
 *   3. Provenance & Lineage       — DAG + artifact lineage inspector
 *
 * Full Fluent Light workstation aesthetic:
 *   - Zero pitch-black cards (elevation-1 white cards with subtle borders)
 *   - High contrast Segoe UI Variable typography (#1C1C1C headings, #5C5C5C subtitles)
 *   - Epistemic color compliance (Emerald certified, Cobalt active, Rose failed)
 */

import React, { useState, useCallback } from "react";
import {
  Play,
  RefreshCw,
  GitBranch,
  Shield,
  Search,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";

import { BackendDiscoveryMatrix } from "./BackendDiscoveryMatrix";
import { ProvenanceGraphViewer } from "./ProvenanceGraphViewer";
import { LineageQueryInspector } from "./LineageQueryInspector";
import { MocsTabs } from "../primitives";
import { getCurrentRawPath, parseRoute, navigateTo } from "../../navigation/router";

import type {
  BackendStatusRecord,
  WorkflowInstance,
  LineageReport,
  ScientificArtifact,
} from "../../workflow/types";

// ─── Inline micro-helpers ─────────────────────────────────────────────────────

const BASE = "/api/v1/workflow";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  COMPLETED: { bg: "#0969DA", text: "#FFFFFF" },
  RUNNING:   { bg: "#005FB8", text: "#FFFFFF" },
  FAILED:    { bg: "#D1242F", text: "#FFFFFF" },
  PENDING:   { bg: "#6E7781", text: "#FFFFFF" },
  CANCELLED: { bg: "#B45309", text: "#FFFFFF" },
};

function WorkflowStatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: "#6E7781", text: "#FFFFFF" };
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-[4px] text-[10px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {status}
    </span>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <div className="w-6 h-6 rounded-[4px] bg-[#EFF6FF] flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-[#005FB8]" aria-hidden="true" />
      </div>
      <div>
        <h2 className="text-[13px] font-semibold text-[#1C1C1C] tracking-wide">{title}</h2>
        {subtitle && (
          <p className="text-[11px] text-[#5C5C5C] mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

// ─── Workflow execution card ──────────────────────────────────────────────────

type WorkflowType = "4hhb" | "1bna" | "synth_500f";

const WORKFLOW_META: Record<WorkflowType, { label: string; desc: string; pdb?: string }> = {
  "4hhb":      { label: "4HHB Coordination", desc: "Hemoglobin Fe–His coordination chemistry", pdb: "4HHB" },
  "1bna":      { label: "1BNA Duplex",        desc: "B-DNA dodecamer nucleic acid geometry",   pdb: "1BNA" },
  "synth_500f":{ label: "Synth 500f Traj",   desc: "Synthetic 500-frame certified trajectory" },
};

function WorkflowRow({
  type,
  result,
  running,
  onExecute,
  onSelectArtifact,
}: {
  type: WorkflowType;
  result?: WorkflowInstance;
  running: boolean;
  onExecute: () => void;
  onSelectArtifact: (a: ScientificArtifact) => void;
}) {
  const meta = WORKFLOW_META[type];
  const artifacts = result?.provenance.artifacts
    ? Object.values(result.provenance.artifacts)
    : [];
  const cert = result?.certificate;

  return (
    <div
      className="p-3.5 rounded-[4px] border border-[#E5E5E5] bg-[#FFFFFF] hover:border-[#CBD5E1] transition-all flex flex-col gap-2.5 min-w-0"
      data-testid={`workflow-card-${type}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <div className="min-w-0 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[4px] bg-[#EFF6FF] border border-[#DBEAFE] flex items-center justify-center shrink-0">
            <span className="font-bold text-[11px] text-[#005FB8] font-mono">
              {meta.pdb || "SIM"}
            </span>
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-[#1C1C1C] truncate">
              {meta.label}
            </div>
            <div className="text-[11px] text-[#5C5C5C] truncate">{meta.desc}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {result ? (
            <WorkflowStatusBadge status={result.status} />
          ) : (
            <span className="text-[11px] text-[#8A8A8A] font-medium px-2 py-0.5 rounded bg-[#F1F5F9]">
              Ready
            </span>
          )}
          <button
            onClick={onExecute}
            disabled={running}
            className="flex items-center gap-1.5 px-3 py-1 rounded-[4px] text-[11.5px] font-semibold transition-colors bg-[#005FB8] hover:bg-[#004C99] text-white disabled:opacity-50 cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#005FB8]"
            aria-label={`Execute ${meta.label} workflow`}
          >
            {running ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{running ? "Running…" : "Execute"}</span>
          </button>
        </div>
      </div>

      {/* Certificate output */}
      {cert && (
        <div className="flex items-center gap-2 rounded-[3px] px-2.5 py-1 text-[11px] bg-[#F8FAFC] border-l-[3px] border-[#0969DA]">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#0969DA] shrink-0" />
          <span className="text-[#0969DA] font-bold">CERTIFIED</span>
          <span className="text-[#5C5C5C] font-mono text-[10.5px] truncate" title={cert.certificate_digest}>
            SHA-256: {(cert.certificate_digest ?? "").slice(0, 18)}…
          </span>
          {cert.discrepancy_classification && (
            <span className="text-[#1C1C1C] font-medium ml-auto shrink-0 text-[10.5px]">
              {cert.discrepancy_classification}
            </span>
          )}
        </div>
      )}

      {/* Artifact pills */}
      {artifacts.length > 0 && (
        <div className="flex items-center gap-1.5 pt-1.5 border-t border-[#F1F5F9] flex-wrap">
          <span className="text-[10.5px] text-[#8A8A8A] font-medium mr-1">Artifacts:</span>
          {artifacts.slice(0, 8).map((a) => (
            <button
              key={a.artifact_id}
              onClick={() => onSelectArtifact(a)}
              className="text-[10px] font-mono px-2 py-0.5 rounded-[3px] bg-[#F1F5F9] text-[#005FB8] border border-[#E2E8F0] hover:bg-[#E2E8F0] transition-colors cursor-pointer"
              title={`${a.kind}: ${a.name}`}
            >
              {a.kind}
            </button>
          ))}
          {artifacts.length > 8 && (
            <span className="text-[10px] text-[#5C5C5C]">
              +{artifacts.length - 8} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export const WorkflowOrchestrationView: React.FC = () => {
  // Backend discovery
  const [backends, setBackends] = useState<BackendStatusRecord[]>([]);
  const [backendsLoading, setBackendsLoading] = useState(false);
  const [backendsError, setBackendsError] = useState<string | null>(null);
  const [backendsLoaded, setBackendsLoaded] = useState(false);

  // Workflow results
  const [workflowResults, setWorkflowResults] = useState<Partial<Record<WorkflowType, WorkflowInstance>>>({});
  const [runningWorkflow, setRunningWorkflow] = useState<WorkflowType | null>(null);
  const [workflowErrors, setWorkflowErrors] = useState<Partial<Record<WorkflowType, string>>>({});

  // Provenance panel
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowInstance | null>(null);

  // Lineage panel
  const [selectedArtifact, setSelectedArtifact] = useState<ScientificArtifact | null>(null);
  const [lineageReport, setLineageReport] = useState<LineageReport | null>(null);
  const [lineageLoading, setLineageLoading] = useState(false);

  // Contextual tabs
  const initialTab = (() => {
    try {
      const { pathname, search } = getCurrentRawPath();
      const route = parseRoute(pathname, search);
      if (route.subtab && ['all', 'execution', 'discovery', 'provenance'].includes(route.subtab)) {
        return route.subtab as 'all' | 'execution' | 'discovery' | 'provenance';
      }
    } catch {
      // fallback
    }
    return 'all';
  })();
  const [selectedTab, setSelectedTab] = useState<'all' | 'execution' | 'discovery' | 'provenance'>(initialTab);

  const handleTabChange = (tabId: 'all' | 'execution' | 'discovery' | 'provenance') => {
    setSelectedTab(tabId);
    try {
      const { pathname } = getCurrentRawPath();
      if (pathname.startsWith('/workflows')) {
        navigateTo(`/workflows/${tabId}`, { replace: true });
      } else {
        navigateTo(`${pathname}?subtab=${tabId}`, { replace: true });
      }
    } catch {
      // fallback
    }
  };

  // ── Backend discovery ───────────────────────────────────────────────────────

  const loadBackends = useCallback(async (force = false) => {
    setBackendsLoading(true);
    setBackendsError(null);
    try {
      const qs = force ? "?force_refresh=true" : "";
      const data = await apiFetch<BackendStatusRecord[]>(`/backends${qs}`);
      setBackends(data);
      setBackendsLoaded(true);
    } catch (e) {
      setBackendsError(String(e));
    } finally {
      setBackendsLoading(false);
    }
  }, []);

  // ── Workflow execution ──────────────────────────────────────────────────────

  const executeWorkflow = useCallback(async (type: WorkflowType) => {
    setRunningWorkflow(type);
    setWorkflowErrors(prev => ({ ...prev, [type]: undefined }));
    try {
      const result = await apiFetch<WorkflowInstance>(`/execute/${type}`, { method: "POST" });
      setWorkflowResults(prev => ({ ...prev, [type]: result }));
      setSelectedWorkflow(result);
    } catch (e) {
      setWorkflowErrors(prev => ({ ...prev, [type]: String(e) }));
    } finally {
      setRunningWorkflow(null);
    }
  }, []);

  // ── Artifact → lineage query ─────────────────────────────────────────────

  const loadLineage = useCallback(async (artifact: ScientificArtifact) => {
    setSelectedArtifact(artifact);
    setLineageLoading(true);
    setLineageReport(null);
    try {
      const report = await apiFetch<LineageReport>(`/lineage/${artifact.artifact_id}`);
      setLineageReport(report);
    } catch {
      setLineageReport({
        target_artifact_id: artifact.artifact_id,
        causal_chain: [artifact.produced_by_step ?? "unknown"],
        ancestors: [],
      });
    } finally {
      setLineageLoading(false);
    }
  }, []);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      data-testid="workflow-orchestration-view"
      className="p-3 sm:p-4 space-y-4 flex-1 flex flex-col min-w-0 font-sans text-xs"
    >
      {/* ── Top Workspace Contextual Tabs ──────────────────────────────── */}
      <div className="bg-[#FFFFFF] rounded-[6px] border border-[#E5E5E5] overflow-hidden shrink-0">
        <MocsTabs
          testId="workflows-tabs"
          tabs={[
            { id: 'all', label: 'All Workflow Views' },
            { id: 'execution', label: 'Scientific Workflows' },
            { id: 'discovery', label: 'Backend Discovery' },
            { id: 'provenance', label: 'Provenance & Lineage' },
          ]}
          activeId={selectedTab}
          onChange={(id) => handleTabChange(id as typeof selectedTab)}
        />
      </div>

      {/* ── Section 1: Backend Discovery ─────────────────────────────────── */}
      {(selectedTab === 'all' || selectedTab === 'discovery') && (
        <section className="bg-[#FFFFFF] rounded-[6px] border border-[#E5E5E5] p-3.5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <SectionHeader
              icon={Shield}
              title="Backend Discovery Matrix"
              subtitle="Ecosystem backends discovered and smoke-tested at startup"
            />
            <button
              onClick={() => loadBackends(backendsLoaded)}
              disabled={backendsLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-semibold transition-colors bg-[#005FB8] hover:bg-[#004C99] text-white disabled:opacity-50 cursor-pointer shadow-sm"
              aria-label="Refresh backend discovery"
            >
              {backendsLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {backendsLoaded ? "Refresh Matrix" : "Discover Backends"}
            </button>
          </div>

          {backendsError && (
            <div className="flex items-center gap-2 text-[11px] text-[#D1242F] mb-3 p-2 bg-[#FEF2F2] border border-[#FEE2E2] rounded-[4px]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {backendsError}
            </div>
          )}

          {!backendsLoaded && !backendsLoading && (
            <div className="flex items-center gap-2 text-xs text-[#5C5C5C] h-16 border border-dashed border-[#CBD5E1] rounded-[6px] justify-center bg-[#F8FAFC]">
              Click <strong className="text-[#005FB8] font-semibold">Discover Backends</strong> to run automated backend smoke-tests.
            </div>
          )}

          {backendsLoaded && (
            <BackendDiscoveryMatrix backends={backends} />
          )}
        </section>
      )}

      {/* ── Section 2: Workflow Execution ─────────────────────────────────── */}
      {(selectedTab === 'all' || selectedTab === 'execution') && (
        <section className="bg-[#FFFFFF] rounded-[6px] border border-[#E5E5E5] p-3.5">
          <SectionHeader
            icon={Play}
            title="Scientific Workflow Execution"
            subtitle="Execute certified workflows on canonical structures or trajectories"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            {(["4hhb", "1bna", "synth_500f"] as WorkflowType[]).map(type => (
              <div key={type}>
                <WorkflowRow
                  type={type}
                  result={workflowResults[type]}
                  running={runningWorkflow === type}
                  onExecute={() => executeWorkflow(type)}
                  onSelectArtifact={loadLineage}
                />
                {workflowErrors[type] && (
                  <div className="mt-1.5 text-[10px] text-[#D1242F] flex items-start gap-1 p-1.5 bg-[#FEF2F2] border border-[#FEE2E2] rounded-[4px]">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{workflowErrors[type]}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Section 3: Provenance & Lineage ──────────────────────────────── */}
      {(selectedTab === 'all' || selectedTab === 'provenance') && (
        <section className="bg-[#FFFFFF] rounded-[6px] border border-[#E5E5E5] p-3.5">
          <SectionHeader
            icon={GitBranch}
            title="Provenance & Lineage"
            subtitle="Select a completed workflow to inspect its provenance DAG. Click an artifact to trace its causal lineage."
          />

          {/* Workflow selector */}
          {Object.keys(workflowResults).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(Object.entries(workflowResults) as [WorkflowType, WorkflowInstance][]).map(([type, inst]) => (
                <button
                  key={type}
                  onClick={() => setSelectedWorkflow(inst)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs transition-colors cursor-pointer border ${
                    selectedWorkflow?.workflow_id === inst.workflow_id
                      ? "bg-[#005FB8] text-white border-[#005FB8] font-semibold"
                      : "bg-[#F8FAFC] text-[#1C1C1C] border-[#E2E8F0] hover:bg-[#F1F5F9]"
                  }`}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  {WORKFLOW_META[type].label}
                </button>
              ))}
            </div>
          )}

          {selectedWorkflow ? (
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-3">
              {/* DAG */}
              <div>
                <p className="text-[11px] font-semibold text-[#5C5C5C] mb-1.5 uppercase tracking-wider">
                  Provenance DAG — {selectedWorkflow.name}
                </p>
                <ProvenanceGraphViewer graph={selectedWorkflow.provenance} />
              </div>

              {/* Lineage inspector */}
              <div>
                {lineageLoading && (
                  <div className="flex items-center justify-center h-20 gap-2 text-xs text-[#5C5C5C]">
                    <Loader2 className="w-4 h-4 animate-spin text-[#005FB8]" />
                    Tracing lineage…
                  </div>
                )}
                {lineageReport && !lineageLoading && (
                  <LineageQueryInspector report={lineageReport} />
                )}
                {!lineageReport && !lineageLoading && selectedArtifact && (
                  <div className="flex items-center gap-2 text-xs text-[#5C5C5C] h-20">
                    <Search className="w-4 h-4 text-[#005FB8]" />
                    Loading lineage for artifact…
                  </div>
                )}
                {!lineageReport && !lineageLoading && !selectedArtifact && (
                  <div className="flex flex-col items-center justify-center h-24 gap-1.5 text-xs text-[#5C5C5C] bg-[#F8FAFC] border border-dashed border-[#CBD5E1] rounded-[6px]">
                    <Search className="w-4 h-4 text-[#8A8A8A]" />
                    <span>Click an artifact badge above to trace its causal lineage.</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-24 gap-1.5 border border-dashed border-[#CBD5E1] rounded-[6px] text-xs text-[#5C5C5C] bg-[#F8FAFC]">
              <Clock className="w-4 h-4 text-[#8A8A8A]" />
              <span>Execute a workflow above to inspect its provenance DAG.</span>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default WorkflowOrchestrationView;
