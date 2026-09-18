/**
 * Protein Structure Prediction Pipeline & Safe Execution Engine
 * 
 * Manages:
 * - Stale request / race condition prevention (monotonic request sequence counter)
 * - Deterministic prediction cache (keyed by provider:model:seqHash)
 * - AbortSignal and timeout handling
 * - Sequence-to-structure verification
 * - Extraction of authentic pLDDT confidence & PAE matrices
 * - Scientific provenance attachment with epistemic safeguards
 */

import type {
  PredictionRequest,
  PredictionResult,
  PaeMatrix,
  PredictionProvider,
  StructureEpistemicOrigin,
} from './types';
import {
  extractPlddtFromPdb,
  calculateConfidenceSummary,
  validatePaeMatrix,
} from './confidenceParser';
import {
  createModelProvenance,
  computeSequenceSha256,
} from './provenance';
import {
  cleanAndValidateProteinSequence,
  validateSequenceStructureCorrespondence,
} from './sequenceValidator';
import {
  generateSyntheticBackbonePDB,
} from '../resolver/resolveSequenceFold';

export class PredictionPipeline {
  private activeRequestId = 0;
  private cache = new Map<string, PredictionResult>();
  private readonly maxCacheSize = 100;

  /**
   * Clears the in-memory prediction cache.
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Retrieves the current cache size.
   */
  public getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Computes a deterministic cache key.
   */
  public computeCacheKey(provider: string, modelName: string, sequenceHash: string): string {
    return `${provider}:${modelName}:${sequenceHash}`;
  }

  /**
   * Generates a synthetic calibrated PAE matrix (N x N) for a given sequence length
   * with biologically plausible local vs non-local error characteristics and asymmetry.
   */
  public generateCalibratedPaeMatrix(n: number): number[][] {
    const matrix: number[][] = [];
    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          row.push(0.0);
        } else {
          const seqDist = Math.abs(i - j);
          // Local residue pairs (< 5 residues) have low error (1.5 - 4.5 A)
          // Distant residues have higher error with asymmetry based on position
          let baseError = Math.min(30.0, 2.0 + Math.sqrt(seqDist) * 3.2);
          // Introduce slight realistic asymmetry PAE(i, j) != PAE(j, i)
          const asymmetryFactor = ((i * 7 + j * 13) % 11 - 5) * 0.15;
          const val = Math.max(0.5, Math.min(31.75, Number((baseError + asymmetryFactor).toFixed(2))));
          row.push(val);
        }
      }
      matrix.push(row);
    }
    return matrix;
  }

  /**
   * Resolves a protein sequence prediction with race-condition safeguards,
   * timeout handling, deterministic caching, and epistemic verification.
   */
  public async predictStructure(request: PredictionRequest): Promise<PredictionResult> {
    const currentRequestId = ++this.activeRequestId;

    const {
      sequence: rawSequence,
      modelName = 'ESMFold-v1',
      provider = 'esmfold',
      signal,
      timeoutMs = 1500,
    } = request;

    // Step 1: Strict input sequence validation
    const { cleanSequence, header } = cleanAndValidateProteinSequence(rawSequence);
    const seqHash = computeSequenceSha256(cleanSequence);
    const cacheKey = this.computeCacheKey(provider, modelName, seqHash);

    // Step 2: Check deterministic cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Step 3: Manage timeout & AbortSignal
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener('abort', () => controller.abort(), { once: true });
      }
    }

    let pdbText: string | null = null;
    let actualProvider: PredictionProvider = provider;
    let epistemicOrigin: StructureEpistemicOrigin = 'predicted';
    let networkCaveat: string | null = null;

    try {
      // If ESMFold API is targeted and online, attempt live fetch for sequences <= 400 aa
      if (
        provider === 'esmfold' &&
        cleanSequence.length <= 400 &&
        typeof fetch !== 'undefined'
      ) {
        try {
          const res = await fetch('https://api.esmatlas.com/v1/prediction/', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: cleanSequence,
            signal: controller.signal,
          });
          if (res.ok) {
            const fetchedPdb = await res.text();
            if (fetchedPdb && fetchedPdb.includes('ATOM  ')) {
              pdbText = fetchedPdb;
              actualProvider = 'esmfold';
              epistemicOrigin = 'predicted';
            }
          } else {
            networkCaveat = `ESMFold API returned HTTP ${res.status}; fell back to calibrated synthetic generator.`;
          }
        } catch (err: any) {
          // Network failure, offline mode, or timeout (F-057) - record explicit caveat
          networkCaveat = `ESMFold live API unreachable (${err?.message || 'offline or timed out'}); fell back to calibrated synthetic generator.`;
        }
      }

      // Check if this request has been superseded by a newer request
      if (currentRequestId !== this.activeRequestId) {
        throw new Error(`Prediction request #${currentRequestId} superseded by #${this.activeRequestId}.`);
      }

      // Step 4: Fallback to calibrated secondary structure generator if API was unreachable
      if (!pdbText) {
        pdbText = generateSyntheticBackbonePDB(cleanSequence, modelName);
        actualProvider = 'synthetic_calibration';
        epistemicOrigin = 'synthetic_calibration';
      }
    } finally {
      clearTimeout(timeoutId);
    }

    // Step 5: Parse per-residue pLDDT confidence
    const perResiduePlddt = extractPlddtFromPdb(pdbText);

    // Step 6: Verify 1-to-1 sequence-to-structure correspondence
    const correspondence = validateSequenceStructureCorrespondence(cleanSequence, perResiduePlddt);
    if (!correspondence.matches) {
      throw new Error(`Structural model corrupted: ${correspondence.diagnosticMessage}`);
    }

    // Step 7: Construct PAE Matrix only when applicable (F-058)
    let paeMatrix: PaeMatrix | undefined = undefined;
    let ptmScore: number | undefined = undefined;
    const customCaveats: string[] = [];
    if (networkCaveat) {
      customCaveats.push(networkCaveat);
    }

    if (epistemicOrigin === 'synthetic_calibration') {
      const rawPae = this.generateCalibratedPaeMatrix(cleanSequence.length);
      paeMatrix = validatePaeMatrix(rawPae, cleanSequence.length);
      ptmScore = 0.82;
      customCaveats.push('Synthetic calibration model: pTM and PAE matrix are calibrated structural estimates, not experimental or deep-learning outputs.');
    } else {
      // Live ESMFold prediction returns authentic per-residue pLDDT in B-factor column, but no PAE matrix
      customCaveats.push('Authentic ESMFold prediction: per-residue pLDDT parsed from B-factor column. PAE matrix not emitted by single-sequence prediction endpoint.');
    }

    // Step 8: Calculate statistical confidence summary
    const confidenceSummary = calculateConfidenceSummary(
      perResiduePlddt,
      ptmScore,
      undefined,
      paeMatrix
    );

    // Step 9: Construct immutable model provenance
    const provenance = createModelProvenance({
      provider: actualProvider,
      modelName,
      modelVersion: '1.0.0',
      epistemicOrigin,
      sequence: cleanSequence,
      randomSeed: request.customSeed,
      parameters: {
        header,
        sequenceLength: cleanSequence.length,
      },
      customCaveats,
    });

    if (currentRequestId !== this.activeRequestId) {
      throw new Error(`Prediction request #${currentRequestId} superseded by #${this.activeRequestId}.`);
    }

    const resultId = `pred_${cleanSequence.slice(0, 8)}_${cleanSequence.length}`;
    const result: PredictionResult = {
      id: resultId,
      provenance,
      sequence: cleanSequence,
      residueCount: cleanSequence.length,
      pdbText,
      perResiduePlddt,
      confidenceSummary,
      paeMatrix,
    };

    // Step 10: Store in cache
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(cacheKey, result);

    return result;
  }
}

// Global pipeline singleton
let globalPipeline: PredictionPipeline | null = null;

export function getPredictionPipeline(): PredictionPipeline {
  if (!globalPipeline) {
    globalPipeline = new PredictionPipeline();
  }
  return globalPipeline;
}

export function clearPredictionCache(): void {
  if (globalPipeline) {
    globalPipeline.clearCache();
  }
}

export async function predictProteinStructure(
  request: PredictionRequest
): Promise<PredictionResult> {
  return getPredictionPipeline().predictStructure(request);
}
