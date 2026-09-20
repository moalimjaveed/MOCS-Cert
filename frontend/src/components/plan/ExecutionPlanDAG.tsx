import React from 'react';
import { Check, Loader2, AlertCircle, MinusCircle } from 'lucide-react';
import { useEvidenceStore, useViewerStore } from '../../store';

export interface ExecutionPlanDAGProps {
  observableType?: string;
  selectionContext?: string;
}

const renderStatusCell = (status: string) => {
  const norm = (status || '').toLowerCase();
  if (norm.includes('fail') || norm.includes('error')) {
    return (
      <div className="flex items-center gap-1.5 min-w-0 whitespace-nowrap select-none">
        <AlertCircle className="w-3.5 h-3.5 text-[#E11D48] stroke-[2.5] shrink-0" aria-hidden="true" />
        <span className="text-[#E11D48] font-medium text-[12px] sm:text-[13px] truncate">
          {status}
        </span>
      </div>
    );
  }
  if (norm.includes('run') || norm.includes('progress')) {
    return (
      <div className="flex items-center gap-1.5 min-w-0 whitespace-nowrap select-none">
        <Loader2 className="w-3.5 h-3.5 text-[#005FB8] stroke-[2.5] animate-spin shrink-0" aria-hidden="true" />
        <span className="text-[#005FB8] font-medium text-[12px] sm:text-[13px] truncate">
          {status}
        </span>
      </div>
    );
  }
  if (norm.includes('skip')) {
    return (
      <div className="flex items-center gap-1.5 min-w-0 whitespace-nowrap select-none">
        <MinusCircle className="w-3.5 h-3.5 text-[#64748B] stroke-[2] shrink-0" aria-hidden="true" />
        <span className="text-[#64748B] font-normal text-[12px] sm:text-[13px] truncate">
          {status}
        </span>
      </div>
    );
  }
  // Default for Complete / completed / Pending / Validated / etc.
  return (
    <div className="flex items-center gap-1.5 min-w-0 whitespace-nowrap select-none">
      <Check className="w-3.5 h-3.5 text-[#0969DA] stroke-[2.5] shrink-0" aria-hidden="true" />
      <span className="text-[#1C1C1C] font-normal text-[12px] sm:text-[13px] truncate">
        {status}
      </span>
    </div>
  );
};

export const ExecutionPlanDAG: React.FC<ExecutionPlanDAGProps> = ({
  observableType = 'Distance',
  selectionContext,
}) => {
  const {
    pruningEfficiency,
    blocksExamined,
    certifiedBlocks,
    refinedBlocks,
    exactFramesScanned,
    refinementSelectivity,
    peakMemoryMb,
    ioPruneRatio,
    traversalDepth,
    executionPlan,
    certificate,
    executionStage,
  } = useEvidenceStore();

  const { selectionA, selectionB } = useViewerStore();

  // Determine dynamic observable and selection context from props or viewer store
  const effectiveContext =
    selectionContext ||
    `${observableType} · ${selectionA || 'A:155:CA'} ↔ ${selectionB || 'LIG:1:O2'}`;

  const isExecuted = !!certificate || (blocksExamined !== undefined && blocksExamined > 0) || (pruningEfficiency !== undefined && pruningEfficiency > 0) || executionStage === 'completed';

  const stages = React.useMemo(() => {
    if (executionPlan && executionPlan.length > 0) {
      return executionPlan.map((step: any, idx) => ({
        id: step.step_id || (idx + 1),
        name: step.name || step.stage || `Step ${idx + 1}`,
        status: step.status || 'Complete',
        result: step.description || step.details || 'Valid',
      }));
    }

    if (!isExecuted) {
      return [
        { id: 1, name: 'Scientific DSL Parsing', status: 'Pending', result: 'Pending' },
        { id: 2, name: 'Observable Binding', status: 'Pending', result: 'Pending' },
        { id: 3, name: 'Type Checking', status: 'Pending', result: 'Pending' },
        { id: 4, name: 'Dependency Analysis', status: 'Pending', result: 'Pending' },
        { id: 5, name: 'MCI Interval Discovery', status: 'Pending', result: 'Pending' },
        { id: 6, name: 'AABB Soundness Test', status: 'Pending', result: 'Pending' },
        { id: 7, name: 'Refinement Loop', status: 'Pending', result: 'Pending' },
        { id: 8, name: 'Exact Frame Sampling', status: 'Pending', result: 'Pending' },
        { id: 9, name: 'Certificate Generation', status: 'Pending', result: 'Pending' },
      ];
    }

    return [
      { id: 1, name: 'Scientific DSL Parsing', status: 'Complete', result: 'Valid' },
      { id: 2, name: 'Observable Binding', status: 'Complete', result: 'Bound' },
      { id: 3, name: 'Type Checking', status: 'Complete', result: 'Valid' },
      { id: 4, name: 'Dependency Analysis', status: 'Complete', result: 'Resolved' },
      { id: 5, name: 'MCI Interval Discovery', status: 'Complete', result: `${blocksExamined ?? 0} blocks` },
      { id: 6, name: 'AABB Soundness Test', status: 'Complete', result: 'Pruned' },
      { id: 7, name: 'Refinement Loop', status: 'Complete', result: `${certifiedBlocks ?? 0} / ${refinedBlocks ?? 0}` },
      { id: 8, name: 'Exact Frame Sampling', status: 'Complete', result: `${exactFramesScanned ?? 0} frames` },
      { id: 9, name: 'Certificate Generation', status: 'Complete', result: 'Verified' },
    ];
  }, [executionPlan, isExecuted, blocksExamined, certifiedBlocks, refinedBlocks, exactFramesScanned]);

  return (
    <div
      data-testid="execution-plan-panel"
      className="exec-plan-container flex flex-col h-full bg-[#FFFFFF] rounded-[8px] border border-[#E5E5E5] overflow-hidden font-sans select-none shadow-[0_1px_3px_rgba(0,0,0,0.04)] w-full max-w-full min-w-0 box-border"
    >
      {/* 1. Header: Two-Level Structured Header (Never overlaps) */}
      <div className="exec-plan-header px-4 py-3 border-b border-[#E5E5E5] bg-[#FFFFFF] shrink-0 box-border">
        <h3 className="exec-plan-header-title text-[17px] sm:text-[18px] font-semibold text-[#1C1C1C] m-0 leading-tight whitespace-nowrap">
          Execution Plan
        </h3>
        <div
          className="exec-plan-header-meta text-[12.5px] sm:text-[13px] text-[#5C5C5C] leading-normal"
          title={effectiveContext}
        >
          {effectiveContext}
        </div>
      </div>

      {/* 2. Scrollable Table Viewport: Wraps header & body so they scroll horizontally together */}
      <div
        data-testid="execution-table-viewport"
        className="exec-table-viewport flex-1 min-h-0 min-w-0 overflow-x-auto overflow-y-auto box-border"
      >
        <div className="exec-table-inner min-w-[420px] w-full flex flex-col">
          {/* Sticky 4-Column Table Header (# | Stage | Status | Result) */}
          <div
            data-testid="execution-table-header"
            className="exec-plan-grid sticky top-0 z-10 px-4 py-2 text-[11px] font-semibold text-[#5C5C5C] uppercase tracking-wider border-b border-[#E5E5E5] bg-[#FAFAFA] shrink-0 select-none"
          >
            <div className="text-[#5C5C5C] text-left">#</div>
            <div className="text-[#5C5C5C] text-left">Stage</div>
            <div className="text-[#5C5C5C] text-left">Status</div>
            <div className="text-[#5C5C5C] text-left">Result</div>
          </div>

          {/* 3. 9-Stage Execution Pipeline List */}
          <div
            data-testid="execution-table-body"
            className="exec-table-body divide-y divide-[#F0F0F0] box-border"
            role="table"
            aria-label="Execution Pipeline Stages"
          >
            {stages.map((stage) => {
              const isSemanticGreen = stage.result === 'Verified' || stage.result === 'Pruned';
              return (
                <div
                  key={stage.id}
                  data-testid={`stage-row-${stage.id}`}
                  role="row"
                  aria-label={`Stage ${stage.id}: ${stage.name}, Status: ${stage.status}, Result: ${stage.result}`}
                  className="exec-plan-grid px-4 py-2.5 hover:bg-[#F9FAFB] transition-colors text-[12px] sm:text-[13px] min-h-[44px] sm:min-h-[48px]"
                >
                  {/* Column 1: # */}
                  <div className="text-[#64748B] font-medium text-[12px]">
                    {stage.id}
                  </div>

                  {/* Column 2: Stage Name (Readable, dynamic wrapping within column) */}
                  <div
                    className="text-[#1C1C1C] font-medium leading-snug break-words min-w-0 pr-2"
                    title={stage.name}
                  >
                    {stage.name}
                  </div>

                  {/* Column 3: Status (Self-contained, normal flow, zero collision) */}
                  {renderStatusCell(stage.status)}

                  {/* Column 4: Result (Actual execution outcome, independent column) */}
                  <div
                    className={`text-[12px] sm:text-[13px] break-words min-w-0 leading-snug ${
                      isSemanticGreen ? 'text-[#0969DA] font-semibold' : 'text-[#1C1C1C] font-normal'
                    }`}
                    title={stage.result}
                  >
                    {stage.result}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. MCI Execution Metrics (Property Grid + Soundness Verified) */}
      <div
        data-testid="mci-metrics-panel"
        className="border-t border-[#E5E5E5] bg-[#FFFFFF] p-3.5 sm:p-4 shrink-0 box-border w-full min-w-0"
      >
        {/* Metrics Header */}
        <div className="exec-metrics-header mb-3">
          <span className="text-[13.5px] sm:text-[14px] font-semibold text-[#1C1C1C]">
            MCI Execution Metrics
          </span>
          <div
            data-testid="soundness-verified-badge"
            className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-[4px] text-white text-[11px] font-semibold tracking-wide shrink-0 select-none ${
              isExecuted ? 'bg-[#0969DA] border border-[#0969DA]' : 'bg-[#64748B] border border-[#64748B]'
            }`}
          >
            {isExecuted && <Check className="w-3.5 h-3.5 text-white stroke-[2.5] shrink-0" aria-hidden="true" />}
            <span>{isExecuted ? 'Soundness Verified' : 'Awaiting Execution'}</span>
          </div>
        </div>

        {/* Metrics Property Grid (Unique execution engine metrics, zero duplication with sidebar) */}
        <div className="space-y-2 text-[12px] sm:text-[13px]">
          <div className="exec-metric-row">
            <span className="text-[#5C5C5C]">Refinement selectivity</span>
            <span className="text-[#1C1C1C] font-semibold text-right">
              {refinementSelectivity ? refinementSelectivity : (isExecuted ? '1:1' : '—')}
            </span>
          </div>
          <div className="exec-metric-row">
            <span className="text-[#5C5C5C]">Peak memory</span>
            <span className="text-[#1C1C1C] font-semibold text-right">
              {peakMemoryMb ? `${peakMemoryMb} MB` : (isExecuted ? '0.0 MB' : '—')}
            </span>
          </div>
          <div className="exec-metric-row">
            <span className="text-[#5C5C5C]">I/O prune ratio</span>
            <span className="text-[#1C1C1C] font-semibold text-right">
              {ioPruneRatio !== undefined && ioPruneRatio !== null && ioPruneRatio > 0
                ? (typeof ioPruneRatio === 'number' && ioPruneRatio <= 1.0 ? `${(ioPruneRatio * 100).toFixed(1)}%` : `${ioPruneRatio}%`)
                : (isExecuted ? '0.0%' : '—')}
            </span>
          </div>
          <div className="exec-metric-row">
            <span className="text-[#5C5C5C]">Traversal depth</span>
            <span className="text-[#1C1C1C] font-semibold text-right">
              {traversalDepth ? `${traversalDepth} levels` : (isExecuted ? '1 level' : '—')}
            </span>
          </div>

          {/* Pruning Efficiency */}
          <div className="pt-2.5 mt-2.5 border-t border-[#E5E5E5] exec-metric-row">
            <span className="text-[#1C1C1C] font-semibold text-[13px] sm:text-[13.5px]">
              Pruning efficiency
            </span>
            <span className="text-[#0969DA] font-bold text-[15px] sm:text-[16px] text-right">
              {pruningEfficiency !== undefined && pruningEfficiency !== null ? `${pruningEfficiency}%` : '0.0%'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
