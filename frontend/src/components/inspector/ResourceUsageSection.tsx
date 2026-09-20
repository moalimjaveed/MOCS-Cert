import React from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { PropertyGrid } from './PropertyGrid';
import { PropertyRow } from './PropertyRow';

export interface ResourceUsageSectionProps {
  compressedBytesFetchedMb?: number | string | null;
  sourceCompressedBytesFetched?: number | string | null;
  coordinatePayloadBytes?: number | string;
  compressedFramesDecoded?: number;
  coordinatesMaterialized?: number;
  atomsAnalyzed?: number;
  indexBytesReadMb?: number | string;
  wallTimeSeconds?: number | string;
  refinementSelectivity?: number | string;
  refinementSpeed?: number | string;
  peakMemoryMb?: number | string;
  ioPruneRatio?: number | string;
  traversalDepth?: number | string;
  isOpen?: boolean;
  onToggle?: () => void;
}

export const ResourceUsageSection: React.FC<ResourceUsageSectionProps> = ({
  compressedBytesFetchedMb,
  sourceCompressedBytesFetched,
  coordinatePayloadBytes,
  compressedFramesDecoded,
  coordinatesMaterialized,
  atomsAnalyzed,
  indexBytesReadMb,
  wallTimeSeconds,
  refinementSelectivity,
  refinementSpeed,
  peakMemoryMb,
  ioPruneRatio,
  traversalDepth,
  isOpen = true,
  onToggle,
}) => {
  const activeSelectivity =
    refinementSelectivity !== undefined && refinementSelectivity !== ''
      ? refinementSelectivity
      : refinementSpeed !== undefined
      ? (typeof refinementSpeed === 'number' ? `${Math.round(refinementSpeed)}:1` : refinementSpeed)
      : 'NOT_MEASURED';
  const activeCompressedVal =
    sourceCompressedBytesFetched !== undefined
      ? sourceCompressedBytesFetched
      : compressedBytesFetchedMb;

  const formatCompressedBytes = (val?: number | string | null) => {
    if (val === null || val === 'Not measured') return 'Not measured';
    if (val === undefined || val === '') return 'Not measured';
    return typeof val === 'number' ? `${val.toFixed(1)} MB` : val;
  };

  const formatCoordinateBytes = (val?: number | string) => {
    if (val === undefined || val === null || val === '') return '0 B';
    return typeof val === 'number' ? `${val} B` : val;
  };

  const formatBytes = (val?: number | string | null) => {
    if (val === undefined || val === null || val === '') return '0.0 MB';
    return typeof val === 'number' ? `${val.toFixed(1)} MB` : val;
  };

  const formatSeconds = (val?: number | string | null) => {
    if (val === undefined || val === null || val === '') return '—';
    return typeof val === 'number' ? `${val.toFixed(2)} s` : val;
  };

  const formatSelectivity = (val?: number | string) => {
    if (val === undefined || val === null || val === '') return 'NOT_MEASURED';
    if (typeof val === 'number') {
      return `${Math.round(val)}:1`;
    }
    return String(val);
  };

  const formatMemory = (val?: number | string) => {
    if (val === undefined || val === null || val === '') return 'NOT_MEASURED';
    return typeof val === 'number' ? `${val.toFixed(1)} MB` : val;
  };

  const formatPruneRatio = (val?: number | string) => {
    if (val === undefined || val === null || val === '') return 'NOT_MEASURED';
    if (typeof val === 'number') {
      const pct = val <= 1.0 ? val * 100 : val;
      return `${pct.toFixed(1)}%`;
    }
    return val;
  };

  const formatDepth = (val?: number | string) => {
    if (val === undefined || val === null || val === '') return 'NOT_MEASURED';
    return typeof val === 'number' ? `${val} ${val === 1 ? 'level' : 'levels'}` : val;
  };

  return (
    <div data-testid="section-resource-usage">
      <div
        role={onToggle ? "button" : undefined}
        tabIndex={onToggle ? 0 : undefined}
        onClick={onToggle}
        className={`text-[11px] font-semibold text-[#5C5C5C] uppercase tracking-wider mb-2 select-text flex items-center justify-between ${onToggle ? 'cursor-pointer hover:text-[#1C1C1C]' : ''}`}
      >
        <span>Resource Usage</span>
        {onToggle && (
          <ChevronDown
            className={`w-3.5 h-3.5 text-[#8A8A8A] transition-transform duration-150 ${
              isOpen ? '' : '-rotate-90'
            }`}
            aria-hidden="true"
          />
        )}
      </div>
      <div className={isOpen ? '' : 'hidden'}>
        <PropertyGrid testId="resource-usage-grid">
          <PropertyRow
            label="Compressed bytes fetched"
            value={formatCompressedBytes(activeCompressedVal)}
            secondary
            testId="resource-compressed-bytes"
          />
          <PropertyRow
            label="Coordinate payload"
            value={formatCoordinateBytes(coordinatePayloadBytes)}
            secondary
            testId="resource-coordinate-payload"
          />
          <PropertyRow
            label="Frames decoded"
            value={compressedFramesDecoded}
            secondary
            testId="resource-frames-decoded"
          />
          <PropertyRow
            label="Coordinates materialized"
            value={coordinatesMaterialized}
            secondary
            testId="resource-coordinates-materialized"
          />
          <PropertyRow
            label="Atoms analyzed"
            value={atomsAnalyzed}
            secondary
            testId="resource-atoms-analyzed"
          />
          <PropertyRow
            label="Index bytes read"
            value={formatBytes(indexBytesReadMb)}
            secondary
            testId="resource-index-bytes"
          />
          <PropertyRow
            label="Wall time"
            value={formatSeconds(wallTimeSeconds)}
            secondary
            testId="resource-wall-time"
          />
        </PropertyGrid>

        {/* MCI Execution Telemetry */}
        <div className="mt-3 pt-2.5 border-t border-[#E5E5E5]">
          <div className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>Execution Telemetry (MCI)</span>
            <span className="inline-flex items-center gap-1 text-[#0969DA] font-semibold text-[9.5px]">
              <Check className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
              <span>Verified</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px] bg-[#F8FAFC] p-2 rounded border border-[#E2E8F0]">
            <div>
              <span className="text-[#64748B] text-[10px] block">Refinement Selectivity</span>
              <span className="font-semibold text-[#0F172A]" data-testid="telemetry-refinement-selectivity" data-legacy-testid="telemetry-refinement-speed">{formatSelectivity(activeSelectivity)}</span>
            </div>
            <div>
              <span className="text-[#64748B] text-[10px] block">Peak Memory</span>
              <span className="font-semibold text-[#0F172A]" data-testid="telemetry-peak-memory">{formatMemory(peakMemoryMb)}</span>
            </div>
            <div>
              <span className="text-[#64748B] text-[10px] block">I/O Prune Ratio</span>
              <span className="font-semibold text-[#0969DA]" data-testid="telemetry-io-prune-ratio">{formatPruneRatio(ioPruneRatio)}</span>
            </div>
            <div>
              <span className="text-[#64748B] text-[10px] block">Traversal Depth</span>
              <span className="font-semibold text-[#0F172A]" data-testid="telemetry-traversal-depth">{formatDepth(traversalDepth)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
