/**
 * LineageQueryInspector.tsx
 * PASS 30 / Artifact Lineage Causal Chain Inspector
 *
 * Displays the causal chain for a selected artifact:
 *   Claim → Evidence Witness → Backend Oracle → DiscrepancyClassification
 *
 * Pure Fluent Light workstation design:
 *   - Clean #FFFFFF surface, subtle #E5E5E5 border
 *   - Clear oracle verdict badges
 *   - High contrast Segoe UI Variable typography
 */

import React from "react";
import type { LineageReport } from "../../workflow/types";

// ─── Oracle verdict badge ─────────────────────────────────────────────────────

const VERDICT_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  WITHIN_TOLERANCE: { bg: "#0969DA", text: "#FFFFFF", label: "WITHIN TOLERANCE" },
  MARGINAL:         { bg: "#B45309", text: "#FFFFFF", label: "MARGINAL" },
  DISCREPANT:       { bg: "#D1242F", text: "#FFFFFF", label: "DISCREPANT" },
  UNVERIFIED:       { bg: "#6E40C9", text: "#FFFFFF", label: "UNVERIFIED" },
};

function OracleBadge({ classification }: { classification: string }) {
  const style = VERDICT_STYLE[classification] ?? { bg: "#6E7781", text: "#FFFFFF", label: classification };
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-[4px] text-[10px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  );
}

// ─── Chain step ───────────────────────────────────────────────────────────────

function ChainStep({ index, label }: { index: number; label: string }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <span
        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border border-[#005FB8] text-[#005FB8] bg-[#EFF6FF]"
      >
        {index + 1}
      </span>
      <span className="text-xs text-[#1C1C1C] break-all pt-0.5">{label}</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface LineageQueryInspectorProps {
  report: LineageReport;
  className?: string;
}

export function LineageQueryInspector({
  report,
  className = "",
}: LineageQueryInspectorProps) {
  const oracle = report.oracle_info;

  return (
    <div
      className={`rounded-[6px] border border-[#E5E5E5] bg-[#FFFFFF] p-3 space-y-3 shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-[#F1F5F9]">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5C5C5C]">
          Lineage — Artifact
        </span>
        <code className="text-[11px] font-mono text-[#005FB8] bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#DBEAFE] truncate max-w-[260px]">
          {report.target_artifact_id}
        </code>
      </div>

      {/* Causal chain */}
      {report.causal_chain.length > 0 && (
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#5C5C5C] mb-2">
            Causal Chain
          </p>
          <div className="space-y-2">
            {report.causal_chain.map((step, i) => (
              <ChainStep key={i} index={i} label={step} />
            ))}
          </div>
        </section>
      )}

      {/* Ancestors */}
      {report.ancestors.length > 0 && (
        <section className="pt-2 border-t border-[#F1F5F9]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#5C5C5C] mb-1.5">
            Ancestor Artifacts ({report.ancestors.length})
          </p>
          <div className="space-y-1">
            {report.ancestors.map((anc: any, idx: number) => {
              const id = typeof anc === 'string' ? anc : (anc.artifact_id || String(idx));
              const name = typeof anc === 'string' ? anc : (anc.name || anc.artifact_id);
              const kind = typeof anc === 'string' ? 'ARTIFACT' : (anc.kind || 'ARTIFACT');
              return (
                <div
                  key={id}
                  className="flex items-center justify-between text-xs py-1 px-2 rounded bg-[#F8FAFC] border border-[#F1F5F9]"
                >
                  <span className="text-[#1C1C1C] font-mono text-[11px] truncate">{name}</span>
                  <span className="text-[10px] text-[#5C5C5C] ml-2 shrink-0">{kind}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Oracle differential info */}
      {oracle && (
        <section className="pt-2 border-t border-[#F1F5F9] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5C5C5C]">
              Oracle Comparison
            </span>
            <OracleBadge classification={oracle.classification} />
          </div>

          <div className="text-xs space-y-1 pt-1 font-mono">
            {oracle.reference_backend && (
              <div className="flex items-center justify-between">
                <span className="text-[#5C5C5C]">Reference backend:</span>
                <span className="text-[#005FB8] font-semibold">{oracle.reference_backend}</span>
              </div>
            )}
            {oracle.absolute_difference !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-[#5C5C5C]">Absolute difference:</span>
                <span className="text-[#1C1C1C]">
                  {Number(oracle.absolute_difference).toFixed(4)} Å
                </span>
              </div>
            )}
            {oracle.certificate_digest && (
              <div className="flex items-center justify-between">
                <span className="text-[#5C5C5C]">Certificate:</span>
                <span className="text-[#5C5C5C] truncate max-w-[200px]" title={oracle.certificate_digest}>
                  {oracle.certificate_digest.slice(0, 16)}…
                </span>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default LineageQueryInspector;
