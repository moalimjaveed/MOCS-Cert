/**
 * MOCS-Cert Ligand Identity & Component Classification Engine
 * 
 * Enforces canonical multi-tier identity:
 * Structure -> Model -> Entity -> Chain -> ResidueName -> ResidueNumber -> InsertionCode -> Atom
 * 
 * Strictly prevents conflating ligand instances sharing the same residue name
 * (e.g. HEM 142 on Chain A vs HEM 142 on Chain C in 4HHB).
 */

import type { StructureHierarchyIndex, IndexedComponent, ValidatedAtom } from '../geometry/structuralIdentity';
import {
  PROTEIN_RESIDUES,
  NUCLEIC_RESIDUES,
  WATER_RESIDUES,
  ION_RESIDUES,
  BUFFER_RESIDUES,
  GLYCAN_RESIDUES,
  COFACTOR_RESIDUES,
  classifyResidue,
} from '../geometry/structuralIdentity';
import type { LigandInstanceIdentity, InteractionProvenance } from './types';

export const BIOLOGICAL_METALS = new Set([
  'FE', 'FE2', 'FE3', 'ZN', 'MG', 'CA', 'MN', 'CU', 'CU1', 'CU2',
  'NI', 'CO', 'CD', 'PB', 'HG', 'PT', 'SR', 'BA', 'MO', 'V', 'W'
]);

export const PROSTHETIC_GROUPS = new Set([
  'HEM', 'HEA', 'HEB', 'HEC', 'FAD', 'FMN', 'PLP', 'PQQ', 'TPQ', 'TTQ'
]);

/**
 * Builds a globally unique, chain- and model-scoped ligand instance key.
 * Example: "4HHB:1:A:HEM:142" or "4HHB:1:C:HEM:142"
 */
export function buildLigandInstanceKey(
  structureId: string,
  modelId: string | number,
  chainId: string,
  residueName: string,
  residueNumber: number,
  insertionCode?: string
): string {
  const sId = (structureId || 'STRUCTURE').toUpperCase().trim();
  const mId = String(modelId ?? 1);
  const cId = (chainId || 'A').toUpperCase().trim();
  const rName = (residueName || 'LIG').toUpperCase().trim();
  const rSeq = Number(residueNumber) || 0;
  const ins = insertionCode ? `:${insertionCode.trim()}` : '';
  return `${sId}:${mId}:${cId}:${rName}:${rSeq}${ins}`;
}

/**
 * Checks if two ligand instances are identical across all hierarchy tiers.
 */
export function areLigandInstancesEqual(
  a: LigandInstanceIdentity,
  b: LigandInstanceIdentity
): boolean {
  return (
    a.structureId.toUpperCase() === b.structureId.toUpperCase() &&
    String(a.modelId) === String(b.modelId) &&
    a.chainId.toUpperCase() === b.chainId.toUpperCase() &&
    a.residueName.toUpperCase() === b.residueName.toUpperCase() &&
    a.residueNumber === b.residueNumber &&
    (a.insertionCode || '') === (b.insertionCode || '')
  );
}

/**
 * Determines whether an element or residue represents a biological metal.
 */
export function isMetalCenter(elementOrResName: string): boolean {
  const norm = (elementOrResName || '').toUpperCase().trim();
  return BIOLOGICAL_METALS.has(norm);
}

/**
 * Computes 3D geometric centroid of an atom array.
 */
export function computeAtomCentroid(atoms: ValidatedAtom[]): [number, number, number] {
  if (!atoms || atoms.length === 0) return [0, 0, 0];
  let sx = 0, sy = 0, sz = 0;
  let count = 0;
  for (const a of atoms) {
    if (a.coordinates && Array.isArray(a.coordinates) && a.coordinates.length === 3) {
      sx += a.coordinates[0];
      sy += a.coordinates[1];
      sz += a.coordinates[2];
      count++;
    }
  }
  if (count === 0) return [0, 0, 0];
  return [
    Number((sx / count).toFixed(3)),
    Number((sy / count).toFixed(3)),
    Number((sz / count).toFixed(3)),
  ];
}

/**
 * Extracts and classifies all discrete ligand instances from a StructureHierarchyIndex.
 * Guarantees that copies in different chains/models receive distinct instance identities.
 */
export function extractLigandInstances(
  hierarchyIndex: StructureHierarchyIndex,
  provenance: InteractionProvenance = 'EXPERIMENTAL_DEPOSITED'
): LigandInstanceIdentity[] {
  const instances: LigandInstanceIdentity[] = [];

  for (const comp of hierarchyIndex.allComponents) {
    const resName = comp.id.residueName.toUpperCase().trim();

    // Strictly skip solvent/water, buffers, standard proteins, and nucleic acids
    if (WATER_RESIDUES.has(resName) || comp.id.classification === 'solvent') continue;
    if (BUFFER_RESIDUES.has(resName) || comp.id.classification === 'buffer') continue;
    if (PROTEIN_RESIDUES.has(resName) || comp.id.classification === 'protein') continue;
    if (NUCLEIC_RESIDUES.has(resName) || comp.id.classification === 'nucleic') continue;

    const isCofactor = COFACTOR_RESIDUES.has(resName) || comp.id.classification === 'cofactor';
    const isProsthetic = PROSTHETIC_GROUPS.has(resName);
    const isMetal = BIOLOGICAL_METALS.has(resName) || comp.atoms.some(a => isMetalCenter(a.element));

    const instanceKey = buildLigandInstanceKey(
      hierarchyIndex.structureId,
      comp.id.modelId,
      comp.id.chainId,
      resName,
      comp.id.residueNumber,
      comp.id.insertionCode
    );

    instances.push({
      structureId: hierarchyIndex.structureId,
      modelId: comp.id.modelId,
      chainId: comp.id.chainId,
      entityId: comp.id.entityId,
      residueName: resName,
      residueNumber: comp.id.residueNumber,
      insertionCode: comp.id.insertionCode,
      instanceKey,
      classification: isCofactor ? 'cofactor' : (isMetal ? 'ion' : 'ligand'),
      isCofactor,
      isProstheticGroup: isProsthetic,
      isMetalIon: isMetal,
      provenance,
      atomCount: comp.atoms.length,
      centroid: computeAtomCentroid(comp.atoms),
    });
  }

  return instances;
}
