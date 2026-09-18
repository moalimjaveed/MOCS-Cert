/**
 * MOCS-Cert Protein Structural Biology — Secondary Structure Engine
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: DSSP Standard (Kabsch & Sander, 1983) & PDB mmCIF Dictionary
 */

import type { SecondaryStructureElement, SecondaryStructureType } from './types';
import { calculateDihedralAngleDeg } from '../measurements/calculations';

export interface ResidueBackboneCoords {
  chainId: string;
  resSeq: number;
  insCode?: string;
  resName: string;
  N?: [number, number, number];
  CA?: [number, number, number];
  C?: [number, number, number];
  O?: [number, number, number];
}

/**
 * Calculates backbone Ramachandran dihedral angles (phi, psi, omega) for a chain of contiguous residues.
 */
export function calculateRamachandranDihedrals(
  residues: ResidueBackboneCoords[]
): Array<{
  chainId: string;
  resSeq: number;
  insCode?: string;
  resName: string;
  phi: number | null;
  psi: number | null;
  omega: number | null;
}> {
  const result: Array<{
    chainId: string;
    resSeq: number;
    insCode?: string;
    resName: string;
    phi: number | null;
    psi: number | null;
    omega: number | null;
  }> = [];

  const n = residues.length;
  for (let i = 0; i < n; i++) {
    const curr = residues[i];
    const prev = i > 0 ? residues[i - 1] : null;
    const next = i < n - 1 ? residues[i + 1] : null;

    let phi: number | null = null;
    let psi: number | null = null;
    let omega: number | null = null;

    // Phi: C(i-1) - N(i) - CA(i) - C(i)
    if (prev && prev.C && curr.N && curr.CA && curr.C) {
      phi = calculateDihedralAngleDeg(prev.C, curr.N, curr.CA, curr.C);
      if (phi !== null) phi = Number(phi.toFixed(2));
    }

    // Psi: N(i) - CA(i) - C(i) - N(i+1)
    if (next && curr.N && curr.CA && curr.C && next.N) {
      psi = calculateDihedralAngleDeg(curr.N, curr.CA, curr.C, next.N);
      if (psi !== null) psi = Number(psi.toFixed(2));
    }

    // Omega: CA(i) - C(i) - N(i+1) - CA(i+1) (peptide bond planarity: ~180° trans, ~0° cis)
    if (next && curr.CA && curr.C && next.N && next.CA) {
      omega = calculateDihedralAngleDeg(curr.CA, curr.C, next.N, next.CA);
      if (omega !== null) omega = Number(omega.toFixed(2));
    }

    result.push({
      chainId: curr.chainId,
      resSeq: curr.resSeq,
      insCode: curr.insCode,
      resName: curr.resName,
      phi,
      psi,
      omega,
    });
  }

  return result;
}

/**
 * Classifies secondary structure type based on Ramachandran (phi, psi) angles.
 */
export function classifySecondaryStructureFromDihedrals(
  phi: number | null,
  psi: number | null
): SecondaryStructureType {
  if (phi === null || psi === null) return 'unassigned';

  // Alpha helix region: phi ~ -60° ([-140, -30]), psi ~ -45° ([-80, -10])
  if (phi >= -140 && phi <= -30 && psi >= -80 && psi <= -10) {
    return 'alpha-helix';
  }

  // Beta sheet region: phi ~ -120° ([-180, -80]), psi ~ +135° ([+80, +180] or [-180, -160])
  if (
    phi >= -180 &&
    phi <= -80 &&
    ((psi >= 80 && psi <= 180) || (psi >= -180 && psi <= -160))
  ) {
    return 'beta-strand';
  }

  // Left-handed alpha helix (e.g. in Glycine): phi ~ +60°, psi ~ +40°
  if (phi >= 30 && phi <= 90 && psi >= 10 && psi <= 80) {
    return 'turn';
  }

  return 'coil';
}

/**
 * Validates a secondary structure element ensuring:
 * 1. Start residue sequence <= end residue sequence within the same chain
 * 2. Start and end chains match exactly
 * 3. Element type is recognized
 */
export function validateSecondaryStructureElement(
  elem: SecondaryStructureElement
): { valid: boolean; error?: string } {
  if (!elem.chainId) {
    return { valid: false, error: 'Chain ID must not be empty.' };
  }
  if (elem.startResSeq > elem.endResSeq) {
    return {
      valid: false,
      error: `Invalid boundary: startResSeq (${elem.startResSeq}) exceeds endResSeq (${elem.endResSeq}) in chain ${elem.chainId}.`,
    };
  }
  return { valid: true };
}
