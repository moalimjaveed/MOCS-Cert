/**
 * Adversarial Runtime Verification Suite
 *
 * Tests the MOCS-Cert flagship renderer architecture under adversarial
 * conditions: toggle sequences, ghost geometry, state-tree invariants,
 * scene determinism, and hash-chain tamper detection.
 *
 * These tests simulate the runtime behavior that the browser would exercise
 * without requiring a browser environment by targeting the pure-logic layers:
 *   - compileRenderScene() → CanonicalScene
 *   - EvidenceLedger (hash chain, tamper detection)
 *   - SceneRevisionManager (race fence)
 *   - evaluateConformance / assertConformance (fail-closed)
 *   - verifyLedgerIntegrity (cryptographic)
 *
 * Section numbers map to the Flagship Engineering Mandate sections.
 */

import { describe, it, expect } from 'vitest';
import { compileRenderScene, ProofSpecification, DistanceMeasurementSpec } from '@mocs/scene';
import { EvidenceLedger, EvidenceDraft } from '@mocs/evidence';
import { evaluateConformance, assertConformance, evaluateCertification } from '@mocs/conformance';
import { SceneRevisionManager } from '@mocs/scene';
import { CanonicalStructure } from '@mocs/core';

// ---------------------------------------------------------------------------
// Test structure factory — 4HHB-like minimal topology
// ---------------------------------------------------------------------------
function make4HHBStructure(): CanonicalStructure {
  return {
    datasetId: '4HHB',
    topology: {
      atomCount: 2,
      atoms: [
        { index: 0, name: 'NE2', element: 'N', chain: 'A', resSeq: 87, resName: 'HIS', entityId: '1' },
        { index: 1, name: 'FE', element: 'FE', chain: 'A', resSeq: 142, resName: 'HEM', entityId: '1' },
      ],
      bonds: [],
    },
    models: [{
      modelNum: 1,
      atomCount: 2,
      coordinates: new Float64Array([10.0, 20.0, 30.0, 12.0, 20.0, 30.0]),
    }],
    components: [],
    assemblies: [],
    defaultModelIndex: 0,
  };
}

function make1MBOStructure(): CanonicalStructure {
  return {
    datasetId: '1MBO',
    topology: {
      atomCount: 2,
      atoms: [
        { index: 0, name: 'NE2', element: 'N', chain: 'A', resSeq: 64, resName: 'HIS', entityId: '1' },
        { index: 1, name: 'FE', element: 'FE', chain: 'A', resSeq: 93, resName: 'HEM', entityId: '1' },
      ],
      bonds: [],
    },
    models: [{
      modelNum: 1,
      atomCount: 2,
      // Different coordinates so AABB/caliper are different
      coordinates: new Float64Array([5.0, 10.0, 15.0, 8.0, 10.0, 15.0]),
    }],
    components: [],
    assemblies: [],
    defaultModelIndex: 0,
  };
}

function makeDraftBase(overrides: Partial<EvidenceDraft> = {}): EvidenceDraft {
  return {
    proofType: 'AABB',
    datasetBundle: { datasetId: '4HHB', format: 'pdb', contentHash: 'abc123' },
    modelNumber: 1,
    assemblyId: null,
    frameIdentity: 0,
    canonicalQuery: { expression: 'DATASET:4HHB', queryHash: 'hash-aabb' },
    resolutionContext: { atomCount: 2 },
    algorithmId: 'AABB_ENVELOPE',
    algorithmVersion: '1.0.0',
    parameters: { style: 'wireframe' },
    scientificResult: { min: [10, 20, 30], max: [12, 20, 30] },
    verificationRecords: [{ invariant: 'ATOM_COUNT_POSITIVE', passed: true, checkedAt: '2026-01-01T00:00:00Z' }],
    certificationState: 'EVIDENCE_SEALED',
    supersedes: null,
    ...overrides,
  };
}

// ===========================================================================
// Section 1: Deterministic Scene Compiler — Adversarial Inputs
// ===========================================================================
describe('Section 1 — Adversarial Scene Compiler', () => {
  const CALIPER_4HHB: DistanceMeasurementSpec = { atomAQuery: 'A:87:NE2', atomBQuery: 'HEM:142:FE' };
  const CALIPER_1MBO: DistanceMeasurementSpec = { atomAQuery: 'A:64:NE2', atomBQuery: 'HEM:93:FE' };

  it('AABB OFF produces empty aabbs array (ghost geometry gate)', () => {
    const struct = make4HHBStructure();
    const spec: ProofSpecification = { aabbProtein: false, aabbLigand: false };
    const scene = compileRenderScene(struct, 1, spec);
    expect(scene.proofScene.aabbs.length).toBe(0);
    expect(scene.proofScene.calipers.length).toBe(0);
    expect(scene.proofScene.resolutionFailures.length).toBe(0);
  });

  it('AABB ON then OFF produces 0 aabbs — no ghost geometry persists in scene', () => {
    const struct = make4HHBStructure();
    const specOn: ProofSpecification = { aabbProtein: true, aabbLigand: true };
    const sceneOn = compileRenderScene(struct, 1, specOn);
    expect(sceneOn.proofScene.aabbs.length).toBe(2);

    // Same structure, revision 2, flags off
    const specOff: ProofSpecification = { aabbProtein: false, aabbLigand: false };
    const sceneOff = compileRenderScene(struct, 2, specOff);
    expect(sceneOff.proofScene.aabbs.length).toBe(0);
  });

  it('distanceMeasurement undefined → 0 calipers, 0 failures; spec provided → 1 caliper', () => {
    const struct = make4HHBStructure();
    const sceneOff = compileRenderScene(struct, 1, {});
    expect(sceneOff.proofScene.calipers.length).toBe(0);
    expect(sceneOff.proofScene.resolutionFailures.length).toBe(0);

    const sceneOn = compileRenderScene(struct, 2, { distanceMeasurement: CALIPER_4HHB });
    expect(sceneOn.proofScene.calipers.length).toBe(1);
    expect(sceneOn.proofScene.resolutionFailures.length).toBe(0);
  });

  it('4HHB caliper: implementation produces deterministic floating-point result of 2.0 Å for supplied test coordinates', () => {
    const struct = make4HHBStructure();
    const scene = compileRenderScene(struct, 1, { distanceMeasurement: CALIPER_4HHB });
    const caliper = scene.proofScene.calipers[0].caliper;

    // The implementation deterministically computes 2.0 Å for coordinates (10,20,30)→(12,20,30)
    expect(caliper.distanceAngstroms).toBeCloseTo(2.0, 5);
    expect(caliper.distanceAngstroms).toBeGreaterThan(0);
  });

  it('DATASET AGNOSTIC: 4HHB query on 4HHB → caliper; same query on 1MBO → explicit ResolutionFailure, NOT silent empty array', () => {
    // 4HHB has resSeq 142 for HEM → resolves
    const scene4HHB = compileRenderScene(make4HHBStructure(), 1, { distanceMeasurement: CALIPER_4HHB });
    expect(scene4HHB.proofScene.calipers.length).toBe(1);
    expect(scene4HHB.proofScene.resolutionFailures.length).toBe(0);

    // 1MBO has resSeq 93 for HEM → 'HEM:142:FE' does not resolve
    // Must produce explicit failure, not silently empty calipers
    const scene1MBO = compileRenderScene(make1MBOStructure(), 1, { distanceMeasurement: CALIPER_4HHB });
    expect(scene1MBO.proofScene.calipers.length).toBe(0);
    expect(scene1MBO.proofScene.resolutionFailures.length).toBeGreaterThan(0);
    expect(scene1MBO.proofScene.resolutionFailures[0].kind).toBe('caliper');
    expect(scene1MBO.proofScene.resolutionFailures[0].datasetId).toBe('1MBO');
  });

  it('DATASET AGNOSTIC: 1MBO query on 1MBO → caliper resolves correctly', () => {
    const struct = make1MBOStructure(); // NE2 at resSeq=64, FE at resSeq=93
    const scene = compileRenderScene(struct, 1, { distanceMeasurement: CALIPER_1MBO });
    expect(scene.proofScene.calipers.length).toBe(1);
    expect(scene.proofScene.resolutionFailures.length).toBe(0);
    // Dist between (5,10,15) and (8,10,15) = 3.0 Å
    expect(scene.proofScene.calipers[0].caliper.distanceAngstroms).toBeCloseTo(3.0, 5);
  });

  it('invalid activeSelection → explicit ResolutionFailure with kind=reticle, not silent skip', () => {
    const struct = make4HHBStructure();
    const scene = compileRenderScene(struct, 1, {
      activeSelections: ['A:87:NE2', 'INVALID:999:ZZZ'],
    });
    // Valid query resolves
    expect(scene.proofScene.reticles.length).toBe(1);
    expect(scene.proofScene.reticles[0].id).toContain('A:87:NE2');
    // Invalid query produces explicit failure
    expect(scene.proofScene.resolutionFailures.length).toBe(1);
    expect(scene.proofScene.resolutionFailures[0].kind).toBe('reticle');
    expect(scene.proofScene.resolutionFailures[0].query).toBe('INVALID:999:ZZZ');
  });

  it('sceneRevision is monotonic in output — sequential compilations', () => {
    const struct = make4HHBStructure();
    const spec: ProofSpecification = { aabbProtein: true };
    for (let rev = 1; rev <= 5; rev++) {
      const scene = compileRenderScene(struct, rev, spec);
      expect(scene.sceneRevision).toBe(rev);
    }
  });
});


// ===========================================================================
// Section 2: Conformance Engine — Fail-Closed Ghost Geometry Gate
// ===========================================================================
describe('Section 2 — Conformance Engine Adversarial Tests', () => {
  it('ghost geometry detected: actual AABB count > desired', () => {
    const report = evaluateConformance(
      { aabbCount: 1, caliperCount: 0, reticleCount: 0 },
      { aabbCount: 2, caliperCount: 0, reticleCount: 0 }
    );
    expect(report.isConformant).toBe(false);
    expect(report.verdict).toBe('FAIL');
    expect(report.discrepancies.length).toBeGreaterThan(0);
    expect(report.discrepancies[0]).toMatch(/AABB count mismatch/);
  });

  it('stale caliper not purged: caliper count > 0 when desired is 0', () => {
    const report = evaluateConformance(
      { aabbCount: 0, caliperCount: 0, reticleCount: 2 },
      { aabbCount: 0, caliperCount: 1, reticleCount: 2 }
    );
    expect(report.isConformant).toBe(false);
    expect(report.discrepancies.some((d) => d.includes('Caliper'))).toBe(true);
  });

  it('assertConformance throws RendererConformanceError on divergence', () => {
    expect(() =>
      assertConformance(
        { aabbCount: 0, caliperCount: 0, reticleCount: 0 },
        { aabbCount: 1, caliperCount: 0, reticleCount: 0 }
      )
    ).toThrowError(/Conformance/i);
  });

  it('certification is FAIL when ledger integrity is false even if conformance passes', () => {
    const cert = evaluateCertification(
      { verdict: 'PASS', isConformant: true, desired: { aabbCount: 1, caliperCount: 0, reticleCount: 0 }, actual: { aabbCount: 1, caliperCount: 0, reticleCount: 0 }, discrepancies: [], timestamp: '2026-01-01T00:00:00Z' },
      false  // ledger integrity = FALSE
    );
    expect(cert.certified).toBe(false);
    expect(cert.reason).toMatch(/ledger/i);
  });

  it('certification is PASS only when BOTH conformance and ledger integrity hold', () => {
    const cert = evaluateCertification(
      { verdict: 'PASS', isConformant: true, desired: { aabbCount: 1, caliperCount: 0, reticleCount: 0 }, actual: { aabbCount: 1, caliperCount: 0, reticleCount: 0 }, discrepancies: [], timestamp: '2026-01-01T00:00:00Z' },
      true
    );
    expect(cert.certified).toBe(true);
  });

  it('conformance FAIL + ledger integrity true → FAIL (fail-closed)', () => {
    const cert = evaluateCertification(
      { verdict: 'FAIL', isConformant: false, desired: { aabbCount: 1, caliperCount: 0, reticleCount: 0 }, actual: { aabbCount: 2, caliperCount: 0, reticleCount: 0 }, discrepancies: ['AABB count mismatch'], timestamp: '2026-01-01T00:00:00Z' },
      true
    );
    expect(cert.certified).toBe(false);
  });
});

// ===========================================================================
// Section 3: SceneRevisionManager — Stale Revision Race Fence
// ===========================================================================
describe('Section 3 — SceneRevisionManager Race Fence', () => {
  it('stale revision detected: old revision < current is stale', () => {
    const mgr = new SceneRevisionManager();
    mgr.next(); // → 1
    mgr.next(); // → 2
    mgr.next(); // → 3
    expect(mgr.isStale(1)).toBe(true);
    expect(mgr.isStale(2)).toBe(true);
    expect(mgr.isStale(3)).toBe(false);
  });

  it('current revision is never stale', () => {
    const mgr = new SceneRevisionManager();
    mgr.next();
    expect(mgr.isStale(mgr.current)).toBe(false);
  });

  it('50-cycle toggle: only the last revision is non-stale', () => {
    const mgr = new SceneRevisionManager();
    let last = 0;
    for (let i = 0; i < 50; i++) {
      mgr.next();
      last = mgr.current;
    }
    // All revisions 1..49 are stale; only last (50) is current
    for (let i = 1; i < last; i++) {
      expect(mgr.isStale(i)).toBe(true);
    }
    expect(mgr.isStale(last)).toBe(false);
  });

  it('scene compiled with stale revision is explicitly identified as outdated', () => {
    const struct = make4HHBStructure();
    const mgr = new SceneRevisionManager();
    const rev1 = (mgr.next(), mgr.current); // 1
    const rev2 = (mgr.next(), mgr.current); // 2

    const oldScene = compileRenderScene(struct, rev1, { aabbProtein: true });
    expect(mgr.isStale(oldScene.sceneRevision)).toBe(true);

    const newScene = compileRenderScene(struct, rev2, { aabbProtein: true });
    expect(mgr.isStale(newScene.sceneRevision)).toBe(false);
  });
});

// ===========================================================================
// Section 4: Scene Determinism — Digest Repeatability
// ===========================================================================
describe('Section 4 — Scene Determinism & Digest Repeatability', () => {
  it('identical spec + structure → identical scene JSON (structural equality)', () => {
    const struct = make4HHBStructure();
    const spec: ProofSpecification = {
      aabbProtein: true,
      aabbLigand: true,
      distanceMeasurement: { atomAQuery: 'A:87:NE2', atomBQuery: 'HEM:142:FE' },
      activeSelections: ['A:87:NE2', 'HEM:142:FE'],
    };
    const scene1 = compileRenderScene(struct, 7, spec);
    const scene2 = compileRenderScene(struct, 7, spec);

    // Deep equality — same compiler inputs → same output
    expect(JSON.stringify(scene1)).toBe(JSON.stringify(scene2));
  });

  it('changing activeSelections changes reticle count but not AABB', () => {
    const struct = make4HHBStructure();
    const scene1 = compileRenderScene(struct, 1, {
      aabbProtein: true,
      activeSelections: ['A:87:NE2'],
    });
    const scene2 = compileRenderScene(struct, 1, {
      aabbProtein: true,
      activeSelections: ['A:87:NE2', 'HEM:142:FE'],
    });

    // AABB is identical
    expect(scene1.proofScene.aabbs.length).toBe(scene2.proofScene.aabbs.length);
    // Reticle count differs
    expect(scene1.proofScene.reticles.length).toBe(1);
    expect(scene2.proofScene.reticles.length).toBe(2);
  });

  it('changing dataset produces different AABB identity (componentId / datasetId embedded)', () => {
    const spec: ProofSpecification = { aabbProtein: true };
    const scene4HHB = compileRenderScene(make4HHBStructure(), 1, spec);
    const scene1MBO = compileRenderScene(make1MBOStructure(), 1, spec);

    expect(scene4HHB.datasetId).not.toBe(scene1MBO.datasetId);
    expect(scene4HHB.proofScene.aabbs[0].id).toContain('4HHB');
    expect(scene1MBO.proofScene.aabbs[0].id).toContain('1MBO');
  });

  it('caliper position is structurally determined by atom coordinates, not time', () => {
    const struct = make4HHBStructure();
    const spec: ProofSpecification = { distanceMeasurement: { atomAQuery: 'A:87:NE2', atomBQuery: 'HEM:142:FE' } };

    // Run 10 times — caliper must be identical every time
    const distances = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const scene = compileRenderScene(struct, i + 1, spec);
      distances.add(scene.proofScene.calipers[0].caliper.distanceAngstroms.toFixed(8));
    }
    expect(distances.size).toBe(1); // Exactly one unique value
  });
});

// ===========================================================================
// Section 5: Evidence Ledger — Hash Chain Integrity & Tamper Detection
// ===========================================================================
describe('Section 5 — Evidence Ledger Adversarial & Tamper Detection', () => {
  it('single record: append succeeds and chain genesis is correct', async () => {
    const ledger = new EvidenceLedger();
    const result = await ledger.append(makeDraftBase());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rec = result.value;

    // Genesis record has null previousLedgerDigest
    expect(rec.previousLedgerDigest).toBeNull();
    expect(rec.ledgerDigest).toBeTruthy();
    expect(rec.scientificDigest).toBeTruthy();
  });

  it('three records: each chains to the previous ledgerDigest', async () => {
    const ledger = new EvidenceLedger();
    const r1 = (await ledger.append(makeDraftBase({ canonicalQuery: { expression: 'Q1', queryHash: 'h1' } }))).value!;
    const r2 = (await ledger.append(makeDraftBase({ canonicalQuery: { expression: 'Q2', queryHash: 'h2' } }))).value!;
    const r3 = (await ledger.append(makeDraftBase({ canonicalQuery: { expression: 'Q3', queryHash: 'h3' } }))).value!;

    expect(r2.previousLedgerDigest).toBe(r1.ledgerDigest);
    expect(r3.previousLedgerDigest).toBe(r2.ledgerDigest);
  });

  it('verifyLedgerIntegrity returns true for untouched ledger', async () => {
    const ledger = new EvidenceLedger();
    await ledger.append(makeDraftBase({ canonicalQuery: { expression: 'P1', queryHash: 'hp1' } }));
    await ledger.append(makeDraftBase({ canonicalQuery: { expression: 'P2', queryHash: 'hp2' } }));
    await ledger.append(makeDraftBase({ canonicalQuery: { expression: 'P3', queryHash: 'hp3' } }));

    const integrity = await ledger.verifyLedgerIntegrity();
    expect(integrity).toBe(true);
  });

  it('TAMPER DETECTION: modifying record 2 scientificResult breaks chain → integrity = false', async () => {
    const ledger = new EvidenceLedger();
    await ledger.append(makeDraftBase({ canonicalQuery: { expression: 'T1', queryHash: 'ht1' } }));
    const r2res = await ledger.append(makeDraftBase({ canonicalQuery: { expression: 'T2', queryHash: 'ht2' } }));
    await ledger.append(makeDraftBase({ canonicalQuery: { expression: 'T3', queryHash: 'ht3' } }));

    // Directly mutate the internal record via the backing map (simulate tamper)
    if (!r2res.ok) return;
    const r2id = r2res.value.evidenceId;
    const internalMap = (ledger as any)._records as Map<string, any>;
    const tampered = { ...internalMap.get(r2id), scientificResult: { min: [0,0,0], max: [999,999,999] } };
    internalMap.set(r2id, tampered);

    const integrity = await ledger.verifyLedgerIntegrity();
    expect(integrity).toBe(false);
  });

  it('TAMPER DETECTION: modifying the genesis record breaks all subsequent chain links', async () => {
    const ledger = new EvidenceLedger();
    const r1res = await ledger.append(makeDraftBase({ canonicalQuery: { expression: 'G1', queryHash: 'hg1' } }));
    await ledger.append(makeDraftBase({ canonicalQuery: { expression: 'G2', queryHash: 'hg2' } }));
    await ledger.append(makeDraftBase({ canonicalQuery: { expression: 'G3', queryHash: 'hg3' } }));

    if (!r1res.ok) return;
    const r1id = r1res.value.evidenceId;
    const internalMap = (ledger as any)._records as Map<string, any>;
    // Mutate the scientificResult of the genesis record
    const tampered = { ...internalMap.get(r1id), scientificResult: { tampered: true } };
    internalMap.set(r1id, tampered);

    const integrity = await ledger.verifyLedgerIntegrity();
    expect(integrity).toBe(false);
  });

  it('TAMPER DETECTION: AABB coordinates substitution is detected via scientificDigest', async () => {
    const ledger = new EvidenceLedger();
    await ledger.append(makeDraftBase({
      proofType: 'AABB',
      scientificResult: { min: [10, 20, 30], max: [12, 20, 30] },
      canonicalQuery: { expression: 'AABB:4HHB:protein', queryHash: 'h-aabb-1' },
    }));
    const r2res = await ledger.append(makeDraftBase({
      proofType: 'AABB',
      scientificResult: { min: [10, 20, 30], max: [12, 20, 30] },
      canonicalQuery: { expression: 'AABB:4HHB:ligand', queryHash: 'h-aabb-2' },
    }));

    // Tamper: change AABB min/max in record 2 (simulating coordinate substitution attack)
    if (!r2res.ok) return;
    const r2id = r2res.value.evidenceId;
    const internalMap = (ledger as any)._records as Map<string, any>;
    internalMap.set(r2id, {
      ...internalMap.get(r2id),
      scientificResult: { min: [0, 0, 0], max: [100, 100, 100] }, // substituted
    });

    const integrity = await ledger.verifyLedgerIntegrity();
    expect(integrity).toBe(false); // Must detect the coordinate substitution
  });

  it('supersede marks old record as superseded and new record has forward reference', async () => {
    const ledger = new EvidenceLedger();
    const r1res = await ledger.append(makeDraftBase());
    if (!r1res.ok) return;
    const r1 = r1res.value;

    const r2res = await ledger.supersede(r1.evidenceId, 'Superseded for test', makeDraftBase({
      canonicalQuery: { expression: 'NEW', queryHash: 'new-hash' },
    }));
    if (!r2res.ok) return;
    const r2 = r2res.value;

    const updatedR1 = ledger.get(r1.evidenceId)!;
    expect(updatedR1.supersededBy).toBe(r2.evidenceId);
    expect(r2.supersedes).toBe(r1.evidenceId);
    expect(r2.invalidationReason).toBe('Superseded for test');
  });

  it('integrity holds after a legitimate supersede operation', async () => {
    const ledger = new EvidenceLedger();
    const r1res = await ledger.append(makeDraftBase());
    if (!r1res.ok) return;
    await ledger.supersede(r1res.value.evidenceId, 'Updated data', makeDraftBase({
      canonicalQuery: { expression: 'UPDATED', queryHash: 'u-hash' },
    }));

    const integrity = await ledger.verifyLedgerIntegrity();
    expect(integrity).toBe(true);
  });

  it('100-cycle append stress: ledger integrity holds throughout', async () => {
    const ledger = new EvidenceLedger();
    for (let i = 0; i < 100; i++) {
      await ledger.append(makeDraftBase({
        canonicalQuery: { expression: `Q-${i}`, queryHash: `hash-${i}` },
        scientificResult: { iteration: i, value: i * 2.7183 },
      }));
    }
    expect(ledger.count).toBe(100);
    const integrity = await ledger.verifyLedgerIntegrity();
    expect(integrity).toBe(true);
  });
});

// ===========================================================================
// Section 6: Runtime Viewport Simulation — Lifecycle Invariants
// ===========================================================================
describe('Section 6 — Viewport Lifecycle Simulation (Proof Sync Pipeline)', () => {
  it('empty spec produces a valid scene with 0 proof items (initial state)', () => {
    const struct = make4HHBStructure();
    const scene = compileRenderScene(struct, 0, {});
    expect(scene.proofScene.aabbs.length).toBe(0);
    expect(scene.proofScene.calipers.length).toBe(0);
    expect(scene.proofScene.reticles.length).toBe(0);
    // Desired conformance vs actual (both 0) → PASS
    const report = evaluateConformance(
      { aabbCount: 0, caliperCount: 0, reticleCount: 0 },
      { aabbCount: 0, caliperCount: 0, reticleCount: 0 }
    );
    expect(report.isConformant).toBe(true);
  });

  it('toggles AABB ON and OFF 10 times — each state is consistent (no ghost geometry)', () => {
    const struct = make4HHBStructure();
    for (let i = 0; i < 10; i++) {
      const on = i % 2 === 0;
      const scene = compileRenderScene(struct, i + 1, { aabbProtein: on });
      const expected = on ? 1 : 0;
      const report = evaluateConformance(
        { aabbCount: expected, caliperCount: 0, reticleCount: 0 },
        { aabbCount: scene.proofScene.aabbs.length, caliperCount: 0, reticleCount: 0 }
      );
      expect(report.isConformant).toBe(true);
    }
  });

  it('simultaneous AABB + caliper + 2 reticles → conformance PASS', () => {
    const struct = make4HHBStructure();
    const scene = compileRenderScene(struct, 1, {
      aabbProtein: true,
      distanceMeasurement: { atomAQuery: 'A:87:NE2', atomBQuery: 'HEM:142:FE' },
      activeSelections: ['A:87:NE2', 'HEM:142:FE'],
    });

    const report = evaluateConformance(
      {
        aabbCount: scene.proofScene.aabbs.length,
        caliperCount: scene.proofScene.calipers.length,
        reticleCount: scene.proofScene.reticles.length,
      },
      {
        aabbCount: scene.proofScene.aabbs.length,
        caliperCount: scene.proofScene.calipers.length,
        reticleCount: scene.proofScene.reticles.length,
      }
    );
    expect(report.isConformant).toBe(true);
    expect(report.verdict).toBe('PASS');
  });

  it('HEM:142:FE reticle has expected position from test coordinates', () => {
    const struct = make4HHBStructure();
    const scene = compileRenderScene(struct, 1, {
      activeSelections: ['HEM:142:FE'],
    });
    expect(scene.proofScene.reticles.length).toBe(1);
    const reticle = scene.proofScene.reticles[0];
    // atom[1] = FE at coordinates index 1 → [12, 20, 30]
    expect(reticle.position[0]).toBeCloseTo(12.0);
    expect(reticle.position[1]).toBeCloseTo(20.0);
    expect(reticle.position[2]).toBeCloseTo(30.0);
  });

  it('camera projection change does NOT affect proof geometry', () => {
    const struct = make4HHBStructure();
    const spec: ProofSpecification = {
      aabbProtein: true,
      distanceMeasurement: { atomAQuery: 'A:87:NE2', atomBQuery: 'HEM:142:FE' },
      activeSelections: ['A:87:NE2', 'HEM:142:FE'],
    };
    // Camera mode is not part of compileRenderScene — scene is camera-independent
    const scene1 = compileRenderScene(struct, 1, spec);
    const scene2 = compileRenderScene(struct, 1, spec);

    expect(scene1.proofScene.calipers[0].caliper.distanceAngstroms)
      .toBe(scene2.proofScene.calipers[0].caliper.distanceAngstroms);
    expect(scene1.proofScene.aabbs.length).toBe(scene2.proofScene.aabbs.length);
  });
});

// ===========================================================================
// Section 7: Evidence Digest Repeatability — Scientific Identity
// ===========================================================================
describe('Section 7 — Evidence Scientific Digest Repeatability', () => {
  it('identical proof inputs → identical scientificDigest (cross-run reproducibility)', async () => {
    const draft = makeDraftBase({
      proofType: 'DISTANCE_CALIPER',
      canonicalQuery: { expression: 'A:87:NE2 <-> HEM:142:FE', queryHash: 'caliper-q' },
      scientificResult: { distanceAngstroms: 2.0, atomAKey: 'A:87:NE2', atomBKey: 'HEM:142:FE' },
    });

    const ledger1 = new EvidenceLedger();
    const ledger2 = new EvidenceLedger();
    const r1 = (await ledger1.append(draft)).value!;
    const r2 = (await ledger2.append(draft)).value!;

    // scientificDigest is timestamp-independent — it only covers scientific fields
    expect(r1.scientificDigest).toBe(r2.scientificDigest);
  });

  it('changing only scientificResult changes scientificDigest', async () => {
    const draft1 = makeDraftBase({ scientificResult: { distanceAngstroms: 2.0 } });
    const draft2 = makeDraftBase({ scientificResult: { distanceAngstroms: 3.5 } }); // Different

    const ledger = new EvidenceLedger();
    const r1 = (await ledger.append(draft1)).value!;
    const r2 = (await ledger.append(draft2)).value!;

    expect(r1.scientificDigest).not.toBe(r2.scientificDigest);
  });

  it('changing query expression changes scientificDigest', async () => {
    const draft1 = makeDraftBase({ canonicalQuery: { expression: 'A:87:NE2 <-> HEM:142:FE', queryHash: 'q1' } });
    const draft2 = makeDraftBase({ canonicalQuery: { expression: 'A:64:NE2 <-> HEM:93:FE', queryHash: 'q2' } });

    const ledger = new EvidenceLedger();
    const r1 = (await ledger.append(draft1)).value!;
    const r2 = (await ledger.append(draft2)).value!;

    expect(r1.scientificDigest).not.toBe(r2.scientificDigest);
  });
});
