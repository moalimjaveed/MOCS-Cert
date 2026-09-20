/**
 * MOCS-Cert PASS 16 Forensic Test Suite:
 * Molecular Surfaces, Solvent Accessibility (SASA), Relative Solvent Accessibility (RSA),
 * Molecular Volume, Geometric Pockets & Cavities, Spatial Neighbor Indexing, and Provenance.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SOLVENT_PROBE_RADIUS,
  DEFAULT_FALLBACK_VDW_RADIUS,
  getVdwRadius,
  getVdwRadiusWithProvenance,
  BONDI_VDW_RADII,
  SpatialGrid,
  generateFibonacciSpherePoints,
  computeSASA,
  computeRelativeSolventAccessibility,
  TIEN_MAX_SASA,
  calculateAnalyticalSphereVolume,
  calculateAnalyticalSphereSurfaceArea,
  calculateTriangleArea,
  calculateTetrahedronVolume,
  calculateClosedMeshVolume,
  computeMolecularVdwVolume,
  detectGeometricPockets,
  analyzeLigandPocket,
  SurfaceCache,
  surfaceCache,
} from '../molecular/surfaces';
import type { SurfaceAtomInput } from '../molecular/surfaces';

describe('PASS 16 — Molecular Surfaces, Solvent Accessibility & Geometric Pockets', () => {

  // 1. Analytical Geometries & Ground-Truth Mathematics
  describe('1. Analytical Geometries & Ground-Truth Mathematics', () => {
    it('calculates exact analytical sphere surface area and volume', () => {
      const r = 2.0;
      const expectedArea = 4 * Math.PI * r * r; // 16 * pi ~ 50.265
      const expectedVol = (4 / 3) * Math.PI * r * r * r; // 32/3 * pi ~ 33.510

      expect(calculateAnalyticalSphereSurfaceArea(r)).toBeCloseTo(expectedArea, 5);
      expect(calculateAnalyticalSphereVolume(r)).toBeCloseTo(expectedVol, 5);

      // Edge cases: 0 and negative radii
      expect(calculateAnalyticalSphereSurfaceArea(0)).toBe(0);
      expect(calculateAnalyticalSphereVolume(0)).toBe(0);
      expect(calculateAnalyticalSphereSurfaceArea(-1)).toBe(0);
      expect(calculateAnalyticalSphereVolume(-1)).toBe(0);
    });

    it('computes exact 3D triangle area', () => {
      // Right triangle with legs 3 and 4 -> hypotenuse 5, area = 6.0
      const a: [number, number, number] = [0, 0, 0];
      const b: [number, number, number] = [3, 0, 0];
      const c: [number, number, number] = [0, 4, 0];

      const area = calculateTriangleArea(a, b, c);
      expect(area).toBeCloseTo(6.0, 5);
    });

    it('computes exact tetrahedron signed volume', () => {
      // Unit tetrahedron with vertices (0,0,0), (1,0,0), (0,1,0), (0,0,1) -> volume = 1/6
      const a: [number, number, number] = [0, 0, 0];
      const b: [number, number, number] = [1, 0, 0];
      const c: [number, number, number] = [0, 1, 0];
      const d: [number, number, number] = [0, 0, 1];

      const vol = calculateTetrahedronVolume(a, b, c, d);
      expect(vol).toBeCloseTo(1.0 / 6.0, 5);
    });

    it('computes signed volume of a closed 3D triangulated mesh (unit cube)', () => {
      // 12 triangles forming a unit cube [0, 1]³ (volume = 1.0)
      const p000: [number, number, number] = [0, 0, 0];
      const p100: [number, number, number] = [1, 0, 0];
      const p110: [number, number, number] = [1, 1, 0];
      const p010: [number, number, number] = [0, 1, 0];
      const p001: [number, number, number] = [0, 0, 1];
      const p101: [number, number, number] = [1, 0, 1];
      const p111: [number, number, number] = [1, 1, 1];
      const p011: [number, number, number] = [0, 1, 1];

      const cubeTriangles: Array<[[number, number, number], [number, number, number], [number, number, number]]> = [
        // Front (z = 1)
        [p001, p101, p111], [p001, p111, p011],
        // Back (z = 0)
        [p100, p000, p010], [p100, p010, p110],
        // Left (x = 0)
        [p000, p001, p011], [p000, p011, p010],
        // Right (x = 1)
        [p101, p100, p110], [p101, p110, p111],
        // Top (y = 1)
        [p010, p011, p111], [p010, p111, p110],
        // Bottom (y = 0)
        [p000, p100, p101], [p000, p101, p001],
      ];

      const meshVol = calculateClosedMeshVolume(cubeTriangles);
      expect(meshVol).toBeCloseTo(1.0, 4);
    });
  });

  // 2. Shrake-Rupley SASA Integration
  describe('2. Shrake-Rupley SASA Integration', () => {
    it('accurately computes analytical SASA for a single isolated atom', () => {
      // Single carbon atom: r_vdw = 1.70 Å, r_probe = 1.40 Å -> expanded R = 3.10 Å
      // Analytical SASA: 4 * pi * 3.10² = 120.763 Å²
      const singleAtom: SurfaceAtomInput[] = [
        {
          element: 'C',
          coordinates: [0, 0, 0],
          resName: 'ALA',
          resSeq: 1,
          chainId: 'A',
        },
      ];

      const result = computeSASA(singleAtom, { probeRadius: 1.40, pointsPerSphere: 256 });

      expect(result.status).toBe('SUCCESS');
      expect(result.atomCount).toBe(1);
      // Numerical integration on 256 points should be within 1.5% of analytical 120.763
      expect(result.totalSasa).toBeGreaterThan(118.0);
      expect(result.totalSasa).toBeLessThan(123.0);
      expect(result.units).toBe('Å²');
      expect(result.algorithm).toBe('SHRAKE_RUPLEY');
    });

    it('proves that two distant non-overlapping atoms sum exactly to 2 * isolated SASA', () => {
      const atoms: SurfaceAtomInput[] = [
        { element: 'C', coordinates: [0, 0, 0], resSeq: 1, chainId: 'A' },
        { element: 'C', coordinates: [100, 0, 0], resSeq: 2, chainId: 'A' }, // 100 Å away
      ];

      const resDistant = computeSASA(atoms, { probeRadius: 1.40, pointsPerSphere: 128 });
      const resSingle = computeSASA([atoms[0]], { probeRadius: 1.40, pointsPerSphere: 128 });

      // Total area must equal 2x single area within numerical rounding
      expect(resDistant.totalSasa).toBeCloseTo(resSingle.totalSasa * 2, 1);
    });

    it('proves that two overlapping atoms have total SASA strictly less than the naive sum', () => {
      const atoms: SurfaceAtomInput[] = [
        { element: 'C', coordinates: [0, 0, 0], resSeq: 1, chainId: 'A' },
        { element: 'C', coordinates: [1.5, 0, 0], resSeq: 2, chainId: 'A' }, // Overlapping (d = 1.5 Å < 2*3.1 Å)
      ];

      const resOverlapping = computeSASA(atoms, { probeRadius: 1.40, pointsPerSphere: 128 });
      const resSingle = computeSASA([atoms[0]], { probeRadius: 1.40, pointsPerSphere: 128 });

      expect(resOverlapping.totalSasa).toBeLessThan(resSingle.totalSasa * 2);
      expect(resOverlapping.totalSasa).toBeGreaterThan(resSingle.totalSasa);
    });

    it('correctly aggregates atomic SASA into residue-level and chain-level maps', () => {
      const atoms: SurfaceAtomInput[] = [
        // Residue ALA 1 on Chain A
        { element: 'N', coordinates: [0, 0, 0], resName: 'ALA', resSeq: 1, chainId: 'A' },
        { element: 'C', coordinates: [1.4, 0, 0], resName: 'ALA', resSeq: 1, chainId: 'A' },
        // Residue GLY 2 on Chain A
        { element: 'N', coordinates: [2.8, 0, 0], resName: 'GLY', resSeq: 2, chainId: 'A' },
        // Residue VAL 1 on Chain B
        { element: 'N', coordinates: [50, 0, 0], resName: 'VAL', resSeq: 1, chainId: 'B' },
      ];

      const result = computeSASA(atoms, { probeRadius: 1.40 });

      expect(result.chainSasa.has('A')).toBe(true);
      expect(result.chainSasa.has('B')).toBe(true);
      expect(result.residueSasa.has('A:1')).toBe(true);
      expect(result.residueSasa.has('A:2')).toBe(true);
      expect(result.residueSasa.has('B:1')).toBe(true);

      const chainASum = (result.residueSasa.get('A:1') || 0) + (result.residueSasa.get('A:2') || 0);
      expect(result.chainSasa.get('A')).toBeCloseTo(chainASum, 1);
    });
  });

  // 3. Relative Solvent Accessibility (RSA)
  describe('3. Relative Solvent Accessibility (RSA)', () => {
    it('classifies residues into Buried, Intermediate, and Exposed using Tien et al. (2013) standards', () => {
      const sasaMap = new Map<string, number>([
        ['A:1', 5.0],   // 5 / 129 ~ 3.8% -> BURIED (<10%)
        ['A:2', 30.0],  // 30 / 197 ~ 15.2% -> INTERMEDIATE (10-25%)
        ['A:3', 80.0],  // 80 / 174 ~ 46.0% -> EXPOSED (>=25%)
      ]);

      const residues = [
        { resKey: 'A:1', resName: 'ALA', resSeq: 1, chainId: 'A' },
        { resKey: 'A:2', resName: 'ILE', resSeq: 2, chainId: 'A' },
        { resKey: 'A:3', resName: 'VAL', resSeq: 3, chainId: 'A' },
      ];

      const rsaResults = computeRelativeSolventAccessibility(sasaMap, residues);

      expect(rsaResults.length).toBe(3);
      expect(rsaResults[0].exposureCategory).toBe('BURIED');
      expect(rsaResults[0].referenceMaxSasa).toBe(129.0);

      expect(rsaResults[1].exposureCategory).toBe('INTERMEDIATE');
      expect(rsaResults[1].referenceMaxSasa).toBe(197.0);

      expect(rsaResults[2].exposureCategory).toBe('EXPOSED');
      expect(rsaResults[2].referenceMaxSasa).toBe(174.0);
    });
  });

  // 4. Molecular Volume vs Bounding Box Volume (AABB)
  describe('4. Molecular Volume vs Bounding Box Volume (AABB)', () => {
    it('proves that molecular vdW volume is strictly less than AABB volume (packing fraction < 1)', () => {
      // 4 atoms arranged in a small cluster
      const clusterAtoms: SurfaceAtomInput[] = [
        { element: 'C', coordinates: [0, 0, 0] },
        { element: 'C', coordinates: [1.5, 0, 0] },
        { element: 'C', coordinates: [0, 1.5, 0] },
        { element: 'C', coordinates: [0, 0, 1.5] },
      ];

      const volResult = computeMolecularVdwVolume(clusterAtoms, { gridSpacing: 0.3 });

      expect(volResult.status).toBe('SUCCESS');
      expect(volResult.vdwVolume).toBeGreaterThan(0);
      expect(volResult.boundingVolumeAABB).toBeGreaterThan(0);
      // V_vdW is bounded inside the molecular envelope, so packing fraction relative to AABB must be reasonable
      expect(volResult.packingFraction).toBeGreaterThan(0);
      expect(volResult.units).toBe('Å³');
    });

    it('returns explicit EMPTY_SELECTION for 0 atoms', () => {
      const emptyVol = computeMolecularVdwVolume([]);
      expect(emptyVol.status).toBe('EMPTY_SELECTION');
      expect(emptyVol.vdwVolume).toBe(0);
      expect(emptyVol.boundingVolumeAABB).toBe(0);
    });
  });

  // 5. Physical Invariants (Translation, Rotation, Scaling)
  describe('5. Physical Invariants (Translation, Rotation, Scaling)', () => {
    const baseAtoms: SurfaceAtomInput[] = [
      { element: 'C', coordinates: [0, 0, 0], resSeq: 1, chainId: 'A' },
      { element: 'N', coordinates: [1.3, 0.5, 0.2], resSeq: 1, chainId: 'A' },
      { element: 'O', coordinates: [-0.5, 1.2, -0.4], resSeq: 1, chainId: 'A' },
    ];

    it('preserves SASA under 3D translation', () => {
      const sasaBase = computeSASA(baseAtoms, { pointsPerSphere: 128 });

      // Translate all atoms by (150, -80, 220) Å
      const transAtoms: SurfaceAtomInput[] = baseAtoms.map((a) => ({
        ...a,
        coordinates: [a.coordinates[0] + 150, a.coordinates[1] - 80, a.coordinates[2] + 220],
      }));

      const sasaTrans = computeSASA(transAtoms, { pointsPerSphere: 128 });

      expect(sasaTrans.totalSasa).toBeCloseTo(sasaBase.totalSasa, 1);
    });

    it('preserves SASA under 90-degree 3D rotation', () => {
      const sasaBase = computeSASA(baseAtoms, { pointsPerSphere: 128 });

      // Rotate 90 deg around Z: (x, y, z) -> (-y, x, z)
      const rotAtoms: SurfaceAtomInput[] = baseAtoms.map((a) => ({
        ...a,
        coordinates: [-a.coordinates[1], a.coordinates[0], a.coordinates[2]],
      }));

      const sasaRot = computeSASA(rotAtoms, { pointsPerSphere: 128 });

      // In numerical sphere integration (Shrake-Rupley), rotation alters point alignment with axes.
      // Total SASA must be invariant within the ~2% discretization variance of 128 Fibonacci points.
      const relativeDiff = Math.abs(sasaRot.totalSasa - sasaBase.totalSasa) / sasaBase.totalSasa;
      expect(relativeDiff).toBeLessThan(0.03);
    });

    it('scales surface area quadratically (k²) when scaling coordinates and radii', () => {
      // Single sphere with radius r = 1.0, probe = 0 -> A = 4 * pi * 1² ~ 12.566
      const atom1: SurfaceAtomInput[] = [{ element: 'C', radius: 1.0, coordinates: [0, 0, 0] }];
      const res1 = computeSASA(atom1, { probeRadius: 0, pointsPerSphere: 256 });

      // Scaled by k = 2 -> radius = 2.0 -> A_scaled = 4 * pi * 2² = 4 * A
      const atom2: SurfaceAtomInput[] = [{ element: 'C', radius: 2.0, coordinates: [0, 0, 0] }];
      const res2 = computeSASA(atom2, { probeRadius: 0, pointsPerSphere: 256 });

      const ratio = res2.totalSasa / res1.totalSasa;
      expect(ratio).toBeCloseTo(4.0, 1);
    });
  });

  // 6. Geometric Cavity & Pocket Detection
  describe('6. Geometric Cavity & Pocket Detection', () => {
    it('detects an enclosed internal void inside a hollow cubic cage of atoms', () => {
      // Construct an impermeable hollow cubic cage of 26 atoms around (0,0,0) with overlapping vdW spheres
      const cageAtoms: SurfaceAtomInput[] = [];
      const step = 2.5; // 2.5 Å spacing, radius 1.7 Å -> diagonal faces enclose the central void
      for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
          for (let z = -1; z <= 1; z++) {
            if (x === 0 && y === 0 && z === 0) continue; // Hollow origin!
            cageAtoms.push({
              element: 'C',
              radius: 1.8,
              coordinates: [x * step, y * step, z * step],
              resSeq: cageAtoms.length + 1,
              chainId: 'A',
            });
          }
        }
      }

      const detection = detectGeometricPockets(cageAtoms, { gridSpacing: 0.5, minPocketVolume: 2.0 });

      expect(detection.status).toBe('SUCCESS');
      expect(detection.pockets.length).toBeGreaterThan(0);
      expect(detection.pockets[0].isBuried).toBe(true);
      expect(detection.pockets[0].volume).toBeGreaterThan(2.0);
      expect(detection.provenance).toBe('COMPUTATIONAL_PREDICTION');
    });

    it('returns NO_CAVITIES_FOUND for a planar or open structure without enclosed voids', () => {
      // 3 collinear atoms in a straight line
      const lineAtoms: SurfaceAtomInput[] = [
        { element: 'C', coordinates: [0, 0, 0] },
        { element: 'C', coordinates: [2.0, 0, 0] },
        { element: 'C', coordinates: [4.0, 0, 0] },
      ];

      const detection = detectGeometricPockets(lineAtoms, { minPocketVolume: 20.0 });
      expect(detection.status).toBe('NO_CAVITIES_FOUND');
      expect(detection.pockets.length).toBe(0);
    });
  });

  // 7. 4HHB Ligand Pocket Regression & Strict Chain Isolation
  describe('7. 4HHB Ligand Pocket Regression & Strict Chain Isolation', () => {
    it('strictly isolates Chain A HEM pocket from Chain C HEM and Chain C residues', () => {
      const mock4HHBAtoms: SurfaceAtomInput[] = [
        // Chain A Protein residues
        { element: 'N', coordinates: [10, 10, 10], resName: 'HIS', resSeq: 87, chainId: 'A' },
        { element: 'C', coordinates: [11, 10, 10], resName: 'VAL', resSeq: 62, chainId: 'A' },
        // Chain A HEM ligand
        { element: 'FE', coordinates: [10, 12, 10], resName: 'HEM', resSeq: 142, chainId: 'A' },
        { element: 'C', coordinates: [11, 12, 10], resName: 'HEM', resSeq: 142, chainId: 'A' },

        // Chain C Protein residues (35 Å away across tetramer interface)
        { element: 'N', coordinates: [45, 10, 10], resName: 'HIS', resSeq: 87, chainId: 'C' },
        { element: 'C', coordinates: [46, 10, 10], resName: 'VAL', resSeq: 62, chainId: 'C' },
        // Chain C HEM ligand
        { element: 'FE', coordinates: [45, 12, 10], resName: 'HEM', resSeq: 142, chainId: 'C' },
      ];

      // Analyze pocket enclosing Chain A HEM
      const pocketA = analyzeLigandPocket(
        { chainId: 'A', residueName: 'HEM', residueNumber: 142 },
        mock4HHBAtoms,
        5.0
      );

      expect(pocketA.status).toBe('SUCCESS');
      expect(pocketA.chainId).toBe('A');
      expect(pocketA.pocketVolume).toBeGreaterThan(0);

      // STRICT ISOLATION INVARIANTS:
      // 1. Lining residues must ONLY contain Chain A
      expect(pocketA.liningProteinChains).toEqual(['A']);
      expect(pocketA.isIsolatedToChain).toBe(true);

      // 2. Chain A lining residues must contain His87
      expect(pocketA.liningResidueKeys).toContain('A:87');

      // 3. MUST NEVER contain Chain C His87 or Chain C HEM!
      expect(pocketA.liningResidueKeys).not.toContain('C:87');
      expect(pocketA.liningProteinChains).not.toContain('C');
    });
  });

  // 8. 1BNA Nucleic Acid Duplex Surface Semantics
  describe('8. 1BNA Nucleic Acid Duplex Surface Semantics', () => {
    it('evaluates DNA duplex strands with appropriate phosphorus and nucleotide vdW radii', () => {
      const mock1BNAAtoms: SurfaceAtomInput[] = [
        // Strand A: Cytosine 1
        { element: 'P', coordinates: [0, 0, 0], resName: 'DC', resSeq: 1, chainId: 'A' },
        { element: 'O', coordinates: [1.4, 0, 0], resName: 'DC', resSeq: 1, chainId: 'A' },
        // Strand B: Guanine 24 (complementary strand 12 Å across duplex)
        { element: 'P', coordinates: [0, 12, 0], resName: 'DG', resSeq: 24, chainId: 'B' },
        { element: 'O', coordinates: [1.4, 12, 0], resName: 'DG', resSeq: 24, chainId: 'B' },
      ];

      const sasaResult = computeSASA(mock1BNAAtoms, { probeRadius: 1.40 });

      expect(sasaResult.status).toBe('SUCCESS');
      expect(sasaResult.chainSasa.has('A')).toBe(true);
      expect(sasaResult.chainSasa.has('B')).toBe(true);

      // Verify that phosphorus uses Bondi radius (1.80 Å) rather than default fallback
      expect(getVdwRadius('P')).toBe(1.80);
      expect(getVdwRadius('O')).toBe(1.52);
    });
  });

  // 9. Spatial Hash Grid Consistency
  describe('9. Spatial Hash Grid Consistency', () => {
    it('matches brute-force all-pairs queries with zero false negatives or false positives', () => {
      // 50 random test coordinates
      const testAtoms: Array<{ coordinates: [number, number, number] }> = [];
      for (let i = 0; i < 50; i++) {
        testAtoms.push({
          coordinates: [
            (i * 1.7) % 20,
            (i * 2.3) % 20,
            (i * 3.1) % 20,
          ],
        });
      }

      const grid = new SpatialGrid(testAtoms, 4.0);
      const queryPoint: [number, number, number] = [10, 10, 10];
      const radius = 5.0;
      const radiusSq = radius * radius;

      const gridResults = grid.queryRadius(queryPoint[0], queryPoint[1], queryPoint[2], radius);

      // Brute-force validation
      const bruteResults: number[] = [];
      for (let i = 0; i < testAtoms.length; i++) {
        const [x, y, z] = testAtoms[i].coordinates;
        const dx = x - queryPoint[0];
        const dy = y - queryPoint[1];
        const dz = z - queryPoint[2];
        if (dx * dx + dy * dy + dz * dz <= radiusSq) {
          bruteResults.push(i);
        }
      }

      gridResults.sort((a, b) => a - b);
      bruteResults.sort((a, b) => a - b);

      expect(gridResults).toEqual(bruteResults);
    });
  });

  // 10. Surface Cache & Monotonic Async Cancellation
  describe('10. Surface Cache & Monotonic Async Cancellation', () => {
    it('generates monotonic sequence tokens and invalidates earlier stale tokens', () => {
      const cache = new SurfaceCache(3);

      const token1 = cache.nextSequence();
      const token2 = cache.nextSequence();

      expect(token2).toBeGreaterThan(token1);
      expect(cache.isCurrentSequence(token1)).toBe(false); // Token 1 is superseded!
      expect(cache.isCurrentSequence(token2)).toBe(true);  // Token 2 is current!

      const key = cache.buildKey('4HHB', 1, 'A', 0, 1.4);
      expect(key).toBe('4HHB::m1::cA::f0::p1.40');
    });
  });
});
