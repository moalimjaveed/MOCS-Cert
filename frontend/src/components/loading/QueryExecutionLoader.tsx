import React from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useEvidenceStore, ExecutionStage } from '../../store/useEvidenceStore';

export interface QueryExecutionLoaderProps {
  currentStage?: ExecutionStage;
  isExecuting?: boolean;
  queryText?: string;
}

/**
 * QueryExecutionLoader
 * Truthful query execution status indicator.
 * Reflects genuine observable lifecycle: compiling -> executing -> completed / failed.
 * Zero fabricated progress stages or synthetic "Stage N of 5" counters.
 */
export const QueryExecutionLoader: React.FC<QueryExecutionLoaderProps> = ({
  currentStage,
  isExecuting,
  queryText,
}) => {
  const store = useEvidenceStore();
  const activeExecuting = isExecuting ?? store.isExecuting;
  const activeStage: ExecutionStage = currentStage ?? store.executionStage;
  const displayQuery = queryText ?? store.queryText;

  if (!activeExecuting && activeStage !== 'compiling' && activeStage !== 'executing') {
    return null;
  }

  const stageDescriptions: Record<ExecutionStage, { title: string; detail: string }> = {
    idle: {
      title: 'Workstation Idle',
      detail: 'Ready to receive and execute MolQL queries',
    },
    compiling: {
      title: 'Compiling Query',
      detail: 'Parsing MolQL AST and deriving cost-optimal execution plan',
    },
    executing: {
      title: 'Executing Query',
      detail: 'Evaluating periodic boundary bounds and spatial interval pruning',
    },
    refining: {
      title: 'Refining Coordinates',
      detail: 'Contracting coordinate intervals to exact target frames',
    },
    completed: {
      title: 'Execution Completed',
      detail: 'Cryptographic certificate generated and verified',
    },
    failed: {
      title: 'Execution Failed',
      detail: store.structuredError?.message ?? 'Execution encountered an error',
    },
  };

  const currentInfo = stageDescriptions[activeStage] || stageDescriptions.executing;

  return (
    <div
      data-testid="query-execution-loader"
      className="p-3 bg-white border border-[#E5E5E5] rounded-md space-y-2 text-xs select-none shadow-sm"
      role="status"
      aria-live="polite"
      aria-label={`${currentInfo.title}: ${currentInfo.detail}`}
    >
      <div className="flex items-center justify-between pb-1.5 border-b border-[#F0F0F0]">
        <span className="font-semibold text-[#1C1C1C] flex items-center gap-2">
          {activeStage === 'failed' ? (
            <AlertCircle className="w-4 h-4 text-[#D13438]" />
          ) : activeStage === 'completed' ? (
            <CheckCircle2 className="w-4 h-4 text-[#107C10]" />
          ) : (
            <Loader2 className="w-4 h-4 animate-spin text-[#005FB8]" />
          )}
          {currentInfo.title}
        </span>
        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#F3F2F1] text-[#5C5C5C] font-medium tracking-wide">
          {activeStage}
        </span>
      </div>

      <div className="space-y-0.5">
        <p className="text-[11px] text-[#5C5C5C] font-mono truncate">
          {displayQuery}
        </p>
        <p className="text-[11px] text-[#707070]">
          {currentInfo.detail}
        </p>
      </div>
    </div>
  );
};
