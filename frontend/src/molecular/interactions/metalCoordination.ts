/**
 * MOCS-Cert Biological Metal Coordination Engine
 * 
 * Epistemic Rules:
 * 1. Metal coordination geometry is characterized by donor heteroatoms (N, O, S) within 2.8 A.
 * 2. Oxidation states, formal charges, and spin states cannot be deduced solely from
 *    atomic coordinates and must not be fabricated.
 * 3. Metal coordination does not imply functional catalysis without biochemical assays.
 */

import { calculateEuclideanDistance } from '../measurements/calculations';
import type { ContactAtomDetail, MolecularContact, InteractionProvenance } from './types';
import { BIOLOGICAL_METALS } from './ligandIdentity';

export interface MetalCenterCoordinationSummary {
  metalAtom: ContactAtomDetail;
  coordinationNumber: number;
  coordinatingLigands: Array<{
    donorAtom: ContactAtomDetail;
    distance: number;
    coordinationType: 'PROTEIN_SIDECHAIN' | 'PROTEIN_BACKBONE' | 'LIGAND_HETEROATOM' | 'SOLVENT_WATER';
  }>;
  geometryAssessment: 'OCTAHEDRAL_LIKE' | 'TETRAHEDRAL_LIKE' | 'SQUARE_PLANAR_LIKE' | 'IRREGULAR';
  epistemicDisclaimer: string;
}

/**
 * Analyzes the coordination sphere around a biological metal atom.
 */
export function analyzeMetalCoordinationSphere(
  metalAtom: ContactAtomDetail,
  candidateAtoms: ContactAtomDetail[],
  cutoff = 2.8,
  provenance: InteractionProvenance = 'EXPERIMENTAL_DEPOSITED'
): MetalCenterCoordinationSummary {
  const metalElem = (metalAtom.element || metalAtom.residueName || '').toUpperCase().trim();
  const coordinating: MetalCenterCoordinationSummary['coordinatingLigands'] = [];

  for (const cand of candidateAtoms) {
    // Avoid comparing metal to itself
    if (
      cand.chainId === metalAtom.chainId &&
      cand.residueNumber === metalAtom.residueNumber &&
      cand.atomName === metalAtom.atomName
    ) {
      continue;
    }

    const elem = (cand.element || '').toUpperCase().trim();
    if (!['N', 'O', 'S', 'CL', 'F'].includes(elem)) continue;

    const dist = calculateEuclideanDistance(metalAtom.coordinates, cand.coordinates);
    if (dist <= cutoff && dist > 0.5) {
      let coordinationType: MetalCenterCoordinationSummary['coordinatingLigands'][0]['coordinationType'] = 'LIGAND_HETEROATOM';
      if (cand.residueName === 'HOH' || cand.residueName === 'WAT') {
        coordinationType = 'SOLVENT_WATER';
      } else if (['O', 'N'].includes(cand.atomName)) {
        coordinationType = 'PROTEIN_BACKBONE';
      } else if (cand.isHetero) {
        coordinationType = 'LIGAND_HETEROATOM';
      } else {
        coordinationType = 'PROTEIN_SIDECHAIN';
      }

      coordinating.push({
        donorAtom: cand,
        distance: Number(dist.toFixed(2)),
        coordinationType,
      });
    }
  }

  // Sort by distance
  coordinating.sort((a, b) => a.distance - b.distance);

  const coordNumber = coordinating.length;
  let geometryAssessment: MetalCenterCoordinationSummary['geometryAssessment'] = 'IRREGULAR';
  if (coordNumber === 4) {
    geometryAssessment = 'TETRAHEDRAL_LIKE';
  } else if (coordNumber === 6) {
    geometryAssessment = 'OCTAHEDRAL_LIKE';
  } else if (coordNumber === 5) {
    geometryAssessment = 'OCTAHEDRAL_LIKE'; // often square pyramidal / 5-coordinate heme
  }

  const epistemicDisclaimer =
    'Geometric coordination sphere derived from atomic coordinates (d <= ' + cutoff + ' A). ' +
    'Oxidation state, spin state, and electronic charge require experimental spectroscopic confirmation.';

  return {
    metalAtom,
    coordinationNumber: coordNumber,
    coordinatingLigands: coordinating,
    geometryAssessment,
    epistemicDisclaimer,
  };
}
