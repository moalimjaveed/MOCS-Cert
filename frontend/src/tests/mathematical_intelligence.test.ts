import { describe, it, expect } from 'vitest';
import {
  calculateCentroid,
  calculateRadiusOfGyration,
  calculateEuclideanDistance,
  calculateBondAngle,
  calculateDihedralAngle,
  calculateBackboneRMSD,
  calculateGeometryEngineMetrics,
  constructContactGraph,
  calculateBettiNumbers,
  calculateTopologyEngineMetrics,
  calculateSequenceCombinatorialSpace,
  calculateDiscreteSearchSpaceMetrics,
  benchmarkSearchStrategies,
  calculateComplexityEngineMetrics,
  calculateStokesEinsteinDiffusion,
  calculateHydrodynamicsMetrics,
  calculateCoulombicPotential,
  calculateDipoleMoment,
  detectPointGroupSymmetry,
  calculateMathematicalPhysicsMetrics,
  computeGraphLaplacianSpectrum,
  computePrimeResidueHash,
  computeModularPeriodicity,
  calculateNumberTheoreticSandboxMetrics,
  CURATED_HYPOTHESES,
  getHypothesesByStatus,
  getHypothesisById,
  analyzeStructureIntelligence,
  type CartesianAtom,
} from '../molecular/intelligence';

describe('Mathematical Protein Intelligence Subsystem', () => {
  // Test coordinate dataset: 4 tetrahedral-like atoms
  const sampleAtoms: CartesianAtom[] = [
    { id: 1, name: 'N', resName: 'ALA', resSeq: 1, chainId: 'A', x: 0.0, y: 0.0, z: 0.0, element: 'N', charge: -0.4 },
    { id: 2, name: 'CA', resName: 'ALA', resSeq: 1, chainId: 'A', x: 1.45, y: 0.0, z: 0.0, element: 'C', charge: 0.2 },
    { id: 3, name: 'C', resName: 'ALA', resSeq: 1, chainId: 'A', x: 2.0, y: 1.35, z: 0.0, element: 'C', charge: 0.5 },
    { id: 4, name: 'O', resName: 'ALA', resSeq: 1, chainId: 'A', x: 1.35, y: 2.35, z: 0.2, element: 'O', charge: -0.5 },
  ];

  describe('1. Geometry Engine (ESTABLISHED)', () => {
    it('calculates exact Cartesian centroid', () => {
      const centroid = calculateCentroid(sampleAtoms);
      expect(centroid[0]).toBeCloseTo((0 + 1.45 + 2.0 + 1.35) / 4, 3);
      expect(centroid[1]).toBeCloseTo((0 + 0 + 1.35 + 2.35) / 4, 3);
      expect(centroid[2]).toBeCloseTo((0 + 0 + 0 + 0.2) / 4, 3);
    });

    it('calculates radius of gyration (Rg)', () => {
      const rg = calculateRadiusOfGyration(sampleAtoms);
      expect(rg).toBeGreaterThan(0);
      expect(rg).toBeCloseTo(1.24, 1);
    });

    it('calculates pairwise Euclidean distance', () => {
      const d = calculateEuclideanDistance([0, 0, 0], [3, 4, 0]);
      expect(d).toBe(5.0);
    });

    it('calculates bond angle between three points', () => {
      // Points at (1,0,0), (0,0,0), (0,1,0) should form a 90-degree right angle
      const angle = calculateBondAngle([1, 0, 0], [0, 0, 0], [0, 1, 0]);
      expect(angle).toBeCloseTo(90.0, 2);
    });

    it('calculates dihedral torsion angle', () => {
      const p1: [number, number, number] = [0, 1, 0];
      const p2: [number, number, number] = [0, 0, 0];
      const p3: [number, number, number] = [1, 0, 0];
      const p4: [number, number, number] = [1, 1, 0]; // planar cis conformation
      const dihedral = calculateDihedralAngle(p1, p2, p3, p4);
      expect(dihedral).not.toBeNull();
      expect(Math.abs(dihedral!)).toBeCloseTo(0, 1);
    });

    it('calculates backbone RMSD correctly', () => {
      const coordsA: [number, number, number][] = [[0, 0, 0], [1, 1, 1]];
      const coordsB: [number, number, number][] = [[0, 0, 0], [1, 1, 1]];
      expect(calculateBackboneRMSD(coordsA, coordsB)).toBe(0.0);

      const coordsC: [number, number, number][] = [[0, 0, 0], [1, 1, 2]];
      expect(calculateBackboneRMSD(coordsA, coordsC)).toBeCloseTo(Math.sqrt(0.5), 3);
    });

    it('produces verified geometry engine metrics bundle with ESTABLISHED status', () => {
      const metrics = calculateGeometryEngineMetrics(sampleAtoms);
      expect(metrics.status).toBe('ESTABLISHED');
      expect(metrics.atomCount).toBe(4);
      expect(metrics.radiusOfGyration).toBeGreaterThan(0);
    });
  });

  describe('2. Topology Engine (EXPERIMENTAL)', () => {
    it('constructs molecular contact graph at threshold cutoff', () => {
      const graph = constructContactGraph(sampleAtoms, 2.0);
      expect(graph.vertexCount).toBe(4);
      expect(graph.edgeCount).toBeGreaterThan(0);
    });

    it('calculates Betti numbers (beta_0, beta_1, beta_2)', () => {
      const graph = constructContactGraph(sampleAtoms, 2.0);
      const betti = calculateBettiNumbers(graph);
      expect(betti.beta0).toBeGreaterThanOrEqual(1);
      expect(betti.beta1).toBeGreaterThanOrEqual(0);
      expect(betti.beta2).toBeNull();
      expect(betti.beta2Status).toBe('UNSUPPORTED');
    });

    it('produces topology engine metrics with EXPERIMENTAL status', () => {
      const metrics = calculateTopologyEngineMetrics(sampleAtoms, 4.0);
      expect(metrics.status).toBe('EXPERIMENTAL');
      expect(metrics.bettiNumbers.beta0).toBe(1); // fully connected at 4.0 A
      expect(metrics.filtrationSummary?.persistencePairs.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('3. Complexity Engine (ESTABLISHED)', () => {
    it('computes sequence combinatorial search space 20^N accurately', () => {
      const c1 = calculateSequenceCombinatorialSpace(1);
      expect(c1.scientificNotation).toBe('2.000e+1');

      const c5 = calculateSequenceCombinatorialSpace(5);
      expect(c5.rawExponent).toBe(5);
      expect(c5.log10Combinations).toBeCloseTo(5 * Math.log10(20), 4);

      // Hemoglobin alpha 141 residues
      const c141 = calculateSequenceCombinatorialSpace(141);
      expect(c141.rawExponent).toBe(141);
      expect(c141.scientificNotation).toContain('e+183');
    });

    it('computes discrete search space branching and pruning benchmarks', () => {
      const discrete = calculateDiscreteSearchSpaceMetrics(100, 1000);
      expect(discrete.totalConformations).toContain('e+');
      expect(discrete.pruningEfficiencyPercent).toBeGreaterThan(95);

      const bench = benchmarkSearchStrategies(140);
      expect(bench.length).toBe(4);
      const mocs = bench.find((b) => b.strategy.includes('MOCS Proof-Guided'));
      expect(mocs?.soundnessGuarantee).toBe(true);
    });

    it('produces complete complexity metrics bundle with ESTABLISHED status', () => {
      const metrics = calculateComplexityEngineMetrics('VLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSH', 97.4);
      expect(metrics.status).toBe('ESTABLISHED');
      expect(metrics.sequenceCombinatorialSpace.sequenceLength).toBe(50);
    });
  });

  describe('4. Hydrodynamics & Mathematical Physics (EXPERIMENTAL)', () => {
    it('calculates Stokes-Einstein translational diffusion coefficient D', () => {
      // Rg = 15 A => Rh = 0.77 * 15 = 11.55 A = 1.155e-9 m
      const diff = calculateStokesEinsteinDiffusion(15.0);
      expect(diff.diffusionCoefficient_m2_per_s).toBeGreaterThan(0);
      expect(diff.diffusionCoefficient_m2_per_s).toBeLessThan(1e-9);
      expect(diff.status).toBe('EXPERIMENTAL');
      expect(diff.hydrodynamicRadius_A).toBeCloseTo(15.0 * 0.774, 1);
    });

    it('calculates Coulombic potential and dipole moment', () => {
      const phi = calculateCoulombicPotential(sampleAtoms, [5, 5, 5]);
      expect(Number.isFinite(phi)).toBe(true);

      const dipole = calculateDipoleMoment(sampleAtoms);
      expect(dipole.magnitude_Debye).toBeGreaterThanOrEqual(0);
      expect(dipole.dipoleVector.length).toBe(3);
    });

    it('detects point group symmetry candidates', () => {
      const sym4hhb = detectPointGroupSymmetry('4HHB', sampleAtoms);
      expect(sym4hhb.pointGroup).toBe('D2');
      expect(sym4hhb.order).toBe(4);

      const symGen = detectPointGroupSymmetry('OTHER', sampleAtoms);
      expect(symGen.pointGroup).toBe('C1');
    });

    it('produces hydrodynamics and mathematical physics metrics bundle', () => {
      const hydro = calculateHydrodynamicsMetrics(sampleAtoms);
      expect(hydro.status).toBe('EXPERIMENTAL');
      expect(hydro.stokesEinstein.temperature_K).toBe(298.15);

      const physics = calculateMathematicalPhysicsMetrics(sampleAtoms, '4HHB');
      expect(physics.status).toBe('EXPERIMENTAL');
      expect(physics.symmetry.pointGroup).toBe('D2');
    });
  });

  describe('5. Number-Theoretic Sandbox (SPECULATIVE)', () => {
    it('computes graph Laplacian spectrum and algebraic connectivity', () => {
      const graph = constructContactGraph(sampleAtoms, 2.0);
      const spec = computeGraphLaplacianSpectrum(graph);
      expect(spec.status).toBe('SPECULATIVE');
      expect(spec.eigenvalues.length).toBe(4);
      expect(spec.algebraicConnectivity_lambda2).toBeGreaterThanOrEqual(0);
      expect(spec.spectralRadius_lambdaMax).toBeGreaterThanOrEqual(spec.algebraicConnectivity_lambda2);
    });

    it('computes deterministic prime residue hash and modular periodicity', () => {
      const hash1 = computePrimeResidueHash('MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSH');
      const hash2 = computePrimeResidueHash('MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSH');
      expect(hash1.hexDigest).toBe(hash2.hexDigest);
      expect(hash1.primeBase).toBe(31);

      const periodicity = computeModularPeriodicity('AAAAABBBBBCCCCCDDDDD', 5);
      expect(periodicity.periodLength).toBe(5);
    });

    it('enforces mandatory non-violation disclaimers on speculative numbers', () => {
      const metrics = calculateNumberTheoreticSandboxMetrics(sampleAtoms, 'HEMOGLOBIN');
      expect(metrics.status).toBe('SPECULATIVE');
      expect(metrics.disclaimer).toContain('Hypothesis Testing Sandbox Only');
      expect(metrics.disclaimer).toContain('Zero biological certification');
    });
  });

  describe('6. Research Hypotheses Registry (Section 41)', () => {
    it('contains curated hypotheses meeting MOCS specifications', () => {
      expect(CURATED_HYPOTHESES.length).toBeGreaterThanOrEqual(5);

      CURATED_HYPOTHESES.forEach((h) => {
        expect(h.id).toBeDefined();
        expect(h.title).toBeDefined();
        expect(h.statement).toBeDefined();
        expect(h.mathematicalFormalism).toBeDefined();
        expect(h.validationProtocol).toBeDefined();
        expect(h.falsificationCriteria).toBeDefined();
        expect(h.confidenceScore).toBeGreaterThanOrEqual(0);
        expect(h.confidenceScore).toBeLessThanOrEqual(1);
        expect(['ESTABLISHED', 'EXPERIMENTAL', 'RESEARCH_HYPOTHESIS', 'SPECULATIVE']).toContain(h.status);
      });
    });

    it('filters hypotheses by epistemic status', () => {
      const established = getHypothesesByStatus('ESTABLISHED');
      expect(established.every((h) => h.status === 'ESTABLISHED')).toBe(true);

      const experimental = getHypothesesByStatus('EXPERIMENTAL');
      expect(experimental.every((h) => h.status === 'EXPERIMENTAL')).toBe(true);

      const speculative = getHypothesesByStatus('SPECULATIVE');
      expect(speculative.every((h) => h.status === 'SPECULATIVE')).toBe(true);
    });

    it('finds hypothesis by ID', () => {
      const h1 = getHypothesisById('HYP-001');
      expect(h1).toBeDefined();
      expect(h1?.id).toBe('HYP-001');

      const missing = getHypothesisById('NON_EXISTENT');
      expect(missing).toBeUndefined();
    });
  });

  describe('7. High-Level Master Analysis Pipeline', () => {
    it('runs analyzeStructureIntelligence and populates all 6 engines', () => {
      const analysis = analyzeStructureIntelligence({
        structureId: '4HHB',
        atoms: sampleAtoms,
        sequence: 'VLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSH',
        measuredPruningRate: 97.4,
      });

      expect(analysis.structureId).toBe('4HHB');
      expect(analysis.geometry.status).toBe('ESTABLISHED');
      expect(analysis.topology.status).toBe('EXPERIMENTAL');
      expect(analysis.complexity.status).toBe('ESTABLISHED');
      expect(analysis.hydrodynamics.status).toBe('EXPERIMENTAL');
      expect(analysis.mathematicalPhysics?.status).toBe('EXPERIMENTAL');
      expect(analysis.numberTheoretic?.status).toBe('SPECULATIVE');
      expect(analysis.hypotheses?.length).toBeGreaterThanOrEqual(5);
    });

    it('handles empty atom arrays gracefully with fallback geometry', () => {
      const analysis = analyzeStructureIntelligence({
        structureId: 'EMPTY_TEST',
        atoms: [],
      });

      expect(analysis.geometry.atomCount).toBe(0);
      expect(analysis.geometry.radiusOfGyration).toBe(0);
      expect(analysis.topology.bettiNumbers.beta0).toBe(0);
    });
  });
});
