/**
 * BackendDiscoveryMatrix.tsx
 * PASS 30 / Backend Discovery Matrix UI
 *
 * Shows all ecosystem backends discovered by BackendDiscoveryService:
 *   - Name, role, version, license, smoke-test latency
 *   - Availability state badge (AVAILABLE / UNAVAILABLE / FAILED_SELF_TEST)
 *   - Capabilities list
 *
 * Pure Fluent Light workstation design:
 *   - Clean #FAFAFA header, #FFFFFF body, subtle #E5E5E5 borders
 *   - Segoe UI Variable typography, #1C1C1C text, #5C5C5C metadata
 *   - Accessible scrollbar
 */

import React from "react";
import type { BackendStatusRecord, BackendCapabilityState } from "../../workflow/types";

// ─── State badges ─────────────────────────────────────────────────────────────

const STATE_STYLE: Record<BackendCapabilityState, { bg: string; text: string }> = {
  AVAILABLE:       { bg: "#0969DA", text: "#FFFFFF" },
  UNAVAILABLE:     { bg: "#6E7781", text: "#FFFFFF" },
  FAILED_SELF_TEST:{ bg: "#D1242F", text: "#FFFFFF" },
  UNSUPPORTED:     { bg: "#B45309", text: "#FFFFFF" },
};

function StateBadge({ state }: { state: BackendCapabilityState }) {
  const s = STATE_STYLE[state] ?? { bg: "#6E7781", text: "#FFFFFF" };
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-[4px] text-[10px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {state.replace("_", " ")}
    </span>
  );
}

// ─── Single backend row ───────────────────────────────────────────────────────

function BackendRow({ b }: { b: BackendStatusRecord }) {
  return (
    <tr className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
      {/* Name + role */}
      <td className="px-3 py-2.5 align-top min-w-[130px]">
        <div className="text-xs font-semibold text-[#1C1C1C] whitespace-nowrap">
          {b.name}
        </div>
        <div className="text-[11px] text-[#5C5C5C] mt-0.5 leading-snug">
          {b.role.length > 48 ? b.role.slice(0, 46) + "…" : b.role}
        </div>
      </td>

      {/* State */}
      <td className="px-3 py-2.5 align-middle whitespace-nowrap">
        <StateBadge state={b.state} />
      </td>

      {/* Version */}
      <td className="px-3 py-2.5 align-middle">
        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#005FB8] border border-[#E2E8F0]">
          {b.version}
        </span>
      </td>

      {/* License */}
      <td className="px-3 py-2.5 align-middle">
        <span className="text-[11px] text-[#5C5C5C] whitespace-nowrap font-medium">{b.license}</span>
      </td>

      {/* Smoke-test latency */}
      <td className="px-3 py-2.5 align-middle text-right tabular-nums">
        {b.smoke_test_passed ? (
          <span className="text-xs font-medium text-[#0969DA]">
            {b.smoke_test_latency_ms.toFixed(1)} ms
          </span>
        ) : (
          <span className="text-xs font-semibold text-[#D1242F]">FAILED</span>
        )}
      </td>

      {/* Capabilities */}
      <td className="px-3 py-2.5 align-top min-w-[200px]">
        <div className="flex flex-wrap gap-1">
          {b.capabilities.slice(0, 5).map(cap => (
            <span
              key={cap}
              className="text-[10px] px-1.5 py-0.5 rounded-[3px] whitespace-nowrap bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0]"
            >
              {cap.replace(/_/g, " ")}
            </span>
          ))}
          {b.capabilities.length > 5 && (
            <span className="text-[10px] text-[#5C5C5C] self-center">
              +{b.capabilities.length - 5}
            </span>
          )}
        </div>
        {b.error_message && (
          <div className="text-[10px] text-[#D1242F] mt-1 break-all bg-[#FEF2F2] p-1 rounded border border-[#FEE2E2]">
            {b.error_message.slice(0, 80)}
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Summary counts ───────────────────────────────────────────────────────────

function SummaryStrip({ backends }: { backends: BackendStatusRecord[] }) {
  const available = backends.filter(b => b.state === "AVAILABLE").length;
  const failed = backends.filter(b => b.state === "FAILED_SELF_TEST").length;
  const unavailable = backends.filter(b => b.state === "UNAVAILABLE").length;

  return (
    <div className="flex items-center gap-4 px-3.5 py-2 text-xs border-b border-[#E5E5E5] bg-[#FAFAFA]">
      <span className="font-semibold text-[#1C1C1C]">{backends.length} backends</span>
      <span className="text-[#0969DA] font-medium">{available} available</span>
      {failed > 0 && <span className="text-[#D1242F] font-medium">{failed} failed self-test</span>}
      {unavailable > 0 && <span className="text-[#5C5C5C]">{unavailable} unavailable</span>}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BackendDiscoveryMatrixProps {
  backends: BackendStatusRecord[];
  className?: string;
}

export function BackendDiscoveryMatrix({
  backends,
  className = "",
}: BackendDiscoveryMatrixProps) {
  if (backends.length === 0) {
    return (
      <div className={`flex items-center justify-center h-20 text-xs text-[#5C5C5C] ${className}`}>
        No backends discovered.
      </div>
    );
  }

  const sorted = [...backends].sort((a, b) => {
    // Available first, then alphabetical
    if (a.state === "AVAILABLE" && b.state !== "AVAILABLE") return -1;
    if (b.state === "AVAILABLE" && a.state !== "AVAILABLE") return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div
      className={`rounded-[6px] border border-[#E5E5E5] bg-[#FFFFFF] overflow-hidden ${className}`}
    >
      <SummaryStrip backends={backends} />
      <div className="overflow-x-auto overflow-y-auto scientific-scrollbar" style={{ maxHeight: 420 }}>
        <table
          className="w-full min-w-[680px] border-collapse text-left"
          aria-label="Backend discovery matrix"
        >
          <thead className="sticky top-0 bg-[#FAFAFA] z-10 border-b border-[#E5E5E5]">
            <tr>
              {["Backend", "State", "Version", "License", "Latency", "Capabilities"].map((h, idx) => (
                <th
                  key={h}
                  className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#5C5C5C] whitespace-nowrap ${
                    idx === 4 ? "text-right" : ""
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {sorted.map(b => (
              <BackendRow key={b.backend_id} b={b} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default BackendDiscoveryMatrix;
