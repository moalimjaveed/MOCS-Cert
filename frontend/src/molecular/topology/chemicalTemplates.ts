/**
 * Authoritative Chemical Component Templates & Intra-Residue Bond Catalog
 * 
 * Epistemic Rules:
 * 1. Intra-residue connectivity must originate from authoritative Chemical Component Dictionary (CCD)
 *    templates, NOT distance guessing.
 * 2. Explicit bond orders (single, double, aromatic) are recorded.
 * 3. Heme porphyrin ring and Fe coordination are chemically defined; Fe is coordinated, not single-bonded.
 */

import { buildCanonicalBondKey } from './atomIdentity';
import type { TopologyAtom, TopologyBond, BondType } from './types';

export interface IntraResidueBondDef {
  atom1: string;
  atom2: string;
  bondType: BondType;
  bondOrder: number;
  isAromatic: boolean;
}

// Canonical amino acid backbone intra-residue connections
export const STANDARD_PEPTIDE_BACKBONE_BONDS: IntraResidueBondDef[] = [
  { atom1: 'N', atom2: 'CA', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
  { atom1: 'CA', atom2: 'C', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
  { atom1: 'C', atom2: 'O', bondType: 'COVALENT_DOUBLE', bondOrder: 2, isAromatic: false },
  { atom1: 'C', atom2: 'OXT', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
  { atom1: 'CA', atom2: 'CB', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
];

// Canonical sidechain bonds for 20 standard amino acids
export const STANDARD_AA_SIDECHAIN_BONDS: Record<string, IntraResidueBondDef[]> = {
  ALA: [],
  ARG: [
    { atom1: 'CB', atom2: 'CG', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CG', atom2: 'CD', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CD', atom2: 'NE', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'NE', atom2: 'CZ', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CZ', atom2: 'NH1', bondType: 'COVALENT_DOUBLE', bondOrder: 2, isAromatic: false },
    { atom1: 'CZ', atom2: 'NH2', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
  ],
  ASN: [
    { atom1: 'CB', atom2: 'CG', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CG', atom2: 'OD1', bondType: 'COVALENT_DOUBLE', bondOrder: 2, isAromatic: false },
    { atom1: 'CG', atom2: 'ND2', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
  ],
  ASP: [
    { atom1: 'CB', atom2: 'CG', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CG', atom2: 'OD1', bondType: 'COVALENT_DOUBLE', bondOrder: 2, isAromatic: false },
    { atom1: 'CG', atom2: 'OD2', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
  ],
  CYS: [
    { atom1: 'CB', atom2: 'SG', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
  ],
  GLN: [
    { atom1: 'CB', atom2: 'CG', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CG', atom2: 'CD', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CD', atom2: 'OE1', bondType: 'COVALENT_DOUBLE', bondOrder: 2, isAromatic: false },
    { atom1: 'CD', atom2: 'NE2', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
  ],
  GLU: [
    { atom1: 'CB', atom2: 'CG', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CG', atom2: 'CD', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CD', atom2: 'OE1', bondType: 'COVALENT_DOUBLE', bondOrder: 2, isAromatic: false },
    { atom1: 'CD', atom2: 'OE2', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
  ],
  GLY: [],
  HIS: [
    { atom1: 'CB', atom2: 'CG', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CG', atom2: 'ND1', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
    { atom1: 'ND1', atom2: 'CE1', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
    { atom1: 'CE1', atom2: 'NE2', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
    { atom1: 'NE2', atom2: 'CD2', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
    { atom1: 'CD2', atom2: 'CG', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  ],
  ILE: [
    { atom1: 'CB', atom2: 'CG1', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CB', atom2: 'CG2', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CG1', atom2: 'CD1', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
  ],
  LEU: [
    { atom1: 'CB', atom2: 'CG', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CG', atom2: 'CD1', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CG', atom2: 'CD2', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
  ],
  LYS: [
    { atom1: 'CB', atom2: 'CG', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CG', atom2: 'CD', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CD', atom2: 'CE', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CE', atom2: 'NZ', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
  ],
  MET: [
    { atom1: 'CB', atom2: 'CG', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CG', atom2: 'SD', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'SD', atom2: 'CE', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
  ],
  PHE: [
    { atom1: 'CB', atom2: 'CG', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CG', atom2: 'CD1', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
    { atom1: 'CD1', atom2: 'CE1', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
    { atom1: 'CE1', atom2: 'CZ', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
    { atom1: 'CZ', atom2: 'CE2', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
    { atom1: 'CE2', atom2: 'CD2', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
    { atom1: 'CD2', atom2: 'CG', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  ],
  PRO: [
    { atom1: 'CB', atom2: 'CG', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CG', atom2: 'CD', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CD', atom2: 'N', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
  ],
  SER: [
    { atom1: 'CB', atom2: 'OG', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
  ],
  THR: [
    { atom1: 'CB', atom2: 'OG1', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CB', atom2: 'CG2', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
  ],
  TRP: [
    { atom1: 'CB', atom2: 'CG', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CG', atom2: 'CD1', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
    { atom1: 'CD1', atom2: 'NE1', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
    { atom1: 'NE1', atom2: 'CE2', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
    { atom1: 'CE2', atom2: 'CD2', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
    { atom1: 'CD2', atom2: 'CG', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
    { atom1: 'CD2', atom2: 'CE3', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
    { atom1: 'CE3', atom2: 'CZ3', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
    { atom1: 'CZ3', atom2: 'CH2', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
    { atom1: 'CH2', atom2: 'CZ2', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
    { atom1: 'CZ2', atom2: 'CE2', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  ],
  TYR: [
    { atom1: 'CB', atom2: 'CG', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CG', atom2: 'CD1', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
    { atom1: 'CD1', atom2: 'CE1', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
    { atom1: 'CE1', atom2: 'CZ', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
    { atom1: 'CZ', atom2: 'OH', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CZ', atom2: 'CE2', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
    { atom1: 'CE2', atom2: 'CD2', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
    { atom1: 'CD2', atom2: 'CG', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  ],
  VAL: [
    { atom1: 'CB', atom2: 'CG1', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
    { atom1: 'CB', atom2: 'CG2', bondType: 'COVALENT_SINGLE', bondOrder: 1, isAromatic: false },
  ],
};

// Canonical HEME (HEM) Protoporphyrin IX with Fe center template
export const HEME_CCD_BONDS: IntraResidueBondDef[] = [
  // Fe coordination to pyrrole nitrogens
  { atom1: 'FE', atom2: 'NA', bondType: 'METAL_COORDINATION', bondOrder: 0.5, isAromatic: false },
  { atom1: 'FE', atom2: 'NB', bondType: 'METAL_COORDINATION', bondOrder: 0.5, isAromatic: false },
  { atom1: 'FE', atom2: 'NC', bondType: 'METAL_COORDINATION', bondOrder: 0.5, isAromatic: false },
  { atom1: 'FE', atom2: 'ND', bondType: 'METAL_COORDINATION', bondOrder: 0.5, isAromatic: false },
  // Pyrrole Ring A
  { atom1: 'NA', atom2: 'C1A', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  { atom1: 'C1A', atom2: 'C2A', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  { atom1: 'C2A', atom2: 'C3A', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  { atom1: 'C3A', atom2: 'C4A', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  { atom1: 'C4A', atom2: 'NA', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  // Pyrrole Ring B
  { atom1: 'NB', atom2: 'C1B', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  { atom1: 'C1B', atom2: 'C2B', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  { atom1: 'C2B', atom2: 'C3B', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  { atom1: 'C3B', atom2: 'C4B', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  { atom1: 'C4B', atom2: 'NB', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  // Pyrrole Ring C
  { atom1: 'NC', atom2: 'C1C', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  { atom1: 'C1C', atom2: 'C2C', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  { atom1: 'C2C', atom2: 'C3C', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  { atom1: 'C3C', atom2: 'C4C', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  { atom1: 'C4C', atom2: 'NC', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  // Pyrrole Ring D
  { atom1: 'ND', atom2: 'C1D', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  { atom1: 'C1D', atom2: 'C2D', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  { atom1: 'C2D', atom2: 'C3D', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  { atom1: 'C3D', atom2: 'C4D', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  { atom1: 'C4D', atom2: 'ND', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  // Methine Bridges linking pyrroles
  { atom1: 'C4A', atom2: 'CHB', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  { atom1: 'CHB', atom2: 'C1B', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  { atom1: 'C4B', atom2: 'CHC', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  { atom1: 'CHC', atom2: 'C1C', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  { atom1: 'C4C', atom2: 'CHD', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  { atom1: 'CHD', atom2: 'C1D', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  { atom1: 'C4D', atom2: 'CHA', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
  { atom1: 'CHA', atom2: 'C1A', bondType: 'COVALENT_AROMATIC', bondOrder: 1.5, isAromatic: true },
];

/**
 * Builds intra-residue chemical topology bonds for a collection of atoms belonging to the same residue.
 */
export function buildIntraResidueBonds(
  residueAtoms: TopologyAtom[]
): TopologyBond[] {
  const bonds: TopologyBond[] = [];
  if (!residueAtoms || residueAtoms.length < 2) return bonds;

  const resName = residueAtoms[0].residueName.toUpperCase().trim();
  const atomMap = new Map<string, TopologyAtom>();
  for (const a of residueAtoms) {
    atomMap.set(a.atomName.toUpperCase().trim(), a);
  }

  let defs: IntraResidueBondDef[] = [];

  if (resName === 'HEM') {
    defs = HEME_CCD_BONDS;
  } else if (STANDARD_AA_SIDECHAIN_BONDS[resName] !== undefined) {
    defs = [...STANDARD_PEPTIDE_BACKBONE_BONDS, ...STANDARD_AA_SIDECHAIN_BONDS[resName]];
  }

  for (const d of defs) {
    const a1 = atomMap.get(d.atom1);
    const a2 = atomMap.get(d.atom2);

    if (a1 && a2) {
      const dx = a1.coordinates[0] - a2.coordinates[0];
      const dy = a1.coordinates[1] - a2.coordinates[1];
      const dz = a1.coordinates[2] - a2.coordinates[2];
      const dist = Math.hypot(dx, dy, dz);

      const bondKey = buildCanonicalBondKey(a1.key, a2.key);
      bonds.push({
        key: bondKey,
        atomAKey: a1.key < a2.key ? a1.key : a2.key,
        atomBKey: a1.key < a2.key ? a2.key : a1.key,
        bondType: d.bondType,
        bondOrder: d.bondOrder,
        isAromatic: d.isAromatic,
        source: 'CHEMICAL_COMPONENT_DICTIONARY',
        measuredDistance: Number(dist.toFixed(3)),
        isInterChain: false,
        isInterResidue: false,
        notes: `CCD intra-residue bond ${d.atom1}-${d.atom2} in ${resName}`,
      });
    }
  }

  return bonds;
}
