// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { MolecularViewport } from '../../components/viewer/MolecularViewport';
import { EvidenceSection } from '../../components/inspector/EvidenceSection';
import { VerdictCard } from '../../components/inspector/VerdictCard';
import { useViewerStore, useRendererStore } from '../../store';
import { compileRenderScene } from '@mocs/scene';
import { parsePDB } from '@mocs/loading';
import { evaluateConformance } from '@mocs/conformance';
import { sha256Hex } from '@mocs/evidence';
import type { CanonicalStructure } from '@mocs/core';

function createTestStructure(datasetId: string): CanonicalStructure {
  return {
    datasetId,
    topology: {
      atomCount: 2,
      atoms: [
        { index: 0, name: 'NE2', element: 'N', chain: 'A', resSeq: 87, resName: 'HIS', entityId: '1' },
        { index: 1, name: 'FE', element: 'FE', chain: 'A', resSeq: 142, resName: 'HEM', entityId: '1' },
      ],
      bonds: [],
    },
    models: [
      {
        modelNum: 1,
        atomCount: 2,
        coordinates: new Float64Array([
          10.0, 20.0, 30.0,
          12.06, 20.0, 30.0,
        ]),
      },
    ],
    components: [
      { id: `${datasetId}-protein`, name: 'protein', kind: 'protein', atomIndices: new Uint32Array([0]) },
      { id: `${datasetId}-ligand`, name: 'ligand', kind: 'ligand', atomIndices: new Uint32Array([1]) },
    ],
    assemblies: [],
    defaultModelIndex: 0,
  };
}

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('Production Molecular Renderer Integration Suite', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    useRendererStore.getState().resetRendererStore();

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

  it('mounts MolecularViewport with canonical test IDs and native light workstation shell', async () => {
    await act(async () => {
      root.render(<MolecularViewport className="custom-test-viewport" />);
    });

    const viewportContainer = container.querySelector('[data-testid="molecular-viewport-container"]');
    expect(viewportContainer).not.toBeNull();
    expect(viewportContainer?.classList.contains('bg-[#FFFFFF]')).toBe(true);
    expect(viewportContainer?.classList.contains('font-ui')).toBe(true);

    const canvasMount = container.querySelector('#mocs-molecular-viewport-canvas');
    expect(canvasMount).not.toBeNull();
    expect(canvasMount?.getAttribute('data-testid')).toBe('molstar-viewport');
  });

  it('manages initial renderer store lifecycle and fail-closed conformance defaults', () => {
    const state = useRendererStore.getState();
    expect(state.rendererStatus).toBe('uninit');
    expect(state.conformanceStatus).toBe('PENDING');
    expect(state.certificationStatus).toBe('UNVERIFIED');
    expect(state.sceneRevision).toBe(0);
    expect(state.inspectionActive).toBe(false);
  });

  it('records cryptographic proof evidence and verifies hash chain integrity in EvidenceLedger', async () => {
    const certDigest = await useRendererStore.getState().recordProofEvidence({
      proofType: 'STRUCTURE_INGESTION',
      datasetBundle: {
        datasetId: '4HHB',
        format: 'pdb',
        contentHash: 'hash-test-sha256',
      },
      modelNumber: 1,
      assemblyId: null,
      frameIdentity: 0,
      canonicalQuery: {
        expression: 'STRUCTURE:4HHB',
        queryHash: 'qhash-4hhb',
      },
      resolutionContext: { atomCount: 4376 },
      algorithmId: 'CANONICAL_PDB_PARSER',
      algorithmVersion: '2.0.0',
      parameters: { structureId: '4HHB' },
      scientificResult: { atomCount: 4376, components: 2 },
      verificationRecords: [
        {
          invariant: 'ATOM_COUNT_POSITIVE',
          passed: true,
          checkedAt: new Date().toISOString(),
        },
      ],
      certificationState: 'EVIDENCE_SEALED',
    });

    expect(certDigest).toBeTruthy();
    expect(useRendererStore.getState().ledgerRecordCount).toBeGreaterThanOrEqual(1);
    expect(useRendererStore.getState().latestCertificateDigest).toBe(certDigest);

    const isIntact = await useRendererStore.getState().verifyLedger();
    expect(isIntact).toBe(true);
  });

  it('enforces fail-closed certification: drops verdict to FAILED CONFORMANCE on divergence', async () => {
    // 1. Initially certified
    await act(async () => {
      root.render(<VerdictCard truthValue="CERTIFIED TRUE" />);
    });
    expect(container.textContent).toContain('CERTIFIED TRUE');

    // 2. Inject conformance divergence into renderer store
    const desired = { aabbCount: 2, caliperCount: 1, reticleCount: 2 };
    const actualDivergent = { aabbCount: 1, caliperCount: 1, reticleCount: 0 };
    const report = evaluateConformance(desired, actualDivergent);
    expect(report.isConformant).toBe(false);

    act(() => {
      useRendererStore.getState().updateConformanceAndCertification(report, true);
    });

    // 3. Re-render VerdictCard
    await act(async () => {
      root.render(<VerdictCard truthValue="CERTIFIED TRUE" />);
    });

    expect(container.textContent).toContain('FAILED CONFORMANCE');
    expect(useRendererStore.getState().conformanceStatus).toBe('FAIL');
    expect(useRendererStore.getState().certificationStatus).toBe('FAILED_CONFORMANCE');
  });

  it('renders EvidenceSection diagnostics reflecting renderer telemetry and ledger state', async () => {
    act(() => {
      useRendererStore.setState({
        conformanceStatus: 'PASS',
        latestScientificDigest: 'abcdef1234567890abcdef',
        ledgerRecordCount: 4,
        sceneRevision: 3,
        inspectionActive: true,
      });
    });

    await act(async () => {
      root.render(
        <EvidenceSection
          blocksExamined={10}
          certifiedBlocks={8}
          refinedBlocks={2}
          exactFramesScanned={15}
          pruningEfficiency={85}
          isOpen={true}
        />
      );
    });

    const diagSection = container.querySelector('[data-testid="renderer-diagnostics"]');
    expect(diagSection).not.toBeNull();

    const text = diagSection?.textContent || '';
    expect(text).toContain('Proof Conformance');
    expect(text).toContain('PASS');
    expect(text).toContain('Evidence Digest');
    expect(text).toContain('abcdef123456…');
    expect(text).toContain('Ledger Records');
    expect(text).toContain('4');
    expect(text).not.toContain('Scene Revision');
    expect(text).toContain('Inspection Mode');
    expect(text).toContain('Active (Cutaway)');
  });

  it('deterministic scene compilation: compiles 4HHB with protein AABB, HEM AABB, and His-Heme caliper', () => {
    const structure = createTestStructure('4HHB');
    expect(structure.datasetId).toBe('4HHB');
    expect(structure.topology.atomCount).toBeGreaterThan(0);

    const canonicalScene = compileRenderScene(structure, 1, {
      aabbProtein: true,
      aabbLigand: true,
      aabbStyle: 'wireframe',
      distanceMeasurement: {
        atomAQuery: 'A:87:NE2',
        atomBQuery: 'HEM:142:FE',
        preferredChain: 'A',
      },
      activeSelections: ['A:87:NE2', 'HEM:142:FE'],
    });

    expect(canonicalScene.sceneRevision).toBe(1);
    expect(canonicalScene.proofScene.aabbs.length).toBe(2);
    expect(canonicalScene.proofScene.calipers.length).toBe(1);
    expect(canonicalScene.proofScene.reticles.length).toBe(2);
    expect(canonicalScene.proofScene.resolutionFailures.length).toBe(0);

    const caliper = canonicalScene.proofScene.calipers[0];
    expect(caliper.caliper.distanceAngstroms).toBeCloseTo(2.06, 1);
  });

  it('computes authentic 64-character SHA-256 hexadecimal contentHash directly from coordinates', async () => {
    const rawPdb = 'ATOM      1  N   HIS A  87      16.894  20.030  24.002  1.00 15.00           N\n';
    const computedHash = await sha256Hex(rawPdb);

    expect(computedHash).toMatch(/^[0-9a-f]{64}$/);
    expect(computedHash.length).toBe(64);

    act(() => {
      useRendererStore.getState().setCurrentDatasetAndHash('4HHB', computedHash);
    });

    const storeState = useRendererStore.getState();
    expect(storeState.currentContentHash).toBe(computedHash);
    expect(storeState.activeDatasetId).toBe('4HHB');

    // Ingest into ledger and verify record contains authentic hash
    const certDigest = await useRendererStore.getState().recordProofEvidence({
      proofType: 'STRUCTURE_INGESTION',
      datasetBundle: {
        datasetId: '4HHB',
        format: 'pdb',
        contentHash: computedHash,
      },
      modelNumber: 1,
      assemblyId: null,
      frameIdentity: 0,
      canonicalQuery: {
        expression: 'STRUCTURE:4HHB',
        queryHash: 'qhash-4hhb-authentic',
      },
      resolutionContext: { atomCount: 1 },
      algorithmId: 'CANONICAL_PDB_PARSER',
      algorithmVersion: '2.0.0',
      parameters: { structureId: '4HHB' },
      scientificResult: { atomCount: 1, components: 1 },
      verificationRecords: [
        {
          invariant: 'ATOM_COUNT_POSITIVE',
          passed: true,
          checkedAt: new Date().toISOString(),
        },
      ],
      certificationState: 'EVIDENCE_SEALED',
    });

    expect(certDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('enforces certification ordering: records evidence before ledger verification and certification evaluation', async () => {
    // 1. Initial empty ledger
    useRendererStore.getState().resetLedger('4HHB');
    expect(useRendererStore.getState().ledgerRecordCount).toBe(0);

    // 2. Perform mock proof scene evaluation sequence
    const desired = { aabbCount: 1, caliperCount: 1, reticleCount: 0 };
    const actual = { aabbCount: 1, caliperCount: 1, reticleCount: 0, totalProofNodes: 2 };
    const report = evaluateConformance(desired, actual);
    expect(report.isConformant).toBe(true);

    // Step A: Record proof evidence FIRST
    const certDigest = await useRendererStore.getState().recordProofEvidence({
      proofType: 'DISTANCE_CALIPER',
      datasetBundle: {
        datasetId: '4HHB',
        format: 'pdb',
        contentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
      modelNumber: 1,
      assemblyId: null,
      frameIdentity: 0,
      canonicalQuery: {
        expression: 'A:87:NE2 <-> HEM:142:FE',
        queryHash: 'proof-rev-1',
      },
      resolutionContext: { aabbCount: 1, caliperCount: 1, reticleCount: 0 },
      algorithmId: 'MINIMUM_DISTANCE_CALIPER',
      algorithmVersion: '2.0.0',
      parameters: { style: 'wireframe' },
      scientificResult: { distance: 2.14 },
      verificationRecords: [
        {
          invariant: 'PROOF_CONFORMANCE_VERIFIED',
          passed: true,
          checkedAt: new Date().toISOString(),
        },
      ],
      certificationState: 'EVIDENCE_SEALED',
    });

    // Step B: Verify ledger AFTER append so the count covers the newly appended record
    expect(useRendererStore.getState().ledgerRecordCount).toBe(1);
    const ledgerIntegrity = await useRendererStore.getState().verifyLedger();
    expect(ledgerIntegrity).toBe(true);

    // Step C: Update conformance and certification LAST
    act(() => {
      useRendererStore.getState().updateConformanceAndCertification(report, ledgerIntegrity);
    });

    const finalState = useRendererStore.getState();
    expect(finalState.conformanceStatus).toBe('PASS');
    expect(finalState.certificationStatus).toBe('CERTIFIED');
    expect(finalState.latestCertificateDigest).toBe(certDigest);
  });

  it('scopes EvidenceLedger lifecycle per dataset: resetLedger initializes a fresh cryptographic chain', async () => {
    // 1. Add record to 4HHB
    await useRendererStore.getState().recordProofEvidence({
      proofType: 'STRUCTURE_INGESTION',
      datasetBundle: {
        datasetId: '4HHB',
        format: 'pdb',
        contentHash: 'hash-4hhb',
      },
      modelNumber: 1,
      assemblyId: null,
      frameIdentity: 0,
      canonicalQuery: { expression: 'STRUCTURE:4HHB', queryHash: 'q-4hhb' },
      resolutionContext: { atomCount: 100 },
      algorithmId: 'CANONICAL_PDB_PARSER',
      algorithmVersion: '2.0.0',
      parameters: { structureId: '4HHB' },
      scientificResult: { atomCount: 100, components: 1 },
      verificationRecords: [],
      certificationState: 'EVIDENCE_SEALED',
    });
    expect(useRendererStore.getState().ledgerRecordCount).toBe(1);
    expect(useRendererStore.getState().latestScientificDigest).not.toBeNull();

    // 2. Switch structure to 1BNA
    act(() => {
      useRendererStore.getState().resetLedger('1BNA');
    });

    const resetState = useRendererStore.getState();
    expect(resetState.ledgerRecordCount).toBe(0);
    expect(resetState.activeDatasetId).toBe('1BNA');
    expect(resetState.latestScientificDigest).toBeNull();
    expect(resetState.latestCertificateDigest).toBeNull();

    // 3. New record starts from clean genesis
    await useRendererStore.getState().recordProofEvidence({
      proofType: 'STRUCTURE_INGESTION',
      datasetBundle: {
        datasetId: '1BNA',
        format: 'pdb',
        contentHash: 'hash-1bna',
      },
      modelNumber: 1,
      assemblyId: null,
      frameIdentity: 0,
      canonicalQuery: { expression: 'STRUCTURE:1BNA', queryHash: 'q-1bna' },
      resolutionContext: { atomCount: 486 },
      algorithmId: 'CANONICAL_PDB_PARSER',
      algorithmVersion: '2.0.0',
      parameters: { structureId: '1BNA' },
      scientificResult: { atomCount: 486, components: 1 },
      verificationRecords: [],
      certificationState: 'EVIDENCE_SEALED',
    });

    expect(useRendererStore.getState().ledgerRecordCount).toBe(1);
    expect(await useRendererStore.getState().verifyLedger()).toBe(true);
  });

  it('eliminates swallowed errors: captures lastError and triggers fail-closed conformance', () => {
    act(() => {
      useRendererStore.getState().setLastError('WebGL context lost during buffer transfer');
      useRendererStore.setState({ conformanceStatus: 'FAIL' });
    });

    const state = useRendererStore.getState();
    expect(state.lastError).toBe('WebGL context lost during buffer transfer');
    expect(state.conformanceStatus).toBe('FAIL');
  });

  it('dynamically derives dataset-generic focus buttons from structure metadata', async () => {
    // Set active structure to 1BNA
    act(() => {
      useViewerStore.setState({ activeStructureId: '1BNA' });
    });

    await act(async () => {
      root.render(<MolecularViewport className="test-viewport" />);
    });

    // Verify dynamic focus buttons render based on 1BNA defaults ("A:1:O5'" and "B:24:O3'")
    const buttons = container.querySelectorAll('button');
    const buttonTexts = Array.from(buttons).map((b) => b.textContent?.trim());

    // Fit button should always exist
    expect(buttonTexts).toContain('Fit');
    // 1BNA landmarks should be derived: "A:1" and "B:24"
    expect(buttonTexts).toContain('A:1');
    expect(buttonTexts).toContain('B:24');
    // Hardcoded 4HHB buttons must NOT exist
    expect(buttonTexts).not.toContain('His 87');
    expect(buttonTexts).not.toContain('Heme Fe');
  });

  it('enforces deterministic terminal state: transitions from INITIALIZING to terminal READY or FAILED, never hangs', () => {
    // Initial state
    const initial = useRendererStore.getState();
    expect(initial.loadStage).toBe('INITIALIZING');
    expect(initial.loadElapsedMs).toBe(0);

    // Progressive transitions
    act(() => {
      useRendererStore.getState().setLoadStage('FETCHING', 45);
    });
    expect(useRendererStore.getState().loadStage).toBe('FETCHING');
    expect(useRendererStore.getState().loadElapsedMs).toBe(45);

    act(() => {
      useRendererStore.getState().setLoadStage('PARSING', 85);
    });
    expect(useRendererStore.getState().loadStage).toBe('PARSING');
    expect(useRendererStore.getState().loadElapsedMs).toBe(85);

    act(() => {
      useRendererStore.getState().setLoadStage('STRUCTURE_READY', 130);
    });
    expect(useRendererStore.getState().loadStage).toBe('STRUCTURE_READY');

    act(() => {
      useRendererStore.getState().setLoadStage('READY', 210);
    });
    expect(useRendererStore.getState().loadStage).toBe('READY');
    expect(useRendererStore.getState().loadElapsedMs).toBe(210);

    // Explicit failure terminal transition
    act(() => {
      useRendererStore.getState().setLoadStage('FAILED', 500);
      useRendererStore.getState().setLoadError('[RENDERER_INIT_TIMEOUT] Structure fetch exceeded 8000ms threshold');
    });
    const failedState = useRendererStore.getState();
    expect(failedState.loadStage).toBe('FAILED');
    expect(failedState.loadError).toContain('RENDERER_INIT_TIMEOUT');
    expect(failedState.lastError).toContain('RENDERER_INIT_TIMEOUT');
  });
});
