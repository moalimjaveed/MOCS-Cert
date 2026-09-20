/**
 * MOCS-Cert Scientific Data Lifecycle & Integration Engine — Types & Contracts
 * 
 * PASS 19: Cross-Module Integration, Data Lineage, Reproducibility & Export
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: Canonical 18-Stage Lifecycle, Explicit Unit Contracts & Invariant Gates
 */

import type { StructureProvenance } from '../types';
import type { CanonicalSelectionToken } from '../geometry/structuralIdentity';

/**
 * The 18 Canonical Stages of the MOCS-Cert Scientific Data Lifecycle
 */
export type ScientificDataLifecycleStage =
  | 'user_input'
  | 'data_ingestion'
  | 'identification'
  | 'normalization'
  | 'structural_representation'
  | 'sequence_mapping'
  | 'molecular_analysis'
  | 'geometry'
  | 'measurements'
  | 'trajectories'
  | 'surfaces_pockets'
  | 'prediction_design'
  | 'results'
  | 'provenance'
  | 'serialization'
  | 'cache'
  | 'ui'
  | 'export';

/**
 * Standardized Scientific Units Contract
 */
export type ScientificUnit =
  | 'Å'             // Length (distances, radii, coordinates)
  | 'nm'            // Length (GROMACS native)
  | 'Å²'            // Area (SASA)
  | 'nm²'           // Area
  | 'Å³'            // Volume (molecular/pocket volume)
  | 'nm³'           // Volume
  | '°'             // Angles (bond angles, dihedrals)
  | 'degrees'       // Angles (alias)
  | 'radians'       // Angles (math libraries)
  | 'ps'            // Time (trajectory frames, timesteps)
  | 'ns'            // Time
  | 'fs'            // Time
  | 'amu'           // Mass (atomic mass units / Da)
  | 'kcal/mol'      // Energy
  | 'kJ/mol'        // Energy
  | 'dimensionless' // Scores, ratios, counts, probabilities
  | 'pLDDT'         // AlphaFold confidence band [0, 100]
  | 'fraction';     // [0, 1] percentages

/**
 * Strict Epistemic Classification of Scientific Results
 */
export type ScientificResultStatus =
  | 'COMPUTED'            // Live algorithmic computation from coordinates
  | 'EXPERIMENTAL'        // Direct crystallographic/cryo-EM/NMR measurement
  | 'DATABASE_ANNOTATED'  // Curated database annotation (UniProt, RCSB)
  | 'PREDICTED'           // Forward AI/ML structure prediction (AlphaFold, ESMFold)
  | 'GENERATED'           // Generative de novo design (RFdiffusion, ProteinMPNN)
  | 'SYNTHETIC'           // Calibrated synthetic benchmark fixture (synth_500f)
  | 'UNAVAILABLE'         // Required data is structurally missing or unmeasured
  | 'FAILED'              // Computation failed or inputs violated preconditions
  | 'INSUFFICIENT_DATA';  // Insufficient atoms or coordinates to compute metric

/**
 * Canonical Selection Scope identifying exact molecular target
 */
export interface CanonicalSelectionScope {
  structureId: string;
  modelId?: string | number;
  chainId?: string;
  residueName?: string;
  residueNumber?: number;
  insertionCode?: string;
  atomName?: string;
  isExplicitChain: boolean;
  isPolymer?: boolean;
  classification?: string;
}

/**
 * Unified Scientific Result Envelope
 * Every calculation across all modules MUST package into this model
 */
export interface ScientificResultEnvelope<T = any> {
  resultType: string;
  source: {
    structureId: string;
    modelId?: string | number;
    chainId?: string;
    trajectoryId?: string;
    frameIndex?: number;
    timestampPs?: number;
  };
  selection: CanonicalSelectionScope | CanonicalSelectionToken | string;
  parameters: Record<string, any>;
  unit: ScientificUnit;
  status: ScientificResultStatus;
  provenance: StructureProvenance | Record<string, any>;
  timestamp: number;
  value: T;
  formattedValue?: string;
  uncertainty?: number;
  errors?: string[];
  warnings?: string[];
  sha256Digest?: string;
}

/**
 * The 9 Automated Scientific Certification Gates (Section 48)
 */
export type CertificationGateId =
  | 'GATE-IDENTITY'    // No residue-only ambiguous selection
  | 'GATE-UNITS'       // All scientific values have explicit unit contracts
  | 'GATE-PROVENANCE'  // Every derived scientific result has source identity & hash
  | 'GATE-TRAJECTORY'  // Frame N returns frame N coordinates & updates with time
  | 'GATE-CACHE'       // Cache keys contain all scientifically relevant inputs
  | 'GATE-RACE'        // Stale async requests cannot overwrite current state
  | 'GATE-CHAIN'       // Chain-specific results cannot cross-contaminate (4HHB Chain A vs C)
  | 'GATE-DATA'        // Malformed external data fails validation safely
  | 'GATE-EXPORT';     // Export preserves scientific identity and coordinates

export interface GateEvaluationResult {
  gateId: CertificationGateId;
  passed: boolean;
  details: string;
  evaluatedAt: number;
}

/**
 * Export Formats & Options
 */
export type ExportFormat = 'pdb' | 'fasta' | 'csv' | 'json';

export interface PdbExportOptions {
  includeHetatm?: boolean;
  includeWaters?: boolean;
  renumberSerials?: boolean;
  selectedChainId?: string;
}

export interface FastaExportOptions {
  chainId?: string;
  lineLength?: number;
}

export interface CsvExportColumn {
  key: string;
  label: string;
  unit?: ScientificUnit | string;
}
