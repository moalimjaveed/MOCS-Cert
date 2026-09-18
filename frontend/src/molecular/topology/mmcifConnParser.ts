/**
 * mmCIF Structural Connectivity (_struct_conn) & Chemical Component Bond Parser
 * 
 * Epistemic Rules:
 * 1. _struct_conn provides deposited inter-residue and polymer-ligand connections
 *    (covalent crosslinks, disulfides, metal coordination, modified residues).
 * 2. _chem_comp_bond defines intra-component authoritative chemical topology.
 * 3. Never confuse metal coordination ('metalc') with standard covalent single bonds.
 */

import { buildCanonicalAtomKey, buildCanonicalBondKey } from './atomIdentity';
import type { CanonicalAtomKey, CanonicalBondKey, BondType } from './types';

export interface StructConnRecord {
  id?: string;
  connTypeId: string; // 'covale', 'disulf', 'metalc', 'hydrog', 'modres'
  ptnr1: {
    chainId: string;
    residueName: string;
    residueNumber: number;
    insertionCode?: string;
    atomName: string;
    altLoc?: string;
  };
  ptnr2: {
    chainId: string;
    residueName: string;
    residueNumber: number;
    insertionCode?: string;
    atomName: string;
    altLoc?: string;
  };
  distance?: number;
}

export interface ChemCompBondRecord {
  compId: string;
  atomId1: string;
  atomId2: string;
  valueOrder: 'SING' | 'DOUB' | 'TRIP' | 'AROM' | 'QUAD' | string;
  isAromatic: boolean;
}

export interface ParsedStructConnBond {
  key: CanonicalBondKey;
  atomAKey: CanonicalAtomKey;
  atomBKey: CanonicalAtomKey;
  bondType: BondType;
  bondOrder: number | null;
  isAromatic: boolean;
  connTypeId: string;
}

/**
 * Maps mmCIF conn_type_id to canonical BondType.
 */
export function mapConnTypeToBondType(connType: string): { bondType: BondType; bondOrder: number | null; isCoordination: boolean } {
  const norm = (connType || '').toLowerCase().trim();
  if (norm === 'disulf') {
    return { bondType: 'DISULFIDE', bondOrder: 1, isCoordination: false };
  }
  if (norm === 'metalc') {
    return { bondType: 'METAL_COORDINATION', bondOrder: null, isCoordination: true };
  }
  if (norm === 'covale' || norm === 'modres') {
    return { bondType: 'COVALENT_SINGLE', bondOrder: 1, isCoordination: false };
  }
  return { bondType: 'UNKNOWN', bondOrder: null, isCoordination: false };
}

/**
 * Converts mmCIF _struct_conn entries into ParsedStructConnBonds with canonical atom keys.
 */
export function parseStructConnRecords(
  structureId: string,
  modelId: string | number,
  records: StructConnRecord[]
): ParsedStructConnBond[] {
  const result: ParsedStructConnBond[] = [];
  if (!records || records.length === 0) return result;

  for (const rec of records) {
    const keyA = buildCanonicalAtomKey({
      structureId,
      modelId,
      chainId: rec.ptnr1.chainId,
      residueName: rec.ptnr1.residueName,
      residueNumber: rec.ptnr1.residueNumber,
      insertionCode: rec.ptnr1.insertionCode,
      atomName: rec.ptnr1.atomName,
      altLoc: rec.ptnr1.altLoc,
    });

    const keyB = buildCanonicalAtomKey({
      structureId,
      modelId,
      chainId: rec.ptnr2.chainId,
      residueName: rec.ptnr2.residueName,
      residueNumber: rec.ptnr2.residueNumber,
      insertionCode: rec.ptnr2.insertionCode,
      atomName: rec.ptnr2.atomName,
      altLoc: rec.ptnr2.altLoc,
    });

    if (keyA === keyB) continue; // Self-loop guard

    const bondKey = buildCanonicalBondKey(keyA, keyB);
    const { bondType, bondOrder } = mapConnTypeToBondType(rec.connTypeId);

    result.push({
      key: bondKey,
      atomAKey: keyA < keyB ? keyA : keyB,
      atomBKey: keyA < keyB ? keyB : keyA,
      bondType,
      bondOrder,
      isAromatic: false,
      connTypeId: rec.connTypeId,
    });
  }

  return result;
}
