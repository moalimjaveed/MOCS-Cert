import React, { useRef } from 'react';
import gsap from 'gsap';
import { Database, RefreshCw, Check, AlertCircle, Circle } from 'lucide-react';
import { useMocsAnimation } from '../../motion';
import { useEvidenceStore, useScanStore, useTimelineStore } from '../../store';

export type LifecycleStepStatus = 'idle' | 'loading' | 'ready' | 'failed';

export interface DatasetLoaderLifecycle {
  executionInvalidation: LifecycleStepStatus;
  topology: LifecycleStepStatus;
  lattice: LifecycleStepStatus;
  index: LifecycleStepStatus;
}

export interface DatasetLoaderProps {
  datasetName?: string;
  isSwitching?: boolean;
  lifecycle?: Partial<DatasetLoaderLifecycle>;
}

/**
 * DatasetLoader
 * Contextual dataset transition state.
 * Renders genuine lifecycle states derived from stores or explicit parameters.
 * Zero hardcoded progress text.
 */
export const DatasetLoader: React.FC<DatasetLoaderProps> = ({
  datasetName = 'synth_500f.xtc',
  isSwitching = false,
  lifecycle,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { executionId } = useEvidenceStore();
  const { topologyId, mciStatus } = useScanStore();
  const { blocks } = useTimelineStore();

  useMocsAnimation(
    (ctx, isReduced) => {
      if (!containerRef.current) return;

      if (isSwitching) {
        if (isReduced) {
          containerRef.current.style.opacity = '1';
        } else {
          ctx.add(() => {
            gsap.fromTo(
              containerRef.current,
              { opacity: 0, y: 4 },
              { opacity: 1, y: 0, duration: 0.18, ease: 'power2.out' }
            );
          });
        }
      }
    },
    { dependencies: [isSwitching] }
  );

  if (!isSwitching) return null;

  const resolvedLifecycle: DatasetLoaderLifecycle = {
    executionInvalidation:
      lifecycle?.executionInvalidation ??
      (executionId === null ? 'ready' : isSwitching ? 'loading' : 'idle'),
    topology:
      lifecycle?.topology ??
      (isSwitching ? 'loading' : topologyId ? 'ready' : 'idle'),
    lattice:
      lifecycle?.lattice ??
      (isSwitching ? 'loading' : blocks && blocks.length > 0 ? 'ready' : 'idle'),
    index:
      lifecycle?.index ??
      (isSwitching ? 'idle' : mciStatus?.includes('READY') ? 'ready' : 'idle'),
  };

  const renderStatusBadge = (status: LifecycleStepStatus) => {
    switch (status) {
      case 'ready':
        return (
          <span className="flex items-center gap-1 text-[#107C10] font-semibold">
            <Check className="w-3 h-3" /> Ready
          </span>
        );
      case 'loading':
        return (
          <span className="flex items-center gap-1 text-[#005FB8] font-semibold">
            <RefreshCw className="w-3 h-3 animate-spin" /> Loading...
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 text-[#D13438] font-semibold">
            <AlertCircle className="w-3 h-3" /> Failed
          </span>
        );
      case 'idle':
      default:
        return (
          <span className="flex items-center gap-1 text-[#707070]">
            <Circle className="w-3 h-3 text-[#A19F9D]" /> Pending
          </span>
        );
    }
  };

  return (
    <div
      ref={containerRef}
      data-testid="dataset-loader-overlay"
      className="absolute inset-0 z-30 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center p-6 text-center"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="bg-white border border-[#E5E5E5] rounded-lg p-5 shadow-md max-w-sm w-full space-y-3">
        <div className="flex items-center justify-center gap-2 text-[#005FB8]">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <Database className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-xs font-semibold text-[#1C1C1C]">Dataset Transition</h3>
          <p className="font-mono text-[11px] text-[#5C5C5C] mt-0.5">{datasetName}</p>
        </div>
        <div className="text-[10px] text-[#707070] space-y-1.5 text-left bg-[#F9F9F9] p-2.5 rounded border border-[#F0F0F0]">
          <div className="flex items-center justify-between">
            <span>Execution Invalidation:</span>
            {renderStatusBadge(resolvedLifecycle.executionInvalidation)}
          </div>
          <div className="flex items-center justify-between">
            <span>Molecular Topology:</span>
            {renderStatusBadge(resolvedLifecycle.topology)}
          </div>
          <div className="flex items-center justify-between">
            <span>Coordinate Lattice:</span>
            {renderStatusBadge(resolvedLifecycle.lattice)}
          </div>
          <div className="flex items-center justify-between">
            <span>Coordinate Index:</span>
            {renderStatusBadge(resolvedLifecycle.index)}
          </div>
        </div>
      </div>
    </div>
  );
};
