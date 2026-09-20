/**
 * MOCS-Cert Authoritative Routing Engine
 *
 * Enforces:
 * - URL is the single authoritative source of truth.
 * - Refresh preserves exact location, observable context, and contextual subtabs.
 * - History (Back/Forward) works seamlessly.
 * - Seamless support for both HTML5 history pathnames and hash fallbacks.
 */

import {
  OBSERVABLE_CONFIGS,
  WORKSPACE_TAB_SLUGS,
  SLUG_TO_WORKSPACE_TAB,
  WorkspaceTabKey,
} from './navigationRegistry';
import { useUIStore, useScanStore, useEvidenceStore, useViewerStore, useTimelineStore } from '../store';

export interface ParsedRoute {
  rawPath: string;
  domain:
    | 'project'
    | 'dataset'
    | 'observables'
    | 'index'
    | 'verification'
    | 'benchmarks'
    | 'workflows'
    | 'explore';
  sidebarId: string;
  workspaceTab: WorkspaceTabKey;
  observableId?: 'distance' | 'contact' | 'hbond';
  subtab?: string;
  searchParams: URLSearchParams;
}

export function getCurrentRawPath(): { pathname: string; search: string } {
  if (typeof window === 'undefined') {
    return { pathname: '/', search: '' };
  }

  // Check hash first: e.g. "#/observables/distance" or "#exploration"
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (hash) {
    if (hash === 'exploration' || hash === 'explore') {
      return { pathname: '/explore', search: '' };
    }
    const [pathPart, searchPart] = hash.split('?');
    const cleanPath = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
    return { pathname: cleanPath, search: searchPart ? `?${searchPart}` : '' };
  }

  return {
    pathname: window.location.pathname || '/',
    search: window.location.search || '',
  };
}

export function parseRoute(pathname: string, searchStr = ''): ParsedRoute {
  const searchParams = new URLSearchParams(searchStr);
  const normalized = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  const explicitSubtab = searchParams.get('subtab') || searchParams.get('tab') || undefined;

  // 1. Explore dual-view
  if (normalized === '/explore' || normalized === '/exploration') {
    return {
      rawPath: normalized,
      domain: 'explore',
      sidebarId: 'experiment',
      workspaceTab: 'Workstation',
      subtab: explicitSubtab,
      searchParams,
    };
  }

  // 2. Project / Experiments
  if (normalized === '/' || normalized.startsWith('/experiments') || normalized === '/project') {
    return {
      rawPath: normalized,
      domain: 'project',
      sidebarId: 'experiment',
      workspaceTab: 'Workstation',
      observableId: 'distance',
      subtab: explicitSubtab,
      searchParams,
    };
  }

  // 3. Dataset — /dataset, /dataset/trajectory, /dataset/topology all canonical to /dataset
  if (normalized.startsWith('/dataset')) {
    return {
      rawPath: normalized,
      domain: 'dataset',
      sidebarId: 'dataset',
      workspaceTab: 'Index Catalog',
      subtab: 'dataset',
      searchParams,
    };
  }

  // 4. Observables (/observables/:type/[:tab])
  if (normalized.startsWith('/observables')) {
    const parts = normalized.split('/').filter(Boolean); // ['observables', ':type', ':tab?']
    const obsIdRaw = parts[1] || 'distance';
    const obsId: 'distance' | 'contact' | 'hbond' =
      obsIdRaw === 'contact' ? 'contact' : obsIdRaw === 'hbond' ? 'hbond' : 'distance';

    const tabSlug = parts[2] || 'workstation';
    const workspaceTab = SLUG_TO_WORKSPACE_TAB[tabSlug] || 'Workstation';

    return {
      rawPath: normalized,
      domain: 'observables',
      sidebarId: obsId,
      workspaceTab,
      observableId: obsId,
      subtab: explicitSubtab,
      searchParams,
    };
  }

  // 5. Standalone Domain Workspaces
  if (normalized.startsWith('/index')) {
    const parts = normalized.split('/').filter(Boolean);
    const sub = parts[1] || explicitSubtab;
    return {
      rawPath: normalized,
      domain: 'index',
      sidebarId: 'index',
      workspaceTab: 'Index Catalog',
      subtab: sub,
      searchParams,
    };
  }

  if (normalized.startsWith('/verification') || normalized.startsWith('/audit') || normalized.startsWith('/certificates')) {
    const parts = normalized.split('/').filter(Boolean);
    const sub = parts[1] || explicitSubtab;
    return {
      rawPath: normalized,
      domain: 'verification',
      sidebarId: 'verification',
      workspaceTab: 'Formal Audit',
      subtab: sub,
      searchParams,
    };
  }

  if (normalized.startsWith('/benchmarks') || normalized.startsWith('/benchmark')) {
    const parts = normalized.split('/').filter(Boolean);
    const sub = parts[1] || explicitSubtab;
    return {
      rawPath: normalized,
      domain: 'benchmarks',
      sidebarId: 'benchmarks',
      workspaceTab: 'Execution Benchmarks',
      subtab: sub,
      searchParams,
    };
  }

  if (normalized.startsWith('/workflows') || normalized.startsWith('/workflow')) {
    const parts = normalized.split('/').filter(Boolean);
    const sub = parts[1] || explicitSubtab;
    return {
      rawPath: normalized,
      domain: 'workflows',
      sidebarId: 'workflows',
      workspaceTab: 'Execution Benchmarks', // Or Workflows view
      subtab: sub,
      searchParams,
    };
  }

  // Default fallback
  return {
    rawPath: normalized,
    domain: 'project',
    sidebarId: 'experiment',
    workspaceTab: 'Workstation',
    observableId: 'distance',
    subtab: explicitSubtab,
    searchParams,
  };
}

/**
 * Synchronize all Zustand application stores with the authoritative parsed route.
 */
export function applyRouteToStore(route: ParsedRoute) {
  const uiStore = useUIStore.getState();
  const evidenceStore = useEvidenceStore.getState();
  const viewerStore = useViewerStore.getState();
  const timelineStore = useTimelineStore.getState();

  // 1. Exploration vs Workstation main viewport
  if (route.domain === 'explore') {
    if (uiStore.activeView !== 'exploration') {
      uiStore.setActiveView('exploration');
    }
    return;
  } else if (uiStore.activeView !== 'workstation') {
    uiStore.setActiveView('workstation');
  }

  // 2. Active Sidebar selection
  if (uiStore.activeSidebarId !== route.sidebarId) {
    uiStore.setActiveSidebarId(route.sidebarId);
  }

  // 3. Active Workspace Tab
  if (uiStore.activeWorkspaceTab !== route.workspaceTab) {
    uiStore.setActiveWorkspaceTab(route.workspaceTab);
  }

  // 4. Observable Context
  if (route.observableId && OBSERVABLE_CONFIGS[route.observableId]) {
    const cfg = OBSERVABLE_CONFIGS[route.observableId];
    if (evidenceStore.operator !== cfg.operator) {
      useEvidenceStore.setState({
        operator: cfg.operator,
        queryText: cfg.queryText,
      });
      useViewerStore.setState({
        selectionA: cfg.selectionA,
        selectionB: cfg.selectionB,
      });
      if (timelineStore.selectedBlockId !== cfg.defaultBlockId) {
        timelineStore.selectBlock(cfg.defaultBlockId);
      }
    }
  }

  // 5. Subtabs / Evidence Tabs
  if (route.domain === 'index') {
    if (route.subtab === 'bounds') {
      uiStore.setActiveEvidenceTab('math');
    } else {
      uiStore.setActiveEvidenceTab('lattice');
    }
  } else if (route.domain === 'verification') {
    if (route.subtab === 'oracle' || route.subtab === 'ref_comp') {
      uiStore.setActiveEvidenceTab('ref');
    } else if (route.subtab === 'invariants' || route.subtab === 'evidence') {
      uiStore.setActiveEvidenceTab('math');
    } else {
      uiStore.setActiveEvidenceTab('certificate');
    }
  } else if (route.domain === 'benchmarks') {
    if (route.subtab === 'workload') {
      uiStore.setActiveEvidenceTab('workload');
    } else {
      uiStore.setActiveEvidenceTab('benchmarks');
    }
  }
}

/**
 * Navigate to a canonical URL, update browser history, and synchronize stores.
 */
export function navigateTo(
  to: string,
  options: { replace?: boolean; skipHistory?: boolean } = {}
) {
  if (typeof window === 'undefined') return;

  const current = getCurrentRawPath();
  const fullTarget = to.startsWith('/') || to.startsWith('#') ? to : `/${to}`;

  // Decide whether to push/replace
  if (!options.skipHistory) {
    const isHashMode = window.location.hash.startsWith('#/');
    if (isHashMode) {
      const targetHash = `#${fullTarget.replace(/^#/, '')}`;
      if (window.location.hash !== targetHash) {
        if (options.replace) {
          window.location.replace(targetHash);
        } else {
          window.location.hash = targetHash;
        }
      }
    } else {
      if (options.replace) {
        window.history.replaceState(null, '', fullTarget);
      } else {
        window.history.pushState(null, '', fullTarget);
      }
      try {
        const pathOnly = fullTarget.split('?')[0];
        if (window.location.pathname !== pathOnly) {
          (window.location as any).pathname = pathOnly;
        }
      } catch {
        // ignore if read-only in real browser
      }
    }
  }

  const parsed = parseRoute(fullTarget.split('?')[0], fullTarget.split('?')[1] || '');
  applyRouteToStore(parsed);

  // Dispatch navigation event for subscribers
  window.dispatchEvent(new CustomEvent('mocs-navigation', { detail: parsed }));
}

/**
 * Hook or initialization listener to bind window popstate / hashchange events.
 */
export function initMocsRouter(): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleLocationChange = () => {
    const { pathname, search } = getCurrentRawPath();
    const route = parseRoute(pathname, search);
    applyRouteToStore(route);
  };

  // Initial synchronization on load
  handleLocationChange();

  window.addEventListener('popstate', handleLocationChange);
  window.addEventListener('hashchange', handleLocationChange);

  return () => {
    window.removeEventListener('popstate', handleLocationChange);
    window.removeEventListener('hashchange', handleLocationChange);
  };
}
