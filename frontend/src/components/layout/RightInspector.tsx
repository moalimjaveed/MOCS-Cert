import React, { useState, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useEvidenceStore, useScanStore, useUIStore } from '../../store';
import { useMocsAnimation, gsap } from '../../motion';
import {
  VerdictCard,
  QueryContractSection,
  EvidenceSection,
  ResourceUsageSection,
} from '../inspector';

export const RightInspector: React.FC = () => {
  const {
    truthValue,
    resolutionStatus,
    quantifier,
    operator,
    semantics,
    pbc,
    precision,
    blocksExamined,
    certifiedBlocks,
    refinedBlocks,
    exactFramesScanned,
    pruningEfficiency,
    sourceCompressedBytesFetched,
    coordinatePayloadBytes,
    compressedBytesFetchedMb,
    compressedFramesDecoded,
    coordinatesMaterialized,
    atomsAnalyzed,
    indexBytesReadMb,
    wallTimeSeconds,
    peakMemoryMb,
    refinementSelectivity,
    refinementSpeed,
    ioPruneRatio,
    traversalDepth,
    executionId,
  } = useEvidenceStore();

  const pbcMode = useScanStore((s) => s.pbcMode);
  const samplingSemantics = useScanStore((s) => s.samplingSemantics);
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const isInspectorOpen = useUIStore((s) => s.isInspectorOpen);
  const setInspectorOpen = useUIStore((s) => s.setInspectorOpen);

  const [isContractOpen, setContractOpen] = useState(true);
  const [isEvidenceOpen, setEvidenceOpen] = useState(true);
  const [isResourcesOpen, setResourcesOpen] = useState(true);
  const [isProvenanceOpen, setProvenanceOpen] = useState(true);

  const handleOpenSearch = () => {
    setCommandPaletteOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setCommandPaletteOpen(true);
    }
  };

  const asideRef = useRef<HTMLElement>(null);

  useMocsAnimation(
    (ctx, isReduced) => {
      if (!asideRef.current) return;
      if (isReduced) {
        asideRef.current.style.opacity = '1';
        asideRef.current.style.transform = 'none';
        return;
      }
      ctx.add(() => {
        gsap.fromTo(
          asideRef.current,
          { opacity: 0, x: 12 },
          { opacity: 1, x: 0, duration: 0.18, ease: 'power2.out' }
        );
      });
    },
    { scope: asideRef, dependencies: [isInspectorOpen] }
  );

  if (!isInspectorOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop on screens < xl to close drawer on outside tap */}
      <div
        data-testid="inspector-backdrop"
        className="fixed inset-0 top-12 z-30 bg-black/40 xl:hidden transition-opacity"
        onClick={() => setInspectorOpen(false)}
        aria-hidden="true"
      />

      <aside
        ref={asideRef}
        data-testid="right-inspector"
        aria-label="Result Inspector"
        className="fixed right-0 top-12 bottom-0 z-40 w-[290px] sm:w-[310px] max-w-[85vw] bg-[#FFFFFF] border-l border-[#E5E5E5] shadow-md flex flex-col font-sans text-xs overflow-y-auto overflow-x-hidden select-none xl:static xl:z-auto xl:shadow-none xl:w-[285px] 2xl:w-[305px] shrink-0"
      >
        {/* Header on < xl with title and close button */}
        <div className="flex xl:hidden items-center justify-between px-3.5 py-2 border-b border-[#E5E5E5] bg-[#FAFAFA] shrink-0">
          <span className="font-semibold text-xs text-[#1C1C1C]">Result Inspector</span>
          <button
            type="button"
            data-testid="close-inspector-btn"
            onClick={() => setInspectorOpen(false)}
            className="w-6 h-6 rounded flex items-center justify-center text-[#5C5C5C] hover:text-[#1C1C1C] hover:bg-[#EAEAEA] transition-colors cursor-pointer"
            title="Close Inspector"
            aria-label="Close Inspector"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search / Command Launcher - Compact Fluent search box connected to CommandPalette */}
        <div className="p-2.5 sm:px-3 border-b border-[#E5E5E5] shrink-0">
          <div
            role="button"
            tabIndex={0}
            onClick={handleOpenSearch}
            onKeyDown={handleKeyDown}
            aria-label="Search commands and observables (Ctrl+K)"
            className="flex items-center justify-between h-8 px-2.5 rounded-[4px] bg-[#F9F9F9] hover:bg-[#F3F3F3] border border-[#E5E5E5] hover:border-[#D1D1D1] text-[#5C5C5C] transition-colors cursor-pointer focus:outline-none focus:border-[#005FB8] focus:ring-1 focus:ring-[#005FB8]"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Search className="w-3.5 h-3.5 shrink-0 text-[#8A8A8A]" aria-hidden="true" />
              <span className="text-[11px] text-[#8A8A8A] truncate">
                Query molecular observable...
              </span>
            </div>
            <kbd className="text-[9.5px] text-[#5C5C5C] bg-[#EAEAEA] border border-[#D1D1D1] rounded px-1 py-0.2 shrink-0 font-mono">
              Ctrl+K
            </kbd>
          </div>
        </div>

        {/* Main Inspector Body - Strict 4-tier hierarchy */}
        <div className="p-3 sm:p-3.5 space-y-3.5 flex-1 min-w-0">
          {/* 1. RESULT SECTION */}
          <section data-testid="inspector-section-result">
            <div className="text-[11px] font-semibold text-[#5C5C5C] uppercase tracking-wider mb-2 select-text">
              Result
            </div>
            <VerdictCard
              truthValue={truthValue}
              resolutionStatus={resolutionStatus}
            />
          </section>

          {/* 2. QUERY CONTRACT SECTION */}
          <section
            data-testid="inspector-section-contract"
            className="pt-3.5 border-t border-[#E5E5E5]"
          >
            <QueryContractSection
              quantifier={quantifier}
              operator={operator}
              semantics={semantics || samplingSemantics}
              pbc={pbc || pbcMode}
              precision={precision}
              isOpen={isContractOpen}
              onToggle={() => setContractOpen(!isContractOpen)}
            />
          </section>

          {/* 3. EVIDENCE SECTION */}
          <section
            data-testid="inspector-section-evidence"
            className="pt-3.5 border-t border-[#E5E5E5]"
          >
            <EvidenceSection
              blocksExamined={blocksExamined}
              certifiedBlocks={certifiedBlocks}
              refinedBlocks={refinedBlocks}
              exactFramesScanned={exactFramesScanned}
              pruningEfficiency={pruningEfficiency}
              isOpen={isEvidenceOpen}
              onToggle={() => setEvidenceOpen(!isEvidenceOpen)}
            />
          </section>

          {/* 4. RESOURCE USAGE SECTION (Secondary Telemetry) */}
          <section
            data-testid="inspector-section-resources"
            className="pt-3.5 border-t border-[#E5E5E5]"
          >
            <ResourceUsageSection
              sourceCompressedBytesFetched={sourceCompressedBytesFetched}
              coordinatePayloadBytes={coordinatePayloadBytes ?? 0}
              compressedBytesFetchedMb={compressedBytesFetchedMb}
              compressedFramesDecoded={compressedFramesDecoded}
              coordinatesMaterialized={coordinatesMaterialized}
              atomsAnalyzed={atomsAnalyzed}
              indexBytesReadMb={indexBytesReadMb}
              wallTimeSeconds={wallTimeSeconds}
              refinementSelectivity={refinementSelectivity}
              refinementSpeed={refinementSpeed}
              peakMemoryMb={peakMemoryMb}
              ioPruneRatio={ioPruneRatio}
              traversalDepth={traversalDepth}
              isOpen={isResourcesOpen}
              onToggle={() => setResourcesOpen(!isResourcesOpen)}
            />
          </section>

          {/* 5. PROVENANCE & LINEAGE */}
          <div
            data-testid="inspector-section-provenance"
            className="pt-3.5 border-t border-[#E5E5E5]"
          >
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setProvenanceOpen(!isProvenanceOpen)}
            >
              <div className="text-[11px] font-semibold text-[#5C5C5C] uppercase tracking-wider select-text">
                Provenance &amp; Lineage
              </div>
              <span className="text-[10px] text-[#8A8A8A]">{isProvenanceOpen ? 'Hide' : 'Show'}</span>
            </div>
            {isProvenanceOpen && (
              <div className="mt-2.5 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-[#5C5C5C]">Execution ID</span>
                  <span className="font-mono text-[10.5px] text-[#005FB8] font-semibold">
                    {executionId ? executionId.slice(0, 14) + '…' : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-[#5C5C5C]">Engine Version</span>
                  <span className="text-[#1C1C1C] font-medium">MOCS-Cert v0.1.0</span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-[#5C5C5C]">Bounding Oracle</span>
                  <span className="text-[#1C1C1C] font-medium">Conservative AABB-v1</span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-[#5C5C5C]">Soundness Proof</span>
                  <span className="text-[#0969DA] font-semibold">
                    {executionId ? '100% Zero False Negatives' : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-0.5 pt-1.5 border-t border-[#F1F5F9]">
                  <span className="text-[#5C5C5C]">Authorship</span>
                  <span className="text-[#1C1C1C] font-medium">By Moalim Javeed</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
