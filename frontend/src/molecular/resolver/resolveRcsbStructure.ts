import type { StructureCandidate, StructureProvenance } from '../types';

export class InvalidStructureIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStructureIdError';
  }
}

// Accepts standard 4-character PDB IDs as well as modern extended PDBx identifiers (e.g. pdb_00004hhb, 8D9M)
const PDB_ID_REGEX = /^([0-9a-zA-Z]{4}|PDB_[0-9a-zA-Z]{4,28})$/;

export function normalizePdbId(rawId: string): string {
  if (!rawId || !rawId.trim()) {
    throw new InvalidStructureIdError('PDB ID must not be empty.');
  }
  const clean = rawId.trim().toUpperCase();
  if (!PDB_ID_REGEX.test(clean)) {
    throw new InvalidStructureIdError(
      `Invalid structure identifier format: '${rawId}'. Expected a 4-character PDB code (e.g. '4HHB') or modern PDBx accession.`
    );
  }
  // If formatted as PDB_0000XXXX, extract the 4-char core for standard downloads
  if (clean.startsWith('PDB_0000') && clean.length === 12) {
    return clean.slice(8);
  }
  if (clean.startsWith('PDB_')) {
    return clean.slice(4);
  }
  return clean;
}

export function resolveRcsbStructure(
  pdbId: string,
  preferredFormat: 'bcif' | 'mmcif' | 'pdb' = 'bcif',
  assemblyId?: string
): { candidate: StructureCandidate; fallbackCandidate: StructureCandidate; provenance: StructureProvenance } {
  const cleanId = normalizePdbId(pdbId);
  const isAssembly = assemblyId && assemblyId !== 'deposited';

  // Primary and fallback URLs with assembly support
  const bcifUrl = isAssembly
    ? `https://models.rcsb.org/v1/${cleanId}/assembly?assembly_id=${assemblyId}&encoding=bcif`
    : `https://models.rcsb.org/${cleanId}.bcif`;

  const cifUrl = isAssembly
    ? `https://files.rcsb.org/download/${cleanId}.cif${assemblyId}`
    : `https://files.rcsb.org/download/${cleanId}.cif`;

  const pdbUrl = `https://files.rcsb.org/download/${cleanId}.pdb`;

  let primaryUrl = bcifUrl;
  let fallbackUrl = cifUrl;
  let format: 'bcif' | 'mmcif' | 'pdb' = 'bcif';
  let fallbackFormat: 'bcif' | 'mmcif' | 'pdb' = 'mmcif';

  if (preferredFormat === 'pdb') {
    primaryUrl = pdbUrl;
    fallbackUrl = cifUrl;
    format = 'pdb';
    fallbackFormat = 'mmcif';
  } else if (preferredFormat === 'mmcif') {
    primaryUrl = cifUrl;
    fallbackUrl = bcifUrl;
    format = 'mmcif';
    fallbackFormat = 'bcif';
  }

  const candidateId = isAssembly
    ? `rcsb_${cleanId}_asm${assemblyId}_${format}`
    : `rcsb_${cleanId}_${format}`;

  const candidate: StructureCandidate = {
    id: candidateId,
    source: 'rcsb',
    provider: 'RCSB PDB',
    modelId: cleanId,
    format,
    url: primaryUrl,
    experimental: true,
    assemblyId: isAssembly ? assemblyId : undefined,
  };

  const fallbackCandidate: StructureCandidate = {
    id: `${candidateId}_fallback`,
    source: 'rcsb',
    provider: 'RCSB PDB',
    modelId: cleanId,
    format: fallbackFormat,
    url: fallbackUrl,
    experimental: true,
    assemblyId: isAssembly ? assemblyId : undefined,
  };

  const provenance: StructureProvenance = {
    source: 'rcsb',
    provider: 'RCSB PDB',
    modelId: cleanId,
    format: candidate.format,
    experimental: true,
    sourceUrl: primaryUrl,
  };

  return { candidate, fallbackCandidate, provenance };
}
