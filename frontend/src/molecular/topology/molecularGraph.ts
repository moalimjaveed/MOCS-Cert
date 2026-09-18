/**
 * Master Canonical Molecular Graph & Chemical Topology Engine
 * 
 * Epistemic Rules:
 * 1. Coordinates describe WHERE atoms are; Topology describes WHAT atoms are bonded to.
 * 2. Precedence hierarchy: Deposited mmCIF/PDB -> Polymeric Templates -> Chemical Component Templates -> Guarded Geometric Inference.
 * 3. Connected components must reflect genuine covalent connectivity: DNA strands must remain separate components.
 * 4. Cross-chain and cross-model leakage are strictly prohibited.
 */

import {
  buildCanonicalAtomKey,
  buildCanonicalBondKey,
  areAtomsInSameModel,
  areAtomsAltLocCompatible,
} from './atomIdentity';
import { isCovalentDistance } from './covalentRadii';
import { parsePdbConectRecords } from './conectParser';
import { parseStructConnRecords, type StructConnRecord } from './mmcifConnParser';
import {
  buildPeptideBonds,
  buildPhosphodiesterBonds,
  buildDisulfideBonds,
} from './biopolymerTopology';
import { buildIntraResidueBonds } from './chemicalTemplates';
import { perceiveRings } from './ringPerception';
import { calculateEuclideanDistance } from '../measurements/calculations';
import type {
  CanonicalAtomKey,
  CanonicalBondKey,
  TopologyAtom,
  TopologyBond,
  MolecularGraph,
  ValenceAuditRecord,
} from './types';

export interface GraphBuildInput {
  structureId: string;
  modelId?: string | number;
  atoms: Array<{
    chainId: string;
    residueName: string;
    residueNumber: number;
    insertionCode?: string;
    atomName: string;
    altLoc?: string;
    element?: string;
    coordinates: [number, number, number];
    serial?: number;
    formalCharge?: number;
    isHetero?: boolean;
  }>;
  pdbText?: string;
  structConnRecords?: StructConnRecord[];
  enableGeometricInferenceFallback?: boolean;
}

export function buildMolecularGraph(input: GraphBuildInput): MolecularGraph {
  const structId = (input.structureId || 'UNKNOWN').toUpperCase().trim();
  const modelId = input.modelId ?? 1;

  const atomMap = new Map<CanonicalAtomKey, TopologyAtom>();
  const serialToKeyMap = new Map<number, CanonicalAtomKey>();
  const bonds = new Map<CanonicalBondKey, TopologyBond>();
  const warnings: string[] = [];

  // 1. Ingest atoms and build canonical keys
  for (const raw of input.atoms) {
    const key = buildCanonicalAtomKey({
      structureId: structId,
      modelId,
      chainId: raw.chainId,
      residueName: raw.residueName,
      residueNumber: raw.residueNumber,
      insertionCode: raw.insertionCode,
      atomName: raw.atomName,
      altLoc: raw.altLoc,
    });

    const elem = (raw.element || raw.atomName.charAt(0) || 'C').toUpperCase().trim();
    const atom: TopologyAtom = {
      key,
      structureId: structId,
      modelId,
      chainId: raw.chainId,
      residueName: raw.residueName,
      residueNumber: raw.residueNumber,
      insertionCode: raw.insertionCode,
      atomName: raw.atomName,
      altLoc: raw.altLoc,
      element: elem,
      coordinates: raw.coordinates,
      formalCharge: raw.formalCharge,
      isHetero: raw.isHetero ?? false,
    };

    atomMap.set(key, atom);
    if (raw.serial !== undefined) {
      serialToKeyMap.set(raw.serial, key);
    }
  }

  const allAtoms = Array.from(atomMap.values());

  // Helper to add bond with safety guards
  const addBond = (b: TopologyBond) => {
    // Guards: self-loop, cross-model, altLoc incompatibility
    if (b.atomAKey === b.atomBKey) return;
    if (!areAtomsInSameModel(b.atomAKey, b.atomBKey)) {
      warnings.push(`Rejected cross-model bond between ${b.atomAKey} and ${b.atomBKey}.`);
      return;
    }
    if (!areAtomsAltLocCompatible(b.atomAKey, b.atomBKey)) {
      warnings.push(`Rejected cross-altLoc bond between ${b.atomAKey} and ${b.atomBKey}.`);
      return;
    }

    if (!bonds.has(b.key)) {
      bonds.set(b.key, b);
    }
  };

  // 2. Ingest Deposited mmCIF _struct_conn records (highest precedence)
  if (input.structConnRecords && input.structConnRecords.length > 0) {
    const structConnBonds = parseStructConnRecords(structId, modelId, input.structConnRecords);
    for (const scb of structConnBonds) {
      const atomA = atomMap.get(scb.atomAKey);
      const atomB = atomMap.get(scb.atomBKey);
      const dist = atomA && atomB ? calculateEuclideanDistance(atomA.coordinates, atomB.coordinates) : 0;
      addBond({
        key: scb.key,
        atomAKey: scb.atomAKey,
        atomBKey: scb.atomBKey,
        bondType: scb.bondType,
        bondOrder: scb.bondOrder,
        isAromatic: scb.isAromatic,
        source: 'DEPOSITED_STRUCT_CONN',
        measuredDistance: Number(dist.toFixed(3)),
        isInterChain: atomA && atomB ? atomA.chainId !== atomB.chainId : false,
        isInterResidue: atomA && atomB ? atomA.residueNumber !== atomB.residueNumber : false,
        notes: `Deposited mmCIF connection (${scb.connTypeId})`,
      });
    }
  }

  // 3. Ingest Deposited PDB CONECT records
  if (input.pdbText && serialToKeyMap.size > 0) {
    const conectBonds = parsePdbConectRecords(input.pdbText, serialToKeyMap);
    for (const cb of conectBonds) {
      const atomA = atomMap.get(cb.atomAKey);
      const atomB = atomMap.get(cb.atomBKey);
      const dist = atomA && atomB ? calculateEuclideanDistance(atomA.coordinates, atomB.coordinates) : 0;
      addBond({
        key: cb.key,
        atomAKey: cb.atomAKey,
        atomBKey: cb.atomBKey,
        bondType: cb.bondType,
        bondOrder: cb.multiplicity,
        isAromatic: false,
        source: 'DEPOSITED_CONECT',
        measuredDistance: Number(dist.toFixed(3)),
        isInterChain: atomA && atomB ? atomA.chainId !== atomB.chainId : false,
        isInterResidue: atomA && atomB ? atomA.residueNumber !== atomB.residueNumber : false,
        notes: `Deposited PDB CONECT record (order ${cb.multiplicity})`,
      });
    }
  }

  // 4. Build Biopolymer Backbone: Peptide and Phosphodiester bonds
  const peptideBonds = buildPeptideBonds(allAtoms);
  for (const pb of peptideBonds) addBond(pb);

  const phosphodiesterBonds = buildPhosphodiesterBonds(allAtoms);
  for (const ncb of phosphodiesterBonds) addBond(ncb);

  // 5. Build Cysteine Disulfide Bridges
  const disulfides = buildDisulfideBonds(allAtoms);
  for (const db of disulfides) addBond(db);

  // 6. Build Intra-Residue Chemical Component Dictionary (CCD) Bonds
  // Group atoms by residue
  const resGroups = new Map<string, TopologyAtom[]>();
  for (const a of allAtoms) {
    const rKey = `${a.chainId}:${a.residueName}:${a.residueNumber}${a.insertionCode ? ':' + a.insertionCode : ''}`;
    if (!resGroups.has(rKey)) resGroups.set(rKey, []);
    resGroups.get(rKey)!.push(a);
  }

  for (const [, resAtoms] of resGroups.entries()) {
    const ccdBonds = buildIntraResidueBonds(resAtoms);
    for (const ccb of ccdBonds) addBond(ccb);
  }

  // 7. Optional Guarded Geometric Fallback (for unmodeled hetero residues / custom ligands)
  if (input.enableGeometricInferenceFallback) {
    for (const [, resAtoms] of resGroups.entries()) {
      const isHet = resAtoms.some((a) => a.isHetero);
      if (!isHet) continue; // Polymers already handled by CCD templates and backbone builders

      const count = resAtoms.length;
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const a1 = resAtoms[i];
          const a2 = resAtoms[j];
          const bKey = buildCanonicalBondKey(a1.key, a2.key);
          if (bonds.has(bKey)) continue;

          const dist = calculateEuclideanDistance(a1.coordinates, a2.coordinates);
          if (isCovalentDistance(a1.element, a2.element, dist)) {
            addBond({
              key: bKey,
              atomAKey: a1.key < a2.key ? a1.key : a2.key,
              atomBKey: a1.key < a2.key ? a2.key : a1.key,
              bondType: 'COVALENT_SINGLE',
              bondOrder: 1,
              isAromatic: false,
              source: 'GEOMETRIC_INFERENCE',
              measuredDistance: Number(dist.toFixed(3)),
              isInterChain: false,
              isInterResidue: false,
              notes: 'Guarded covalent-radii distance inference',
            });
          }
        }
      }
    }
  }

  // 8. Build Adjacency Map
  const adjacency = new Map<CanonicalAtomKey, CanonicalAtomKey[]>();
  for (const key of atomMap.keys()) {
    adjacency.set(key, []);
  }

  for (const b of bonds.values()) {
    if (adjacency.has(b.atomAKey) && adjacency.has(b.atomBKey)) {
      adjacency.get(b.atomAKey)!.push(b.atomBKey);
      adjacency.get(b.atomBKey)!.push(b.atomAKey);
    }
  }

  // 9. Compute Connected Components via BFS
  const connectedComponents: CanonicalAtomKey[][] = [];
  const visited = new Set<CanonicalAtomKey>();

  for (const key of atomMap.keys()) {
    if (visited.has(key)) continue;

    const component: CanonicalAtomKey[] = [];
    const queue: CanonicalAtomKey[] = [key];
    visited.add(key);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      component.push(curr);
      const nbrs = adjacency.get(curr) || [];
      for (const nbr of nbrs) {
        if (!visited.has(nbr)) {
          visited.add(nbr);
          queue.push(nbr);
        }
      }
    }

    connectedComponents.push(component);
  }

  // 10. Perceive Chemical Rings & Aromaticity
  const rings = perceiveRings(adjacency, atomMap);

  // 11. Valence Validation
  const valences: ValenceAuditRecord[] = [];
  const expectedRanges: Record<string, [number, number]> = {
    H: [1, 1],
    C: [4, 4],
    N: [3, 4],
    O: [1, 2],
    P: [3, 5],
    S: [2, 6],
    F: [1, 1],
    CL: [1, 1],
    BR: [1, 1],
    I: [1, 1],
  };

  for (const [atomKey, neighbors] of adjacency.entries()) {
    const a = atomMap.get(atomKey);
    if (!a) continue;

    const elem = a.element.toUpperCase().trim();
    const exp = expectedRanges[elem];
    if (exp) {
      // Calculate total bond order sum
      let sumOrder = 0;
      for (const nbrKey of neighbors) {
        const bKey = buildCanonicalBondKey(atomKey, nbrKey);
        const b = bonds.get(bKey);
        sumOrder += b?.bondOrder ?? 1;
      }

      const isValid = sumOrder <= exp[1] + 0.5; // Allow for delocalization/resonance
      valences.push({
        atomKey,
        element: elem,
        calculatedValence: Number(sumOrder.toFixed(1)),
        expectedValenceRange: exp,
        isValenceValid: isValid,
        notes: isValid ? 'Valence in nominal range' : `Potential valence anomaly: calculated ${sumOrder} exceeds max ${exp[1]}`,
      });

      if (!isValid && elem === 'C' && sumOrder > 4.5) {
        warnings.push(`Hypervalent Carbon detected at ${atomKey} (valence ${sumOrder}).`);
      }
    }
  }

  // Metrics aggregation
  let disulfideCount = 0;
  let peptideBondCount = 0;
  let phosphodiesterBondCount = 0;
  let metalCoordinationCount = 0;

  for (const b of bonds.values()) {
    if (b.bondType === 'DISULFIDE') disulfideCount++;
    else if (b.bondType === 'PEPTIDE') peptideBondCount++;
    else if (b.bondType === 'PHOSPHODIESTER') phosphodiesterBondCount++;
    else if (b.bondType === 'METAL_COORDINATION') metalCoordinationCount++;
  }

  return {
    structureId: structId,
    modelId,
    atoms: atomMap,
    bonds,
    adjacency,
    rings,
    connectedComponents,
    valences,
    disulfideCount,
    peptideBondCount,
    phosphodiesterBondCount,
    metalCoordinationCount,
    warnings,
  };
}
