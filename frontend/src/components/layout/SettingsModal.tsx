import React, { useState } from 'react';
import {
  X,
  Sliders,
  Eye,
  Terminal,
  Cpu,
  ShieldCheck,
  HardDrive,
  Wrench,
  Palette,
  Check,
} from 'lucide-react';
import { useUIStore } from '../../store';

type SettingsCategory =
  | 'appearance'
  | 'workspace'
  | 'viewer'
  | 'query'
  | 'execution'
  | 'verification'
  | 'data'
  | 'advanced';

interface SettingRowProps {
  label: string;
  description: string;
  children: React.ReactNode;
}

const SettingRow: React.FC<SettingRowProps> = ({ label, description, children }) => (
  <div className="flex items-center justify-between py-3 border-b border-[#F0F0F0] gap-4 last:border-b-0">
    <div className="space-y-0.5 min-w-0">
      <div className="text-xs font-semibold text-[#1C1C1C]">{label}</div>
      <div className="text-[11px] text-[#5C5C5C] leading-snug">{description}</div>
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

export const SettingsModal: React.FC = () => {
  const { isSettingsModalOpen, setSettingsModalOpen } = useUIStore();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('appearance');

  // Settings mock state for scientific controls
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');
  const [density, setDensity] = useState<'compact' | 'comfortable'>('compact');
  const [autoVerify, setAutoVerify] = useState<boolean>(true);
  const [caliperPrecision, setCaliperPrecision] = useState<string>('float64');
  const [planStrategy, setPlanStrategy] = useState<string>('cost_optimal');
  const [pbcMode, setPbcMode] = useState<string>('orthorhombic_minimum_image');
  const [mmapCache, setMmapCache] = useState<boolean>(true);

  if (!isSettingsModalOpen) return null;

  const categories: { id: SettingsCategory; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'workspace', label: 'Workspace', icon: Sliders },
    { id: 'viewer', label: 'Viewer & 3D', icon: Eye },
    { id: 'query', label: 'Query & IDE', icon: Terminal },
    { id: 'execution', label: 'Execution Engine', icon: Cpu },
    { id: 'verification', label: 'Verification & Proofs', icon: ShieldCheck },
    { id: 'data', label: 'Data & Storage', icon: HardDrive },
    { id: 'advanced', label: 'Advanced Diagnostics', icon: Wrench },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 select-none font-sans text-xs"
    >
      <div className="bg-[#FFFFFF] border border-[#D1D1D1] rounded-[8px] shadow-2xl w-full max-w-[800px] h-[540px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-12 border-b border-[#E5E5E5] bg-[#FAFAFA] shrink-0">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#005FB8]" aria-hidden="true" />
            <span id="settings-dialog-title" className="font-semibold text-sm text-[#1C1C1C]">
              Workstation Settings
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSettingsModalOpen(false)}
            className="w-7 h-7 rounded-[4px] flex items-center justify-center text-[#5C5C5C] hover:text-[#1C1C1C] hover:bg-[#EAEAEA] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#005FB8]"
            title="Close Settings (Esc)"
            aria-label="Close Settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area: Two-Column Split */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Category Rail */}
          <div className="w-52 border-r border-[#E5E5E5] bg-[#FAFAFA] p-2 space-y-0.5 overflow-y-auto shrink-0">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`w-full flex items-center gap-2.5 px-3 h-8 rounded-[4px] text-xs font-medium text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#005FB8] ${
                    isActive
                      ? 'bg-[#FFFFFF] text-[#005FB8] font-semibold border border-[#D1D1D1] shadow-xs'
                      : 'text-[#5C5C5C] hover:text-[#1C1C1C] hover:bg-[#F0F0F0] border border-transparent'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#005FB8]' : 'text-[#707070]'}`} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Setting Detail Pane */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {activeCategory === 'appearance' && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#707070] mb-2">
                  Theme & Density
                </div>
                <div className="divide-y divide-[#F0F0F0]">
                  <SettingRow label="Color Theme" description="Interface chrome color appearance. Light mode is calibrated for scientific lab monitors.">
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as any)}
                      className="h-7 px-2 border border-[#D1D1D1] rounded-[4px] text-xs bg-[#FFFFFF] text-[#1C1C1C] outline-none cursor-pointer"
                    >
                      <option value="light">Fluent Light (Default)</option>
                      <option value="dark">Scientific Dark</option>
                      <option value="system">System Synchronized</option>
                    </select>
                  </SettingRow>

                  <SettingRow label="Information Density" description="Adjust metric card padding, table row heights, and layout compactness.">
                    <select
                      value={density}
                      onChange={(e) => setDensity(e.target.value as any)}
                      className="h-7 px-2 border border-[#D1D1D1] rounded-[4px] text-xs bg-[#FFFFFF] text-[#1C1C1C] outline-none cursor-pointer"
                    >
                      <option value="compact">Compact Scientific (32px rows)</option>
                      <option value="comfortable">Comfortable (38px rows)</option>
                    </select>
                  </SettingRow>

                  <SettingRow label="Epistemic Accent High-Contrast" description="Enforce solid semantic color tokens (Cobalt True, Rose False, Amber Unknown).">
                    <div className="flex items-center gap-1.5 text-xs text-[#0969DA] font-semibold">
                      <Check className="w-3.5 h-3.5" /> Enforced
                    </div>
                  </SettingRow>
                </div>
              </div>
            )}

            {activeCategory === 'workspace' && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#707070] mb-2">
                  Workspace Preferences
                </div>
                <div className="divide-y divide-[#F0F0F0]">
                  <SettingRow label="Auto-save Query Sessions" description="Automatically persist active MolQL queries and view state in localStorage.">
                    <input type="checkbox" defaultChecked className="cursor-pointer accent-[#005FB8]" />
                  </SettingRow>
                  <SettingRow label="Telemetry Frame Rate" description="WebSocket ring-buffer telemetry ingestion polling frequency.">
                    <span className="font-mono text-xs text-[#5C5C5C]">60 Hz (Sub-16ms)</span>
                  </SettingRow>
                </div>
              </div>
            )}

            {activeCategory === 'viewer' && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#707070] mb-2">
                  3D Molecular Visualization
                </div>
                <div className="divide-y divide-[#F0F0F0]">
                  <SettingRow label="Mol* Canvas Quality" description="Instanced mesh LOD geometry and antialiasing profile.">
                    <select className="h-7 px-2 border border-[#D1D1D1] rounded-[4px] text-xs bg-[#FFFFFF] text-[#1C1C1C] outline-none cursor-pointer">
                      <option value="high">High Fidelity (MSAA 4x)</option>
                      <option value="balanced">Balanced (MSAA 2x)</option>
                      <option value="performance">Fast / Low VRAM</option>
                    </select>
                  </SettingRow>
                  <SettingRow label="Caliper Coordinate Precision" description="Precision for distance calculations between biopolymer anchors.">
                    <select
                      value={caliperPrecision}
                      onChange={(e) => setCaliperPrecision(e.target.value)}
                      className="h-7 px-2 border border-[#D1D1D1] rounded-[4px] text-xs bg-[#FFFFFF] text-[#1C1C1C] outline-none cursor-pointer"
                    >
                      <option value="float64">Float64 Double Precision</option>
                      <option value="float32">Float32 Single Precision</option>
                    </select>
                  </SettingRow>
                </div>
              </div>
            )}

            {activeCategory === 'query' && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#707070] mb-2">
                  Monaco Query Editor
                </div>
                <div className="divide-y divide-[#F0F0F0]">
                  <SettingRow label="Syntax Linting on Keystroke" description="Execute live MolQL grammar parser and flag undefined atom identifiers.">
                    <input type="checkbox" defaultChecked className="cursor-pointer accent-[#005FB8]" />
                  </SettingRow>
                  <SettingRow label="Show Editor Minimap" description="Display minimap on right edge of query editor.">
                    <input type="checkbox" className="cursor-pointer accent-[#005FB8]" />
                  </SettingRow>
                </div>
              </div>
            )}

            {activeCategory === 'execution' && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#707070] mb-2">
                  Query Execution Pipeline
                </div>
                <div className="divide-y divide-[#F0F0F0]">
                  <SettingRow label="Execution Plan Strategy" description="Cost-based optimizer selection between Plans A, B, C, and D.">
                    <select
                      value={planStrategy}
                      onChange={(e) => setPlanStrategy(e.target.value)}
                      className="h-7 px-2 border border-[#D1D1D1] rounded-[4px] text-xs bg-[#FFFFFF] text-[#1C1C1C] outline-none cursor-pointer"
                    >
                      <option value="cost_optimal">Cost-Optimal Dynamic Selection</option>
                      <option value="plan_a">Force Plan A (Index-First Pruning)</option>
                      <option value="plan_b">Force Plan B (Direct Scan)</option>
                    </select>
                  </SettingRow>
                  <SettingRow label="PBC Handling Convention" description="Periodic Boundary Condition minimum-image convention.">
                    <select
                      value={pbcMode}
                      onChange={(e) => setPbcMode(e.target.value)}
                      className="h-7 px-2 border border-[#D1D1D1] rounded-[4px] text-xs bg-[#FFFFFF] text-[#1C1C1C] outline-none cursor-pointer"
                    >
                      <option value="orthorhombic_minimum_image">Orthorhombic Minimum Image</option>
                      <option value="triclinic_guarded">Triclinic Guarded</option>
                    </select>
                  </SettingRow>
                </div>
              </div>
            )}

            {activeCategory === 'verification' && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#707070] mb-2">
                  Formal Verification & Proofs
                </div>
                <div className="divide-y divide-[#F0F0F0]">
                  <SettingRow label="Differential Oracle Validation" description="Cross-validate certified intervals against MDAnalysis 2.7.0 oracle automatically.">
                    <input
                      type="checkbox"
                      checked={autoVerify}
                      onChange={(e) => setAutoVerify(e.target.checked)}
                      className="cursor-pointer accent-[#005FB8]"
                    />
                  </SettingRow>
                  <SettingRow label="Strict Merkle Proof Digest Check" description="Fail verification if spatial radix root digest diverges by even 1 bit.">
                    <input type="checkbox" defaultChecked disabled className="accent-[#005FB8]" />
                  </SettingRow>
                </div>
              </div>
            )}

            {activeCategory === 'data' && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#707070] mb-2">
                  Data Engine & Storage
                </div>
                <div className="divide-y divide-[#F0F0F0]">
                  <SettingRow label="Zero-Copy Memory-Mapped Index" description="Enable mmap page caching for trajectory seek tables.">
                    <input
                      type="checkbox"
                      checked={mmapCache}
                      onChange={(e) => setMmapCache(e.target.checked)}
                      className="cursor-pointer accent-[#005FB8]"
                    />
                  </SettingRow>
                  <SettingRow label="Index Cache Limit" description="Maximum RAM allocated to spatial bounds and MCI node caches.">
                    <span className="font-mono text-xs text-[#5C5C5C]">512 MB</span>
                  </SettingRow>
                </div>
              </div>
            )}

            {activeCategory === 'advanced' && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#707070] mb-2">
                  Advanced Diagnostics
                </div>
                <div className="divide-y divide-[#F0F0F0]">
                  <SettingRow label="Array Dispatcher Backend" description="Computational linear algebra engine for AABB vectorization.">
                    <span className="font-mono text-xs text-[#005FB8] font-semibold">NUMPY (Vectorized C Extension)</span>
                  </SettingRow>
                  <SettingRow label="WebSocket Frame Latency" description="Network latency between frontend state engine and FastAPI backend.">
                    <span className="font-mono text-xs text-[#0D9488] font-semibold">&lt; 1.2 ms</span>
                  </SettingRow>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="h-12 px-5 border-t border-[#E5E5E5] bg-[#FAFAFA] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-[#707070]">
            MOCS-Cert v0.1.0 · By Moalim Javeed · Changes persist locally
          </span>
          <button
            type="button"
            onClick={() => setSettingsModalOpen(false)}
            className="h-7 px-4 rounded-[4px] bg-[#005FB8] text-white text-xs font-semibold hover:bg-[#00529F] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#005FB8]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
