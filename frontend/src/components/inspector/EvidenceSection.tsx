import React from 'react';
import { ChevronDown } from 'lucide-react';
import { PropertyGrid } from './PropertyGrid';
import { PropertyRow } from './PropertyRow';
import { useRendererStore } from '../../store';

export interface EvidenceSectionProps {
  blocksExamined?: number;
  certifiedBlocks?: number;
  refinedBlocks?: number;
  exactFramesScanned?: number;
  pruningEfficiency?: number;
  isOpen?: boolean;
  onToggle?: () => void;
}

export const EvidenceSection: React.FC<EvidenceSectionProps> = ({
  blocksExamined = 0,
  certifiedBlocks = 0,
  refinedBlocks = 0,
  exactFramesScanned = 0,
  pruningEfficiency = 0,
  isOpen = true,
  onToggle,
}) => {
  const conformanceStatus = useRendererStore((s) => s.conformanceStatus);
  const latestScientificDigest = useRendererStore((s) => s.latestScientificDigest);
  const ledgerRecordCount = useRendererStore((s) => s.ledgerRecordCount);
  const inspectionActive = useRendererStore((s) => s.inspectionActive);

  return (
    <div data-testid="section-evidence">
      <div
        role={onToggle ? "button" : undefined}
        tabIndex={onToggle ? 0 : undefined}
        onClick={onToggle}
        className={`text-[11px] font-semibold text-[#5C5C5C] uppercase tracking-wider mb-2 select-text flex items-center justify-between ${onToggle ? 'cursor-pointer hover:text-[#1C1C1C]' : ''}`}
      >
        <span>Evidence</span>
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
        <PropertyGrid testId="evidence-grid">
          <PropertyRow
            label="Blocks examined"
            value={blocksExamined}
            testId="evidence-blocks-examined"
          />
          <PropertyRow
            label="Certified false"
            value={certifiedBlocks}
            testId="evidence-certified-false"
          />
          <PropertyRow
            label="Refined blocks"
            value={refinedBlocks}
            highlight="amber"
            testId="evidence-refined-blocks"
          />
          <PropertyRow
            label="Exact frames scanned"
            value={exactFramesScanned}
            highlight="blue"
            testId="evidence-exact-frames"
          />
        </PropertyGrid>

        <div className="mt-2 pt-2 border-t border-[#E5E5E5] flex items-center justify-between text-[11px]">
          <span className="text-[#5C5C5C]">Pruning efficiency</span>
          <span className="text-[#0969DA] font-bold">{pruningEfficiency}%</span>
        </div>

        {/* Renderer & Evidence Ledger Diagnostics */}
        <div className="mt-3 pt-2.5 border-t border-[#E5E5E5]" data-testid="renderer-diagnostics">
          <div className="text-[10px] font-semibold text-[#5C5C5C] uppercase tracking-wider mb-2 select-text">
            Renderer Verification
          </div>
          <div className="space-y-1.5 text-[11px]" data-testid="renderer-diagnostics-grid">
            <div className="flex items-center justify-between py-0.5" data-testid="diag-proof-conformance">
              <span className="text-[#5C5C5C]">Proof Conformance</span>
              <span className={`font-semibold ${conformanceStatus === 'PASS' ? 'text-[#0969DA]' : conformanceStatus === 'FAIL' ? 'text-[#C42B1C]' : 'text-[#B45309]'}`}>
                {conformanceStatus}
              </span>
            </div>
            <div className="flex items-center justify-between py-0.5" data-testid="diag-evidence-digest">
              <span className="text-[#5C5C5C]">Evidence Digest</span>
              <span className="font-mono text-[#1C1C1C]">
                {latestScientificDigest ? `${latestScientificDigest.slice(0, 12)}…` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between py-0.5" data-testid="diag-ledger-count">
              <span className="text-[#5C5C5C]">Ledger Records</span>
              <span className="text-[#1C1C1C] font-medium">{ledgerRecordCount}</span>
            </div>
            <div className="flex items-center justify-between py-0.5" data-testid="diag-inspection-status">
              <span className="text-[#5C5C5C]">Inspection Mode</span>
              <span className={inspectionActive ? 'text-[#B45309] font-semibold' : 'text-[#1C1C1C]'}>
                {inspectionActive ? 'Active (Cutaway)' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
