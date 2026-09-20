import { describe, it, expect } from 'vitest';
import { EvidenceLedger } from '@mocs/evidence';

describe('Evidence Ledger — Cryptographic Hash Chain & Tamper Detection', () => {
  it('chains records cryptographically via previousLedgerDigest and ledgerDigest', async () => {
    const ledger = new EvidenceLedger();

    // Append Record 1 (Genesis)
    const res1 = await ledger.append({
      proofType: 'AABB',
      datasetBundle: { datasetId: '4HHB', format: 'pdb', contentHash: 'hash-4hhb-1' },
      modelNumber: 1,
      assemblyId: null,
      frameIdentity: 0,
      canonicalQuery: { expression: 'A:*:*:*', queryHash: 'qhash-chain-a' },
      resolutionContext: { atomCount: 100 },
      algorithmId: 'mocs.aabb',
      algorithmVersion: '2.0.0',
      parameters: { padding: 0.0 },
      scientificResult: { min: [0, 0, 0], max: [10, 10, 10] },
      verificationRecords: [{ invariant: 'AABB_CONFORMANCE', passed: true, checkedAt: '2026-09-19T20:00:00Z' }],
      certificationState: 'CERTIFIED',
    });
    expect(res1.ok).toBe(true);
    const rec1 = res1.value!;
    expect(rec1.previousLedgerDigest).toBeNull();
    expect(rec1.ledgerDigest).toBeTruthy();

    // Append Record 2 (Linked to Record 1)
    const res2 = await ledger.append({
      proofType: 'DISTANCE_CALIPER',
      datasetBundle: { datasetId: '4HHB', format: 'pdb', contentHash: 'hash-4hhb-1' },
      modelNumber: 1,
      assemblyId: null,
      frameIdentity: 0,
      canonicalQuery: { expression: 'A:87:NE2 -> HEM:142:FE', queryHash: 'qhash-dist-1' },
      resolutionContext: { atomCount: 2 },
      algorithmId: 'mocs.caliper',
      algorithmVersion: '2.0.0',
      parameters: { unit: 'angstrom' },
      scientificResult: { distance: 2.06 },
      verificationRecords: [{ invariant: 'CALIPER_DISTANCE_POSITIVE', passed: true, checkedAt: '2026-09-19T20:00:01Z' }],
      certificationState: 'CERTIFIED',
    });
    expect(res2.ok).toBe(true);
    const rec2 = res2.value!;
    expect(rec2.previousLedgerDigest).toBe(rec1.ledgerDigest);
    expect(rec2.ledgerDigest).not.toBe(rec1.ledgerDigest);

    // Append Record 3 (Linked to Record 2)
    const res3 = await ledger.append({
      proofType: 'INSPECTION_CUTAWAY',
      datasetBundle: { datasetId: '4HHB', format: 'pdb', contentHash: 'hash-4hhb-1' },
      modelNumber: 1,
      assemblyId: null,
      frameIdentity: 0,
      canonicalQuery: { expression: 'HEM:142:FE', queryHash: 'qhash-hem-fe' },
      resolutionContext: { radius: 8.5 },
      algorithmId: 'mocs.cutaway',
      algorithmVersion: '2.0.0',
      parameters: { radius: 8.5 },
      scientificResult: { cutawayActive: true },
      verificationRecords: [{ invariant: 'TARGET_PRESERVED', passed: true, checkedAt: '2026-09-19T20:00:02Z' }],
      certificationState: 'CERTIFIED',
    });
    expect(res3.ok).toBe(true);
    const rec3 = res3.value!;
    expect(rec3.previousLedgerDigest).toBe(rec2.ledgerDigest);

    // Initial verify: Valid chain
    const valid = await ledger.verifyLedgerIntegrity();
    expect(valid).toBe(true);
  });

  it('tamper detection: modifying historical record contents fails ledger integrity check', async () => {
    const ledger = new EvidenceLedger();

    const res1 = await ledger.append({
      proofType: 'DISTANCE_CALIPER',
      datasetBundle: { datasetId: '4HHB', format: 'pdb', contentHash: 'hash-1' },
      modelNumber: 1,
      assemblyId: null,
      frameIdentity: 0,
      canonicalQuery: { expression: 'A:87:NE2', queryHash: 'q1' },
      resolutionContext: {},
      algorithmId: 'mocs.caliper',
      algorithmVersion: '2.0.0',
      parameters: {},
      scientificResult: { distance: 2.06 },
      verificationRecords: [],
      certificationState: 'CERTIFIED',
    });
    expect(res1.ok).toBe(true);

    const res2 = await ledger.append({
      proofType: 'DISTANCE_CALIPER',
      datasetBundle: { datasetId: '4HHB', format: 'pdb', contentHash: 'hash-1' },
      modelNumber: 1,
      assemblyId: null,
      frameIdentity: 0,
      canonicalQuery: { expression: 'B:87:NE2', queryHash: 'q2' },
      resolutionContext: {},
      algorithmId: 'mocs.caliper',
      algorithmVersion: '2.0.0',
      parameters: {},
      scientificResult: { distance: 2.15 },
      verificationRecords: [],
      certificationState: 'CERTIFIED',
    });
    expect(res2.ok).toBe(true);

    expect(await ledger.verifyLedgerIntegrity()).toBe(true);

    // Maliciously tamper with Record 1's scientificResult distance: 2.06 -> 5.55
    const rec1 = ledger.get(res1.value!.evidenceId)!;
    (rec1 as any).scientificResult = { distance: 5.55 };

    // Ledger verification MUST detect the tampering and fail
    const integrityAfterTampering = await ledger.verifyLedgerIntegrity();
    expect(integrityAfterTampering).toBe(false);
  });

  it('tamper detection: modifying previousLedgerDigest breaks hash chain', async () => {
    const ledger = new EvidenceLedger();

    const res1 = await ledger.append({
      proofType: 'AABB',
      datasetBundle: { datasetId: '4HHB', format: 'pdb', contentHash: 'h1' },
      modelNumber: 1,
      assemblyId: null,
      frameIdentity: 0,
      canonicalQuery: { expression: '*', queryHash: 'q*' },
      resolutionContext: {},
      algorithmId: 'mocs.aabb',
      algorithmVersion: '2.0.0',
      parameters: {},
      scientificResult: { min: [0, 0, 0], max: [1, 1, 1] },
      verificationRecords: [],
      certificationState: 'CERTIFIED',
    });

    const res2 = await ledger.append({
      proofType: 'AABB',
      datasetBundle: { datasetId: '4HHB', format: 'pdb', contentHash: 'h1' },
      modelNumber: 1,
      assemblyId: null,
      frameIdentity: 0,
      canonicalQuery: { expression: '*', queryHash: 'q*' },
      resolutionContext: {},
      algorithmId: 'mocs.aabb',
      algorithmVersion: '2.0.0',
      parameters: {},
      scientificResult: { min: [0, 0, 0], max: [2, 2, 2] },
      verificationRecords: [],
      certificationState: 'CERTIFIED',
    });

    // Tamper with record 2's previous hash link
    const rec2 = ledger.get(res2.value!.evidenceId)!;
    (rec2 as any).previousLedgerDigest = 'forged_previous_hash_value';

    expect(await ledger.verifyLedgerIntegrity()).toBe(false);
  });
});
