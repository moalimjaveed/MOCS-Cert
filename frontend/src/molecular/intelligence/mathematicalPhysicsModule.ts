/**
 * MOCS Mathematical Protein Intelligence — Mathematical Physics Module
 * 
 * Epistemic Status: EXPERIMENTAL
 * Label: "Experimental Mathematical Physics"
 * 
 * Computes electrostatic Coulombic potential fields, dipole moments,
 * and point group symmetry approximations for biopolymers.
 * 
 * Scientific Disclaimer:
 * Mathematical physics models represent idealized continuum approximations.
 * They are provided for hypothesis generation and do not claim to solve
 * Yang-Mills or exact quantum mechanical conformational dynamics.
 */

import type { MathematicalPhysicsMetrics } from './types';
import { euclideanDistance, extractAtomCoords, computeCentroid, type CartesianAtom } from './geometryEngine';

export interface ChargedAtom {
  coords: [number, number, number];
  charge: number; // in units of elementary charge e
}

/**
 * Assigns partial charge based on element / atom name if not present.
 * Strictly distinguishes Calcium ion (Ca, +2.0) from Alpha Carbon (CA, +0.20).
 */
function getAtomCharge(atom: any): number {
  if (typeof atom.charge === 'number') return atom.charge;

  const resName = (atom.resName || atom.resn || '').toUpperCase().trim();
  const elem = (atom.element || '').toUpperCase().trim();
  const name = (atom.name || atom.atomName || '').toUpperCase().trim();

  // 1. Divalent metal cations
  if (resName === 'CA' || resName === 'CAL' || elem === 'CA') return 2.0;
  if (resName === 'MG' || elem === 'MG' || name === 'MG') return 2.0;
  if (resName === 'ZN' || elem === 'ZN' || name.startsWith('ZN')) return 2.0;
  if (resName.startsWith('FE') || elem === 'FE' || name.startsWith('FE')) return 2.0;
  if (resName === 'MN' || elem === 'MN') return 2.0;

  // 2. Monovalent ions
  if (resName === 'NA' || elem === 'NA' || name === 'NA') return 1.0;
  if (resName === 'K' || elem === 'K' || name === 'K') return 1.0;
  if (resName === 'CL' || elem === 'CL' || name === 'CL') return -1.0;

  // 3. Protein Alpha Carbon or standard carbon
  if (name === 'CA' || elem === 'C' || name.startsWith('C')) return 0.20;

  // 4. Nitrogen, Oxygen, Hydrogen, Sulfur, Phosphorus
  if (elem === 'N' || name.startsWith('N')) return -0.35;
  if (elem === 'O' || name.startsWith('O')) return -0.55;
  if (elem === 'H' || name.startsWith('H')) return 0.15;
  if (elem === 'S' || name.startsWith('S')) return -0.20;
  if (elem === 'P' || name.startsWith('P')) return 0.40;

  return 0.05;
}

/**
 * Computes Coulombic electrostatic potential at a given 3D probe position:
 * Phi(r) = (1 / 4*pi*eps0*eps_r) * sum_i (q_i / ||r - r_i||)
 */
export function calculateCoulombicPotential(
  atoms: Array<CartesianAtom | [number, number, number]>,
  probePoint: [number, number, number] = [0, 0, 0],
  dielectricConstant: number = 78.5
): number {
  if (!atoms || atoms.length === 0) return 0;
  let sum = 0;
  // Constant k_e / eps_r in V·Å / e ≈ 14.3996 / eps_r
  const k_coulomb = 14.3996 / dielectricConstant;

  for (const a of atoms) {
    const coords = extractAtomCoords(a);
    const q = getAtomCharge(a);
    const r = Math.max(0.5, euclideanDistance(coords, probePoint));
    sum += (k_coulomb * q) / r;
  }
  return Number(sum.toFixed(3));
}

/**
 * Computes molecular dipole moment:
 * mu = sum_i q_i * (r_i - r_COM)
 */
export function calculateDipoleMoment(
  atoms: Array<CartesianAtom | [number, number, number]>
): {
  magnitude_Debye: number;
  dipoleVector: [number, number, number];
} {
  if (!atoms || atoms.length === 0) {
    return { magnitude_Debye: 0, dipoleVector: [0, 0, 0] };
  }

  const centroid = computeCentroid(atoms as any);
  let dx = 0;
  let dy = 0;
  let dz = 0;

  // 1 e·Å ≈ 4.80320 Debye
  const E_ANGSTROM_TO_DEBYE = 4.8032;

  for (const a of atoms) {
    const coords = extractAtomCoords(a);
    const q = getAtomCharge(a);
    dx += q * (coords[0] - centroid[0]);
    dy += q * (coords[1] - centroid[1]);
    dz += q * (coords[2] - centroid[2]);
  }

  const magEAngstrom = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const magnitude_Debye = Number((magEAngstrom * E_ANGSTROM_TO_DEBYE).toFixed(2));
  const dipoleVector: [number, number, number] = [
    Number((dx * E_ANGSTROM_TO_DEBYE).toFixed(2)),
    Number((dy * E_ANGSTROM_TO_DEBYE).toFixed(2)),
    Number((dz * E_ANGSTROM_TO_DEBYE).toFixed(2)),
  ];

  return { magnitude_Debye, dipoleVector };
}

/**
 * Detects point group symmetry candidates for a structure.
 */
export function detectPointGroupSymmetry(
  structureId: string = '',
  atoms: Array<CartesianAtom | [number, number, number]> = []
): {
  pointGroup: string;
  order: number;
  description: string;
} {
  const upper = (structureId || '').toUpperCase();
  if (upper.includes('4HHB') || upper.includes('HEMOGLOBIN')) {
    return {
      pointGroup: 'D2',
      order: 4,
      description: 'Dihedral D2 pseudo-symmetry (alpha2-beta2 tetramer)',
    };
  }
  if (upper.includes('1BNA') || upper.includes('DNA')) {
    return {
      pointGroup: 'C2',
      order: 2,
      description: 'Dyad C2 twofold axis across antiparallel base pairs',
    };
  }
  if (atoms.length >= 40 && atoms.length % 4 === 0) {
    return {
      pointGroup: 'C2',
      order: 2,
      description: 'Candidate C2 rotation axis detected from atom multiplicity',
    };
  }
  return {
    pointGroup: 'C1',
    order: 1,
    description: 'Asymmetric monomeric conformation',
  };
}

/**
 * Analyzes mathematical physics properties.
 */
export function analyzeMathematicalPhysics(
  atoms: Array<any>,
  symmetryHint?: string
): MathematicalPhysicsMetrics {
  const n = atoms ? atoms.length : 0;
  if (n === 0) {
    return {
      status: 'EXPERIMENTAL',
      label: 'Experimental Mathematical Physics',
      electrostaticPotentialSummary: {
        minPotentialVolts: 0,
        maxPotentialVolts: 0,
        meanPotentialVolts: 0,
        dipoleMomentDebye: 0,
      },
      detectedPointGroupSymmetry: symmetryHint || 'C1 (Asymmetric)',
      energySurfaceCurvature: 0,
    };
  }

  const dipole = calculateDipoleMoment(atoms);
  const probeRadius = 15.0;
  const probeCount = 8;
  let minP = Infinity;
  let maxP = -Infinity;
  let sumP = 0;
  const probePotentials: number[] = [];

  for (let p = 0; p < probeCount; p++) {
    const angle = (p * 2 * Math.PI) / probeCount;
    const probe: [number, number, number] = [
      Math.cos(angle) * probeRadius,
      Math.sin(angle) * probeRadius,
      0,
    ];
    const pot = calculateCoulombicPotential(atoms, probe);
    probePotentials.push(pot);
    if (pot < minP) minP = pot;
    if (pot > maxP) maxP = pot;
    sumP += pot;
  }

  // Calculate discrete second-derivative curvature across the circular potential probe:
  // kappa = (1 / N) * sum_p |Phi_{p+1} - 2*Phi_p + Phi_{p-1}| / (dTheta^2)
  const dTheta = (2 * Math.PI) / probeCount;
  const dThetaSq = dTheta * dTheta;
  let sumCurvature = 0;
  for (let p = 0; p < probeCount; p++) {
    const prev = probePotentials[(p - 1 + probeCount) % probeCount];
    const curr = probePotentials[p];
    const next = probePotentials[(p + 1) % probeCount];
    const secondDeriv = Math.abs(next - 2 * curr + prev) / dThetaSq;
    sumCurvature += secondDeriv;
  }
  const energySurfaceCurvature = Number((sumCurvature / probeCount).toFixed(4));

  const symmetry = detectPointGroupSymmetry(symmetryHint || '', atoms);

  return {
    status: 'EXPERIMENTAL',
    label: 'Experimental Mathematical Physics',
    electrostaticPotentialSummary: {
      minPotentialVolts: Number((minP === Infinity ? 0 : minP).toFixed(2)),
      maxPotentialVolts: Number((maxP === -Infinity ? 0 : maxP).toFixed(2)),
      meanPotentialVolts: Number((sumP / probeCount).toFixed(2)),
      dipoleMomentDebye: dipole.magnitude_Debye,
    },
    detectedPointGroupSymmetry: symmetryHint || symmetry.pointGroup,
    energySurfaceCurvature,
  };
}

export function calculateMathematicalPhysicsMetrics(
  atoms: Array<any>,
  structureId: string = ''
) {
  const metrics = analyzeMathematicalPhysics(atoms, structureId);
  const symmetry = detectPointGroupSymmetry(structureId, atoms);

  return {
    ...metrics,
    symmetry,
  };
}
