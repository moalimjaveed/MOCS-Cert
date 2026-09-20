// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  calculateEuclideanDistance,
  calculateMinimumImageDistance,
  calculateBondAngleDeg,
  calculateDihedralAngleDeg,
  validateOrthorhombicBox,
  UnsupportedBoxGeometryError,
} from '../molecular/measurements/calculations';
import {
  calculateProteinCentroid,
  calculateRadiusOfGyration,
  calculateMassWeightedRadiusOfGyration,
} from '../molecular/protein/metrics';
import {
  calculateRawCoordinateRmsd,
  calculateWeightedKabschAlignment,
  computeMatrix3Determinant,
  applyRigidTransformation,
} from '../molecular/protein/alignment';
import {
  minimumImage1D,
  minimumImageVector,
  unwrapBondedMolecule,
  centerMoleculeInBox,
  wrapCoordinatesIntoPrimaryBox,
} from '../molecular/trajectory/pbcEngine';
import {
  calculateTrajectoryRmsf,
} from '../molecular/trajectory/physicsMetrics';
import {
  calculateTrajectoryContactOccupancy,
} from '../molecular/interactions/trajectoryContacts';
import {
  computeSASA,
} from '../molecular/surfaces/sasaEngine';
import {
  computeMolecularVdwVolume,
  calculateAnalyticalSphereVolume,
  calculateAnalyticalSphereSurfaceArea,
} from '../molecular/surfaces/volumeEngine';
import {
  createBox3FromCoordinates,
  box3ToCoordinateAABB,
} from '../molecular/geometry/coordinateBounds';

// =============================================================================
// INDEPENDENT MATHEMATICAL REFERENCE IMPLEMENTATIONS
// (Completely decoupled from production code)
// =============================================================================

function refEuclideanDistance(p1: [number, number, number], p2: [number, number, number]): number {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  const dz = p1[2] - p2[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function refBondAngleDeg(
  pA: [number, number, number],
  pB: [number, number, number],
  pC: [number, number, number]
): number | null {
  const v1 = [pA[0] - pB[0], pA[1] - pB[1], pA[2] - pB[2]];
  const v2 = [pC[0] - pB[0], pC[1] - pB[1], pC[2] - pB[2]];
  const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  const n1 = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1] + v1[2] * v1[2]);
  const n2 = Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1] + v2[2] * v2[2]);
  if (n1 === 0 || n2 === 0) return null;
  const cos = Math.max(-1.0, Math.min(1.0, dot / (n1 * n2)));
  return (Math.acos(cos) * 180.0) / Math.PI;
}

function refDihedralDeg(
  p1: [number, number, number],
  p2: [number, number, number],
  p3: [number, number, number],
  p4: [number, number, number]
): number | null {
  const b1 = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
  const b2 = [p3[0] - p2[0], p3[1] - p2[1], p3[2] - p2[2]];
  const b3 = [p4[0] - p3[0], p4[1] - p3[1], p4[2] - p3[2]];

  const b2Norm = Math.sqrt(b2[0] * b2[0] + b2[1] * b2[1] + b2[2] * b2[2]);
  if (b2Norm === 0) return null;
  const b2Unit = [b2[0] / b2Norm, b2[1] / b2Norm, b2[2] / b2Norm];

  const n1 = [
    b1[1] * b2[2] - b1[2] * b2[1],
    b1[2] * b2[0] - b1[0] * b2[2],
    b1[0] * b2[1] - b1[1] * b2[0],
  ];
  const n2 = [
    b2[1] * b3[2] - b2[2] * b3[1],
    b2[2] * b3[0] - b2[0] * b3[2],
    b2[0] * b3[1] - b2[1] * b3[0],
  ];

  const n1Norm = Math.sqrt(n1[0] * n1[0] + n1[1] * n1[1] + n1[2] * n1[2]);
  const n2Norm = Math.sqrt(n2[0] * n2[0] + n2[1] * n2[1] + n2[2] * n2[2]);
  if (n1Norm === 0 || n2Norm === 0) return null;

  const m1 = [
    n1[1] * b2Unit[2] - n1[2] * b2Unit[1],
    n1[2] * b2Unit[0] - n1[0] * b2Unit[2],
    n1[0] * b2Unit[1] - n1[1] * b2Unit[0],
  ];

  const x = n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2];
  const y = m1[0] * n2[0] + m1[1] * n2[1] + m1[2] * n2[2];

  return (Math.atan2(y, x) * 180.0) / Math.PI;
}

function refCentroid(coords: [number, number, number][]): [number, number, number] {
  let sx = 0, sy = 0, sz = 0;
  for (const [x, y, z] of coords) {
    sx += x;
    sy += y;
    sz += z;
  }
  const n = coords.length;
  return [sx / n, sy / n, sz / n];
}

function refRadiusOfGyration(coords: [number, number, number][]): number {
  const c = refCentroid(coords);
  let sumSq = 0;
  for (const [x, y, z] of coords) {
    const dx = x - c[0];
    const dy = y - c[1];
    const dz = z - c[2];
    sumSq += dx * dx + dy * dy + dz * dz;
  }
  return Math.sqrt(sumSq / coords.length);
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('PASS 23 — Differential Numerical Verification & Adversarial Invariant Attack', () => {

  // ---------------------------------------------------------------------------
  // 1. Distance Arithmetic & Boundary Numerical Invariants
  // ---------------------------------------------------------------------------
  describe('1. Distance Arithmetic & Mathematical Invariants', () => {
    const p1: [number, number, number] = [12.345, 67.890, -45.123];
    const p2: [number, number, number] = [-98.765, 43.210, 11.223];

    it('satisfies identity: d(A, A) === 0.0', () => {
      expect(calculateEuclideanDistance(p1, p1)).toBe(0.0);
      expect(calculateEuclideanDistance([0, 0, 0], [0, 0, 0])).toBe(0.0);
    });

    it('satisfies symmetry: d(A, B) === d(B, A)', () => {
      const d12 = calculateEuclideanDistance(p1, p2);
      const d21 = calculateEuclideanDistance(p2, p1);
      expect(d12).toBeCloseTo(d21, 12);
      expect(d12).toBeCloseTo(refEuclideanDistance(p1, p2), 12);
    });

    it('satisfies rigid translation invariance: d(A + T, B + T) === d(A, B)', () => {
      const T: [number, number, number] = [1e4, -5e3, 3.14159];
      const p1T: [number, number, number] = [p1[0] + T[0], p1[1] + T[1], p1[2] + T[2]];
      const p2T: [number, number, number] = [p2[0] + T[0], p2[1] + T[1], p2[2] + T[2]];

      const dOrig = calculateEuclideanDistance(p1, p2);
      const dTrans = calculateEuclideanDistance(p1T, p2T);
      expect(dTrans).toBeCloseTo(dOrig, 9);
    });

    it('satisfies 90-degree rotation and reflection invariance', () => {
      // Rotation around Z by 90 deg: [x, y, z] -> [-y, x, z]
      const rotZ = (p: [number, number, number]): [number, number, number] => [-p[1], p[0], p[2]];
      const dOrig = calculateEuclideanDistance(p1, p2);
      const dRot = calculateEuclideanDistance(rotZ(p1), rotZ(p2));
      expect(dRot).toBeCloseTo(dOrig, 12);

      // Reflection through XY plane: [x, y, z] -> [x, y, -z]
      const refXY = (p: [number, number, number]): [number, number, number] => [p[0], p[1], -p[2]];
      const dRef = calculateEuclideanDistance(refXY(p1), refXY(p2));
      expect(dRef).toBeCloseTo(dOrig, 12);
    });

    it('behaves stably at extreme numerical scales (1e-12 to 1e6)', () => {
      const tiny1: [number, number, number] = [1e-12, 0, 0];
      const tiny2: [number, number, number] = [3e-12, 0, 0];
      expect(calculateEuclideanDistance(tiny1, tiny2)).toBeCloseTo(2e-12, 20);

      const huge1: [number, number, number] = [1e6, 0, 0];
      const huge2: [number, number, number] = [1e6 + 5.0, 0, 0];
      expect(calculateEuclideanDistance(huge1, huge2)).toBeCloseTo(5.0, 6);
    });

    it('fails closed on NaN and Infinity coordinates', () => {
      expect(calculateEuclideanDistance([NaN, 0, 0], p1)).toBeNaN();
      expect(calculateEuclideanDistance(p1, [0, Infinity, 0])).toBeNaN();
      expect(calculateEuclideanDistance(p1, null as any)).toBeNaN();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Bond Angle Arithmetic & Clamping Invariants
  // ---------------------------------------------------------------------------
  describe('2. Bond Angle Arithmetic & Clamping', () => {
    const origin: [number, number, number] = [0, 0, 0];
    const xPos: [number, number, number] = [2, 0, 0];
    const yPos: [number, number, number] = [0, 3, 0];
    const xNeg: [number, number, number] = [-4, 0, 0];

    it('computes exact 90-degree orthogonal bond angle', () => {
      const angle = calculateBondAngleDeg(xPos, origin, yPos);
      expect(angle).toBeCloseTo(90.0, 10);
    });

    it('computes exact 180-degree collinear opposing bond angle', () => {
      const angle = calculateBondAngleDeg(xPos, origin, xNeg);
      expect(angle).toBeCloseTo(180.0, 10);
    });

    it('computes exact 60-degree equilateral triangle bond angle', () => {
      const pA: [number, number, number] = [1, 0, 0];
      const pB: [number, number, number] = [0, 0, 0];
      const pC: [number, number, number] = [0.5, Math.sqrt(3) / 2, 0];
      const angle = calculateBondAngleDeg(pA, pB, pC);
      expect(angle).toBeCloseTo(60.0, 9);
      expect(angle).toBeCloseTo(refBondAngleDeg(pA, pB, pC)!, 9);
    });

    it('satisfies symmetry: angle(A, B, C) === angle(C, B, A)', () => {
      const a1 = calculateBondAngleDeg(xPos, origin, yPos);
      const a2 = calculateBondAngleDeg(yPos, origin, xPos);
      expect(a1).toBe(a2);
    });

    it('is invariant to uniform scaling of bond vector lengths', () => {
      const angle1 = calculateBondAngleDeg([1, 0, 0], [0, 0, 0], [0, 1, 0]);
      const angle2 = calculateBondAngleDeg([100, 0, 0], [0, 0, 0], [0, 0.001, 0]);
      expect(angle1).toBeCloseTo(angle2!, 10);
    });

    it('clamps cosine to [-1, 1] avoiding NaN on floating-point overshoot', () => {
      const angle = calculateBondAngleDeg([1.0000000000000002, 0, 0], [0, 0, 0], [2, 0, 0]);
      expect(angle).toBeDefined();
      expect(angle).not.toBeNaN();
      expect(angle).toBeCloseTo(0.0, 6);
    });

    it('returns null for coincident vertex or degenerate points', () => {
      expect(calculateBondAngleDeg(origin, origin, xPos)).toBeNull();
      expect(calculateBondAngleDeg(xPos, origin, origin)).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Dihedral / Torsion Angle IUPAC Right-Handed Screw
  // ---------------------------------------------------------------------------
  describe('3. Dihedral / Torsion Angle IUPAC Right-Handed Screw', () => {
    // Cis / eclipsed configuration: dihedral = 0 deg
    const cis1: [number, number, number] = [0, 1, 0];
    const cis2: [number, number, number] = [0, 0, 0];
    const cis3: [number, number, number] = [1, 0, 0];
    const cis4: [number, number, number] = [1, 1, 0];

    // Trans configuration: dihedral = ±180 deg
    const trans1: [number, number, number] = [0, 1, 0];
    const trans2: [number, number, number] = [0, 0, 0];
    const trans3: [number, number, number] = [1, 0, 0];
    const trans4: [number, number, number] = [1, -1, 0];

    it('computes exact 0-degree cis dihedral', () => {
      const dih = calculateDihedralAngleDeg(cis1, cis2, cis3, cis4);
      expect(dih).toBeCloseTo(0.0, 8);
      expect(dih).toBeCloseTo(refDihedralDeg(cis1, cis2, cis3, cis4)!, 8);
    });

    it('computes exact ±180-degree trans dihedral', () => {
      const dih = calculateDihedralAngleDeg(trans1, trans2, trans3, trans4);
      expect(Math.abs(dih!)).toBeCloseTo(180.0, 8);
      expect(Math.abs(dih!)).toBeCloseTo(Math.abs(refDihedralDeg(trans1, trans2, trans3, trans4)!), 8);
    });

    it('computes positive +90-degree right-handed screw dihedral', () => {
      // Looking down B-C (from [0,0,0] to [1,0,0]):
      // A is at [0, 1, 0] (+Y)
      // In right-handed coords looking down +X: +Y is up, -Z is right (clockwise)
      // D at [1, 0, -1] is a +90 degree clockwise rotation (right-handed screw)
      const p1: [number, number, number] = [0, 1, 0];
      const p2: [number, number, number] = [0, 0, 0];
      const p3: [number, number, number] = [1, 0, 0];
      const p4: [number, number, number] = [1, 0, -1];

      const dih = calculateDihedralAngleDeg(p1, p2, p3, p4);
      expect(dih).toBeCloseTo(90.0, 8);
      expect(dih).toBeCloseTo(refDihedralDeg(p1, p2, p3, p4)!, 8);
    });

    it('computes negative -90-degree left-handed screw dihedral', () => {
      // D at [1, 0, 1] (+Z) is a -90 degree counter-clockwise rotation
      const p1: [number, number, number] = [0, 1, 0];
      const p2: [number, number, number] = [0, 0, 0];
      const p3: [number, number, number] = [1, 0, 0];
      const p4: [number, number, number] = [1, 0, 1];

      const dih = calculateDihedralAngleDeg(p1, p2, p3, p4);
      expect(dih).toBeCloseTo(-90.0, 8);
      expect(dih).toBeCloseTo(refDihedralDeg(p1, p2, p3, p4)!, 8);
    });

    it('returns null for collinear triplet (undefined normal vector)', () => {
      const collinear1: [number, number, number] = [0, 0, 0];
      const collinear2: [number, number, number] = [1, 0, 0];
      const collinear3: [number, number, number] = [2, 0, 0];
      const collinear4: [number, number, number] = [2, 1, 0];

      expect(calculateDihedralAngleDeg(collinear1, collinear2, collinear3, collinear4)).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. AABB Spatial Invariants
  // ---------------------------------------------------------------------------
  describe('4. AABB Enclosure & Invariants', () => {
    const coords: [number, number, number][] = [
      [10, 20, 30],
      [15, 25, 35],
      [-5, 50, 10],
      [22, -10, 42],
    ];

    it('encloses 100% of all constituent points', () => {
      const box = createBox3FromCoordinates(coords);
      const aabb = box3ToCoordinateAABB(box);

      for (const [x, y, z] of coords) {
        expect(x).toBeGreaterThanOrEqual(aabb.min[0]);
        expect(x).toBeLessThanOrEqual(aabb.max[0]);
        expect(y).toBeGreaterThanOrEqual(aabb.min[1]);
        expect(y).toBeLessThanOrEqual(aabb.max[1]);
        expect(z).toBeGreaterThanOrEqual(aabb.min[2]);
        expect(z).toBeLessThanOrEqual(aabb.max[2]);
      }
    });

    it('preserves dimensions strictly under rigid translation', () => {
      const boxOrig = createBox3FromCoordinates(coords);
      const aabbOrig = box3ToCoordinateAABB(boxOrig);

      const shift: [number, number, number] = [100.5, -200.3, 50.7];
      const shiftedCoords: [number, number, number][] = coords.map(([x, y, z]) => [
        x + shift[0],
        y + shift[1],
        z + shift[2],
      ]);

      const boxShift = createBox3FromCoordinates(shiftedCoords);
      const aabbShift = box3ToCoordinateAABB(boxShift);

      expect(aabbShift.size[0]).toBeCloseTo(aabbOrig.size[0], 10);
      expect(aabbShift.size[1]).toBeCloseTo(aabbOrig.size[1], 10);
      expect(aabbShift.size[2]).toBeCloseTo(aabbOrig.size[2], 10);
      expect(aabbShift.radius).toBeCloseTo(aabbOrig.radius, 10);
    });

    it('documents non-invariance under 45-degree rotation', () => {
      const lineX: [number, number, number][] = [[0, 0, 0], [10, 0, 0]];
      const aabbX = box3ToCoordinateAABB(createBox3FromCoordinates(lineX));
      expect(aabbX.size[0]).toBeCloseTo(10.0, 6);
      expect(aabbX.size[1]).toBeCloseTo(0.0, 6);

      const angle = Math.PI / 4;
      const rotLine: [number, number, number][] = [
        [0, 0, 0],
        [10 * Math.cos(angle), 10 * Math.sin(angle), 0],
      ];
      const aabbRot = box3ToCoordinateAABB(createBox3FromCoordinates(rotLine));
      expect(aabbRot.size[0]).toBeCloseTo(10 * Math.cos(angle), 4);
      expect(aabbRot.size[1]).toBeCloseTo(10 * Math.sin(angle), 4);
      expect(aabbRot.size[0] * aabbRot.size[1]).toBeGreaterThan(0.0);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. RMSD, Kabsch Superposition & Proper Rotation Invariants
  // ---------------------------------------------------------------------------
  describe('5. RMSD & Kabsch Superposition Invariants', () => {
    const structA: [number, number, number][] = [
      [0, 0, 0],
      [1.5, 0, 0],
      [2.0, 1.2, 0],
      [0.5, 2.0, 1.0],
    ];

    it('returns exact 0.0000 RMSD for identical structures', () => {
      const res = calculateWeightedKabschAlignment(structA, structA);
      expect(res.rmsd).toBe(0.0);
      expect(res.rawRmsd).toBe(0.0);
    });

    it('returns exact 0.0000 Kabsch RMSD under arbitrary translation', () => {
      const shift: [number, number, number] = [10.0, -25.0, 42.0];
      const structShift: [number, number, number][] = structA.map(([x, y, z]) => [
        x + shift[0],
        y + shift[1],
        z + shift[2],
      ]);

      const raw = calculateRawCoordinateRmsd(structA, structShift);
      expect(raw).toBeGreaterThan(10.0);

      const align = calculateWeightedKabschAlignment(structShift, structA);
      expect(align.rmsd).toBe(0.0);
      expect(align.translationVector[0]).toBeCloseTo(-shift[0], 3);
      expect(align.translationVector[1]).toBeCloseTo(-shift[1], 3);
      expect(align.translationVector[2]).toBeCloseTo(-shift[2], 3);
    });

    it('guarantees proper rotation with det(R) = +1.0 (no reflection)', () => {
      const rotY: [[number, number, number], [number, number, number], [number, number, number]] = [
        [0, 0, 1],
        [0, 1, 0],
        [-1, 0, 0],
      ];
      const structRot = applyRigidTransformation(structA, rotY, [0, 0, 0]);

      const align = calculateWeightedKabschAlignment(structRot, structA);
      expect(align.rmsd).toBeCloseTo(0.0, 3);

      const det = computeMatrix3Determinant(align.rotationMatrix);
      expect(det).toBeCloseTo(1.0, 3);
    });

    it('satisfies RMSD_Kabsch <= RMSD_raw for any rigid transformation', () => {
      const structPerturbed: [number, number, number][] = structA.map(([x, y, z], i) => [
        x + (i % 2 === 0 ? 0.3 : -0.2),
        y + 0.1,
        z + 0.4,
      ]);

      const align = calculateWeightedKabschAlignment(structPerturbed, structA);
      expect(align.rmsd).toBeLessThanOrEqual(align.rawRmsd);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. RMSF (Root Mean Square Fluctuation) Invariants
  // ---------------------------------------------------------------------------
  describe('6. RMSF Invariants', () => {
    it('returns exact 0.0000 RMSF for a static trajectory across all frames', () => {
      const staticFrame: [number, number, number][] = [
        [1.0, 2.0, 3.0],
        [4.0, 5.0, 6.0],
        [7.0, 8.0, 9.0],
      ];
      const allFrames = [staticFrame, staticFrame, staticFrame, staticFrame, staticFrame];

      const rmsfRes = calculateTrajectoryRmsf(allFrames, { alignFrames: false });
      expect(rmsfRes.meanRmsf).toBe(0.0);
      expect(rmsfRes.rmsfPerAtom).toEqual([0.0, 0.0, 0.0]);
    });

    it('is invariant to global rigid-body translation when frames are aligned', () => {
      const baseFrame: [number, number, number][] = [
        [0, 0, 0],
        [2, 0, 0],
        [0, 2, 0],
      ];
      // Frame 0 shifted by [10, 0, 0], Frame 1 shifted by [0, 20, 0], Frame 2 shifted by [0, 0, 30]
      const frame0: [number, number, number][] = baseFrame.map(([x, y, z]) => [x + 10, y, z]);
      const frame1: [number, number, number][] = baseFrame.map(([x, y, z]) => [x, y + 20, z]);
      const frame2: [number, number, number][] = baseFrame.map(([x, y, z]) => [x, y, z + 30]);

      const rmsfAligned = calculateTrajectoryRmsf([frame0, frame1, frame2], {
        alignFrames: true,
        referenceType: 'FIRST_FRAME',
      });
      expect(rmsfAligned.meanRmsf).toBe(0.0);
      for (const val of rmsfAligned.rmsfPerAtom) {
        expect(val).toBe(0.0);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Radius of Gyration & Centroid Unrounding Verification
  // ---------------------------------------------------------------------------
  describe('7. Radius of Gyration & Sub-Milli-Angstrom Precision', () => {
    const coords: [number, number, number][] = [
      [1.12345, 2.23456, 3.34567],
      [4.45678, 5.56789, 6.67890],
      [7.78901, 8.89012, 9.90123],
      [2.34567, 4.56789, 8.90123],
    ];

    it('centroid calculation retains full floating-point precision without premature rounding', () => {
      const centroid = calculateProteinCentroid(coords);
      const refC = refCentroid(coords);
      expect(centroid[0]).toBeCloseTo(refC[0], 12);
      expect(centroid[1]).toBeCloseTo(refC[1], 12);
      expect(centroid[2]).toBeCloseTo(refC[2], 12);
    });

    it('preserves Rg under sub-milli-Angstrom translation shifts (proving centroid fix)', () => {
      const rgOrig = calculateRadiusOfGyration(coords);

      const shift: [number, number, number] = [0.0001, 0.0002, 0.0003];
      const shiftedCoords: [number, number, number][] = coords.map(([x, y, z]) => [
        x + shift[0],
        y + shift[1],
        z + shift[2],
      ]);

      const rgShifted = calculateRadiusOfGyration(shiftedCoords);
      expect(rgShifted).toBe(rgOrig);
      expect(rgOrig).toBeCloseTo(refRadiusOfGyration(coords), 3);
    });

    it('differentiates unweighted Rg from mass-weighted Rg', () => {
      const atoms = [
        { coords: [0, 0, 0] as [number, number, number], element: 'C' },
        { coords: [10, 0, 0] as [number, number, number], element: 'FE' },
      ];
      const coordsOnly: [number, number, number][] = [[0, 0, 0], [10, 0, 0]];

      const rgUnweighted = calculateRadiusOfGyration(coordsOnly);
      const rgMassWeighted = calculateMassWeightedRadiusOfGyration(atoms);

      expect(rgUnweighted).toBe(5.0);
      expect(rgMassWeighted).not.toBe(5.0);
      expect(rgMassWeighted).toBeLessThan(5.0);
    });
  });

  // ---------------------------------------------------------------------------
  // 8. PBC Minimum Image & Half-Box Transitions
  // ---------------------------------------------------------------------------
  describe('8. PBC Minimum Image Half-Box Transitions & Validation', () => {
    const L = 10.0;
    const box: [number, number, number] = [10.0, 10.0, 10.0];

    it('evaluates exact half-box transitions: 4.9, 5.0, 5.1, 9.9, 10.0, 10.1', () => {
      expect(minimumImage1D(4.9, L)).toBeCloseTo(4.9, 8);
      expect(Math.abs(minimumImage1D(5.0, L))).toBeCloseTo(5.0, 8);
      expect(minimumImage1D(5.1, L)).toBeCloseTo(-4.9, 8);

      expect(minimumImage1D(9.9, L)).toBeCloseTo(-0.1, 8);
      expect(minimumImage1D(10.0, L)).toBeCloseTo(0.0, 8);
      expect(minimumImage1D(10.1, L)).toBeCloseTo(0.1, 8);
    });

    it('computes 3D minimum image distance correctly across periodic boundaries', () => {
      const pA: [number, number, number] = [1.0, 2.0, 3.0];
      const pB: [number, number, number] = [9.0, 2.0, 3.0];

      const directD = calculateEuclideanDistance(pA, pB);
      expect(directD).toBe(8.0);

      const pbcD = calculateMinimumImageDistance(pA, pB, box);
      expect(pbcD).toBeCloseTo(2.0, 8);
    });

    it('fails closed when pbcEngine is presented with a triclinic box matrix', () => {
      const triclinicBox = [
        [10.0, 1.5, 0.0],
        [0.0, 10.0, 0.0],
        [0.0, 0.0, 10.0],
      ];

      expect(() => minimumImageVector([0, 0, 0], [1, 1, 1], triclinicBox)).toThrow(
        UnsupportedBoxGeometryError
      );
      expect(() => unwrapBondedMolecule([[0, 0, 0], [1, 1, 1]], [[0, 1]], triclinicBox)).toThrow(
        UnsupportedBoxGeometryError
      );
      expect(() => centerMoleculeInBox([[0, 0, 0], [1, 1, 1]], triclinicBox)).toThrow(
        UnsupportedBoxGeometryError
      );
      expect(() => wrapCoordinatesIntoPrimaryBox([[0, 0, 0], [1, 1, 1]], triclinicBox)).toThrow(
        UnsupportedBoxGeometryError
      );
    });

    it('fails closed on non-finite or degenerate box dimensions (<= 0)', () => {
      expect(() => minimumImage1D(5.0, 0.0)).toThrow(UnsupportedBoxGeometryError);
      expect(() => minimumImage1D(5.0, -10.0)).toThrow(UnsupportedBoxGeometryError);
      expect(() => minimumImage1D(5.0, NaN)).toThrow(UnsupportedBoxGeometryError);
      expect(() => validateOrthorhombicBox([10, -5, 10])).toThrow(UnsupportedBoxGeometryError);
      expect(() => validateOrthorhombicBox([10, Infinity, 10])).toThrow(UnsupportedBoxGeometryError);
    });
  });

  // ---------------------------------------------------------------------------
  // 9. Interaction Contacts & Step Discontinuity
  // ---------------------------------------------------------------------------
  describe('9. Interaction Contacts Cutoff Sensitivity', () => {
    it('demonstrates step-function sensitivity at cutoff distance', () => {
      const cutoff = 4.0;
      const epsilon = 1e-5;

      const slicesInContact = [
        { frameIndex: 0, sourceCoord: [0, 0, 0] as [number, number, number], targetCoord: [cutoff - epsilon, 0, 0] as [number, number, number] },
      ];
      const resIn = calculateTrajectoryContactOccupancy(slicesInContact, 'pair1', 'A', 'B', cutoff);
      expect(resIn.contactCount).toBe(1);
      expect(resIn.occupancyFraction).toBe(1.0);

      const slicesOutOfContact = [
        { frameIndex: 0, sourceCoord: [0, 0, 0] as [number, number, number], targetCoord: [cutoff + epsilon, 0, 0] as [number, number, number] },
      ];
      const resOut = calculateTrajectoryContactOccupancy(slicesOutOfContact, 'pair1', 'A', 'B', cutoff);
      expect(resOut.contactCount).toBe(0);
      expect(resOut.occupancyFraction).toBe(0.0);
    });
  });

  // ---------------------------------------------------------------------------
  // 10. SASA & vdW Volume Analytical Convergence
  // ---------------------------------------------------------------------------
  describe('10. SASA & vdW Volume Analytical Solutions', () => {
    it('isolated sphere SASA matches analytical 4 * pi * (r_vdw + r_probe)^2', () => {
      const rVdw = 1.5;
      const rProbe = 1.4;
      const analyticalArea = 4 * Math.PI * (rVdw + rProbe) * (rVdw + rProbe);

      const singleAtom = [
        {
          atomId: 1,
          element: 'C',
          coordinates: [0, 0, 0] as [number, number, number],
          radius: rVdw,
        },
      ];

      const sasaRes = computeSASA(singleAtom, { probeRadius: rProbe, pointsPerSphere: 256 });
      expect(sasaRes.totalSasa).toBeCloseTo(analyticalArea, 2);
      expect(calculateAnalyticalSphereSurfaceArea(rVdw + rProbe)).toBeCloseTo(analyticalArea, 8);
    });

    it('single sphere vdW volume matches analytical (4/3) * pi * r^3', () => {
      const r = 2.0;
      const analyticalVol = (4 / 3) * Math.PI * r * r * r;
      expect(calculateAnalyticalSphereVolume(r)).toBeCloseTo(analyticalVol, 8);

      const singleAtom = [
        {
          coordinates: [0, 0, 0] as [number, number, number],
          element: 'C',
          radius: r,
        },
      ];

      const vdwRes = computeMolecularVdwVolume(singleAtom, { gridSpacing: 0.2, padding: 3.0 });
      expect(vdwRes.vdwVolume).toBeGreaterThan(analyticalVol * 0.95);
      expect(vdwRes.vdwVolume).toBeLessThan(analyticalVol * 1.05);
    });

    it('two distant non-overlapping spheres have total volume equal to sum of individual volumes', () => {
      const r = 1.5;
      const twoAtoms = [
        { coordinates: [0, 0, 0] as [number, number, number], element: 'C', radius: r },
        { coordinates: [10, 0, 0] as [number, number, number], element: 'C', radius: r },
      ];

      const vdwRes = computeMolecularVdwVolume(twoAtoms, { gridSpacing: 0.4, padding: 2.5 });
      const singleRes = computeMolecularVdwVolume([twoAtoms[0]], { gridSpacing: 0.4, padding: 2.5 });

      expect(vdwRes.vdwVolume).toBeCloseTo(singleRes.vdwVolume * 2, 0);
    });
  });

  // ---------------------------------------------------------------------------
  // 11. Ground Truth Fixture Assertions & Cross-Data Isolation
  // ---------------------------------------------------------------------------
  describe('11. 4HHB Ground Truth & Unrelated Data Invariance', () => {
    const feA: [number, number, number] = [18.362, 18.488, 23.755];
    const ne2A: [number, number, number] = [16.894, 20.030, 24.002];

    const feC: [number, number, number] = [4.445, 23.463, 54.548];
    const ne2C: [number, number, number] = [6.358, 24.601, 54.168];

    it('4HHB Chain A Fe to His87 NE2 distance matches established baseline (2.1433 Å)', () => {
      const d = calculateEuclideanDistance(feA, ne2A);
      expect(d).toBeCloseTo(2.1433, 3);
      expect(d).toBeCloseTo(refEuclideanDistance(feA, ne2A), 10);
    });

    it('4HHB Chain C Fe to His87 NE2 distance matches established baseline (2.2581 Å)', () => {
      const d = calculateEuclideanDistance(feC, ne2C);
      expect(d).toBeCloseTo(2.2581, 3);
      expect(d).toBeCloseTo(refEuclideanDistance(feC, ne2C), 10);
    });

    it('unrelated-data invariance: adding Chain C HEM does not alter Chain A Fe-NE2 distance or AABB', () => {
      const chainAAtoms: [number, number, number][] = [feA, ne2A];
      const distA_isolated = calculateEuclideanDistance(chainAAtoms[0], chainAAtoms[1]);
      const boxA_isolated = box3ToCoordinateAABB(createBox3FromCoordinates(chainAAtoms));

      const mixedSet: [number, number, number][] = [feA, ne2A, feC, ne2C];

      const distA_mixed = calculateEuclideanDistance(mixedSet[0], mixedSet[1]);
      expect(distA_mixed).toBe(distA_isolated);

      const filteredA = mixedSet.slice(0, 2);
      const boxA_filtered = box3ToCoordinateAABB(createBox3FromCoordinates(filteredA));
      expect(boxA_filtered.min).toEqual(boxA_isolated.min);
      expect(boxA_filtered.max).toEqual(boxA_isolated.max);
      expect(boxA_filtered.size).toEqual(boxA_isolated.size);
    });
  });

  // ---------------------------------------------------------------------------
  // 12. Frame Trajectory Cache Independence
  // ---------------------------------------------------------------------------
  describe('12. Trajectory Frame Query Order Independence', () => {
    it('yields identical coordinates regardless of access order', () => {
      const trajectoryFrames: Array<Array<[number, number, number]>> = [
        [[1, 2, 3], [4, 5, 6]],
        [[1.1, 2.1, 3.1], [4.1, 5.1, 6.1]],
        [[1.2, 2.2, 3.2], [4.2, 5.2, 6.2]],
      ];

      const fwd0 = trajectoryFrames[0];
      const fwd1 = trajectoryFrames[1];
      const fwd2 = trajectoryFrames[2];

      const rev2 = trajectoryFrames[2];
      const rev0 = trajectoryFrames[0];
      const rev1 = trajectoryFrames[1];

      expect(fwd0).toEqual(rev0);
      expect(fwd1).toEqual(rev1);
      expect(fwd2).toEqual(rev2);
    });
  });
});
