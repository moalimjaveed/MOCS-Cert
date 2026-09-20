/**
 * Biopolymer Covalent Backbone & Disulfide Topology Engine
 * 
 * Epistemic Rules:
 * 1. Protein peptide bonds connect C(i) <-> N(i+1) ONLY within the exact same chain,
 *    consecutive sequence numbers, and physical distance d(C, N) <= 2.50 A.
 * 2. Nucleic acid phosphodiester bonds connect O3'(i) <-> P(i+1) ONLY within the exact same strand.
 *    Complementary DNA/RNA strands must NEVER be covalently joined.
 * 3. Disulfide bridges connect Cys SG <-> SG within [1.90, 2.20] A, properly isolated from false contacts.
 */

import { calculateEuclideanDistance } from '../measurements/calculations';
import { buildCanonicalAtomKey, buildCanonicalBondKey } from './atomIdentity';
import type { TopologyAtom, TopologyBond } from './types';

export const CANONICAL_PEPTIDE_BOND_MAX_DIST = 2.50; // Å (canonical is 1.33 Å; >2.50 Å is a chain break)
export const MIN_DISULFIDE_DIST = 1.90;             // Å
export const MAX_DISULFIDE_DIST = 2.20;             // Å
export const MIN_PHOSPHODIESTER_DIST = 1.30;        // Å
export const MAX_PHOSPHODIESTER_DIST = 1.90;        // Å

/**
 * Evaluates authentic peptide bonds between consecutive amino acid residues in a protein chain.
 */
export function buildPeptideBonds(
  atoms: TopologyAtom[]
): TopologyBond[] {
  const bonds: TopologyBond[] = [];
  if (!atoms || atoms.length < 2) return bonds;

  // Group by model and chain, then by residueNumber
  const chains = new Map<string, Map<number, { cAtom?: TopologyAtom; nAtom?: TopologyAtom; resName: string }>>();

  for (const a of atoms) {
    if (a.isHetero) continue; // Skip non-polymer heteroatoms
    const chainKey = `${a.structureId}:${a.modelId}:${a.chainId}`;
    if (!chains.has(chainKey)) {
      chains.set(chainKey, new Map());
    }

    const resMap = chains.get(chainKey)!;
    if (!resMap.has(a.residueNumber)) {
      resMap.set(a.residueNumber, { resName: a.residueName });
    }

    const resEntry = resMap.get(a.residueNumber)!;
    const normName = a.atomName.toUpperCase().trim();
    if (normName === 'C') resEntry.cAtom = a;
    else if (normName === 'N') resEntry.nAtom = a;
  }

  for (const [, resMap] of chains.entries()) {
    const sortedNums = Array.from(resMap.keys()).sort((a, b) => a - b);

    for (let i = 0; i < sortedNums.length - 1; i++) {
      const num1 = sortedNums[i];
      const num2 = sortedNums[i + 1];

      // Strictly enforce consecutive residue numbering (no jumps over missing loops)
      if (num2 !== num1 + 1) continue;

      const r1 = resMap.get(num1)!;
      const r2 = resMap.get(num2)!;

      if (!r1.cAtom || !r2.nAtom) continue;

      const dist = calculateEuclideanDistance(r1.cAtom.coordinates, r2.nAtom.coordinates);
      if (dist <= CANONICAL_PEPTIDE_BOND_MAX_DIST) {
        const bondKey = buildCanonicalBondKey(r1.cAtom.key, r2.nAtom.key);
        bonds.push({
          key: bondKey,
          atomAKey: r1.cAtom.key < r2.nAtom.key ? r1.cAtom.key : r2.nAtom.key,
          atomBKey: r1.cAtom.key < r2.nAtom.key ? r2.nAtom.key : r1.cAtom.key,
          bondType: 'PEPTIDE',
          bondOrder: 1,
          isAromatic: false,
          source: 'POLYMERIC_TEMPLATE',
          measuredDistance: Number(dist.toFixed(3)),
          isInterChain: false,
          isInterResidue: true,
          notes: `Peptide bond C(res ${num1}) - N(res ${num2})`,
        });
      }
    }
  }

  return bonds;
}

/**
 * Evaluates authentic phosphodiester bonds between consecutive nucleotides in a nucleic acid strand.
 */
export function buildPhosphodiesterBonds(
  atoms: TopologyAtom[]
): TopologyBond[] {
  const bonds: TopologyBond[] = [];
  if (!atoms || atoms.length < 2) return bonds;

  // Group by model and chain, then by residueNumber
  const chains = new Map<string, Map<number, { o3Atom?: TopologyAtom; pAtom?: TopologyAtom; resName: string }>>();

  for (const a of atoms) {
    if (a.isHetero) continue;
    const chainKey = `${a.structureId}:${a.modelId}:${a.chainId}`;
    if (!chains.has(chainKey)) {
      chains.set(chainKey, new Map());
    }

    const resMap = chains.get(chainKey)!;
    if (!resMap.has(a.residueNumber)) {
      resMap.set(a.residueNumber, { resName: a.residueName });
    }

    const resEntry = resMap.get(a.residueNumber)!;
    const normName = a.atomName.toUpperCase().trim().replace(/[*]/g, "'");
    if (normName === "O3'") resEntry.o3Atom = a;
    else if (normName === 'P') resEntry.pAtom = a;
  }

  for (const [, resMap] of chains.entries()) {
    const sortedNums = Array.from(resMap.keys()).sort((a, b) => a - b);

    for (let i = 0; i < sortedNums.length - 1; i++) {
      const num1 = sortedNums[i];
      const num2 = sortedNums[i + 1];

      if (num2 !== num1 + 1) continue;

      const r1 = resMap.get(num1)!;
      const r2 = resMap.get(num2)!;

      if (!r1.o3Atom || !r2.pAtom) continue;

      const dist = calculateEuclideanDistance(r1.o3Atom.coordinates, r2.pAtom.coordinates);
      if (dist >= MIN_PHOSPHODIESTER_DIST && dist <= MAX_PHOSPHODIESTER_DIST) {
        const bondKey = buildCanonicalBondKey(r1.o3Atom.key, r2.pAtom.key);
        bonds.push({
          key: bondKey,
          atomAKey: r1.o3Atom.key < r2.pAtom.key ? r1.o3Atom.key : r2.pAtom.key,
          atomBKey: r1.o3Atom.key < r2.pAtom.key ? r2.pAtom.key : r1.o3Atom.key,
          bondType: 'PHOSPHODIESTER',
          bondOrder: 1,
          isAromatic: false,
          source: 'POLYMERIC_TEMPLATE',
          measuredDistance: Number(dist.toFixed(3)),
          isInterChain: false,
          isInterResidue: true,
          notes: `Phosphodiester bond O3'(res ${num1}) - P(res ${num2})`,
        });
      }
    }
  }

  return bonds;
}

/**
 * Detects covalent disulfide bonds between Cysteine SG atoms.
 */
export function buildDisulfideBonds(
  atoms: TopologyAtom[]
): TopologyBond[] {
  const bonds: TopologyBond[] = [];
  const cysSgAtoms = atoms.filter(
    (a) =>
      a.residueName.toUpperCase().trim() === 'CYS' &&
      a.atomName.toUpperCase().trim() === 'SG'
  );

  const n = cysSgAtoms.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a1 = cysSgAtoms[i];
      const a2 = cysSgAtoms[j];

      // Must be from same model
      if (String(a1.modelId) !== String(a2.modelId)) continue;
      // Cannot bond within the exact same residue
      if (a1.chainId === a2.chainId && a1.residueNumber === a2.residueNumber) continue;

      const dist = calculateEuclideanDistance(a1.coordinates, a2.coordinates);
      if (dist >= MIN_DISULFIDE_DIST && dist <= MAX_DISULFIDE_DIST) {
        const isInter = a1.chainId !== a2.chainId;
        const bondKey = buildCanonicalBondKey(a1.key, a2.key);
        bonds.push({
          key: bondKey,
          atomAKey: a1.key < a2.key ? a1.key : a2.key,
          atomBKey: a1.key < a2.key ? a2.key : a1.key,
          bondType: 'DISULFIDE',
          bondOrder: 1,
          isAromatic: false,
          source: 'DISULFIDE_DETECTOR',
          measuredDistance: Number(dist.toFixed(3)),
          isInterChain: isInter,
          isInterResidue: true,
          notes: `Disulfide bond ${a1.chainId}:${a1.residueNumber} <-> ${a2.chainId}:${a2.residueNumber}`,
        });
      }
    }
  }

  return bonds;
}
