import React, { useEffect } from 'react';
import {
  Settings,
  ShieldCheck,
  Play,
  PanelRight,
  Menu,
  Check,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useScanStore, useUIStore, useEvidenceStore } from '../../store';
import { runCanonicalQuery } from '../../api/queryExecution';

export const TopBar: React.FC = () => {
  const trajectoryId = useScanStore((s) => s.trajectoryId);
  const topologyId = useScanStore((s) => s.topologyId);
  const timestepPs = useScanStore((s) => s.timestepPs);
  const totalFrames = useScanStore((s) => s.totalFrames);
  const metadataStatus = useScanStore((s) => s.metadataStatus);
  const mciStatus = useScanStore((s) => s.mciStatus);

  const setAuditorModalOpen = useUIStore((s) => s.setAuditorModalOpen);
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const setSettingsModalOpen = useUIStore((s) => s.setSettingsModalOpen);
  const isInspectorOpen = useUIStore((s) => s.isInspectorOpen);
  const toggleInspector = useUIStore((s) => s.toggleInspector);
  const toggleMobileNav = useUIStore((s) => s.toggleMobileNav);

  const queryText = useEvidenceStore((s) => s.queryText);
  const isExecuting = useEvidenceStore((s) => s.isExecuting);

  const cleanTraj = trajectoryId?.replace(/^.*[\\/]/, '') || 'synth_500f.xtc';
  const cleanTopo = topologyId?.replace(/^.*[\\/]/, '') || 'synth_500f.gro';

  const handleRunQuery = async () => {
    if (isExecuting) return;
    await runCanonicalQuery(queryText);
  };

  // Only assign HTML title tooltip when the filename is actually long enough to risk truncation
  const trajTooltip = cleanTraj.length > 28 ? cleanTraj : undefined;
  const topoTooltip = cleanTopo.length > 28 ? cleanTopo : undefined;

  // Keyboard shortcuts: Ctrl+I (toggle inspector), F5 (run query)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        toggleInspector();
      }
      if (e.key === 'F5') {
        e.preventDefault();
        handleRunQuery();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleInspector, handleRunQuery]);

  return (
    <header
      className="h-12 min-h-[48px] max-h-[48px] border-b border-[#E5E5E5] bg-[#FFFFFF] px-3.5 grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-x-4 text-xs select-none shrink-0 z-30 font-sans overflow-hidden leading-none"
      role="banner"
    >
      {/* LEVEL 1: Application Identity (Auto) */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap leading-none h-full">
        <button
          type="button"
          data-testid="mobile-nav-toggle-btn"
          onClick={toggleMobileNav}
          aria-label="Toggle navigation menu"
          title="Toggle Navigation"
          className="lg:hidden w-7 h-7 rounded flex items-center justify-center text-[#5C5C5C] hover:text-[#1C1C1C] hover:bg-[#F3F3F3] transition-colors -ml-1 mr-0.5 shrink-0 cursor-pointer"
        >
          <Menu className="w-4 h-4" aria-hidden="true" />
        </button>
        <img
          src="/branding/logo.png"
          alt="MOCS-Cert"
          className="h-6 w-auto object-contain select-none shrink-0"
          draggable={false}
        />
        <span className="hidden sm:inline font-semibold text-[13px] text-[#1C1C1C] tracking-tight whitespace-nowrap">
          MOCS-Cert
        </span>
        <span className="text-[11px] text-[#8A8A8A] font-normal whitespace-nowrap">
          v0.1.0
        </span>
      </div>

      {/* LEVEL 2: Current Dataset Context (Flexible Star) */}
      <div className="min-w-0 flex items-center gap-3 text-[11px] text-[#5C5C5C] overflow-hidden whitespace-nowrap h-full">
        <span className="text-[#D1D1D1] select-none" aria-hidden="true">|</span>

        {/* Trajectory */}
        <div className="flex items-center gap-1.5 min-w-0 shrink-0">
          <span className="text-[#5C5C5C] font-normal shrink-0">Trajectory</span>
          <span
            className="text-[#1C1C1C] font-medium truncate max-w-[240px] xl:max-w-[320px] inline-block align-bottom"
            title={trajTooltip}
          >
            {cleanTraj}
          </span>
        </div>

        <span className="text-[#D1D1D1] shrink-0 select-none" aria-hidden="true">·</span>

        {/* Topology */}
        <div className="flex items-center gap-1.5 min-w-0 shrink-0">
          <span className="text-[#5C5C5C] font-normal shrink-0">Topology</span>
          <span
            className="text-[#1C1C1C] font-medium truncate max-w-[240px] xl:max-w-[320px] inline-block align-bottom"
            title={topoTooltip}
          >
            {cleanTopo}
          </span>
        </div>
      </div>

      {/* Secondary Simulation Summary: Only on wide 2xl screens */}
      <div className="hidden 2xl:flex items-center gap-2 text-[11px] text-[#5C5C5C] shrink-0 whitespace-nowrap h-full">
        <span>{totalFrames !== null ? `${totalFrames} frames` : 'Awaiting trajectory'}</span>
        {timestepPs !== null && (
          <>
            <span className="text-[#D1D1D1] select-none" aria-hidden="true">·</span>
            <span>Δt {timestepPs} ps</span>
          </>
        )}
      </div>

      {/* LEVEL 3: Global State (Technical Metadata Module) */}
      {metadataStatus === 'error' || mciStatus === 'OFFLINE' ? (
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[#B45309] border border-[#B45309] text-white text-[11px] shrink-0 whitespace-nowrap h-7 select-none">
          <AlertTriangle className="w-3 h-3 text-amber-200 shrink-0" aria-hidden="true" />
          <span className="font-semibold tracking-wide">Backend offline</span>
          <span className="text-white/60 select-none" aria-hidden="true">·</span>
          <span className="font-semibold tracking-wide">Index pending</span>
        </div>
      ) : metadataStatus === 'loading' ? (
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[#64748B] border border-[#64748B] text-white text-[11px] shrink-0 whitespace-nowrap h-7 select-none">
          <Loader2 className="w-3 h-3 text-white animate-spin shrink-0" aria-hidden="true" />
          <span className="font-semibold tracking-wide">Connecting...</span>
        </div>
      ) : (
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[#0969DA] border border-[#0969DA] text-white text-[11px] shrink-0 whitespace-nowrap h-7 select-none">
          <Check className="w-3 h-3 text-white stroke-[2.5] shrink-0" aria-hidden="true" />
          <span className="font-semibold tracking-wide">
            {mciStatus === 'PENDING' || mciStatus === 'INDEXED' || mciStatus === 'READY' || !mciStatus
              ? 'Index ready'
              : mciStatus}
          </span>
          <span className="text-white/60 select-none" aria-hidden="true">·</span>
          <span className="font-semibold tracking-wide">Source verified</span>
        </div>
      )}

      {/* ACTIONS: Global Application Commands */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap h-full justify-end">
        {/* Secondary: Verify Certificate */}
        <button
          type="button"
          onClick={() => setAuditorModalOpen(true)}
          className="h-8 px-2.5 sm:px-3 rounded-[4px] bg-[#FFFFFF] hover:bg-[#F8FAFC] active:bg-[#F1F5F9] text-[#1C1C1C] border border-[#D1D1D1] hover:border-[#94A3B8] text-[11px] font-medium transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#005FB8]"
          title="Verify Machine Proof Certificate"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-[#0969DA] shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">Verify Certificate</span>
        </button>

        {/* Primary: Run Query (Solid High-Contrast Accent Blue) */}
        <button
          type="button"
          onClick={handleRunQuery}
          disabled={isExecuting}
          className="h-8 px-3 sm:px-3.5 rounded-[4px] bg-[#005FB8] hover:bg-[#00529F] active:bg-[#00488B] text-white text-[11px] font-semibold tracking-wide transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#005FB8] interactive-press"
          title="Compile and Execute Query (F5)"
        >
          {isExecuting ? (
            <Loader2 className="w-3 h-3 animate-spin shrink-0" aria-hidden="true" />
          ) : (
            <Play className="w-3 h-3 fill-current shrink-0" aria-hidden="true" />
          )}
          <span>{isExecuting ? 'Running...' : 'Run Query'}</span>
          <kbd className="hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-ui font-medium text-white bg-[#004C99] border border-[#003D7A] rounded-[3px] ml-0.5 leading-none">
            F5
          </kbd>
        </button>

        {/* Toggle Result Inspector */}
        <button
          type="button"
          data-testid="toggle-inspector-btn"
          onClick={toggleInspector}
          className={`w-8 h-8 rounded-[4px] border transition-colors flex items-center justify-center shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#005FB8] interactive-press ${
            isInspectorOpen
              ? 'text-white bg-[#005FB8] border-[#005FB8]'
              : 'text-[#5C5C5C] hover:text-[#1C1C1C] hover:bg-[#F8FAFC] border-[#E5E5E5]'
          }`}
          title="Toggle Result Inspector (Ctrl+I)"
          aria-label="Toggle Result Inspector"
        >
          <PanelRight className="w-3.5 h-3.5 shrink-0" />
        </button>

        {/* Tertiary: Settings */}
        <button
          type="button"
          data-testid="topbar-settings-btn"
          onClick={() => setSettingsModalOpen(true)}
          className="w-8 h-8 rounded-[4px] border border-[#E5E5E5] bg-[#FFFFFF] hover:bg-[#F8FAFC] active:bg-[#F1F5F9] text-[#5C5C5C] hover:text-[#1C1C1C] transition-colors flex items-center justify-center shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#005FB8] interactive-press"
          title="Workstation Settings"
          aria-label="Open Settings"
        >
          <Settings className="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>
    </header>
  );
};

