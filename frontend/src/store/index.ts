export * from './useScanStore';
export * from './useViewerStore';
export * from './useTimelineStore';
export * from './useEvidenceStore';
export * from './useProofStore';
export * from './useUIStore';
export * from './useRendererStore';

import { useScanStore } from './useScanStore';
import { useEvidenceStore } from './useEvidenceStore';
import { useProofStore } from './useProofStore';
import { useTimelineStore } from './useTimelineStore';
import { useViewerStore } from './useViewerStore';
import { useUIStore } from './useUIStore';
import { useRendererStore } from './useRendererStore';

if (typeof window !== 'undefined') {
  (window as any).__mocs_scanStore = useScanStore;
  (window as any).__mocs_viewerStore = useViewerStore;
  (window as any).__mocs_evidenceStore = useEvidenceStore;
  (window as any).__mocs_proofStore = useProofStore;
  (window as any).__mocs_timelineStore = useTimelineStore;
  (window as any).__mocs_uiStore = useUIStore;
  (window as any).__mocs_rendererStore = useRendererStore;
}

