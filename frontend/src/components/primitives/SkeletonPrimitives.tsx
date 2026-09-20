import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';

export interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  style?: React.CSSProperties;
}

/**
 * Shared low-contrast scientific shimmer class.
 * Calm, precise, low visual noise.
 */
export const SHIMMER_CLASS =
  'mocs-skeleton animate-pulse rounded bg-[#EAEAEA] text-transparent select-none';

/**
 * Hook to avoid skeleton flash on fast loads (< 200ms).
 */
export function useSkeletonDelay(delayMs: number = 200): boolean {
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowSkeleton(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  return showSkeleton;
}

/**
 * 1. SkeletonText — Single line text shimmer placeholder
 */
export const SkeletonText: React.FC<SkeletonProps> = ({ className = '', width, height, style }) => (
  <span
    className={clsx('inline-block h-3.5 rounded', SHIMMER_CLASS, className)}
    style={{ width, height, ...style }}
    aria-hidden="true"
  >
    &nbsp;
  </span>
);

/**
 * 2. SkeletonTitle — Component / section header placeholder
 */
export const SkeletonTitle: React.FC<SkeletonProps> = ({ className = '', width = '160px', height = '18px', style }) => (
  <h3
    className={clsx('h-[18px] rounded font-semibold tracking-tight', SHIMMER_CLASS, className)}
    style={{ width, height, ...style }}
    aria-hidden="true"
  >
    &nbsp;
  </h3>
);

/**
 * 3. SkeletonMetric — Metric cell shimmer placeholder matching .mocs-metric-cell geometry
 */
export const SkeletonMetric: React.FC<{ label?: string; className?: string }> = ({
  label,
  className = '',
}) => (
  <div
    className={clsx(
      'bg-[#FFFFFF] rounded-[4px] border border-[#E5E5E5] p-2.5 sm:p-3 space-y-2',
      className
    )}
    aria-hidden="true"
  >
    <div className="flex items-center justify-between">
      {label ? (
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#707070] select-none">
          {label}
        </span>
      ) : (
        <div className={clsx('h-2.5 w-20 rounded', SHIMMER_CLASS)} />
      )}
      <div className={clsx('w-3.5 h-3.5 rounded', SHIMMER_CLASS)} />
    </div>
    <div className={clsx('h-5 w-32 rounded', SHIMMER_CLASS)} />
    <div className={clsx('h-2.5 w-44 rounded', SHIMMER_CLASS)} />
  </div>
);

/**
 * 4. SkeletonRow — Individual table row placeholder with exact column alignment
 */
export const SkeletonRow: React.FC<{ cols?: number; className?: string }> = ({
  cols = 5,
  className = '',
}) => (
  <div className={clsx('h-[36px] flex items-center px-3 gap-4', className)} aria-hidden="true">
    {Array.from({ length: cols }, (_, c) => (
      <div key={c} className={clsx('h-3 rounded flex-1 max-w-[110px]', SHIMMER_CLASS)} />
    ))}
  </div>
);

/**
 * 5. SkeletonTable — Tabular shimmer placeholder matching MocsTable geometry
 */
export const SkeletonTable: React.FC<{ rows?: number; cols?: number; className?: string }> = ({
  rows = 5,
  cols = 6,
  className = '',
}) => (
  <div
    className={clsx(
      'w-full border border-[#E5E5E5] rounded-[4px] bg-[#FFFFFF] overflow-hidden',
      className
    )}
    aria-hidden="true"
  >
    <div className="bg-[#FAFAFA] border-b border-[#E5E5E5] h-8 flex items-center px-3 gap-4">
      {Array.from({ length: cols }, (_, i) => (
        <div key={i} className={clsx('h-2.5 rounded flex-1 max-w-[120px]', SHIMMER_CLASS)} />
      ))}
    </div>
    <div className="divide-y divide-[#F0F0F0]">
      {Array.from({ length: rows }, (_, r) => (
        <SkeletonRow key={r} cols={cols} />
      ))}
    </div>
  </div>
);

/**
 * 6. SkeletonPanel — Generic workstation panel placeholder
 */
export const SkeletonPanel: React.FC<{
  title?: string;
  height?: string | number;
  className?: string;
}> = ({ title, height = '180px', className = '' }) => (
  <div
    className={clsx(
      'bg-[#FFFFFF] border border-[#E5E5E5] rounded-[6px] p-3.5 space-y-3 flex flex-col',
      className
    )}
    aria-hidden="true"
    style={{ height }}
  >
    <div className="flex items-center justify-between border-b border-[#F0F0F0] pb-2 shrink-0">
      {title ? (
        <span className="text-xs font-semibold uppercase tracking-wider text-[#5C5C5C] select-none">
          {title}
        </span>
      ) : (
        <div className={clsx('h-3.5 w-32 rounded', SHIMMER_CLASS)} />
      )}
      <div className={clsx('h-3 w-12 rounded', SHIMMER_CLASS)} />
    </div>
    <div className="space-y-2 flex-1">
      <div className={clsx('h-3 w-full rounded', SHIMMER_CLASS)} />
      <div className={clsx('h-3 w-5/6 rounded', SHIMMER_CLASS)} />
      <div className={clsx('h-3 w-2/3 rounded', SHIMMER_CLASS)} />
    </div>
  </div>
);

/**
 * 7. SkeletonInspector — Right contextual drawer placeholder
 */
export const SkeletonInspector: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={clsx(
      'w-[290px] sm:w-[310px] xl:w-[285px] 2xl:w-[305px] p-3.5 space-y-4 shrink-0 bg-[#FFFFFF] border-l border-[#E5E5E5]',
      className
    )}
    aria-hidden="true"
  >
    <div className={clsx('h-8 w-full rounded-[4px]', SHIMMER_CLASS)} />
    <div className={clsx('h-20 w-full rounded-[4px]', SHIMMER_CLASS)} />
    <div className="space-y-2">
      <div className={clsx('h-3 w-24 rounded', SHIMMER_CLASS)} />
      <div className={clsx('h-4 w-full rounded', SHIMMER_CLASS)} />
      <div className={clsx('h-4 w-3/4 rounded', SHIMMER_CLASS)} />
    </div>
  </div>
);

/**
 * 8. SkeletonViewer — 3D Molecular Viewport canvas placeholder
 */
export const SkeletonViewer: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={clsx(
      'w-full h-full min-h-[420px] bg-[#F9F9F9] rounded-[4px] border border-[#E5E5E5] flex flex-col items-center justify-center p-6 space-y-4',
      className
    )}
    aria-hidden="true"
  >
    <div className={clsx('w-16 h-16 rounded-full', SHIMMER_CLASS)} />
    <div className={clsx('h-4 w-52 rounded', SHIMMER_CLASS)} />
    <div className={clsx('h-3 w-36 rounded', SHIMMER_CLASS)} />
  </div>
);

/**
 * 9. SkeletonTree — Refinement dyadic tree shimmer placeholder
 */
export const SkeletonTree: React.FC<{ nodes?: number; className?: string }> = ({
  nodes = 5,
  className = '',
}) => (
  <div
    className={clsx('bg-[#FFFFFF] border border-[#E5E5E5] rounded-[6px] p-3.5 space-y-3', className)}
    aria-hidden="true"
  >
    <div className="flex items-center justify-between border-b border-[#F0F0F0] pb-2">
      <div className={clsx('h-3.5 w-48 rounded', SHIMMER_CLASS)} />
      <div className={clsx('h-6 w-24 rounded', SHIMMER_CLASS)} />
    </div>
    <div className={clsx('h-12 w-full rounded', SHIMMER_CLASS)} />
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2 pt-2">
      {Array.from({ length: nodes }, (_, i) => (
        <div key={i} className={clsx('h-[119px] rounded-[4px]', SHIMMER_CLASS)} />
      ))}
    </div>
  </div>
);

/**
 * 10. SkeletonQueryEditor — Monaco Query Editor placeholder matching editor geometry
 */
export const SkeletonQueryEditor: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={clsx(
      'bg-[#FFFFFF] border border-[#E5E5E5] rounded-[6px] p-3 space-y-2.5 font-mono',
      className
    )}
    aria-hidden="true"
  >
    <div className="flex items-center justify-between border-b border-[#F0F0F0] pb-2">
      <div className={clsx('h-3.5 w-28 rounded', SHIMMER_CLASS)} />
      <div className={clsx('h-6 w-20 rounded-[4px]', SHIMMER_CLASS)} />
    </div>
    <div className="space-y-1.5 py-1">
      <div className={clsx('h-3.5 w-3/5 rounded', SHIMMER_CLASS)} />
      <div className={clsx('h-3.5 w-4/5 rounded', SHIMMER_CLASS)} />
      <div className={clsx('h-3.5 w-2/5 rounded', SHIMMER_CLASS)} />
      <div className={clsx('h-3.5 w-1/2 rounded', SHIMMER_CLASS)} />
    </div>
  </div>
);
