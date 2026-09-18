/**
 * Core Trajectory Types & Interfaces for MOCS-Cert.
 * 
 * Enforces strict scientific separation between static biopolymer topology
 * (GRO/PDB) and dynamic frame coordinates (XTC/TRR/multi-model).
 */

export type TrajectoryAuthenticity =
  | 'REAL_MD_SIMULATION'
  | 'SYNTHETIC_COORDINATE_TRAJECTORY'
  | 'STATIC_STRUCTURE_WITH_MOCK_FRAMES'
  | 'INTERPOLATED_ANIMATION'
  | 'UNKNOWN';

export interface TrajectoryMetadata {
  id: string;
  topologyFile: string;
  coordinateFile?: string;
  format: 'GRO+XTC' | 'PDB_MULTIMODEL' | 'OTHER';
  atomCount: number;
  frameCount: number;
  timestepPs: number;
  totalDurationNs: number;
  boxDimensions: [number, number, number];
  isSynthetic: boolean;
  authenticity: TrajectoryAuthenticity;
  provenance: string;
}

export interface TrajectoryValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  atomCountMatches: boolean;
  coordinatesFinite: boolean;
  boxDimensionsValid: boolean;
  atomOrderConsistent: boolean;
}

export interface TrajectoryFrameData {
  frameIndex: number;
  timePs: number;
  timeNs: number;
  boxDimensions: [number, number, number];
  coordinates: Float32Array; // 3 * atomCount
  atomCount: number;
}

export interface TrajectoryPlaybackOptions {
  fps?: number;
  loop?: boolean;
  onFrameChange?: (frameIndex: number) => void;
  onPlaybackEnd?: () => void;
}

export interface TrajectoryPlaybackState {
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;
  fps: number;
  loop: boolean;
}

/**
 * Coordinate evolution telemetry between two frames or throughout a trajectory.
 */
export interface TrajectoryCoordinateEvolution {
  maxCoordinateDiff: number;
  meanCoordinateDiff: number;
  rmsCoordinateDiff: number;
  isStatic: boolean;
  differingAtomsCount: number;
  totalAtomsCount: number;
}

/**
 * Epistemic frame identity definition.
 */
export interface TrajectoryFrameIdentity {
  trajectoryId: string;
  frameIndex: number;
  simulationStep: number | null;
  physicalTimePs: number | null;
  physicalTimeNs: number | null;
  timeSource: 'RECORDED' | 'INFERRED' | 'NOT_AVAILABLE';
  modelIndex: number;
}

/**
 * Temporal interval profile of trajectory frames.
 */
export interface FrameIntervalProfile {
  isUniform: boolean;
  meanIntervalPs: number;
  minIntervalPs: number;
  maxIntervalPs: number;
  timestampsPs: number[];
  frameCount: number;
}

/**
 * RMSD Options across trajectory frames.
 */
export interface TrajectoryRmsdOptions {
  referenceType: 'FIRST_FRAME' | 'SELECTED_FRAME' | 'AVERAGE_STRUCTURE' | 'EXTERNAL_STRUCTURE';
  referenceFrameIndex?: number;
  referenceCoordinates?: Array<[number, number, number]>;
  atomIndices?: number[];
  alignFrames: boolean; // Kabsch rigid-body alignment to remove global translation/rotation
  massWeighted?: boolean;
}

export interface TrajectoryRmsdResult {
  rmsdSeries: number[]; // RMSD per frame in Angstroms
  meanRmsd: number;
  minRmsd: number;
  maxRmsd: number;
  referenceUsed: string;
  alignmentApplied: boolean;
  analyzedFrameCount: number;
}

/**
 * RMSF (Root-Mean-Square Fluctuation) Result.
 */
export interface TrajectoryRmsfResult {
  rmsfPerAtom: number[]; // RMSF per atom in Angstroms
  meanRmsf: number;
  maxRmsf: number;
  minRmsf: number;
  alignedBeforeRmsf: boolean;
  analyzedFrameCount: number;
  referenceStructureUsed: 'AVERAGE_STRUCTURE' | 'FIRST_FRAME';
}

/**
 * Radius of Gyration Result over trajectory.
 */
export interface TrajectoryRgResult {
  rgSeries: number[]; // Rg in Angstroms per frame
  meanRg: number;
  minRg: number;
  maxRg: number;
  massWeighted: boolean;
  centerOfMassSeries: Array<[number, number, number]>;
}

/**
 * Trajectory Contact Occupancy Options and Result.
 */
export interface TrajectoryContactOccupancyOptions {
  atomAIndex: number;
  atomBIndex: number;
  cutoffDistance: number;
  usePbc: boolean;
  boxDimensions?: [number, number, number];
  timestampsPs?: number[];
}

export interface TrajectoryContactOccupancyResult {
  occupancyFraction: number; // N_contact / M_frames
  timeWeightedOccupancy?: number;
  contactFramesCount: number;
  totalFramesCount: number;
  distancePerFrame: number[];
  minDistance: number;
  maxDistance: number;
  meanDistance: number;
  isPersistent: boolean; // >= 0.70
  isTransient: boolean;  // < 0.30
}

/**
 * Pairwise Contact Map over trajectory.
 */
export interface TrajectoryContactMapResult {
  atomCount: number;
  averageDistanceMatrix: number[][]; // N x N
  contactFrequencyMatrix: number[][]; // N x N values in [0, 1]
  cutoffDistance: number;
  analyzedFrameCount: number;
}

/**
 * Authentic MD Simulation Provenance & Observables.
 */
export interface TrajectoryProvenance {
  engine: string | null;
  version: string | null;
  forceField: string | null;
  integrator: string | null;
  timestepPs: number | null;
  temperatureK: number | null;
  pressureBar: number | null;
  ensemble: string | null;
  pbcType: string | null;
  isSynthetic: boolean;
  observablesRecorded: string[];
  notes: string;
}

/**
 * 3-point Bond Angle Time Series Result.
 */
export interface TrajectoryAngleResult {
  atomIndices: [number, number, number];
  angleSeriesDeg: number[];
  meanAngleDeg: number;
  stdDevDeg: number;
  minAngleDeg: number;
  maxAngleDeg: number;
  frameCount: number;
}

/**
 * 4-point Dihedral Angle Time Series Result with Circular Statistics.
 */
export interface TrajectoryDihedralResult {
  atomIndices: [number, number, number, number];
  dihedralSeriesDeg: number[]; // [-180, 180]
  unwrappedSeriesDeg: number[]; // continuous phase
  circularMeanDeg: number;
  circularVariance: number; // [0, 1]
  minAngleDeg: number;
  maxAngleDeg: number;
  frameCount: number;
}

/**
 * Hydrogen-Bond Occupancy & Geometry Result.
 */
export interface TrajectoryHbondResult {
  donorIndex: number;
  hydrogenIndex?: number;
  acceptorIndex: number;
  occupancyFraction: number; // [0, 1]
  distanceSeries: number[]; // Donor-Acceptor distance (Å)
  angleSeriesDeg?: number[]; // D-H...A angle (degrees)
  contactFlags: boolean[];
  totalFrames: number;
  meanDistance: number;
  meanAngleDeg?: number;
  uninterruptedLifetimes: number[]; // lengths of consecutive contact frame blocks
  isPersistent: boolean; // >= 0.50
}

/**
 * Statistical Validity: Autocorrelation & Effective Sample Size.
 */
export interface AutocorrelationResult {
  lagTimes: number[];
  autocorrelationValues: number[]; // C(tau) in [-1, 1]
  integratedAutocorrelationTime: number; // tau_int
  statisticalInefficiency: number; // g = 2*tau_int + 1
  effectiveSampleSize: number; // N_eff = N / g
  totalSamples: number;
}

/**
 * Statistical Validity: Block Averaging for Correlated Data.
 */
export interface BlockAveragingResult {
  blockSizes: number[];
  blockStandardErrors: number[];
  convergedSem: number;
  untransformedSem: number; // naive sigma / sqrt(N)
  inefficiencyRatio: number; // convergedSem / untransformedSem
}

/**
 * Convergence / Equilibration Assessment.
 */
export interface ConvergenceAssessmentResult {
  status: 'CONVERGED_STATIONARY' | 'DRIFTING_UNCONVERGED' | 'INSUFFICIENT_DATA';
  driftSlopePerFrame: number;
  totalDrift: number;
  stationarityWindowFrames: [number, number];
  pValueOrConfidence: number;
  rationale: string;
}

/**
 * Conformational Analysis: Principal Component Analysis (PCA / Essential Dynamics).
 */
export interface TrajectoryPcaResult {
  atomCount: number;
  frameCount: number;
  eigenvalues: [number, number]; // variance of PC1, PC2
  explainedVarianceRatios: [number, number];
  projectionsPC1: number[];
  projectionsPC2: number[];
  meanStructureCoords: Array<[number, number, number]>;
}

/**
 * Conformational Analysis: RMSD-Based Clustering.
 */
export interface TrajectoryClusterResult {
  clusterCount: number;
  clusterMedoids: number[]; // frame indices representing cluster centers
  clusterAssignments: number[]; // cluster index per frame
  clusterSizes: number[];
  clusterFractions: number[]; // population fraction [0, 1]
  rmsdCutoff: number;
}

