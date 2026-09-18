/**
 * MOCS-Cert Protein Design, Structure Generation, Inverse Folding & Docking Types
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: 
 * - ProteinMPNN: Dauparas et al. (2022) Science 378:49-56
 * - RFdiffusion: Watson et al. (2023) Nature 620:1089-1100
 * - Structure Classification: Experimental vs Predicted vs Generated vs Synthetic
 * 
 * Non-Negotiable Scientific Principles:
 * 1. A generated backbone is NOT a complete folded protein and has no sidechains.
 * 2. Model log-probabilities and docking scores must NEVER be labeled as thermodynamic free energies (ΔG) or binding affinities (Kd).
 * 3. Exact random seeds and model checkpoints must be preserved for reproducibility.
 */

export type DesignEpistemicSource =
  | 'experimental'
  | 'predicted'
  | 'generated_backbone'
  | 'sequence_designed'
  | 'synthetic_calibration'
  | 'user_provided'
  | 'unknown';

export interface ProteinMpnnOptions {
  backboneCoordinates: Array<[number, number, number]>; // C-alpha coordinates
  originalSequence: string;
  fixedResidues?: number[]; // 0-based indices that must not be mutated
  omittedAminoAcids?: string[]; // 1-letter codes forbidden from designable positions (e.g. ['C', 'M'])
  designableChains?: string[];
  samplingTemperature?: number; // T > 0 (default 0.1)
  randomSeed?: number; // Random seed for deterministic reproducibility
  modelCheckpoint?: string; // Checkpoint identifier (e.g. 'v_48_020', 'v_48_002')
}

export interface ProteinMpnnResult {
  designedSequence: string;
  originalSequence: string;
  fixedPositionsPreserved: boolean;
  sequenceRecoveryFraction: number; // Fraction of designable positions matching original [0, 1]
  logProbabilityScore: number; // Average negative log-likelihood / cross-entropy per residue
  perplexity: number; // exp(-logProbability)
  modelName: string;
  checkpoint: string;
  seed: number;
  temperature: number;
  fixedResidueCount: number;
  epistemicOrigin: 'sequence_designed';
  scientificCaveats: string[];
}

export interface RfdiffusionContigSegment {
  type: 'scaffold' | 'generated_gap';
  chainId?: string;
  startResidue?: number;
  endResidue?: number;
  lengthMin: number;
  lengthMax: number;
}

export interface RfdiffusionOptions {
  contigSpec: string; // e.g. "10-25/A1-20/15-30"
  hotspotResidues?: Array<{ chain: string; residueNumber: number }>;
  stepCount?: number; // Diffusion steps (default 50)
  randomSeed?: number;
  modelCheckpoint?: string; // e.g. 'Base_ckpt', 'ActiveSite_ckpt'
}

export interface RfdiffusionResult {
  backbonePdb: string;
  totalResidues: number;
  caCoordinates: Array<[number, number, number]>;
  contigs: RfdiffusionContigSegment[];
  hotspotsValidated: boolean;
  modelName: string;
  checkpoint: string;
  seed: number;
  stepCount: number;
  isBackboneOnly: true;
  epistemicOrigin: 'generated_backbone';
  scientificCaveats: string[];
}

export interface DockingPoseProvenance {
  receptorId: string;
  ligandId: string;
  dockingEngine: string; // e.g. 'AutoDock Vina', 'DiffDock', 'Glide'
  engineVersion: string;
  poseRank: number;
  dockingScore: number;
  scoreMetric: string; // e.g. 'Vina Empirical Pose Score (dimensionless arbitrary ranking units)'
  isExperimentalAffinity: false;
  coordinates: Array<[number, number, number]>;
  searchBox?: {
    center: [number, number, number];
    size: [number, number, number];
  };
  randomSeed?: number;
  receptorClashCount: number;
  severeClashes: boolean;
  scientificCaveats: string[];
}

export interface StructuralPlausibilityResult {
  status: 'PLAUSIBLE' | 'SUSPECT_DISTORTIONS' | 'UNPHYSICAL_CLASHES';
  peptideBondViolations: number; // Consecutive CA-CA distance outside [3.3, 4.2] A
  meanPeptideBondLength: number;
  ramachandranOutliers: number;
  stericClashCount: number;
  details: string[];
}

export interface DesignLineageNode {
  nodeId: string;
  stage:
    | 'parent_scaffold'
    | 'generated_backbone'
    | 'designed_sequence'
    | 'predicted_structure'
    | 'docked_complex'
    | 'validation';
  parentId?: string;
  modelName: string;
  modelVersion: string;
  parameters: Record<string, any>;
  seed?: number;
  sha256Digest: string;
  timestamp: string;
  notes: string;
}
