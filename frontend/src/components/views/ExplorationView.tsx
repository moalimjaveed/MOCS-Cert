import React from 'react';
import { MolecularViewport } from '../viewer/MolecularViewport';
import { BenchmarkChart } from '../evidence/BenchmarkChart';
import { MonacoQueryEditor } from '../editor/MonacoQueryEditor';
import { TimelineLattice } from '../timeline/TimelineLattice';
import { useEvidenceStore, useProofStore } from '../../store';
import { MocsBadge } from '../primitives';
import { Activity, Clock, CheckCircle2, Zap } from 'lucide-react';

export const ExplorationView: React.FC = () => {
  const { truthValue, pruningEfficiency } = useEvidenceStore();
  const { lowerBound, upperBound } = useProofStore();

  // Contact intervals matching Figure 1
  const intervals = [
    { id: 1, startNs: 245.2, endNs: 252.8, durationPs: 7600, status: 'CERTIFIED TRUE' },
    { id: 2, startNs: 414.0, endNs: 418.0, durationPs: 4000, status: 'REFINED TRUE' },
    { id: 3, startNs: 720.5, endNs: 726.1, durationPs: 5600, status: 'CERTIFIED TRUE' },
    { id: 4, startNs: 890.0, endNs: 893.2, durationPs: 3200, status: 'CERTIFIED TRUE' },
  ];

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-2 p-2 w-full h-full overflow-hidden bg-[#F3F3F3] text-xs select-none">
      {/* Left: 3D Molecular Viewport */}
      <div className="flex-1 min-h-[350px] flex flex-col gap-2 overflow-hidden">
        <div className="h-[120px] shrink-0">
          <MonacoQueryEditor />
        </div>
        <div className="flex-1 overflow-hidden">
          <MolecularViewport />
        </div>
        <div className="h-[100px] shrink-0">
          <TimelineLattice />
        </div>
      </div>

      {/* Right: Comparative Benchmarks + Detected Event Intervals */}
      <div className="w-full lg:w-[480px] flex flex-col gap-2 shrink-0 h-full overflow-hidden">
        {/* Top: Multi-Baseline Benchmark Chart (Figure 1 core visual) */}
        <div className="h-[280px] shrink-0">
          <BenchmarkChart />
        </div>

        {/* Bottom: Detected Event Intervals Table */}
        <div className="flex-1 flex flex-col bg-[#FFFFFF] rounded-[6px] border border-[#E5E5E5] overflow-hidden">
          <div className="h-9 px-3.5 flex items-center justify-between border-b border-[#F1F5F9] bg-[#FAFAFA] shrink-0">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-[#005FB8]" aria-hidden="true" />
              <span className="font-semibold text-[#1C1C1C] uppercase tracking-wider text-xs">
                Certified Contact Intervals
              </span>
            </div>
            <MocsBadge variant="primary" size="sm" icon={null}>
              4 CONTACT EVENTS
            </MocsBadge>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-4 gap-2 py-2 px-3.5 text-[10px] text-[#5C5C5C] uppercase font-semibold border-b border-[#E5E5E5] bg-[#FAFAFA]">
              <span>Interval</span>
              <span className="text-right">Start (ns)</span>
              <span className="text-right">End (ns)</span>
              <span className="text-right">Status</span>
            </div>

            {intervals.map((inv) => (
              <div
                key={inv.id}
                className="grid grid-cols-4 gap-2 py-2.5 px-3.5 border-b border-[#F1F5F9] text-xs items-center hover:bg-[#F8FAFC]"
              >
                <span className="font-semibold text-[#1C1C1C]">#{inv.id}</span>
                <span className="text-right tabular-nums text-[#5C5C5C]">{inv.startNs.toFixed(1)}</span>
                <span className="text-right tabular-nums text-[#5C5C5C]">{inv.endNs.toFixed(1)}</span>
                <div className="text-right">
                  <MocsBadge
                    variant={inv.status.includes('CERTIFIED') ? 'true' : 'warning'}
                    size="sm"
                    icon={null}
                  >
                    {inv.status}
                  </MocsBadge>
                </div>
              </div>
            ))}
          </div>

          {/* Table summary footer */}
          <div className="px-3.5 py-2 border-t border-[#E5E5E5] flex items-center justify-between text-[11px] text-[#5C5C5C] shrink-0 bg-[#FAFAFA]">
            <span>Minimum duration predicate: ≥ 5 ns</span>
            <span className="text-[#0969DA] font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#0969DA]" aria-hidden="true" />
              ALL WITNESSES SOUND
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
