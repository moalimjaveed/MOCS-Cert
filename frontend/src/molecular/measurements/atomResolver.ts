/**
 * Canonical Structural Atom Resolver & Disambiguation Engine
 * 
 * Epistemic Status: ESTABLISHED
 * 
 * Resolves measurement endpoints against the structural index with:
 * - Exact hierarchical identity: Structure -> Model -> Chain -> Residue -> Atom
 * - Contextual chain scoping to prevent cross-chain contamination
 * - Explicit ambiguity rejection for multi-chain assemblies when chain is unstated
 * - Support for both proteins (e.g. 4HHB) and nucleic acids (e.g. 1BNA DNA)
 */

import type {
  StructureHierarchyIndex,
  IndexedComponent,
  ValidatedAtom,
} from '../geometry/structuralIdentity';
import {
  parseCanonicalSelection,
  classifySelectionSafety,
} from '../geometry/structuralIdentity';
import type { MeasurementAtomRef } from './types';

export interface ResolveEndpointOptions {
  /** Preferred or contextual chain ID (e.g., from the first selected atom) */
  preferredChainId?: string;
  /** Spatial proximity reference to select closest match when multiple exist */
  referenceCoords?: [number, number, number];
  /** Reject ambiguous selections rather than guessing */
  strictChainScoping?: boolean;
}

export interface ResolvedEndpointResult {
  atom: MeasurementAtomRef | null;
  component: IndexedComponent | null;
  isAmbiguous: boolean;
  error?: string;
}

/**
 * Resolves a measurement atom endpoint from a selection query string
 * against a canonical StructureHierarchyIndex.
 */
export function resolveMeasurementEndpoint(
  index: StructureHierarchyIndex | null | undefined,
  query: string,
  options: ResolveEndpointOptions = {}
): ResolvedEndpointResult {
  if (!index) {
    return {
      atom: null,
      component: null,
      isAmbiguous: false,
      error: 'Structural index is unavailable or not yet loaded',
    };
  }

  const token = parseCanonicalSelection(query);
  if (!token.raw || token.raw.trim().length === 0) {
    return {
      atom: null,
      component: null,
      isAmbiguous: false,
      error: 'Empty selection query',
    };
  }

  // 1. If chain is explicitly stated, search strictly within that chain
  if (token.isExplicitChain && token.chainId) {
    const targetChainId = token.chainId.toUpperCase();
    const chainData = index.chains.get(targetChainId);
    if (!chainData) {
      return {
        atom: null,
        component: null,
        isAmbiguous: false,
        error: `Chain '${token.chainId}' not found in structure '${index.structureId}'`,
      };
    }

    const candidateComps: IndexedComponent[] = [];
    for (const comp of chainData.components.values()) {
      if (matchesComponentToken(comp, token)) {
        candidateComps.push(comp);
      }
    }

    if (candidateComps.length === 0) {
      return {
        atom: null,
        component: null,
        isAmbiguous: false,
        error: `No component matching '${query}' in chain '${token.chainId}'`,
      };
    }

    const comp = candidateComps[0];
    const atom = findAtomInComponent(comp, token.atomName);
    if (!atom) {
      return {
        atom: null,
        component: comp,
        isAmbiguous: false,
        error: `Atom '${token.atomName}' not found in component '${comp.canonicalLabel}'`,
      };
    }

    return {
      atom: toMeasurementAtomRef(index, comp, atom),
      component: comp,
      isAmbiguous: false,
    };
  }

  // 2. Chain is NOT explicitly stated in query (e.g. "HEM:142:FE" or "87:NE2")
  // Search across all components in the entire structure
  const matchingComps: IndexedComponent[] = [];
  for (const comp of index.allComponents) {
    if (matchesComponentToken(comp, token)) {
      matchingComps.push(comp);
    }
  }

  if (matchingComps.length === 0) {
    return {
      atom: null,
      component: null,
      isAmbiguous: false,
      error: `No component matching '${query}' found in structure '${index.structureId}'`,
    };
  }

  // If exactly one match across all chains, unambiguous
  if (matchingComps.length === 1) {
    const comp = matchingComps[0];
    const atom = findAtomInComponent(comp, token.atomName);
    if (!atom) {
      return {
        atom: null,
        component: comp,
        isAmbiguous: false,
        error: `Atom '${token.atomName}' not found in component '${comp.canonicalLabel}'`,
      };
    }
    return {
      atom: toMeasurementAtomRef(index, comp, atom),
      component: comp,
      isAmbiguous: false,
    };
  }

  // Multiple matching components exist across different chains (e.g. 4HHB tetramer with 4 HEMs)
  // Check contextual disambiguation
  if (options.preferredChainId) {
    const prefChain = options.preferredChainId.toUpperCase();
    const scopedComp = matchingComps.find((c) => c.id.chainId.toUpperCase() === prefChain);
    if (scopedComp) {
      const atom = findAtomInComponent(scopedComp, token.atomName);
      if (atom) {
        return {
          atom: toMeasurementAtomRef(index, scopedComp, atom),
          component: scopedComp,
          isAmbiguous: false,
        };
      }
    }
  }

  // If spatial reference coordinates provided, pick closest by distance
  if (options.referenceCoords) {
    let closestComp = matchingComps[0];
    let minD = Infinity;
    for (const c of matchingComps) {
      const a = findAtomInComponent(c, token.atomName);
      if (a) {
        const dx = a.coordinates[0] - options.referenceCoords[0];
        const dy = a.coordinates[1] - options.referenceCoords[1];
        const dz = a.coordinates[2] - options.referenceCoords[2];
        const d = dx * dx + dy * dy + dz * dz;
        if (d < minD) {
          minD = d;
          closestComp = c;
        }
      }
    }
    const atom = findAtomInComponent(closestComp, token.atomName);
    if (atom) {
      return {
        atom: toMeasurementAtomRef(index, closestComp, atom),
        component: closestComp,
        isAmbiguous: false,
      };
    }
  }

  // If strict chain scoping is enforced, reject ambiguous query
  if (options.strictChainScoping) {
    const matchingChains = Array.from(new Set(matchingComps.map((c) => c.id.chainId))).join(', ');
    return {
      atom: null,
      component: null,
      isAmbiguous: true,
      error: `Ambiguous selection '${query}' matches multiple chains: [${matchingChains}]. Explicit chain ID required.`,
    };
  }

  // Default fallback when not strict: take first match but flag as potentially ambiguous
  const fallbackComp = matchingComps[0];
  const fallbackAtom = findAtomInComponent(fallbackComp, token.atomName);
  return {
    atom: fallbackAtom ? toMeasurementAtomRef(index, fallbackComp, fallbackAtom) : null,
    component: fallbackComp,
    isAmbiguous: true,
    error: undefined,
  };
}

function matchesComponentToken(comp: IndexedComponent, token: ReturnType<typeof parseCanonicalSelection>): boolean {
  if (token.resSeq !== undefined && comp.id.residueNumber !== token.resSeq) {
    return false;
  }
  if (token.resName && comp.id.residueName.toUpperCase() !== token.resName.toUpperCase()) {
    return false;
  }
  if (token.insCode && comp.id.insertionCode?.toUpperCase() !== token.insCode.toUpperCase()) {
    return false;
  }
  return true;
}

function findAtomInComponent(comp: IndexedComponent, atomName?: string): ValidatedAtom | null {
  if (!atomName) {
    return comp.atoms[0] || null;
  }
  const target = atomName.toUpperCase();
  const matched = comp.atoms.find((a) => a.atomName.toUpperCase() === target);
  return matched || null;
}

function toMeasurementAtomRef(
  index: StructureHierarchyIndex,
  comp: IndexedComponent,
  atom: ValidatedAtom
): MeasurementAtomRef {
  const chain = comp.id.chainId;
  const seq = comp.id.residueNumber;
  const compName = comp.id.residueName;
  const atomName = atom.atomName;
  const label = `${chain}:${compName}:${seq}:${atomName}`;

  return {
    label,
    coords: [atom.coordinates[0], atom.coordinates[1], atom.coordinates[2]],
    structureId: index.structureId,
    modelId: index.modelId,
    chainId: chain,
    resName: compName,
    resSeq: seq,
    atomName,
    element: atom.element,
    altLoc: atom.altLoc,
  };
}
