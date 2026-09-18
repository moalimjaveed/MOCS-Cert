/**
 * Biological Assembly & Crystallographic Symmetry Engine
 * 
 * Epistemic Rules:
 * 1. The crystallographic Asymmetric Unit (ASU) is the unique structural unit in the crystal lattice.
 * 2. The Biological Assembly (biomolecule) is the functional, physiological macromolecular complex.
 * 3. Never label crystallographic symmetry operations as independently observed experimental coordinates.
 */

import type { BiologicalAssemblyMetadata } from './types';

/**
 * Builds and validates BiologicalAssemblyMetadata.
 */
export function evaluateBiologicalAssembly(
  input: {
    assemblyId?: string | null;
    details?: string | null;
    oligomericState?: string | null;
    transformCount?: number | null;
    stoichiometry?: string | null;
    isAuthorDefined?: boolean;
    isSoftwareGenerated?: boolean;
  }
): BiologicalAssemblyMetadata {
  const assemblyId = input.assemblyId || '1';
  const transformCount = input.transformCount && input.transformCount > 0 ? input.transformCount : 1;

  let oligomericState = input.oligomericState || 'monomer';
  if (!input.oligomericState) {
    if (transformCount === 2) oligomericState = 'dimer';
    else if (transformCount === 4) oligomericState = 'tetramer';
    else if (transformCount === 6) oligomericState = 'hexamer';
  }

  const detailsStr = input.details || '';
  const detailsUpper = detailsStr.toUpperCase();
  const softwareKeyword =
    detailsUpper.includes('PISA') ||
    detailsUpper.includes('PQS') ||
    detailsUpper.includes('SOFTWARE') ||
    detailsUpper.includes('PREDICTED') ||
    detailsUpper.includes('ALGORITHM');

  const isSoftware = input.isSoftwareGenerated !== undefined ? input.isSoftwareGenerated : softwareKeyword;
  const isAuthor = input.isAuthorDefined !== undefined ? input.isAuthorDefined : !isSoftware;

  return {
    assemblyId,
    details: detailsStr || (isAuthor ? 'Author-defined biological assembly' : 'Software-generated assembly'),
    oligomericState,
    isAuthorDefined: isAuthor,
    isSoftwareGenerated: isSoftware,
    transformCount,
    stoichiometry: input.stoichiometry || (transformCount > 1 ? `A${transformCount}` : 'A'),
  };
}
