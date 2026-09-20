import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  CheckCircle2,
  Box,
  Layers,
  Sparkles,
  BarChart3,
  X,
  Maximize2,
  Compass,
} from 'lucide-react';
import {
  useUIStore,
  useTimelineStore,
  useProofStore,
} from '../../store';
import { useMocsAnimation, gsap } from '../../motion';

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    setActiveView,
    setAuditorModalOpen,
    setActiveEvidenceTab,
  } = useUIStore();
  const modalRef = useRef<HTMLDivElement>(null);

  useMocsAnimation(
    (ctx, isReduced) => {
      if (!modalRef.current) return;
      if (isReduced) {
        modalRef.current.style.opacity = '1';
        modalRef.current.style.transform = 'none';
        return;
      }
      ctx.add(() => {
        gsap.fromTo(
          modalRef.current,
          { opacity: 0, scale: 0.98, y: -4 },
          { opacity: 1, scale: 1, y: 0, duration: 0.14, ease: 'power2.out' }
        );
      });
    },
    { scope: modalRef, dependencies: [isCommandPaletteOpen] }
  );
  const { selectBlock } = useTimelineStore();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      }
      if (e.key === 'Escape' && isCommandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  const actions = [
    {
      id: 'ws_view',
      label: 'Switch to Workstation View (Figure 2)',
      category: 'Views',
      icon: <Layers className="w-4 h-4 text-[#0969DA]" />,
      run: () => setActiveView('workstation'),
    },
    {
      id: 'exp_view',
      label: 'Switch to Exploration View (Figure 1)',
      category: 'Views',
      icon: <Compass className="w-4 h-4 text-[#005FB8]" />,
      run: () => setActiveView('exploration'),
    },
    {
      id: 'focus_b41',
      label: 'Inspect Block 41 [410 - 420 ns] (UNKNOWN Straddles Threshold)',
      category: 'Machine Proof',
      icon: <Box className="w-4 h-4 text-[#B45309]" />,
      run: () => {
        selectBlock(41);
        setActiveEvidenceTab('math');
      },
    },
    {
      id: 'focus_b25',
      label: 'Inspect Block 25 (CERTIFIED TRUE Contact)',
      category: 'Timeline',
      icon: <CheckCircle2 className="w-4 h-4 text-[#0969DA]" />,
      run: () => selectBlock(25),
    },
    {
      id: 'verify_cert',
      label: 'Audit Cryptographic SHA-256 Execution Certificate',
      category: 'Proof',
      icon: <CheckCircle2 className="w-4 h-4 text-[#005FB8]" />,
      run: () => setAuditorModalOpen(true),
    },
    {
      id: 'view_benchmarks',
      label: 'View MOBench Multi-Baseline Wall Time Comparison',
      category: 'Analytics',
      icon: <BarChart3 className="w-4 h-4 text-[#5C5C5C]" />,
      run: () => {
        setActiveView('exploration');
      },
    },
  ];

  const filtered = actions.filter(
    (a) =>
      a.label.toLowerCase().includes(query.toLowerCase()) ||
      a.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 font-sans text-xs select-none">
      <div ref={modalRef} className="w-full max-w-xl rounded-lg border border-[#E5E5E5] bg-[#FFFFFF] shadow-lg overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center px-4 py-3 border-b border-[#E5E5E5] bg-[#F9F9F9] gap-3">
          <Search className="w-4 h-4 text-[#5C5C5C]" />
          <input
            autoFocus
            type="text"
            placeholder="Type a command, query, or jump to block..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-[#1C1C1C] placeholder-[#8A8A8A] focus:outline-none text-[13px] font-sans"
          />
          <button
            onClick={() => setCommandPaletteOpen(false)}
            className="p-1 rounded text-[#5C5C5C] hover:text-[#1C1C1C] hover:bg-[#EAEAEA] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command list */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-0.5 bg-[#FFFFFF]">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-[#5C5C5C]">No matching commands found.</div>
          ) : (
            filtered.map((action) => (
              <div
                key={action.id}
                onClick={() => {
                  action.run();
                  setCommandPaletteOpen(false);
                }}
                className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-[#F3F3F3] cursor-pointer text-[#1C1C1C] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  {action.icon}
                  <span className="font-medium text-[12px] group-hover:text-[#005FB8]">{action.label}</span>
                </div>
                <span className="text-[10px] text-[#5C5C5C] uppercase px-1.5 py-0.5 rounded bg-[#F9F9F9] border border-[#E5E5E5] font-sans">
                  {action.category}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[#E5E5E5] bg-[#F9F9F9] flex items-center justify-between text-[11px] text-[#5C5C5C]">
          <span>Navigate with ↑ ↓, Press Enter to select</span>
          <kbd className="px-1.5 py-0.5 bg-[#EAEAEA] border border-[#D1D1D1] rounded text-[10px]">ESC to close</kbd>
        </div>
      </div>
    </div>
  );
};
