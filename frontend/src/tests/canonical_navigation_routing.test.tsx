// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { LeftSidebar } from '../components/layout/LeftSidebar';
import { WorkspaceNavBar } from '../components/layout/WorkspaceNavBar';
import { WorkstationView } from '../components/views/WorkstationView';
import { IndexCatalogView } from '../components/views/IndexCatalogView';
import { FormalAuditView } from '../components/views/FormalAuditView';
import { ExecutionBenchmarksView } from '../components/views/ExecutionBenchmarksView';
import { WorkflowOrchestrationView } from '../components/views/WorkflowOrchestrationView';
import {
  parseRoute,
  navigateTo,
  initMocsRouter,
  applyRouteToStore,
} from '../navigation/router';
import {
  CANONICAL_NAVIGATION_SECTIONS,
  OBSERVABLE_CONFIGS,
} from '../navigation/navigationRegistry';
import {
  useUIStore,
  useScanStore,
  useEvidenceStore,
  useViewerStore,
  useTimelineStore,
  useProofStore,
} from '../store';

// Enable React 19 act environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;



// Mock API client
vi.mock('../api/client', () => ({
  fetchBlocks: vi.fn().mockResolvedValue([]),
  fetchTrajectoryMetadata: vi.fn().mockResolvedValue({}),
  fetchBenchmarks: vi.fn().mockResolvedValue([]),
  verifyCertificate: vi.fn().mockResolvedValue({
    valid: true,
    sha256_sound: true,
    verification_time_ms: 10.2,
  }),
}));

describe('Canonical Navigation, Information Architecture, and Routing Repair Forensic Suite', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // Reset window location
    delete (window as any).location;
    window.location = new URL('http://localhost:3000/') as any;

    act(() => {
      useUIStore.setState({
        activeView: 'workstation',
        activeWorkspaceTab: 'Workstation',
        activeSidebarId: 'distance',
        isSidebarCollapsed: false,
        isInspectorOpen: true,
        isMobileNavOpen: false,
        activeEvidenceTab: 'certificate',
        isAuditorModalOpen: false,
        isCommandPaletteOpen: false,
        isDocumentationModalOpen: false,
        activeDocId: 'readme',
      });

      useScanStore.setState({
        trajectoryId: 'synth_500f.xtc',
        topologyId: 'synth_500f.gro',
        totalFrames: 500,
        timestepPs: 10,
        atomCount: 10,
        pbcMode: 'orthorhombic_minimum_image',
      });

      useEvidenceStore.setState({
        operator: 'DISTANCE-v1',
        queryText: 'FIND DISTANCE(A:155:CA, LIG:1:O2) < 4.0 Å',
        certificate: {
          result: { truth: 'TRUE', resolution: 'COMPLETE', quantifier: 'EXISTS' },
          source: { trajectory_sha256: 'mock_traj_hash', topology_sha256: 'mock_topo_hash' },
        } as any,
      });

      useViewerStore.setState({
        selectionA: 'A:155:CA',
        selectionB: 'LIG:1:O2',
      });

      useTimelineStore.setState({
        selectedBlockId: 41,
      });
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  describe('1. Information Architecture & No Duplicate Destinations', () => {
    it('renders exactly 8 canonical domain groups in the sidebar', async () => {
      await act(async () => {
        root.render(<LeftSidebar />);
      });

      const rail = container.querySelector('[data-testid="left-navigation-rail"]');
      expect(rail).not.toBeNull();

      expect(container.querySelector('[data-testid="nav-group-project"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="nav-group-dataset"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="nav-group-observables"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="nav-group-index"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="nav-group-verification"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="nav-group-benchmarks"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="nav-group-workflows"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="nav-group-help"]')).not.toBeNull();
    });

    it('enforces ONE canonical destination for Index with zero duplicate sidebar buttons', async () => {
      await act(async () => {
        root.render(<LeftSidebar />);
      });

      const indexGroup = container.querySelector('[data-testid="nav-group-index"]');
      expect(indexGroup).not.toBeNull();

      // Only ONE navigation button inside the Index group
      const indexButtons = indexGroup?.querySelectorAll('button[role="menuitem"]');
      expect(indexButtons?.length).toBe(1);
      expect(indexButtons?.[0]?.getAttribute('data-testid')).toBe('nav-item-index');
    });

    it('enforces ONE canonical destination for Benchmarks with zero duplicate sidebar buttons', async () => {
      await act(async () => {
        root.render(<LeftSidebar />);
      });

      const benchGroup = container.querySelector('[data-testid="nav-group-benchmarks"]');
      expect(benchGroup).not.toBeNull();

      const benchButtons = benchGroup?.querySelectorAll('button[role="menuitem"]');
      expect(benchButtons?.length).toBe(1);
      expect(benchButtons?.[0]?.getAttribute('data-testid')).toBe('nav-item-benchmarks');
    });

    it('enforces ONE canonical destination for Workflows with zero duplicate sidebar buttons', async () => {
      await act(async () => {
        root.render(<LeftSidebar />);
      });

      const workflowsGroup = container.querySelector('[data-testid="nav-group-workflows"]');
      expect(workflowsGroup).not.toBeNull();

      const wfButtons = workflowsGroup?.querySelectorAll('button[role="menuitem"]');
      expect(wfButtons?.length).toBe(1);
      expect(wfButtons?.[0]?.getAttribute('data-testid')).toBe('nav-item-workflows');
    });

    it('enforces ONE canonical destination for Verification with zero duplicate sidebar buttons', async () => {
      await act(async () => {
        root.render(<LeftSidebar />);
      });

      const verifGroup = container.querySelector('[data-testid="nav-group-verification"]');
      expect(verifGroup).not.toBeNull();

      const verifButtons = verifGroup?.querySelectorAll('button[role="menuitem"]');
      expect(verifButtons?.length).toBe(1);
      expect(verifButtons?.[0]?.getAttribute('data-testid')).toBe('nav-item-verification');
    });
  });

  describe('2. Canonical Routing & URL as Authoritative Source of Truth', () => {
    it('parses observable deep routes and synchronizes application state', () => {
      const parsed = parseRoute('/observables/contact/refinement');
      expect(parsed.domain).toBe('observables');
      expect(parsed.sidebarId).toBe('contact');
      expect(parsed.workspaceTab).toBe('Refinement Explorer');
      expect(parsed.observableId).toBe('contact');

      applyRouteToStore(parsed);

      expect(useUIStore.getState().activeSidebarId).toBe('contact');
      expect(useUIStore.getState().activeWorkspaceTab).toBe('Refinement Explorer');
      expect(useEvidenceStore.getState().operator).toBe('CONTACT-v1');
      expect(useEvidenceStore.getState().queryText).toContain('CONTACT');
      expect(useViewerStore.getState().selectionA).toBe('PHE89');
      expect(useViewerStore.getState().selectionB).toBe('LIG');
      expect(useTimelineStore.getState().selectedBlockId).toBe(85);
    });

    it('parses verification deep route and restores formal audit subtab', () => {
      const parsed = parseRoute('/verification/oracle');
      expect(parsed.domain).toBe('verification');
      expect(parsed.sidebarId).toBe('verification');
      expect(parsed.workspaceTab).toBe('Formal Audit');
      expect(parsed.subtab).toBe('oracle');

      applyRouteToStore(parsed);

      expect(useUIStore.getState().activeSidebarId).toBe('verification');
      expect(useUIStore.getState().activeWorkspaceTab).toBe('Formal Audit');
      expect(useUIStore.getState().activeEvidenceTab).toBe('ref');
    });

    it('parses index deep route with subtabs', () => {
      const parsed = parseRoute('/index/bounds');
      expect(parsed.domain).toBe('index');
      expect(parsed.sidebarId).toBe('index');
      expect(parsed.workspaceTab).toBe('Index Catalog');
      expect(parsed.subtab).toBe('bounds');

      applyRouteToStore(parsed);

      expect(useUIStore.getState().activeSidebarId).toBe('index');
      expect(useUIStore.getState().activeWorkspaceTab).toBe('Index Catalog');
      expect(useUIStore.getState().activeEvidenceTab).toBe('math');
    });
  });

  describe('3. Browser Refresh Invariant (Zero-Loss Location Preservation)', () => {
    it('preserves deep observable route upon simulated browser refresh', () => {
      // User is at deep URL: /observables/hbond/benchmarks
      window.location = new URL('http://localhost:3000/observables/hbond/benchmarks') as any;

      // Simulate browser refresh: unbind previous listeners, re-initialize router
      const unbind = initMocsRouter();

      // State MUST match the deep route, NEVER resetting to default Distance / Workstation
      expect(useUIStore.getState().activeSidebarId).toBe('hbond');
      expect(useUIStore.getState().activeWorkspaceTab).toBe('Execution Benchmarks');
      expect(useEvidenceStore.getState().operator).toBe('HBOND-v1');
      expect(useViewerStore.getState().selectionA).toBe('TYR151:OH');
      expect(useViewerStore.getState().selectionB).toBe('LIG:1:O2');
      expect(useTimelineStore.getState().selectedBlockId).toBe(25);

      unbind();
    });

    it('preserves verification deep link upon simulated browser refresh', () => {
      window.location = new URL('http://localhost:3000/verification/invariants') as any;

      const unbind = initMocsRouter();

      expect(useUIStore.getState().activeSidebarId).toBe('verification');
      expect(useUIStore.getState().activeWorkspaceTab).toBe('Formal Audit');
      expect(useUIStore.getState().activeEvidenceTab).toBe('math');

      unbind();
    });

    it('preserves workflows deep link upon simulated browser refresh', () => {
      window.location = new URL('http://localhost:3000/workflows/discovery') as any;

      const unbind = initMocsRouter();

      expect(useUIStore.getState().activeSidebarId).toBe('workflows');

      unbind();
    });
  });

  describe('4. Contextual Tabs Preserve Selected Observable Context', () => {
    it('keeps PHE89 ↔ LIG constant while switching contextual views in WorkspaceNavBar', async () => {
      act(() => {
        navigateTo('/observables/contact');
      });

      await act(async () => {
        root.render(
          <WorkspaceNavBar
            observableType="Contact"
            selectionContext="PHE89 ↔ LIG"
          />
        );
      });

      expect(container.querySelector('[data-testid="observable-title"]')?.textContent).toBe('Contact');
      expect(container.querySelector('[data-testid="selection-context"]')?.textContent).toBe('PHE89 ↔ LIG');

      // Switch tab to 'Formal Audit'
      const auditTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
        (b) => b.textContent?.trim() === 'Formal Audit'
      ) as HTMLElement;

      await act(async () => {
        auditTab.click();
      });

      // Observable context MUST still be contact
      expect(useEvidenceStore.getState().operator).toBe('CONTACT-v1');
      expect(useUIStore.getState().activeWorkspaceTab).toBe('Formal Audit');
      expect(window.location.pathname).toBe('/observables/contact/audit');
    });
  });

  describe('5. Browser History Navigation (Back / Forward)', () => {
    it('synchronizes state when popstate event fires', () => {
      const unbind = initMocsRouter();

      // Navigate to contact
      navigateTo('/observables/contact');
      expect(useUIStore.getState().activeSidebarId).toBe('contact');

      // Navigate to index
      navigateTo('/index');
      expect(useUIStore.getState().activeSidebarId).toBe('index');

      // Simulate Browser Back: set location to contact and fire popstate
      window.location = new URL('http://localhost:3000/observables/contact') as any;
      window.dispatchEvent(new PopStateEvent('popstate'));

      expect(useUIStore.getState().activeSidebarId).toBe('contact');
      expect(useEvidenceStore.getState().operator).toBe('CONTACT-v1');

      unbind();
    });
  });
});
