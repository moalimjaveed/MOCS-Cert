/**
 * Master Structure Quality & Experimental Evidence Auditor
 * 
 * Orchestrates complete quality auditing, strictly maintaining the epistemic
 * partition between SOURCE_METADATA and DERIVED_ANALYSIS.
 */

import {
  classifyExperimentalMethod,
  parseResolutionMetadata,
  parseCrystallographicRefinement,
} from './metadataParser';
import {
  analyzeBfactorDistribution,
  analyzeOccupancyDistribution,
  type QualityAtomRecord,
} from './bfactorOccupancy';
import {
  auditMissingAtoms,
  auditMissingResidues,
  auditChainBreaks,
  type ModeledResidueInput,
} from './completenessAnalyzer';
import {
  evaluateRamachandran,
  auditStericClashes,
  type ResidueBackboneAtoms,
  type ClashAtomInput,
} from './geometricValidation';
import { evaluateBiologicalAssembly } from './biologicalAssembly';
import type {
  StructureQualityReport,
  ValueOrigin,
} from './types';

export interface QualityAuditInput {
  structureId: string;
  method?: string | null;
  kind?: string | null;
  resolution?: number | string | null;
  rWork?: number | string | null;
  rFree?: number | string | null;
  refinementProgram?: string | null;
  spaceGroup?: string | null;
  unitCell?: { a: number; b: number; c: number; alpha: number; beta: number; gamma: number } | null;
  depositionYear?: number | null;
  depositionDate?: string | null;
  releaseDate?: string | null;
  authors?: string[];
  citationTitle?: string | null;
  doi?: string | null;
  assembly?: {
    assemblyId?: string | null;
    details?: string | null;
    oligomericState?: string | null;
    transformCount?: number | null;
    stoichiometry?: string | null;
  };
  atoms?: QualityAtomRecord[];
  modeledResidues?: ModeledResidueInput[];
  canonicalSequence?: Array<{ chainId: string; resNum: number; resName: string }>;
  backboneResidues?: ResidueBackboneAtoms[];
  clashAtoms?: ClashAtomInput[];
}

/**
 * Executes an exhaustive, traceable structure quality audit.
 */
export function auditStructureQuality(
  input: QualityAuditInput
): StructureQualityReport {
  const method = classifyExperimentalMethod(input.method, input.kind);
  const isExperimental =
    method === 'X_RAY_DIFFRACTION' ||
    method === 'ELECTRON_MICROSCOPY' ||
    method === 'SOLUTION_NMR' ||
    method === 'SOLID_STATE_NMR' ||
    method === 'NEUTRON_DIFFRACTION' ||
    method === 'ELECTRON_CRYSTALLOGRAPHY';

  const resolution = parseResolutionMetadata(input.resolution, method);
  const refinement = parseCrystallographicRefinement(
    {
      rWork: input.rWork,
      rFree: input.rFree,
      refinementProgram: input.refinementProgram,
      spaceGroup: input.spaceGroup,
      unitCell: input.unitCell,
      depositionYear: input.depositionYear,
    },
    method
  );

  const bFactorSummary = analyzeBfactorDistribution(input.atoms ?? []);
  const occupancySummary = analyzeOccupancyDistribution(input.atoms ?? []);

  const missingAtoms = auditMissingAtoms(input.modeledResidues ?? []);
  const missingResidues = auditMissingResidues(
    input.canonicalSequence ?? [],
    input.modeledResidues ?? []
  );
  const chainBreaks = auditChainBreaks(input.modeledResidues ?? []);

  const ramachandranAngles = evaluateRamachandran(input.backboneResidues ?? []);
  const ramaTotal = ramachandranAngles.filter((r) => r.category !== 'NOT_APPLICABLE').length;
  const ramaFavored = ramachandranAngles.filter((r) => r.category === 'FAVORED').length;
  const ramaAllowed = ramachandranAngles.filter((r) => r.category === 'ALLOWED').length;
  const ramaOutlier = ramachandranAngles.filter((r) => r.category === 'OUTLIER').length;

  const rawClashes = auditStericClashes(input.clashAtoms ?? []);
  const severeClashes = rawClashes.filter((c) => c.isSevereClash);

  const biologicalAssembly = input.assembly
    ? evaluateBiologicalAssembly(input.assembly)
    : null;

  const epistemicWarnings: string[] = [];

  if (!isExperimental) {
    epistemicWarnings.push(
      'Structure is a computed hypothesis or synthetic benchmark; experimental crystallographic validation metrics do not apply.'
    );
  }

  if (isExperimental && method === 'X_RAY_DIFFRACTION' && refinement.rFree === null) {
    epistemicWarnings.push(
      refinement.notes || 'R-free cross-validation metric is unrecorded.'
    );
  }

  if (missingResidues.length > 0) {
    epistemicWarnings.push(
      `Structure contains ${missingResidues.length} unresolved residues present in sequence but unmodeled in electron density.`
    );
  }

  if (chainBreaks.length > 0) {
    epistemicWarnings.push(
      `Detected ${chainBreaks.length} structural chain break(s); polypeptide chain is not continuous in 3D coordinates.`
    );
  }

  if (severeClashes.length > 0) {
    epistemicWarnings.push(
      `Identified ${severeClashes.length} severe steric clash(es) exceeding 0.4 Å van der Waals overlap.`
    );
  }

  if (ramaTotal > 0 && ramaOutlier / ramaTotal > 0.05) {
    epistemicWarnings.push(
      `High Ramachandran outlier rate: ${((ramaOutlier / ramaTotal) * 100).toFixed(1)}% of residues have non-canonical backbone dihedrals.`
    );
  }

  const sourceVersusDerivedMap: Record<string, ValueOrigin> = {
    resolution: 'SOURCE_METADATA',
    rWork: 'SOURCE_METADATA',
    rFree: 'SOURCE_METADATA',
    spaceGroup: 'SOURCE_METADATA',
    unitCell: 'SOURCE_METADATA',
    refinementProgram: 'SOURCE_METADATA',
    depositionMetadata: 'SOURCE_METADATA',
    biologicalAssembly: 'SOURCE_METADATA',
    bFactorSummary: 'DERIVED_ANALYSIS',
    occupancySummary: 'DERIVED_ANALYSIS',
    missingAtoms: 'DERIVED_ANALYSIS',
    missingResidues: 'DERIVED_ANALYSIS',
    chainBreaks: 'DERIVED_ANALYSIS',
    ramachandran: 'DERIVED_ANALYSIS',
    clashSummary: 'DERIVED_ANALYSIS',
  };

  return {
    structureId: input.structureId,
    method,
    isExperimental,
    resolution,
    refinement,
    bFactorSummary,
    occupancySummary,
    missingAtoms,
    missingResidues,
    chainBreaks,
    ramachandran: {
      totalEvaluated: ramaTotal,
      favoredCount: ramaFavored,
      allowedCount: ramaAllowed,
      outlierCount: ramaOutlier,
      favoredPercentage: ramaTotal > 0 ? Number(((ramaFavored / ramaTotal) * 100).toFixed(1)) : 0,
      outlierPercentage: ramaTotal > 0 ? Number(((ramaOutlier / ramaTotal) * 100).toFixed(1)) : 0,
    },
    clashSummary: {
      totalClashes: rawClashes.length,
      severeClashCount: severeClashes.length,
      clashes: severeClashes.slice(0, 50), // Cap at 50 for reporting
    },
    biologicalAssembly,
    depositionMetadata: {
      depositionDate: input.depositionDate ?? null,
      releaseDate: input.releaseDate ?? null,
      authors: input.authors ?? [],
      citationTitle: input.citationTitle ?? null,
      doi: input.doi ?? null,
    },
    sourceVersusDerivedMap,
    epistemicWarnings,
  };
}
