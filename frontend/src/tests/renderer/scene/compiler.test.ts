import { describe, it, expect } from 'vitest';
import { compileRenderScene, ProofSpecification, DistanceMeasurementSpec } from '@mocs/scene';
import { CanonicalStructure } from '@mocs/core';

function createMockStructure(datasetId: string): CanonicalStructure {
  return {
    datasetId,
    topology: {
      atomCount: 2,
      atoms: [
        { index: 0, name: 'NE2', element: 'N', chain: 'A', resSeq: 87, resName: 'HIS', entityId: '1' },
        { index: 1, name: 'FE', element: 'FE', chain: 'A', resSeq: 142, resName: 'HEM', entityId: '1' },
      ],
      bonds: [],
    },
    models: [
      {
        modelNum: 1,
        atomCount: 2,
        coordinates: new Float64Array([
          10.0, 20.0, 30.0,
          12.0, 20.0, 30.0,
        ]),
      },
    ],
    components: [],
    assemblies: [],
    defaultModelIndex: 0,
  };
}

/** 1MBO-like structure with different residue numbers for the active site atoms */
function create1MBOStructure(): CanonicalStructure {
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
      coordinates: new Float64Array([5.0, 10.0, 15.0, 8.0, 10.0, 15.0]),
    }],
    components: [],
    assemblies: [],
    defaultModelIndex: 0,
  };
}

describe('Scene — Deterministic Scene Compiler', () => {
  it('determinism: identical inputs produce identical scene representations', () => {
    const struct = createMockStructure('4HHB');
    const spec: ProofSpecification = {
      aabbProtein: true,
      aabbLigand: true,
      distanceMeasurement: { atomAQuery: 'A:87:NE2', atomBQuery: 'HEM:142:FE' },
      activeSelections: ['A:87:NE2', 'HEM:142:FE'],
    };

    const scene1 = compileRenderScene(struct, 1, spec);
    const scene2 = compileRenderScene(struct, 1, spec);

    expect(scene1).toEqual(scene2);
    expect(scene1.proofScene.aabbs.length).toBe(2);
    expect(scene1.proofScene.calipers.length).toBe(1);
    expect(scene1.proofScene.reticles.length).toBe(2);
    // No resolution failures when all atoms exist
    expect(scene1.proofScene.resolutionFailures.length).toBe(0);
  });

  it('query sensitivity: different proof specification produces different scene', () => {
    const struct = createMockStructure('4HHB');
    const spec1: ProofSpecification = { aabbProtein: true, aabbLigand: false };
    const spec2: ProofSpecification = { aabbProtein: false, aabbLigand: true };

    const scene1 = compileRenderScene(struct, 1, spec1);
    const scene2 = compileRenderScene(struct, 1, spec2);

    expect(scene1.proofScene.aabbs[0].id).toContain('protein');
    expect(scene2.proofScene.aabbs[0].id).toContain('ligand');
    expect(scene1).not.toEqual(scene2);
  });

  it('dataset sensitivity: different dataset produces different component IDs and bounding boxes', () => {
    const struct1 = createMockStructure('4HHB');
    const struct2 = createMockStructure('1MBO');

    const scene1 = compileRenderScene(struct1, 1, { aabbProtein: true });
    const scene2 = compileRenderScene(struct2, 1, { aabbProtein: true });

    expect(scene1.datasetId).toBe('4HHB');
    expect(scene2.datasetId).toBe('1MBO');
    expect(scene1.molecularScene.objects[0].id).toContain('4HHB');
    expect(scene2.molecularScene.objects[0].id).toContain('1MBO');
  });
});

describe('Scene — Dataset-Agnostic Caliper (DistanceMeasurementSpec)', () => {
  it('4HHB: caliper resolves correctly when query matches actual residue numbers', () => {
    const struct = createMockStructure('4HHB');
    const spec: ProofSpecification = {
      distanceMeasurement: { atomAQuery: 'A:87:NE2', atomBQuery: 'HEM:142:FE' },
    };

    const scene = compileRenderScene(struct, 1, spec);
    expect(scene.proofScene.calipers.length).toBe(1);
    expect(scene.proofScene.resolutionFailures.length).toBe(0);
    // Dist between (10,20,30) and (12,20,30) = 2.0 Å
    expect(scene.proofScene.calipers[0].caliper.distanceAngstroms).toBeCloseTo(2.0, 5);
  });

  it('1MBO: caliper resolves correctly using 1MBO-specific residue numbers', () => {
    const struct = create1MBOStructure();
    const spec: ProofSpecification = {
      // 1MBO active site: His64 NE2 ↔ HEM93 FE
      distanceMeasurement: { atomAQuery: 'A:64:NE2', atomBQuery: 'HEM:93:FE' },
    };

    const scene = compileRenderScene(struct, 1, spec);
    expect(scene.proofScene.calipers.length).toBe(1);
    expect(scene.proofScene.resolutionFailures.length).toBe(0);
    // Dist between (5,10,15) and (8,10,15) = 3.0 Å
    expect(scene.proofScene.calipers[0].caliper.distanceAngstroms).toBeCloseTo(3.0, 5);
    expect(scene.proofScene.calipers[0].caliper.atomAKey).toBe('A:64:NE2');
    expect(scene.proofScene.calipers[0].caliper.atomBKey).toBe('HEM:93:FE');
  });

  it('EXPLICIT FAILURE: 4HHB query applied to 1MBO structure → explicit resolutionFailure, NOT silent empty array', () => {
    const struct = create1MBOStructure();  // 1MBO: resSeq 93 for HEM
    const spec: ProofSpecification = {
      // Intentionally wrong for 1MBO — 142 does not exist in 1MBO
      distanceMeasurement: { atomAQuery: 'A:87:NE2', atomBQuery: 'HEM:142:FE' },
    };

    const scene = compileRenderScene(struct, 1, spec);

    // No caliper — cannot compute
    expect(scene.proofScene.calipers.length).toBe(0);

    // BUT there must be explicit failure records — not silently empty
    expect(scene.proofScene.resolutionFailures.length).toBeGreaterThan(0);

    const failedQueries = scene.proofScene.resolutionFailures.map((f) => f.query);
    // At least one of the requested atoms must be flagged
    const anyFailed =
      failedQueries.some((q) => q.includes('NE2') || q.includes('FE') || q.includes('142'));
    expect(anyFailed).toBe(true);

    // Each failure records the correct dataset
    for (const failure of scene.proofScene.resolutionFailures) {
      expect(failure.datasetId).toBe('1MBO');
      expect(failure.kind).toBe('caliper');
      expect(failure.reason).toBeTruthy();
    }
  });

  it('EXPLICIT FAILURE: wrong atomA only → failure for atomA, atomB resolves fine → 0 calipers, 1 failure', () => {
    const struct = create1MBOStructure(); // resSeq 64 (NE2), 93 (FE)
    const spec: ProofSpecification = {
      // atomA query uses wrong resSeq (87 doesn't exist in 1MBO — it's 64)
      distanceMeasurement: { atomAQuery: 'A:87:NE2', atomBQuery: 'HEM:93:FE' },
    };

    const scene = compileRenderScene(struct, 1, spec);
    expect(scene.proofScene.calipers.length).toBe(0);
    expect(scene.proofScene.resolutionFailures.length).toBe(1);
    expect(scene.proofScene.resolutionFailures[0].query).toContain('87');
    expect(scene.proofScene.resolutionFailures[0].kind).toBe('caliper');
  });

  it('caliperItem.caliper.atomAKey and atomBKey reflect the supplied query strings', () => {
    const struct = createMockStructure('4HHB');
    const scene = compileRenderScene(struct, 1, {
      distanceMeasurement: { atomAQuery: 'A:87:NE2', atomBQuery: 'HEM:142:FE' },
    });
    const caliper = scene.proofScene.calipers[0].caliper;
    expect(caliper.atomAKey).toBe('A:87:NE2');
    expect(caliper.atomBKey).toBe('HEM:142:FE');
  });
});

describe('Scene — Reticle Resolution Failures', () => {
  it('valid reticle query → 1 reticle, 0 failures', () => {
    const struct = createMockStructure('4HHB');
    const scene = compileRenderScene(struct, 1, {
      activeSelections: ['A:87:NE2'],
    });
    expect(scene.proofScene.reticles.length).toBe(1);
    expect(scene.proofScene.resolutionFailures.length).toBe(0);
  });

  it('invalid reticle query → 0 reticles, 1 explicit failure with kind=reticle', () => {
    const struct = createMockStructure('4HHB');
    const scene = compileRenderScene(struct, 1, {
      activeSelections: ['Z:999:ZZZ'],
    });
    expect(scene.proofScene.reticles.length).toBe(0);
    expect(scene.proofScene.resolutionFailures.length).toBe(1);
    expect(scene.proofScene.resolutionFailures[0].kind).toBe('reticle');
    expect(scene.proofScene.resolutionFailures[0].query).toBe('Z:999:ZZZ');
    expect(scene.proofScene.resolutionFailures[0].datasetId).toBe('4HHB');
  });

  it('mixed valid/invalid selections → partial success + explicit failures', () => {
    const struct = createMockStructure('4HHB');
    const scene = compileRenderScene(struct, 1, {
      activeSelections: ['A:87:NE2', 'INVALID:999:ZZZ', 'HEM:142:FE'],
    });
    expect(scene.proofScene.reticles.length).toBe(2);       // 2 valid
    expect(scene.proofScene.resolutionFailures.length).toBe(1); // 1 explicit failure
    expect(scene.proofScene.resolutionFailures[0].query).toBe('INVALID:999:ZZZ');
  });
});
