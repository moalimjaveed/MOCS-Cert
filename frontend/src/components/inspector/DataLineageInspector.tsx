/**
 * DataLineageInspector
 *
 * Cross-system pipeline diagnostics (read-only). Mounted inside the renderer
 * diagnostics panel when diagnostics mode is enabled (isDiagnosticsOpen).
 * and reads from all five canonical stores.
 *
 * Architecture layer: UI Engine only (read-only selectors, zero side effects).
 */

import React from 'react';
import {
  useViewerStore,
  useRendererStore,
  useProofStore,
  useScanStore,
  useEvidenceStore,
  useTimelineStore,
} from '../../store';

interface RowProps {
  label: string;
  value: React.ReactNode;
  verdict?: 'ok' | 'warn' | 'error' | 'neutral';
}

const Row: React.FC<RowProps> = ({ label, value, verdict = 'neutral' }) => {
  const valueColor =
    verdict === 'ok'
      ? 'text-[#059669]'
      : verdict === 'warn'
      ? 'text-[#D97706]'
      : verdict === 'error'
      ? 'text-[#C42B1C]'
      : 'text-[#1C1C1C]';

  return (
    <div className="flex justify-between gap-3 py-0.5 border-b border-[#F1F5F9] last:border-0">
      <span className="text-[#64748B] shrink-0 text-[10px]">{label}</span>
      <span className={`font-mono font-medium text-[10px] text-right truncate max-w-[180px] ${valueColor}`}>
        {value ?? <span className="text-[#94A3B8] italic">null</span>}
      </span>
    </div>
  );
};

export const DataLineageInspector: React.FC = () => {
  // ── Store selectors (read-only) ──────────────────────────────────────────
  const viewerStructureId = useViewerStore((s) => s.activeStructureId);
  const viewerSelA = useViewerStore((s) => s.selectionA);
  const viewerSelB = useViewerStore((s) => s.selectionB);

  const rendererConformance = useRendererStore((s) => s.conformanceStatus);
  const rendererLoadStage = useRendererStore((s) => s.loadStage);
  const sceneRevision = useRendererStore((s) => s.sceneRevision);

  const scanTrajectoryId = useScanStore((s) => s.trajectoryId);
  const scanTotalFrames = useScanStore((s) => s.totalFrames);
  const scanTimestepPs = useScanStore((s) => s.timestepPs);

  const evidenceQueryText = useEvidenceStore((s) => s.queryText);
  const evidenceDatasetId = useEvidenceStore((s) => s.datasetId);
  const evidenceStage = useEvidenceStore((s) => s.executionStage);
  const evidenceTruth = useEvidenceStore((s) => s.truthValue);
  const evidenceIsExecuting = useEvidenceStore((s) => s.isExecuting);

  const proofFocusedBlockId = useProofStore((s) => s.focusedBlockId);
  const proofStatus = useProofStore((s) => s.status);
  const proofTimeRange = useProofStore((s) => s.timeRangeNs);
  const proofThreshold = useProofStore((s) => s.threshold);

  const timelineSelectedBlock = useTimelineStore((s) => s.selectedBlockId);
  // ────────────────────────────────────────────────────────────────────────

  // Alignment checks
  const datasetAligned = viewerStructureId === scanTrajectoryId;
  const blockAligned = proofFocusedBlockId === timelineSelectedBlock;

  return (
    <div
      data-testid="data-lineage-inspector"
      className="mt-3 pt-3 border-t border-[#E5E5E5]"
    >
      <div className="text-[10px] uppercase tracking-wider text-[#005FB8] font-bold mb-2">
        Data Lineage
      </div>

      {/* Dataset Namespace Section */}
      <div className="text-[9px] uppercase tracking-widest text-[#94A3B8] font-semibold mb-1">
        Dataset Namespace
      </div>
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[4px] px-2 py-1 mb-2 space-y-0.5">
        <Row
          label="Active structure"
          value={viewerStructureId ?? 'null'}
          verdict={viewerStructureId ? 'ok' : 'warn'}
        />
        <Row
          label="Trajectory ID"
          value={scanTrajectoryId ?? 'null'}
          verdict={scanTrajectoryId ? 'ok' : 'warn'}
        />
        <Row
          label="Dataset ID"
          value={evidenceDatasetId ?? 'null'}
          verdict={evidenceDatasetId ? 'ok' : 'warn'}
        />
        <Row
          label="Alignment"
          value={datasetAligned ? '✓ aligned' : '⚠ MISMATCH'}
          verdict={datasetAligned ? 'ok' : 'error'}
        />
      </div>

      {/* Query / Execution Section */}
      <div className="text-[9px] uppercase tracking-widest text-[#94A3B8] font-semibold mb-1">
        Query → Execution
      </div>
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[4px] px-2 py-1 mb-2 space-y-0.5">
        <Row
          label="Query text"
          value={evidenceQueryText ? evidenceQueryText.slice(0, 40) + (evidenceQueryText.length > 40 ? '…' : '') : 'null'}
          verdict={evidenceQueryText ? 'ok' : 'warn'}
        />
        <Row
          label="Execution stage"
          value={evidenceStage ?? 'null'}
          verdict={evidenceIsExecuting ? 'warn' : evidenceStage === 'completed' ? 'ok' : 'neutral'}
        />
        <Row
          label="Truth value"
          value={evidenceTruth ?? 'null'}
          verdict={
            evidenceTruth === 'TRUE' ? 'ok'
            : evidenceTruth === 'FALSE' ? 'error'
            : evidenceTruth === 'UNKNOWN' ? 'warn'
            : 'neutral'
          }
        />
        <Row
          label="Selection A"
          value={viewerSelA || 'null'}
          verdict={viewerSelA ? 'ok' : 'warn'}
        />
        <Row
          label="Selection B"
          value={viewerSelB || 'null'}
          verdict={viewerSelB ? 'ok' : 'warn'}
        />
      </div>

      {/* Temporal / Proof Section */}
      <div className="text-[9px] uppercase tracking-widest text-[#94A3B8] font-semibold mb-1">
        Timeline → Proof
      </div>
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[4px] px-2 py-1 mb-2 space-y-0.5">
        <Row
          label="Timeline block"
          value={timelineSelectedBlock ?? 'null'}
          verdict={timelineSelectedBlock !== null ? 'ok' : 'warn'}
        />
        <Row
          label="Proof block"
          value={proofFocusedBlockId ?? 'null'}
          verdict={proofFocusedBlockId !== null ? 'ok' : 'warn'}
        />
        <Row
          label="Alignment"
          value={blockAligned ? '✓ aligned' : proofFocusedBlockId === null ? '— no execution' : '⚠ MISMATCH'}
          verdict={blockAligned ? 'ok' : proofFocusedBlockId === null ? 'neutral' : 'error'}
        />
        <Row
          label="Time range"
          value={proofFocusedBlockId !== null ? `[${proofTimeRange[0].toFixed(0)}, ${proofTimeRange[1].toFixed(0)} ns]` : 'null'}
        />
        <Row
          label="Threshold"
          value={proofThreshold > 0 ? `${proofThreshold.toFixed(2)} Å` : 'null'}
          verdict={proofThreshold > 0 ? 'ok' : 'warn'}
        />
      </div>

      {/* Conformance Section */}
      <div className="text-[9px] uppercase tracking-widest text-[#94A3B8] font-semibold mb-1">
        Verification
      </div>
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[4px] px-2 py-1 mb-2 space-y-0.5">
        <Row
          label="Renderer conformance"
          value={rendererConformance}
          verdict={rendererConformance === 'PASS' ? 'ok' : rendererConformance === 'FAIL' ? 'error' : 'warn'}
        />
        <Row
          label="Scientific verdict"
          value={proofStatus ?? 'null'}
          verdict={
            proofStatus?.includes('TRUE') ? 'ok'
            : proofStatus?.includes('FALSE') ? 'error'
            : proofStatus?.includes('UNKNOWN') ? 'warn'
            : 'neutral'
          }
        />
        <Row
          label="Load stage"
          value={rendererLoadStage}
          verdict={rendererLoadStage === 'READY' ? 'ok' : 'warn'}
        />
        <Row
          label="Scene revision"
          value={`#${sceneRevision}`}
        />
      </div>

      {/* Scan metadata */}
      <div className="text-[9px] uppercase tracking-widest text-[#94A3B8] font-semibold mb-1">
        Scan Metadata
      </div>
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[4px] px-2 py-1 space-y-0.5">
        <Row label="Total frames" value={scanTotalFrames ?? 'null'} verdict={scanTotalFrames ? 'ok' : 'warn'} />
        <Row label="Timestep" value={scanTimestepPs != null ? `${scanTimestepPs} ps` : 'null'} verdict={scanTimestepPs ? 'ok' : 'warn'} />
      </div>
    </div>
  );
};
