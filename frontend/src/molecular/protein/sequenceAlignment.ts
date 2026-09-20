/**
 * MOCS-Cert Protein Structural Biology — Needleman-Wunsch Sequence Alignment Engine
 * 
 * Epistemic Status: ESTABLISHED
 * Algorithm: Needleman-Wunsch (1970) with BLOSUM62 Substitution Matrix
 */

import type { SequenceAlignmentResult, AlignedResiduePair } from './comparisonTypes';
import { ONE_TO_THREE_LETTER_MAP } from './classifier';

// Standard BLOSUM62 matrix for standard 20 amino acids
const AA_ORDER = 'ARNDCQEGHILKMFPSTWYV';
const BLOSUM62_DATA: number[][] = [
  // A   R   N   D   C   Q   E   G   H   I   L   K   M   F   P   S   T   W   Y   V
  [  4, -1, -2, -2,  0, -1, -1,  0, -2, -1, -1, -1, -1, -2, -1,  1,  0, -3, -2,  0], // A
  [ -1,  5,  0, -2, -3,  1,  0, -2,  0, -3, -2,  2, -1, -3, -2, -1, -1, -3, -2, -3], // R
  [ -2,  0,  6,  1, -3,  0,  0,  0,  1, -3, -3,  0, -2, -3, -2,  1,  0, -4, -2, -3], // N
  [ -2, -2,  1,  6, -3,  0,  2, -1, -1, -3, -4, -1, -3, -3, -1,  0, -1, -4, -3, -3], // D
  [  0, -3, -3, -3,  9, -3, -4, -3, -3, -1, -1, -3, -1, -2, -3, -1, -1, -2, -2, -1], // C
  [ -1,  1,  0,  0, -3,  5,  2, -2,  0, -3, -2,  1,  0, -3, -1,  0, -1, -2, -1, -2], // Q
  [ -1,  0,  0,  2, -4,  2,  5, -2,  0, -3, -3,  1, -2, -3, -1,  0, -1, -3, -2, -2], // E
  [  0, -2,  0, -1, -3, -2, -2,  6, -2, -4, -4, -2, -3, -3, -2,  0, -2, -2, -3, -3], // G
  [ -2,  0,  1, -1, -3,  0,  0, -2,  8, -3, -3, -1, -2, -1, -2, -1, -2, -2,  2, -3], // H
  [ -1, -3, -3, -3, -1, -3, -3, -4, -3,  4,  2, -3,  1,  0, -3, -2, -1, -3, -1,  3], // I
  [ -1, -2, -3, -4, -1, -2, -3, -4, -3,  2,  4, -2,  2,  0, -3, -2, -1, -2, -1,  1], // L
  [ -1,  2,  0, -1, -3,  1,  1, -2, -1, -3, -2,  5, -1, -3, -1,  0, -1, -3, -2, -2], // K
  [ -1, -1, -2, -3, -1,  0, -2, -3, -2,  1,  2, -1,  5,  0, -2, -1, -1, -1, -1,  1], // M
  [ -2, -3, -3, -3, -2, -3, -3, -3, -1,  0,  0, -3,  0,  6, -4, -2, -2,  1,  3, -1], // F
  [ -1, -2, -2, -1, -3, -1, -1, -2, -2, -3, -3, -1, -2, -4,  7, -1, -1, -4, -3, -2], // P
  [  1, -1,  1,  0, -1,  0,  0,  0, -1, -2, -2,  0, -1, -2, -1,  4,  1, -3, -2, -2], // S
  [  0, -1,  0, -1, -1, -1, -1, -2, -2, -1, -1, -1, -1, -2, -1,  1,  5, -2, -2,  0], // T
  [ -3, -3, -4, -4, -2, -2, -3, -2, -2, -3, -2, -3, -1,  1, -4, -3, -2, 11,  2, -3], // W
  [ -2, -2, -2, -3, -2, -1, -2, -3,  2, -1, -1, -2, -1,  3, -3, -2, -2,  2,  7, -1], // Y
  [  0, -3, -3, -3, -1, -2, -2, -3, -3,  3,  1, -2,  1, -1, -2, -2,  0, -3, -1,  4], // V
];

const AA_INDEX_MAP = new Map<string, number>();
for (let i = 0; i < AA_ORDER.length; i++) {
  AA_INDEX_MAP.set(AA_ORDER[i], i);
}

/**
 * Returns BLOSUM62 score for a pair of amino acids.
 */
export function getBlosum62Score(aa1: string, aa2: string): number {
  const c1 = aa1.toUpperCase();
  const c2 = aa2.toUpperCase();
  const i1 = AA_INDEX_MAP.get(c1);
  const i2 = AA_INDEX_MAP.get(c2);

  if (i1 !== undefined && i2 !== undefined) {
    return BLOSUM62_DATA[i1][i2];
  }
  // If identical unknown character, return neutral score 1, otherwise mismatch -1
  return c1 === c2 ? 1 : -1;
}

export interface SequenceInputItem {
  chainId: string;
  resSeq: number;
  insCode?: string;
  resName: string;
  char1: string;
  hasCoords?: boolean;
}

export interface AlignmentOptions {
  gapOpenPenalty?: number;    // Default -10
  gapExtendPenalty?: number;  // Default -1
}

/**
 * Performs Needleman-Wunsch global alignment between two amino acid sequences.
 */
export function alignSequencesNeedlemanWunsch(
  sourceItems: SequenceInputItem[],
  targetItems: SequenceInputItem[],
  options: AlignmentOptions = {}
): SequenceAlignmentResult {
  const gapOpen = options.gapOpenPenalty ?? -10;
  const gapExtend = options.gapExtendPenalty ?? -1;

  const n = sourceItems.length;
  const m = targetItems.length;

  if (n === 0 && m === 0) {
    return {
      sourceAlignedSeq: '',
      targetAlignedSeq: '',
      alignmentScore: 0,
      alignmentLength: 0,
      identityCount: 0,
      similarityCount: 0,
      gapCount: 0,
      sequenceIdentityPercent: 0,
      sequenceSimilarityPercent: 0,
      residuePairs: [],
      sourceToTargetResidueMap: new Map(),
    };
  }

  // Initialize dynamic programming scoring matrix
  // dp[i][j] = maximum score aligning prefix sourceItems[0..i-1] with targetItems[0..j-1]
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  // Traceback matrix:
  // 0 = DIAG (match/mismatch), 1 = UP (deletion in target / gap in target), 2 = LEFT (insertion in target / gap in source)
  const trace: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  dp[0][0] = 0;
  for (let i = 1; i <= n; i++) {
    dp[i][0] = gapOpen + (i - 1) * gapExtend;
    trace[i][0] = 1; // UP
  }
  for (let j = 1; j <= m; j++) {
    dp[0][j] = gapOpen + (j - 1) * gapExtend;
    trace[0][j] = 2; // LEFT
  }

  for (let i = 1; i <= n; i++) {
    const charA = sourceItems[i - 1].char1;
    for (let j = 1; j <= m; j++) {
      const charB = targetItems[j - 1].char1;
      const matchScore = getBlosum62Score(charA, charB);

      const scoreDiag = dp[i - 1][j - 1] + matchScore;
      const scoreUp = dp[i - 1][j] + (trace[i - 1][j] === 1 ? gapExtend : gapOpen);
      const scoreLeft = dp[i][j - 1] + (trace[i][j - 1] === 2 ? gapExtend : gapOpen);

      let maxScore = scoreDiag;
      let dir = 0; // DIAG

      if (scoreUp > maxScore) {
        maxScore = scoreUp;
        dir = 1; // UP
      }
      if (scoreLeft > maxScore) {
        maxScore = scoreLeft;
        dir = 2; // LEFT
      }

      dp[i][j] = maxScore;
      trace[i][j] = dir;
    }
  }

  // Backtracking to reconstruct alignment
  let i = n;
  let j = m;
  const aliRevA: string[] = [];
  const aliRevB: string[] = [];
  const residuePairsRev: AlignedResiduePair[] = [];
  const sourceToTargetMap = new Map<string, string>();

  let identityCount = 0;
  let similarityCount = 0;
  let gapCount = 0;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && trace[i][j] === 0) {
      // Diagonal: match / mismatch
      const itemA = sourceItems[i - 1];
      const itemB = targetItems[j - 1];
      aliRevA.push(itemA.char1);
      aliRevB.push(itemB.char1);

      const isExact = itemA.char1.toUpperCase() === itemB.char1.toUpperCase();
      const isSim = getBlosum62Score(itemA.char1, itemB.char1) > 0;
      if (isExact) identityCount++;
      if (isSim) similarityCount++;

      const keyA = `${itemA.chainId}:${itemA.resSeq}${itemA.insCode || ''}`;
      const keyB = `${itemB.chainId}:${itemB.resSeq}${itemB.insCode || ''}`;
      sourceToTargetMap.set(keyA, keyB);

      residuePairsRev.push({
        sourceChain: itemA.chainId,
        sourceResSeq: itemA.resSeq,
        sourceInsCode: itemA.insCode,
        sourceResName: itemA.resName,
        sourceChar1: itemA.char1,

        targetChain: itemB.chainId,
        targetResSeq: itemB.resSeq,
        targetInsCode: itemB.insCode,
        targetResName: itemB.resName,
        targetChar1: itemB.char1,

        isExactMatch: isExact,
        isSimilar: isSim,
        hasCoordinates: !!(itemA.hasCoords && itemB.hasCoords),
      });

      i--;
      j--;
    } else if (i > 0 && (j === 0 || trace[i][j] === 1)) {
      // UP: Gap in target (deletion in B)
      const itemA = sourceItems[i - 1];
      aliRevA.push(itemA.char1);
      aliRevB.push('-');
      gapCount++;
      i--;
    } else {
      // LEFT: Gap in source (insertion in B)
      const itemB = targetItems[j - 1];
      aliRevA.push('-');
      aliRevB.push(itemB.char1);
      gapCount++;
      j--;
    }
  }

  aliRevA.reverse();
  aliRevB.reverse();
  residuePairsRev.reverse();

  const alignmentLength = aliRevA.length;
  const seqIdentityPercent = alignmentLength > 0 ? Number(((identityCount / alignmentLength) * 100).toFixed(2)) : 0;
  const seqSimilarityPercent = alignmentLength > 0 ? Number(((similarityCount / alignmentLength) * 100).toFixed(2)) : 0;

  return {
    sourceAlignedSeq: aliRevA.join(''),
    targetAlignedSeq: aliRevB.join(''),
    alignmentScore: dp[n][m],
    alignmentLength,
    identityCount,
    similarityCount,
    gapCount,
    sequenceIdentityPercent: seqIdentityPercent,
    sequenceSimilarityPercent: seqSimilarityPercent,
    residuePairs: residuePairsRev,
    sourceToTargetResidueMap: sourceToTargetMap,
  };
}
