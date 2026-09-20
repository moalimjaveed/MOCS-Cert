import { describe, it, expect } from 'vitest';
import {
  classifyResidue,
  classifyNucleicType,
  PROTEIN_RESIDUES,
  COFACTOR_RESIDUES,
  WATER_RESIDUES,
  ION_RESIDUES,
  parseQueryExpression,
  ConcurrencyManager,
  TrajectoryFrameCache,
} from '@mocs/core';
import {
  computeAngle,
  computeDihedral,
  computeRMSD,
  cartesianToFractional,
  fractionalToCartesian,
  validateUnitCell,
  minimumImageDistance,
  UnitCell,
} from '@mocs/geometry';

describe('V2 Comprehensive Scientific Suite', () => {
  describe('Biochemical Classification', () => {
    it('classifies standard and non-standard amino acids as protein', () => {
      expect(classifyResidue('ALA')).toBe('protein');
      expect(classifyResidue('HIS')).toBe('protein');
      expect(classifyResidue('MSE')).toBe('protein'); // Selenomethionine
      expect(classifyResidue('SEP')).toBe('protein'); // Phosphoserine
    });

    it('classifies cofactors, ligands, solvents, and ions correctly', () => {
      expect(classifyResidue('HEM')).toBe('cofactor');
      expect(classifyResidue('ATP')).toBe('cofactor');
      expect(classifyResidue('HOH')).toBe('solvent');
      expect(classifyResidue('TIP3')).toBe('solvent');
      expect(classifyResidue('FE')).toBe('ion');
      expect(classifyResidue('ZN')).toBe('ion');
      expect(classifyResidue('PO4')).toBe('buffer');
      expect(classifyResidue('NAG')).toBe('carbohydrate');
      expect(classifyResidue('DRUG_X')).toBe('ligand');
    });

    it('classifies DNA and RNA residues', () => {
      expect(classifyResidue('DA')).toBe('nucleic');
      expect(classifyNucleicType('DA')).toBe('dna');
      expect(classifyNucleicType('U')).toBe('rna');
    });
  });

  describe('Triclinic PBC & Unit Cell Math', () => {
    const orthogonalCell: UnitCell = {
      a: 50,
      b: 60,
      c: 70,
      alpha: 90,
      beta: 90,
      gamma: 90,
    };

    const triclinicCell: UnitCell = {
      a: 50,
      b: 60,
      c: 70,
      alpha: 85,
      beta: 95,
      gamma: 100,
    };

    it('validates physical plausibility of unit cells', () => {
      expect(validateUnitCell(orthogonalCell).ok).toBe(true);
      expect(validateUnitCell(triclinicCell).ok).toBe(true);

      const degenerateCell: UnitCell = { ...orthogonalCell, a: -10 };
      expect(validateUnitCell(degenerateCell).ok).toBe(false);

      const badAngleCell: UnitCell = { ...orthogonalCell, alpha: 190 };
      expect(validateUnitCell(badAngleCell).ok).toBe(false);
    });

    it('converts Cartesian to fractional and back symmetrically', () => {
      const point: [number, number, number] = [15.5, 25.2, 35.8];
      const frac = cartesianToFractional(point, triclinicCell);
      const cart = fractionalToCartesian(frac, triclinicCell);

      expect(cart[0]).toBeCloseTo(point[0], 5);
      expect(cart[1]).toBeCloseTo(point[1], 5);
      expect(cart[2]).toBeCloseTo(point[2], 5);
    });

    it('calculates minimum image distance across periodic boundaries', () => {
      const p1: [number, number, number] = [2, 10, 10];
      const p2: [number, number, number] = [48, 10, 10]; // separated by 46 Å in box of length 50 Å -> image distance is 4 Å
      const distRes = minimumImageDistance(p1, p2, orthogonalCell);
      expect(distRes.ok).toBe(true);
      if (!distRes.ok) return;
      expect(distRes.value).toBeCloseTo(4.0, 5);
    });
  });

  describe('Angle, Dihedral, and RMSD Calculations', () => {
    it('computes 90-degree orthogonal angle', () => {
      const a: [number, number, number] = [1, 0, 0];
      const b: [number, number, number] = [0, 0, 0]; // Vertex
      const c: [number, number, number] = [0, 1, 0];

      const res = computeAngle(a, b, c);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.value).toBeCloseTo(90.0, 4);
    });

    it('fails closed on degenerate coincident angle vertices', () => {
      const a: [number, number, number] = [0, 0, 0];
      const b: [number, number, number] = [0, 0, 0];
      const c: [number, number, number] = [0, 1, 0];
      expect(computeAngle(a, b, c).ok).toBe(false);
    });

    it('computes planar dihedral (trans = 180 deg)', () => {
      const a: [number, number, number] = [0, 1, 0];
      const b: [number, number, number] = [0, 0, 0];
      const c: [number, number, number] = [1, 0, 0];
      const d: [number, number, number] = [1, -1, 0];

      const res = computeDihedral(a, b, c, d);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(Math.abs(res.value)).toBeCloseTo(180.0, 2);
    });

    it('computes coordinate-difference RMSD', () => {
      const coordsA: [number, number, number][] = [
        [0, 0, 0],
        [1, 1, 1],
      ];
      const coordsB: [number, number, number][] = [
        [0, 0, 0],
        [1, 1, 2], // shifted by 1 along z at index 1
      ];

      const res = computeRMSD(coordsA, coordsB);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      // sumSq = 0^2 + 1^2 = 1 -> RMSD = sqrt(1 / 2) = ~0.7071
      expect(res.value.rmsdAngstrom).toBeCloseTo(Math.sqrt(0.5), 4);
      expect(res.value.atomCount).toBe(2);
    });
  });

  describe('Query AST Parser', () => {
    it('parses universal wildcard query', () => {
      const ast = parseQueryExpression('*');
      expect(ast.ok).toBe(true);
      if (!ast.ok) return;
      expect(ast.value.kind).toBe('all');
    });

    it('parses 3-part chain:seq:atom query', () => {
      const ast = parseQueryExpression('A:87:NE2');
      expect(ast.ok).toBe(true);
      if (!ast.ok) return;
      expect(ast.value.kind).toBe('tests');
      if (ast.value.kind !== 'tests') return;
      expect(ast.value.tests).toEqual([
        { kind: 'chain', asymId: 'A' },
        { kind: 'seqId', seqId: 87 },
        { kind: 'atomId', atomId: 'NE2' },
      ]);
    });

    it('parses 4-part chain:comp:seq:atom query with insertion code', () => {
      const ast = parseQueryExpression('A:HIS:87A:NE2');
      expect(ast.ok).toBe(true);
      if (!ast.ok) return;
      expect(ast.value.kind).toBe('tests');
      if (ast.value.kind !== 'tests') return;
      expect(ast.value.tests).toEqual([
        { kind: 'chain', asymId: 'A' },
        { kind: 'compId', compId: 'HIS' },
        { kind: 'seqId', seqId: 87 },
        { kind: 'insCode', insCode: 'A' },
        { kind: 'atomId', atomId: 'NE2' },
      ]);
    });
  });

  describe('Concurrency & LRU Trajectory Cache', () => {
    it('manages generations and detects stale requests', () => {
      const cm = new ConcurrencyManager();
      const dsGuard1 = cm.nextDataset();
      expect(cm.isDatasetStale(dsGuard1)).toBe(false);

      // Subsequent dataset increment invalidates dsGuard1
      cm.nextDataset();
      expect(cm.isDatasetStale(dsGuard1)).toBe(true);
    });

    it('bounds cache size and evicts least-recently-used trajectory frames', () => {
      const cache = new TrajectoryFrameCache(3);
      const makeFrame = (num: number) => ({
        frameNumber: num,
        timePicoseconds: num * 10,
        atomCount: 1,
        coordinates: new Float64Array([num, num, num]),
      });

      cache.set('traj-1', makeFrame(0));
      cache.set('traj-1', makeFrame(1));
      cache.set('traj-1', makeFrame(2));
      expect(cache.size).toBe(3);

      // Access frame 0 so frame 1 becomes oldest
      cache.get('traj-1', 0);

      // Adding frame 3 should evict frame 1
      cache.set('traj-1', makeFrame(3));
      expect(cache.size).toBe(3);
      expect(cache.get('traj-1', 1)).toBeNull();
      expect(cache.get('traj-1', 0)).not.toBeNull();
      expect(cache.get('traj-1', 3)).not.toBeNull();

      // Scoped eviction
      cache.evictTrajectory('traj-1');
      expect(cache.size).toBe(0);
    });
  });
});
