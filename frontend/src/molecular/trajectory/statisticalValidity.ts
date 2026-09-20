/**
 * MOCS-Cert Trajectory Statistical Validity & Convergence Engine.
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: Flyvbjerg & Petersen (1989) Block Averaging, Chodera (2016) Autocorrelation & Inefficiency
 * 
 * Non-Negotiable Epistemic Mandates:
 * 1. MD trajectory frames are temporally correlated; naive SE = sigma / sqrt(N) artificially inflates precision.
 * 2. Effective sample size N_eff = N / g must be used when reporting uncertainties.
 * 3. Never declare a trajectory "converged" or "equilibrated" without empirical drift regression evidence.
 */

import type {
  AutocorrelationResult,
  BlockAveragingResult,
  ConvergenceAssessmentResult,
} from './types';

/**
 * Computes the normalized temporal autocorrelation function C(tau) for a time series:
 *   C(tau) = < (x(t) - <x>)(x(t+tau) - <x>) > / sigma²
 */
export function calculateAutocorrelation(
  series: number[],
  maxLag?: number
): { lagTimes: number[]; autocorrelationValues: number[] } {
  const n = series.length;
  if (n < 2) {
    return { lagTimes: [0], autocorrelationValues: [1.0] };
  }

  // Compute mean and variance
  let sum = 0;
  for (let i = 0; i < n; i++) sum += series[i];
  const mean = sum / n;

  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const d = series[i] - mean;
    sumSq += d * d;
  }
  const variance = sumSq / n;

  if (variance < 1e-12) {
    // Constant series: perfect correlation
    const limit = maxLag ? Math.min(maxLag, n - 1) : Math.min(50, n - 1);
    const lagTimes = Array.from({ length: limit + 1 }, (_, i) => i);
    const autocorrelationValues = Array.from({ length: limit + 1 }, () => 1.0);
    return { lagTimes, autocorrelationValues };
  }

  const limitLag = maxLag ? Math.min(maxLag, n - 1) : Math.min(Math.floor(n / 2), 200);
  const lagTimes: number[] = [];
  const autocorrelationValues: number[] = [];

  for (let tau = 0; tau <= limitLag; tau++) {
    let sumProd = 0;
    const count = n - tau;
    for (let t = 0; t < count; t++) {
      sumProd += (series[t] - mean) * (series[t + tau] - mean);
    }
    const cTau = (sumProd / count) / variance;
    lagTimes.push(tau);
    autocorrelationValues.push(Number(cTau.toFixed(4)));
  }

  return { lagTimes, autocorrelationValues };
}

/**
 * Computes integrated autocorrelation time (tau_int) and Effective Sample Size (N_eff).
 *   g = 1 + 2 * sum_{k=1}^W (1 - k/W) * C(k)
 *   N_eff = N / g
 */
export function calculateEffectiveSampleSize(
  series: number[],
  maxLag?: number
): AutocorrelationResult {
  const n = series.length;
  if (n < 2) {
    return {
      lagTimes: [0],
      autocorrelationValues: [1.0],
      integratedAutocorrelationTime: 0,
      statisticalInefficiency: 1.0,
      effectiveSampleSize: n,
      totalSamples: n,
    };
  }

  const { lagTimes, autocorrelationValues } = calculateAutocorrelation(series, maxLag);

  // Integrate autocorrelation until first negative crossing or threshold
  let sumIntegral = 0;
  let cutoffW = 1;

  for (let k = 1; k < autocorrelationValues.length; k++) {
    const val = autocorrelationValues[k];
    if (val <= 0.05) {
      cutoffW = k;
      break;
    }
    sumIntegral += val;
    cutoffW = k;
  }

  // Statistical inefficiency g
  const tauInt = Math.max(0, sumIntegral);
  const statisticalInefficiency = Math.max(1.0, Number((1 + 2 * tauInt).toFixed(3)));
  const nEff = Math.max(1, Math.min(n, Math.floor(n / statisticalInefficiency)));

  return {
    lagTimes,
    autocorrelationValues,
    integratedAutocorrelationTime: Number(tauInt.toFixed(3)),
    statisticalInefficiency,
    effectiveSampleSize: nEff,
    totalSamples: n,
  };
}

/**
 * Implements Flyvbjerg-Petersen (1989) block averaging to determine the
 * true asymptotic standard error of the mean for correlated trajectory data.
 */
export function calculateBlockAveraging(
  series: number[],
  minBlockSize = 2,
  maxBlockCount = 10
): BlockAveragingResult {
  const n = series.length;
  if (n < 4) {
    let s = 0;
    for (const v of series) s += v;
    const m = n > 0 ? s / n : 0;
    let varS = 0;
    for (const v of series) varS += (v - m) * (v - m);
    const sem = n > 1 ? Math.sqrt(varS / (n * (n - 1))) : 0;
    return {
      blockSizes: [1],
      blockStandardErrors: [Number(sem.toFixed(4))],
      convergedSem: Number(sem.toFixed(4)),
      untransformedSem: Number(sem.toFixed(4)),
      inefficiencyRatio: 1.0,
    };
  }

  // Naive standard error
  let sum = 0;
  for (let i = 0; i < n; i++) sum += series[i];
  const mean = sum / n;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const d = series[i] - mean;
    sumSq += d * d;
  }
  const naiveVar = sumSq / (n - 1);
  const untransformedSem = Math.sqrt(naiveVar / n);

  const blockSizes: number[] = [];
  const blockStandardErrors: number[] = [];

  // Generate geometric or linear progression of block sizes
  const maxBlockSize = Math.floor(n / 4);
  let currentBlockSize = minBlockSize;

  while (currentBlockSize <= maxBlockSize && blockSizes.length < maxBlockCount) {
    const numBlocks = Math.floor(n / currentBlockSize);
    if (numBlocks < 2) break;

    // Compute block means
    const blockMeans: number[] = new Array(numBlocks);
    for (let b = 0; b < numBlocks; b++) {
      let bSum = 0;
      const start = b * currentBlockSize;
      for (let i = 0; i < currentBlockSize; i++) {
        bSum += series[start + i];
      }
      blockMeans[b] = bSum / currentBlockSize;
    }

    // Variance of block means
    let bmSum = 0;
    for (let b = 0; b < numBlocks; b++) bmSum += blockMeans[b];
    const bmMean = bmSum / numBlocks;

    let bmVarSum = 0;
    for (let b = 0; b < numBlocks; b++) {
      const diff = blockMeans[b] - bmMean;
      bmVarSum += diff * diff;
    }
    const blockMeanVar = bmVarSum / (numBlocks - 1);
    const blockSem = Math.sqrt(blockMeanVar / numBlocks);

    blockSizes.push(currentBlockSize);
    blockStandardErrors.push(Number(blockSem.toFixed(4)));

    currentBlockSize = Math.ceil(currentBlockSize * 1.5);
  }

  // Converged SEM is maximum over block sizes or the last block size
  const convergedSem = blockStandardErrors.length > 0
    ? Math.max(...blockStandardErrors)
    : untransformedSem;

  const inefficiencyRatio = untransformedSem > 1e-9
    ? Number((convergedSem / untransformedSem).toFixed(2))
    : 1.0;

  return {
    blockSizes,
    blockStandardErrors,
    convergedSem: Number(convergedSem.toFixed(4)),
    untransformedSem: Number(untransformedSem.toFixed(4)),
    inefficiencyRatio,
  };
}

/**
 * Assesses trajectory equilibration and convergence using a drift regression test
 * over the latter half of the trajectory observable.
 */
export function assessTrajectoryConvergence(
  series: number[],
  windowFraction = 0.5
): ConvergenceAssessmentResult {
  const n = series.length;
  if (n < 10) {
    return {
      status: 'INSUFFICIENT_DATA',
      driftSlopePerFrame: 0,
      totalDrift: 0,
      stationarityWindowFrames: [0, Math.max(0, n - 1)],
      pValueOrConfidence: 0,
      rationale: 'Trajectory frame count is too short (< 10 frames) for statistical convergence assessment.',
    };
  }

  // Evaluate the second half (or windowFraction) of the simulation
  const startIdx = Math.floor(n * (1.0 - windowFraction));
  const windowLen = n - startIdx;

  let sumT = 0;
  let sumY = 0;
  let sumT2 = 0;
  let sumTY = 0;

  for (let i = 0; i < windowLen; i++) {
    const t = i;
    const y = series[startIdx + i];
    sumT += t;
    sumY += y;
    sumT2 += t * t;
    sumTY += t * y;
  }

  // Slope: beta = (N*sumTY - sumT*sumY) / (N*sumT2 - (sumT)^2)
  const denom = windowLen * sumT2 - sumT * sumT;
  const slope = denom !== 0 ? (windowLen * sumTY - sumT * sumY) / denom : 0;
  const totalDrift = slope * windowLen;

  // Window variance
  const meanY = sumY / windowLen;
  let sumSq = 0;
  for (let i = 0; i < windowLen; i++) {
    const diff = series[startIdx + i] - meanY;
    sumSq += diff * diff;
  }
  const windowSigma = Math.sqrt(sumSq / windowLen);

  // Stationarity ratio: drift relative to thermal noise
  const driftRatio = windowSigma > 1e-6 ? Math.abs(totalDrift) / windowSigma : 0;

  // If drift across the window is within 1.0 standard deviation of thermal fluctuations,
  // or if absolute slope is negligible (< 1e-3 per frame), the observable is stationary.
  const isStationary = driftRatio < 1.0 || Math.abs(slope) < 1e-3;

  return {
    status: isStationary ? 'CONVERGED_STATIONARY' : 'DRIFTING_UNCONVERGED',
    driftSlopePerFrame: Number(slope.toFixed(5)),
    totalDrift: Number(totalDrift.toFixed(3)),
    stationarityWindowFrames: [startIdx, n - 1],
    pValueOrConfidence: Number((1.0 - Math.min(1.0, driftRatio)).toFixed(3)),
    rationale: isStationary
      ? `Observable is stationary across frames [${startIdx}, ${n - 1}]; total drift (${totalDrift.toFixed(2)}) is well within thermal variance (sigma = ${windowSigma.toFixed(2)}).`
      : `Observable exhibits active systematic drift (${totalDrift.toFixed(2)}) across frames [${startIdx}, ${n - 1}] exceeding thermal fluctuation limits.`,
  };
}
