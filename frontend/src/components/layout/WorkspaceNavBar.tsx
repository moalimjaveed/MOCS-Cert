import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useUIStore } from '../../store';
import {
  WORKSPACE_TAB_KEYS,
  WorkspaceTabKey,
  WORKSPACE_TAB_SLUGS,
} from '../../navigation/navigationRegistry';
import { navigateTo, getCurrentRawPath, parseRoute } from '../../navigation/router';

export { WORKSPACE_TAB_KEYS as WORKSPACE_VIEWS };
export type { WorkspaceTabKey as WorkspaceViewTab };

export interface WorkspaceNavBarProps {
  observableType?: string;
  selectionContext?: string;
  activeTab?: string;
  onTabChange?: (tab: WorkspaceTabKey | string) => void;
  className?: string;
}

/**
 * Secondary Workspace Navigation Bar
 *
 * Strict WinUI 3 / Fluent Design Two-Tier Workstation Navigation:
 * - Row 1 (28px): Breadcrumb trail (Workspace > Observables > Distance > Context)
 * - Row 2 (32px): 6 Workspace View Tabs (Workstation | Molecular View | Index | Refinement | Benchmarks | Formal Audit)
 * - Breadcrumbs and tabs update canonical URL route
 * - Selected observable context remains constant across all contextual view switches
 */
export const WorkspaceNavBar: React.FC<WorkspaceNavBarProps> = ({
  observableType = 'Distance',
  selectionContext = 'A:155:CA ↔ LIG:1:O2',
  activeTab: controlledActiveTab,
  onTabChange,
  className = '',
}) => {
  const { isInspectorOpen, setInspectorOpen, activeWorkspaceTab, setActiveWorkspaceTab, activeSidebarId } = useUIStore();
  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : activeWorkspaceTab;

  const handleTabClick = (tab: WorkspaceTabKey) => {
    onTabChange?.(tab);
    setActiveWorkspaceTab(tab);

    const { pathname, search } = getCurrentRawPath();
    const currentRoute = parseRoute(pathname, search);
    const slug = WORKSPACE_TAB_SLUGS[tab] || 'workstation';

    if (currentRoute.domain === 'observables' && currentRoute.observableId) {
      navigateTo(`/observables/${currentRoute.observableId}/${slug}`);
    } else {
      // Standalone workspace routing
      if (tab === 'Workstation') {
        navigateTo('/experiments/synth_500f');
      } else if (tab === 'Index Catalog') {
        navigateTo('/index');
      } else if (tab === 'Execution Benchmarks') {
        navigateTo('/benchmarks');
      } else if (tab === 'Formal Audit') {
        navigateTo('/verification');
      } else {
        const obsId = activeSidebarId === 'contact' ? 'contact' : activeSidebarId === 'hbond' ? 'hbond' : 'distance';
        navigateTo(`/observables/${obsId}/${slug}`);
      }
    }
  };

  const handleBreadcrumbClick = (target: 'workspace' | 'observables' | 'current') => {
    if (target === 'workspace') {
      navigateTo('/experiments/synth_500f');
    } else if (target === 'observables') {
      navigateTo('/observables/distance');
    } else if (target === 'current') {
      const obsId = activeSidebarId === 'contact' ? 'contact' : activeSidebarId === 'hbond' ? 'hbond' : 'distance';
      navigateTo(`/observables/${obsId}`);
    }
  };

  return (
    <div
      data-testid="workspace-navbar"
      className={`w-full h-[60px] min-h-[60px] max-h-[60px] border-b border-[#E5E5E5] bg-[#FFFFFF] shrink-0 select-none overflow-hidden font-sans flex flex-col justify-between ${className}`}
    >
      {/* Tier 1: Breadcrumb Hierarchy + Page Title + Observable Context (28px) */}
      <div className="flex items-center justify-between px-4 h-7 min-h-[28px] border-b border-[#F0F0F0] text-xs min-w-0 overflow-hidden">
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          {/* Breadcrumb Hierarchy */}
          <button
            type="button"
            onClick={() => handleBreadcrumbClick('workspace')}
            className="hidden sm:inline text-[#5C5C5C] hover:text-[#1C1C1C] cursor-pointer transition-colors whitespace-nowrap bg-transparent border-0 p-0 text-xs font-sans"
          >
            Workspace
          </button>
          <ChevronRight className="hidden sm:inline w-3 h-3 text-[#8A8A8A] shrink-0" aria-hidden="true" />
          <button
            type="button"
            onClick={() => handleBreadcrumbClick('observables')}
            className="hidden sm:inline text-[#5C5C5C] hover:text-[#1C1C1C] cursor-pointer transition-colors whitespace-nowrap bg-transparent border-0 p-0 text-xs font-sans"
          >
            Observables
          </button>
          <ChevronRight className="hidden sm:inline w-3 h-3 text-[#8A8A8A] shrink-0" aria-hidden="true" />

          {/* Current Observable / Page Title */}
          <span
            data-testid="observable-title"
            className="text-[#1C1C1C] font-semibold whitespace-nowrap shrink-0"
          >
            {observableType}
          </span>

          <ChevronRight className="w-3 h-3 text-[#8A8A8A] shrink-0" aria-hidden="true" />

          {/* Atom Selection Context (Truncated on narrow viewports, never wraps) */}
          <span
            data-testid="selection-context"
            title={selectionContext}
            className="text-[11px] text-[#5C5C5C] whitespace-nowrap truncate max-w-[180px] sm:max-w-[300px] md:max-w-[440px] xl:max-w-[600px]"
          >
            {selectionContext}
          </span>
        </div>

        {/* Inspector toggle button for normal/compact views */}
        <button
          type="button"
          data-testid="toggle-inspector-btn"
          onClick={() => setInspectorOpen(!isInspectorOpen)}
          className="hidden md:flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium text-[#5C5C5C] hover:text-[#1C1C1C] hover:bg-[#F3F3F3] transition-colors cursor-pointer shrink-0"
          title={isInspectorOpen ? 'Collapse Right Inspector' : 'Expand Right Inspector'}
        >
          <span>{isInspectorOpen ? 'Inspector ‹' : 'Inspector ›'}</span>
        </button>
      </div>

      {/* Tier 2: Workspace Navigation Tabs (32px, never competes with breadcrumbs) */}
      <div className="flex items-center px-4 h-8 min-h-[32px] min-w-0">
        <nav
          data-testid="workspace-nav-tabs"
          role="tablist"
          aria-label="Workspace Views"
          className="flex items-center h-full space-x-1 min-w-0 overflow-x-auto scrollbar-none"
        >
          {WORKSPACE_TAB_KEYS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                role="tab"
                aria-selected={isActive}
                tabIndex={0}
                onClick={() => handleTabClick(tab)}
                className={`h-full flex items-center px-2.5 sm:px-3 text-xs tracking-normal whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#005FB8] interactive-press cursor-pointer ${
                  isActive
                    ? 'text-[#1C1C1C] font-semibold border-b-2 border-[#005FB8] bg-transparent'
                    : 'text-[#5C5C5C] font-normal hover:text-[#1C1C1C] hover:bg-[#F9F9F9] border-b-2 border-transparent'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
