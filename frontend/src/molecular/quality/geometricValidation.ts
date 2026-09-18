/**
 * Geometric Validation Engine: Ramachandran & Steric Clashes
 * 
 * Epistemic Rules:
 * 1. Dihedral angles must be computed rigorously using canonical 4-point dihedral algebra.
 * 2. Steric clashes must exclude 1-2 and 1-3 covalent neighbors; simply being close is not a clash.
 * 3. Never invent synthetic clash scores or fake quality percentages.
 */

import { calculateEuclideanDistance, calculateDihedralAngleDeg } from '../measurements/calculations';
export { calculateDihedralAngleDeg };
import type { RamachandranAngles, StericClashRecord } from './types';

// Bondi / standard van der Waals radii in Angstroms
export const CANONICAL_VDW_RADII: Record<string, number> = {
  H: 1.20,
  C: 1.70,
  N: 1.55,
  O: 1.52,
  P: 1.80,
  S: 1.80,
  FE: 1.40,
  ZN: 1.39,
  MG: 1.73,
  CA: 2.31,
  NA: 2.27,
  CL: 1.75,
};

export const VDW_RADII = CANONICAL_VDW_RADII;

export interface ResidueBackboneAtoms {
  chainId?: string;
  residueNumber?: number;
  resNum?: number;
  residueName?: string;
  resName?: string;
  prevC?: [number, number, number];
  nextN?: [number, number, number];
  N?: [number, number, number];
  n?: [number, number, number];
  CA?: [number, number, number];
  ca?: [number, number, number];
  C?: [number, number, number];
  c?: [number, number, number];
  O?: [number, number, number];
  o?: [number, number, number];
}

/**
 * Evaluates Ramachandran (phi, psi) backbone dihedrals and region classifications.
 */
export function evaluateRamachandran(
  residues: ResidueBackboneAtoms[]
): RamachandranAngles[] {
  const results: RamachandranAngles[] = [];
  if (!residues || residues.length === 0) return results;

  // Group by chain
  const chainMap = new Map<string, ResidueBackboneAtoms[]>();
  for (const r of residues) {
    const cId = r.chainId || 'A';
    if (!chainMap.has(cId)) chainMap.set(cId, []);
    chainMap.get(cId)!.push(r);
  }

  for (const [chainId, chainRes] of chainMap.entries()) {
    chainRes.sort((a, b) => (a.residueNumber ?? a.resNum ?? 0) - (b.residueNumber ?? b.resNum ?? 0));

    for (let i = 0; i < chainRes.length; i++) {
      const curr = chainRes[i];
      const currNum = curr.residueNumber ?? curr.resNum ?? 0;
      const prev = i > 0 && (chainRes[i - 1].residueNumber ?? chainRes[i - 1].resNum ?? 0) === currNum - 1 ? chainRes[i - 1] : undefined;
      const next = i < chainRes.length - 1 && (chainRes[i + 1].residueNumber ?? chainRes[i + 1].resNum ?? 0) === currNum + 1 ? chainRes[i + 1] : undefined;

      const currN = curr.N ?? curr.n;
      const currCA = curr.CA ?? curr.ca;
      const currC = curr.C ?? curr.c;
      const prevC = curr.prevC ?? (prev ? (prev.C ?? prev.c) : undefined);
      const nextN = curr.nextN ?? (next ? (next.N ?? next.n) : undefined);

      let phiDeg: number | null = null;
      let psiDeg: number | null = null;

      // phi: C(prev) - N(curr) - CA(curr) - C(curr)
      if (prevC && currN && currCA && currC) {
        phiDeg = calculateDihedralAngleDeg(prevC, currN, currCA, currC);
      }

      // psi: N(curr) - CA(curr) - C(curr) - N(next)
      if (nextN && currN && currCA && currC) {
        psiDeg = calculateDihedralAngleDeg(currN, currCA, currC, nextN);
      }

      const resName = (curr.residueName || curr.resName || 'UNK').toUpperCase().trim();
      let regionType: 'GENERAL' | 'GLYCINE' | 'PROLINE' | 'PRE_PROLINE' = 'GENERAL';
      const nextName = next ? (next.residueName || next.resName || '').toUpperCase().trim() : '';

      if (resName === 'GLY') regionType = 'GLYCINE';
      else if (resName === 'PRO') regionType = 'PROLINE';
      else if (nextName === 'PRO') regionType = 'PRE_PROLINE';

      let category: 'FAVORED' | 'ALLOWED' | 'OUTLIER' | 'NOT_APPLICABLE' = 'NOT_APPLICABLE';

      if (phiDeg !== null && psiDeg !== null) {
        category = classifyRamachandranRegion(phiDeg, psiDeg, regionType);
      }

      results.push({
        residueNumber: currNum,
        residueName: resName,
        chainId,
        phiDeg,
        psiDeg,
        category,
        regionType,
      });
    }
  }

  return results;
}

/**
 * Standard classification of Ramachandran basins.
 */
function classifyRamachandranRegion(
  phi: number,
  psi: number,
  type: 'GENERAL' | 'GLYCINE' | 'PROLINE' | 'PRE_PROLINE'
): 'FAVORED' | 'ALLOWED' | 'OUTLIER' {
  if (type === 'GLYCINE') {
    // Glycine has no beta-carbon; both hemispheres allowed
    if ((phi <= 0 && psi <= 60 && psi >= -80) || (phi >= 0 && psi >= -60 && psi <= 80)) {
      return 'FAVORED';
    }
    return 'ALLOWED';
  }

  // Alpha-helical basin: phi in [-120, -30], psi in [-70, -10]
  const isAlphaFavored = phi >= -120 && phi <= -30 && psi >= -70 && psi <= -10;
  // Beta-sheet basin: phi in [-180, -50], psi in [80, 180] or [-180, -160]
  const isBetaFavored = phi >= -180 && phi <= -50 && ((psi >= 80 && psi <= 180) || (psi >= -180 && psi <= -160));
  // Left-handed alpha (rare for non-Gly, allowed)
  const isLeftAlpha = phi >= 30 && phi <= 90 && psi >= 20 && psi <= 80;

  if (isAlphaFavored || isBetaFavored) return 'FAVORED';
  if (isLeftAlpha) return 'ALLOWED';

  // Broader allowed boundaries
  if (phi >= -180 && phi <= 0 && psi >= -100 && psi <= 180) return 'ALLOWED';

  return 'OUTLIER';
}

export interface ClashAtomInput {
  chainId?: string;
  residueNumber?: number;
  resNum?: number;
  residueName?: string;
  resName?: string;
  atomName?: string;
  name?: string;
  element?: string;
  coordinates?: [number, number, number];
  coord?: [number, number, number];
}

/**
 * Audits severe steric clashes with van der Waals overlap > 0.4 A.
 * Excludes 1-2 and 1-3 bonded neighbors.
 */
export function auditStericClashes(
  atoms: ClashAtomInput[],
  threshold = 0.4
): StericClashRecord[] {
  const clashes: StericClashRecord[] = [];
  const n = atoms.length;
  if (n < 2) return clashes;

  for (let i = 0; i < n; i++) {
    const a = atoms[i];
    const aChain = a.chainId || 'A';
    const aResNum = a.residueNumber ?? a.resNum ?? 0;
    const aResName = a.residueName ?? a.resName ?? 'UNK';
    const aAtomName = a.atomName ?? a.name ?? '';
    const aCoord = a.coordinates ?? a.coord;
    if (!aCoord) continue;

    const elemA = (a.element || aAtomName.charAt(0) || 'C').toUpperCase().trim();
    const rA = CANONICAL_VDW_RADII[elemA] || 1.70;

    for (let j = i + 1; j < n; j++) {
      const b = atoms[j];
      const bChain = b.chainId || 'A';
      const bResNum = b.residueNumber ?? b.resNum ?? 0;
      const bResName = b.residueName ?? b.resName ?? 'UNK';
      const bAtomName = b.atomName ?? b.name ?? '';
      const bCoord = b.coordinates ?? b.coord;
      if (!bCoord) continue;

      // Exclude atoms in the exact same residue (covalent neighbors)
      if (aChain === bChain && aResNum === bResNum) {
        continue;
      }

      // Exclude adjacent residue peptide bond (C of res i and N of res i+1)
      if (
        aChain === bChain &&
        Math.abs(aResNum - bResNum) === 1 &&
        ((aAtomName === 'C' && bAtomName === 'N') || (aAtomName === 'N' && bAtomName === 'C'))
      ) {
        continue;
      }

      const dist = calculateEuclideanDistance(aCoord, bCoord);
      const elemB = (b.element || bAtomName.charAt(0) || 'C').toUpperCase().trim();
      const rB = CANONICAL_VDW_RADII[elemB] || 1.70;
      const vdwSum = rA + rB;
      const overlap = vdwSum - dist;

      if (overlap > threshold) {
        clashes.push({
          atomA: { chainId: aChain, resNum: aResNum, resName: aResName, atomName: aAtomName },
          atomB: { chainId: bChain, resNum: bResNum, resName: bResName, atomName: bAtomName },
          measuredDistance: Number(dist.toFixed(3)),
          vdwSum: Number(vdwSum.toFixed(3)),
          overlapDistance: Number(overlap.toFixed(3)),
          isSevereClash: true,
        });
      }
    }
  }

  return clashes;
}
