import React, { useState, useRef } from 'react';
import { Play, AlertCircle, Check, ChevronDown, ChevronUp, Terminal, Loader2 } from 'lucide-react';
import { useEvidenceStore, useScanStore, useProofStore, useTimelineStore } from '../../store';
import { runCanonicalQuery } from '../../api/queryExecution';
import type { StructuredExecutionError } from '../../types/query';

export interface MonacoQueryEditorProps {
  className?: string;
  initialQuery?: string;
  onExecute?: (query: string) => Promise<void> | void;
}

const GOLDEN_PRESETS = [
  { label: 'QUERY 001: Single-Atom (CA ↔ O2, 4.0Å)', query: 'FIND (name CA) WITHIN 4.0A OF (name O2)' },
  { label: 'QUERY 002: Multi-Atom Contact (ALA ↔ LIG, 4.0Å)', query: 'FIND (resname ALA) WITHIN 4.0A OF (resname LIG)' },
  { label: 'QUERY 003: Existential Check (CA ↔ O2, 3.0Å)', query: 'FIND (name CA) WITHIN 3.0A OF (name O2)' },
  { label: 'QUERY 004: Universal Proof (FORALL, 10.0Å)', query: 'FIND ALL (name CA) WITHIN 10.0A OF (name O2)' },
  { label: 'QUERY 005: Exact Boundary (CA ↔ O2, 2.800Å)', query: 'FIND (name CA) WITHIN 2.800A OF (name O2)' },
  { label: 'QUERY 006: Inconclusive Refinement (CA ↔ O2, 3.9Å)', query: 'FIND (name CA) WITHIN 3.9A OF (name O2)' },
  { label: 'QUERY 007: Conservative False Pruning (1.0Å)', query: 'FIND (name CA) WITHIN 1.0A OF (name O2)' },
  { label: 'QUERY 008: Conservative True Witness (10.0Å)', query: 'FIND (name CA) WITHIN 10.0A OF (name O2)' },
  { label: 'QUERY 009: [Error] Invalid Selection', query: 'FIND (name INVALID_XYZ) WITHIN 4.0A OF (name O2)' },
  { label: 'QUERY 012: [Error] Malformed Syntax (-5.0Å)', query: 'FIND (name CA) WITHIN -5.0A OF (name O2)' },
];

/**
 * Scientific query workspace: canonical execution path, observable contract panel,
 * structured execution errors, golden query presets, and optional query diagnostics.
 */
export interface QueryPreset {
  label: string;
  query: string;
}

export function getPresetsForDataset(trajectoryId?: string, topologyId?: string): QueryPreset[] {
  const traj = (trajectoryId || '').toLowerCase();
  const topo = (topologyId || '').toLowerCase();

  if (traj.includes('adk_oplsaa') || topo.includes('adk_oplsaa')) {
    return [
      { label: 'QUERY [Unsupported Geometry]: Triclinic Cell (adk_oplsaa)', query: 'FIND (name CA) WITHIN 4.0A OF (name O2)' },
      { label: 'QUERY [Error]: Invalid Selection in ADK', query: 'FIND (name INVALID_ATM) WITHIN 4.0A OF (name CA)' },
    ];
  }

  if (traj.includes('1bna') || topo.includes('1bna')) {
    return [
      { label: "QUERY 101: Nucleic Distance (C1' ↔ C1', 10.0Å)", query: "FIND (name C1') WITHIN 10.0A OF (name C1')" },
      { label: 'QUERY 102: Residue Contact (DA ↔ DT, 12.0Å)', query: 'FIND (resname DA) WITHIN 12.0A OF (resname DT)' },
    ];
  }

  if (traj.includes('4hhb') || topo.includes('4hhb')) {
    return [
      { label: 'QUERY 201: Heme Iron Coordination (FE ↔ NE2, 3.0Å)', query: 'FIND (name FE) WITHIN 3.0A OF (name NE2)' },
      { label: 'QUERY 202: Heme Pocket Contact (HEM ↔ HIS, 5.0Å)', query: 'FIND (resname HEM) WITHIN 5.0A OF (resname HIS)' },
    ];
  }

  return GOLDEN_PRESETS;
}

export const MonacoQueryEditor: React.FC<MonacoQueryEditorProps> = ({
  className = '',
  initialQuery,
  onExecute: controlledOnExecute,
}) => {
  const {
    queryText,
    setQueryText,
    isExecuting,
    setExecuting,
    executionPlan,
    executionStage,
    structuredError,
    setStructuredError,
    executionId,
    queryHash,
    wallTimeSeconds,
    truthValue,
    resolutionStatus,
  } = useEvidenceStore();
  const { timestepPs, pbcMode, trajectoryId, topologyId } = useScanStore();
  const [localError, setLocalError] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const activePresets = React.useMemo(() => {
    return getPresetsForDataset(trajectoryId || undefined, topologyId || undefined);
  }, [trajectoryId, topologyId]);

  const prevDatasetRef = useRef<string | null>(trajectoryId);
  React.useEffect(() => {
    if (prevDatasetRef.current !== trajectoryId) {
      prevDatasetRef.current = trajectoryId;
      // Dual invalidation: dataset switch invalidates execution identity and state
      useEvidenceStore.getState().invalidateExecution();
      useProofStore.getState().resetProof();
      useTimelineStore.getState().resetTimeline();
      const newPresets = getPresetsForDataset(trajectoryId || undefined, topologyId || undefined);
      if (newPresets.length > 0) {
        setQueryText(newPresets[0].query);
      }
      setLocalError(null);
      setStructuredError(null);
    }
  }, [trajectoryId, topologyId, setQueryText, setStructuredError]);

  const gutterRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // Allow optional initial query override if provided
  React.useEffect(() => {
    if (initialQuery !== undefined && initialQuery !== queryText) {
      setQueryText(initialQuery);
    }
  }, [initialQuery]);

  const handleExecute = async () => {
    if (isExecuting) return;

    setLocalError(null);
    setStructuredError(null);

    if (controlledOnExecute) {
      try {
        setExecuting(true);
        await controlledOnExecute(queryText);
      } catch (err: any) {
        setLocalError(err.message || 'Execution error');
      } finally {
        setExecuting(false);
      }
      return;
    }

    const success = await runCanonicalQuery(queryText, {
      trajectory_id: trajectoryId || 'synth_500f.xtc',
      pbc_mode: pbcMode || 'orthorhombic_minimum_image',
    });

    if (!success) {
      const err = useEvidenceStore.getState().structuredError;
      if (err) {
        setLocalError(err.message);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }
  };

  const handlePresetSelect = (presetQuery: string) => {
    setQueryText(presetQuery);
    setLocalError(null);
    setStructuredError(null);
  };

  const activeError: StructuredExecutionError | null = structuredError || (localError ? {
    error_code: 'SERVER_ERROR',
    message: localError,
    action: 'Verify query syntax and connection to the MOCS-Cert backend.'
  } : null);

  const lines = (queryText || '').split('\n');

  // Quantifier calculation from query string
  const isForAll = /\b(?:FIND\s+ALL|FORALL)\b/i.test(queryText);
  const displayQuantifier = isForAll ? 'FORALL' : 'EXISTS';

  return (
    <div
      data-testid="query-workspace-panel"
      className={`query-workspace-container w-full max-w-full min-w-0 bg-[#FFFFFF] rounded-[8px] border border-[#E5E5E5] p-4 sm:p-5 font-sans text-xs select-none box-border ${className}`}
    >
      <div className="query-workspace-grid grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start w-full max-w-full min-w-0 box-border">
        {/* LEFT COLUMN: Scientific Query Editor (~58% / minmax(0, 1.35fr)) */}
        <div className="query-editor-col lg:col-span-7 flex flex-col min-w-0 w-full max-w-full box-border">
          {/* Query Header with Wrap-Safe Baseline Alignment */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5 min-h-[22px] min-w-0 w-full">
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-semibold text-[#1C1C1C] font-sans tracking-tight shrink-0">
                Query
              </h2>
              {/* Presets dropdown */}
              <div className="relative inline-block text-left">
                <select
                  aria-label="Golden Query Presets"
                  className="text-[11px] font-medium text-[#5C5C5C] hover:text-[#1C1C1C] bg-[#F7F7F7] hover:bg-[#EFEFEF] border border-[#E5E5E5] rounded-[4px] px-2 py-0.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#005FB8]"
                  onChange={(e) => {
                    if (e.target.value) handlePresetSelect(e.target.value);
                  }}
                  value=""
                >
                  <option value="" disabled>Load Golden Preset…</option>
                  {activePresets.map((p, idx) => (
                    <option key={idx} value={p.query}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Status / Error Header Module */}
            {activeError ? (
              <div
                data-testid="query-error-module"
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[#C42B1C] border border-[#C42B1C] text-white min-w-0 select-none"
              >
                <AlertCircle className="w-3.5 h-3.5 text-white shrink-0" aria-hidden="true" />
                <span
                  data-testid="query-error-badge"
                  className="truncate max-w-xs text-[11px] font-semibold"
                >
                  {activeError.error_code}: {activeError.message}
                </span>
              </div>
            ) : executionPlan.length > 0 || (queryText && queryText.trim().length > 0) ? (
              <div
                data-testid="query-status-module"
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] bg-[#0969DA] border border-[#0969DA] text-white shrink-0 select-none"
              >
                <Check className="w-3.5 h-3.5 text-white stroke-[2.5] shrink-0" aria-hidden="true" />
                <span
                  data-testid="query-status-badge"
                  className="text-white text-[11px] font-semibold tracking-wide"
                >
                  Valid query · Sound
                </span>
              </div>
            ) : null}
          </div>

          {/* Numbered Code Editor Surface */}
          <div
            onClick={() => textareaRef.current?.focus()}
            className="mt-2.5 flex bg-[#FAFAFA] rounded-[4px] border border-[#E5E5E5] focus-within:border-[#005FB8] focus-within:ring-1 focus-within:ring-[#005FB8] transition-all min-h-[140px] h-[155px] w-full max-w-full min-w-0 box-border overflow-hidden relative cursor-text"
          >
            {/* Dedicated Line Numbers Column */}
            <div
              ref={gutterRef}
              data-testid="editor-line-numbers"
              aria-hidden="true"
              className="w-10 shrink-0 pt-2.5 pb-2.5 pr-2.5 pl-1.5 text-right text-[#8A8A8A] select-none font-cascadia font-code tabular-nums text-[12px] leading-5 border-r border-[#E5E5E5] bg-[#F7F7F7] overflow-hidden"
            >
              {lines.map((_, i) => (
                <div key={i} className="h-5 leading-5">{String(i + 1).padStart(2, '0')}</div>
              ))}
            </div>

            {/* Query Content & Scroll Viewport */}
            <textarea
              ref={textareaRef}
              data-testid="query-textarea"
              aria-label="Scientific Query Editor"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              onKeyDown={handleKeyDown}
              onScroll={handleScroll}
              spellCheck={false}
              wrap="off"
              className="flex-1 h-full min-h-0 w-full min-w-0 max-w-full bg-transparent text-[#1C1C1C] font-cascadia font-code tabular-nums text-[12px] leading-5 resize-none focus:outline-none selection:bg-[#CDE4FC] whitespace-pre pt-2.5 pb-2.5 pl-3 pr-3 overflow-x-auto overflow-y-auto block box-border custom-editor-scrollbar query-textarea"
            />
          </div>

          {/* STRUCTURED ERROR CARD (Section 8: Precise, non-collapsed scientific error UI) */}
          {activeError && (
            <div
              data-testid="structured-error-card"
              className="mt-3 p-3 bg-[#FFF4F2] border border-[#F1A299] rounded-[6px] text-xs font-sans text-[#1C1C1C] select-text"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#C42B1C] shrink-0" aria-hidden="true" />
                  <span className="font-semibold text-[#C42B1C] tracking-wide uppercase text-[11px]">
                    {activeError.error_code}
                  </span>
                  {activeError.location && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-[#FDE7E4] text-[#C42B1C] rounded-[3px] font-medium">
                      Location: {activeError.location}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-1.5 text-[12px] text-[#24292F] font-medium leading-relaxed">
                {activeError.message}
              </div>
              {activeError.action && (
                <div className="mt-1.5 text-[11.5px] text-[#5C5C5C] flex items-start gap-1.5">
                  <span className="font-semibold text-[#1C1C1C] shrink-0">Action:</span>
                  <span>{activeError.action}</span>
                </div>
              )}
              {activeError.detail && activeError.detail !== activeError.message && (
                <div className="mt-2 pt-2 border-t border-[#F8D2CC] font-cascadia text-[11px] text-[#7A1D13] break-all">
                  {activeError.detail}
                </div>
              )}
            </div>
          )}

          {/* OBSERVABILITY / DIAGNOSTICS DRAWER (Section 35) */}
          <div className="mt-2 pt-2 border-t border-[#F0F0F0]">
            <button
              type="button"
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="inline-flex items-center gap-1 text-[11px] text-[#5C5C5C] hover:text-[#1C1C1C] font-medium cursor-pointer"
            >
              <Terminal className="w-3 h-3" />
              <span>Query Diagnostics</span>
              {showDiagnostics ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {showDiagnostics && (
              <div
                data-testid="query-diagnostics-panel"
                className="mt-2 p-2.5 bg-[#F7F7F7] border border-[#E5E5E5] rounded-[4px] font-cascadia text-[11px] text-[#24292F] space-y-1 select-text"
              >
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <span className="text-[#5C5C5C]">Execution Stage:</span>
                  <span className="font-semibold uppercase">{executionStage}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <span className="text-[#5C5C5C]">Execution ID:</span>
                  <span>{executionId || 'none'}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <span className="text-[#5C5C5C]">Query Hash:</span>
                  <span>{queryHash || 'none'}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <span className="text-[#5C5C5C]">Active Dataset:</span>
                  <span>{trajectoryId || 'synth_500f.xtc'}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <span className="text-[#5C5C5C]">Last Wall Latency:</span>
                  <span>{wallTimeSeconds ? `${(wallTimeSeconds * 1000).toFixed(1)} ms` : 'N/A'}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <span className="text-[#5C5C5C]">Truth / Status:</span>
                  <span>{truthValue} / {resolutionStatus}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Observable Contract & Primary Action (~42% / minmax(280px, 0.9fr)) */}
        <div className="query-contract-col lg:col-span-5 flex flex-col justify-between min-w-0 w-full max-w-full box-border">
          <div>
            {/* Observable Contract Header */}
            <div className="flex items-center min-h-[22px] min-w-0">
              <h3 className="text-[15px] font-semibold text-[#1C1C1C] font-sans tracking-tight shrink-0">
                Observable Contract
              </h3>
            </div>

            {/* Property Table */}
            <div data-testid="contract-properties" className="mt-2.5 py-0.5 space-y-2 text-[12.5px] w-full min-w-0">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 min-w-0">
                <span className="text-[#5C5C5C] font-sans shrink-0">Quantifier</span>
                <span
                  data-testid="contract-val-quantifier"
                  className="text-[#1C1C1C] font-medium text-right truncate min-w-0"
                >
                  {displayQuantifier}
                </span>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 min-w-0">
                <span className="text-[#5C5C5C] font-sans shrink-0">Semantics</span>
                <span
                  data-testid="contract-val-semantics"
                  className="text-[#1C1C1C] text-right truncate min-w-0"
                >
                  SAMPLED_FRAMES
                </span>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 min-w-0">
                <span className="text-[#5C5C5C] font-sans shrink-0">Sampling</span>
                <span
                  data-testid="contract-val-sampling"
                  className="text-[#1C1C1C] text-right truncate min-w-0"
                >
                  Δt = {timestepPs || 10} ps
                </span>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 min-w-0">
                <span className="text-[#5C5C5C] font-sans shrink-0">PBC</span>
                <span
                  data-testid="contract-val-pbc"
                  title={pbcMode || 'ORTHORHOMBIC_MIN_IMAGE'}
                  className="text-[#1C1C1C] text-right truncate min-w-0 max-w-[200px]"
                >
                  ORTHORHOMBIC_MIN_IMAGE
                </span>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 min-w-0">
                <span className="text-[#5C5C5C] font-sans shrink-0">Precision</span>
                <span
                  data-testid="contract-val-precision"
                  className="text-[#1C1C1C] text-right truncate min-w-0"
                >
                  FLOAT64
                </span>
              </div>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="border-t border-[#E5E5E5] pt-2.5 mt-3.5 flex items-center w-full min-w-0">
            <button
              data-testid="compile-execute-btn"
              aria-label="Compile and Execute Query"
              onClick={handleExecute}
              disabled={isExecuting}
              className="w-full h-9 px-4 rounded-[4px] text-[12px] font-semibold tracking-wide bg-[#005FB8] hover:bg-[#0067C0] active:bg-[#0052A0] active:scale-[0.98] text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#005FB8] box-border shadow-xs cursor-pointer interactive-press"
            >
              {isExecuting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white shrink-0" aria-hidden="true" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
              )}
              <span>{isExecuting ? 'Compiling…' : 'Compile & Execute'}</span>
              {!isExecuting && (
                <kbd className="hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-ui font-medium text-white bg-[#004C99] border border-[#003D7A] rounded-[3px] ml-1 leading-none">
                  Ctrl+↵
                </kbd>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
