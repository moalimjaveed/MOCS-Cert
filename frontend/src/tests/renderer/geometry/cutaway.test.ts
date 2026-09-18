import { describe, it, expect } from 'vitest';
import { computeTargetCentroid, computeCameraCutawayCylinder } from '@mocs/geometry';

describe('Pocket Cutaway Geometry Engine', () => {
  it('computes 3D centroid of multiple target positions', () => {
    const p1: [number, number, number] = [-4.116, 12.183, 4.316];
    const p2: [number, number, number] = [-2.253, 13.064, 4.316];
    const centroid = computeTargetCentroid([p1, p2]);

    expect(centroid[0]).toBeCloseTo((-4.116 - 2.253) / 2, 4);
    expect(centroid[1]).toBeCloseTo((12.183 + 13.064) / 2, 4);
    expect(centroid[2]).toBeCloseTo(4.316, 4);
  });

  it('computes directional cutaway cylinder pointing from pocket to camera', () => {
    const target: [number, number, number] = [0, 0, 0];
    const cameraPos: [number, number, number] = [0, 0, 100]; // Looking down +Z axis
    const cylinder = computeCameraCutawayCylinder(target, cameraPos, {
      radius: 8.5,
      margin: 1.2,
      length: 50.0,
    });

    expect(cylinder.type).toBe('cylinder');
    expect(cylinder.invert).toBe(false);
    // Cylinder center should be target + d * (1.2 + 25.0) = [0, 0, 26.2]
    expect(cylinder.position[0]).toBeCloseTo(0, 4);
    expect(cylinder.position[1]).toBeCloseTo(0, 4);
    expect(cylinder.position[2]).toBeCloseTo(26.2, 4);

    // Scale: [2 * radius, length, 2 * radius] = [17, 50, 17]
    expect(cylinder.scale).toEqual([17, 50, 17]);

    // Direction vector is (0, 0, 1). Canonical cylinder is (0, 1, 0).
    // Angle between (0, 1, 0) and (0, 0, 1) is 90 degrees around X axis
    expect(cylinder.rotation.angle).toBeCloseTo(90, 2);
    expect(cylinder.rotation.axis[0]).toBeCloseTo(1, 4);
  });

  it('handles collinear viewing angles along Y axis without degenerate singularity', () => {
    const target: [number, number, number] = [0, 0, 0];
    const cameraTop: [number, number, number] = [0, 50, 0]; // Looking along +Y
    const cylinderTop = computeCameraCutawayCylinder(target, cameraTop);
    expect(cylinderTop.rotation.angle).toBe(0);

    const cameraBottom: [number, number, number] = [0, -50, 0]; // Looking along -Y
    const cylinderBottom = computeCameraCutawayCylinder(target, cameraBottom);
    expect(cylinderBottom.rotation.angle).toBe(180);
  });

  it('preserves target pocket by starting clip cylinder at margin offset', () => {
    const target: [number, number, number] = [10, 20, 30];
    const cameraPos: [number, number, number] = [10, 20, 130]; // 100 units away along +Z
    const cylinder = computeCameraCutawayCylinder(target, cameraPos, { margin: 2.0, length: 40 });

    // Distance from target to cylinder center is margin + length / 2 = 2 + 20 = 22
    expect(cylinder.position[2]).toBeCloseTo(30 + 22, 4);
  });
});
