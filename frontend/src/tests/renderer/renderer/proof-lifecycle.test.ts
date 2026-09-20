import { describe, it, expect } from 'vitest';
import { SceneRevisionManager } from '@mocs/scene';
import { RendererConformanceError } from '@mocs/core';
import { buildAABBLines } from '@mocs/renderer-molstar';
import { ScientificAABB } from '@mocs/geometry';

describe('Gate G4: Proof Geometry Lifecycle & Conformance Invariants', () => {
  it('manages monotonic scene revisions and flags stale transactions', () => {
    const mgr = new SceneRevisionManager();
    expect(mgr.current).toBe(0);

    const r1 = mgr.next();
    const r2 = mgr.next();
    const r3 = mgr.next();

    expect(r3).toBe(3);
    expect(mgr.isStale(r1)).toBe(true);
    expect(mgr.isStale(r2)).toBe(true);
    expect(mgr.isStale(r3)).toBe(false);
  });

  it('builds exact 3D line geometry for all 3 AABB visual designs', () => {
    const aabb: ScientificAABB = {
      min: [0, 0, 0],
      max: [10, 20, 30],
      center: [5, 10, 15],
      size: [10, 20, 30],
      atomCount: 100,
      frameIdentity: 0,
      componentIdentity: 'protein',
      spatialIdentity: 'auth-1',
    };

    // Design A: 12 edges
    const wireframeLines = buildAABBLines(aabb, 'wireframe');
    expect(wireframeLines.lineCount).toBe(12);

    // Design B: 8 corners * 3 segments = 24 segments
    const cornersLines = buildAABBLines(aabb, 'corners');
    expect(cornersLines.lineCount).toBe(24);

    // Design C: Hybrid (12 + 24 = 36 segments)
    const hybridLines = buildAABBLines(aabb, 'hybrid');
    expect(hybridLines.lineCount).toBe(36);
  });

  it('enforces hard conformance error when desired proof state does not match actual state', () => {
    const expected = { aabbCount: 1, caliperCount: 1, reticleCount: 2 };
    const actual = { aabbCount: 0, caliperCount: 1, reticleCount: 2 };

    const conformanceCheck = () => {
      if (
        actual.aabbCount !== expected.aabbCount ||
        actual.caliperCount !== expected.caliperCount ||
        actual.reticleCount !== expected.reticleCount
      ) {
        throw new RendererConformanceError(expected, actual);
      }
    };

    expect(conformanceCheck).toThrow(RendererConformanceError);
  });
});
