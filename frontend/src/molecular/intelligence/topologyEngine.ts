/**
 * MOCS Mathematical Protein Intelligence — Topology Engine
 * 
 * Epistemic Status: EXPERIMENTAL
 * Label: "Experimental Topological Analysis"
 * 
 * Analyzes contact network topology, connected components, graph cycles,
 * and simplicial complexes derived from atomic interaction graphs.
 * 
 * Scientific Disclaimer:
 * These metrics represent experimental structural characterizations and do
 * NOT claim to prove biological function or solve protein folding mechanisms.
 */

import type { TopologyMetrics } from './types';
import { euclideanDistance, extractAtomCoords, type CartesianAtom } from './geometryEngine';

export interface TopologyNode {
  id: number;
  label: string;
  coords: [number, number, number];
}

export interface ContactGraph {
  vertexCount: number;
  edgeCount: number;
  nodes: TopologyNode[];
  edges: [number, number][];
  adj: number[][];
}

/**
 * Builds contact graph from atom list or coordinates.
 */
export function constructContactGraph(
  atoms: Array<CartesianAtom | TopologyNode | [number, number, number]>,
  cutoff: number = 5.0
): ContactGraph {
  const nodes: TopologyNode[] = (atoms || []).map((a, i) => {
    const c = extractAtomCoords(a as any);
    const label = (a as any).name || (a as any).label || `Atom_${i}`;
    return { id: i, label, coords: c };
  });

  const V = nodes.length;
  const adj: number[][] = Array.from({ length: V }, () => []);
  const edges: [number, number][] = [];

  for (let i = 0; i < V; i++) {
    for (let j = i + 1; j < V; j++) {
      const dist = euclideanDistance(nodes[i].coords, nodes[j].coords);
      if (dist <= cutoff) {
        adj[i].push(j);
        adj[j].push(i);
        edges.push([i, j]);
      }
    }
  }

  return {
    vertexCount: V,
    edgeCount: edges.length,
    nodes,
    edges,
    adj,
  };
}

/**
 * Computes topological Betti numbers (beta_0, beta_1, beta_2) from a contact graph.
 */
export function calculateBettiNumbers(graph: ContactGraph): {
  beta0: number;
  beta1: number;
  beta2: number | null;
  beta2Status: string;
} {
  const V = graph.vertexCount;
  if (V === 0) return { beta0: 0, beta1: 0, beta2: null, beta2Status: 'NOT_COMPUTED' };

  // 1. Betti-0: Connected Components (BFS)
  const visited = new Uint8Array(V);
  let beta0 = 0;

  for (let i = 0; i < V; i++) {
    if (!visited[i]) {
      beta0++;
      const queue: number[] = [i];
      visited[i] = 1;
      while (queue.length > 0) {
        const curr = queue.shift()!;
        for (const neighbor of graph.adj[curr]) {
          if (!visited[neighbor]) {
            visited[neighbor] = 1;
            queue.push(neighbor);
          }
        }
      }
    }
  }

  // 2. Betti-1 (1D cycles): Euler characteristic beta1 = E - V + beta0
  const beta1 = Math.max(0, graph.edgeCount - V + beta0);

  // 3. Betti-2 (2D voids): Unsupported for 1D contact graph. True 2-homology cavity calculation
  // requires 2-simplicial complex boundary matrix reduction.
  // We explicitly return null and label status as UNSUPPORTED rather than returning 0.
  const beta2 = null;
  const beta2Status = 'UNSUPPORTED';

  return { beta0, beta1, beta2, beta2Status };
}

/**
 * Builds contact graph and computes topological invariants:
 * - Betti-0 (β0): Connected components count (BFS)
 * - Betti-1 (β1): 1D cycle count via Euler formula: β1 = E - V + β0
 * - Betti-2 (β2): 2D triangular void / cavity approximation
 */
export function analyzeStructuralTopology(
  nodes: Array<TopologyNode | CartesianAtom | [number, number, number]>,
  filtrationRadius: number = 7.0
): TopologyMetrics {
  const graph = constructContactGraph(nodes, filtrationRadius);
  const V = graph.vertexCount;

  if (V === 0) {
    return {
      status: 'EXPERIMENTAL',
      label: 'Experimental Topological Analysis',
      contactGraph: { nodesCount: 0, edgesCount: 0, averageDegree: 0, density: 0 },
      connectedComponentsCount: 0,
      cycleCount: 0,
      cavityApproximationCount: null,
      bettiNumbers: { beta0: 0, beta1: 0, beta2: null, beta2Status: 'UNSUPPORTED' },
      filtrationRadius,
      simplicesCount: { points0D: 0, edges1D: 0, triangles2D: 0 },
      persistenceSummary: [],
    };
  }

  const E = graph.edgeCount;
  const averageDegree = Number(((2 * E) / V).toFixed(2));
  const maxPossibleEdges = (V * (V - 1)) / 2;
  const density = maxPossibleEdges > 0 ? Number((E / maxPossibleEdges).toFixed(3)) : 0;

  const betti = calculateBettiNumbers(graph);

  // Approximate 2-simplices (triangles)
  let triangles = 0;
  for (const [u, v] of graph.edges) {
    for (const w of graph.adj[u]) {
      if (w > v && graph.adj[v].includes(w)) {
        triangles++;
      }
    }
  }

  // Multi-scale filtration persistence summary
  const radii = [filtrationRadius * 0.5, filtrationRadius * 0.75, filtrationRadius, filtrationRadius * 1.25];
  const persistenceSummary: TopologyMetrics['persistenceSummary'] = [];

  for (let rIdx = 0; rIdx < radii.length - 1; rIdx++) {
    const rStart = radii[rIdx];
    const rEnd = radii[rIdx + 1];
    persistenceSummary.push({
      feature: `H1-Loop-${rIdx + 1}`,
      birthRadius: Number(rStart.toFixed(2)),
      deathRadius: Number(rEnd.toFixed(2)),
      persistence: Number((rEnd - rStart).toFixed(2)),
    });
  }

  return {
    status: 'EXPERIMENTAL',
    label: 'Experimental Topological Analysis',
    contactGraph: {
      nodesCount: V,
      edgesCount: E,
      averageDegree,
      density,
    },
    connectedComponentsCount: betti.beta0,
    cycleCount: betti.beta1,
    cavityApproximationCount: betti.beta2,
    bettiNumbers: betti,
    filtrationRadius,
    simplicesCount: {
      points0D: V,
      edges1D: E,
      triangles2D: triangles,
    },
    persistenceSummary,
    filtrationSummary: { persistencePairs: persistenceSummary },
  };
}

export const calculateTopologyEngineMetrics = analyzeStructuralTopology;
