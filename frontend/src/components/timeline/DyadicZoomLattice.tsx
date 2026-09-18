import React, { useState, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTimelineStore, useProofStore } from '../../store';
import { refineBlock } from '../../api/client';
import { wsService } from '../../api/websocket';
import { useMocsAnimation, gsap } from '../../motion';

export interface DyadicZoomLatticeProps {
  className?: string;
  onChildSelect?: (sub: { child_id: string; frame_start: number; frame_end_exclusive: number }) => void;
}

export const DyadicZoomLattice: React.FC<DyadicZoomLatticeProps> = ({
  className = '',
  onChildSelect,
}) => {
  const { selectedBlockId, activeSubBlocks, setSubBlocks, isRefining, setRefining } =
    useTimelineStore();
  const { setFocusedBlock } = useProofStore();
  const [activeChildId, setActiveChildId] = useState<string>('41.2');
  const childGridRef = useRef<HTMLDivElement>(null);

  useMocsAnimation(
    (ctx, isReduced) => {
      if (!childGridRef.current) return;
      const cards = childGridRef.current.querySelectorAll('button[data-testid^="dyadic-sub-block-"]');
      if (!cards.length) return;

      if (isReduced) {
        cards.forEach((c) => {
          (c as HTMLElement).style.opacity = '1';
          (c as HTMLElement).style.transform = 'none';
        });
        return;
      }

      ctx.add(() => {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 6 },
          {
            opacity: 1,
            y: 0,
            duration: 0.18,
            stagger: 0.03,
            ease: 'power2.out',
          }
        );
      });
    },
    { scope: childGridRef, dependencies: [activeSubBlocks, isRefining] }
  );

  const handleRefine = async () => {
    const targetId = selectedBlockId ?? 41;
    try {
      setRefining(true);

      // Trigger via WebSocket if connected or REST fallback
      if (wsService.isConnected) {
        wsService.send({ action: 'refine_block', block_id: targetId });
      }

      const res = await refineBlock(targetId);
      if (res && res.child_blocks) {
        setSubBlocks(res.child_blocks);
      }
    } catch (e) {
      console.error('Refine failed', e);
    } finally {
      setRefining(false);
    }
  };

  // Canonical child blocks matching Figure 2 if not yet refined
  const displayChildren =
    activeSubBlocks.length > 0
      ? activeSubBlocks
      : [
          {
            child_id: '41.0',
            parent_id: 41,
            frame_start: 41000,
            frame_end_exclusive: 41200,
            lower_bound: 4.1,
            upper_bound: 4.35,
            truth_value: 'FALSE',
            status: 'CERTIFIED_FALSE',
          },
          {
            child_id: '41.1',
            parent_id: 41,
            frame_start: 41200,
            frame_end_exclusive: 41400,
            lower_bound: 3.85,
            upper_bound: 4.12,
            truth_value: 'UNKNOWN',
            status: 'REFINED',
          },
          {
            child_id: '41.2',
            parent_id: 41,
            frame_start: 41400,
            frame_end_exclusive: 41600,
            lower_bound: 3.65,
            upper_bound: 3.98,
            truth_value: 'TRUE',
            status: 'CERTIFIED_TRUE',
          },
          {
            child_id: '41.3',
            parent_id: 41,
            frame_start: 41600,
            frame_end_exclusive: 41800,
            lower_bound: 3.75,
            upper_bound: 4.05,
            truth_value: 'UNKNOWN',
            status: 'REFINED',
          },
          {
            child_id: '41.4',
            parent_id: 41,
            frame_start: 41800,
            frame_end_exclusive: 42000,
            lower_bound: 4.05,
            upper_bound: 4.28,
            truth_value: 'FALSE',
            status: 'CERTIFIED_FALSE',
          },
        ];

  const currentParent = selectedBlockId ?? 41;

  return (
    <div
      data-testid="dyadic-refinement-tree"
      className={`bg-[#FFFFFF] rounded-[6px] border border-[#E5E5E5] p-4 text-xs select-none w-full shadow-xs min-w-0 ${className}`}
    >
      {/* Refinement Tree Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F0F0F0]">
        <div className="flex flex-col space-y-1 min-w-0">
          <h2 className="text-[14px] font-semibold text-[#1C1C1C] m-0 tracking-tight">
            Dyadic Interval Refinement Tree
          </h2>
          <div className="flex items-center gap-2 flex-wrap text-[11px] text-[#5C5C5C]">
            <span className="font-medium text-[#1C1C1C]">Block {currentParent}</span>
            <span className="text-[#D1D1D1]">·</span>
            <span className="tabular-nums">410.0–420.0 ns</span>
            <span className="text-[#D1D1D1]">·</span>
            <span>5 Sub-blocks</span>
            <span className="text-[#D1D1D1]">·</span>
            <span className="font-mono">Δt = 2.0 ns</span>
            <span className="text-[#D1D1D1]">·</span>
            <span className="text-[#707070]">Level 0 (Coarse) &rarr; Level 1 (Dyadic Fine Evaluation)</span>
          </div>
        </div>

        {/* Refine Block Primary Action Button */}
        <button
          type="button"
          data-testid="refine-tree-btn"
          onClick={handleRefine}
          disabled={isRefining}
          className={`h-8 px-3.5 rounded-[4px] font-medium text-[11px] flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#005FB8] shrink-0 cursor-pointer ${
            isRefining
              ? 'bg-[#F1F5F9] text-[#94A3B8] cursor-not-allowed border border-[#E2E8F0]'
              : 'bg-[#005FB8] hover:bg-[#0067C0] active:bg-[#0052A0] text-white shadow-xs'
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefining ? 'animate-spin' : ''}`} />
          <span>{isRefining ? 'Subdividing…' : 'Refine Block'}</span>
        </button>
      </div>

      {/* Refinement Visualization Body */}
      <div className="pt-3 space-y-2 min-w-0">
        {/* Level 0: Parent Block Structured Node (Two-level layout) */}
        <div className="p-3.5 bg-[#F8FAFC] rounded-[4px] border border-[#E2E8F0] space-y-2">
          {/* Level 1: Primary Identity & Range */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-baseline gap-2.5 min-w-0">
              <span className="font-semibold text-[13px] text-[#1C1C1C] tracking-tight">
                Parent Block {currentParent}
              </span>
              <span className="text-[12px] font-medium text-[#4A4A4A] tabular-nums">
                410.0–420.0 ns
              </span>
              <span className="text-[#CBD5E1]">·</span>
              <span className="text-[12px] font-mono font-semibold text-[#0F172A] tabular-nums">
                [3.65, 4.35] Å
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-[#64748B] uppercase tracking-wider font-semibold">
                Level 0 Bound
              </span>
              <span className="px-2 py-0.5 rounded-[3px] text-[10px] font-bold tracking-wider uppercase bg-[#D97706] text-white leading-none">
                UNKNOWN
              </span>
            </div>
          </div>

          {/* Level 2: Secondary Computational Parameters */}
          <div className="flex items-center gap-3 text-[11px] text-[#5C5C5C] pt-1.5 border-t border-[#EDF2F7]">
            <span className="font-medium text-[#2D3748]">5 Sub-blocks</span>
            <span className="text-[#CBD5E1]">·</span>
            <span className="font-mono tabular-nums">Δt = 2.0 ns</span>
            <span className="text-[#CBD5E1]">·</span>
            <span className="text-[#718096]">Level 0 (Coarse Bound) &rarr; Level 1 (Dyadic Fine Evaluation)</span>
          </div>
        </div>

        {/* Dedicated Refinement Viewport (Internal scroll container prevents window-level overflow) */}
        <div className="refinement-viewport overflow-x-auto w-full pt-1 pb-1 min-w-0">
          <div className="min-w-[960px] w-full space-y-1.5">
            {/* Tree Branching Connector (SVG tree mathematically aligned with 5-column centers) */}
            <div className="relative h-5 w-full" aria-hidden="true">
              <svg
                data-testid="dyadic-tree-connector-svg"
                width="100%"
                height="20"
                className="absolute inset-0"
                aria-hidden="true"
              >
                {/* Center vertical stem down from parent */}
                <line x1="50%" y1="0" x2="50%" y2="10" stroke="#CBD5E1" strokeWidth="1" />
                {/* Horizontal branch spanning across children */}
                <line x1="10%" y1="10" x2="90%" y2="10" stroke="#CBD5E1" strokeWidth="1" />
                {/* 5 vertical drops down to children at 10%, 30%, 50%, 70%, 90% */}
                <line x1="10%" y1="10" x2="10%" y2="20" stroke="#CBD5E1" strokeWidth="1" />
                <line x1="30%" y1="10" x2="30%" y2="20" stroke="#CBD5E1" strokeWidth="1" />
                <line x1="50%" y1="10" x2="50%" y2="20" stroke="#CBD5E1" strokeWidth="1" />
                <line x1="70%" y1="10" x2="70%" y2="20" stroke="#CBD5E1" strokeWidth="1" />
                <line x1="90%" y1="10" x2="90%" y2="20" stroke="#CBD5E1" strokeWidth="1" />
              </svg>
            </div>

            {/* Level 1: Sub-block Nodes (Equally distributed 5-column grid) */}
            <div ref={childGridRef} className="grid grid-cols-5 gap-3.5 w-full">
              {displayChildren.map((sub, idx) => {
                const isSelected = activeChildId === sub.child_id;
                const subIdx = parseInt(sub.child_id.split('.')[1] || '0', 10);
                const timeStart = 410 + subIdx * 2;
                const timeEnd = timeStart + 2;

                // Strict solid semantic colors per RULE.md
                const statusBg =
                  sub.truth_value === 'TRUE'
                    ? 'bg-[#0969DA]' // Cobalt True
                    : sub.truth_value === 'FALSE'
                    ? 'bg-[#E11D48]' // Rose False
                    : sub.truth_value === 'UNRESOLVABLE'
                    ? 'bg-[#6D28D9]' // Violet Unresolvable
                    : 'bg-[#D97706]'; // Amber Unknown

                return (
                  <button
                    key={sub.child_id}
                    type="button"
                    data-testid={`dyadic-sub-block-${sub.child_id}`}
                    aria-pressed={isSelected}
                    style={{ animationDelay: `${idx * 35}ms` }}
                    onClick={() => {
                      setActiveChildId(sub.child_id);
                      setFocusedBlock(
                        currentParent,
                        [timeStart, timeEnd],
                        sub.lower_bound,
                        sub.upper_bound,
                        sub.status
                      );
                      if (onChildSelect) {
                        onChildSelect({
                          child_id: sub.child_id,
                          frame_start: sub.frame_start,
                          frame_end_exclusive: sub.frame_end_exclusive,
                        });
                      }
                    }}
                    className={`p-3.5 rounded-[4px] border text-left flex flex-col justify-between min-h-[118px] transition-colors duration-100 min-w-0 box-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#005FB8] interactive-press sub-block-enter ${
                      isSelected
                        ? 'border-[#005FB8] shadow-[inset_0_0_0_1.5px_#005FB8] bg-[#F8FAFC]'
                        : 'border-[#E5E5E5] bg-[#FFFFFF] hover:border-[#B0C4DE] hover:bg-[#FAFAFA]'
                    }`}
                  >
                    {/* 1. Header: Compact Title + Compact Status Badge (Grid: minmax(0,1fr) auto) */}
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 pb-2 border-b border-[#F0F0F0] w-full min-w-0">
                      <span className="font-semibold text-[#1C1C1C] text-[12px] tracking-tight truncate">
                        SUB {sub.child_id}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-[3px] text-[9.5px] font-bold tracking-wider uppercase text-white shrink-0 leading-none ${statusBg}`}
                      >
                        {sub.truth_value}
                      </span>
                    </div>

                    {/* 2. Structured Metadata Grid: Rigid 58px label column, flexible value column */}
                    <div className="grid grid-cols-[58px_minmax(0,1fr)] gap-x-2 gap-y-1.5 w-full text-[11px] items-baseline pt-2 min-w-0">
                      <span className="text-[#707070] font-semibold text-[10px] uppercase tracking-[0.05em] min-w-0">
                        INTERVAL
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-[#1C1C1C] min-w-0 max-w-full truncate">
                        [{sub.lower_bound.toFixed(2)}, {sub.upper_bound.toFixed(2)}] Å
                      </span>

                      <span className="text-[#707070] font-semibold text-[10px] uppercase tracking-[0.05em] min-w-0">
                        FRAMES
                      </span>
                      <span className="tabular-nums text-[#4A4A4A] min-w-0 max-w-full truncate">
                        {timeStart}–{timeEnd} ns
                      </span>

                      <span className="text-[#707070] font-semibold text-[10px] uppercase tracking-[0.05em] min-w-0">
                        OFFSET
                      </span>
                      <span className="font-mono tabular-nums text-[#4A4A4A] min-w-0 max-w-full truncate">
                        {sub.frame_start}–{sub.frame_end_exclusive}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
