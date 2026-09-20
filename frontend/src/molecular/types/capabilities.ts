/**
 * Dataset Capability Model
 *
 * Exposes authentic biological capabilities computed dynamically
 * from the currently loaded CanonicalStructure coordinate bundle.
 */

import type { CanonicalStructure } from '@mocs/core';

export interface DatasetCapabilities {
  readonly protein: boolean;
  readonly dna: boolean;
  readonly rna: boolean;
  readonly nucleic: boolean;
  readonly ligand: boolean;
  readonly solvent: boolean;
  readonly ions: boolean;
  readonly trajectory: boolean;
  readonly measurements: boolean;
  readonly aabbProtein: boolean;
  readonly aabbNucleic: boolean;
  readonly aabbLigand: boolean;
  readonly focus: boolean;
  readonly explore: boolean;
  readonly hasBlocks: boolean;
}

const STANDARD_AMINO_ACIDS = new Set([
  'ALA', 'ARG', 'ASN', 'ASP', 'CYS', 'GLN', 'GLU', 'GLY', 'HIS', 'ILE',
  'LEU', 'LYS', 'MET', 'PHE', 'PRO', 'SER', 'THR', 'TRP', 'TYR', 'VAL',
  'MSE', 'SEC', 'PYL'
]);

const DNA_BASES = new Set(['DA', 'DT', 'DC', 'DG', 'DI']);
const RNA_BASES = new Set(['A', 'U', 'C', 'G', 'I']);
const SOLVENT_RESIDUES = new Set(['HOH', 'WAT', 'DOD', 'TIP', 'TIP3', 'SOL']);
const COMMON_ION_SYMBOLS = new Set(['NA', 'CL', 'MG', 'ZN', 'CA', 'K', 'MN', 'CU', 'FE', 'CO', 'NI']);

export function computeDatasetCapabilities(structure: CanonicalStructure | null | undefined): DatasetCapabilities {
  if (!structure || !structure.topology) {
    return {
      protein: false,
      dna: false,
      rna: false,
      nucleic: false,
      ligand: false,
      solvent: false,
      ions: false,
      trajectory: false,
      measurements: false,
      aabbProtein: false,
      aabbNucleic: false,
      aabbLigand: false,
      focus: false,
      explore: false,
      hasBlocks: false,
    };
  }

  const datasetId = (structure.datasetId || '').toLowerCase();
  const atoms = structure.topology.atoms || [];
  const components = structure.components || [];

  const hasProteinComp = components.some((c) => c.kind === 'protein' && c.atomIndices.length > 0);
  const hasNucleicComp = components.some((c) => c.kind === 'nucleic' && c.atomIndices.length > 0);
  const hasLigandComp = components.some((c) => c.kind === 'ligand' && c.atomIndices.length > 0);
  const hasSolventComp = components.some((c) => c.kind === 'solvent' && c.atomIndices.length > 0);
  const hasIonComp = components.some((c) => c.kind === 'ion' && c.atomIndices.length > 0);

  const hasProteinAtoms = hasProteinComp || atoms.some((a) => STANDARD_AMINO_ACIDS.has(a.resName.toUpperCase()));
  const hasDnaAtoms = atoms.some((a) => DNA_BASES.has(a.resName.toUpperCase()));
  const hasRnaAtoms = atoms.some((a) => RNA_BASES.has(a.resName.toUpperCase()) && !STANDARD_AMINO_ACIDS.has(a.resName.toUpperCase()));

  const nucleic = hasNucleicComp || hasDnaAtoms || hasRnaAtoms;
  const dna = hasDnaAtoms || (nucleic && !hasRnaAtoms);
  const rna = hasRnaAtoms;

  const ligand = hasLigandComp;
  const solvent = hasSolventComp || atoms.some((a) => SOLVENT_RESIDUES.has(a.resName.toUpperCase()));
  const ions = hasIonComp || atoms.some((a) => COMMON_ION_SYMBOLS.has(a.element.toUpperCase()));

  const trajectory = structure.models.length > 1 || datasetId.includes('synth') || datasetId.includes('trajectory');
  const hasBlocks = datasetId.includes('synth') || datasetId.includes('block41');

  return {
    protein: hasProteinAtoms,
    dna,
    rna,
    nucleic,
    ligand,
    solvent,
    ions,
    trajectory,
    measurements: structure.topology.atomCount >= 2,
    aabbProtein: hasProteinAtoms,
    aabbNucleic: nucleic,
    aabbLigand: ligand,
    focus: structure.topology.atomCount > 0,
    explore: true,
    hasBlocks,
  };
}
