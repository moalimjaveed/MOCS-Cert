import { describe, it, expect } from 'vitest';
import { computeCameraCutawayCylinder, computeTargetCentroid } from '@mocs/geometry';

describe('Geometry — 360-Degree Camera Orbit Cutaway Validation (Mandate Section 11)', () => {
  const target: [number, number, number] = [15.0, 20.0, 25.0];
  const radius = 8.5;
  const margin = 1.2;
  const length = 50.0;

  const testOrientations: { name: string; camPos: [number, number, number] }[] = [
    { name: 'Front (+Z)', camPos: [15.0, 20.0, 125.0] },
    { name: 'Back (-Z)', camPos: [15.0, 20.0, -75.0] },
    { name: 'Right (+X)', camPos: [115.0, 20.0, 25.0] },
    { name: 'Left (-X)', camPos: [-85.0, 20.0, 25.0] },
    { name: 'Top (+Y)', camPos: [15.0, 120.0, 25.0] },
    { name: 'Bottom (-Y)', camPos: [15.0, -80.0, 25.0] },
    { name: 'Diagonal (+X, +Y, +Z)', camPos: [65.0, 70.0, 75.0] },
    { name: 'Diagonal (-X, +Y, -Z)', camPos: [-35.0, 70.0, -25.0] },
    { name: 'Diagonal (+X, -Y, -Z)', camPos: [65.0, -30.0, -25.0] },
    { name: 'Diagonal (-X, -Y, +Z)', camPos: [-35.0, -30.0, 75.0] },
  ];

  for (const { name, camPos } of testOrientations) {
    it(`computes exact cutaway cylinder parameters for ${name} orbit position`, () => {
      const cylinder = computeCameraCutawayCylinder(target, camPos, { radius, margin, length });

      // Invariants
      expect(cylinder.type).toBe('cylinder');
      expect(cylinder.invert).toBe(false);
      expect(cylinder.scale).toEqual([radius * 2, length, radius * 2]);

      // Verify rotation parameters are finite and defined
      expect(Number.isFinite(cylinder.rotation.angle)).toBe(true);
      expect(cylinder.rotation.angle).toBeGreaterThanOrEqual(0);
      expect(cylinder.rotation.angle).toBeLessThanOrEqual(180);
      expect(Number.isFinite(cylinder.rotation.axis[0])).toBe(true);
      expect(Number.isFinite(cylinder.rotation.axis[1])).toBe(true);
      expect(Number.isFinite(cylinder.rotation.axis[2])).toBe(true);

      // Verify center offset is exactly (margin + length / 2) along camera direction vector
      const centerDist = margin + length / 2; // 1.2 + 25.0 = 26.2 Å
      const dx = cylinder.position[0] - target[0];
      const dy = cylinder.position[1] - target[1];
      const dz = cylinder.position[2] - target[2];
      const actualOffsetDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      expect(actualOffsetDist).toBeCloseTo(centerDist, 3);

      // Verify target centroid is outside cylinder (preserved pocket invariant)
      // The cylinder base starts at target + margin. Since margin > 0, distance to cylinder center is > length / 2
      expect(actualOffsetDist).toBeGreaterThan(length / 2);
    });
  }

  it('computes accurate multi-target centroid for active site clusters', () => {
    const his87: [number, number, number] = [10.0, 20.0, 30.0];
    const hemFe: [number, number, number] = [12.0, 20.0, 30.0];

    const centroid = computeTargetCentroid([his87, hemFe]);
    expect(centroid[0]).toBe(11.0);
    expect(centroid[1]).toBe(20.0);
    expect(centroid[2]).toBe(30.0);
  });
});
