/**
 * MOCS-Cert Protein Structural Biology — Comparison, Alignment & Similarity Types
 * 
 * Epistemic Status: ESTABLISHED
 * Scientific Standards: wwPDB, CASP (GDT-TS), TM-score (Zhang & Skolnick), Needleman-Wunsch
 */

import type { ValidatedAtom } from '../geometry/structuralIdentity';
import type { StandardAminoAcid1Letter } from './types';

export type ComparisonScope =
  | 'whole-structure'
  | 'chain'
  | 'domain'
  | 'residue-range'
  | 'selection';

export type AtomScope =
  | 'CA'        // C-alpha only (standard for fold comparison & TM-score)
  | 'backbone'  // N, CA, C, O
  | 'heavy'     // All non-hydrogen atoms
  | 'all'       // All atoms including hydrogens
  | 'custom';   // User-specified atom names

export type WeightScheme =
  | 'uniform'   // Equal weight (1.0)
  | 'mass'      // Weighted by IUPAC atomic mass
  | 'occupancy' // Weighted by crystallographic occupancy
  | 'custom';   // User-specified array of weights

export type ResiduePairingMode =
  | 'sequence-alignment' // Dynamic programming (Needleman-Wunsch global alignment)
  | 'canonical-numbering'// Matches identical chain + resSeq + insCode
  | 'structural'         // Iterative distance-based structural pairing
  | 'explicit-map';      // User-supplied residue mapping table

export interface AlignedResiduePair {
  sourceChain: string;
  sourceResSeq: number;
  sourceInsCode?: string;
  sourceResName: string;
  sourceChar1: string;

  targetChain: string;
  targetResSeq: number;
  targetInsCode?: string;
  targetResName: string;
  targetChar1: string;

  isExactMatch: boolean;
  isSimilar: boolean;
  hasCoordinates: boolean;
}

export interface SequenceAlignmentResult {
  sourceAlignedSeq: string; // Sequence with '-' gap characters
  targetAlignedSeq: string; // Sequence with '-' gap characters
  alignmentScore: number;
  alignmentLength: number;
  identityCount: number;
  similarityCount: number;
  gapCount: number;
  sequenceIdentityPercent: number;  // (identities / alignmentLength) * 100
  sequenceSimilarityPercent: number;// (similarities / alignmentLength) * 100
  residuePairs: AlignedResiduePair[];
  sourceToTargetResidueMap: Map<string, string>; // "chain:resSeq:insCode" -> "chain:resSeq:insCode"
}

export interface PairedAtomRecord {
  sourceAtom: {
    atomName: string;
    element: string;
    chainId: string;
    resSeq: number;
    insCode?: string;
    resName: string;
    coords: [number, number, number];
    mass: number;
    occupancy: number;
  };
  targetAtom: {
    atomName: string;
    element: string;
    chainId: string;
    resSeq: number;
    insCode?: string;
    resName: string;
    coords: [number, number, number];
    mass: number;
    occupancy: number;
  };
  weight: number;
}

export interface AtomCorrespondenceResult {
  pairedAtoms: PairedAtomRecord[];
  pairedCoordsSource: [number, number, number][];
  pairedCoordsTarget: [number, number, number][];
  weights: number[];
  unmatchedSourceCount: number;
  unmatchedTargetCount: number;
  atomScope: AtomScope;
  pairingMode: ResiduePairingMode;
}

export interface WeightedKabschResult {
  pairedAtomCount: number;
  rmsd: number;              // Optimal superposed RMSD (Å)
  rawRmsd: number;           // Pre-alignment unaligned coordinate RMSD (Å)
  weightedRmsd: number;      // Mass- or occupancy-weighted RMSD (Å)
  weightScheme: WeightScheme;
  rotationMatrix: [
    [number, number, number],
    [number, number, number],
    [number, number, number]
  ];
  translationVector: [number, number, number];
  rotationDeterminant: number;// Must be +1.0 (proper rotation)
  isProperRotation: boolean;  // True if det(R) > 0.999 && det(R) < 1.001
  centroidSource: [number, number, number];
  centroidTarget: [number, number, number];
  superposedSourceCoords: [number, number, number][];
}

export interface TrimmedRmsdResult {
  trimmedRmsd: number;
  trimmingPercentage: number; // e.g. 95 for RMSD95
  includedCount: number;
  excludedCount: number;
  excludedResidueKeys: string[];
}

export interface StructuralSimilarityMetrics {
  coordinateRmsd: number;           // Optimal superposed RMSD (Å)
  rawCoordinateRmsd: number;        // Unaligned RMSD (Å)
  weightedRmsd?: number;            // Weighted RMSD (Å)
  trimmedRmsd95?: TrimmedRmsdResult;// Outlier-trimmed RMSD95 (Å)
  tmScore: number;                  // Zhang & Skolnick (2004) TM-score (0 to 1.0)
  tmScoreTargetLength: number;      // Length L_target used for d0(L)
  tmScoreD0: number;                // Characteristic distance d0(L) in Å
  isSameFold: boolean;              // True if TM-score > 0.5
  gdtTs: number;                    // GDT Total Score (0 to 100%)
  gdtHa: number;                    // GDT High Accuracy (0 to 100%)
  gdtCutoffs: {
    p0_5: number;
    p1_0: number;
    p2_0: number;
    p4_0: number;
    p8_0: number;
  };
  distanceMatrixRmsd: number;       // dRMSD (Å, superposition-free)
  contactMapOverlap: {
    cutoffAngstroms: number;
    jaccardSimilarity: number;      // |A ∩ B| / |A ∪ B|
    diceSimilarity: number;         // 2|A ∩ B| / (|A| + |B|)
    contactsSourceCount: number;
    contactsTargetCount: number;
    commonContactsCount: number;
  };
  sequenceIdentityPercent: number;
  sequenceSimilarityPercent: number;
}

export interface ComparisonProvenance {
  sourceStructureId: string;
  sourceModelId: number | string;
  sourceChainId: string;
  sourceScope: ComparisonScope;
  sourceResidueRange?: [number, number];
  sourceKind?: string;

  targetStructureId: string;
  targetModelId: number | string;
  targetChainId: string;
  targetScope: ComparisonScope;
  targetResidueRange?: [number, number];
  targetKind?: string;

  atomScope: AtomScope;
  pairingMode: ResiduePairingMode;
  weightScheme: WeightScheme;
  timestamp: string;
  engineVersion: string;
  isDeterministic: boolean;
}

export interface ProteinComparisonResult {
  provenance: ComparisonProvenance;
  sequenceAlignment?: SequenceAlignmentResult;
  atomCorrespondence: AtomCorrespondenceResult;
  superposition: WeightedKabschResult;
  metrics: StructuralSimilarityMetrics;
  cacheKey: string;
  epistemicStatus: 'ESTABLISHED' | 'HYPOTHESIS' | 'UNRESOLVED';
}
