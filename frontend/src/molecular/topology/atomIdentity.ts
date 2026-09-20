/**
 * Canonical Atom Identity & Edge Key Engine
 * 
 * Epistemic Rules:
 * 1. Never identify atoms solely by array index, Three.js object ID, DOM ID, or rendered order.
 * 2. An atom identity must remain invariant across file reloads, representation changes, and trajectory playback.
 * 3. Bond keys must be symmetric and order-independent (A <-> B === B <-> A).
 */

import type { CanonicalAtomKey, CanonicalBondKey } from './types';

export interface AtomKeyParams {
  structureId: string;
  modelId?: string | number;
  chainId: string;
  residueName: string;
  residueNumber: number;
  insertionCode?: string | null;
  atomName: string;
  altLoc?: string | null;
}

/**
 * Builds a deterministic, globally unique canonical atom key.
 * Format: `${structureId}:${modelId}:${chainId}:${residueName}:${residueNumber}${insCode ? ':' + insCode : ''}:${atomName}${altLoc ? ':' + altLoc : ''}`
 */
export function buildCanonicalAtomKey(params: AtomKeyParams): CanonicalAtomKey {
  const struct = (params.structureId || '').toUpperCase().trim();
  const model = String(params.modelId ?? 1);
  const chain = (params.chainId || 'A').toUpperCase().trim();
  const resName = (params.residueName || 'UNK').toUpperCase().trim();
  const resNum = Number(params.residueNumber);
  const ins = params.insertionCode ? `:${params.insertionCode.trim().toUpperCase()}` : '';
  const atom = (params.atomName || '').toUpperCase().trim();
  const alt = params.altLoc ? `:${params.altLoc.trim().toUpperCase()}` : '';

  return `${struct}:${model}:${chain}:${resName}:${resNum}${ins}:${atom}${alt}`;
}

/**
 * Deconstructs a canonical atom key into its structural components.
 */
export function parseCanonicalAtomKey(key: CanonicalAtomKey): AtomKeyParams {
  const parts = key.split(':');
  if (parts.length < 6) {
    throw new Error(`Malformed canonical atom key: ${key}`);
  }

  const structureId = parts[0];
  const modelId = parts[1];
  const chainId = parts[2];
  const residueName = parts[3];
  const residueNumber = parseInt(parts[4], 10);

  let insertionCode: string | null = null;
  let atomName = '';
  let altLoc: string | null = null;

  if (parts.length === 6) {
    // Standard: struct:model:chain:resName:resNum:atomName
    atomName = parts[5];
  } else if (parts.length >= 8) {
    // struct:model:chain:resName:resNum:insCode:atomName:altLoc
    insertionCode = parts[5] || null;
    atomName = parts[6];
    altLoc = parts[7] || null;
  } else if (parts.length === 7) {
    // Ambiguity resolution between:
    // A: struct:model:chain:resName:resNum:insCode:atomName (altLoc omitted)
    // B: struct:model:chain:resName:resNum:atomName:altLoc (insCode omitted)
    if (parts[6].length > 1) {
      // altLoc in PDB/mmCIF is strictly 1 character; parts[6] length > 1 must be atomName
      insertionCode = parts[5] || null;
      atomName = parts[6];
      altLoc = null;
    } else if (parts[5].length > 1) {
      // insCode in PDB is strictly 1 character; parts[5] length > 1 must be atomName
      insertionCode = null;
      atomName = parts[5];
      altLoc = parts[6] || null;
    } else {
      // Both parts[5] and parts[6] are single characters
      const commonElements = ['C', 'N', 'O', 'P', 'S', 'H'];
      if (commonElements.includes(parts[6].toUpperCase()) && !commonElements.includes(parts[5].toUpperCase())) {
        insertionCode = parts[5] || null;
        atomName = parts[6];
        altLoc = null;
      } else {
        insertionCode = null;
        atomName = parts[5];
        altLoc = parts[6] || null;
      }
    }
  }

  return {
    structureId,
    modelId,
    chainId,
    residueName,
    residueNumber,
    insertionCode,
    atomName,
    altLoc,
  };
}

/**
 * Builds an order-independent canonical bond key for an undirected edge.
 * Enforces lexicographical ordering: smaller key first.
 */
export function buildCanonicalBondKey(
  atomAKey: CanonicalAtomKey,
  atomBKey: CanonicalAtomKey
): CanonicalBondKey {
  if (atomAKey === atomBKey) {
    throw new Error(`Self-loop detected: Atom ${atomAKey} cannot form a bond with itself.`);
  }

  return atomAKey < atomBKey
    ? `${atomAKey} <-> ${atomBKey}`
    : `${atomBKey} <-> ${atomAKey}`;
}

/**
 * Verifies whether two atom keys reside in the exact same model.
 */
export function areAtomsInSameModel(keyA: CanonicalAtomKey, keyB: CanonicalAtomKey): boolean {
  const pA = parseCanonicalAtomKey(keyA);
  const pB = parseCanonicalAtomKey(keyB);
  return pA.structureId === pB.structureId && String(pA.modelId) === String(pB.modelId);
}

/**
 * Verifies whether two atom keys reside in the exact same chain.
 */
export function areAtomsInSameChain(keyA: CanonicalAtomKey, keyB: CanonicalAtomKey): boolean {
  const pA = parseCanonicalAtomKey(keyA);
  const pB = parseCanonicalAtomKey(keyB);
  return areAtomsInSameModel(keyA, keyB) && pA.chainId === pB.chainId;
}

/**
 * Verifies whether two atom keys are compatible across alternate conformations.
 * An atom with altLoc 'A' must NEVER bond to an atom with altLoc 'B'.
 */
export function areAtomsAltLocCompatible(keyA: CanonicalAtomKey, keyB: CanonicalAtomKey): boolean {
  const pA = parseCanonicalAtomKey(keyA);
  const pB = parseCanonicalAtomKey(keyB);

  // If both have explicit alternate locations, they must match
  if (pA.altLoc && pB.altLoc) {
    return pA.altLoc === pB.altLoc;
  }
  // If one or both are unassigned, they are compatible with the common backbone/environment
  return true;
}
