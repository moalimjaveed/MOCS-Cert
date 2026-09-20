/**
 * MOCS Mathematical Protein Intelligence Subsystem — Main Public API
 */

import type { StructureMathematicalAnalysis } from './types';
import { analyzeStructuralGeometry, extractAtomCoords, type CartesianAtom } from './geometryEngine';
import { analyzeStructuralTopology } from './topologyEngine';
import { analyzeDesignComplexity } from './complexityEngine';
import { analyzeHydrodynamics } from './hydrodynamicsModule';
import { analyzeMathematicalPhysics } from './mathematicalPhysicsModule';
import { analyzeNumberTheoreticSandbox } from './numberTheoreticModule';
import { RESEARCH_HYPOTHESES } from './hypothesisRegistry';

export * from './types';
export * from './geometryEngine';
export * from './topologyEngine';
export * from './complexityEngine';
export * from './hydrodynamicsModule';
export * from './mathematicalPhysicsModule';
export * from './numberTheoreticModule';
export * from './providerInterfaces';
export * from './hypothesisRegistry';

export interface AnalysisOptions {
  sequence?: string;
  filtrationRadius?: number;
  symmetryHint?: string;
  measuredPruningEfficiency?: number;
  measuredPruningRate?: number;
}

export interface AnalysisObjectParam extends AnalysisOptions {
  structureId: string;
  atoms?: CartesianAtom[];
}

/**
 * Executes the complete mathematical intelligence suite on a loaded structure's atoms.
 * Supports both direct arguments (structureId, atoms, options) and single options object.
 */
export function analyzeStructureIntelligence(
  param1: string | AnalysisObjectParam,
  param2?: CartesianAtom[],
  param3?: AnalysisOptions
): StructureMathematicalAnalysis {
  let structureId: string;
  let atoms: CartesianAtom[];
  let options: AnalysisOptions | undefined;

  if (typeof param1 === 'object' && param1 !== null) {
    structureId = param1.structureId;
    atoms = param1.atoms || [];
    options = param1;
  } else {
    structureId = param1;
    atoms = param2 || [];
    options = param3;
  }

  const rawAtoms = atoms || [];
  const coords = rawAtoms.map(extractAtomCoords);

  const geometry = analyzeStructuralGeometry(rawAtoms);
  const topology = analyzeStructuralTopology(
    rawAtoms.map((a, i) => ({
      id: i,
      label: a.name || `Atom_${i}`,
      coords: extractAtomCoords(a),
    })),
    options?.filtrationRadius ?? 7.0
  );

  const pruningRate = options?.measuredPruningRate ?? options?.measuredPruningEfficiency ?? 97.1;
  const seqLength = options?.sequence?.length
    ? options.sequence.length
    : geometry.residueCount > 0
    ? geometry.residueCount
    : Math.max(1, Math.floor(rawAtoms.length / 8));

  const complexity = analyzeDesignComplexity(seqLength, pruningRate);
  const hydrodynamics = analyzeHydrodynamics(geometry.radiusOfGyration);
  const physics = analyzeMathematicalPhysics(rawAtoms, options?.symmetryHint);
  const numberTheory = analyzeNumberTheoreticSandbox(coords, options?.sequence);

  return {
    structureId,
    timestamp: new Date().toISOString(),
    geometry,
    topology,
    complexity,
    hydrodynamics,
    physics,
    mathematicalPhysics: physics,
    numberTheory,
    numberTheoretic: numberTheory,
    hypotheses: [...RESEARCH_HYPOTHESES],
  };
}
