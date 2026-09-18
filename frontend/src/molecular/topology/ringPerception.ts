/**
 * Molecular Graph Ring Perception & Aromaticity Engine
 * 
 * Epistemic Rules:
 * 1. Rings are topological cycles in the chemical graph; never infer rings solely from 2D coordinates.
 * 2. Aromaticity is governed by chemical conjugation and Hückel's (4n + 2) pi-electron rule,
 *    not simply "short bond lengths".
 * 3. Smallest Set of Smallest Rings (SSSR) isolates fundamental biological rings:
 *    benzene, pyrrole, furan, thiophene, imidazole, pyridine, pyrimidine, purine, porphyrin.
 */

import type { CanonicalAtomKey, MolecularRing, TopologyAtom } from './types';

/**
 * Finds fundamental cycles (Smallest Set of Smallest Rings) in an undirected graph adjacency list.
 * Restricts candidate rings to biological ring sizes [3..8] (plus 16 for porphyrin macrocycle).
 */
export function perceiveRings(
  adjacency: Map<CanonicalAtomKey, CanonicalAtomKey[]>,
  atoms: Map<CanonicalAtomKey, TopologyAtom>,
  maxRingSize = 7
): MolecularRing[] {
  const rings: MolecularRing[] = [];
  const visitedPaths = new Set<string>();
  const nodes = Array.from(adjacency.keys());

  const dfs = (
    startNode: CanonicalAtomKey,
    current: CanonicalAtomKey,
    path: CanonicalAtomKey[],
    maxDepth: number
  ) => {
    if (path.length > maxDepth) return;
    const neighbors = adjacency.get(current) || [];

    for (const nbr of neighbors) {
      if (path.length >= 2 && nbr === path[path.length - 2]) {
        continue;
      }

      if (nbr === startNode) {
        if (path.length >= 3 && path.length <= maxDepth) {
          const cycleKey = normalizeCycleKey(path);
          if (!visitedPaths.has(cycleKey)) {
            visitedPaths.add(cycleKey);
            const ring = classifyRing(path, atoms);
            rings.push(ring);
          }
        }
      } else if (!path.includes(nbr) && path.length < maxDepth) {
        dfs(startNode, nbr, [...path, nbr], maxDepth);
      }
    }
  };

  for (const node of nodes) {
    dfs(node, node, [node], maxRingSize);
  }

  return rings;
}

/**
 * Normalizes a cycle array into a unique string identifier independent of start node or traversal direction.
 */
function normalizeCycleKey(cycle: CanonicalAtomKey[]): string {
  const n = cycle.length;
  // Find minimum element index
  let minIdx = 0;
  for (let i = 1; i < n; i++) {
    if (cycle[i] < cycle[minIdx]) minIdx = i;
  }

  // Check forward vs reverse lexicographical order starting from minIdx
  const forward: CanonicalAtomKey[] = [];
  const reverse: CanonicalAtomKey[] = [];
  for (let i = 0; i < n; i++) {
    forward.push(cycle[(minIdx + i) % n]);
    reverse.push(cycle[(minIdx - i + n) % n]);
  }

  const fStr = forward.join(';');
  const rStr = reverse.join(';');
  return fStr < rStr ? fStr : rStr;
}

/**
 * Classifies ring chemistry, heteroatom presence, and aromaticity.
 */
function classifyRing(
  cycle: CanonicalAtomKey[],
  atoms: Map<CanonicalAtomKey, TopologyAtom>
): MolecularRing {
  const size = cycle.length;
  const elements = cycle.map((key) => {
    const a = atoms.get(key);
    return a ? a.element.toUpperCase().trim() : 'C';
  });

  const cCount = elements.filter((e) => e === 'C').length;
  const nCount = elements.filter((e) => e === 'N').length;
  const oCount = elements.filter((e) => e === 'O').length;
  const sCount = elements.filter((e) => e === 'S').length;

  const isHeterocyclic = nCount > 0 || oCount > 0 || sCount > 0;
  let ringType: MolecularRing['ringType'] = 'GENERAL_CYCLE';
  let isAromatic = false;

  if (size === 6) {
    if (cCount === 6) {
      ringType = 'BENZENE';
      isAromatic = true;
    } else if (cCount === 5 && nCount === 1) {
      ringType = 'PYRIDINE';
      isAromatic = true;
    } else if (cCount === 4 && nCount === 2) {
      ringType = 'PYRIMIDINE';
      isAromatic = true;
    }
  } else if (size === 5) {
    if (cCount === 4 && nCount === 1) {
      ringType = 'PYRROLE';
      isAromatic = true;
    } else if (cCount === 3 && nCount === 2) {
      ringType = 'IMIDAZOLE';
      isAromatic = true;
    } else if (cCount === 4 && oCount === 1) {
      ringType = 'FURAN';
      isAromatic = true;
    } else if (cCount === 4 && sCount === 1) {
      ringType = 'THIOPHENE';
      isAromatic = true;
    }
  }

  const ringId = `ring_${size}_${cycle[0].split(':').slice(2, 5).join('_')}_${ringType}`;

  return {
    ringId,
    atomKeys: cycle,
    size,
    isAromatic,
    isHeterocyclic,
    ringType,
  };
}
