/**
 * @mocs/conformance — Reconciliation Contracts
 *
 * Defines deterministic state-reconciliation patterns to recover from
 * renderer divergence and restore fail-closed invariants.
 */

import { DesiredProofCounts, ActualProofCounts, evaluateConformance, ConformanceReport } from './invariants.js';

export interface ReconciliationOutcome {
  readonly needed: boolean;
  readonly succeeded: boolean;
  readonly previousReport: ConformanceReport;
  readonly finalReport: ConformanceReport;
}

export interface StateReconciler {
  getActualCounts(): ActualProofCounts;
  purgeStaleNodes(): Promise<void>;
  reconstructDesired?(desired: DesiredProofCounts): Promise<void>;
}

/**
 * Idempotent reconciliation runner:
 * 1. Checks initial conformance.
 * 2. If conformant, returns immediately without modifying state.
 * 3. If divergent, purges stale nodes and rebuilds desired elements.
 * 4. Verifies postconditions to ensure exact recovery.
 */
export async function executeReconciliation(
  desired: DesiredProofCounts,
  reconciler: StateReconciler
): Promise<ReconciliationOutcome> {
  const initialActual = reconciler.getActualCounts();
  const initialReport = evaluateConformance(desired, initialActual);

  if (initialReport.isConformant) {
    return {
      needed: false,
      succeeded: true,
      previousReport: initialReport,
      finalReport: initialReport,
    };
  }

  // Divergence detected: Purge divergent nodes
  await reconciler.purgeStaleNodes();

  // Reconstruct desired nodes if needed
  if (reconciler.reconstructDesired && (desired.aabbCount > 0 || desired.caliperCount > 0 || desired.reticleCount > 0)) {
    await reconciler.reconstructDesired(desired);
  }

  // Re-evaluate actual state
  const finalActual = reconciler.getActualCounts();
  const finalReport = evaluateConformance(desired, finalActual);

  return {
    needed: true,
    succeeded: finalReport.isConformant,
    previousReport: initialReport,
    finalReport,
  };
}
