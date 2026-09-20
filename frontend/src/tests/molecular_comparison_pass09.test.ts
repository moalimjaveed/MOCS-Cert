/**
 * MOCS-Cert Pass 09 — Protein Structure Comparison, Alignment & Structural Similarity Forensic Test Suite
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: wwPDB, CASP GDT-TS, Zhang & Skolnick TM-score, Horn Quaternion Kabsch Alignment
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  alignSequencesNeedlemanWunsch,
  getBlosum62Score,
  type SequenceInputItem,
} from '../molecular/protein/sequenceAlignment';
import {
  buildAtomCorrespondence,
  normalizeStructureAtoms,
  type ProteinStructureInputAtom,
} from '../molecular/protein/residueCorrespondence';
import {
  calculateWeightedKabschAlignment,
  calculateTrimmedRmsd,
  applyRigidTransformation,
  invertRigidTransformation,
  computeMatrix3Determinant,
  calculateRawCoordinateRmsd,
  quaternionToRotationMatrix,
} from '../molecular/protein/alignment';
import {
  calculateTmScore,
  calculateTmScoreD0,
  calculateGdtScores,
  computeDistanceMatrix,
  calculateDistanceMatrixRmsd,
  computeContactMatrix,
  calculateContactMapSimilarity,
} from '../molecular/protein/similarityMetrics';
import {
  compareProteinStructures,
  buildComparisonCacheKey,
  clearComparisonCache,
} from '../molecular/protein/proteinComparator';
import {
  computeBackboneRMSD,
  computeSuperposedRMSD,
} from '../molecular/intelligence/geometryEngine';

describe('PASS 09: Protein Structure Comparison, Alignment & Similarity Forensic Suite', () => {
  beforeEach(() => {
    clearComparisonCache();
  });

  // =========================================================================
  // 1. Sequence Alignment: Needleman-Wunsch & BLOSUM62 (Step 4)
  // =========================================================================
  describe('1. Sequence Alignment & Residue Correspondence (Step 4 & 5)', () => {
    it('evaluates authentic BLOSUM62 substitution scores for identical and conservative pairs', () => {
      // Identity scores
      expect(getBlosum62Score('C', 'C')).toBe(9);
      expect(getBlosum62Score('W', 'W')).toBe(11);
      expect(getBlosum62Score('A', 'A')).toBe(4);

      // Conservative substitutions
      expect(getBlosum62Score('K', 'R')).toBe(2); // Positive: both basic
      expect(getBlosum62Score('I', 'V')).toBe(3); // Positive: both aliphatic branched
      expect(getBlosum62Score('D', 'E')).toBe(2); // Positive: both acidic

      // Non-conservative substitutions
      expect(getBlosum62Score('W', 'D')).toBe(-4);
      expect(getBlosum62Score('C', 'P')).toBe(-3);
    });

    it('aligns identical sequences with 100% identity and 0 gaps', () => {
      const seqA: SequenceInputItem[] = [
        { chainId: 'A', resSeq: 1, resName: 'MET', char1: 'M', hasCoords: true },
        { chainId: 'A', resSeq: 2, resName: 'LYS', char1: 'K', hasCoords: true },
        { chainId: 'A', resSeq: 3, resName: 'VAL', char1: 'V', hasCoords: true },
        { chainId: 'A', resSeq: 4, resName: 'LEU', char1: 'L', hasCoords: true },
      ];
      const res = alignSequencesNeedlemanWunsch(seqA, seqA);
      expect(res.sourceAlignedSeq).toBe('MKVL');
      expect(res.targetAlignedSeq).toBe('MKVL');
      expect(res.sequenceIdentityPercent).toBe(100);
      expect(res.sequenceSimilarityPercent).toBe(100);
      expect(res.gapCount).toBe(0);
      expect(res.residuePairs.length).toBe(4);
    });

    it('correctly maps shifted residue numbers between homologous chains (e.g. 1-4 vs 101-104)', () => {
      const seqA: SequenceInputItem[] = [
        { chainId: 'A', resSeq: 1, resName: 'ALA', char1: 'A', hasCoords: true },
        { chainId: 'A', resSeq: 2, resName: 'CYS', char1: 'C', hasCoords: true },
        { chainId: 'A', resSeq: 3, resName: 'ASP', char1: 'D', hasCoords: true },
      ];
      const seqB: SequenceInputItem[] = [
        { chainId: 'B', resSeq: 101, resName: 'ALA', char1: 'A', hasCoords: true },
        { chainId: 'B', resSeq: 102, resName: 'CYS', char1: 'C', hasCoords: true },
        { chainId: 'B', resSeq: 103, resName: 'ASP', char1: 'D', hasCoords: true },
      ];

      const res = alignSequencesNeedlemanWunsch(seqA, seqB);
      expect(res.sourceToTargetResidueMap.get('A:1')).toBe('B:101');
      expect(res.sourceToTargetResidueMap.get('A:2')).toBe('B:102');
      expect(res.sourceToTargetResidueMap.get('A:3')).toBe('B:103');
    });

    it('handles insertions, deletions and gaps without corrupting residue mapping', () => {
      // Seq A: A-C-D-E-F
      // Seq B: A-C---E-F (D is deleted in B)
      const seqA: SequenceInputItem[] = [
        { chainId: 'A', resSeq: 1, resName: 'ALA', char1: 'A' },
        { chainId: 'A', resSeq: 2, resName: 'CYS', char1: 'C' },
        { chainId: 'A', resSeq: 3, resName: 'ASP', char1: 'D' },
        { chainId: 'A', resSeq: 4, resName: 'GLU', char1: 'E' },
        { chainId: 'A', resSeq: 5, resName: 'PHE', char1: 'F' },
      ];
      const seqB: SequenceInputItem[] = [
        { chainId: 'A', resSeq: 1, resName: 'ALA', char1: 'A' },
        { chainId: 'A', resSeq: 2, resName: 'CYS', char1: 'C' },
        { chainId: 'A', resSeq: 4, resName: 'GLU', char1: 'E' },
        { chainId: 'A', resSeq: 5, resName: 'PHE', char1: 'F' },
      ];

      const res = alignSequencesNeedlemanWunsch(seqA, seqB);
      expect(res.gapCount).toBeGreaterThanOrEqual(1);
      expect(res.sourceToTargetResidueMap.get('A:1')).toBe('A:1');
      expect(res.sourceToTargetResidueMap.get('A:2')).toBe('A:2');
      expect(res.sourceToTargetResidueMap.has('A:3')).toBe(false); // D is deleted in B!
      expect(res.sourceToTargetResidueMap.get('A:4')).toBe('A:4');
      expect(res.sourceToTargetResidueMap.get('A:5')).toBe('A:5');
    });
  });

  // =========================================================================
  // 2. Atom Correspondence & Scope Filtering (Step 6)
  // =========================================================================
  describe('2. Atom Correspondence & Selection Scopes (Step 6 & 10)', () => {
    const rawAtomsA: ProteinStructureInputAtom[] = [
      { chain: 'A', resi: 1, resn: 'ALA', atomName: 'N', coords: [0, 0, 0] },
      { chain: 'A', resi: 1, resn: 'ALA', atomName: 'CA', coords: [1, 0, 0] },
      { chain: 'A', resi: 1, resn: 'ALA', atomName: 'C', coords: [2, 0, 0] },
      { chain: 'A', resi: 1, resn: 'ALA', atomName: 'O', coords: [2, 1, 0] },
      { chain: 'A', resi: 1, resn: 'ALA', atomName: 'CB', coords: [1, 1, 0] },
    ];
    const rawAtomsB: ProteinStructureInputAtom[] = [
      { chain: 'A', resi: 1, resn: 'ALA', atomName: 'N', coords: [0, 0, 0.1] },
      { chain: 'A', resi: 1, resn: 'ALA', atomName: 'CA', coords: [1, 0, 0.1] },
      { chain: 'A', resi: 1, resn: 'ALA', atomName: 'C', coords: [2, 0, 0.1] },
      { chain: 'A', resi: 1, resn: 'ALA', atomName: 'O', coords: [2, 1, 0.1] },
      { chain: 'A', resi: 1, resn: 'ALA', atomName: 'CB', coords: [1, 1, 0.1] },
    ];

    it('filters strictly for CA scope: pairs only C-alpha atoms', () => {
      const { correspondence } = buildAtomCorrespondence(rawAtomsA, rawAtomsB, { atomScope: 'CA' });
      expect(correspondence.pairedAtoms.length).toBe(1);
      expect(correspondence.pairedAtoms[0].sourceAtom.atomName).toBe('CA');
      expect(correspondence.pairedAtoms[0].targetAtom.atomName).toBe('CA');
    });

    it('filters strictly for backbone scope: pairs N, CA, C, O', () => {
      const { correspondence } = buildAtomCorrespondence(rawAtomsA, rawAtomsB, { atomScope: 'backbone' });
      expect(correspondence.pairedAtoms.length).toBe(4);
      const names = correspondence.pairedAtoms.map((p) => p.sourceAtom.atomName);
      expect(names).toEqual(['N', 'CA', 'C', 'O']);
      expect(names).not.toContain('CB');
    });

    it('pairs all heavy atoms including sidechain CB', () => {
      const { correspondence } = buildAtomCorrespondence(rawAtomsA, rawAtomsB, { atomScope: 'heavy' });
      expect(correspondence.pairedAtoms.length).toBe(5);
      const names = correspondence.pairedAtoms.map((p) => p.sourceAtom.atomName);
      expect(names).toContain('CB');
    });

    it('never pairs arbitrary atoms when atom names differ between structures', () => {
      // Structure A has Glycine (no CB), Structure B has Alanine (has CB)
      const glyAtoms: ProteinStructureInputAtom[] = [
        { chain: 'A', resi: 1, resn: 'GLY', atomName: 'N', coords: [0, 0, 0] },
        { chain: 'A', resi: 1, resn: 'GLY', atomName: 'CA', coords: [1, 0, 0] },
        { chain: 'A', resi: 1, resn: 'GLY', atomName: 'C', coords: [2, 0, 0] },
        { chain: 'A', resi: 1, resn: 'GLY', atomName: 'O', coords: [2, 1, 0] },
      ];
      const alaAtoms: ProteinStructureInputAtom[] = [
        { chain: 'A', resi: 1, resn: 'ALA', atomName: 'N', coords: [0, 0, 0] },
        { chain: 'A', resi: 1, resn: 'ALA', atomName: 'CA', coords: [1, 0, 0] },
        { chain: 'A', resi: 1, resn: 'ALA', atomName: 'C', coords: [2, 0, 0] },
        { chain: 'A', resi: 1, resn: 'ALA', atomName: 'O', coords: [2, 1, 0] },
        { chain: 'A', resi: 1, resn: 'ALA', atomName: 'CB', coords: [1, 1, 0] },
      ];

      const { correspondence } = buildAtomCorrespondence(glyAtoms, alaAtoms, { atomScope: 'heavy' });
      // Gly has 4 atoms, Ala has 5 atoms -> only 4 matching heavy atoms are paired
      expect(correspondence.pairedAtoms.length).toBe(4);
      expect(correspondence.unmatchedTargetCount).toBe(1); // Ala CB is unmatched!
    });
  });

  // =========================================================================
  // 3. Alternate Locations & Multi-Model Structure Isolation (Step 17 & 18)
  // =========================================================================
  describe('3. Alternate Locations & Multi-Model Isolation (Step 17 & 18)', () => {
    it('deterministically selects conformer A and strictly eliminates double-counting of altLoc B', () => {
      const atomsWithAltLoc: ProteinStructureInputAtom[] = [
        { chain: 'A', resi: 10, atomName: 'CA', resn: 'SER', altLoc: 'A', coords: [10.0, 10.0, 10.0] },
        { chain: 'A', resi: 10, atomName: 'CA', resn: 'SER', altLoc: 'B', coords: [10.5, 10.2, 9.8] },
        { chain: 'A', resi: 10, atomName: 'CB', resn: 'SER', altLoc: 'A', coords: [11.0, 10.0, 10.0] },
        { chain: 'A', resi: 10, atomName: 'CB', resn: 'SER', altLoc: 'B', coords: [11.2, 10.4, 9.9] },
      ];

      const normalized = normalizeStructureAtoms(atomsWithAltLoc);
      expect(normalized.length).toBe(2); // Only CA and CB of conformer A!
      expect(normalized[0].coords).toEqual([10.0, 10.0, 10.0]);
      expect(normalized[1].coords).toEqual([11.0, 10.0, 10.0]);
    });

    it('isolates NMR Model 1 from Model 2 without mixing coordinates', () => {
      const nmrAtoms: ProteinStructureInputAtom[] = [
        { modelId: 1, chain: 'A', resi: 1, atomName: 'CA', coords: [1.0, 1.0, 1.0] },
        { modelId: 2, chain: 'A', resi: 1, atomName: 'CA', coords: [5.0, 5.0, 5.0] },
      ];

      const model1 = normalizeStructureAtoms(nmrAtoms, 1);
      const model2 = normalizeStructureAtoms(nmrAtoms, 2);

      expect(model1.length).toBe(1);
      expect(model1[0].coords).toEqual([1.0, 1.0, 1.0]);

      expect(model2.length).toBe(1);
      expect(model2[0].coords).toEqual([5.0, 5.0, 5.0]);
    });
  });

  // =========================================================================
  // 4. Kabsch Superposition & Pure Proper Rotation Invariants (Step 8 & 19)
  // =========================================================================
  describe('4. Kabsch Superposition & Mathematical Rotation Invariants (Step 8 & 19)', () => {
    const coordsA: [number, number, number][] = [
      [0.0, 0.0, 0.0],
      [1.5, 2.5, 0.5],
      [-2.0, 3.0, 1.8],
      [3.0, -1.5, 4.2],
      [0.8, 5.0, -2.5],
    ];

    it('guarantees det(R) = +1.0 (pure physical rotation, zero reflection/inversion)', () => {
      // Arbitrary non-identity target
      const coordsB: [number, number, number][] = [
        [10.0, 15.0, 20.0],
        [11.2, 17.1, 20.8],
        [8.1, 18.0, 22.0],
        [13.5, 14.0, 24.5],
        [10.5, 20.2, 18.0],
      ];

      const res = calculateWeightedKabschAlignment(coordsA, coordsB);
      expect(res.rotationDeterminant).toBeCloseTo(1.0, 3);
      expect(res.isProperRotation).toBe(true);
    });

    it('preserves pairwise distances under rigid transformation: ||Rx_i - Rx_j|| === ||x_i - x_j||', () => {
      const q: [number, number, number, number] = [Math.SQRT1_2, Math.SQRT1_2, 0, 0]; // Exact 90° rotation about X
      const R = quaternionToRotationMatrix(q);
      const t: [number, number, number] = [10, 20, 30];

      const transformed = applyRigidTransformation(coordsA, R, t);

      for (let i = 0; i < coordsA.length; i++) {
        for (let j = i + 1; j < coordsA.length; j++) {
          const originalDist = calculateRawCoordinateRmsd([coordsA[i]], [coordsA[j]]);
          const transDist = calculateRawCoordinateRmsd([transformed[i]], [transformed[j]]);
          expect(transDist).toBeCloseTo(originalDist, 3);
        }
      }
    });

    it('inverts rigid transformation cleanly: R^T (x\' - t) === x', () => {
      const q: [number, number, number, number] = [0.5, 0.5, 0.5, 0.5];
      const R = quaternionToRotationMatrix(q);
      const t: [number, number, number] = [15.2, -8.7, 42.0];

      const forward = applyRigidTransformation(coordsA, R, t);
      const { invR, invT } = invertRigidTransformation(R, t);
      const backward = applyRigidTransformation(forward, invR, invT);

      for (let i = 0; i < coordsA.length; i++) {
        expect(backward[i][0]).toBeCloseTo(coordsA[i][0], 4);
        expect(backward[i][1]).toBeCloseTo(coordsA[i][1], 4);
        expect(backward[i][2]).toBeCloseTo(coordsA[i][2], 4);
      }
    });

    it('satisfies identity of indiscernibles: RMSD(A, A) === 0.0000 Å', () => {
      const res = calculateWeightedKabschAlignment(coordsA, coordsA);
      expect(res.rmsd).toBe(0.0);
      expect(res.rawRmsd).toBe(0.0);
    });
  });

  // =========================================================================
  // 5. Mathematical Invariance: Translation & Rotation Invariance (Step 33)
  // =========================================================================
  describe('5. Mathematical Invariance Properties (Step 33)', () => {
    const setA: [number, number, number][] = [
      [0, 0, 0],
      [1, 2, 3],
      [-1, 4, 2],
      [3, -2, 1],
    ];
    const setB: [number, number, number][] = [
      [0.2, 0.1, -0.1],
      [1.1, 2.2, 3.0],
      [-0.9, 3.8, 2.1],
      [2.9, -1.9, 1.2],
    ];

    it('satisfies translation invariance: RMSD(A + t, B + t) === RMSD(A, B)', () => {
      const baseRmsd = calculateWeightedKabschAlignment(setA, setB).rmsd;

      const t: [number, number, number] = [100.0, -50.0, 25.0];
      const shiftedA = setA.map(([x, y, z]) => [x + t[0], y + t[1], z + t[2]] as [number, number, number]);
      const shiftedB = setB.map(([x, y, z]) => [x + t[0], y + t[1], z + t[2]] as [number, number, number]);

      const shiftedRmsd = calculateWeightedKabschAlignment(shiftedA, shiftedB).rmsd;
      expect(shiftedRmsd).toBeCloseTo(baseRmsd, 4);
    });

    it('satisfies rotation invariance: RMSD(R A, R B) === RMSD(A, B)', () => {
      const baseRmsd = calculateWeightedKabschAlignment(setA, setB).rmsd;

      // 90° rotation about Z
      const rotZ = (coords: [number, number, number][]) =>
        coords.map(([x, y, z]) => [-y, x, z] as [number, number, number]);

      const rotA = rotZ(setA);
      const rotB = rotZ(setB);

      const rotRmsd = calculateWeightedKabschAlignment(rotA, rotB).rmsd;
      expect(rotRmsd).toBeCloseTo(baseRmsd, 4);
    });
  });

  // =========================================================================
  // 6. Weighted RMSD & Outlier-Trimmed RMSD95 (Step 9 & 24)
  // =========================================================================
  describe('6. Weighted RMSD & Outlier-Trimmed RMSD95 (Step 9 & 24)', () => {
    it('computes authentic mass-weighted RMSD where heavier atoms dominate', () => {
      const pA: [number, number, number][] = [
        [0, 0, 0], // Carbon (12.011 Da)
        [5, 5, 5], // Iron (55.845 Da)
      ];
      const pB: [number, number, number][] = [
        [1, 0, 0], // Perturbed carbon by 1.0 Å
        [5, 5, 5], // Exact iron match (0.0 Å)
      ];

      const unweighted = calculateWeightedKabschAlignment(pA, pB, [1.0, 1.0], 'uniform');
      const massWeighted = calculateWeightedKabschAlignment(pA, pB, [12.011, 55.845], 'mass');

      // Unweighted RMSD treats both equally: sqrt((0.5^2 + 0.5^2)/2)
      // Mass-weighted RMSD heavily penalizes / rewards matching the heavy Iron atom!
      expect(massWeighted.weightedRmsd).toBeLessThan(unweighted.rmsd);
    });

    it('computes outlier-trimmed RMSD95 and explicitly reports excluded residue keys', () => {
      // 20 points, where 19 match perfectly (0.0 Å) and 1 is an extreme outlier (10.0 Å)
      const pA: [number, number, number][] = Array.from({ length: 20 }, (_, i) => [i, 0, 0]);
      const pB: [number, number, number][] = Array.from({ length: 20 }, (_, i) => [i, 0, 0]);
      pB[19] = [19, 10.0, 0]; // Extreme loop outlier at residue 20!

      const residueKeys = Array.from({ length: 20 }, (_, i) => `A:${i + 1}`);
      const trimmed = calculateTrimmedRmsd(pB, pA, residueKeys, 95);

      expect(trimmed.trimmingPercentage).toBe(95);
      expect(trimmed.includedCount).toBe(19);
      expect(trimmed.excludedCount).toBe(1);
      expect(trimmed.excludedResidueKeys).toEqual(['A:20']);
      expect(trimmed.trimmedRmsd).toBe(0.0); // Perfect core alignment!
    });
  });

  // =========================================================================
  // 7. Structural Similarity Metrics: TM-Score & GDT-TS (Step 21)
  // =========================================================================
  describe('7. Structural Similarity Metrics: TM-Score & GDT-TS (Step 21)', () => {
    it('computes characteristic d0(L) according to Zhang & Skolnick formula', () => {
      // For L <= 21, d0 = 0.5 Å
      expect(calculateTmScoreD0(15)).toBe(0.5);
      expect(calculateTmScoreD0(21)).toBe(0.5);

      // For L = 100: d0 = 1.24 * cbrt(100 - 15) - 1.8 = 1.24 * 4.397 - 1.8 = 5.452 - 1.8 = 3.65 Å
      const d0_100 = calculateTmScoreD0(100);
      expect(d0_100).toBeCloseTo(3.65, 1);
    });

    it('yields TM-score = 1.0 for identical structures', () => {
      const coords: [number, number, number][] = [
        [0, 0, 0], [1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12],
      ];
      const res = calculateTmScore(coords, coords, 5);
      expect(res.tmScore).toBe(1.0);
      expect(res.isSameFold).toBe(true);
    });

    it('computes CASP GDT-TS and GDT-HA scores across standard distance cutoffs', () => {
      // 4 points with displacements: 0.4 Å (passes all), 0.8 Å (passes 1,2,4,8), 3.0 Å (passes 4,8), 9.0 Å (passes none)
      const src: [number, number, number][] = [
        [0, 0, 0],
        [1, 0, 0],
        [2, 0, 0],
        [3, 0, 0],
      ];
      const tgt: [number, number, number][] = [
        [0.4, 0, 0], // d = 0.4 Å
        [1.8, 0, 0], // d = 0.8 Å
        [5.0, 0, 0], // d = 3.0 Å
        [12.0, 0, 0],// d = 9.0 Å
      ];

      const gdt = calculateGdtScores(src, tgt, 4);
      // P0.5: 1/4 = 25%
      // P1.0: 2/4 = 50%
      // P2.0: 2/4 = 50%
      // P4.0: 3/4 = 75%
      // P8.0: 3/4 = 75%
      expect(gdt.cutoffs.p0_5).toBe(25);
      expect(gdt.cutoffs.p1_0).toBe(50);
      expect(gdt.cutoffs.p2_0).toBe(50);
      expect(gdt.cutoffs.p4_0).toBe(75);
      expect(gdt.cutoffs.p8_0).toBe(75);

      // GDT-TS = (50 + 50 + 75 + 75) / 4 = 62.5%
      expect(gdt.gdtTs).toBe(62.5);
    });
  });

  // =========================================================================
  // 8. Distance Matrix & dRMSD (Rotation/Translation Invariant) (Step 26)
  // =========================================================================
  describe('8. Distance Matrix & Superposition-Free dRMSD (Step 26)', () => {
    const coords: [number, number, number][] = [
      [0, 0, 0],
      [3, 0, 0],
      [0, 4, 0],
    ];

    it('computes pairwise distance matrix matching Euclidean distances', () => {
      const mat = computeDistanceMatrix(coords);
      expect(mat[0][0]).toBe(0);
      expect(mat[0][1]).toBe(3.0);
      expect(mat[0][2]).toBe(4.0);
      expect(mat[1][2]).toBe(5.0); // 3-4-5 right triangle!
      expect(mat[2][1]).toBe(5.0); // Symmetry
    });

    it('dRMSD is strictly invariant under arbitrary translation and rotation WITHOUT superposition', () => {
      // Translate by (10, 20, 30) and rotate 90° about Y
      const shiftedAndRotated: [number, number, number][] = coords.map(([x, y, z]) => [
        z + 10.0,
        y + 20.0,
        -x + 30.0,
      ]);

      const dRmsd = calculateDistanceMatrixRmsd(coords, shiftedAndRotated);
      // dRMSD must be exactly 0.0000 Å without ever calling Kabsch!
      expect(dRmsd).toBe(0.0);
    });
  });

  // =========================================================================
  // 9. Contact-Map Comparison & CMO Overlap (Step 25)
  // =========================================================================
  describe('9. Contact-Map Adjacency & Overlap Comparison (Step 25)', () => {
    it('computes contact matrix and evaluates Jaccard and Dice overlap coefficients', () => {
      const coordsA: [number, number, number][] = [
        [0, 0, 0],   // 0
        [3, 0, 0],   // 1
        [6, 0, 0],   // 2
        [2, 2, 0],   // 3 (close to 0: d = sqrt(4 + 4) = 2.82 Å <= 5.0 Å, |3-0| = 3 >= 3)
      ];

      const matA = computeContactMatrix(coordsA, 5.0, 3);
      expect(matA[0][3]).toBe(true);
      expect(matA[3][0]).toBe(true);
      expect(matA[0][1]).toBe(false); // Seq sep < 3

      // Compare identical matrices
      const sim = calculateContactMapSimilarity(matA, matA, 5.0);
      expect(sim.jaccardSimilarity).toBe(1.0);
      expect(sim.diceSimilarity).toBe(1.0);
      expect(sim.commonContactsCount).toBe(1);
    });
  });

  // =========================================================================
  // 10. Unified High-Level Comparison & Deterministic Caching (Step 27 & 31)
  // =========================================================================
  describe('10. Unified Comparison Orchestrator & Provenance (Step 27, 28, 31)', () => {
    const rawStructureA: ProteinStructureInputAtom[] = [
      { chain: 'A', resi: 1, resn: 'ALA', atomName: 'CA', coords: [0, 0, 0] },
      { chain: 'A', resi: 2, resn: 'CYS', atomName: 'CA', coords: [3.8, 0, 0] },
      { chain: 'A', resi: 3, resn: 'ASP', atomName: 'CA', coords: [7.6, 0, 0] },
    ];
    const rawStructureB: ProteinStructureInputAtom[] = [
      { chain: 'A', resi: 1, resn: 'ALA', atomName: 'CA', coords: [0.1, 0, 0] },
      { chain: 'A', resi: 2, resn: 'CYS', atomName: 'CA', coords: [3.9, 0, 0] },
      { chain: 'A', resi: 3, resn: 'ASP', atomName: 'CA', coords: [7.7, 0, 0] },
    ];

    it('executes full comparison pipeline with rich biophysical metrics and provenance', () => {
      const result = compareProteinStructures(rawStructureA, rawStructureB, {
        sourceStructureId: '4HHB',
        targetStructureId: '1A3N',
        atomScope: 'CA',
      });

      expect(result.provenance.sourceStructureId).toBe('4HHB');
      expect(result.provenance.targetStructureId).toBe('1A3N');
      expect(result.superposition.pairedAtomCount).toBe(3);
      expect(result.metrics.coordinateRmsd).toBeCloseTo(0.0, 1);
      expect(result.metrics.tmScore).toBeGreaterThan(0.5);
      expect(result.epistemicStatus).toBe('ESTABLISHED');
    });

    it('returns cached result deterministically on repeated identical invocations', () => {
      const res1 = compareProteinStructures(rawStructureA, rawStructureB);
      const res2 = compareProteinStructures(rawStructureA, rawStructureB);
      expect(res1).toBe(res2); // Reference equality from cache!
    });
  });

  // =========================================================================
  // 11. Multi-Chain & Cross-Chain Matching (Step 11 & 12)
  // =========================================================================
  describe('11. Multi-Chain & Cross-Chain Scoping (Step 11 & 12)', () => {
    it('compares Chain A of Structure 1 to Chain B of Structure 2 without cross-chain contamination', () => {
      const struct1: ProteinStructureInputAtom[] = [
        { chain: 'A', resi: 1, resn: 'ALA', atomName: 'CA', coords: [0, 0, 0] },
        { chain: 'B', resi: 1, resn: 'TRP', atomName: 'CA', coords: [50, 50, 50] },
      ];
      const struct2: ProteinStructureInputAtom[] = [
        { chain: 'A', resi: 1, resn: 'GLY', atomName: 'CA', coords: [100, 100, 100] },
        { chain: 'B', resi: 1, resn: 'ALA', atomName: 'CA', coords: [0.1, 0, 0] },
      ];

      // Request explicit Chain A from struct1 vs Chain B from struct2
      const result = compareProteinStructures(struct1, struct2, {
        sourceChainId: 'A',
        targetChainId: 'B',
        atomScope: 'CA',
      });

      expect(result.superposition.pairedAtomCount).toBe(1);
      expect(result.atomCorrespondence.pairedAtoms[0].sourceAtom.chainId).toBe('A');
      expect(result.atomCorrespondence.pairedAtoms[0].targetAtom.chainId).toBe('B');
      expect(result.metrics.coordinateRmsd).toBeCloseTo(0.0, 1);
    });
  });

  // =========================================================================
  // 12. Negative Verification & Error Handling (Step 38)
  // =========================================================================
  describe('12. Negative Verification & Safe Error Handling (Step 38)', () => {
    it('throws descriptive error when coordinate arrays have unequal length in computeBackboneRMSD', () => {
      const cA: [number, number, number][] = [[0, 0, 0], [1, 1, 1]];
      const cB: [number, number, number][] = [[0, 0, 0]];
      expect(() => computeBackboneRMSD(cA, cB)).toThrow(/identical paired coordinate lengths/);
      expect(() => computeSuperposedRMSD(cA, cB)).toThrow(/identical paired coordinate lengths/);
    });

    it('throws descriptive error when no corresponding residues/atoms exist', () => {
      const emptyA: ProteinStructureInputAtom[] = [];
      const emptyB: ProteinStructureInputAtom[] = [];
      expect(() => compareProteinStructures(emptyA, emptyB)).toThrow(/No corresponding atoms found/);
    });
  });
});
