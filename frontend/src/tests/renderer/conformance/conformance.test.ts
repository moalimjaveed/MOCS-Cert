import { describe, it, expect } from 'vitest';
import {
  evaluateConformance,
  assertConformance,
  evaluateCertification,
  executeReconciliation,
  StateReconciler,
  DesiredProofCounts,
  ActualProofCounts,
} from '@mocs/conformance';
import { RendererConformanceError } from '@mocs/core';

describe('@mocs/conformance — Fail-Closed Invariant Engine & Certification', () => {
  it('passes conformance when desired and actual proof counts match exactly', () => {
    const desired: DesiredProofCounts = { aabbCount: 1, caliperCount: 1, reticleCount: 2 };
    const actual: ActualProofCounts = { aabbCount: 1, caliperCount: 1, reticleCount: 2, totalProofNodes: 4 };

    const report = evaluateConformance(desired, actual);
    expect(report.isConformant).toBe(true);
    expect(report.verdict).toBe('PASS');
    expect(report.discrepancies.length).toBe(0);

    expect(() => assertConformance(desired, actual)).not.toThrow();
  });

  it('fails closed when actual state has residual ghost geometry', () => {
    const desired: DesiredProofCounts = { aabbCount: 0, caliperCount: 0, reticleCount: 0 };
    // Mol* state tree still contains 1 stale AABB node
    const actual: ActualProofCounts = { aabbCount: 1, caliperCount: 0, reticleCount: 0 };

    const report = evaluateConformance(desired, actual);
    expect(report.isConformant).toBe(false);
    expect(report.verdict).toBe('FAIL');
    expect(report.discrepancies.length).toBe(1);
    expect(report.discrepancies[0]).toContain('AABB count mismatch');

    expect(() => assertConformance(desired, actual)).toThrow(RendererConformanceError);
  });

  it('diagnoses multiple simultaneous discrepancies accurately', () => {
    const desired: DesiredProofCounts = { aabbCount: 2, caliperCount: 1, reticleCount: 2 };
    const actual: ActualProofCounts = { aabbCount: 1, caliperCount: 0, reticleCount: 3 };

    const report = evaluateConformance(desired, actual);
    expect(report.isConformant).toBe(false);
    expect(report.discrepancies.length).toBe(3);
  });

  it('certification state machine: CERTIFIED is true iff conformance PASS and ledger integrity holds', () => {
    const conformantReport = evaluateConformance(
      { aabbCount: 1, caliperCount: 0, reticleCount: 1 },
      { aabbCount: 1, caliperCount: 0, reticleCount: 1 }
    );
    const divergentReport = evaluateConformance(
      { aabbCount: 0, caliperCount: 0, reticleCount: 0 },
      { aabbCount: 1, caliperCount: 0, reticleCount: 0 }
    );

    // Case 1: Both pass -> CERTIFIED
    const cert1 = evaluateCertification(conformantReport, true);
    expect(cert1.certified).toBe(true);
    expect(cert1.status).toBe('CERTIFIED');

    // Case 2: Conformance failed -> FAILED_CONFORMANCE (certified = false)
    const cert2 = evaluateCertification(divergentReport, true);
    expect(cert2.certified).toBe(false);
    expect(cert2.status).toBe('FAILED_CONFORMANCE');

    // Case 3: Conformance passed, but ledger tampered -> FAILED_INTEGRITY (certified = false)
    const cert3 = evaluateCertification(conformantReport, false);
    expect(cert3.certified).toBe(false);
    expect(cert3.status).toBe('FAILED_INTEGRITY');
  });

  it('executes idempotent reconciliation to recover divergent renderer state', async () => {
    let mockState: ActualProofCounts = { aabbCount: 2, caliperCount: 1, reticleCount: 0 };
    const desired: DesiredProofCounts = { aabbCount: 1, caliperCount: 0, reticleCount: 0 };

    const reconciler: StateReconciler = {
      getActualCounts: () => mockState,
      purgeStaleNodes: async () => {
        mockState = { aabbCount: 0, caliperCount: 0, reticleCount: 0 };
      },
      reconstructDesired: async (des) => {
        mockState = { aabbCount: des.aabbCount, caliperCount: des.caliperCount, reticleCount: des.reticleCount };
      },
    };

    // 1. Initial execution recovers divergent state
    const outcome1 = await executeReconciliation(desired, reconciler);
    expect(outcome1.needed).toBe(true);
    expect(outcome1.succeeded).toBe(true);
    expect(mockState.aabbCount).toBe(1);
    expect(mockState.caliperCount).toBe(0);

    // 2. Second execution is a no-op (idempotence)
    const outcome2 = await executeReconciliation(desired, reconciler);
    expect(outcome2.needed).toBe(false);
    expect(outcome2.succeeded).toBe(true);
    expect(mockState.aabbCount).toBe(1);
  });
});
