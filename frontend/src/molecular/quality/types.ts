/**
 * Molecular Structure Quality & Experimental Evidence Domain Types
 * 
 * Epistemic Rules:
 * 1. A deposited structure is a MODEL of experimental observations, not raw data.
 * 2. Resolution is an experimental diffraction limit, not per-atom positional accuracy.
 * 3. B-factor is an Atomic Displacement Parameter (ADP), not simply "biological flexibility".
 * 4. Occupancy is the fraction of unit cells containing the atom, not prediction confidence.
 * 5. Missing coordinates must NEVER be fabricated as (0, 0, 0) or silently interpolated.
 * 6. Every reported value must be classified as SOURCE_METADATA or DERIVED_ANALYSIS.
 */

export type ExperimentalMethod =
  | 'X_RAY_DIFFRACTION'
  | 'ELECTRON_MICROSCOPY'
  | 'SOLUTION_NMR'
  | 'SOLID_STATE_NMR'
  | 'NEUTRON_DIFFRACTION'
  | 'ELECTRON_CRYSTALLOGRAPHY'
  | 'COMPUTED_PREDICTION'
  | 'DE_NOVO_DESIGN'
  | 'SYNTHETIC_BENCHMARK'
  | 'UNKNOWN';

export type ValueOrigin = 'SOURCE_METADATA' | 'DERIVED_ANALYSIS';

export interface ResolutionMetadata {
  resolutionAngstrom: number | null;
  origin: ValueOrigin;
  method: ExperimentalMethod;
  isDiffractionApplicable: boolean;
  notes: string;
}

export interface CrystallographicRefinement {
  rWork: number | null;
  rFree: number | null;
  refinementProgram: string | null;
  spaceGroup: string | null;
  unitCell: {
    a: number;
    b: number;
    c: number;
    alpha: number;
    beta: number;
    gamma: number;
  } | null;
  origin: ValueOrigin;
  notes: string;
}

export interface BfactorDistribution {
  meanBfactor: number;
  medianBfactor: number;
  minBfactor: number;
  maxBfactor: number;
  backboneBfactor: number | null;
  sidechainBfactor: number | null;
  atomCount: number;
  interpretation: string; // Explicit ADP scientific disclaimer
}

export interface OccupancyDistribution {
  meanOccupancy: number;
  minOccupancy: number;
  maxOccupancy: number;
  fullOccupancyCount: number;
  partialOccupancyCount: number;
  zeroOccupancyCount: number;
  hasAlternateConformations: boolean;
  altLocIdentifiers: string[];
}

export interface MissingAtomRecord {
  chainId: string;
  residueNumber: number;
  residueName: string;
  expectedAtoms: string[];
  modeledAtoms: string[];
  missingAtoms: string[];
  isBackboneComplete: boolean;
}

export interface MissingResidueRecord {
  chainId: string;
  residueNumber: number;
  residueName: string;
  insertionCode?: string;
  regionDescription: 'N_TERMINUS' | 'C_TERMINUS' | 'INTERNAL_LOOP';
}

export interface ChainBreakRecord {
  chainId: string;
  precedingResidueNumber: number;
  succeedingResidueNumber: number;
  precedingResidueName: string;
  succeedingResidueName: string;
  measuredDistanceC_N: number;
  isSequenceContiguous: boolean;
  breakType: 'DISORDERED_LOOP_GAP' | 'NON_CONTIGUOUS_INSERTION' | 'POLYPEPTIDE_TERMINUS';
}

export interface RamachandranAngles {
  residueNumber: number;
  residueName: string;
  chainId: string;
  phiDeg: number | null;
  psiDeg: number | null;
  category: 'FAVORED' | 'ALLOWED' | 'OUTLIER' | 'NOT_APPLICABLE';
  regionType: 'GENERAL' | 'GLYCINE' | 'PROLINE' | 'PRE_PROLINE';
}

export interface StericClashRecord {
  atomA: { chainId: string; resNum: number; resName: string; atomName: string };
  atomB: { chainId: string; resNum: number; resName: string; atomName: string };
  measuredDistance: number;
  vdwSum: number;
  overlapDistance: number; // vdwSum - measuredDistance
  isSevereClash: boolean;  // overlap > 0.4 A
}

export interface BiologicalAssemblyMetadata {
  assemblyId: string;
  details: string;
  oligomericState: string;
  isAuthorDefined: boolean;
  isSoftwareGenerated: boolean;
  transformCount: number;
  stoichiometry: string;
}

export interface StructureQualityReport {
  structureId: string;
  method: ExperimentalMethod;
  isExperimental: boolean;
  resolution: ResolutionMetadata;
  refinement: CrystallographicRefinement;
  bFactorSummary: BfactorDistribution;
  occupancySummary: OccupancyDistribution;
  missingAtoms: MissingAtomRecord[];
  missingResidues: MissingResidueRecord[];
  chainBreaks: ChainBreakRecord[];
  ramachandran: {
    totalEvaluated: number;
    favoredCount: number;
    allowedCount: number;
    outlierCount: number;
    favoredPercentage: number;
    outlierPercentage: number;
  };
  clashSummary: {
    totalClashes: number;
    severeClashCount: number;
    clashes: StericClashRecord[];
  };
  biologicalAssembly: BiologicalAssemblyMetadata | null;
  depositionMetadata: {
    depositionDate: string | null;
    releaseDate: string | null;
    authors: string[];
    citationTitle: string | null;
    doi: string | null;
  };
  sourceVersusDerivedMap: Record<string, ValueOrigin>;
  epistemicWarnings: string[];
}
