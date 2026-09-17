/**
 * @mocs/conformance — Invariant Definitions & Evaluation
 *
 * Provides authoritative desired-vs-actual comparison and conformance assertions
 * decoupled from rendering backends and UI frameworks.
 */

import { RendererConformanceError } from '@mocs/core';

export interface DesiredProofCounts {
  readonly aabbCount: number;
  readonly caliperCount: number;
  readonly reticleCount: number;
}

export interface ActualProofCounts {
  readonly aabbCount: number;
  readonly caliperCount: number;
  readonly reticleCount: number;
  readonly totalProofNodes?: number;
  readonly totalRepresentations?: number;
}

export type ConformanceVerdict = 'PASS' | 'FAIL';

export interface ConformanceReport {
  readonly verdict: ConformanceVerdict;
  readonly isConformant: boolean;
  readonly desired: DesiredProofCounts;
  readonly actual: ActualProofCounts;
  readonly discrepancies: readonly string[];
  readonly timestamp: string;
}

/**
 * Pure evaluation function comparing desired state with actual renderer state.
 */
export function evaluateConformance(
  desired: DesiredProofCounts,
  actual: ActualProofCounts
): ConformanceReport {
  const discrepancies: string[] = [];

  if (actual.aabbCount !== desired.aabbCount) {
    discrepancies.push(
      `AABB count mismatch: expected ${desired.aabbCount}, found ${actual.aabbCount} in state tree`
    );
  }
  if (actual.caliperCount !== desired.caliperCount) {
    discrepancies.push(
      `Caliper count mismatch: expected ${desired.caliperCount}, found ${actual.caliperCount} in state tree`
    );
  }
  if (actual.reticleCount !== desired.reticleCount) {
    discrepancies.push(
      `Reticle count mismatch: expected ${desired.reticleCount}, found ${actual.reticleCount} in state tree`
    );
  }

  const isConformant = discrepancies.length === 0;

  return {
    verdict: isConformant ? 'PASS' : 'FAIL',
    isConformant,
    desired,
    actual,
    discrepancies,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Hard fail-closed assertion. Throws RendererConformanceError if divergence exists.
 */
export function assertConformance(
  desired: DesiredProofCounts,
  actual: ActualProofCounts
): void {
  const report = evaluateConformance(desired, actual);
  if (!report.isConformant) {
    throw new RendererConformanceError(desired as unknown as Record<string, unknown>, {
      aabbCount: actual.aabbCount,
      caliperCount: actual.caliperCount,
      reticleCount: actual.reticleCount,
    });
  }
}
