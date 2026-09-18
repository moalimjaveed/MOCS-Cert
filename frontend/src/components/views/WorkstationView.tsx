import React, { useRef, useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';
import { LeftSidebar } from '../layout/LeftSidebar';
import { RightInspector } from '../layout/RightInspector';
import { MonacoQueryEditor } from '../editor/MonacoQueryEditor';
import { MolecularViewport } from '../viewer/MolecularViewport';
import { ExecutionPlanDAG } from '../plan/ExecutionPlanDAG';
import { TimelineLattice } from '../timeline/TimelineLattice';
import { BottomAnalysisPanel } from '../evidence/BottomAnalysisPanel';
import { WorkspaceNavBar } from '../layout/WorkspaceNavBar';
import { IndexCatalogView } from './IndexCatalogView';
import { RefinementExplorerView } from './RefinementExplorerView';
import { ExecutionBenchmarksView } from './ExecutionBenchmarksView';
import { FormalAuditView } from './FormalAuditView';
import { WorkflowOrchestrationView } from './WorkflowOrchestrationView';
import { useUIStore, useViewerStore } from '../../store';
import { getStructureMetadata } from '../../molecular/data/structureRegistry';
import { useMocsAnimation, gsap } from '../../motion';
import { OBSERVABLE_CONFIGS } from '../../navigation/navigationRegistry';

export interface WorkstationViewProps {
  observableType?: string;
  selectionContext?: string;
}

export const WorkstationView: React.FC<WorkstationViewProps> = ({
  observableType: propObservableType,
  selectionContext: propSelectionContext,
}) => {
  const { activeWorkspaceTab, setActiveWorkspaceTab, activeSidebarId } = useUIStore();
  const contentRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const molecularViewSlotRef = useRef<HTMLDivElement>(null);
  const [isStickyHeaderVisible, setStickyHeaderVisible] = useState(false);

  const activeStructureId = useViewerStore((s) => s.activeStructureId);
  const selectionA = useViewerStore((s) => s.selectionA);
  const selectionB = useViewerStore((s) => s.selectionB);
  const measuredDistance = useViewerStore((s) => s.measuredDistance);

  const currentStructureId = activeStructureId || '4HHB';
  const meta = getStructureMetadata(currentStructureId);
  const displayDist = measuredDistance > 0 ? measuredDistance.toFixed(2) : '33.80';

  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;

    const handleScroll = () => {
      // When user scrolls down past the query editor, display compact sticky molecular context
      setStickyHeaderVisible(mainEl.scrollTop > 120);
    };

    mainEl.addEventListener('scroll', handleScroll, { passive: true });
    return () => mainEl.removeEventListener('scroll', handleScroll);
  }, [activeWorkspaceTab]);

  useMocsAnimation(
    (ctx, isReduced) => {
      if (!contentRef.current) return;
      if (isReduced) {
        contentRef.current.style.opacity = '1';
        return;
      }
      ctx.add(() => {
        gsap.fromTo(
          contentRef.current,
          { opacity: 0, y: 4 },
          { opacity: 1, y: 0, duration: 0.16, ease: 'power2.out' }
        );
      });
    },
    { scope: contentRef, dependencies: [activeWorkspaceTab, activeSidebarId] }
  );

  const currentObsConfig = OBSERVABLE_CONFIGS[activeSidebarId] || OBSERVABLE_CONFIGS.distance;

  const observableType =
    propObservableType ?? currentObsConfig.label;

  const selectionContext =
    propSelectionContext ?? currentObsConfig.selectionContext;

  const isWorkflowActive = activeSidebarId === 'workflows';

  return (
    <div className="flex-1 flex w-full h-full overflow-hidden bg-[#F3F3F3] text-[#1C1C1C] font-sans relative">
      {/* 1. Left Explorer Sidebar (Canonical Domain Map) */}
      <LeftSidebar />

      {/* 2. Main Central Workstation Workspace */}
      <main ref={mainRef} data-testid="workstation-main-scroll" className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto bg-[#F3F3F3]">
        {/* Secondary Workspace Navigation Bar */}
        <WorkspaceNavBar
          observableType={observableType}
          selectionContext={selectionContext}
          activeTab={activeWorkspaceTab}
          onTabChange={(tab) => setActiveWorkspaceTab(tab as any)}
        />

        {/* Sticky Molecular Context Header (Principle 20) */}
        {activeWorkspaceTab === 'Workstation' && isStickyHeaderVisible && (
          <div
            data-testid="sticky-molecular-context"
            className="sticky top-0 z-30 w-full h-8 px-4 bg-[#FFFFFF] border-b border-[#E5E5E5] shadow-xs flex items-center justify-between text-xs font-sans select-none"
          >
            <div className="flex items-center gap-2 min-w-0 truncate">
              <span className="font-bold text-[#005FB8] shrink-0">{currentStructureId}</span>
              <span className="text-[#CBD5E1]" aria-hidden="true">·</span>
              <span className="font-semibold text-[#1C1C1C] truncate">{meta?.name || 'Human Deoxyhemoglobin Tetramer (α₂β₂)'}</span>
              <span className="text-[#CBD5E1]" aria-hidden="true">·</span>
              <span className="text-[#64748B] font-mono text-[11px] truncate">
                {selectionA && selectionB ? `${selectionA} ↔ ${selectionB}` : selectionContext}
              </span>
              <span className="text-[#CBD5E1]" aria-hidden="true">·</span>
              <span className="font-semibold text-[#005FB8] tabular-nums shrink-0">{displayDist} Å</span>
            </div>
            <button
              type="button"
              onClick={() => {
                molecularViewSlotRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              className="h-6 px-2.5 flex items-center gap-1 rounded-[3px] bg-white border border-[#CBD5E1] hover:bg-[#F8FAFC] text-[#1C1C1C] text-[11px] font-medium transition-colors cursor-pointer shrink-0"
            >
              <span>Viewer</span>
              <ChevronUp className="w-3 h-3 text-[#64748B]" />
            </button>
          </div>
        )}

        {/* View Dispatcher based on activeSidebarId & activeWorkspaceTab */}
        <div ref={contentRef} key={`${activeSidebarId}-${activeWorkspaceTab}`} className="flex-1 flex flex-col min-w-0">
          {isWorkflowActive ? (
            <div className="flex-1 flex flex-col min-w-0">
              <WorkflowOrchestrationView />
            </div>
          ) : (
            <>
              {activeWorkspaceTab === 'Workstation' && (
                <div data-testid="workstation-rows-container" className="p-2.5 sm:p-3.5 space-y-3 flex-1 flex flex-col min-w-0">
                  {/* Row 1: MolQL Query Editor & Parameters */}
                  <div className="shrink-0">
                    <MonacoQueryEditor />
                  </div>

                  {/* Row 2: Molecular View (hero ~63%) & Execution Plan DAG (~37%) */}
                  <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,63%)_minmax(0,37%)] gap-3.5 xl:min-h-[560px] shrink-0">
                    <div ref={molecularViewSlotRef} className="min-h-[540px] xl:min-h-[560px] xl:h-full flex flex-col">
                      <MolecularViewport />
                    </div>
                    <div className="min-h-[500px] xl:min-h-[560px] xl:h-full flex flex-col">
                      <ExecutionPlanDAG
                        observableType={observableType}
                        selectionContext={selectionContext}
                      />
                    </div>
                  </div>

                  {/* Row 3: Trajectory Timeline */}
                  <div className="shrink-0">
                    <TimelineLattice />
                  </div>

                  {/* Row 4: Bottom Analysis Panel */}
                  <div className="shrink-0 pb-3">
                    <BottomAnalysisPanel />
                  </div>
                </div>
              )}

              {activeWorkspaceTab === 'Molecular View' && (
                <div data-testid="molecular-view-workspace" className="p-2.5 sm:p-3.5 flex-1 flex flex-col min-w-0 h-full">
                  <div className="flex-1 min-h-[560px] xl:min-h-[700px] flex flex-col">
                    <MolecularViewport />
                  </div>
                </div>
              )}

              {activeWorkspaceTab === 'Index Catalog' && <IndexCatalogView />}

              {activeWorkspaceTab === 'Refinement Explorer' && <RefinementExplorerView />}

              {activeWorkspaceTab === 'Execution Benchmarks' && <ExecutionBenchmarksView />}

              {activeWorkspaceTab === 'Formal Audit' && <FormalAuditView />}
            </>
          )}
        </div>
      </main>

      {/* 3. Right Inspector Panel */}
      <RightInspector />
    </div>
  );
};
