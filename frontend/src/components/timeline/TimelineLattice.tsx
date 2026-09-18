import React, { useEffect, useRef, useState, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTimelineStore, useProofStore } from '../../store';
import { fetchBlocks, refineBlock } from '../../api/client';
import { wsService } from '../../api/websocket';

export interface ChildBlockState {
  child_id: string;
  parent_id: number;
  time_start_ns: number;
  time_end_ns: number;
  lower_bound: number;
  upper_bound: number;
  truth_value: 'TRUE' | 'FALSE' | 'UNKNOWN';
  status: 'CERTIFIED_TRUE' | 'CERTIFIED_FALSE' | 'REFINED' | 'EXACT';
}

export interface BlockGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Computes canonical block geometry for a discrete timeline block.
 * Uses exact integer scaling and sub-pixel gap allocation without padding or offsets.
 */
export function computeBlockGeometry(
  blockIndex: number,
  totalBlocks: number,
  canvasWidth: number,
  canvasHeight: number
): BlockGeometry {
  const blockWidth = canvasWidth / totalBlocks;
  return {
    x: blockIndex * blockWidth,
    y: 0,
    width: Math.max(1, blockWidth - 0.5),
    height: canvasHeight,
  };
}

/**
 * Renders the precision blue selection outline strictly on canonical block bounds.
 * Implements box-sizing: border-box via clipping to the exact bounding rectangle:
 * - Exactly 0px drawn outside the block bounds
 * - Outer half of stroke is discarded by clipping, inner half forms 1.5–2px outline
 * - No vertical side strips, no blue rails, no underline, zero overflow into neighbors
 */
export function drawSelectionOutline(
  ctx: CanvasRenderingContext2D,
  geom: BlockGeometry,
  strokeWidth: number = 2
): void {
  if (!ctx || typeof ctx.beginPath !== 'function') return;
  ctx.save?.();
  // Strict boundary clip ensures zero pixels bleed outside the exact block bounds
  ctx.beginPath?.();
  if (typeof ctx.rect === 'function') {
    ctx.rect(geom.x, geom.y, geom.width, geom.height);
  }
  ctx.clip?.();

  // Stroke with double line width: the outer half is discarded by the clip,
  // leaving an exact inner border of `strokeWidth` that adheres to box-sizing: border-box.
  ctx.strokeStyle = '#005FB8';
  ctx.lineWidth = strokeWidth * 2;
  ctx.strokeRect?.(geom.x, geom.y, geom.width, geom.height);
  ctx.restore?.();
}

export interface TimelineLatticeProps {
  variant?: 'standard' | 'evidence-only';
  className?: string;
  highlightBlockId?: number;
  highlightSubBlockText?: string;
}

export const TimelineLattice: React.FC<TimelineLatticeProps> = ({
  variant = 'standard',
  className = '',
  highlightBlockId,
  highlightSubBlockText,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    blocks,
    setBlocks,
    selectedBlockId,
    selectBlock,
    isRefining,
    setRefining,
    activeSubBlocks,
    setSubBlocks,
  } = useTimelineStore();

  const {
    lowerBound,
    upperBound,
    threshold,
    setFocusedBlock,
  } = useProofStore();

  const [selectedChildId, setSelectedChildId] = useState<string>('41.2');

  // Initial fetch of blocks if available
  useEffect(() => {
    fetchBlocks()
      .then((data) => {
        if (data && data.length > 0) {
          setBlocks(data);
        }
      })
      .catch((err) => console.error('Failed to load blocks', err));
  }, [setBlocks]);

  // Canonical child blocks (Figure 2 / MOCS paper spec)
  const childBlocks: ChildBlockState[] = useMemo(() => {
    if (activeSubBlocks && activeSubBlocks.length > 0) {
      return activeSubBlocks.map((sb, idx) => ({
        child_id: sb.child_id || `41.${idx}`,
        parent_id: sb.parent_id ?? 41,
        time_start_ns: 410 + idx * 2,
        time_end_ns: 410 + (idx + 1) * 2,
        lower_bound: sb.lower_bound,
        upper_bound: sb.upper_bound,
        truth_value: (sb.truth_value as 'TRUE' | 'FALSE' | 'UNKNOWN') || 'UNKNOWN',
        status: (sb.status as 'CERTIFIED_TRUE' | 'CERTIFIED_FALSE' | 'REFINED' | 'EXACT') || 'REFINED',
      }));
    }
    return [
      {
        child_id: '41.0',
        parent_id: 41,
        time_start_ns: 410,
        time_end_ns: 412,
        lower_bound: 4.10,
        upper_bound: 4.35,
        truth_value: 'FALSE',
        status: 'CERTIFIED_FALSE',
      },
      {
        child_id: '41.1',
        parent_id: 41,
        time_start_ns: 412,
        time_end_ns: 414,
        lower_bound: 3.85,
        upper_bound: 4.12,
        truth_value: 'UNKNOWN',
        status: 'REFINED',
      },
      {
        child_id: '41.2',
        parent_id: 41,
        time_start_ns: 414,
        time_end_ns: 416,
        lower_bound: 3.65,
        upper_bound: 3.98,
        truth_value: 'TRUE',
        status: 'CERTIFIED_TRUE',
      },
      {
        child_id: '41.3',
        parent_id: 41,
        time_start_ns: 416,
        time_end_ns: 418,
        lower_bound: 3.75,
        upper_bound: 4.05,
        truth_value: 'UNKNOWN',
        status: 'REFINED',
      },
      {
        child_id: '41.4',
        parent_id: 41,
        time_start_ns: 418,
        time_end_ns: 420,
        lower_bound: 4.05,
        upper_bound: 4.28,
        truth_value: 'FALSE',
        status: 'CERTIFIED_FALSE',
      },
    ];
  }, [activeSubBlocks]);

  // Derived selected parent block info
  const totalBlocks = blocks.length > 0 ? blocks.length : 240;
  const currentParentId = selectedBlockId ?? 41;
  const selectedParentBlock = blocks[currentParentId];
  const parentStartTimeNs = selectedParentBlock
    ? selectedParentBlock.time_start_ns
    : (currentParentId === 41 ? 410 : (currentParentId * 1000) / totalBlocks);
  const parentEndTimeNs = selectedParentBlock
    ? selectedParentBlock.time_end_ns
    : (currentParentId === 41 ? 420 : ((currentParentId + 1) * 1000) / totalBlocks);

  // Selected inspector state (defaults to parent Block 41, or inspects selected child)
  const activeChild = childBlocks.find((c) => c.child_id === selectedChildId);

  // Inspector display values
  const inspectTimeRange = activeChild
    ? `${activeChild.time_start_ns} – ${activeChild.time_end_ns} ns`
    : `${parentStartTimeNs.toFixed(0)} – ${parentEndTimeNs.toFixed(0)} ns`;

  const inspectLower = activeChild ? activeChild.lower_bound : lowerBound;
  const inspectUpper = activeChild ? activeChild.upper_bound : upperBound;
  const inspectTruth = activeChild ? activeChild.truth_value : (selectedParentBlock?.truth_value || 'UNKNOWN');

  // Mathematical inequality text
  const isStraddling = inspectLower < threshold && inspectUpper > threshold;
  const isCertifiedTrue = inspectUpper <= threshold;
  const isCertifiedFalse = inspectLower >= threshold;

  // Canvas Drawing for 240 Parent Blocks
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const parent = canvas.parentElement;
      const width = parent?.clientWidth || canvas.clientWidth || 720;
      const height = canvas.clientHeight || parent?.clientHeight || 40;
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      ctx.clearRect(0, 0, width, height);

      // 1. Draw all canonical block states (truth value / refinement fill)
      for (let i = 0; i < totalBlocks; i++) {
        const b = blocks[i];

        let color = '#D1D5DB'; // Certified False: neutral gray
        if (b) {
          if (b.status === 'CERTIFIED_TRUE' || b.truth_value === 'TRUE') {
            color = '#0969DA'; // Certified True: Deep Cobalt
          } else if (b.status === 'REFINED' || b.truth_value === 'UNKNOWN') {
            color = '#D97706'; // Unknown: restrained amber
          } else if (b.status === 'EXACT') {
            color = '#005FB8'; // Exact frame evaluation: blue
          }
        } else {
          // Fallback default distribution (matching canonical Figure 2 benchmark)
          if (i === 41) {
            color = '#D97706'; // Block 41 is Unknown / Refined
          } else if ([35, 36, 70, 140, 195].includes(i)) {
            color = '#0969DA'; // Certified True contact events
          }
        }

        const geom = computeBlockGeometry(i, totalBlocks, width, height);
        ctx.fillStyle = color;
        ctx.fillRect(geom.x, geom.y, geom.width, geom.height);
      }

      // 2. Draw selected block precision outline on the EXACT canonical block geometry
      // Guaranteed zero overflow into neighboring blocks and border-box containment
      if (currentParentId >= 0 && currentParentId < totalBlocks) {
        const selGeom = computeBlockGeometry(currentParentId, totalBlocks, width, height);
        // Thin selection outline: 2px Fluent blue (#005FB8), clamped on narrow viewports
        const strokeWidth = selGeom.width >= 6 ? 2 : Math.max(1, Math.min(1.5, selGeom.width / 3));
        drawSelectionOutline(ctx, selGeom, strokeWidth);
      }

      // 3. Optional dyadic sub-block temporal interval highlight
      if (highlightBlockId !== undefined && highlightBlockId >= 0 && highlightBlockId < totalBlocks) {
        const hlGeom = computeBlockGeometry(highlightBlockId, totalBlocks, width, height);
        ctx.save?.();
        ctx.fillStyle = 'rgba(0, 95, 184, 0.22)';
        ctx.fillRect(hlGeom.x, hlGeom.y, hlGeom.width, hlGeom.height);
        ctx.strokeStyle = '#005FB8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(hlGeom.x + 0.75, hlGeom.y + 0.75, Math.max(1, hlGeom.width - 1.5), Math.max(1, hlGeom.height - 1.5));
        ctx.restore?.();
      }
    };

    render();

    const parent = canvas.parentElement;
    if (parent && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        render();
      });
      ro.observe(parent);
      return () => ro.disconnect();
    }
  }, [blocks, totalBlocks, currentParentId, highlightBlockId]);

  const applyBlockSelection = (blockIdx: number) => {
    selectBlock(blockIdx);
    const b = blocks[blockIdx];
    if (b) {
      setFocusedBlock(
        b.block_id,
        [b.time_start_ns, b.time_end_ns],
        b.lower_bound,
        b.upper_bound,
        b.status
      );
    } else {
      // Canonical fallback for benchmark trajectory blocks
      const tStart = blockIdx === 40 ? 400 : blockIdx === 41 ? 410 : blockIdx === 42 ? 420 : blockIdx * 10;
      const tEnd = tStart + 10;
      const lower = blockIdx === 41 ? 3.72 : blockIdx === 40 ? 4.10 : blockIdx === 42 ? 4.05 : 4.50;
      const upper = blockIdx === 41 ? 4.21 : blockIdx === 40 ? 4.35 : blockIdx === 42 ? 4.28 : 5.00;
      const status = blockIdx === 41 ? 'UNKNOWN (Straddles Threshold)' : 'CERTIFIED FALSE';
      setFocusedBlock(blockIdx, [tStart, tEnd], lower, upper, status);
    }
  };

  // Click on Timeline Canvas
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const blockIdx = Math.floor((x / rect.width) * totalBlocks);

    if (blockIdx >= 0 && blockIdx < totalBlocks) {
      applyBlockSelection(blockIdx);
    }
  };

  // Keyboard navigation on Timeline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      applyBlockSelection(Math.max(0, currentParentId - 1));
    } else if (e.key === 'ArrowRight') {
      applyBlockSelection(Math.min(totalBlocks - 1, currentParentId + 1));
    }
  };

  // Trigger Refinement
  const handleRefine = async () => {
    try {
      setRefining(true);
      if (wsService.isConnected) {
        wsService.send({ action: 'refine_block', block_id: currentParentId });
      }
      const res = await refineBlock(currentParentId);
      if (res && res.child_blocks) {
        setSubBlocks(res.child_blocks);
      }
    } catch (err) {
      console.error('Refine failed', err);
    } finally {
      setRefining(false);
    }
  };

  if (variant === 'evidence-only') {
    return (
      <section
        data-testid="temporal-lattice-panel"
        aria-label="Temporal Lattice Evidence"
        className={`bg-[#FFFFFF] rounded-[6px] border border-[#E5E5E5] p-4 font-sans select-none shadow-xs w-full box-border ${className}`}
      >
        <div className="flex flex-col space-y-3 min-w-0">
          {/* Header Strip with Title, Metadata, and Subordinate Legend */}
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[#F0F0F0] pb-2.5">
            <div className="flex items-baseline gap-2.5 min-w-0">
              <h2 className="text-[14px] font-semibold text-[#1C1C1C] m-0 shrink-0">
                Temporal Lattice
              </h2>
              <span className="text-[11px] text-[#5C5C5C] truncate">
                {highlightSubBlockText
                  ? `Temporal Context · Sub-block ${highlightSubBlockText} (410–420 ns) · 240 blocks · 0–1 μs`
                  : '240 blocks · 0–1 μs · Δt 10 ps'}
              </span>
            </div>

            {/* Subordinate Legend */}
            <div
              data-testid="timeline-legend"
              className="flex items-center gap-3.5 text-[11px] text-[#5C5C5C] shrink-0"
            >
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[1px] bg-[#0969DA]" />
                <span>True</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[1px] bg-[#D1D5DB]" />
                <span>False</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[1px] bg-[#D97706]" />
                <span>Unknown</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[1px] border-2 border-[#005FB8] bg-transparent" />
                <span>Selected</span>
              </span>
            </div>
          </div>

          {/* Timeline Lattice Canvas */}
          <div
            tabIndex={0}
            role="slider"
            aria-label={`Trajectory timeline, Block ${currentParentId}, ${parentStartTimeNs.toFixed(0)}–${parentEndTimeNs.toFixed(0)} ns, ${inspectTruth}, selected`}
            aria-valuemin={0}
            aria-valuemax={totalBlocks - 1}
            aria-valuenow={currentParentId}
            onKeyDown={handleKeyDown}
            className="w-full h-11 rounded-[4px] border border-[#E5E5E5] overflow-hidden bg-[#FAFAFA] relative cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#005FB8] box-border"
          >
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="w-full h-full block"
            />
          </div>

          {/* Time Axis Ticks */}
          <div
            data-testid="time-axis"
            className="flex items-center justify-between text-[11px] text-[#8A8A8A] px-0.5 select-none w-full box-border"
          >
            <span>0 ns</span>
            <span>200 ns</span>
            <span>400 ns</span>
            <span>600 ns</span>
            <span>800 ns</span>
            <span>1 μs</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      data-testid="temporal-lattice-panel"
      aria-label="Temporal Lattice and Block Refinement"
      className="temporal-lattice-container bg-[#FFFFFF] rounded-[8px] border border-[#E5E5E5] p-4 sm:p-5 font-sans select-none shadow-[0_1px_3px_rgba(0,0,0,0.04)] w-full max-w-full box-border"
    >
      <div className="temporal-main-grid">
        {/* Left Column: Temporal Lattice, Legend, Timeline, Time Axis, and Subdivision */}
        <div className="flex flex-col space-y-4 min-w-0">
          {/* Header Strip with Title, Metadata, and Subordinate Legend */}
          <div className="temporal-header-row border-b border-[#F0F0F0] pb-2.5">
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2.5 min-w-0">
              <h2 className="text-[15px] font-semibold text-[#1C1C1C] m-0 shrink-0">
                Temporal Lattice
              </h2>
              <span className="text-[12px] text-[#5C5C5C] truncate">
                240 blocks · 0–1 μs · Δt 10 ps
              </span>
            </div>

            {/* Subordinate Legend (Small semantic swatches, zero colored dots) */}
            <div
              data-testid="timeline-legend"
              className="flex items-center gap-3.5 text-[11px] text-[#5C5C5C] shrink-0"
            >
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[1px] bg-[#0969DA]" />
                <span>True</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[1px] bg-[#D1D5DB]" />
                <span>False</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[1px] bg-[#D97706]" />
                <span>Unknown</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[1px] border-2 border-[#005FB8] bg-transparent" />
                <span>Selected</span>
              </span>
            </div>
          </div>

          {/* Timeline Lattice Canvas */}
          <div
            tabIndex={0}
            role="slider"
            aria-label={`Trajectory timeline, Block ${currentParentId}, ${parentStartTimeNs.toFixed(0)}–${parentEndTimeNs.toFixed(0)} ns, ${inspectTruth}, selected`}
            aria-valuemin={0}
            aria-valuemax={totalBlocks - 1}
            aria-valuenow={currentParentId}
            onKeyDown={handleKeyDown}
            className="w-full h-11 rounded-[4px] border border-[#E5E5E5] overflow-hidden bg-[#FAFAFA] relative cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#005FB8] box-border"
          >
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="w-full h-full block"
            />
          </div>

          {/* Time Axis Ticks */}
          <div
            data-testid="time-axis"
            className="flex items-center justify-between text-[11px] text-[#8A8A8A] px-0.5 select-none w-full box-border"
          >
            <span>0 ns</span>
            <span>200 ns</span>
            <span>400 ns</span>
            <span>600 ns</span>
            <span>800 ns</span>
            <span>1 μs</span>
          </div>

          {/* Block Subdivision Section */}
          <div className="pt-3 border-t border-[#F0F0F0] flex flex-col space-y-2.5 min-w-0">
            {/* Section Header: Clearly separates metadata from cards */}
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                <span className="font-semibold text-[13px] text-[#1C1C1C]">
                  Block {currentParentId} Subdivision
                </span>
                <span className="text-[11px] text-[#5C5C5C]">
                  410–420 ns
                </span>
                <span className="text-[#A1A1AA] hidden sm:inline">·</span>
                <span className="text-[11px] text-[#5C5C5C]">
                  5 sub-blocks (Δt = 2 ns)
                </span>
              </div>
              <span className="text-[10px] text-[#8A8A8A] uppercase tracking-wider shrink-0">
                Dyadic Refinement Lattice
              </span>
            </div>

            {/* Sub-block Secondary Temporal Lattice Grid (Neutral, analytical scientific cards) */}
            <div
              data-testid="subdivision-lattice"
              className="temporal-subdivision-grid"
            >
              {childBlocks.map((child) => {
                const isSelected = selectedChildId === child.child_id;
                const stateIndicator =
                  child.status === 'CERTIFIED_TRUE'
                    ? 'bg-[#0969DA]'
                    : child.status === 'CERTIFIED_FALSE'
                    ? 'bg-[#9CA3AF]'
                    : 'bg-[#D97706]';

                return (
                  <button
                    key={child.child_id}
                    data-testid={`sub-block-${child.child_id}`}
                    aria-label={`Sub-block ${child.child_id}, ${child.time_start_ns} to ${child.time_end_ns} ns, ${child.truth_value.toLowerCase()}`}
                    aria-pressed={isSelected}
                    onClick={() => {
                      setSelectedChildId(child.child_id);
                      setFocusedBlock(
                        currentParentId,
                        [child.time_start_ns, child.time_end_ns],
                        child.lower_bound,
                        child.upper_bound,
                        child.status
                      );
                    }}
                    className={`h-[68px] p-2 sm:p-2.5 flex flex-col justify-between rounded-[4px] border transition-colors text-left min-w-0 box-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#005FB8] ${
                      isSelected
                        ? 'border-[#005FB8] ring-1 ring-inset ring-[#005FB8] bg-[#F8FAFC]'
                        : 'border-[#E5E5E5] bg-[#FFFFFF] hover:bg-[#FAFAFA]'
                    }`}
                  >
                    <div className="flex items-center justify-between min-w-0">
                      <span className="text-[12px] font-semibold text-[#1C1C1C]">
                        {child.child_id}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-[1px] ${stateIndicator} shrink-0`}
                        title={`State: ${child.truth_value}`}
                      />
                    </div>
                    <div className="text-[11px] text-[#5C5C5C] truncate">
                      {child.time_start_ns}–{child.time_end_ns} ns
                    </div>
                    <div className="text-[11px] font-semibold text-[#0F172A] truncate">
                      {child.lower_bound.toFixed(2)} Å
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Selected Block Details, Bounds, Explanation & Action */}
        <div
          data-testid="selected-block-inspector"
          className="flex flex-col space-y-3.5 min-w-0"
        >
          {/* Header: Block Number & Semantic State */}
          <div className="flex items-center justify-between pb-2.5 border-b border-[#E5E5E5] min-w-0">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="font-semibold text-[15px] text-[#1C1C1C] truncate">
                {activeChild ? `Sub-block ${activeChild.child_id}` : `Block ${currentParentId}`}
              </span>
              <span className="text-[11px] text-[#5C5C5C] shrink-0">
                {activeChild ? `parent ${currentParentId}` : 'parent'}
              </span>
            </div>

            {/* Semantic State Text (Restrained, NOT an error badge, per Rule 21) */}
            <span
              data-testid="inspector-status"
              className={`text-[12px] font-semibold shrink-0 ${
                inspectTruth === 'TRUE'
                  ? 'text-[#0969DA]'
                  : inspectTruth === 'FALSE'
                  ? 'text-[#5C5C5C]'
                  : 'text-[#D97706]'
              }`}
            >
              {inspectTruth}
            </span>
          </div>

          {/* Property Grid: Two-column definition grid */}
          <div
            data-testid="inspector-property-grid"
            className="space-y-2 text-[12px]"
          >
            <div className="temporal-detail-row">
              <span className="text-[#5C5C5C] font-sans">Time range</span>
              <span className="text-[#1C1C1C] font-semibold text-right">{inspectTimeRange}</span>
            </div>
            <div className="temporal-detail-row">
              <span className="text-[#5C5C5C] font-sans">Lower bound (L)</span>
              <span className="text-[#1C1C1C] font-semibold text-right">{inspectLower.toFixed(2)} Å</span>
            </div>
            <div className="temporal-detail-row">
              <span className="text-[#5C5C5C] font-sans">Upper bound (U)</span>
              <span className="text-[#1C1C1C] font-semibold text-right">{inspectUpper.toFixed(2)} Å</span>
            </div>
            <div className="temporal-detail-row">
              <span className="text-[#5C5C5C] font-sans">Threshold</span>
              <span className="text-[#1C1C1C] font-semibold text-right">{threshold.toFixed(2)} Å</span>
            </div>
          </div>

          {/* Bound Analysis Box: Compact Scientific Verification Block */}
          <div
            data-testid="bound-analysis-box"
            className="p-3 rounded-[4px] bg-[#FAFAFA] border border-[#E5E5E5] space-y-1.5"
          >
            <div className="flex items-center justify-between text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider font-sans">
              <span>Bound Relationship</span>
              <span className="text-[10px] lowercase text-[#5C5C5C]">
                {isStraddling ? 'straddles threshold' : isCertifiedTrue ? 'certified true' : 'certified false'}
              </span>
            </div>

            <div className="text-[13px] font-bold text-[#0F172A] py-0.5">
              {inspectLower.toFixed(2)} Å {isCertifiedTrue ? '≤' : '<'} {threshold.toFixed(2)} Å {isCertifiedFalse ? '≤' : '<'} {inspectUpper.toFixed(2)} Å
            </div>

            <p className="text-[11px] text-[#5C5C5C] leading-relaxed font-sans m-0">
              {isStraddling
                ? 'Bound interval straddles threshold (L < T < U). Conservative bounds cannot certify TRUE or FALSE; refinement required.'
                : isCertifiedTrue
                ? 'Upper bound is strictly within threshold (U ≤ T). Contact event certified TRUE across this interval.'
                : 'Lower bound strictly exceeds threshold (L ≥ T). Contact event certified FALSE across this interval.'}
            </p>
          </div>

          {/* Primary Action Button: Standard 36px WinUI Button */}
          <div className="pt-0.5">
            <button
              data-testid="refine-block-btn"
              aria-label={!isStraddling ? 'Block is already fully resolved' : 'Refine Selected Temporal Block'}
              title={!isStraddling ? 'Block is already fully resolved to a definitive epistemic truth value.' : undefined}
              onClick={handleRefine}
              disabled={isRefining || !isStraddling}
              className={`w-full h-9 rounded-[4px] font-medium text-[12px] transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#005FB8] ${
                !isStraddling
                  ? 'bg-[#F3F3F3] text-[#8A8A8A] border border-[#E5E5E5] cursor-not-allowed'
                  : 'bg-[#005FB8] hover:bg-[#0067C0] active:bg-[#0052A0] text-white disabled:opacity-50'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefining ? 'animate-spin' : ''}`} />
              <span>
                {isRefining
                  ? 'Refining…'
                  : !isStraddling
                  ? 'Fully Resolved'
                  : 'Refine Block'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};



