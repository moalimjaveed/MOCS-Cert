import { describe, it, expect, beforeEach } from 'vitest';
import {
  classifyExperimentalMethod,
  parseResolutionMetadata,
  parseCrystallographicRefinement,
  analyzeBfactorDistribution,
  analyzeOccupancyDistribution,
  auditMissingAtoms,
  auditMissingResidues,
  auditChainBreaks,
  calculateDihedralAngleDeg,
  evaluateRamachandran,
  auditStericClashes,
  evaluateBiologicalAssembly,
  auditStructureQuality,
  QualityCacheManager,
  qualityCache,
  STANDARD_AA_SIDECHAINS,
  VDW_RADII,
} from '../molecular/quality';

describe('PASS 13: Molecular Structure Quality, Experimental Evidence & Crystallographic Forensic Suite', () => {

  // =========================================================================
  // 1. EXPERIMENTAL METHOD CLASSIFICATION & RESOLUTION SEMANTICS
  // =========================================================================
  describe('1. Experimental Method Classification & Resolution Semantics', () => {
    it('accurately classifies experimental X-ray diffraction', () => {
      const method = classifyExperimentalMethod('X-RAY DIFFRACTION', 'protein');
      expect(method).toBe('X_RAY_DIFFRACTION');
    });

    it('accurately classifies Cryo-EM and solution NMR', () => {
      expect(classifyExperimentalMethod('ELECTRON MICROSCOPY')).toBe('ELECTRON_MICROSCOPY');
      expect(classifyExperimentalMethod('CRYO-EM')).toBe('ELECTRON_MICROSCOPY');
      expect(classifyExperimentalMethod('SOLUTION NMR')).toBe('SOLUTION_NMR');
      expect(classifyExperimentalMethod('SOLID-STATE NMR')).toBe('SOLID_STATE_NMR');
      expect(classifyExperimentalMethod('NEUTRON DIFFRACTION')).toBe('NEUTRON_DIFFRACTION');
    });

    it('accurately classifies computed models and synthetic benchmarks', () => {
      expect(classifyExperimentalMethod('COMPUTED STRUCTURE')).toBe('COMPUTED_PREDICTION');
      expect(classifyExperimentalMethod('ALPHAFOLD')).toBe('COMPUTED_PREDICTION');
      expect(classifyExperimentalMethod(null, 'synthetic')).toBe('SYNTHETIC_BENCHMARK');
      expect(classifyExperimentalMethod(null, 'predicted')).toBe('COMPUTED_PREDICTION');
    });

    it('extracts valid numeric resolution for diffraction methods', () => {
      const res = parseResolutionMetadata(1.74, 'X_RAY_DIFFRACTION');
      expect(res.resolutionAngstrom).toBe(1.74);
      expect(res.isDiffractionApplicable).toBe(true);
      expect(res.origin).toBe('SOURCE_METADATA');
      expect(res.notes).toContain('Bragg diffraction limit');
    });

    it('extracts Cryo-EM map resolution with appropriate disclaimer', () => {
      const res = parseResolutionMetadata('3.2', 'ELECTRON_MICROSCOPY');
      expect(res.resolutionAngstrom).toBe(3.2);
      expect(res.isDiffractionApplicable).toBe(true);
      expect(res.notes).toContain('cryo-EM map reconstruction resolution');
    });

    it('enforces null resolution for NMR structures', () => {
      const res = parseResolutionMetadata(2.0, 'SOLUTION_NMR');
      expect(res.resolutionAngstrom).toBeNull();
      expect(res.isDiffractionApplicable).toBe(false);
      expect(res.notes).toContain('NMR does not have a diffraction resolution');
    });

    it('enforces null resolution for computed predictions and rejects pLDDT string pollution', () => {
      const resA = parseResolutionMetadata('pLDDT 98.4', 'COMPUTED_PREDICTION');
      expect(resA.resolutionAngstrom).toBeNull();
      expect(resA.isDiffractionApplicable).toBe(false);
      expect(resA.notes).toContain('Computed predictions do not possess experimental diffraction limits');

      const resB = parseResolutionMetadata(1.5, 'COMPUTED_PREDICTION');
      expect(resB.resolutionAngstrom).toBeNull();
      expect(resB.isDiffractionApplicable).toBe(false);
    });

    it('rejects unphysical or invalid resolution values (<= 0 or NaN)', () => {
      const resZero = parseResolutionMetadata(0, 'X_RAY_DIFFRACTION');
      expect(resZero.resolutionAngstrom).toBeNull();
      expect(resZero.notes).toContain('Unrecorded or unphysical');

      const resNeg = parseResolutionMetadata(-1.5, 'X_RAY_DIFFRACTION');
      expect(resNeg.resolutionAngstrom).toBeNull();
    });
  });

  // =========================================================================
  // 2. CRYSTALLOGRAPHIC REFINEMENT (R-work vs R-free)
  // =========================================================================
  describe('2. Crystallographic Refinement (R-work vs R-free)', () => {
    it('parses valid R-work and R-free with proper provenance', () => {
      const ref = parseCrystallographicRefinement(
        {
          rWork: 0.185,
          rFree: 0.215,
          refinementProgram: 'REFMAC 5.8',
          spaceGroup: 'P 21 21 21',
          unitCell: { a: 64.2, b: 78.5, c: 102.3, alpha: 90, beta: 90, gamma: 90 },
          depositionYear: 2015,
        },
        'X_RAY_DIFFRACTION'
      );

      expect(ref.rWork).toBe(0.185);
      expect(ref.rFree).toBe(0.215);
      expect(ref.refinementProgram).toBe('REFMAC 5.8');
      expect(ref.spaceGroup).toBe('P 21 21 21');
      expect(ref.unitCell?.a).toBe(64.2);
      expect(ref.origin).toBe('SOURCE_METADATA');
      expect(ref.notes).toContain('Valid R-factor cross-validation');
    });

    it('handles pre-1992 structures (4HHB regression) where R-free is null', () => {
      const ref4HHB = parseCrystallographicRefinement(
        {
          rWork: 0.135,
          rFree: null,
          refinementProgram: 'CORELS',
          spaceGroup: 'P 1 21 1',
          unitCell: { a: 63.15, b: 83.59, c: 53.80, alpha: 90, beta: 99.34, gamma: 90 },
          depositionYear: 1984,
        },
        'X_RAY_DIFFRACTION'
      );

      expect(ref4HHB.rWork).toBe(0.135);
      expect(ref4HHB.rFree).toBeNull();
      expect(ref4HHB.notes).toContain('Pre-dates R-free cross-validation');
    });

    it('flags unphysical scenario where R-free is less than R-work', () => {
      const refSuspicious = parseCrystallographicRefinement(
        {
          rWork: 0.24,
          rFree: 0.19,
          depositionYear: 2010,
        },
        'X_RAY_DIFFRACTION'
      );

      expect(refSuspicious.rWork).toBe(0.24);
      expect(refSuspicious.rFree).toBe(0.19);
      expect(refSuspicious.notes).toContain('Atypical');
    });

    it('returns null refinement metrics for non-diffraction methods', () => {
      const refNMR = parseCrystallographicRefinement(
        { rWork: 0.15, rFree: 0.18 },
        'SOLUTION_NMR'
      );

      expect(refNMR.rWork).toBeNull();
      expect(refNMR.rFree).toBeNull();
      expect(refNMR.notes).toContain('Crystallographic R-factors are not applicable');
    });
  });

  // =========================================================================
  // 3. ATOMIC DISPLACEMENT PARAMETERS (B-FACTORS) & OCCUPANCY
  // =========================================================================
  describe('3. Atomic Displacement Parameters (B-factors) & Occupancy', () => {
    it('computes accurate B-factor statistics with backbone vs sidechain separation', () => {
      const sampleAtoms = [
        { name: 'N', resName: 'ALA', bFactor: 15.0, occupancy: 1.0 },
        { name: 'CA', resName: 'ALA', bFactor: 16.0, occupancy: 1.0 },
        { name: 'C', resName: 'ALA', bFactor: 17.0, occupancy: 1.0 },
        { name: 'O', resName: 'ALA', bFactor: 18.0, occupancy: 1.0 },
        { name: 'CB', resName: 'ALA', bFactor: 24.0, occupancy: 1.0 },
      ];

      const stats = analyzeBfactorDistribution(sampleAtoms);
      expect(stats.atomCount).toBe(5);
      expect(stats.minBfactor).toBe(15.0);
      expect(stats.maxBfactor).toBe(24.0);
      expect(stats.meanBfactor).toBe(18.0);
      expect(stats.medianBfactor).toBe(17.0);
      // Backbone (N, CA, C, O) mean = (15+16+17+18)/4 = 16.5
      expect(stats.backboneBfactor).toBe(16.5);
      // Sidechain (CB) mean = 24.0
      expect(stats.sidechainBfactor).toBe(24.0);
      expect(stats.interpretation).toContain('Atomic Displacement Parameters');
    });

    it('handles negative B-factor warning condition', () => {
      const invalidAtoms = [
        { name: 'CA', resName: 'GLY', bFactor: -5.0, occupancy: 1.0 },
      ];

      const stats = analyzeBfactorDistribution(invalidAtoms);
      expect(stats.interpretation).toContain('Negative B-factors detected');
    });

    it('analyzes occupancy distribution and alternate conformations', () => {
      const atoms = [
        { name: 'CA', resName: 'CYS', bFactor: 20, occupancy: 1.0 },
        { name: 'CB', resName: 'CYS', bFactor: 22, occupancy: 0.6, altLoc: 'A' },
        { name: 'SG', resName: 'CYS', bFactor: 25, occupancy: 0.6, altLoc: 'A' },
        { name: 'CB', resName: 'CYS', bFactor: 23, occupancy: 0.4, altLoc: 'B' },
        { name: 'SG', resName: 'CYS', bFactor: 26, occupancy: 0.4, altLoc: 'B' },
      ];

      const occStats = analyzeOccupancyDistribution(atoms);
      expect(occStats.meanOccupancy).toBe(0.6);
      expect(occStats.minOccupancy).toBe(0.4);
      expect(occStats.maxOccupancy).toBe(1.0);
      expect(occStats.fullOccupancyCount).toBe(1);
      expect(occStats.partialOccupancyCount).toBe(4);
      expect(occStats.zeroOccupancyCount).toBe(0);
      expect(occStats.hasAlternateConformations).toBe(true);
      expect(occStats.altLocIdentifiers).toEqual(['A', 'B']);
    });
  });

  // =========================================================================
  // 4. STRUCTURAL COMPLETENESS, MISSING ATOMS & CHAIN BREAKS
  // =========================================================================
  describe('4. Structural Completeness, Missing Atoms & Chain Breaks', () => {
    it('detects missing sidechain atoms in standard amino acids', () => {
      const residues = [
        {
          chainId: 'A',
          resNum: 10,
          resName: 'LYS',
          presentAtoms: ['N', 'CA', 'C', 'O', 'CB', 'CG', 'CD'], // Missing CE, NZ
        },
        {
          chainId: 'A',
          resNum: 11,
          resName: 'ALA',
          presentAtoms: ['N', 'CA', 'C', 'O', 'CB'], // Complete
        },
      ];

      const missing = auditMissingAtoms(residues);
      expect(missing.length).toBe(1);
      expect(missing[0].residueNumber).toBe(10);
      expect(missing[0].residueName).toBe('LYS');
      expect(missing[0].missingAtoms).toEqual(['CE', 'NZ']);
      expect(missing[0].isBackboneComplete).toBe(true);
    });

    it('identifies missing residues and classifies regions against canonical sequence', () => {
      const canonicalSeq = [
        { chainId: 'A', resNum: 1, resName: 'MET' },
        { chainId: 'A', resNum: 2, resName: 'GLN' },
        { chainId: 'A', resNum: 3, resName: 'ILE' },
        { chainId: 'A', resNum: 4, resName: 'PHE' },
        { chainId: 'A', resNum: 5, resName: 'VAL' },
      ];

      // Residue 1 (N-term) and 3 (Internal loop) missing
      const modeled = [
        { chainId: 'A', resNum: 2, resName: 'GLN', presentAtoms: ['CA'] },
        { chainId: 'A', resNum: 4, resName: 'PHE', presentAtoms: ['CA'] },
        { chainId: 'A', resNum: 5, resName: 'VAL', presentAtoms: ['CA'] },
      ];

      const missingRes = auditMissingResidues(canonicalSeq, modeled);
      expect(missingRes.length).toBe(2);

      const res1 = missingRes.find((r) => r.residueNumber === 1);
      expect(res1?.regionDescription).toBe('N_TERMINUS');

      const res3 = missingRes.find((r) => r.residueNumber === 3);
      expect(res3?.regionDescription).toBe('INTERNAL_LOOP');
    });

    it('detects peptide chain breaks when C-N distance exceeds 2.5 Angstroms', () => {
      const residues = [
        {
          chainId: 'A',
          resNum: 45,
          resName: 'PRO',
          presentAtoms: ['N', 'CA', 'C'],
          cCoord: [10.0, 0.0, 0.0] as [number, number, number],
        },
        {
          chainId: 'A',
          resNum: 50, // Non-contiguous sequence jump: loop gap
          resName: 'GLY',
          presentAtoms: ['N', 'CA', 'C'],
          nCoord: [18.0, 0.0, 0.0] as [number, number, number], // Distance = 8.0 A
        },
      ];

      const breaks = auditChainBreaks(residues);
      expect(breaks.length).toBe(1);
      expect(breaks[0].precedingResidueNumber).toBe(45);
      expect(breaks[0].succeedingResidueNumber).toBe(50);
      expect(breaks[0].measuredDistanceC_N).toBe(8.0);
      expect(breaks[0].breakType).toBe('DISORDERED_LOOP_GAP');
    });
  });

  // =========================================================================
  // 5. GEOMETRIC VALIDATION (RAMACHANDRAN & STERIC CLASHES)
  // =========================================================================
  describe('5. Geometric Validation (Ramachandran & Steric Clashes)', () => {
    it('calculates exact 4-point dihedral angle in degrees', () => {
      // Cis planar conformation (0 degrees)
      const p1: [number, number, number] = [0, 1, 0];
      const p2: [number, number, number] = [0, 0, 0];
      const p3: [number, number, number] = [1, 0, 0];
      const p4: [number, number, number] = [1, 1, 0];

      const dihedral = calculateDihedralAngleDeg(p1, p2, p3, p4);
      expect(dihedral).not.toBeNull();
      expect(Math.abs(dihedral!)).toBeCloseTo(0.0, 3);

      // Trans planar conformation (180 degrees)
      const p4Trans: [number, number, number] = [1, -1, 0];
      const dihedralTrans = calculateDihedralAngleDeg(p1, p2, p3, p4Trans);
      expect(dihedralTrans).not.toBeNull();
      expect(Math.abs(dihedralTrans!)).toBeCloseTo(180.0, 3);
    });

    it('evaluates Ramachandran angles and classifies alpha-helix into FAVORED', () => {
      // Typical alpha helix: phi ~ -57, psi ~ -47
      const backboneRes = [
        {
          chainId: 'A',
          resNum: 1,
          resName: 'ALA',
          n: [0, 0, 0] as [number, number, number],
          ca: [1.4, 0, 0] as [number, number, number],
          c: [2.0, 1.3, 0] as [number, number, number],
        },
        {
          chainId: 'A',
          resNum: 2,
          resName: 'ALA',
          prevC: [2.0, 1.3, 0] as [number, number, number],
          n: [2.9, 1.5, 0] as [number, number, number],
          ca: [3.8, 2.6, 0.5] as [number, number, number],
          c: [4.2, 3.4, -0.6] as [number, number, number],
          nextN: [5.2, 4.0, -0.2] as [number, number, number],
        },
      ];

      const rama = evaluateRamachandran(backboneRes);
      expect(rama.length).toBe(2);
      expect(rama[0].category).toBe('NOT_APPLICABLE'); // Terminal residue missing prevC
      expect(rama[1].phiDeg).not.toBeNull();
      expect(rama[1].psiDeg).not.toBeNull();
    });

    it('audits steric clashes excluding 1-2 and 1-3 bonded neighbors', () => {
      const atoms = [
        // Bonded 1-2 pair (same residue, covalent neighbor exclusion)
        {
          chainId: 'A',
          resNum: 10,
          resName: 'ALA',
          atomName: 'CA',
          element: 'C',
          coord: [-2.0, 0, 0] as [number, number, number],
        },
        {
          chainId: 'A',
          resNum: 10,
          resName: 'ALA',
          atomName: 'CB',
          element: 'C',
          coord: [0, 0, 0] as [number, number, number],
        },
        // Unbonded severe clash from chain B with CB (< 0.4 A overlap)
        // VDW Carbon = 1.70 A. Sum = 3.40 A. Distance = 2.0 A -> overlap = 1.4 A > 0.4 A
        {
          chainId: 'B',
          resNum: 88,
          resName: 'VAL',
          atomName: 'CG1',
          element: 'C',
          coord: [2.0, 0, 0] as [number, number, number],
        },
      ];

      const clashes = auditStericClashes(atoms);
      expect(clashes.length).toBe(1);
      expect(clashes[0].isSevereClash).toBe(true);
      expect(clashes[0].atomA.chainId).toBe('A');
      expect(clashes[0].atomB.chainId).toBe('B');
      expect(clashes[0].overlapDistance).toBeCloseTo(1.4, 2);
    });
  });

  // =========================================================================
  // 6. BIOLOGICAL ASSEMBLY VS ASYMMETRIC UNIT
  // =========================================================================
  describe('6. Biological Assembly vs Asymmetric Unit', () => {
    it('distinguishes author-defined biological assembly from asymmetric unit', () => {
      const bio = evaluateBiologicalAssembly({
        assemblyId: '1',
        details: 'Author-defined biological tetramer',
        oligomericState: 'tetrameric',
        transformCount: 4,
        stoichiometry: 'A2B2',
      });

      expect(bio.assemblyId).toBe('1');
      expect(bio.isAuthorDefined).toBe(true);
      expect(bio.isSoftwareGenerated).toBe(false);
      expect(bio.transformCount).toBe(4);
      expect(bio.stoichiometry).toBe('A2B2');
    });

    it('identifies software-generated assemblies (PQS/PISA)', () => {
      const bioPISA = evaluateBiologicalAssembly({
        assemblyId: '2',
        details: 'Software determined assembly by PISA',
        oligomericState: 'dimeric',
        transformCount: 2,
        stoichiometry: 'A2',
      });

      expect(bioPISA.isAuthorDefined).toBe(false);
      expect(bioPISA.isSoftwareGenerated).toBe(true);
    });
  });

  // =========================================================================
  // 7. REGRESSION BENCHMARKS (4HHB & 1BNA)
  // =========================================================================
  describe('7. Structural Regressions: 4HHB & 1BNA', () => {
    it('executes full 4HHB Deoxyhemoglobin crystallographic audit correctly', () => {
      const report = auditStructureQuality({
        structureId: '4HHB',
        method: 'X-RAY DIFFRACTION',
        resolution: 1.74,
        rWork: 0.135,
        rFree: null,
        refinementProgram: 'CORELS',
        spaceGroup: 'P 1 21 1',
        unitCell: { a: 63.15, b: 83.59, c: 53.80, alpha: 90, beta: 99.34, gamma: 90 },
        depositionYear: 1984,
        depositionDate: '1984-03-07',
        authors: ['Fermi, G.', 'Perutz, M.F.'],
        assembly: {
          assemblyId: '1',
          details: 'Hemoglobin tetramer (alpha2 beta2)',
          oligomericState: 'tetrameric',
          transformCount: 2,
          stoichiometry: 'A2B2',
        },
        atoms: [
          { name: 'FE', resName: 'HEM', bFactor: 14.2, occupancy: 1.0 },
          { name: 'N', resName: 'VAL', bFactor: 18.5, occupancy: 1.0 },
        ],
      });

      expect(report.structureId).toBe('4HHB');
      expect(report.method).toBe('X_RAY_DIFFRACTION');
      expect(report.isExperimental).toBe(true);
      expect(report.resolution.resolutionAngstrom).toBe(1.74);
      expect(report.refinement.rWork).toBe(0.135);
      expect(report.refinement.rFree).toBeNull();
      expect(report.refinement.spaceGroup).toBe('P 1 21 1');
      expect(report.biologicalAssembly?.stoichiometry).toBe('A2B2');
      expect(report.epistemicWarnings.some((w) => w.includes('1992'))).toBe(true);
    });

    it('executes full 1BNA B-DNA Dodecamer crystallographic audit correctly', () => {
      const report = auditStructureQuality({
        structureId: '1BNA',
        method: 'X-RAY DIFFRACTION',
        kind: 'nucleic',
        resolution: 1.90,
        rWork: 0.178,
        rFree: null,
        spaceGroup: 'P 21 21 21',
        unitCell: { a: 24.87, b: 40.39, c: 66.20, alpha: 90, beta: 90, gamma: 90 },
        depositionYear: 1981,
        depositionDate: '1981-05-18',
        authors: ['Drew, H.R.', 'Dickerson, R.E.'],
        atoms: [
          { name: 'P', resName: 'DC', bFactor: 22.1, occupancy: 1.0 },
          { name: 'O1P', resName: 'DC', bFactor: 28.3, occupancy: 1.0 },
        ],
      });

      expect(report.structureId).toBe('1BNA');
      expect(report.resolution.resolutionAngstrom).toBe(1.90);
      expect(report.refinement.rWork).toBe(0.178);
      expect(report.refinement.rFree).toBeNull();
      expect(report.ramachandran.totalEvaluated).toBe(0); // Nucleic acid has no peptide Ramachandran
    });
  });

  // =========================================================================
  // 8. EPISTEMIC TRACEABILITY & ASYNC RACE SAFETY
  // =========================================================================
  describe('8. Epistemic Traceability & Async Race Safety', () => {
    it('partitions all reported values into SOURCE_METADATA and DERIVED_ANALYSIS', () => {
      const report = auditStructureQuality({
        structureId: 'TEST',
        method: 'X-RAY DIFFRACTION',
        resolution: 2.1,
        rWork: 0.19,
        rFree: 0.23,
      });

      expect(report.sourceVersusDerivedMap.resolution).toBe('SOURCE_METADATA');
      expect(report.sourceVersusDerivedMap.rWork).toBe('SOURCE_METADATA');
      expect(report.sourceVersusDerivedMap.rFree).toBe('SOURCE_METADATA');
      expect(report.sourceVersusDerivedMap.spaceGroup).toBe('SOURCE_METADATA');
      expect(report.sourceVersusDerivedMap.bFactorSummary).toBe('DERIVED_ANALYSIS');
      expect(report.sourceVersusDerivedMap.occupancySummary).toBe('DERIVED_ANALYSIS');
      expect(report.sourceVersusDerivedMap.ramachandran).toBe('DERIVED_ANALYSIS');
      expect(report.sourceVersusDerivedMap.clashSummary).toBe('DERIVED_ANALYSIS');
    });

    it('QualityCacheManager handles monotonic sequence invalidation and prevents race conditions', () => {
      const cache = new QualityCacheManager();

      const seq1 = cache.nextSequence();
      expect(seq1).toBe(1);
      expect(cache.isCurrentSequence(seq1)).toBe(true);

      // New request dispatched before seq1 completes
      const seq2 = cache.nextSequence();
      expect(seq2).toBe(2);
      expect(cache.isCurrentSequence(seq1)).toBe(false); // seq1 is obsolete!
      expect(cache.isCurrentSequence(seq2)).toBe(true);  // seq2 is valid
    });

    it('QualityCacheManager correctly caches and retrieves structure reports', () => {
      const cache = new QualityCacheManager();
      const mockReport = auditStructureQuality({ structureId: '4HHB', resolution: 1.74 });

      const keyParams = { structureId: '4HHB', modelId: 1 };
      cache.set(keyParams, mockReport);

      expect(cache.has(keyParams)).toBe(true);
      const retrieved = cache.get(keyParams);
      expect(retrieved?.structureId).toBe('4HHB');

      cache.clear();
      expect(cache.has(keyParams)).toBe(false);
    });
  });
});
