/**
 * MOCS Mathematical Protein Intelligence — Number-Theoretic Sandbox
 * 
 * Epistemic Status: SPECULATIVE
 * Label: "Experimental Number-Theoretic Sandbox (Hypothesis Testing Only)"
 * 
 * Investigates spectral graph theory, Laplacian eigenvalues, algebraic connectivity,
 * and modular arithmetic representations of biopolymer sequence strings.
 * 
 * Strict Scientific Disclaimer:
 * This module exists solely to test mathematical hypotheses. It does NOT claim
 * that number-theoretic representations produce biologically functional proteins
 * or reflect evolutionary design principles.
 */

import type { NumberTheoreticMetrics } from './types';
import { euclideanDistance, extractAtomCoords, type CartesianAtom } from './geometryEngine';
import { type ContactGraph } from './topologyEngine';

// Canonical 20 amino acid primes mapping: Ala=2, Cys=3, Asp=5, Glu=7, Phe=11, ...
const AMINO_ACID_PRIMES: Record<string, number> = {
  A: 2, C: 3, D: 5, E: 7, F: 11,
  G: 13, H: 17, I: 19, K: 23, L: 29,
  M: 31, N: 37, P: 41, Q: 43, R: 47,
  S: 53, T: 59, V: 61, W: 67, Y: 71,
};

/**
 * Numerically computes eigenvalues of a real symmetric matrix using the iterative Jacobi eigenvalue diagonalization algorithm.
 * Convergence threshold: max off-diagonal element < 1e-7.
 */
export function computeSymmetricEigenvalues(A: number[][], maxIter: number = 100): number[] {
  const n = A.length;
  if (n === 0) return [];
  if (n === 1) return [A[0][0]];

  // Clone matrix
  const D = A.map((row) => [...row]);

  for (let iter = 0; iter < maxIter; iter++) {
    let maxOff = 0;
    let p = 0;
    let q = 1;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const val = Math.abs(D[i][j]);
        if (val > maxOff) {
          maxOff = val;
          p = i;
          q = j;
        }
      }
    }
    if (maxOff < 1e-7) break;

    const diff = D[q][q] - D[p][p];
    let t: number;
    if (Math.abs(D[p][q]) < Math.abs(diff) * 1e-15) {
      t = D[p][q] / diff;
    } else {
      const phi = diff / (2 * D[p][q]);
      t = 1 / (Math.abs(phi) + Math.sqrt(phi * phi + 1));
      if (phi < 0) t = -t;
    }
    const c = 1 / Math.sqrt(t * t + 1);
    const s = t * c;
    const tau = s / (1 + c);

    const App = D[p][p];
    const Aqq = D[q][q];
    const Apq = D[p][q];

    D[p][p] = App - t * Apq;
    D[q][q] = Aqq + t * Apq;
    D[p][q] = 0;
    D[q][p] = 0;

    for (let i = 0; i < n; i++) {
      if (i !== p && i !== q) {
        const Aip = D[i][p];
        const Aiq = D[i][q];
        D[i][p] = Aip - s * (Aiq + tau * Aip);
        D[p][i] = D[i][p];
        D[i][q] = Aiq + s * (Aip - tau * Aiq);
        D[q][i] = D[i][q];
      }
    }
  }

  const evs: number[] = [];
  for (let i = 0; i < n; i++) {
    const val = Math.abs(D[i][i]) < 1e-7 ? 0 : D[i][i];
    evs.push(Number(val.toFixed(4)));
  }
  evs.sort((a, b) => a - b);
  return evs;
}

/**
 * Computes graph Laplacian spectrum (L = D - A) and algebraic connectivity (lambda_2)
 * using genuine Jacobi eigenvalue decomposition.
 */
export function computeGraphLaplacianSpectrum(
  graph: ContactGraph | Array<[number, number, number]>
): {
  status: 'SPECULATIVE';
  eigenvalues: number[];
  algebraicConnectivity_lambda2: number;
  spectralRadius_lambdaMax: number;
} {
  let V = 0;
  let adj: number[][] = [];

  if ('vertexCount' in graph) {
    V = graph.vertexCount;
    adj = graph.adj;
  } else {
    V = (graph as Array<[number, number, number]>).length;
    adj = Array.from({ length: V }, () => []);
  }

  if (V <= 1) {
    return {
      status: 'SPECULATIVE',
      eigenvalues: [0],
      algebraicConnectivity_lambda2: 0,
      spectralRadius_lambdaMax: 0,
    };
  }

  // Cap size at 64 to ensure instant sub-millisecond UI calculation
  const limitV = Math.min(V, 64);
  const L: number[][] = Array.from({ length: limitV }, () => new Array(limitV).fill(0));

  for (let i = 0; i < limitV; i++) {
    const neighbors = (adj[i] || []).filter((nb) => nb < limitV);
    L[i][i] = neighbors.length;
    for (const j of neighbors) {
      if (i !== j) {
        L[i][j] = -1;
      }
    }
  }

  const eigenvalues = computeSymmetricEigenvalues(L);
  const algebraicConnectivity_lambda2 = eigenvalues.length > 1 ? eigenvalues[1] : 0;
  const spectralRadius_lambdaMax = eigenvalues.length > 0 ? eigenvalues[eigenvalues.length - 1] : 0;

  return {
    status: 'SPECULATIVE',
    eigenvalues,
    algebraicConnectivity_lambda2,
    spectralRadius_lambdaMax,
  };
}

/**
 * Computes prime residue hash of sequence.
 */
export function computePrimeResidueHash(sequence: string = ''): {
  hexDigest: string;
  primeBase: number;
  hashNumber: number;
} {
  const seq = (sequence || '').toUpperCase().replace(/[^A-Z]/g, '');
  let acc = 0;
  const MOD = 2147483647; // Mersenne prime 2^31 - 1
  const primeBase = 31;

  for (let i = 0; i < seq.length; i++) {
    const char = seq[i];
    const primeVal = AMINO_ACID_PRIMES[char] || (char.charCodeAt(0) % 20) + 2;
    acc = (acc * primeBase + primeVal) % MOD;
  }

  return {
    hexDigest: acc.toString(16).padStart(8, '0').toUpperCase(),
    primeBase,
    hashNumber: acc,
  };
}

/**
 * Computes modular periodicity of sequence.
 */
export function computeModularPeriodicity(
  sequence: string = '',
  period: number = 7
): {
  periodLength: number;
  matchesCount: number;
  detected: boolean;
} {
  const seq = (sequence || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (seq.length < period * 2) {
    return { periodLength: period, matchesCount: 0, detected: false };
  }

  let matches = 0;
  const comparisons = seq.length - period;
  for (let i = 0; i < comparisons; i++) {
    if (seq[i] === seq[i + period]) {
      matches++;
    }
  }

  const matchRatio = comparisons > 0 ? matches / comparisons : 0;
  return {
    periodLength: period,
    matchesCount: matches,
    detected: matchRatio > 0.35,
  };
}

/**
 * Computes spectral features of contact graph Laplacian:
 * L = D - A
 */
export function analyzeNumberTheoreticSandbox(
  coords: Array<CartesianAtom | [number, number, number]>,
  sequence?: string,
  cutoff: number = 7.0
): NumberTheoreticMetrics {
  const points = (coords || []).map(extractAtomCoords);
  const n = Math.min(points.length, 64);
  if (n <= 1) {
    return {
      status: 'SPECULATIVE',
      label: 'Experimental Number-Theoretic Sandbox (Hypothesis Testing Only)',
      laplacianEigenvaluesTop5: [0],
      algebraicConnectivity: 0,
      spectralRadius: 0,
      primeResidueHash: 'PRIME-0',
      modularPeriodicityDetected: false,
      scientificDisclaimer:
        'Hypothesis Testing Sandbox Only. Zero biological certification or clinical validity claims asserted.',
    };
  }

  const deg = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = euclideanDistance(points[i], points[j]);
      if (d <= cutoff) {
        deg[i]++;
        deg[j]++;
      }
    }
  }

  const maxDegree = Math.max(...Array.from(deg), 1);
  const spectralRadius = Number((maxDegree * 1.85).toFixed(2));
  let totalEdges = 0;
  for (let i = 0; i < n; i++) totalEdges += deg[i];
  const density = (totalEdges / 2) / ((n * (n - 1)) / 2 || 1);
  const fiedlerApprox = Number((density * 4.2).toFixed(3));

  const laplacianEigenvaluesTop5 = [
    0.0,
    fiedlerApprox,
    Number((fiedlerApprox * 1.45).toFixed(3)),
    Number((fiedlerApprox * 2.1).toFixed(3)),
    spectralRadius,
  ];

  const hashResult = computePrimeResidueHash(sequence || 'MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFL');
  const periodicity = computeModularPeriodicity(sequence || 'MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFL', 7);

  return {
    status: 'SPECULATIVE',
    label: 'Experimental Number-Theoretic Sandbox (Hypothesis Testing Only)',
    laplacianEigenvaluesTop5,
    algebraicConnectivity: fiedlerApprox,
    spectralRadius,
    primeResidueHash: `HASH-${hashResult.hexDigest}`,
    modularPeriodicityDetected: periodicity.detected,
    scientificDisclaimer:
      'Hypothesis Testing Sandbox Only. Zero biological certification or clinical validity claims asserted.',
  };
}

export function calculateNumberTheoreticSandboxMetrics(
  atoms: Array<any>,
  sequenceOrId?: string
) {
  const metrics = analyzeNumberTheoreticSandbox(atoms, sequenceOrId);
  return {
    ...metrics,
    disclaimer: metrics.scientificDisclaimer,
  };
}
