/**
 * Zustand slice managing UI layout, active view modes, and dialog visibility.
 */

import { create } from 'zustand';

export type WorkspaceViewTab =
  | 'Workstation'
  | 'Molecular View'
  | 'Index Catalog'
  | 'Refinement Explorer'
  | 'Execution Benchmarks'
  | 'Formal Audit';

export type EvidenceTabKey =
  | 'cert'
  | 'mci'
  | 'geometry'
  | 'workload'
  | 'ref'
  | 'logs'
  | 'lattice'
  | 'certificate'
  | 'math'
  | 'benchmarks';

export interface UIState {
  activeView: 'workstation' | 'exploration';
  activeWorkspaceTab: WorkspaceViewTab;
  activeSidebarId: string;
  isSidebarCollapsed: boolean;
  isInspectorOpen: boolean;
  isMobileNavOpen: boolean;
  activeEvidenceTab: EvidenceTabKey;
  isAuditorModalOpen: boolean;
  isCommandPaletteOpen: boolean;
  isDocumentationModalOpen: boolean;
  isSettingsModalOpen: boolean;
  activeDocId: string;
  setActiveView: (view: 'workstation' | 'exploration') => void;
  setActiveWorkspaceTab: (tab: WorkspaceViewTab) => void;
  setActiveSidebarId: (id: string) => void;
  toggleSidebar: () => void;
  toggleInspector: () => void;
  setInspectorOpen: (open: boolean) => void;
  toggleMobileNav: () => void;
  setMobileNavOpen: (open: boolean) => void;
  setActiveEvidenceTab: (tab: EvidenceTabKey) => void;
  setAuditorModalOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setDocumentationModalOpen: (open: boolean) => void;
  setSettingsModalOpen: (open: boolean) => void;
  setActiveDocId: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeView: 'workstation', // Dense scientific workstation as primary view (Figure 2)
  activeWorkspaceTab: 'Workstation',
  activeSidebarId: 'distance',
  isSidebarCollapsed: false,
  isInspectorOpen: true,
  isMobileNavOpen: false,
  activeEvidenceTab: 'lattice',
  isAuditorModalOpen: false,
  isCommandPaletteOpen: false,
  isDocumentationModalOpen: false,
  isSettingsModalOpen: false,
  activeDocId: 'readme',
  setActiveView: (view) => set({ activeView: view }),
  setActiveWorkspaceTab: (tab) => set({ activeWorkspaceTab: tab }),
  setActiveSidebarId: (id) => set({ activeSidebarId: id }),
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  toggleInspector: () => set((state) => ({ isInspectorOpen: !state.isInspectorOpen })),
  setInspectorOpen: (open) => set({ isInspectorOpen: open }),
  toggleMobileNav: () => set((state) => ({ isMobileNavOpen: !state.isMobileNavOpen })),
  setMobileNavOpen: (open) => set({ isMobileNavOpen: open }),
  setActiveEvidenceTab: (tab) => set({ activeEvidenceTab: tab }),
  setAuditorModalOpen: (open) => set({ isAuditorModalOpen: open }),
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  setDocumentationModalOpen: (open) => set({ isDocumentationModalOpen: open }),
  setSettingsModalOpen: (open) => set({ isSettingsModalOpen: open }),
  setActiveDocId: (id) => set({ activeDocId: id }),
}));
