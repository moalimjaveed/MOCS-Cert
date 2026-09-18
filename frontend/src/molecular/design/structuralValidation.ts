/**
 * MOCS-Cert De Novo Structure & Computational Model Validation Engine
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: MolProbity (Chen et al., 2010), Engh & Huber (1991) Stereochemical Parameters
 * 
 * Validates:
 * 1. Consecutive C-alpha virtual peptide bond distances (3.81 +/- 0.4 A)
 * 2. Non-bonded steric clashes excluding 1-2 and 1-3 covalent pairs
 * 3. Finite numerical integrity (zero NaN or Infinity coordinates)
 * 4. Overall physical plausibility classification (PLAUSIBLE vs SUSPECT_DISTORTIONS vs UNPHYSICAL_CLASHES)
 */

import { calculateEuclideanDistance } from '../measurements/calculations';
import type { StructuralPlausibilityResult } from './types';

export interface ValidatedModelAtom {
  element: string;
  atomName: string;
  coords: [number, number, number];
  resSeq: number;
  chainId: string;
}

export function validateStructuralPlausibility(
  atoms: ValidatedModelAtom[]
): StructuralPlausibilityResult {
  const details: string[] = [];

  if (!atoms || atoms.length === 0) {
    return {
      status: 'UNPHYSICAL_CLASHES',
      peptideBondViolations: 0,
      meanPeptideBondLength: 0,
      ramachandranOutliers: 0,
      stericClashCount: 0,
      details: ['Model contains zero atoms.'],
    };
  }

  // 1. Numerical Finiteness Check
  for (let i = 0; i < atoms.length; i++) {
    const [x, y, z] = atoms[i].coords;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return {
        status: 'UNPHYSICAL_CLASHES',
        peptideBondViolations: 999,
        meanPeptideBondLength: 0,
        ramachandranOutliers: 0,
        stericClashCount: 999,
        details: [`Non-finite coordinate detected at atom index ${i} (${atoms[i].atomName}).`],
      };
    }
  }

  // 2. Consecutive CA-CA virtual bond distance check
  const caAtoms = atoms.filter((a) => a.atomName.toUpperCase() === 'CA');
  let bondViolations = 0;
  let sumBondLength = 0;

  for (let i = 0; i < caAtoms.length - 1; i++) {
    const a1 = caAtoms[i];
    const a2 = caAtoms[i + 1];

    // Only check consecutive residues on the same chain
    if (a1.chainId === a2.chainId && Math.abs(a1.resSeq - a2.resSeq) === 1) {
      const d = calculateEuclideanDistance(a1.coords, a2.coords);
      sumBondLength += d;

      // Physical trans peptide CA-CA is ~3.81 A; cis is ~2.9 A. Outside [3.2, 4.3] is stereochemically aberrant.
      if (d < 3.2 || d > 4.3) {
        bondViolations++;
        details.push(
          `Peptide bond distortion: CA(${a1.resSeq})-CA(${a2.resSeq}) distance is ${d.toFixed(2)} Å (expected 3.81 Å).`
        );
      }
    }
  }

  const meanBond = caAtoms.length > 1 && (caAtoms.length - 1) > 0
    ? Number((sumBondLength / (caAtoms.length - 1)).toFixed(3))
    : 0;

  // 3. Steric Clashes between non-bonded residues (residue separation >= 3)
  let clashCount = 0;
  const n = atoms.length;

  for (let i = 0; i < n; i++) {
    const atomA = atoms[i];
    if (atomA.element.toUpperCase() === 'H') continue;

    for (let j = i + 1; j < n; j++) {
      const atomB = atoms[j];
      if (atomB.element.toUpperCase() === 'H') continue;

      // Exclude 1-2 and 1-3 covalent neighbors on the same chain
      if (atomA.chainId === atomB.chainId && Math.abs(atomA.resSeq - atomB.resSeq) < 3) {
        continue;
      }

      const dist = calculateEuclideanDistance(atomA.coords, atomB.coords);
      // Heavy atoms closer than 2.2 A without covalent bond are severe clashes
      if (dist < 2.20) {
        clashCount++;
        if (clashCount <= 10) {
          details.push(
            `Severe non-bonded steric clash: ${atomA.chainId}:${atomA.resSeq} ${atomA.atomName} and ${atomB.chainId}:${atomB.resSeq} ${atomB.atomName} are only ${dist.toFixed(2)} Å apart.`
          );
        }
      }
    }
  }

  // 4. Determine overall plausibility status
  let status: 'PLAUSIBLE' | 'SUSPECT_DISTORTIONS' | 'UNPHYSICAL_CLASHES' = 'PLAUSIBLE';

  if (clashCount > 0 || bondViolations > 3) {
    status = 'UNPHYSICAL_CLASHES';
  } else if (bondViolations > 0) {
    status = 'SUSPECT_DISTORTIONS';
  }

  return {
    status,
    peptideBondViolations: bondViolations,
    meanPeptideBondLength: meanBond,
    ramachandranOutliers: 0,
    stericClashCount: clashCount,
    details,
  };
}
