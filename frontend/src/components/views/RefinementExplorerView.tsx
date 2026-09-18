import React from 'react';
import {
  Sliders,
  TrendingDown,
  Layers,
  Activity,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { MocsBadge } from '../primitives';
import { DyadicZoomLattice } from '../timeline/DyadicZoomLattice';
import { TimelineLattice } from '../timeline/TimelineLattice';
import { useEvidenceStore, useProofStore, useTimelineStore } from '../../store';

/**
 * Refinement Explorer View
 * 
 * Reconstructed Information Architecture:
 * 1. REFINEMENT SUMMARY (Unified single telemetry strip, no floating cards, zero label wrap)
 * 2. PRIMARY REFINEMENT ANALYSIS (Dyadic Interval Refinement Tree)
 * 3. TEMPORAL EVIDENCE (Full Trajectory Temporal Lattice with subordinate legend)
 * 4. DETAIL / INTERVAL SEMANTICS (Selected Block [L, U] and query decision)
 */
export const RefinementExplorerView: React.FC = () => {
  const {
    pruningEfficiency,
    certifiedBlocks,
    refinedBlocks,
    exactFramesScanned,
    blocksExamined,
    executionId,
  } = useEvidenceStore();

  const { lowerBound, upperBound, threshold } = useProofStore();
  const { selectedBlockId } = useTimelineStore();

  const loosenessG = Math.max(0, upperBound - lowerBound);
  const currentBlockId = selectedBlockId ?? 41;

  const [highlightedChild, setHighlightedChild] = React.useState<{
    child_id: string;
    frame_start: number;
    frame_end_exclusive: number;
  } | null>(null);

  const isStraddling = lowerBound < threshold && upperBound > threshold;
  const isCertifiedTrue = upperBound <= threshold;

  return (
    <div
      data-testid="refinement-explorer-view"
      className="p-3 sm:p-4 space-y-3 flex-1 flex flex-col min-w-0 font-sans text-xs"
    >
      {!executionId && (!blocksExamined || blocksExamined === 0) && (
        <div data-testid="no-refinement-banner" className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[6px] flex items-center justify-between text-xs text-[#5C5C5C]">
          <span>NO REFINEMENT YET — Run a query requiring interval subdivision to observe dyadic coordinate refinement.</span>
          <MocsBadge variant="neutral" size="sm">Awaiting Execution</MocsBadge>
        </div>
      )}

      {/* 1. REFINEMENT SUMMARY: Unified single telemetry strip (Single-surface, zero card-in-card, zero label-wrap) */}
      <div
        data-testid="refinement-summary-strip"
        className="mocs-metric-strip mocs-metric-strip-4 shrink-0"
      >
        <div className="mocs-metric-cell">
          <div className="flex items-center justify-between gap-1.5">
            <span className="mocs-metric-label">Pruning Efficiency</span>
            <TrendingDown className="w-3.5 h-3.5 text-[#005FB8] shrink-0" aria-hidden="true" />
          </div>
          <div className="mocs-metric-value text-[20px] text-[#1C1C1C]">
            {pruningEfficiency != null ? `${pruningEfficiency.toFixed(1)}%` : '—'}
          </div>
          <div className="mocs-metric-subtext text-[#5C5C5C]">
            {certifiedBlocks ?? 0} of {blocksExamined ?? 0} blocks eliminated
          </div>
        </div>

        <div className="mocs-metric-cell">
          <div className="flex items-center justify-between gap-1.5">
            <span className="mocs-metric-label">Candidate Blocks</span>
            <Layers className="w-3.5 h-3.5 text-[#B45309] shrink-0" aria-hidden="true" />
          </div>
          <div className="mocs-metric-value text-[20px] text-[#1C1C1C]">
            {refinedBlocks ?? 0}
          </div>
          <div className="mocs-metric-subtext text-[#5C5C5C]">
            Required dyadic spatial subdivision
          </div>
        </div>

        <div className="mocs-metric-cell">
          <div className="flex items-center justify-between gap-1.5">
            <span className="mocs-metric-label">Exact Frames</span>
            <Activity className="w-3.5 h-3.5 text-[#005FB8] shrink-0" aria-hidden="true" />
          </div>
          <div className="mocs-metric-value text-[20px] text-[#1C1C1C]">
            {exactFramesScanned ?? 0}
          </div>
          <div className="mocs-metric-subtext text-[#5C5C5C]">
            {exactFramesScanned ?? 0} frames materialized
          </div>
        </div>

        <div className="mocs-metric-cell">
          <div className="flex items-center justify-between gap-1.5">
            <span className="mocs-metric-label">Invariant</span>
            <ShieldCheck className={`w-3.5 h-3.5 ${executionId || (blocksExamined && blocksExamined > 0) ? 'text-[#0969DA]' : 'text-[#8A8A8A]'} shrink-0`} aria-hidden="true" />
          </div>
          <div className="mocs-metric-value text-[17px] sm:text-[18px] flex items-center gap-1.5 text-[#1C1C1C]">
            {executionId || (blocksExamined && blocksExamined > 0) ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#0969DA] shrink-0" />
                <span>Monotonic Sound</span>
              </>
            ) : (
              <span className="text-[#8A8A8A] font-normal text-[15px]">Awaiting Execution</span>
            )}
          </div>
          <div className="mocs-metric-subtext text-[#5C5C5C]">
            {executionId || (blocksExamined && blocksExamined > 0)
              ? `Looseness G = ${loosenessG.toFixed(2)} Å ≥ 0 confirmed`
              : 'Requires executed query'}
          </div>
        </div>
      </div>

      {/* 2. PRIMARY REFINEMENT ANALYSIS: Dyadic Interval Refinement Tree (Dedicated surface) */}
      <div className="shrink-0">
        <DyadicZoomLattice
          onChildSelect={(sub) => setHighlightedChild(sub)}
        />
      </div>

      {/* 3. TEMPORAL EVIDENCE: Full Trajectory Timeline Lattice (Dedicated evidence surface) */}
      <div className="shrink-0" data-testid="timeline-lattice-container">
        <TimelineLattice
          variant="evidence-only"
          highlightBlockId={highlightedChild ? Math.floor(highlightedChild.frame_start / 200) : undefined}
          highlightSubBlockText={highlightedChild?.child_id}
        />
      </div>

      {/* 4. DETAIL / INTERVAL SEMANTICS: Selected Block Bounds and Query Decision */}
      <section
        data-testid="interval-semantics-card"
        aria-label="Interval Semantics and Decision"
        className="bg-[#FFFFFF] rounded-[6px] border border-[#E5E5E5] p-3.5 sm:p-4 shrink-0 select-none"
      >
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#F1F5F9]">
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-[#005FB8]" aria-hidden="true" />
            <span className="font-semibold text-xs text-[#1C1C1C] uppercase tracking-wider">
              Selected Block {currentBlockId} Interval Semantics
            </span>
          </div>
          <span className="text-[11px] text-[#5C5C5C]">
            Sampled slot frames [k_s, k_e), Δt = 10 ps
          </span>
        </div>

        {/* Flat definition rows — no nested borders */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#F1F5F9]">
          <div className="py-3 md:py-0 md:pr-4 space-y-1">
            <div className="text-[11px] font-semibold text-[#5C5C5C] uppercase tracking-wider">
              Lower Bound (L)
            </div>
            <div className="text-[18px] font-bold text-[#1C1C1C] tabular-nums">
              {lowerBound.toFixed(2)} Å
            </div>
            <div className="text-[10px] text-[#8A8A8A]">
              L = max(0, ||c_i − c_j|| − r_i − r_j)
            </div>
          </div>

          <div className="py-3 md:py-0 md:px-4 space-y-1">
            <div className="text-[11px] font-semibold text-[#5C5C5C] uppercase tracking-wider">
              Upper Bound (U)
            </div>
            <div className="text-[18px] font-bold text-[#1C1C1C] tabular-nums">
              {upperBound.toFixed(2)} Å
            </div>
            <div className="text-[10px] text-[#8A8A8A]">
              U = ||c_i − c_j|| + r_i + r_j
            </div>
          </div>

          <div className="py-3 md:py-0 md:pl-4 space-y-1">
            <div className="text-[11px] font-semibold text-[#5C5C5C] uppercase tracking-wider">
              Query Decision (θ = {threshold.toFixed(1)} Å)
            </div>
            <div className="flex items-center gap-2">
              <MocsBadge
                variant={isStraddling ? 'unknown' : isCertifiedTrue ? 'true' : 'false'}
                size="sm"
                icon={null}
              >
                {isStraddling ? 'UNKNOWN' : isCertifiedTrue ? 'TRUE' : 'FALSE'}
              </MocsBadge>
              <span className="text-[11px] text-[#5C5C5C]">
                {isStraddling ? '→ Exact Materialize' : '→ Certified Block'}
              </span>
            </div>
            <div className="text-[10px] text-[#8A8A8A]">
              {isStraddling
                ? 'Interval [L, U] straddles threshold θ'
                : isCertifiedTrue
                ? 'Upper bound U ≤ θ'
                : 'Lower bound L ≥ θ'}
            </div>
          </div>
        </div>

      </section>
    </div>
  );
};
