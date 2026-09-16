import { create } from 'zustand';
import type { RendererRuntimeState } from '@mocs/render-contract';
import type { ConformanceReport, CertificationStatus, CertificationEvaluation } from '@mocs/conformance';
import { evaluateCertification } from '@mocs/conformance';
import { EvidenceLedger, type EvidenceDraft, computeCertificateDigest } from '@mocs/evidence';

export type LoadLifecycleStage =
  | 'INITIALIZING'
  | 'FETCHING'
  | 'PARSING'
  | 'STRUCTURE_READY'
  | 'REPRESENTATIONS_CREATING'
  | 'READY'
  | 'FAILED';

export interface RendererState {
  // Lifecycle
  rendererStatus: 'uninit' | 'initializing' | 'ready' | 'failed';
  loadStage: LoadLifecycleStage;
  loadElapsedMs: number;
  loadError: string | null;

  // Active dataset & authentic cryptographic content hash
  activeDatasetId: string | null;
  currentContentHash: string | null;

  // Runtime telemetry queried from getRuntimeState()
  runtimeTelemetry: RendererRuntimeState | null;

  // Conformance & Certification
  conformanceStatus: 'PASS' | 'FAIL' | 'PENDING';
  certificationStatus: CertificationStatus;
  conformanceReport: ConformanceReport | null;
  certificationEvaluation: CertificationEvaluation | null;

  // Cryptographic Evidence Ledger
  ledgerRecordCount: number;
  latestScientificDigest: string | null;
  latestCertificateDigest: string | null;

  // Scene Revision Fencing
  sceneRevision: number;

  // Buried-Target Inspection
  inspectionActive: boolean;
  inspectionTarget: string | null;

  // Diagnostics & error tracking
  lastError: string | null;

  // Actions
  setRendererStatus: (status: 'uninit' | 'initializing' | 'ready' | 'failed') => void;
  setLoadStage: (stage: LoadLifecycleStage, elapsedMs?: number) => void;
  setLoadError: (err: string | null) => void;
  setCurrentDatasetAndHash: (datasetId: string, contentHash: string) => void;
  setRuntimeTelemetry: (telemetry: RendererRuntimeState) => void;
  updateConformanceAndCertification: (
    conformance: ConformanceReport,
    ledgerIntegrity: boolean
  ) => void;
  bumpRevision: () => number;
  recordProofEvidence: (draft: EvidenceDraft) => Promise<string>;
  verifyLedger: () => Promise<boolean>;
  resetLedger: (datasetId?: string) => void;
  setInspectionActive: (active: boolean, target?: string | null) => void;
  setLastError: (err: string | null) => void;
  resetRendererStore: () => void;
}

let activeRendererLedger = new EvidenceLedger();

export const useRendererStore = create<RendererState>((set, get) => ({
  rendererStatus: 'uninit',
  loadStage: 'INITIALIZING',
  loadElapsedMs: 0,
  loadError: null,

  activeDatasetId: null,
  currentContentHash: null,

  runtimeTelemetry: null,

  conformanceStatus: 'PENDING',
  certificationStatus: 'UNVERIFIED',
  conformanceReport: null,
  certificationEvaluation: null,

  ledgerRecordCount: 0,
  latestScientificDigest: null,
  latestCertificateDigest: null,

  sceneRevision: 0,

  inspectionActive: false,
  inspectionTarget: null,

  lastError: null,

  setRendererStatus: (status) => set({ rendererStatus: status }),

  setLoadStage: (stage, elapsedMs) =>
    set((state) => ({
      loadStage: stage,
      loadElapsedMs: elapsedMs !== undefined ? elapsedMs : state.loadElapsedMs,
    })),

  setLoadError: (err) => set({ loadError: err, lastError: err }),

  setCurrentDatasetAndHash: (datasetId, contentHash) =>
    set({ activeDatasetId: datasetId, currentContentHash: contentHash }),

  setRuntimeTelemetry: (telemetry) => set({ runtimeTelemetry: telemetry }),

  updateConformanceAndCertification: (conformance, ledgerIntegrity) => {
    const certEval = evaluateCertification(conformance, ledgerIntegrity);
    set({
      conformanceStatus: conformance.isConformant ? 'PASS' : 'FAIL',
      certificationStatus: certEval.status,
      conformanceReport: conformance,
      certificationEvaluation: certEval,
      lastError: conformance.isConformant ? null : conformance.discrepancies.join('; '),
    });
  },

  bumpRevision: () => {
    const next = get().sceneRevision + 1;
    set({ sceneRevision: next });
    return next;
  },

  recordProofEvidence: async (draft: EvidenceDraft) => {
    const res = await activeRendererLedger.append(draft);
    if (res.ok) {
      const scientificDigest = res.value.scientificDigest;
      const certDigest = await computeCertificateDigest({
        certificateId: `cert:${Date.now()}`,
        evidenceId: res.value.evidenceId,
        issuedAt: new Date().toISOString(),
        scientificDigest,
      });

      set({
        ledgerRecordCount: activeRendererLedger.count,
        latestScientificDigest: scientificDigest,
        latestCertificateDigest: certDigest,
      });
      return certDigest;
    }
    return '';
  },

  verifyLedger: async () => {
    return activeRendererLedger.verifyLedgerIntegrity();
  },

  resetLedger: (datasetId?: string) => {
    activeRendererLedger = new EvidenceLedger();
    set({
      activeDatasetId: datasetId ?? null,
      ledgerRecordCount: 0,
      latestScientificDigest: null,
      latestCertificateDigest: null,
    });
  },

  setInspectionActive: (active, target = null) =>
    set({ inspectionActive: active, inspectionTarget: target }),

  setLastError: (err) => set({ lastError: err }),

  resetRendererStore: () => {
    activeRendererLedger = new EvidenceLedger();
    set({
      rendererStatus: 'uninit',
      loadStage: 'INITIALIZING',
      loadElapsedMs: 0,
      loadError: null,
      activeDatasetId: null,
      currentContentHash: null,
      runtimeTelemetry: null,
      conformanceStatus: 'PENDING',
      certificationStatus: 'UNVERIFIED',
      conformanceReport: null,
      certificationEvaluation: null,
      ledgerRecordCount: 0,
      latestScientificDigest: null,
      latestCertificateDigest: null,
      sceneRevision: 0,
      inspectionActive: false,
      inspectionTarget: null,
      lastError: null,
    });
  },
}));

if (typeof window !== 'undefined') {
  (window as any).__mocs_rendererStore = useRendererStore;
  (window as any).__mocs_getRendererLedger = () => activeRendererLedger;
}
