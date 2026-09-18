/**
 * MOCS-Cert Protein Structural Biology — Non-Covalent & Covalent Interaction Engine
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: Biophysical Chemistry / Protein Science Standards
 */

import type { SaltBridgeInteraction, DisulfideBond } from './types';
import type { ValidatedAtom } from '../geometry/structuralIdentity';
import { calculateEuclideanDistance } from '../measurements/calculations';

export const CANONICAL_SALT_BRIDGE_CUTOFF_ANGSTROMS = 4.0;
export const MIN_DISULFIDE_BOND_DIST = 1.90;
export const MAX_DISULFIDE_BOND_DIST = 2.20;
export const IDEAL_DISULFIDE_BOND_DIST = 2.05;

export interface ProteinAtomRef {
  atom?: ValidatedAtom;
  chainId?: string;
  resSeq?: number;
  resName?: string;
  insCode?: string;
  coordinates?: [number, number, number];
  [key: string]: any;
}

interface NormalizedProteinAtom {
  chainId: string;
  resSeq: number;
  resName: string;
  atomName: string;
  insCode?: string;
  coordinates: [number, number, number];
}

function normalizeProteinAtom(item: any): NormalizedProteinAtom | null {
  if (!item) return null;
  const chainId = item.chainId || item.chain || 'A';
  const resSeq = item.resSeq ?? item.resi ?? item.residueNumber ?? 0;
  const resName = item.resName || item.resn || item.residueName || '';
  const atomName = item.atom?.atomName || item.atomName || item.atom || item.name || '';
  const insCode = item.insCode || item.inscode || item.insertionCode;

  let coords: [number, number, number] | null = null;
  if (item.atom?.coordinates && Array.isArray(item.atom.coordinates)) {
    coords = item.atom.coordinates as [number, number, number];
  } else if (item.coordinates && Array.isArray(item.coordinates)) {
    coords = item.coordinates as [number, number, number];
  } else if (item.coords && Array.isArray(item.coords)) {
    coords = item.coords as [number, number, number];
  } else if (typeof item.x === 'number' && typeof item.y === 'number' && typeof item.z === 'number') {
    coords = [item.x, item.y, item.z];
  }

  if (!coords || !atomName || !resName) {
    return null;
  }

  return {
    chainId: String(chainId),
    resSeq: Number(resSeq),
    resName: String(resName).toUpperCase(),
    atomName: String(atomName).toUpperCase(),
    insCode: insCode ? String(insCode) : undefined,
    coordinates: coords,
  };
}

/**
 * Detects authentic salt bridges between basic (Arg, Lys, His) and acidic (Asp, Glu) residues.
 * Criteria: Heavy atom distance <= 4.0 Å between cationic and anionic sidechain atoms.
 */
export function detectSaltBridges(
  atoms: Array<ProteinAtomRef | any>,
  cutoff = CANONICAL_SALT_BRIDGE_CUTOFF_ANGSTROMS
): SaltBridgeInteraction[] {
  const normalizedAtoms = atoms
    .map(normalizeProteinAtom)
    .filter((a): a is NormalizedProteinAtom => a !== null);

  const cations: NormalizedProteinAtom[] = [];
  const anions: NormalizedProteinAtom[] = [];

  for (const a of normalizedAtoms) {
    const res = a.resName;
    const name = a.atomName;

    // Cationic sidechain atoms
    if (
      (res === 'LYS' && name === 'NZ') ||
      (res === 'ARG' && (name === 'NH1' || name === 'NH2' || name === 'NE')) ||
      (res === 'HIS' && (name === 'ND1' || name === 'NE2'))
    ) {
      cations.push(a);
    }

    // Anionic sidechain atoms
    if (
      (res === 'ASP' && (name === 'OD1' || name === 'OD2')) ||
      (res === 'GLU' && (name === 'OE1' || name === 'OE2'))
    ) {
      anions.push(a);
    }
  }

  const saltBridges: SaltBridgeInteraction[] = [];
  const recordedPairs = new Set<string>();

  for (const cat of cations) {
    for (const an of anions) {
      // Avoid comparing atoms of the exact same residue
      if (cat.chainId === an.chainId && cat.resSeq === an.resSeq && cat.insCode === an.insCode) {
        continue;
      }

      const dist = calculateEuclideanDistance(cat.coordinates, an.coordinates);
      if (dist <= cutoff) {
        const pairKey = `${cat.chainId}:${cat.resSeq}:${cat.atomName}_${an.chainId}:${an.resSeq}:${an.atomName}`;
        if (!recordedPairs.has(pairKey)) {
          recordedPairs.add(pairKey);
          saltBridges.push({
            cationResidue: {
              chainId: cat.chainId,
              residueNumber: cat.resSeq,
              residueName: cat.resName,
              resName: cat.resName,
              atomName: cat.atomName,
            },
            anionResidue: {
              chainId: an.chainId,
              residueNumber: an.resSeq,
              residueName: an.resName,
              resName: an.resName,
              atomName: an.atomName,
            },
            distance: Number(dist.toFixed(2)),
            isInterChain: cat.chainId !== an.chainId,
          });
        }
      }
    }
  }

  return saltBridges;
}

/**
 * Detects covalent disulfide bonds between Cysteine SG sulfur atoms.
 * Criteria: d(SG_i, SG_j) in [1.90, 2.20] Å.
 */
export function detectDisulfideBonds(
  atoms: Array<ProteinAtomRef | any>
): DisulfideBond[] {
  const normalizedAtoms = atoms
    .map(normalizeProteinAtom)
    .filter((a): a is NormalizedProteinAtom => a !== null);

  const cysSgAtoms = normalizedAtoms.filter(
    (a) => a.resName === 'CYS' && a.atomName === 'SG'
  );

  const disulfides: DisulfideBond[] = [];
  const n = cysSgAtoms.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a1 = cysSgAtoms[i];
      const a2 = cysSgAtoms[j];

      // Same residue cannot form a disulfide with itself
      if (a1.chainId === a2.chainId && a1.resSeq === a2.resSeq && a1.insCode === a2.insCode) {
        continue;
      }

      const dist = calculateEuclideanDistance(a1.coordinates, a2.coordinates);
      if (dist >= MIN_DISULFIDE_BOND_DIST && dist <= MAX_DISULFIDE_BOND_DIST) {
        disulfides.push({
          cys1: {
            chainId: a1.chainId,
            residueNumber: a1.resSeq,
            insertionCode: a1.insCode,
            atomName: 'SG',
          },
          cys2: {
            chainId: a2.chainId,
            residueNumber: a2.resSeq,
            insertionCode: a2.insCode,
            atomName: 'SG',
          },
          distance: Number(dist.toFixed(2)),
          isInterChain: a1.chainId !== a2.chainId,
        });
      }
    }
  }

  return disulfides;
}
