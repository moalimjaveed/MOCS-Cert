import { describe, it, expect } from 'vitest';
import { EvidenceLedger } from '@mocs/evidence';
import { checkAABBInvariants } from '@mocs/evidence';

describe('Evidence: Append-Only Ledger & Invariant Checks', () => {
  it('appends records and computes valid scientific & provenance digests', async () => {
    const ledger = new EvidenceLedger();

    const result = await ledger.append({
      proofType: 'AABB',
      datasetBundle: {
        datasetId: '4hhb',
        format: 'pdb',
        contentHash: '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
      },
      modelNumber: 1,
      assemblyId: null,
      frameIdentity: null,
      canonicalQuery: {
        expression: 'A:87:NE2',
        queryHash: 'query-hash-1',
      },
      resolutionContext: { entity: '1', chain: 'A' },
      algorithmId: 'AABB_BOUNDS',
      algorithmVersion: '1.0.0',
      parameters: { padding: 0 },
      scientificResult: {
        min: [15.72, 6.59, 13.37],
        max: [18.56, 7.82, 14.79],
        atomCount: 5,
      },
      verificationRecords: [
        {
          invariant: 'AABB_MIN_FINITE',
          passed: true,
          checkedAt: new Date().toISOString(),
        },
      ],
      certificationState: 'COMPUTATION_COMPLETE',
      supersedes: null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(ledger.count).toBe(1);
    const rec = result.value;
    expect(rec.evidenceId).toMatch(/^ev:\d+:\d+$/);
    expect(rec.scientificDigest).toHaveLength(64);
    expect(rec.provenanceDigest).toHaveLength(64);
    expect(rec.supersededBy).toBeNull();
  });

  it('supersedes record without deleting history', async () => {
    const ledger = new EvidenceLedger();

    const res1 = await ledger.append({
      proofType: 'DISTANCE_CALIPER',
      datasetBundle: { datasetId: '4hhb', format: 'pdb', contentHash: 'abc' },
      modelNumber: 1,
      assemblyId: null,
      frameIdentity: null,
      canonicalQuery: { expression: 'A:87:NE2 <-> HEM:142:FE', queryHash: 'q1' },
      resolutionContext: {},
      algorithmId: 'MINIMUM_IMAGE_DISTANCE',
      algorithmVersion: '1.0.0',
      parameters: {},
      scientificResult: { distance: 2.06 },
      verificationRecords: [],
      certificationState: 'COMPUTATION_COMPLETE',
      supersedes: null,
    });
    expect(res1.ok).toBe(true);
    if (!res1.ok) return;

    const oldId = res1.value.evidenceId;

    const res2 = await ledger.supersede(oldId, 'Coordinate recalculation after refined refinement', {
      proofType: 'DISTANCE_CALIPER',
      datasetBundle: { datasetId: '4hhb', format: 'pdb', contentHash: 'abc' },
      modelNumber: 1,
      assemblyId: null,
      frameIdentity: null,
      canonicalQuery: { expression: 'A:87:NE2 <-> HEM:142:FE', queryHash: 'q1' },
      resolutionContext: {},
      algorithmId: 'MINIMUM_IMAGE_DISTANCE',
      algorithmVersion: '1.0.1',
      parameters: {},
      scientificResult: { distance: 2.058 },
      verificationRecords: [],
      certificationState: 'COMPUTATION_COMPLETE',
    });

    expect(res2.ok).toBe(true);
    if (!res2.ok) return;

    expect(ledger.count).toBe(2);
    expect(ledger.get(oldId)?.supersededBy).toBe(res2.value.evidenceId);
    expect(res2.value.supersedes).toBe(oldId);
    expect(ledger.activeRecords).toHaveLength(1);
    expect(ledger.activeRecords[0].evidenceId).toBe(res2.value.evidenceId);

    // Verify ledger integrity
    const isValid = await ledger.verifyLedgerIntegrity();
    expect(isValid).toBe(true);
  });

  it('checks AABB mathematical invariants', () => {
    // Valid AABB
    const okViolations = checkAABBInvariants({
      min: [0, 0, 0],
      max: [10, 10, 10],
      atomCount: 5,
      padding: 0.5,
    });
    expect(okViolations).toHaveLength(0);

    // Inverted bounds
    const badViolations = checkAABBInvariants({
      min: [10, 0, 0],
      max: [5, 10, 10],
      atomCount: 0,
      padding: -1,
    });
    expect(badViolations.length).toBeGreaterThanOrEqual(3);
    expect(badViolations.some((v) => v.invariant === 'AABB_MAX_GTE_MIN_X')).toBe(true);
    expect(badViolations.some((v) => v.invariant === 'AABB_ATOM_COUNT_POSITIVE')).toBe(true);
    expect(badViolations.some((v) => v.invariant === 'AABB_PADDING_NON_NEGATIVE')).toBe(true);
  });
});
