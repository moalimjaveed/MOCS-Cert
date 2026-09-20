/**
 * Protein Structure Prediction, Confidence & Model Provenance Domain Types
 * 
 * Strict forensic types governing:
 * - Epistemic origin classification (experimental vs predicted vs designed)
 * - pLDDT 4-band confidence model
 * - PAE (Predicted Aligned Error) matrix semantics
 * - Multimer complex metrics (ipTM, pTM, inter-chain PAE)
 * - Cryptographic model provenance tracking
 */

export type PredictionProvider =
  | 'alphafold_db'
  | 'esmfold'
  | 'boltz'
  | 'colabfold'
  | 'rosettafold'
  | 'rfdiffusion'
  | 'proteinmpnn'
  | 'custom_ml'
  | 'synthetic_calibration';

export type StructureEpistemicOrigin =
  | 'experimental'
  | 'predicted'
  | 'designed'
  | 'synthetic_calibration';

export type PlddtBandKey = 'very_high' | 'confident' | 'low' | 'very_low';

export interface PlddtBand {
  key: PlddtBandKey;
  label: string;
  minScore: number;
  maxScore: number;
  hexColor: string;
  interpretation: string;
  backboneReliability: 'high' | 'good' | 'uncertain' | 'unreliable_disordered';
  sidechainReliability: 'high' | 'variable' | 'unreliable' | 'unreliable';
}

export interface PlddtResidueScore {
  residueIndex: number; // 0-based sequential index
  residueNumber: number; // 1-based PDB sequence number (resSeq)
  insertionCode?: string; // Insertion code e.g. 'A', 'B'
  residueName: string; // 3-letter code, e.g. 'MET', 'ALA'
  singleLetterCode: string; // 1-letter code, e.g. 'M', 'A'
  chainId: string;
  score: number; // pLDDT in [0, 100]
  band: PlddtBandKey;
  isDisorderedHypothesis: boolean; // pLDDT < 50
}

export interface PaeMatrix {
  dimensions: [number, number]; // [N, N]
  residueIndices: number[]; // sequential indices [0, ..., N-1]
  maxErrorAngstrom: number; // maximum error cap (typically 31.75 A or 35.0 A)
  matrix: number[][]; // matrix[i][j] is expected error of residue j when aligned on residue i
  isAsymmetric: boolean; // whether PAE(i,j) != PAE(j,i)
  meanError: number;
  minError: number;
  maxObservedError: number;
  chainBoundaries?: Array<{
    chainId: string;
    startResidueIndex: number;
    endResidueIndex: number;
  }>;
}

export interface InterChainPaeSummary {
  chainA: string;
  chainB: string;
  meanPae: number;
  minPae: number;
  maxPae: number;
  isWellPositioned: boolean; // typically mean PAE < 10 A
}

export interface MultimerConfidenceMetrics {
  iptmScore?: number; // Interface predicted TM-score [0, 1]
  ptmScore?: number; // Predicted TM-score [0, 1]
  modelScore?: number; // Standard multimer ranking: 0.8 * ipTM + 0.2 * pTM
  interChainPaeSummaries?: InterChainPaeSummary[];
}

export interface PredictionConfidenceSummary {
  averagePlddt: number;
  medianPlddt: number;
  minPlddt: number;
  maxPlddt: number;
  bandCounts: Record<PlddtBandKey, number>;
  bandFractions: Record<PlddtBandKey, number>;
  disorderedResidueCount: number;
  disorderedResidueFraction: number;
  ptmScore?: number;
  iptmScore?: number;
  modelScore?: number;
  paeMatrixSummary?: {
    meanError: number;
    maxError: number;
    isAsymmetric: boolean;
  };
}

export interface ModelProvenance {
  provider: PredictionProvider | string;
  providerDisplayName: string;
  modelName: string;
  modelVersion?: string;
  epistemicOrigin: StructureEpistemicOrigin;
  isExperimental: boolean; // strictly false for predicted / designed structures
  sequenceSha256: string;
  randomSeed?: number | string;
  generationTimestamp: string;
  parameters?: Record<string, any>;
  scientificCaveats: string[];
}

export interface GenerativeDesignRecord {
  generationMethod: 'rfdiffusion' | 'proteinmpnn' | 'de_novo';
  designTarget?: string;
  originalScaffoldId?: string;
  hotspotResidues?: Array<{ chain: string; resSeq: number }>;
  mpnnScore?: number;
  sequenceRecovery?: number;
  isExperimentallyValidated: boolean; // strictly false until wet-lab assay
}

export interface PredictionResult {
  id: string;
  provenance: ModelProvenance;
  sequence: string;
  residueCount: number;
  pdbText: string;
  perResiduePlddt: PlddtResidueScore[];
  confidenceSummary: PredictionConfidenceSummary;
  paeMatrix?: PaeMatrix;
  generativeDesign?: GenerativeDesignRecord;
}

export interface PredictionRequest {
  id?: string;
  sequence: string;
  modelName?: string;
  provider?: PredictionProvider;
  signal?: AbortSignal;
  timeoutMs?: number;
  customSeed?: number;
}
