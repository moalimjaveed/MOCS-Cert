/**
 * MOCS-Cert — Residue & Component Biochemical Classifier.
 *
 * Deterministic classification of residues into biochemical roles.
 * No React, no Mol*, no Three.js.
 */

export type ResidueClassification =
  | 'protein'
  | 'nucleic'
  | 'ligand'
  | 'cofactor'
  | 'ion'
  | 'buffer'
  | 'solvent'
  | 'carbohydrate'
  | 'custom';

export const PROTEIN_RESIDUES: ReadonlySet<string> = new Set([
  'ALA','ARG','ASN','ASP','CYS','GLN','GLU','GLY','HIS','ILE',
  'LEU','LYS','MET','PHE','PRO','SER','THR','TRP','TYR','VAL',
  'MSE','SEC','PYL','UNK','ASX','GLX','XLE','PCA','HYP','MLY','FME',
  'SEP','TPO','PTR','CSO','CME','OCS','KCX','LLP','TYS',
]);

export const DNA_RESIDUES: ReadonlySet<string> = new Set([
  'DA','DC','DG','DT','DI','DU',
]);

export const RNA_RESIDUES: ReadonlySet<string> = new Set([
  'A','C','G','U','I',
]);

export const AMBIGUOUS_NUCLEIC_RESIDUES: ReadonlySet<string> = new Set([
  'N','AN','CN','GN','TN','UN',
]);

export const MODIFIED_NUCLEIC_RESIDUES: ReadonlySet<string> = new Set([
  '5MC','5MU','PSU','M2G','OMG','OMC','OMU','OMA','1MA','2MG',
  'M7G','YG','H2U','4SU','S4U','MIA','T6A','MA6','6MA',
]);

export const NUCLEIC_RESIDUES: ReadonlySet<string> = new Set([
  ...DNA_RESIDUES,
  ...RNA_RESIDUES,
  ...AMBIGUOUS_NUCLEIC_RESIDUES,
  ...MODIFIED_NUCLEIC_RESIDUES,
]);

export const WATER_RESIDUES: ReadonlySet<string> = new Set([
  'HOH','WAT','H2O','DOD','TIP','TIP3','SOL','H3O','OH',
]);

export const ION_RESIDUES: ReadonlySet<string> = new Set([
  'ZN','MG','CA','NA','CL','FE','FE2','MN','K','CU','CU1',
  'NI','CO','CD','PB','HG','PT','SR','BA','BR','IOD','LI','CS',
]);

export const BUFFER_RESIDUES: ReadonlySet<string> = new Set([
  'PO4','SO4','CIT','ACT','EDO','PEG','DMS','GOL','FMT',
  'TRS','MES','EPE','BME','DTT','MPD','PGE','PG4',
]);

export const CARBOHYDRATE_RESIDUES: ReadonlySet<string> = new Set([
  'NAG','MAN','BMA','FUC','GAL','GLC','SIA','NDG','FUL','A2G',
]);

export const COFACTOR_RESIDUES: ReadonlySet<string> = new Set([
  'HEM','HEA','HEB','HEC',
  'NAD','NAP','FAD','FMN','ATP','ADP','AMP','ANP','GTP','GDP',
  'SAM','SAH','COA','ACO','PLP','TPP','THF','BTN',
]);

/**
 * Classifies a residue name into its biochemical role.
 *
 * @param resName - The residue/component name (e.g. 'ALA', 'HEM', 'HOH').
 * @param isPolymer - Whether this residue is part of a polymer chain.
 * @param chemicalTypeHint - Optional hint from mmCIF _chem_comp.type.
 */
export function classifyResidue(
  resName: string,
  isPolymer = false,
  chemicalTypeHint?: string
): ResidueClassification {
  const norm = (resName ?? '').toUpperCase().trim();
  if (!norm) return 'custom';

  if (WATER_RESIDUES.has(norm)) return 'solvent';
  if (BUFFER_RESIDUES.has(norm)) return 'buffer';
  if (CARBOHYDRATE_RESIDUES.has(norm)) return 'carbohydrate';
  if (norm === 'I') return isPolymer ? 'nucleic' : 'ion';
  if (ION_RESIDUES.has(norm)) return 'ion';
  if (COFACTOR_RESIDUES.has(norm)) return 'cofactor';
  if (NUCLEIC_RESIDUES.has(norm)) return 'nucleic';
  if (PROTEIN_RESIDUES.has(norm)) return 'protein';

  if (chemicalTypeHint) {
    const hint = chemicalTypeHint.toLowerCase();
    if (hint.includes('nucleotide') || hint.includes('rna') || hint.includes('dna')) return 'nucleic';
    if (hint.includes('peptide') || hint.includes('amino') || hint.includes('protein')) return 'protein';
    if (hint.includes('ion')) return 'ion';
    if (hint.includes('water')) return 'solvent';
    if (hint.includes('saccharide') || hint.includes('carbohydrate')) return 'carbohydrate';
  }

  if (isPolymer) {
    if (norm.startsWith('D') && norm.length <= 2) return 'nucleic';
    if (['A','C','G','U'].includes(norm)) return 'nucleic';
    return 'custom';
  }

  return 'ligand';
}

/** Returns the nucleic acid type for a residue name. */
export function classifyNucleicType(resName: string): 'dna' | 'rna' | 'hybrid' | 'unspecified' {
  const norm = (resName ?? '').toUpperCase().trim();
  if (DNA_RESIDUES.has(norm)) return 'dna';
  if (RNA_RESIDUES.has(norm)) return 'rna';
  if (AMBIGUOUS_NUCLEIC_RESIDUES.has(norm) || MODIFIED_NUCLEIC_RESIDUES.has(norm)) return 'unspecified';
  return 'unspecified';
}
