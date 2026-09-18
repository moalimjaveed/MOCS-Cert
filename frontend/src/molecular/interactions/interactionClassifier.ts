/**
 * MOCS-Cert Non-Covalent & Metal Coordination Interaction Classifier
 * 
 * Epistemic Rules:
 * 1. A physical distance cutoff alone does not prove biological binding.
 * 2. If hydrogens are unobserved (typical in X-ray structures), H-bonds must be
 *    explicitly labeled as "Putative H-bond (heavy-atom geometric proxy: D-A <= 3.5 A, unobserved hydrogens)".
 * 3. Salt bridges strictly require verified charged groups (Arg/Lys/His <-> Asp/Glu/anion).
 * 4. Pi-stacking strictly requires both ring centroid distance AND ring normal angles.
 * 5. Metal coordination strictly requires biological metal centers and donor heteroatoms.
 */

import { calculateEuclideanDistance } from '../measurements/calculations';
import {
  computePlaneNormal,
  angleBetweenNormalsDeg,
  computeAngleDegrees,
} from './contactCalculations';
import { BIOLOGICAL_METALS } from './ligandIdentity';
import { STANDARD_AMINO_ACIDS } from '../protein/classifier';
import type {
  ContactAtomDetail,
  MolecularContact,
  InteractionClassification,
  EpistemicInteractionLevel,
  InteractionProvenance,
} from './types';

export const CANONICAL_HBOND_DISTANCE_CUTOFF = 3.5;  // Heavy-atom D-A cutoff in Angstroms
export const CANONICAL_SALT_BRIDGE_CUTOFF = 4.0;      // Charged group heavy-atom cutoff in Angstroms
export const CANONICAL_HYDROPHOBIC_CUTOFF = 4.5;      // Non-polar carbon-carbon cutoff in Angstroms
export const CANONICAL_METAL_COORD_CUTOFF = 2.8;      // Metal-heteroatom coordination cutoff in Angstroms
export const CANONICAL_PI_PARALLEL_CUTOFF = 4.5;      // Centroid distance cutoff in Angstroms
export const CANONICAL_PI_TSHAPED_CUTOFF = 5.5;       // Centroid distance cutoff in Angstroms

// Anionic sidechain/backbone groups
const ANIONIC_ATOMS = new Set([
  'OD1', 'OD2', // ASP
  'OE1', 'OE2', // GLU
  'OXT',        // C-terminal carboxylate
  'O1P', 'O2P', 'O3P', // Phosphorylated residues (SEP, TPO, PTR)
  'O1A', 'O2A', 'O1D', 'O2D', // Heme propionates
]);

// Cationic sidechain groups
const CATIONIC_ATOMS = new Set([
  'NZ',               // LYS
  'NH1', 'NH2', 'NE', // ARG
  'ND1', 'NE2',       // HIS (imidazole, putative cationic)
]);

// Non-polar carbon atoms (protein sidechains and aromatic rings)
const NONPOLAR_CARBON_ATOMS = new Set([
  'CB', 'CG', 'CG1', 'CG2', 'CD', 'CD1', 'CD2', 'CE', 'CE1', 'CE2', 'CE3', 'CZ', 'CZ2', 'CZ3', 'CH2'
]);

// Heteroatoms capable of hydrogen bonding
const HBOND_DONORS = new Set(['N', 'O', 'S']);
const HBOND_ACCEPTORS = new Set(['O', 'N', 'S']);

// Biological metal coordinating heteroatoms
const METAL_COORDINATING_ATOMS = new Set(['N', 'O', 'S', 'CL', 'F']);

/**
 * Classifies an atom pair contact into its specific interaction type.
 */
export function classifyPairInteraction(
  atomA: ContactAtomDetail,
  atomB: ContactAtomDetail,
  distance: number,
  provenance: InteractionProvenance = 'EXPERIMENTAL_DEPOSITED',
  explicitHydrogenCoord?: [number, number, number]
): MolecularContact {
  const elemA = (atomA.element || '').toUpperCase().trim();
  const elemB = (atomB.element || '').toUpperCase().trim();
  const nameA = (atomA.atomName || '').toUpperCase().trim();
  const nameB = (atomB.atomName || '').toUpperCase().trim();
  const resA = (atomA.residueName || '').toUpperCase().trim();
  const resB = (atomB.residueName || '').toUpperCase().trim();

  let type: InteractionClassification = 'GEOMETRIC_PROXIMITY';
  let epistemicLevel: EpistemicInteractionLevel =
    provenance === 'PREDICTED_POSE' ? 'PREDICTED_INTERACTION' : 'GEOMETRIC_PROXIMITY';
  let details: MolecularContact['geometryDetails'] = undefined;

  const isInterChain = atomA.chainId !== atomB.chainId;

  // 1. Metal coordination (Fe, Zn, Mg, Ca, Mn, Cu, etc.)
  const isAMetal = BIOLOGICAL_METALS.has(elemA) || BIOLOGICAL_METALS.has(resA);
  const isBMetal = BIOLOGICAL_METALS.has(elemB) || BIOLOGICAL_METALS.has(resB);

  if ((isAMetal || isBMetal) && distance <= CANONICAL_METAL_COORD_CUTOFF) {
    const metalElem = isAMetal ? (elemA || resA) : (elemB || resB);
    const donorAtom = isAMetal ? atomB : atomA;
    const donorElem = (donorAtom.element || '').toUpperCase().trim();

    if (METAL_COORDINATING_ATOMS.has(donorElem) || donorElem === 'N' || donorElem === 'O' || donorElem === 'S') {
      type = 'METAL_COORDINATION';
      epistemicLevel =
        provenance === 'PREDICTED_POSE' ? 'PREDICTED_INTERACTION' : 'INFERRED_INTERACTION';
      details = {
        metalElement: metalElem,
        coordinationBondLength: distance,
      };
    }
  }

  // 2. Salt bridge (charged cationic <-> anionic)
  else if (distance <= CANONICAL_SALT_BRIDGE_CUTOFF) {
    const isACation = (resA === 'ARG' || resA === 'LYS' || resA === 'HIS') && CATIONIC_ATOMS.has(nameA);
    const isBCation = (resB === 'ARG' || resB === 'LYS' || resB === 'HIS') && CATIONIC_ATOMS.has(nameB);
    const isAAnion = (resA === 'ASP' || resA === 'GLU') && ANIONIC_ATOMS.has(nameA);
    const isBAnion = (resB === 'ASP' || resB === 'GLU') && ANIONIC_ATOMS.has(nameB);

    // Or ligand carboxylates/phosphates/amines
    const isLigandAnionA = ANIONIC_ATOMS.has(nameA) && resA !== 'ASP' && resA !== 'GLU';
    const isLigandAnionB = ANIONIC_ATOMS.has(nameB) && resB !== 'ASP' && resB !== 'GLU';

    if ((isACation && (isBAnion || isLigandAnionB)) || (isBCation && (isAAnion || isLigandAnionA))) {
      type = 'SALT_BRIDGE';
      epistemicLevel =
        provenance === 'PREDICTED_POSE' ? 'PREDICTED_INTERACTION' : 'INFERRED_INTERACTION';
    }
  }

  // 3. Hydrogen bonding
  if (type === 'GEOMETRIC_PROXIMITY' && distance <= CANONICAL_HBOND_DISTANCE_CUTOFF) {
    const isADonorAcceptor = HBOND_DONORS.has(elemA) || elemA === 'N' || elemA === 'O' || elemA === 'S';
    const isBDonorAcceptor = HBOND_ACCEPTORS.has(elemB) || elemB === 'O' || elemB === 'N' || elemB === 'S';

    if (isADonorAcceptor && isBDonorAcceptor) {
      if (explicitHydrogenCoord) {
        // Explicit hydrogen geometry available: D - H ... A
        const angle = computeAngleDegrees(atomA.coordinates, explicitHydrogenCoord, atomB.coordinates);
        if (angle >= 120.0) {
          type = 'HYDROGEN_BOND_EXPLICIT';
          epistemicLevel =
            provenance === 'PREDICTED_POSE' ? 'PREDICTED_INTERACTION' : 'OBSERVED_STRUCTURAL_CONTACT';
          details = { donorAcceptorAngleDeg: Number(angle.toFixed(1)) };
        } else {
          type = 'GEOMETRIC_PROXIMITY';
        }
      } else {
        // Hydrogens absent in experimental X-ray structure -> strictly putative
        type = 'HYDROGEN_BOND_PUTATIVE';
        epistemicLevel =
          provenance === 'PREDICTED_POSE' ? 'PREDICTED_INTERACTION' : 'INFERRED_INTERACTION';
      }
    }
  }

  // 4. Hydrophobic non-polar contact heuristic
  if (type === 'GEOMETRIC_PROXIMITY' && distance <= CANONICAL_HYDROPHOBIC_CUTOFF) {
    const isACarbon = elemA === 'C' && (NONPOLAR_CARBON_ATOMS.has(nameA) || nameA.startsWith('C'));
    const isBCarbon = elemB === 'C' && (NONPOLAR_CARBON_ATOMS.has(nameB) || nameB.startsWith('C'));

    // Exclude polar carbonyl carbons (C in peptide backbone)
    const isPolarCarbonA = nameA === 'C' && STANDARD_AMINO_ACIDS.has(resA);
    const isPolarCarbonB = nameB === 'C' && STANDARD_AMINO_ACIDS.has(resB);

    if (isACarbon && isBCarbon && !isPolarCarbonA && !isPolarCarbonB) {
      type = 'HYDROPHOBIC_HEURISTIC';
      epistemicLevel =
        provenance === 'PREDICTED_POSE' ? 'PREDICTED_INTERACTION' : 'INFERRED_INTERACTION';
    }
  }

  const label = `${atomA.chainId}:${atomA.residueName}:${atomA.residueNumber}:${atomA.atomName} <-> ${atomB.chainId}:${atomB.residueName}:${atomB.residueNumber}:${atomB.atomName} (${distance.toFixed(2)} A)`;

  return {
    contactId: `${atomA.chainId}_${atomA.residueNumber}_${atomA.atomName}__${atomB.chainId}_${atomB.residueNumber}_${atomB.atomName}`,
    source: atomA,
    target: atomB,
    distance: Number(distance.toFixed(2)),
    type,
    epistemicLevel,
    isInterChain,
    geometryDetails: details,
    provenance,
    label,
  };
}

/**
 * Aromatic ring definition for pi-stacking analysis.
 */
export interface AromaticRing {
  chainId: string;
  residueNumber: number;
  residueName: string;
  ringType: '6_MEMBERED' | '5_MEMBERED';
  centroid: [number, number, number];
  normal: [number, number, number];
  atomNames: string[];
}

/**
 * Extracts aromatic rings from residues (Phe, Tyr, Trp, His, or planar ligand rings).
 */
export function extractAromaticRings(atoms: ContactAtomDetail[]): AromaticRing[] {
  const rings: AromaticRing[] = [];
  const byRes = new Map<string, ContactAtomDetail[]>();

  for (const a of atoms) {
    const key = `${a.chainId}:${a.residueNumber}:${a.residueName}`;
    let list = byRes.get(key);
    if (!list) {
      list = [];
      byRes.set(key, list);
    }
    list.push(a);
  }

  for (const [key, resAtoms] of byRes.entries()) {
    const resName = resAtoms[0].residueName.toUpperCase().trim();
    const chainId = resAtoms[0].chainId;
    const resSeq = resAtoms[0].residueNumber;

    if (resName === 'PHE' || resName === 'TYR') {
      const ringAtoms = resAtoms.filter(a =>
        ['CG', 'CD1', 'CD2', 'CE1', 'CE2', 'CZ'].includes(a.atomName)
      );
      if (ringAtoms.length >= 5) {
        const ring = buildRingFromAtoms(ringAtoms, chainId, resSeq, resName, '6_MEMBERED');
        if (ring) rings.push(ring);
      }
    } else if (resName === 'TRP') {
      // 6-membered ring of Trp indole
      const ring6 = resAtoms.filter(a =>
        ['CD2', 'CE2', 'CZ2', 'CH2', 'CZ3', 'CE3'].includes(a.atomName)
      );
      if (ring6.length >= 5) {
        const r = buildRingFromAtoms(ring6, chainId, resSeq, resName, '6_MEMBERED');
        if (r) rings.push(r);
      }
      // 5-membered ring of Trp indole
      const ring5 = resAtoms.filter(a =>
        ['CG', 'CD1', 'NE1', 'CE2', 'CD2'].includes(a.atomName)
      );
      if (ring5.length >= 4) {
        const r = buildRingFromAtoms(ring5, chainId, resSeq, resName, '5_MEMBERED');
        if (r) rings.push(r);
      }
    } else if (resName === 'HIS') {
      // 5-membered imidazole ring
      const ringHis = resAtoms.filter(a =>
        ['CG', 'ND1', 'CE1', 'NE2', 'CD2'].includes(a.atomName)
      );
      if (ringHis.length >= 4) {
        const r = buildRingFromAtoms(ringHis, chainId, resSeq, resName, '5_MEMBERED');
        if (r) rings.push(r);
      }
    }
  }

  return rings;
}

function buildRingFromAtoms(
  atoms: ContactAtomDetail[],
  chainId: string,
  resSeq: number,
  resName: string,
  ringType: '6_MEMBERED' | '5_MEMBERED'
): AromaticRing | null {
  if (atoms.length < 3) return null;
  let sx = 0, sy = 0, sz = 0;
  for (const a of atoms) {
    sx += a.coordinates[0];
    sy += a.coordinates[1];
    sz += a.coordinates[2];
  }
  const centroid: [number, number, number] = [
    Number((sx / atoms.length).toFixed(3)),
    Number((sy / atoms.length).toFixed(3)),
    Number((sz / atoms.length).toFixed(3)),
  ];

  const normal = computePlaneNormal(atoms[0].coordinates, atoms[1].coordinates, atoms[2].coordinates);
  if (!normal) return null;

  return {
    chainId,
    residueNumber: resSeq,
    residueName: resName,
    ringType,
    centroid,
    normal,
    atomNames: atoms.map(a => a.atomName),
  };
}

/**
 * Detects pi-stacking interactions between two sets of aromatic rings.
 * Evaluates both centroid distance AND plane normal angle.
 */
export function detectPiStackingInteractions(
  proteinRings: AromaticRing[],
  ligandRings: AromaticRing[],
  provenance: InteractionProvenance = 'EXPERIMENTAL_DEPOSITED'
): MolecularContact[] {
  const contacts: MolecularContact[] = [];

  for (const pRing of proteinRings) {
    for (const lRing of ligandRings) {
      const dist = calculateEuclideanDistance(pRing.centroid, lRing.centroid);
      const angle = angleBetweenNormalsDeg(pRing.normal, lRing.normal);

      // Face-to-face parallel stacking: d <= 4.5 A, angle <= 30 deg
      if (dist <= CANONICAL_PI_PARALLEL_CUTOFF && angle <= 30.0) {
        contacts.push({
          contactId: `pi_par_${pRing.chainId}_${pRing.residueNumber}__${lRing.chainId}_${lRing.residueNumber}`,
          source: {
            chainId: pRing.chainId,
            residueNumber: pRing.residueNumber,
            residueName: pRing.residueName,
            atomName: 'CENTROID',
            element: 'C',
            coordinates: pRing.centroid,
            isHetero: false,
          },
          target: {
            chainId: lRing.chainId,
            residueNumber: lRing.residueNumber,
            residueName: lRing.residueName,
            atomName: 'CENTROID',
            element: 'C',
            coordinates: lRing.centroid,
            isHetero: true,
          },
          distance: Number(dist.toFixed(2)),
          type: 'PI_STACKING_PARALLEL',
          epistemicLevel:
            provenance === 'PREDICTED_POSE' ? 'PREDICTED_INTERACTION' : 'INFERRED_INTERACTION',
          isInterChain: pRing.chainId !== lRing.chainId,
          geometryDetails: {
            ringCentroidDistance: Number(dist.toFixed(2)),
            ringNormalAngleDeg: Number(angle.toFixed(1)),
          },
          provenance,
          label: `${pRing.chainId}:${pRing.residueName}:${pRing.residueNumber} <-> ${lRing.chainId}:${lRing.residueName}:${lRing.residueNumber} (parallel pi-stack, d=${dist.toFixed(2)} A, angle=${angle.toFixed(1)} deg)`,
        });
      }
      // Edge-to-face T-shaped stacking: d <= 5.5 A, angle in [60, 90] deg
      else if (dist <= CANONICAL_PI_TSHAPED_CUTOFF && angle >= 60.0 && angle <= 90.0) {
        contacts.push({
          contactId: `pi_tshape_${pRing.chainId}_${pRing.residueNumber}__${lRing.chainId}_${lRing.residueNumber}`,
          source: {
            chainId: pRing.chainId,
            residueNumber: pRing.residueNumber,
            residueName: pRing.residueName,
            atomName: 'CENTROID',
            element: 'C',
            coordinates: pRing.centroid,
            isHetero: false,
          },
          target: {
            chainId: lRing.chainId,
            residueNumber: lRing.residueNumber,
            residueName: lRing.residueName,
            atomName: 'CENTROID',
            element: 'C',
            coordinates: lRing.centroid,
            isHetero: true,
          },
          distance: Number(dist.toFixed(2)),
          type: 'PI_STACKING_T_SHAPED',
          epistemicLevel:
            provenance === 'PREDICTED_POSE' ? 'PREDICTED_INTERACTION' : 'INFERRED_INTERACTION',
          isInterChain: pRing.chainId !== lRing.chainId,
          geometryDetails: {
            ringCentroidDistance: Number(dist.toFixed(2)),
            ringNormalAngleDeg: Number(angle.toFixed(1)),
          },
          provenance,
          label: `${pRing.chainId}:${pRing.residueName}:${pRing.residueNumber} <-> ${lRing.chainId}:${lRing.residueName}:${lRing.residueNumber} (T-shaped pi-stack, d=${dist.toFixed(2)} A, angle=${angle.toFixed(1)} deg)`,
        });
      }
    }
  }

  return contacts;
}
