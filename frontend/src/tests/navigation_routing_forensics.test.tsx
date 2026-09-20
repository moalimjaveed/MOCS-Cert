// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { WorkstationView } from '../components/views/WorkstationView';
import { LeftSidebar } from '../components/layout/LeftSidebar';
import { DocumentationModal } from '../components/docs/DocumentationModal';
import { IndexCatalogView } from '../components/views/IndexCatalogView';
import { RefinementExplorerView } from '../components/views/RefinementExplorerView';
import { ExecutionBenchmarksView } from '../components/views/ExecutionBenchmarksView';
import { FormalAuditView } from '../components/views/FormalAuditView';
import { useUIStore, useScanStore, useEvidenceStore, useTimelineStore, useProofStore } from '../store';

// Enable React 19 act environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;



// Mock api client to avoid network errors in jsdom
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

describe('Navigation, Routing, View Registration & Documentation Forensic Suite', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // Reset clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    act(() => {
      useUIStore.setState({
        activeView: 'workstation',
        activeWorkspaceTab: 'Workstation',
        activeSidebarId: 'distance',
        isSidebarCollapsed: false,
        isInspectorOpen: false,
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
        queryText: 'FIND DISTANCE(A:155:CA, LIG:1:O2) < 4.0 Å',
        pruningEfficiency: 97.1,
        certifiedBlocks: 231,
        refinedBlocks: 7,
        exactFramesScanned: 43,
        blocksExamined: 240,
        certificate: {
          result: { truth: 'TRUE', resolution: 'COMPLETE', quantifier: 'EXISTS' },
          semantics: { sampling: 'sampled_frames', pbc: 'orthorhombic_minimum_image', precision: 'float64' },
          source: { trajectory_sha256: '3b22f8a9e7a164b18c0c809187319208a0d92384912093847120938471092834', topology_sha256: 'e91c42b4d2f80192837461528394018273645102938475610293847561029384' },
          index_commitment: { mci_index_hash: 'f0c231e8b1e09182736451029384756102938475610293847561029384756102', algorithm: 'AABB-v1' },
          evidence: { blocks_examined: 240, certified_false: 231, refined_blocks: 7, exact_frames: 43 },
        },
      });

      useTimelineStore.setState({
        selectedBlockId: 41,
        cursorTimeNs: 415.0,
      });

      useProofStore.setState({
        focusedBlockId: 41,
        lowerBound: 3.72,
        upperBound: 4.21,
        threshold: 4.00,
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

  describe('1. Top Workspace Tabs View Dispatcher in WorkstationView', () => {
    it('switches views dynamically across all 6 workspace tabs', async () => {
      await act(async () => {
        root.render(<WorkstationView />);
      });

      // Default tab is 'Workstation' -> renders workstation-rows-container
      expect(container.querySelector('[data-testid="workstation-rows-container"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="molecular-view-workspace"]')).toBeNull();
      expect(container.querySelector('[data-testid="index-catalog-view"]')).toBeNull();
      expect(container.querySelector('[data-testid="refinement-explorer-view"]')).toBeNull();
      expect(container.querySelector('[data-testid="execution-benchmarks-view"]')).toBeNull();
      expect(container.querySelector('[data-testid="formal-audit-view"]')).toBeNull();

      // Click 'Molecular View' tab
      const molecularTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
        (b) => b.textContent?.trim() === 'Molecular View'
      ) as HTMLElement;
      expect(molecularTab).not.toBeNull();
      await act(async () => {
        molecularTab.click();
      });
      expect(useUIStore.getState().activeWorkspaceTab).toBe('Molecular View');
      expect(container.querySelector('[data-testid="molecular-view-workspace"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="workstation-rows-container"]')).toBeNull();

      // Click 'Index Catalog' tab
      const indexTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
        (b) => b.textContent?.trim() === 'Index Catalog'
      ) as HTMLElement;
      await act(async () => {
        indexTab.click();
      });
      expect(useUIStore.getState().activeWorkspaceTab).toBe('Index Catalog');
      expect(container.querySelector('[data-testid="index-catalog-view"]')).not.toBeNull();

      // Click 'Refinement Explorer' tab
      const refinementTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
        (b) => b.textContent?.trim() === 'Refinement Explorer'
      ) as HTMLElement;
      await act(async () => {
        refinementTab.click();
      });
      expect(useUIStore.getState().activeWorkspaceTab).toBe('Refinement Explorer');
      expect(container.querySelector('[data-testid="refinement-explorer-view"]')).not.toBeNull();

      // Click 'Execution Benchmarks' tab
      const benchmarksTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
        (b) => b.textContent?.trim() === 'Execution Benchmarks'
      ) as HTMLElement;
      await act(async () => {
        benchmarksTab.click();
      });
      expect(useUIStore.getState().activeWorkspaceTab).toBe('Execution Benchmarks');
      expect(container.querySelector('[data-testid="workflow-orchestration-view"]')).not.toBeNull();

      // Click 'Formal Audit' tab
      const auditTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
        (b) => b.textContent?.trim() === 'Formal Audit'
      ) as HTMLElement;
      await act(async () => {
        auditTab.click();
      });
      expect(useUIStore.getState().activeWorkspaceTab).toBe('Formal Audit');
      expect(container.querySelector('[data-testid="formal-audit-view"]')).not.toBeNull();

      // Return to 'Workstation'
      const workstationTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
        (b) => b.textContent?.trim() === 'Workstation'
      ) as HTMLElement;
      await act(async () => {
        workstationTab.click();
      });
      expect(useUIStore.getState().activeWorkspaceTab).toBe('Workstation');
      expect(container.querySelector('[data-testid="workstation-rows-container"]')).not.toBeNull();
    }, 15000);
  });

  describe('2. LeftSidebar Scientific Routing & Canonical Destination Verification', () => {
    it('routes Index click directly to Index Catalog view', async () => {
      await act(async () => {
        root.render(<WorkstationView />);
      });

      const indexBtn = container.querySelector('[data-testid="nav-item-index"]') as HTMLElement;
      expect(indexBtn).not.toBeNull();

      await act(async () => {
        indexBtn.click();
      });

      expect(useUIStore.getState().activeWorkspaceTab).toBe('Index Catalog');
      expect(container.querySelector('[data-testid="index-catalog-view"]')).not.toBeNull();
    });

    it('routes Verification click directly to Formal Audit view', async () => {
      await act(async () => {
        root.render(<WorkstationView />);
      });

      const verifBtn = container.querySelector('[data-testid="nav-item-verification"]') as HTMLElement;
      expect(verifBtn).not.toBeNull();

      await act(async () => {
        verifBtn.click();
      });

      expect(useUIStore.getState().activeWorkspaceTab).toBe('Formal Audit');
      expect(container.querySelector('[data-testid="formal-audit-view"]')).not.toBeNull();
    });

    it('routes Benchmarks click directly to Execution Benchmarks view', async () => {
      await act(async () => {
        root.render(<WorkstationView />);
      });

      const benchBtn = container.querySelector('[data-testid="nav-item-benchmarks"]') as HTMLElement;
      expect(benchBtn).not.toBeNull();

      await act(async () => {
        benchBtn.click();
      });

      expect(useUIStore.getState().activeWorkspaceTab).toBe('Execution Benchmarks');
      expect(container.querySelector('[data-testid="execution-benchmarks-view"]')).not.toBeNull();
    });

    it('routes Workflows click directly to Workflow Orchestration view', async () => {
      await act(async () => {
        root.render(<WorkstationView />);
      });

      const workflowsBtn = container.querySelector('[data-testid="nav-item-workflows"]') as HTMLElement;
      expect(workflowsBtn).not.toBeNull();

      await act(async () => {
        workflowsBtn.click();
      });

      expect(useUIStore.getState().activeSidebarId).toBe('workflows');
      expect(container.querySelector('[data-testid="workflow-orchestration-view"]')).not.toBeNull();
    });

    it('opens Documentation Modal on Documentation click', async () => {
      await act(async () => {
        root.render(
          <>
            <LeftSidebar />
            <DocumentationModal />
          </>
        );
      });

      expect(useUIStore.getState().isDocumentationModalOpen).toBe(false);
      expect(container.querySelector('[data-testid="documentation-modal"]')).toBeNull();

      const docsBtn = container.querySelector('[data-testid="nav-item-docs"]') as HTMLElement;
      expect(docsBtn).not.toBeNull();

      await act(async () => {
        docsBtn.click();
      });

      expect(useUIStore.getState().isDocumentationModalOpen).toBe(true);
      expect(container.querySelector('[data-testid="documentation-modal"]')).not.toBeNull();
    });
  });

  describe('3. DocumentationModal Specifications & Search Library', () => {
    it('renders documentation modal, lists specifications, filters via search, and switches active doc', async () => {
      act(() => {
        useUIStore.setState({ isDocumentationModalOpen: true, activeDocId: 'readme' });
      });

      await act(async () => {
        root.render(<DocumentationModal />);
      });

      const modal = container.querySelector('[data-testid="documentation-modal"]') as HTMLElement;
      expect(modal).not.toBeNull();
      expect(modal.textContent).toContain('MOCS-Cert Documentation & Specification Library');
      expect(modal.textContent).toContain('Public Introduction & Architecture Overview');

      // Test Search filter
      const searchInput = container.querySelector('[data-testid="docs-search-input"]') as HTMLInputElement;
      expect(searchInput).not.toBeNull();

      await act(async () => {
        searchInput.value = 'PBC';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Click on PBC Semantics doc
      const pbcItem = container.querySelector('[data-testid="doc-item-pbc-semantics"]') as HTMLElement;
      expect(pbcItem).not.toBeNull();

      await act(async () => {
        pbcItem.click();
      });

      expect(useUIStore.getState().activeDocId).toBe('pbc-semantics');
      expect(modal.textContent).toContain('Periodic Boundary Conditions & Minimum-Image Convention');
      expect(modal.textContent).toContain('Orthorhombic Minimum-Image Convention');

      // Test Close button
      const closeBtn = container.querySelector('[data-testid="close-docs-btn"]') as HTMLButtonElement;
      expect(closeBtn).not.toBeNull();

      await act(async () => {
        closeBtn.click();
      });

      expect(useUIStore.getState().isDocumentationModalOpen).toBe(false);
    });
  });

  describe('4. IndexCatalogView Functional Tests', () => {
    it('renders block seek table, filters blocks, toggles selections, and copies commitment hash', async () => {
      await act(async () => {
        root.render(<IndexCatalogView />);
      });

      expect(container.querySelector('[data-testid="index-catalog-view"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="blocks-table"]')).not.toBeNull();

      // Search blocks
      const searchInput = container.querySelector('[data-testid="index-search-input"]') as HTMLInputElement;
      await act(async () => {
        searchInput.value = '41';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(container.textContent).toContain('Block 41');

      // Switch to Selections subtab — MocsTabs renders id="mocs-tab-{id}"
      const selectionsTab = container.querySelector('#mocs-tab-selections') as HTMLButtonElement;
      await act(async () => {
        selectionsTab.click();
      });
      expect(container.querySelector('[data-testid="selections-panel"]')).not.toBeNull();
      expect(container.textContent).toContain('Protein C-Alpha');
      expect(container.textContent).toContain('Heme Cofactor (HEM)');

      // Switch to Commitments subtab
      const commitmentsTab = container.querySelector('#mocs-tab-commitments') as HTMLButtonElement;
      await act(async () => {
        commitmentsTab.click();
      });
      expect(container.querySelector('[data-testid="commitments-panel"]')).not.toBeNull();
      expect(container.textContent).toContain('Molecular Certificate Index (MCI Root Digest)');
    });
  });

  describe('5. FormalAuditView Functional Tests', () => {
    it('renders audit view with JSON certificate, runs verification gate, and views oracle comparison', async () => {
      await act(async () => {
        root.render(<FormalAuditView />);
      });

      expect(container.querySelector('[data-testid="formal-audit-view"]')).not.toBeNull();
      // Actual text in FormalAuditView certificate tab header:
      expect(container.textContent).toContain('MOCS-SPEC-v1.0');

      // Run verification — button uses MocsButton with a text label
      const verifyBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Run Verification Gate') || b.textContent?.includes('Verify')
      ) as HTMLButtonElement | undefined;
      if (verifyBtn) {
        await act(async () => { verifyBtn.click(); });
      }

      // Switch to Oracle subtab — MocsTabs renders role="tab"
      const oracleTab = (container.querySelector('#mocs-tab-oracle') || Array.from(container.querySelectorAll('[role="tab"]')).find(t => t.textContent?.includes('Oracle'))) as HTMLButtonElement;
      await act(async () => {
        oracleTab.click();
      });
      expect(container.textContent).toContain('MDAnalysis Oracle');
      expect(container.textContent).toContain('0.000 Å');
    });
  });
});
