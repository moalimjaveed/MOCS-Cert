/**
 * MOCS-Cert Protein Structural Biology — Residue & Atom Correspondence Engine
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: wwPDB mmCIF Chemical Component Dictionary / Strict Physical Correspondence
 */

import type {
  AtomScope,
  WeightScheme,
  ResiduePairingMode,
  AtomCorrespondenceResult,
  PairedAtomRecord,
  SequenceAlignmentResult,
} from './comparisonTypes';
import { alignSequencesNeedlemanWunsch, type SequenceInputItem } from './sequenceAlignment';
import { THREE_TO_ONE_LETTER_MAP } from './classifier';

export interface ProteinStructureInputAtom {
  serial?: number;
  atomName?: string;
  name?: string;
  element?: string;
  resName?: string;
  resn?: string;
  residueName?: string;
  chainId?: string;
  chain?: string;
  resSeq?: number;
  resi?: number;
  residueNumber?: number;
  insCode?: string;
  inscode?: string;
  altLoc?: string;
  modelId?: number | string;
  occupancy?: number;
  coordinates?: [number, number, number];
  coords?: [number, number, number];
  x?: number;
  y?: number;
  z?: number;
  isHetero?: boolean;
}

const ATOMIC_MASSES: Record<string, number> = {
  H: 1.008,
  C: 12.011,
  N: 14.007,
  O: 15.999,
  S: 32.065,
  P: 30.974,
  FE: 55.845,
  ZN: 65.38,
  MG: 24.305,
  CA: 40.078,
  SE: 78.96,
};

export interface NormalizedComparisonAtom {
  atomName: string;
  element: string;
  resName: string;
  chainId: string;
  resSeq: number;
  insCode?: string;
  altLoc?: string;
  modelId: number | string;
  occupancy: number;
  coords: [number, number, number];
  mass: number;
}

/**
 * Normalizes raw atom input, filtering for requested model and selecting primary altLoc conformer.
 * Strictly prevents double-counting alternate conformations.
 */
export function normalizeStructureAtoms(
  atoms: ProteinStructureInputAtom[],
  selectedModelId?: number | string,
  preferredAltLoc = 'A'
): NormalizedComparisonAtom[] {
  const result: NormalizedComparisonAtom[] = [];
  const seenAtoms = new Set<string>();

  for (const a of atoms) {
    if (!a) continue;

    const modelId = a.modelId ?? 1;
    if (selectedModelId !== undefined && String(modelId) !== String(selectedModelId)) {
      continue;
    }

    const alt = (a.altLoc || '').trim().toUpperCase();
    // Deterministic conformer selection: allow blank or preferredAltLoc ('A')
    if (alt !== '' && alt !== preferredAltLoc.toUpperCase()) {
      continue;
    }

    const chainId = String(a.chainId || a.chain || 'A');
    const resSeq = Number(a.resSeq ?? a.resi ?? a.residueNumber ?? 0);
    const insCode = a.insCode || a.inscode || undefined;
    const resName = String(a.resName || a.resn || a.residueName || 'UNK').toUpperCase();
    const atomName = String(a.atomName || a.name || '').trim().toUpperCase();
    let element = String(a.element || '').trim().toUpperCase();

    if (!element && atomName) {
      // Inferred element from atomName
      if (atomName.length >= 2 && (atomName === 'FE' || atomName === 'ZN' || atomName === 'MG' || atomName === 'SE')) {
        element = atomName;
      } else {
        element = atomName[0];
      }
    }

    let coords: [number, number, number] | null = null;
    if (a.coordinates && Array.isArray(a.coordinates)) {
      coords = a.coordinates as [number, number, number];
    } else if (a.coords && Array.isArray(a.coords)) {
      coords = a.coords as [number, number, number];
    } else if (typeof a.x === 'number' && typeof a.y === 'number' && typeof a.z === 'number') {
      coords = [a.x, a.y, a.z];
    }

    if (!coords || !atomName) {
      continue;
    }

    // Key to prevent duplicate atom insertion within same residue
    const uniqueAtomKey = `${modelId}:${chainId}:${resSeq}${insCode || ''}:${atomName}`;
    if (seenAtoms.has(uniqueAtomKey)) {
      continue;
    }
    seenAtoms.add(uniqueAtomKey);

    const mass = ATOMIC_MASSES[element] || 12.011;
    const occupancy = typeof a.occupancy === 'number' ? a.occupancy : 1.0;

    result.push({
      atomName,
      element,
      resName,
      chainId,
      resSeq,
      insCode,
      altLoc: alt || undefined,
      modelId,
      occupancy,
      coords,
      mass,
    });
  }

  return result;
}

export interface BuildCorrespondenceOptions {
  atomScope?: AtomScope;
  pairingMode?: ResiduePairingMode;
  weightScheme?: WeightScheme;
  sourceChainId?: string;
  targetChainId?: string;
  sourceModelId?: number | string;
  targetModelId?: number | string;
  customAtomNames?: string[];
  explicitResidueMap?: Map<string, string>; // "sourceChain:resSeq" -> "targetChain:resSeq"
}

/**
 * Builds rigorous, traceable atom correspondence between two protein structures.
 */
export function buildAtomCorrespondence(
  sourceAtomsRaw: ProteinStructureInputAtom[],
  targetAtomsRaw: ProteinStructureInputAtom[],
  options: BuildCorrespondenceOptions = {}
): {
  correspondence: AtomCorrespondenceResult;
  sequenceAlignment?: SequenceAlignmentResult;
} {
  const atomScope = options.atomScope ?? 'CA';
  const pairingMode = options.pairingMode ?? 'sequence-alignment';
  const weightScheme = options.weightScheme ?? 'uniform';

  // 1. Normalize atoms with altLoc deduplication and model filtering
  const sourceAtomsAll = normalizeStructureAtoms(sourceAtomsRaw, options.sourceModelId);
  const targetAtomsAll = normalizeStructureAtoms(targetAtomsRaw, options.targetModelId);

  // Filter by requested chain if specified
  const sourceAtoms = options.sourceChainId
    ? sourceAtomsAll.filter((a) => a.chainId === options.sourceChainId)
    : sourceAtomsAll;
  const targetAtoms = options.targetChainId
    ? targetAtomsAll.filter((a) => a.chainId === options.targetChainId)
    : targetAtomsAll;

  // 2. Extract ordered unique residues for each structure
  const sourceResMap = new Map<string, NormalizedComparisonAtom[]>();
  for (const a of sourceAtoms) {
    const key = `${a.chainId}:${a.resSeq}${a.insCode || ''}`;
    if (!sourceResMap.has(key)) sourceResMap.set(key, []);
    sourceResMap.get(key)!.push(a);
  }

  const targetResMap = new Map<string, NormalizedComparisonAtom[]>();
  for (const a of targetAtoms) {
    const key = `${a.chainId}:${a.resSeq}${a.insCode || ''}`;
    if (!targetResMap.has(key)) targetResMap.set(key, []);
    targetResMap.get(key)!.push(a);
  }

  // 3. Build residue-level mapping according to pairingMode
  let residueMapping = new Map<string, string>();
  let seqAlignResult: SequenceAlignmentResult | undefined;

  if (pairingMode === 'sequence-alignment') {
    // Construct sequence input items
    const sourceSeqItems: SequenceInputItem[] = [];
    for (const [key, atoms] of sourceResMap.entries()) {
      const rep = atoms[0];
      const char1 = (THREE_TO_ONE_LETTER_MAP as Record<string, string>)[rep.resName] || 'X';
      sourceSeqItems.push({
        chainId: rep.chainId,
        resSeq: rep.resSeq,
        insCode: rep.insCode,
        resName: rep.resName,
        char1,
        hasCoords: atoms.some((a) => a.atomName === 'CA' || a.atomName === 'N'),
      });
    }

    const targetSeqItems: SequenceInputItem[] = [];
    for (const [key, atoms] of targetResMap.entries()) {
      const rep = atoms[0];
      const char1 = (THREE_TO_ONE_LETTER_MAP as Record<string, string>)[rep.resName] || 'X';
      targetSeqItems.push({
        chainId: rep.chainId,
        resSeq: rep.resSeq,
        insCode: rep.insCode,
        resName: rep.resName,
        char1,
        hasCoords: atoms.some((a) => a.atomName === 'CA' || a.atomName === 'N'),
      });
    }

    seqAlignResult = alignSequencesNeedlemanWunsch(sourceSeqItems, targetSeqItems);
    residueMapping = seqAlignResult.sourceToTargetResidueMap;
  } else if (pairingMode === 'canonical-numbering') {
    for (const [key, atoms] of sourceResMap.entries()) {
      const rep = atoms[0];
      // Canonical matching: exact same resSeq and insCode
      // If targetChainId is different, use targetChainId, otherwise match exact chain
      const targetChain = options.targetChainId || rep.chainId;
      const targetKey = `${targetChain}:${rep.resSeq}${rep.insCode || ''}`;
      if (targetResMap.has(targetKey)) {
        residueMapping.set(key, targetKey);
      }
    }
  } else if (pairingMode === 'explicit-map' && options.explicitResidueMap) {
    residueMapping = options.explicitResidueMap;
  }

  // 4. Filter atoms by atomScope and build paired atoms
  const pairedAtoms: PairedAtomRecord[] = [];
  const pairedCoordsSource: [number, number, number][] = [];
  const pairedCoordsTarget: [number, number, number][] = [];
  const weights: number[] = [];

  const shouldIncludeAtom = (atomName: string, element: string): boolean => {
    switch (atomScope) {
      case 'CA':
        return atomName === 'CA';
      case 'backbone':
        return atomName === 'N' || atomName === 'CA' || atomName === 'C' || atomName === 'O';
      case 'heavy':
        return element !== 'H';
      case 'all':
        return true;
      case 'custom':
        return options.customAtomNames ? options.customAtomNames.includes(atomName) : true;
      default:
        return atomName === 'CA';
    }
  };

  for (const [sourceKey, targetKey] of residueMapping.entries()) {
    const sAtoms = sourceResMap.get(sourceKey) || [];
    const tAtoms = targetResMap.get(targetKey) || [];

    const tAtomByAtomName = new Map<string, NormalizedComparisonAtom>();
    for (const ta of tAtoms) {
      tAtomByAtomName.set(ta.atomName, ta);
    }

    for (const sa of sAtoms) {
      if (!shouldIncludeAtom(sa.atomName, sa.element)) {
        continue;
      }

      const ta = tAtomByAtomName.get(sa.atomName);
      if (!ta) {
        // Missing atom in target structure
        continue;
      }

      // Determine weight
      let w = 1.0;
      if (weightScheme === 'mass') {
        w = Math.sqrt(sa.mass * ta.mass);
      } else if (weightScheme === 'occupancy') {
        w = Math.min(sa.occupancy, ta.occupancy);
      }

      pairedAtoms.push({
        sourceAtom: sa,
        targetAtom: ta,
        weight: w,
      });

      pairedCoordsSource.push(sa.coords);
      pairedCoordsTarget.push(ta.coords);
      weights.push(w);
    }
  }

  const totalSourceScopeAtoms = sourceAtoms.filter((a) => shouldIncludeAtom(a.atomName, a.element)).length;
  const totalTargetScopeAtoms = targetAtoms.filter((a) => shouldIncludeAtom(a.atomName, a.element)).length;

  return {
    correspondence: {
      pairedAtoms,
      pairedCoordsSource,
      pairedCoordsTarget,
      weights,
      unmatchedSourceCount: totalSourceScopeAtoms - pairedAtoms.length,
      unmatchedTargetCount: totalTargetScopeAtoms - pairedAtoms.length,
      atomScope,
      pairingMode,
    },
    sequenceAlignment: seqAlignResult,
  };
}
