/**
 * MOCS-Cert Ligand Binding-Site & Molecular-Interaction Analyzer
 * 
 * Non-Negotiable Scientific Principles:
 * 1. A physical distance cutoff alone does not prove biological binding.
 * 2. An unannotated contact neighborhood is strictly labeled as
 *    "Ligand-contacting residues within X A (geometric neighborhood)", NEVER "active site".
 * 3. Proximity rank strictly measures geometric distance, NEVER thermodynamic binding affinity (Kd, Ki, deltaG).
 * 4. Interfacial ligands correctly report residues from all participating chains.
 */

import { calculateEuclideanDistance } from '../measurements/calculations';
import type { IndexedComponent, ValidatedAtom } from '../geometry/structuralIdentity';
import {
  filterCanonicalAltLocs,
  isValidAtomCoord,
} from './contactCalculations';
import {
  classifyPairInteraction,
  extractAromaticRings,
  detectPiStackingInteractions,
} from './interactionClassifier';
import type {
  LigandInstanceIdentity,
  ContactAtomDetail,
  MolecularContact,
  ContactingResidueSummary,
  BindingSiteNeighborhood,
  InteractionClassification,
} from './types';

export interface BindingSiteAnalysisOptions {
  cutoffAngstroms?: number;     // Default 4.0 A
  includeSolvent?: boolean;      // Default false (strictly excludes water from binding site residues)
  includeOtherLigands?: boolean; // Default false (isolates target ligand)
  includeNucleic?: boolean;      // Default false (distinguishes protein vs nucleic)
}

/**
 * Analyzes the structural contact neighborhood of a ligand instance within a molecular structure.
 */
export function analyzeLigandBindingSite(
  ligand: LigandInstanceIdentity,
  allComponents: IndexedComponent[],
  options: BindingSiteAnalysisOptions = {}
): BindingSiteNeighborhood {
  const cutoff = options.cutoffAngstroms ?? 4.0;
  const includeSolvent = options.includeSolvent ?? false;
  const includeOtherLigands = options.includeOtherLigands ?? false;
  const includeNucleic = options.includeNucleic ?? false;

  // 1. Locate target ligand component in allComponents
  const ligandComp = allComponents.find(c =>
    c.id.structureId.toUpperCase() === ligand.structureId.toUpperCase() &&
    String(c.id.modelId) === String(ligand.modelId) &&
    c.id.chainId.toUpperCase() === ligand.chainId.toUpperCase() &&
    c.id.residueName.toUpperCase() === ligand.residueName.toUpperCase() &&
    c.id.residueNumber === ligand.residueNumber &&
    (c.id.insertionCode || '') === (ligand.insertionCode || '')
  );

  const rawLigandAtoms = ligandComp ? ligandComp.atoms : [];
  const canonicalLigandAtoms = filterCanonicalAltLocs(rawLigandAtoms).filter(isValidAtomCoord);

  const hasMissingCoordinates = canonicalLigandAtoms.length === 0;

  // Transform ligand atoms to ContactAtomDetail
  const ligandAtomDetails: ContactAtomDetail[] = canonicalLigandAtoms.map(a => ({
    chainId: ligand.chainId,
    residueNumber: ligand.residueNumber,
    residueName: ligand.residueName,
    insertionCode: ligand.insertionCode,
    atomName: a.atomName,
    element: a.element,
    coordinates: a.coordinates,
    isHetero: a.isHetero,
    altLoc: a.altLoc,
  }));

  // 2. Collect candidate macromolecular atoms
  const candidateAtomDetails: ContactAtomDetail[] = [];

  for (const comp of allComponents) {
    // Model isolation: strictly skip components from a different model
    if (String(comp.id.modelId) !== String(ligand.modelId)) continue;

    // Skip the target ligand itself
    if (
      comp.id.chainId.toUpperCase() === ligand.chainId.toUpperCase() &&
      comp.id.residueName.toUpperCase() === ligand.residueName.toUpperCase() &&
      comp.id.residueNumber === ligand.residueNumber &&
      (comp.id.insertionCode || '') === (ligand.insertionCode || '')
    ) {
      continue;
    }

    const cls = comp.id.classification;

    // Segregation filters
    if (cls === 'solvent' && !includeSolvent) continue;
    if ((cls === 'ligand' || cls === 'cofactor' || cls === 'ion') && !includeOtherLigands) {
      // Check if it is an ion or metal associated with the binding site
      if (cls !== 'ion') continue;
    }
    if (cls === 'nucleic' && !includeNucleic) continue;

    const validAtoms = filterCanonicalAltLocs(comp.atoms).filter(isValidAtomCoord);
    for (const a of validAtoms) {
      candidateAtomDetails.push({
        chainId: comp.id.chainId,
        residueNumber: comp.id.residueNumber,
        residueName: comp.id.residueName,
        insertionCode: comp.id.insertionCode,
        atomName: a.atomName,
        element: a.element,
        coordinates: a.coordinates,
        isHetero: a.isHetero,
        altLoc: a.altLoc,
      });
    }
  }

  // 3. Pairwise contact evaluation
  const contacts: MolecularContact[] = [];
  const contactingResidueMap = new Map<
    string,
    {
      chainId: string;
      residueNumber: number;
      residueName: string;
      insertionCode?: string;
      minDistance: number;
      contactCount: number;
      interactionTypes: Set<InteractionClassification>;
    }
  >();

  for (const cand of candidateAtomDetails) {
    for (const lig of ligandAtomDetails) {
      const dist = calculateEuclideanDistance(cand.coordinates, lig.coordinates);
      if (dist <= cutoff) {
        const contact = classifyPairInteraction(cand, lig, dist, ligand.provenance);
        contacts.push(contact);

        const resKey = `${cand.chainId}:${cand.residueNumber}${cand.insertionCode ? ':' + cand.insertionCode : ''}`;
        let resRecord = contactingResidueMap.get(resKey);
        if (!resRecord) {
          resRecord = {
            chainId: cand.chainId,
            residueNumber: cand.residueNumber,
            residueName: cand.residueName,
            insertionCode: cand.insertionCode,
            minDistance: dist,
            contactCount: 0,
            interactionTypes: new Set<InteractionClassification>(),
          };
          contactingResidueMap.set(resKey, resRecord);
        }

        resRecord.contactCount++;
        resRecord.interactionTypes.add(contact.type);
        if (dist < resRecord.minDistance) {
          resRecord.minDistance = dist;
        }
      }
    }
  }

  // 4. Detect pi-stacking interactions between aromatic rings
  const proteinRings = extractAromaticRings(candidateAtomDetails);
  const ligandRings = extractAromaticRings(ligandAtomDetails);
  const piContacts = detectPiStackingInteractions(proteinRings, ligandRings, ligand.provenance);
  contacts.push(...piContacts);

  for (const pi of piContacts) {
    const resKey = `${pi.source.chainId}:${pi.source.residueNumber}${pi.source.insertionCode ? ':' + pi.source.insertionCode : ''}`;
    const resRecord = contactingResidueMap.get(resKey);
    if (resRecord) {
      resRecord.interactionTypes.add(pi.type);
    }
  }

  // 5. Structure contacting residues summary & proximity ranking
  const rawResidues = Array.from(contactingResidueMap.values());
  rawResidues.sort((a, b) => a.minDistance - b.minDistance);

  const contactingChainsSet = new Set<string>();
  const contactingResidues: ContactingResidueSummary[] = rawResidues.map((r, idx) => {
    contactingChainsSet.add(r.chainId);
    return {
      chainId: r.chainId,
      residueNumber: r.residueNumber,
      residueName: r.residueName,
      insertionCode: r.insertionCode,
      minDistance: Number(r.minDistance.toFixed(2)),
      contactCount: r.contactCount,
      interactionTypes: Array.from(r.interactionTypes),
      proximityRank: idx + 1,
      isInterfacial: r.chainId.toUpperCase() !== ligand.chainId.toUpperCase(),
    };
  });

  const contactingChains = Array.from(contactingChainsSet).sort();
  const isInterfacial = contactingChains.length > 1;

  // 6. Group interactions by classification
  const interactionsByType: BindingSiteNeighborhood['interactionsByType'] = {
    hydrogenBonds: contacts.filter(c => c.type === 'HYDROGEN_BOND_EXPLICIT' || c.type === 'HYDROGEN_BOND_PUTATIVE'),
    saltBridges: contacts.filter(c => c.type === 'SALT_BRIDGE'),
    hydrophobicContacts: contacts.filter(c => c.type === 'HYDROPHOBIC_HEURISTIC'),
    piStackings: contacts.filter(c => c.type === 'PI_STACKING_PARALLEL' || c.type === 'PI_STACKING_T_SHAPED'),
    metalCoordinations: contacts.filter(c => c.type === 'METAL_COORDINATION'),
    covalentBonds: contacts.filter(c => c.type === 'COVALENT_BOND'),
    geometricProximities: contacts.filter(c => c.type === 'GEOMETRIC_PROXIMITY'),
  };

  const disclaimer =
    'Geometric contact neighborhood strictly defined by Euclidean proximity (cutoff: ' + cutoff + ' A). ' +
    'Does not imply catalytic active site, free energy of binding (deltaG), or experimental affinity (Kd, Ki, IC50) without functional assay confirmation.';

  return {
    ligand,
    cutoffAngstroms: cutoff,
    definition: 'GEOMETRIC_CONTACT_NEIGHBORHOOD',
    contactingChains,
    contactingResidues,
    contacts,
    interactionsByType,
    isInterfacial,
    isPredicted: ligand.provenance === 'PREDICTED_POSE',
    hasMissingCoordinates,
    disclaimer,
  };
}
