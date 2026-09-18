/**
 * MOCS-Cert Protein Structural Biology — Unified Protein Comparison Orchestrator
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: wwPDB mmCIF, CASP, TM-score, Horn Quaternion Kabsch Alignment
 */

import type {
  ComparisonScope,
  AtomScope,
  WeightScheme,
  ResiduePairingMode,
  ProteinComparisonResult,
  ComparisonProvenance,
  StructuralSimilarityMetrics,
} from './comparisonTypes';
import {
  buildAtomCorrespondence,
  type ProteinStructureInputAtom,
} from './residueCorrespondence';
import {
  calculateWeightedKabschAlignment,
  calculateTrimmedRmsd,
} from './alignment';
import {
  calculateTmScore,
  calculateGdtScores,
  calculateDistanceMatrixRmsd,
  computeContactMatrix,
  calculateContactMapSimilarity,
} from './similarityMetrics';

export interface CompareProteinsOptions {
  sourceStructureId?: string;
  sourceModelId?: number | string;
  sourceChainId?: string;
  sourceScope?: ComparisonScope;
  sourceKind?: string;

  targetStructureId?: string;
  targetModelId?: number | string;
  targetChainId?: string;
  targetScope?: ComparisonScope;
  targetKind?: string;

  atomScope?: AtomScope;
  pairingMode?: ResiduePairingMode;
  weightScheme?: WeightScheme;
  contactCutoffAngstroms?: number;
  explicitResidueMap?: Map<string, string>;
  targetSequenceLengthOverride?: number;
}

// In-memory deterministic LRU comparison cache
const comparisonCache = new Map<string, ProteinComparisonResult>();
const MAX_CACHE_ENTRIES = 128;

/**
 * Builds a deterministic composite cache key from all comparison parameters.
 */
export function buildComparisonCacheKey(
  sourceAtoms: ProteinStructureInputAtom[],
  targetAtoms: ProteinStructureInputAtom[],
  options: CompareProteinsOptions
): string {
  const sId = options.sourceStructureId || 'src';
  const sModel = options.sourceModelId ?? 1;
  const sChain = options.sourceChainId || 'all';
  const sCount = sourceAtoms.length;

  const tId = options.targetStructureId || 'tgt';
  const tModel = options.targetModelId ?? 1;
  const tChain = options.targetChainId || 'all';
  const tCount = targetAtoms.length;

  const aScope = options.atomScope ?? 'CA';
  const pMode = options.pairingMode ?? 'sequence-alignment';
  const wScheme = options.weightScheme ?? 'uniform';

  return `${sId}:${sModel}:${sChain}:${sCount}__vs__${tId}:${tModel}:${tChain}:${tCount}__scope:${aScope}_pair:${pMode}_w:${wScheme}`;
}

/**
 * Executes a mathematically and biophysically rigorous comparison between two protein structures.
 */
export function compareProteinStructures(
  sourceAtoms: ProteinStructureInputAtom[],
  targetAtoms: ProteinStructureInputAtom[],
  options: CompareProteinsOptions = {}
): ProteinComparisonResult {
  const cacheKey = buildComparisonCacheKey(sourceAtoms, targetAtoms, options);
  if (comparisonCache.has(cacheKey)) {
    return comparisonCache.get(cacheKey)!;
  }

  const atomScope = options.atomScope ?? 'CA';
  const pairingMode = options.pairingMode ?? 'sequence-alignment';
  const weightScheme = options.weightScheme ?? 'uniform';
  const contactCutoff = options.contactCutoffAngstroms ?? 8.0;

  // 1. Build residue and atom correspondence
  const { correspondence, sequenceAlignment } = buildAtomCorrespondence(
    sourceAtoms,
    targetAtoms,
    {
      atomScope,
      pairingMode,
      weightScheme,
      sourceChainId: options.sourceChainId,
      targetChainId: options.targetChainId,
      sourceModelId: options.sourceModelId,
      targetModelId: options.targetModelId,
      explicitResidueMap: options.explicitResidueMap,
    }
  );

  const n = correspondence.pairedCoordsSource.length;
  if (n === 0) {
    throw new Error(
      `No corresponding atoms found between source and target structures under scope '${atomScope}' and mode '${pairingMode}'. Cannot perform structural comparison.`
    );
  }

  // 2. Perform optimal rigid-body Kabsch superposition
  const superposition = calculateWeightedKabschAlignment(
    correspondence.pairedCoordsSource,
    correspondence.pairedCoordsTarget,
    correspondence.weights,
    weightScheme
  );

  // 3. Outlier-trimmed RMSD95
  const residueKeys = correspondence.pairedAtoms.map(
    (p) => `${p.sourceAtom.chainId}:${p.sourceAtom.resSeq}${p.sourceAtom.insCode || ''}`
  );
  const trimmedRmsd95 = calculateTrimmedRmsd(
    superposition.superposedSourceCoords,
    correspondence.pairedCoordsTarget,
    residueKeys,
    95
  );

  // 4. TM-score (Zhang & Skolnick 2004)
  const targetLength = options.targetSequenceLengthOverride ?? (sequenceAlignment?.targetAlignedSeq.replace(/-/g, '').length || n);
  const tmScoreResult = calculateTmScore(
    superposition.superposedSourceCoords,
    correspondence.pairedCoordsTarget,
    targetLength
  );

  // 5. GDT-TS and GDT-HA
  const gdtResult = calculateGdtScores(
    superposition.superposedSourceCoords,
    correspondence.pairedCoordsTarget,
    targetLength
  );

  // 6. Distance Matrix RMSD (dRMSD) — superposition-free
  const dRmsd = calculateDistanceMatrixRmsd(
    correspondence.pairedCoordsSource,
    correspondence.pairedCoordsTarget
  );

  // 7. Contact Map Overlap (CMO)
  const contactMatSource = computeContactMatrix(correspondence.pairedCoordsSource, contactCutoff);
  const contactMatTarget = computeContactMatrix(correspondence.pairedCoordsTarget, contactCutoff);
  const contactSimilarity = calculateContactMapSimilarity(
    contactMatSource,
    contactMatTarget,
    contactCutoff
  );

  // 8. Assemble similarity metrics
  const metrics: StructuralSimilarityMetrics = {
    coordinateRmsd: superposition.rmsd,
    rawCoordinateRmsd: superposition.rawRmsd,
    weightedRmsd: superposition.weightedRmsd,
    trimmedRmsd95,
    tmScore: tmScoreResult.tmScore,
    tmScoreTargetLength: tmScoreResult.targetLength,
    tmScoreD0: tmScoreResult.d0,
    isSameFold: tmScoreResult.isSameFold,
    gdtTs: gdtResult.gdtTs,
    gdtHa: gdtResult.gdtHa,
    gdtCutoffs: gdtResult.cutoffs,
    distanceMatrixRmsd: dRmsd,
    contactMapOverlap: contactSimilarity,
    sequenceIdentityPercent: sequenceAlignment?.sequenceIdentityPercent ?? 0,
    sequenceSimilarityPercent: sequenceAlignment?.sequenceSimilarityPercent ?? 0,
  };

  // 9. Assemble provenance
  const provenance: ComparisonProvenance = {
    sourceStructureId: options.sourceStructureId || 'Source',
    sourceModelId: options.sourceModelId ?? 1,
    sourceChainId: options.sourceChainId || 'ALL',
    sourceScope: options.sourceScope || 'whole-structure',
    sourceKind: options.sourceKind,

    targetStructureId: options.targetStructureId || 'Target',
    targetModelId: options.targetModelId ?? 1,
    targetChainId: options.targetChainId || 'ALL',
    targetScope: options.targetScope || 'whole-structure',
    targetKind: options.targetKind,

    atomScope,
    pairingMode,
    weightScheme,
    timestamp: new Date().toISOString(),
    engineVersion: 'MOCS-Cert Protein Comparison Engine v1.0',
    isDeterministic: true,
  };

  const result: ProteinComparisonResult = {
    provenance,
    sequenceAlignment,
    atomCorrespondence: correspondence,
    superposition,
    metrics,
    cacheKey,
    epistemicStatus: tmScoreResult.isSameFold ? 'ESTABLISHED' : 'HYPOTHESIS',
  };

  // Cache result
  if (comparisonCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = comparisonCache.keys().next().value;
    if (oldestKey) comparisonCache.delete(oldestKey);
  }
  comparisonCache.set(cacheKey, result);

  return result;
}

/**
 * Clears comparison cache (useful for testing and reset events).
 */
export function clearComparisonCache(): void {
  comparisonCache.clear();
}
