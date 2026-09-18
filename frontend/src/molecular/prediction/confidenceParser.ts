/**
 * Protein Prediction Confidence Parser & Auditor
 * 
 * Implements strict forensic validation of:
 * - per-residue pLDDT confidence (4-band classification)
 * - PAE (Predicted Aligned Error) matrix parsing & asymmetric verification
 * - Disordered region detection without coordinate tampering
 * - Multimer complex ranking & interface confidence
 */

import type {
  PlddtBandKey,
  PlddtBand,
  PlddtResidueScore,
  PaeMatrix,
  InterChainPaeSummary,
  PredictionConfidenceSummary,
} from './types';

export const PLDDT_BANDS: Record<PlddtBandKey, PlddtBand> = {
  very_high: {
    key: 'very_high',
    label: 'Very high (pLDDT > 90)',
    minScore: 90,
    maxScore: 100,
    hexColor: '#1e40af', // Deep Cobalt
    interpretation:
      'High accuracy for both backbone and side-chain rotamers; suitable for atomic-level detail inspection.',
    backboneReliability: 'high',
    sidechainReliability: 'high',
  },
  confident: {
    key: 'confident',
    label: 'Confident (70 <= pLDDT <= 90)',
    minScore: 70,
    maxScore: 90,
    hexColor: '#0284c7', // Cyan / Light Blue
    interpretation:
      'Well-modeled backbone topology; secondary structures reliably identified; side-chains may vary.',
    backboneReliability: 'good',
    sidechainReliability: 'variable',
  },
  low: {
    key: 'low',
    label: 'Low (50 <= pLDDT < 70)',
    minScore: 50,
    maxScore: 70,
    hexColor: '#d97706', // Amber
    interpretation:
      'Low backbone confidence; topology should be treated with skepticism; do not infer fine interactions.',
    backboneReliability: 'uncertain',
    sidechainReliability: 'unreliable',
  },
  very_low: {
    key: 'very_low',
    label: 'Very low (pLDDT < 50)',
    minScore: 0,
    maxScore: 50,
    hexColor: '#ea580c', // Orange / Rose
    interpretation:
      'Very low confidence; unstructured or ribbon-like coordinates; frequently indicates intrinsic disorder.',
    backboneReliability: 'unreliable_disordered',
    sidechainReliability: 'unreliable',
  },
};

const THREE_TO_ONE: Record<string, string> = {
  ALA: 'A', CYS: 'C', ASP: 'D', GLU: 'E', PHE: 'F',
  GLY: 'G', HIS: 'H', ILE: 'I', LYS: 'K', LEU: 'L',
  MET: 'M', ASN: 'N', PRO: 'P', GLN: 'Q', ARG: 'R',
  SER: 'S', THR: 'T', VAL: 'V', TRP: 'W', TYR: 'Y',
  // Common non-standard / protonation forms mapped to canonical
  MSE: 'M', SEC: 'U', PYL: 'O',
};

/**
 * Classifies a pLDDT score into one of 4 canonical AlphaFold confidence bands.
 */
export function classifyPlddt(score: number): PlddtBandKey {
  if (score > 90) return 'very_high';
  if (score >= 70) return 'confident';
  if (score >= 50) return 'low';
  return 'very_low';
}

/**
 * Retrieves the descriptive band object for a given pLDDT score.
 */
export function getPlddtBand(score: number): PlddtBand {
  const key = classifyPlddt(score);
  return PLDDT_BANDS[key];
}

/**
 * Extracts per-residue pLDDT scores from PDB text.
 * Inspects B-factor column (cols 61-66) of CA atoms.
 * Validates range, handles fractional [0, 1] normalization,
 * and identifies disordered regions without mutating atom coordinates.
 */
export function extractPlddtFromPdb(pdbText: string): PlddtResidueScore[] {
  if (!pdbText || typeof pdbText !== 'string') {
    throw new Error('PDB text must be a non-empty string.');
  }

  const lines = pdbText.split('\n');
  const rawScores: Array<{
    resSeq: number;
    insCode?: string;
    resName: string;
    chainId: string;
    bFactor: number;
  }> = [];

  const seenResidues = new Set<string>();

  for (const line of lines) {
    if (!line.startsWith('ATOM  ') && !line.startsWith('HETATM')) continue;

    const atomName = line.slice(12, 16).trim();
    // Prioritize C-alpha (CA) as the standard residue representative
    if (atomName !== 'CA') continue;

    const resName = line.slice(17, 20).trim().toUpperCase();
    const chainId = line.slice(21, 22).trim() || 'A';
    const resSeqStr = line.slice(22, 26).trim();
    const resSeq = parseInt(resSeqStr, 10);
    const insCode = line.length > 26 ? line.slice(26, 27).trim() : '';
    const bFactorStr = line.slice(60, 66).trim();
    const bFactor = parseFloat(bFactorStr);

    if (isNaN(resSeq)) {
      throw new Error(`Invalid residue sequence number in PDB line: "${line}"`);
    }
    if (isNaN(bFactor)) {
      throw new Error(`Invalid B-factor / pLDDT value in PDB line: "${line}"`);
    }

    const resKey = `${chainId}:${resSeq}${insCode ? ':' + insCode : ''}`;
    if (!seenResidues.has(resKey)) {
      seenResidues.add(resKey);
      rawScores.push({ resSeq, insCode: insCode || undefined, resName, chainId, bFactor });
    }
  }

  // Fallback: If no CA atoms were found (e.g. non-standard backbone or coarse model),
  // parse the first atom of each residue
  if (rawScores.length === 0) {
    for (const line of lines) {
      if (!line.startsWith('ATOM  ') && !line.startsWith('HETATM')) continue;
      const resName = line.slice(17, 20).trim().toUpperCase();
      const chainId = line.slice(21, 22).trim() || 'A';
      const resSeqStr = line.slice(22, 26).trim();
      const resSeq = parseInt(resSeqStr, 10);
      const insCode = line.length > 26 ? line.slice(26, 27).trim() : '';
      const bFactorStr = line.slice(60, 66).trim();
      const bFactor = parseFloat(bFactorStr);

      if (!isNaN(resSeq) && !isNaN(bFactor)) {
        const resKey = `${chainId}:${resSeq}${insCode ? ':' + insCode : ''}`;
        if (!seenResidues.has(resKey)) {
          seenResidues.add(resKey);
          rawScores.push({ resSeq, insCode: insCode || undefined, resName, chainId, bFactor });
        }
      }
    }
  }

  if (rawScores.length === 0) {
    throw new Error('No valid residue records with B-factors found in PDB structure.');
  }

  // Check if scores are formatted on [0, 1] scale (fractional pLDDT)
  const allFractional = rawScores.length > 0 && rawScores.every((r) => r.bFactor >= 0 && r.bFactor <= 1.0);
  const scaleMultiplier = allFractional ? 100.0 : 1.0;

  return rawScores.map((r, idx) => {
    let score = r.bFactor * scaleMultiplier;
    // Clamp to [0, 100]
    score = Math.max(0, Math.min(100, Number(score.toFixed(2))));
    const band = classifyPlddt(score);
    const singleLetterCode = THREE_TO_ONE[r.resName] || 'X';

    return {
      residueIndex: idx,
      residueNumber: r.resSeq,
      insertionCode: r.insCode,
      residueName: r.resName,
      singleLetterCode,
      chainId: r.chainId,
      score,
      band,
      isDisorderedHypothesis: score < 50,
    };
  });
}

/**
 * Calculates comprehensive statistical summary of prediction confidence.
 */
export function calculateConfidenceSummary(
  scores: PlddtResidueScore[],
  ptmScore?: number,
  iptmScore?: number,
  paeMatrix?: PaeMatrix
): PredictionConfidenceSummary {
  if (!scores || scores.length === 0) {
    throw new Error('Cannot calculate confidence summary on empty residue scores.');
  }

  const values = scores.map((s) => s.score);
  const sum = values.reduce((a, b) => a + b, 0);
  const averagePlddt = Number((sum / values.length).toFixed(2));

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianPlddt =
    sorted.length % 2 === 0
      ? Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2))
      : Number(sorted[mid].toFixed(2));

  const minPlddt = sorted[0];
  const maxPlddt = sorted[sorted.length - 1];

  const bandCounts: Record<PlddtBandKey, number> = {
    very_high: 0,
    confident: 0,
    low: 0,
    very_low: 0,
  };

  let disorderedCount = 0;
  for (const s of scores) {
    bandCounts[s.band]++;
    if (s.isDisorderedHypothesis) {
      disorderedCount++;
    }
  }

  const total = scores.length;
  const bandFractions: Record<PlddtBandKey, number> = {
    very_high: Number((bandCounts.very_high / total).toFixed(4)),
    confident: Number((bandCounts.confident / total).toFixed(4)),
    low: Number((bandCounts.low / total).toFixed(4)),
    very_low: Number((bandCounts.very_low / total).toFixed(4)),
  };

  const disorderedFraction = Number((disorderedCount / total).toFixed(4));

  // Compute modelScore for multimer complexes: 0.8 * ipTM + 0.2 * pTM
  let modelScore: number | undefined;
  if (typeof iptmScore === 'number' && typeof ptmScore === 'number') {
    modelScore = Number((0.8 * iptmScore + 0.2 * ptmScore).toFixed(3));
  } else if (typeof ptmScore === 'number') {
    modelScore = Number(ptmScore.toFixed(3));
  }

  return {
    averagePlddt,
    medianPlddt,
    minPlddt,
    maxPlddt,
    bandCounts,
    bandFractions,
    disorderedResidueCount: disorderedCount,
    disorderedResidueFraction: disorderedFraction,
    ptmScore,
    iptmScore,
    modelScore,
    paeMatrixSummary: paeMatrix
      ? {
          meanError: paeMatrix.meanError,
          maxError: paeMatrix.maxObservedError,
          isAsymmetric: paeMatrix.isAsymmetric,
        }
      : undefined,
  };
}

/**
 * Validates a Predicted Aligned Error (PAE) matrix.
 * Enforces:
 * - Square dimensions N x N
 * - Values >= 0
 * - Calculation of asymmetry (PAE(i, j) != PAE(j, i))
 * - Error statistics
 */
export function validatePaeMatrix(
  matrix: number[][],
  expectedResidueCount?: number,
  maxErrorCap = 31.75
): PaeMatrix {
  if (!matrix || !Array.isArray(matrix) || matrix.length === 0) {
    throw new Error('PAE matrix must be a non-empty 2D array.');
  }

  const n = matrix.length;
  for (let i = 0; i < n; i++) {
    if (!Array.isArray(matrix[i]) || matrix[i].length !== n) {
      throw new Error(
        `PAE matrix must be strictly square (N x N). Row ${i} has length ${matrix[i]?.length}, expected ${n}.`
      );
    }
  }

  if (typeof expectedResidueCount === 'number' && n !== expectedResidueCount) {
    throw new Error(
      `PAE matrix dimension (${n} x ${n}) does not match structure residue count (${expectedResidueCount}).`
    );
  }

  let isAsymmetric = false;
  let sum = 0;
  let minError = Infinity;
  let maxObservedError = -Infinity;
  const count = n * n;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const val = matrix[i][j];
      if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
        throw new Error(`Invalid PAE value at position [${i}][${j}]: ${val}`);
      }
      if (val < 0) {
        throw new Error(
          `Negative PAE value (${val} A) at [${i}][${j}]. Distance error cannot be negative.`
        );
      }

      sum += val;
      if (val < minError) minError = val;
      if (val > maxObservedError) maxObservedError = val;

      if (!isAsymmetric && Math.abs(matrix[i][j] - matrix[j][i]) > 0.05) {
        isAsymmetric = true;
      }
    }
  }

  const meanError = Number((sum / count).toFixed(2));
  const residueIndices = Array.from({ length: n }, (_, i) => i);

  return {
    dimensions: [n, n],
    residueIndices,
    maxErrorAngstrom: maxErrorCap,
    matrix,
    isAsymmetric,
    meanError,
    minError: Number(minError.toFixed(2)),
    maxObservedError: Number(maxObservedError.toFixed(2)),
  };
}

/**
 * Calculates inter-chain PAE between two chains/domains.
 * chainABounds: [startResidueIdx, endResidueIdx] inclusive
 * chainBBounds: [startResidueIdx, endResidueIdx] inclusive
 */
export function calculateInterChainPae(
  pae: PaeMatrix,
  chainABounds: [number, number],
  chainBBounds: [number, number],
  chainAName = 'A',
  chainBName = 'B'
): InterChainPaeSummary {
  const [startA, endA] = chainABounds;
  const [startB, endB] = chainBBounds;
  const [n] = pae.dimensions;

  if (startA < 0 || endA >= n || startB < 0 || endB >= n) {
    throw new Error('Chain boundaries exceed PAE matrix dimensions.');
  }

  let sum = 0;
  let count = 0;
  let minPae = Infinity;
  let maxPae = -Infinity;

  for (let i = startA; i <= endA; i++) {
    for (let j = startB; j <= endB; j++) {
      const val = pae.matrix[i][j];
      sum += val;
      count++;
      if (val < minPae) minPae = val;
      if (val > maxPae) maxPae = val;
    }
  }

  const meanPae = count > 0 ? Number((sum / count).toFixed(2)) : 0;
  const isWellPositioned = meanPae < 10.0;

  return {
    chainA: chainAName,
    chainB: chainBName,
    meanPae,
    minPae: count > 0 ? Number(minPae.toFixed(2)) : 0,
    maxPae: count > 0 ? Number(maxPae.toFixed(2)) : 0,
    isWellPositioned,
  };
}
