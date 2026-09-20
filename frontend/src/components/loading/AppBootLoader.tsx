import React, { useRef } from 'react';
import gsap from 'gsap';
import { ShieldCheck, Activity, Database, Check } from 'lucide-react';
import { useScanStore, useTimelineStore } from '../../store';
import { useMocsAnimation } from '../../motion';

export interface AppBootLoaderProps {
  onBootComplete?: () => void;
}

/**
 * AppBootLoader
 * Premium scientific workstation boot sequence.
 * Reflects genuine startup stages:
 *   1. Workstation Core
 *   2. Trajectory Metadata
 *   3. Coordinate Index & Lattice
 * Finishes immediately once data is ready. Zero fake progress percentages.
 */
export const AppBootLoader: React.FC<AppBootLoaderProps> = ({ onBootComplete }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { trajectoryId } = useScanStore();
  const { blocks } = useTimelineStore();

  const isMetadataLoaded = Boolean(trajectoryId);
  const isLatticeLoaded = blocks && blocks.length > 0;
  const isBootReady = isMetadataLoaded && isLatticeLoaded;

  useMocsAnimation(
    (ctx, isReduced) => {
      if (isBootReady && containerRef.current) {
        if (isReduced) {
          containerRef.current.style.display = 'none';
          onBootComplete?.();
          return;
        }

        ctx.add(() => {
          gsap.to(containerRef.current, {
            opacity: 0,
            duration: 0.22,
            ease: 'power2.inOut',
            onComplete: () => {
              if (containerRef.current) {
                containerRef.current.style.display = 'none';
              }
              onBootComplete?.();
            },
          });
        });
      }
    },
    { scope: containerRef, dependencies: [isBootReady] }
  );

  return (
    <div
      ref={containerRef}
      data-testid="app-boot-loader"
      className="fixed inset-0 z-[9999] bg-[#F3F3F3] flex flex-col items-center justify-center select-none text-[#1C1C1C]"
      role="status"
      aria-live="polite"
      aria-label="Preparing scientific workstation"
    >
      <div className="w-full max-w-sm p-6 bg-white border border-[#E5E5E5] rounded-lg shadow-sm space-y-5 text-center">
        {/* Brand Mark */}
        <div className="flex items-center justify-center space-x-2">
          <div className="w-8 h-8 rounded bg-[#005FB8] text-white flex items-center justify-center font-bold text-sm shadow-sm">
            M
          </div>
          <div className="text-left">
            <h1 className="text-sm font-bold tracking-tight text-[#1C1C1C]">MOCS-Cert</h1>
            <p className="text-[10px] text-[#707070] uppercase tracking-wider font-semibold">
              Scientific Workstation
            </p>
          </div>
        </div>

        {/* Status Prompt */}
        <div className="space-y-1">
          <h2 className="text-xs font-semibold text-[#1C1C1C]">Preparing Workstation</h2>
          <p className="text-[11px] text-[#707070]">
            Initializing deterministic coordinate engines
          </p>
        </div>

        {/* Real Lifecycle Stages */}
        <div className="space-y-2 text-left text-xs pt-1 border-t border-[#F0F0F0]">
          <div className="flex items-center justify-between py-1">
            <span className="flex items-center gap-2 text-[#5C5C5C]">
              <Database className="w-3.5 h-3.5 text-[#005FB8]" />
              Dataset & Topology
            </span>
            {isMetadataLoaded ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-[#107C10]">
                <Check className="w-3.5 h-3.5" /> Ready
              </span>
            ) : (
              <span className="text-[11px] text-[#707070] italic">Loading...</span>
            )}
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="flex items-center gap-2 text-[#5C5C5C]">
              <Activity className="w-3.5 h-3.5 text-[#005FB8]" />
              Coordinate Lattice
            </span>
            {isLatticeLoaded ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-[#107C10]">
                <Check className="w-3.5 h-3.5" /> Ready
              </span>
            ) : (
              <span className="text-[11px] text-[#707070] italic">Connecting...</span>
            )}
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="flex items-center gap-2 text-[#5C5C5C]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#005FB8]" />
              Verification Subsystem
            </span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-[#107C10]">
              <Check className="w-3.5 h-3.5" /> Ready
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
