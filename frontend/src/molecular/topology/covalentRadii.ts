/**
 * Authoritative Covalent Radii Table & Distance-Based Bond Inference Engine
 * 
 * Epistemic Rules:
 * 1. Universal single distance cutoffs (e.g. dist < 1.9 A) are unphysical and scientifically invalid.
 * 2. Covalent bond length depends strictly on elemental species, hybridization, and bonding radii.
 * 3. Distance tolerance must guard against both unphysical zero-distance artifacts (< 0.40 A)
 *    and non-covalent van der Waals contacts.
 * Reference: Cordero et al., Dalton Trans. (2008) 2832–2838; Pyykkö & Atsumi, Chem. Eur. J. (2009).
 */

export const COVALENT_RADII_ANGSTROMS: Record<string, number> = {
  H: 0.31,
  HE: 0.28,
  LI: 1.28,
  BE: 0.96,
  B: 0.84,
  C: 0.76,
  N: 0.71,
  O: 0.66,
  F: 0.57,
  NE: 0.58,
  NA: 1.66,
  MG: 1.41,
  AL: 1.21,
  SI: 1.11,
  P: 1.07,
  S: 1.05,
  CL: 1.02,
  AR: 1.06,
  K: 2.03,
  CA: 1.76,
  SC: 1.70,
  TI: 1.60,
  V: 1.53,
  CR: 1.39,
  MN: 1.39,
  FE: 1.32,
  CO: 1.26,
  NI: 1.24,
  CU: 1.32,
  ZN: 1.22,
  GA: 1.22,
  GE: 1.20,
  AS: 1.19,
  SE: 1.20,
  BR: 1.20,
  KR: 1.16,
  RB: 2.20,
  SR: 1.95,
  Y: 1.90,
  ZR: 1.75,
  NB: 1.64,
  MO: 1.54,
  TC: 1.47,
  RU: 1.46,
  RH: 1.42,
  PD: 1.39,
  AG: 1.45,
  CD: 1.44,
  IN: 1.42,
  SN: 1.39,
  SB: 1.39,
  TE: 1.38,
  I: 1.39,
  XE: 1.40,
  CS: 2.44,
  BA: 2.15,
  LA: 2.07,
  CE: 2.04,
  PR: 2.03,
  ND: 2.01,
  PM: 1.99,
  SM: 1.98,
  EU: 1.98,
  GD: 1.96,
  TB: 1.94,
  DY: 1.92,
  HO: 1.92,
  ER: 1.89,
  TM: 1.90,
  YB: 1.87,
  LU: 1.87,
  HF: 1.75,
  TA: 1.70,
  W: 1.62,
  RE: 1.51,
  OS: 1.44,
  IR: 1.41,
  PT: 1.36,
  AU: 1.36,
  HG: 1.32,
  TL: 1.45,
  PB: 1.46,
  BI: 1.48,
  PO: 1.40,
  AT: 1.50,
  RN: 1.50,
  U: 1.96,
};

export const MIN_COVALENT_BOND_DISTANCE = 0.40; // Å (guards against duplicate / non-physical overlapping coordinates)
export const DEFAULT_COVALENT_TOLERANCE = 0.40;  // Å

/**
 * Retrieves the standard single covalent radius for a chemical element.
 * Defaults to Carbon (0.76 Å) if unknown.
 */
export function getCovalentRadius(element: string): number {
  const norm = (element || '').toUpperCase().trim();
  return COVALENT_RADII_ANGSTROMS[norm] || 0.76;
}

/**
 * Evaluates whether the Euclidean distance between two atoms falls within physical covalent bonding tolerances.
 * Formula: MIN_COVALENT_BOND_DISTANCE <= d <= rA + rB + tolerance
 */
export function isCovalentDistance(
  elementA: string,
  elementB: string,
  distance: number,
  tolerance = DEFAULT_COVALENT_TOLERANCE
): boolean {
  if (!Number.isFinite(distance) || distance < MIN_COVALENT_BOND_DISTANCE) {
    return false;
  }

  const rA = getCovalentRadius(elementA);
  const rB = getCovalentRadius(elementB);
  const maxDistance = rA + rB + tolerance;

  return distance <= maxDistance;
}
