/**
 * MOCS-Cert Molecular Sequence & Annotation Subsystem — Residue Identity
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: wwPDB / mmCIF PDBx Exchange Dictionary
 */

import type { CanonicalResidueKey, SequenceResidue } from './types';

/**
 * Common modified / non-standard residues and their parent amino acid / nucleotide.
 */
export const MODIFIED_RESIDUE_PARENTS: Record<string, { parent: string; code1: string; description: string }> = {
  // Selenomethionine
  'MSE': { parent: 'MET', code1: 'M', description: 'Selenomethionine' },
  // Phosphorylated amino acids
  'SEP': { parent: 'SER', code1: 'S', description: 'Phosphoserine' },
  'TPO': { parent: 'THR', code1: 'T', description: 'Phosphothreonine' },
  'PTR': { parent: 'TYR', code1: 'Y', description: 'Phosphotyrosine' },
  'NEP': { parent: 'HIS', code1: 'H', description: 'N1-phosphohistidine' },
  // Acetylated amino acids
  'ALY': { parent: 'LYS', code1: 'K', description: 'N6-acetyllysine' },
  'ACY': { parent: 'CYS', code1: 'C', description: 'Acetylcysteine' },
  // Methylated amino acids
  'MLZ': { parent: 'LYS', code1: 'K', description: 'N-methyllysine' },
  'MLY': { parent: 'LYS', code1: 'K', description: 'N-dimethyllysine' },
  'M3L': { parent: 'LYS', code1: 'K', description: 'N-trimethyllysine' },
  'DA2': { parent: 'ARG', code1: 'R', description: 'Asymmetric dimethylarginine' },
  // Hydroxylated
  'HYP': { parent: 'PRO', code1: 'P', description: '4-hydroxyproline' },
  // Carboxylated
  'CGU': { parent: 'GLU', code1: 'E', description: 'Gamma-carboxyglutamic acid' },
  // Formylated
  'FME': { parent: 'MET', code1: 'M', description: 'N-formylmethionine' },
  // Pyroglutamate
  'PCA': { parent: 'GLU', code1: 'E', description: 'Pyroglutamic acid' },
  // Modified nucleic acids
  '5MC': { parent: 'DC', code1: 'C', description: '5-methylcytosine' },
  '5MU': { parent: 'DT', code1: 'T', description: '5-methyluridine' },
  'PSU': { parent: 'U', code1: 'U', description: 'Pseudouridine' },
  '1MA': { parent: 'A', code1: 'A', description: '1-methyladenosine' },
  '7MG': { parent: 'G', code1: 'G', description: '7-methylguanosine' },
  'OMC': { parent: 'C', code1: 'C', description: "2'-O-methylcytidine" },
  'OMG': { parent: 'G', code1: 'G', description: "2'-O-methylguanosine" },
};

/**
 * Builds a globally unique canonical residue key.
 * Format: `${structureId}:${modelId}:${entityId}:${chainId}:${residueName}:${authorResNum}${insCode ? ':' + insCode : ''}`
 */
export function buildCanonicalResidueKey(
  structureId: string,
  modelId: number,
  entityId: string,
  chainId: string,
  residueName: string,
  authorResNum: number,
  insCode?: string
): CanonicalResidueKey {
  const normStructure = structureId.trim().toUpperCase();
  const normEntity = entityId.trim();
  const normChain = chainId.trim();
  const normResName = residueName.trim().toUpperCase();
  const trimmedIns = insCode && insCode.trim().length > 0 ? `:${insCode.trim().toUpperCase()}` : '';
  return `${normStructure}:${modelId}:${normEntity}:${normChain}:${normResName}:${authorResNum}${trimmedIns}`;
}

export interface ParsedResidueKey {
  structureId: string;
  modelId: number;
  entityId: string;
  chainId: string;
  residueName: string;
  authorResNum: number;
  insertionCode?: string;
}

/**
 * Parses a canonical residue key into its constituent structural tokens.
 */
export function parseCanonicalResidueKey(key: CanonicalResidueKey): ParsedResidueKey {
  const parts = key.split(':');
  if (parts.length < 6) {
    throw new Error(`Invalid canonical residue key format: "${key}". Expected at least 6 tokens.`);
  }

  const structureId = parts[0];
  const modelId = parseInt(parts[1], 10);
  const entityId = parts[2];
  const chainId = parts[3];
  const residueName = parts[4];
  const authorResNum = parseInt(parts[5], 10);
  const insertionCode = parts.length > 6 ? parts[6] : undefined;

  return {
    structureId,
    modelId,
    entityId,
    chainId,
    residueName,
    authorResNum,
    insertionCode,
  };
}

/**
 * Formats a residue for user-facing display.
 */
export function formatResidueDisplay(
  residue: {
    resName: string;
    authorResNum: number;
    insertionCode?: string;
    authAsymId?: string;
    chainId?: string;
    code1?: string;
  },
  style: 'compact' | 'standard' | 'full' | 'author' = 'standard'
): string {
  const chain = residue.authAsymId || residue.chainId || '';
  const ins = residue.insertionCode ? residue.insertionCode : '';
  const numWithIns = `${residue.authorResNum}${ins}`;

  switch (style) {
    case 'compact':
      return `${residue.code1 || residue.resName}${numWithIns}`;
    case 'author':
      return chain ? `${chain}:${numWithIns}` : `${numWithIns}`;
    case 'full':
      return chain
        ? `${residue.resName} ${numWithIns} (Chain ${chain})`
        : `${residue.resName} ${numWithIns}`;
    case 'standard':
    default:
      return chain
        ? `${residue.resName}${numWithIns}:${chain}`
        : `${residue.resName}${numWithIns}`;
  }
}

/**
 * Compares two residues by author sequence number and insertion code.
 * Ensures strict ordering: 99 < 100 < 100A < 100B < 100C < 101.
 * Supports negative author numbers (e.g. -2 < -1 < 0 < 1).
 */
export function compareResiduesByAuthorNumber(
  a: { authorResNum: number; insertionCode?: string },
  b: { authorResNum: number; insertionCode?: string }
): number {
  if (a.authorResNum !== b.authorResNum) {
    return a.authorResNum - b.authorResNum;
  }

  const insA = (a.insertionCode || '').trim();
  const insB = (b.insertionCode || '').trim();

  if (insA === insB) return 0;
  if (!insA) return -1; // No insertion code comes before insertion code (100 < 100A)
  if (!insB) return 1;

  return insA.localeCompare(insB);
}

/**
 * Checks whether a residue name is a known modified residue.
 */
export function isModifiedResidue(resName: string): boolean {
  return resName.trim().toUpperCase() in MODIFIED_RESIDUE_PARENTS;
}

/**
 * Resolves parent standard residue name for a modified residue.
 */
export function getParentResidueName(resName: string): string {
  const upper = resName.trim().toUpperCase();
  const mod = MODIFIED_RESIDUE_PARENTS[upper];
  return mod ? mod.parent : upper;
}
