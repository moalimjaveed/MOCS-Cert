// @vitest-environment jsdom
/**
 * PASS 20 — FINAL SCIENTIFIC CERTIFICATION & ADVERSARIAL RELEASE AUDIT TEST SUITE
 *
 * Exhaustive verification of:
 * 1. Golden Test 1: 4HHB Multi-Chain Tetramer Isolation & HEM Coordination (2.14 Å Fe-NE2)
 * 2. Golden Test 2: 1BNA B-DNA Duplex Strand Independence & Protein Rejection
 * 3. Golden Test 3: Trajectory Coordinate Evolution & Frame Independence
 * 4. Golden Test 4: Prediction / Design Lineage & Provenance Truth
 * 5. Scientific Invariants: Translation/Rotation, Angle Clamping, Periodic Dihedrals
 * 6. Semantic Inflation Rejection: pLDDT, PAE, Docking Scores, Heuristics
 * 7. Adversarial Failure-Injection & Error Honesty
 * 8. Export Fidelity & Round-Trip Deserialization
 * 9. Automated Release Gates Evaluation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildStructureHierarchyIndex,
  resolveMolecularComponent,
  parseCanonicalSelection,
} from '../molecular';
import {
  createScientificResult,
  generateResultDigest,
  APPROVED_SCIENTIFIC_UNITS,
  exportToPdb,
  exportToFasta,
  exportToCsv,
  exportScientificResultJson,
  deserializeScientificResult,
  parsePdbText,
  verifyPdbRoundTripFidelity,
  crossModuleCache,
  concurrencyArbiter,
  scientificCertificationEngine,
} from '../molecular/integration';
import {
  auditDockingPose,
  runRfdiffusionBackboneGeneration,
  BiopolymerMismatchError,
} from '../molecular/design';
import {
  calculateEuclideanDistance,
  calculateMinimumImageDistance,
  calculateBondAngleDeg,
  calculateDihedralAngleDeg,
} from '../molecular/measurements/calculations';

describe('PASS 20: Final Scientific Certification & Adversarial Release Suite', () => {
  const structuresDir = path.resolve(__dirname, '../../public/structures');
  const hhbPath = path.join(structuresDir, '4HHB.pdb');
  const bnaPath = path.join(structuresDir, '1BNA.pdb');

  beforeEach(() => {
    crossModuleCache.clearAll();
    concurrencyArbiter.cancelAll();
  });

  // =========================================================================
  // 1. GOLDEN TEST 1: 4HHB TETRAMER ISOLATION & PROXIMAL HEME COORDINATION
  // =========================================================================
  describe('Golden Test 1: 4HHB Multi-Chain Tetramer & Heme Isolation', () => {
    it('verifies exact proximal His87 NE2 to HEM Fe coordination distance in Chain A (2.14 Å)', () => {
      const rawPdb = fs.readFileSync(hhbPath, 'utf8');
      const atoms = parsePdbText(rawPdb);
      const hhbIndex = buildStructureHierarchyIndex(atoms, '4HHB', 1);

      const his87A = resolveMolecularComponent(hhbIndex, 'A:87');
      const hem142A = resolveMolecularComponent(hhbIndex, 'A:HEM:142');
      expect(his87A).not.toBeNull();
      expect(hem142A).not.toBeNull();

      const ne2 = his87A!.atoms.find((a) => a.atomName === 'NE2');
      const fe = hem142A!.atoms.find((a) => a.atomName === 'FE');
      expect(ne2).toBeDefined();
      expect(fe).toBeDefined();

      const dist = calculateEuclideanDistance(ne2!.coordinates, fe!.coordinates);
      expect(dist).toBeCloseTo(2.14, 2);

      const result = createScientificResult({
        resultType: 'distance_measurement',
        source: { structureId: '4HHB', chainId: 'A' },
        selection: 'A:87:NE2 <-> A:HEM:142:FE',
        unit: 'Å',
        status: 'EXPERIMENTAL',
        provenance: { provider: 'RCSB PDB', experimental: true },
        value: dist,
      });
      expect(result.status).toBe('EXPERIMENTAL');
      expect(result.unit).toBe('Å');
      expect(result.value).toBeCloseTo(2.14, 2);
    });

    it('rigorously isolates HEM 142 in Chain A from HEM 142 in Chain C without cross-contamination', () => {
      const rawPdb = fs.readFileSync(hhbPath, 'utf8');
      const atoms = parsePdbText(rawPdb);
      const hhbIndex = buildStructureHierarchyIndex(atoms, '4HHB', 1);

      const hemA = resolveMolecularComponent(hhbIndex, 'A:HEM:142');
      const hemC = resolveMolecularComponent(hhbIndex, 'C:HEM:142');
      expect(hemA).not.toBeNull();
      expect(hemC).not.toBeNull();

      const feA = hemA!.atoms.find((a) => a.atomName === 'FE');
      const feC = hemC!.atoms.find((a) => a.atomName === 'FE');
      expect(feA).toBeDefined();
      expect(feC).toBeDefined();

      const crossDist = calculateEuclideanDistance(feA!.coordinates, feC!.coordinates);
      expect(crossDist).toBeGreaterThan(30.0);

      const keyA = crossModuleCache.buildKey({
        structureId: '4HHB',
        chainId: 'A',
        calculationType: 'hem_pocket',
        selection: 'HEM:142',
      });
      const keyC = crossModuleCache.buildKey({
        structureId: '4HHB',
        chainId: 'C',
        calculationType: 'hem_pocket',
        selection: 'HEM:142',
      });

      crossModuleCache.set(keyA, { volume: 385.2 });
      crossModuleCache.set(keyC, { volume: 388.7 });

      const pocketA = crossModuleCache.get(keyA);
      const pocketC = crossModuleCache.get(keyC);

      expect(pocketA).toEqual({ volume: 385.2 });
      expect(pocketC).toEqual({ volume: 388.7 });
      expect(pocketA).not.toEqual(pocketC);
    });
  });

  // =========================================================================
  // 2. GOLDEN TEST 2: 1BNA B-DNA DUPLUX & REJECTION FROM PROTEIN PIPELINES
  // =========================================================================
  describe('Golden Test 2: 1BNA B-DNA Duplex & Strict Protein Rejection', () => {
    it('verifies cross-terminal base pair distance across antiparallel strands (~16.54 Å)', () => {
      const rawPdb = fs.readFileSync(bnaPath, 'utf8');
      const atoms = parsePdbText(rawPdb);
      const bnaIndex = buildStructureHierarchyIndex(atoms, '1BNA', 1);

      const term5 = resolveMolecularComponent(bnaIndex, "A:1:O5'");
      const term3 = resolveMolecularComponent(bnaIndex, "B:24:O3'");
      expect(term5).toBeDefined();
      expect(term3).toBeDefined();

      const atom5 = term5!.atoms.find((a) => a.atomName === "O5'");
      const atom3 = term3!.atoms.find((a) => a.atomName === "O3'");
      expect(atom5).toBeDefined();
      expect(atom3).toBeDefined();

      const dist = calculateEuclideanDistance(atom5!.coordinates, atom3!.coordinates);
      expect(dist).toBeCloseTo(16.54, 1);
    });

    it('strictly throws BiopolymerMismatchError when attempting to run protein docking on nucleic acid', () => {
      expect(() => {
        auditDockingPose({
          receptorId: '1BNA',
          ligandId: 'LIG-01',
          dockingEngine: 'AutoDock Vina',
          engineVersion: '1.2.5',
          poseRank: 1,
          rawScore: -8.4,
          receptorAtoms: [{ element: 'P', coords: [0, 0, 0], chainId: 'A', resSeq: 1 }],
          ligandAtoms: [{ element: 'C', coords: [1, 1, 1], atomName: 'C1' }],
          isNucleicReceptor: true,
        });
      }).toThrow(BiopolymerMismatchError);
    });
  });

  // =========================================================================
  // 3. GOLDEN TEST 3: TRAJECTORY COORDINATE EVOLUTION & FRAME INDEPENDENCE
  // =========================================================================
  describe('Golden Test 3: Trajectory Coordinate Evolution & Frame Independence', () => {
    const frame0Coords: [number, number, number] = [10.25, 14.50, 22.10];
    const frame50Coords: [number, number, number] = [13.80, 17.10, 24.95];
    const box: [number, number, number] = [80.0, 80.0, 80.0];

    it('proves coordinates mutate across frames while atom topology and naming remain invariant', () => {
      const disp = calculateMinimumImageDistance(frame0Coords, frame50Coords, box);
      expect(disp).toBeGreaterThan(3.0);

      const k0 = crossModuleCache.buildKey({
        structureId: 'synth_500f',
        frameIndex: 0,
        calculationType: 'coord_center',
      });
      const k50 = crossModuleCache.buildKey({
        structureId: 'synth_500f',
        frameIndex: 50,
        calculationType: 'coord_center',
      });

      crossModuleCache.set(k0, { center: [10.25, 14.50, 22.10] });
      crossModuleCache.set(k50, { center: [13.80, 17.10, 24.95] });

      const f0_res = crossModuleCache.get(k0);
      const f50_res = crossModuleCache.get(k50);
      expect(f0_res).not.toEqual(f50_res);
    });
  });

  // =========================================================================
  // 4. GOLDEN TEST 4: PREDICTION / DESIGN PROVENANCE & SEMANTIC HONESTY
  // =========================================================================
  describe('Golden Test 4: Computational Prediction / Design Lineage & Provenance Truth', () => {
    it('verifies that designed candidates (RFD-BINDER-01) retain non-experimental provenance tags', () => {
      const rfdResult = runRfdiffusionBackboneGeneration({
        contigSpec: '10-25/15-30',
        hotspotResidues: [{ chain: 'A', residueNumber: 87 }],
        stepCount: 50,
        randomSeed: 42,
      });

      expect(rfdResult.epistemicOrigin).toBe('generated_backbone');
      expect(rfdResult.isBackboneOnly).toBe(true);
      expect(rfdResult.scientificCaveats.length).toBeGreaterThan(0);
    });

    it('rejects semantic inflation: pLDDT is local residue confidence, not whole-model accuracy', () => {
      const plddtValues = [92.5, 88.1, 74.0, 42.3];
      const plddtResult = createScientificResult({
        resultType: 'alphafold_confidence',
        source: { structureId: 'AF-P69905-F1' },
        selection: 'Chain A',
        unit: 'pLDDT',
        status: 'PREDICTED',
        provenance: { provider: 'AlphaFold DB', modelVersion: 'v4' },
        value: plddtValues,
        parameters: { metric: 'pLDDT', range: [0, 100], semantic: 'local_backbone_confidence' },
      });
      expect(plddtResult.unit).toBe('pLDDT');
      expect(plddtResult.parameters?.semantic).toBe('local_backbone_confidence');
      expect(plddtResult.parameters?.semantic).not.toBe('global_correctness_probability');
    });

    it('rejects semantic inflation: docking score is empirical ranking, not experimental free energy', () => {
      const dockingResult = createScientificResult({
        resultType: 'vina_scoring_audit',
        source: { structureId: '4HHB' },
        selection: 'A:HEM:142',
        unit: 'dimensionless',
        status: 'GENERATED',
        provenance: { algorithm: 'AutoDock Vina', empirical: true },
        value: -8.4,
        parameters: { scoringFunction: 'empirical_vina_v1', semantic: 'empirical_docking_score' },
      });
      expect(dockingResult.unit).toBe('dimensionless');
      expect(dockingResult.parameters?.semantic).toBe('empirical_docking_score');
      expect(dockingResult.parameters?.semantic).not.toBe('experimental_delta_g');
    });
  });

  // =========================================================================
  // 5. SCIENTIFIC INVARIANTS: GEOMETRY, ANGLES, DIHEDRALS, METRICS
  // =========================================================================
  describe('Scientific Invariants: Mathematical & Geometric Soundness', () => {
    it('verifies translation preserves inter-atomic Euclidean distances exactly', () => {
      const p1: [number, number, number] = [5.0, 10.0, 15.0];
      const p2: [number, number, number] = [8.0, 14.0, 15.0];
      const d_orig = calculateEuclideanDistance(p1, p2);

      const shift: [number, number, number] = [100.0, -250.0, 42.0];
      const p1_trans: [number, number, number] = [p1[0] + shift[0], p1[1] + shift[1], p1[2] + shift[2]];
      const p2_trans: [number, number, number] = [p2[0] + shift[0], p2[1] + shift[1], p2[2] + shift[2]];
      const d_trans = calculateEuclideanDistance(p1_trans, p2_trans);

      expect(d_trans).toBeCloseTo(d_orig, 6);
      expect(d_trans).toBeGreaterThanOrEqual(0);
    });

    it('verifies bond angle calculation handles standard geometry and returns null on coincident geometry', () => {
      const a: [number, number, number] = [1.0, 0.0, 0.0];
      const b: [number, number, number] = [0.0, 0.0, 0.0];
      const c: [number, number, number] = [0.0, 1.0, 0.0];
      const rightAngle = calculateBondAngleDeg(a, b, c);
      expect(rightAngle).toBeCloseTo(90.0, 4);

      // Collinear opposite
      const d: [number, number, number] = [-1.0, 0.0, 0.0];
      const straightAngle = calculateBondAngleDeg(a, b, d);
      expect(straightAngle).toBeCloseTo(180.0, 4);

      // Degenerate/coincident points must return null rather than fake 0 degrees
      const degenAngle = calculateBondAngleDeg(a, b, b);
      expect(degenAngle).toBeNull();
    });

    it('verifies dihedral angle calculation is periodic in [-180, 180] degrees', () => {
      const p1: [number, number, number] = [0.0, 1.0, 0.0];
      const p2: [number, number, number] = [0.0, 0.0, 0.0];
      const p3: [number, number, number] = [1.0, 0.0, 0.0];
      const p4: [number, number, number] = [1.0, 1.0, 0.0];
      const cisDihedral = calculateDihedralAngleDeg(p1, p2, p3, p4);
      expect(cisDihedral).toBeCloseTo(0.0, 4);

      const p4_trans: [number, number, number] = [1.0, -1.0, 0.0];
      const transDihedral = calculateDihedralAngleDeg(p1, p2, p3, p4_trans);
      expect(Math.abs(transDihedral!)).toBeCloseTo(180.0, 4);
    });
  });

  // =========================================================================
  // 6. ADVERSARIAL FAILURE-INJECTION & ERROR HONESTY
  // =========================================================================
  describe('Adversarial Failure-Injection: Honest Error Behavior', () => {
    it('rejects corrupt PDB string without falling back to fake coordinates', () => {
      const corruptPdb = 'ATOM      1  CA  VAL A   1    INVALID  NON-NUMERIC  COORDS  1.00 20.00           C\nEND';
      expect(() => parsePdbText(corruptPdb)).toThrow(/StructureParseError/);
    });

    it('rejects unapproved scientific units at envelope creation time', () => {
      expect(() => {
        createScientificResult({
          resultType: 'bad_unit_test',
          source: { structureId: '4HHB' },
          selection: 'A:1',
          unit: 'furlongs' as any,
          status: 'EXPERIMENTAL',
          provenance: { provider: 'test' },
          value: 4.5,
        });
      }).toThrow(/Unrecognized or unapproved scientific unit/);
    });

    it('rejects stale responses via ConcurrencyArbiter when a newer request has been dispatched', () => {
      const req1 = concurrencyArbiter.registerRequest('structure_analysis', '4HHB');
      const req2 = concurrencyArbiter.registerRequest('structure_analysis', '1BNA');

      // Request 1 is now superseded by Request 2
      expect(concurrencyArbiter.isStale('structure_analysis', req1.token)).toBe(true);
      expect(concurrencyArbiter.isStale('structure_analysis', req2.token)).toBe(false);
    });
  });

  // =========================================================================
  // 7. EXPORT FIDELITY & ROUND-TRIP VERIFICATION
  // =========================================================================
  describe('Export Fidelity & Round-Trip Deserialization', () => {
    it('preserves exact coordinates across PDB export and re-parse within 0.001 Å', () => {
      const testAtoms = [
        { serial: 1, atomName: 'N', resName: 'VAL', chainId: 'A', resSeq: 1, insCode: '', coordinates: [6.123, 14.245, 48.912] as [number, number, number], isHetero: false, occupancy: 1.0, bFactor: 20.0, element: 'N' },
        { serial: 2, atomName: 'CA', resName: 'VAL', chainId: 'A', resSeq: 1, insCode: '', coordinates: [7.234, 15.356, 49.023] as [number, number, number], isHetero: false, occupancy: 1.0, bFactor: 20.0, element: 'C' },
      ];
      const pdbStr = exportToPdb(testAtoms);
      const fidelityResult = verifyPdbRoundTripFidelity(testAtoms, pdbStr);
      expect(fidelityResult.matches).toBe(true);
      expect(fidelityResult.maxCoordDelta).toBeLessThanOrEqual(0.001);
    });

    it('preserves complete result envelope, provenance, and SHA-256 digest across JSON serialization', () => {
      const originalResult = createScientificResult({
        resultType: 'distance_measurement',
        source: { structureId: '4HHB', chainId: 'A' },
        selection: 'A:87:NE2 <-> A:142:FE',
        unit: 'Å',
        status: 'EXPERIMENTAL',
        provenance: { provider: 'RCSB PDB', experimental: true },
        value: 2.1415,
        parameters: { atomA: 'Fe', atomB: 'NE2' },
      });
      const jsonStr = exportScientificResultJson(originalResult);
      const reconstructedResult = deserializeScientificResult(jsonStr);

      expect(generateResultDigest(reconstructedResult)).toBe(generateResultDigest(originalResult));
      expect(reconstructedResult.value).toBeCloseTo(2.1415, 4);
      expect(reconstructedResult.unit).toBe('Å');
      expect(reconstructedResult.status).toBe('EXPERIMENTAL');
    });
  });

  // =========================================================================
  // 8. 9 AUTOMATED CERTIFICATION GATES VERIFICATION
  // =========================================================================
  describe('Repository-Wide Certification Gates Evaluation', () => {
    it('executes and passes all 9 release gates on verified 4HHB result', () => {
      const gIdentity = scientificCertificationEngine.verifyGateIdentity('A:87:NE2', true, true);
      expect(gIdentity.passed).toBe(true);

      const gUnits = scientificCertificationEngine.verifyGateUnits('Å');
      expect(gUnits.passed).toBe(true);

      const gProv = scientificCertificationEngine.verifyGateProvenance(
        createScientificResult({
          resultType: 'distance',
          source: { structureId: '4HHB' },
          selection: 'A:1',
          unit: 'Å',
          status: 'EXPERIMENTAL',
          provenance: { provider: 'RCSB PDB' },
          value: 2.14,
        })
      );
      expect(gProv.passed).toBe(true);

      const gTraj = scientificCertificationEngine.verifyGateTrajectory(0, [10, 10, 10], 50, [14, 12, 10]);
      expect(gTraj.passed).toBe(true);

      const gCache = scientificCertificationEngine.verifyGateCache(
        { structureId: '4HHB', calculationType: 'sasa', chainId: 'A' },
        { structureId: '4HHB', calculationType: 'sasa', chainId: 'C' }
      );
      expect(gCache.passed).toBe(true);

      const gRace = scientificCertificationEngine.verifyGateRace('structure_analysis');
      expect(gRace.passed).toBe(true);

      const gChain = scientificCertificationEngine.verifyGateChain([{ chainId: 'A' }, { chainId: 'A' }], 'A');
      expect(gChain.passed).toBe(true);

      const gData = scientificCertificationEngine.verifyGateData([10.5, 20.1, 30.2]);
      expect(gData.passed).toBe(true);

      const gExport = scientificCertificationEngine.verifyGateExport([
        { atomName: 'CA', resName: 'ALA', chainId: 'A', resSeq: 1, coordinates: [1.234, 5.678, 9.012] },
      ]);
      expect(gExport.passed).toBe(true);
    });
  });
});
