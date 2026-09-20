/**
 * MOCS Mathematical Protein Intelligence Subsystem — Types & Scientific Contracts
 * 
 * Epistemic Status Categorization:
 * - ESTABLISHED: Mathematically exact calculations derived from real coordinates (angles, RMSD, Rg, 20^N).
 * - EXPERIMENTAL: Research formulations under investigation (topological complexes, Betti numbers, hydrodynamics, electrostatics).
 * - RESEARCH_HYPOTHESIS: Rigorous testable conjectures formulated with explicit baselines and limitations.
 * - SPECULATIVE: Exploratory mathematical analogies (e.g. number-theoretic mappings) with zero biological claims.
 */

export type EpistemicStatus =
  | 'ESTABLISHED'
  | 'EXPERIMENTAL'
  | 'RESEARCH_HYPOTHESIS'
  | 'SPECULATIVE';

/**
 * 1. Geometric Structural Analysis Metrics (ESTABLISHED)
 */
export interface GeometryMetrics {
  status: 'ESTABLISHED';
  atomCount: number;
  residueCount: number;
  centroid: [number, number, number];
  radiusOfGyration: number; // Å
  dimensions: { deltaX: number; deltaY: number; deltaZ: number };
  boundingVolume: number; // Å³
  pairwiseDistanceSummary: {
    min: number;
    max: number;
    mean: number;
    sampleCount: number;
  };
  contactPairsCount: number; // Pairs <= contactCutoff
  contactCutoff: number; // Å (default 5.0)
  backboneRMSD?: number; // Å
  bondAngleSamples: Array<{
    atoms: [string, string, string];
    angleDeg: number;
  }>;
  dihedralAngleSamples: Array<{
    atoms: [string, string, string, string];
    dihedralDeg: number;
  }>;
}

/**
 * 2. Topological Analysis Metrics (EXPERIMENTAL)
 */
export interface TopologyMetrics {
  status: 'EXPERIMENTAL';
  label: 'Experimental Topological Analysis';
  contactGraph: {
    nodesCount: number;
    edgesCount: number;
    averageDegree: number;
    density: number;
  };
  connectedComponentsCount: number; // Betti-0 (β0)
  cycleCount?: number; // 1-cycles (β1)
  cavityApproximationCount: number | null; // Betti-2 (β2) Unsupported for 1D contact graph
  bettiNumbers: {
    beta0: number;
    beta1: number;
    beta2: number | null;
    beta2Status?: string;
  };
  filtrationRadius: number; // Å
  simplicesCount: {
    points0D: number;
    edges1D: number;
    triangles2D: number;
  };
  persistenceSummary: Array<{
    feature: string;
    birthRadius: number;
    deathRadius: number;
    persistence: number;
  }>;
  filtrationSummary?: {
    persistencePairs: Array<{
      feature: string;
      birthRadius: number;
      deathRadius: number;
      persistence: number;
    }>;
  };
}

/**
 * 3. Combinatorial Design Complexity Metrics (ESTABLISHED & HEURISTIC)
 */
export interface ComplexityMetrics {
  status: 'ESTABLISHED';
  sequenceLength: number;
  sequenceSearchSpaceNotation: string; // e.g. "20^141 ≈ 2.78e+183"
  log10SearchSpace: number;
  candidatePruningRate: number; // % pruned by MOCS Certificate
  effectiveBranchingFactor: number;
  searchEfficiencyComparison: Array<{
    strategy: 'Random Walk' | 'Heuristic Genetic' | 'Branch & Bound' | 'MOCS Proof Guided';
    evaluatedCandidatesNotation: string;
    computationalCostSeconds: number;
    soundnessGuarantee: 'None' | 'Empirical' | 'Conservative Proof' | 'Sound Certificate';
  }>;
}

/**
 * 4. Physical Dynamics / Hydrodynamic Model (EXPERIMENTAL)
 */
export interface HydrodynamicsMetrics {
  status: 'EXPERIMENTAL';
  label: 'Hydrodynamic Research Model';
  solvent: 'Water (Aqueous)';
  temperatureKelvin: number; // 298.15 K
  viscosityCentipoise: number; // 0.89 cP
  effectiveHydrodynamicRadius: number; // Å (Rh ≈ 0.77 * Rg)
  stokesEinsteinDiffusionCoeff: number; // 10^-7 cm²/s
  estimatedShearRateSec: number;
  reynoldsNumberMicroscopic: number;
}

/**
 * 5. Mathematical Physics & Potential Fields (EXPERIMENTAL)
 */
export interface MathematicalPhysicsMetrics {
  status: 'EXPERIMENTAL';
  label: 'Experimental Mathematical Physics';
  electrostaticPotentialSummary: {
    minPotentialVolts: number;
    maxPotentialVolts: number;
    meanPotentialVolts: number;
    dipoleMomentDebye: number;
  };
  detectedPointGroupSymmetry: string; // e.g. "C1", "C2", "D2 (Pseudo)"
  energySurfaceCurvature: number;
}

/**
 * 6. Number-Theoretic / Discrete Analysis Sandbox (SPECULATIVE / HYPOTHESIS TESTING)
 */
export interface NumberTheoreticMetrics {
  status: 'SPECULATIVE';
  label: 'Experimental Number-Theoretic Sandbox (Hypothesis Testing Only)';
  laplacianEigenvaluesTop5: number[];
  algebraicConnectivity: number; // Fiedler value λ2
  spectralRadius: number; // λmax
  primeResidueHash: string;
  modularPeriodicityDetected: boolean;
  scientificDisclaimer: string;
}

/**
 * Research Hypothesis Record (Section 41)
 */
export interface ResearchHypothesis {
  id: string;
  title: string;
  description: string;
  mathematicalBasis: string;
  biologicalRelevance: string;
  status: EpistemicStatus;
  method: string;
  dataset: string;
  baseline: string;
  experimentalResult: string;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  limitations: string;
}

/**
 * Complete Structure Mathematical Analysis Bundle
 */
export interface StructureMathematicalAnalysis {
  structureId: string;
  timestamp: string;
  geometry: GeometryMetrics;
  topology: TopologyMetrics;
  complexity: ComplexityMetrics;
  hydrodynamics: HydrodynamicsMetrics;
  physics: MathematicalPhysicsMetrics;
  mathematicalPhysics?: MathematicalPhysicsMetrics;
  numberTheory: NumberTheoreticMetrics;
  numberTheoretic?: NumberTheoreticMetrics;
  hypotheses?: any[];
}
