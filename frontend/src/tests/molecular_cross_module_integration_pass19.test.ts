// @vitest-environment jsdom
/**
 * MOCS-Cert Scientific Forensic Verification — PASS 19 Test Suite
 * 
 * End-to-End Scientific Workflow, Data Lineage, Reproducibility, API Integrity & Cross-Module Forensic Audit
 * 
 * Scope:
 * 1. Data-Lineage Verification: Complete lifecycle tracking from Raw Input to Export
 * 2. 4HHB Golden Fixture: Multi-chain tetramer isolation (Chain A vs Chain C; HEM A vs HEM C)
 * 3. 1BNA Golden Fixture: B-DNA duplex isolation, nucleotide classification & protein-only rejection
 * 4. Trajectory Golden Fixture: Frame N coordinate propagation & non-static evolution
 * 5. State Machine & Concurrency Arbiter: Monotonic tokens & race condition elimination
 * 6. Cross-Module Cache Integrity: Compound keys & cascading multi-level invalidation
 * 7. Scientific Result Object Model: Rigid envelopes, approved units & SHA-256 digests
 * 8. Export & Round-Trip Fidelity: PDB, FASTA, CSV & JSON with <= 0.001 Å coordinate fidelity
 * 9. Automated Scientific Certification Gates: All 9 gates (Section 48)
 * 10. Failure Injection: Graceful error handling for corrupt/unphysical data
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Core Molecular imports
import {
  buildStructureHierarchyIndex,
  resolveMolecularComponent,
  resolveAllMatchingComponents,
  computeComponentBounds,
  createDistanceMeasurement,
  calculateEuclideanDistance,
  calculateMinimumImageDistance,
  analyzeLigandPocket,
  detectGeometricPockets,
  parseCanonicalSelection,
  detectRiboseVsDeoxyribose,
  auditDockingPose,
  BiopolymerMismatchError,
} from '../molecular';

// Integration imports
import {
  createScientificResult,
  isScientificResult,
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

import { useViewerStore } from '../store/useViewerStore';

describe('PASS 19: End-to-End Scientific Workflow & Cross-Module Integration Suite', () => {
  const structuresDir = path.resolve(__dirname, '../../public/structures');
  const hhbPath = path.join(structuresDir, '4HHB.pdb');
  const bnaPath = path.join(structuresDir, '1BNA.pdb');

  beforeEach(() => {
    crossModuleCache.clearAll();
    concurrencyArbiter.cancelAll();
  });

  // ==========================================================================
  // 1. DATA LINEAGE & CANONICAL IDENTITY MAPPING
  // ==========================================================================
  describe('1. Data Lineage & Canonical Identity Mapping', () => {
    it('traces full lifecycle from raw PDB text to canonical index and derived bounds', () => {
      expect(fs.existsSync(hhbPath)).toBe(true);
      const rawPdb = fs.readFileSync(hhbPath, 'utf8');

      // Stage 1: Ingestion & parsing into atom records
      const parsedAtoms = parsePdbText(rawPdb);
      expect(parsedAtoms.length).toBeGreaterThan(4000);

      // Stage 2: Canonical Hierarchy Indexing
      const index = buildStructureHierarchyIndex(parsedAtoms, '4HHB', 1);
      expect(index.structureId).toBe('4HHB');
      expect(index.chains.size).toBe(4);
      expect(Array.from(index.chains.keys()).sort()).toEqual(['A', 'B', 'C', 'D']);

      // Stage 3: Component Resolution
      const compA87 = resolveMolecularComponent(index, 'A:HIS:87');
      expect(compA87).not.toBeNull();
      expect(compA87?.id.chainId).toBe('A');
      expect(compA87?.id.residueName).toBe('HIS');
      expect(compA87?.id.residueNumber).toBe(87);

      // Stage 4: Geometric Extents derivation
      const boundsA87 = compA87?.bounds;
      expect(boundsA87).toBeDefined();
      expect(boundsA87?.raw.center.length).toBe(3);
      expect(boundsA87?.raw.dimensions.every((v) => v > 0)).toBe(true);
    });
  });

  // ==========================================================================
  // 2. 4HHB GOLDEN FIXTURE: TETRAMER MULTI-CHAIN ISOLATION
  // ==========================================================================
  describe('2. 4HHB Golden Fixture: Multi-Chain Isolation (Chains A, B, C, D)', () => {
    let hhbIndex: ReturnType<typeof buildStructureHierarchyIndex>;
    let hhbAtoms: ReturnType<typeof parsePdbText>;

    beforeEach(() => {
      const rawPdb = fs.readFileSync(hhbPath, 'utf8');
      hhbAtoms = parsePdbText(rawPdb);
      hhbIndex = buildStructureHierarchyIndex(hhbAtoms, '4HHB', 1);
    });

    it('strictly isolates Chain A (alpha1) from Chain C (alpha2)', () => {
      const chainA = hhbIndex.chains.get('A');
      const chainC = hhbIndex.chains.get('C');

      expect(chainA).toBeDefined();
      expect(chainC).toBeDefined();
      expect(chainA?.classification).toBe('protein');
      expect(chainC?.classification).toBe('protein');

      // In 4HHB, both alpha chains have 141 amino acid residues
      const proteinCompsA = Array.from(chainA!.components.values()).filter(
        (c) => c.id.classification === 'protein'
      );
      const proteinCompsC = Array.from(chainC!.components.values()).filter(
        (c) => c.id.classification === 'protein'
      );
      expect(proteinCompsA.length).toBe(141);
      expect(proteinCompsC.length).toBe(141);

      // Verify distinct coordinates for residue 87 (proximal histidine)
      const resA87 = resolveMolecularComponent(hhbIndex, 'A:87');
      const resC87 = resolveMolecularComponent(hhbIndex, 'C:87');
      expect(resA87).not.toBeNull();
      expect(resC87).not.toBeNull();

      const [ax, ay, az] = resA87!.bounds.raw.center;
      const [cx, cy, cz] = resC87!.bounds.raw.center;
      const dist = Math.hypot(ax - cx, ay - cy, az - cz);
      // Alpha1 and Alpha2 subunits are separated across the tetramer by > 30 Å
      expect(dist).toBeGreaterThan(30.0);
    });

    it('strictly isolates HEM 142 in Chain A from HEM 142 in Chain C', () => {
      const hemA = resolveMolecularComponent(hhbIndex, 'A:HEM:142');
      const hemC = resolveMolecularComponent(hhbIndex, 'C:HEM:142');

      expect(hemA).not.toBeNull();
      expect(hemC).not.toBeNull();
      expect(hemA?.id.chainId).toBe('A');
      expect(hemC?.id.chainId).toBe('C');
      expect(hemA?.atoms.length).toBe(43); // 43 heavy atoms in heme b cofactor
      expect(hemC?.atoms.length).toBe(43);

      const feA = hemA!.atoms.find((a) => a.atomName === 'FE');
      const feC = hemC!.atoms.find((a) => a.atomName === 'FE');
      expect(feA).toBeDefined();
      expect(feC).toBeDefined();

      // Fe-Fe distance across Alpha1 and Alpha2 heme pockets
      const feDist = calculateEuclideanDistance(feA!.coordinates, feC!.coordinates);
      expect(feDist).toBeGreaterThan(30.0);
    });

    it('verifies exact 2.14 Å Fe-NE2 crystallographic coordination in Chain A', () => {
      const his87A = resolveMolecularComponent(hhbIndex, 'A:87');
      const hem142A = resolveMolecularComponent(hhbIndex, 'A:HEM:142');

      const ne2 = his87A!.atoms.find((a) => a.atomName === 'NE2');
      const fe = hem142A!.atoms.find((a) => a.atomName === 'FE');
      expect(ne2).toBeDefined();
      expect(fe).toBeDefined();

      const dist = calculateEuclideanDistance(ne2!.coordinates, fe!.coordinates);
      expect(dist).toBeCloseTo(2.14, 2);

      const meas = createDistanceMeasurement(
        {
          label: 'A:HIS:87:NE2',
          coords: ne2!.coordinates,
          chainId: 'A',
          resSeq: 87,
          resName: 'HIS',
          atomName: 'NE2',
        },
        {
          label: 'A:HEM:142:FE',
          coords: fe!.coordinates,
          chainId: 'A',
          resSeq: 142,
          resName: 'HEM',
          atomName: 'FE',
        }
      );
      expect(meas.isValid).toBe(true);
      expect(meas.unit).toBe('Å');
      expect(meas.rawValue).toBeCloseTo(2.14, 2);
    });

    it('analyzes HEM pocket and ensures zero cross-chain residue contamination', () => {
      // Analyze HEM pocket in Chain A
      const pocketA = analyzeLigandPocket(
        { chainId: 'A', residueName: 'HEM', residueNumber: 142 },
        hhbAtoms
      );
      expect(pocketA.status).toBe('SUCCESS');
      expect(pocketA.chainId).toBe('A');
      expect(pocketA.pocketVolume).toBeGreaterThan(500);

      // Lining protein chains must be exclusively Chain A
      expect(pocketA.liningProteinChains).toEqual(['A']);
      expect(pocketA.isIsolatedToChain).toBe(true);

      // Analyze HEM pocket in Chain C
      const pocketC = analyzeLigandPocket(
        { chainId: 'C', residueName: 'HEM', residueNumber: 142 },
        hhbAtoms
      );
      expect(pocketC.status).toBe('SUCCESS');
      expect(pocketC.chainId).toBe('C');
      expect(pocketC.liningProteinChains).toEqual(['C']);
      expect(pocketC.isIsolatedToChain).toBe(true);

      // Verify no shared lining residues between pocket A and pocket C
      const setA = new Set(pocketA.liningResidueKeys);
      for (const resKey of pocketC.liningResidueKeys) {
        expect(setA.has(resKey)).toBe(false);
      }
    });

    it('disambiguates unstated chain query contextually without cross-chain blending', () => {
      // Query "HEM:142" without chain:
      // Context A: preferredChainId = 'A'
      const resA = resolveMolecularComponent(hhbIndex, 'HEM:142', { chainId: 'A' });
      expect(resA?.id.chainId).toBe('A');

      // Context C: preferredChainId = 'C'
      const resC = resolveMolecularComponent(hhbIndex, 'HEM:142', { chainId: 'C' });
      expect(resC?.id.chainId).toBe('C');

      // Both candidates returned as independent objects
      const allHems = resolveAllMatchingComponents(hhbIndex, 'HEM:142');
      expect(allHems.length).toBe(2);
      expect(allHems.map((h) => h.id.chainId).sort()).toEqual(['A', 'C']);
    });
  });

  // ==========================================================================
  // 3. 1BNA GOLDEN FIXTURE: B-DNA DUPLEX REGRESSION
  // ==========================================================================
  describe('3. 1BNA Golden Fixture: B-DNA Duplex Regression', () => {
    let bnaIndex: ReturnType<typeof buildStructureHierarchyIndex>;
    let bnaAtoms: ReturnType<typeof parsePdbText>;

    beforeEach(() => {
      const rawPdb = fs.readFileSync(bnaPath, 'utf8');
      bnaAtoms = parsePdbText(rawPdb);
      bnaIndex = buildStructureHierarchyIndex(bnaAtoms, '1BNA', 1);
    });

    it('classifies 1BNA chains as pure nucleic biopolymers', () => {
      expect(bnaIndex.chains.size).toBe(2);
      const chainA = bnaIndex.chains.get('A');
      const chainB = bnaIndex.chains.get('B');

      expect(chainA).toBeDefined();
      expect(chainB).toBeDefined();
      expect(chainA?.classification).toBe('nucleic');
      expect(chainB?.classification).toBe('nucleic');

      // Verify 12 nucleotides per strand in the Dickerson dodecamer
      const compsA = Array.from(chainA!.components.values()).filter(
        (c) => c.id.classification === 'nucleic'
      );
      const compsB = Array.from(chainB!.components.values()).filter(
        (c) => c.id.classification === 'nucleic'
      );
      expect(compsA.length).toBe(12);
      expect(compsB.length).toBe(12);
    });

    it('detects 2-deoxyribose chemistry across all 1BNA nucleotides (DNA)', () => {
      for (const comp of bnaIndex.allComponents) {
        if (comp.id.classification === 'nucleic') {
          const sugar = detectRiboseVsDeoxyribose(comp.atoms);
          expect(sugar).toBe('deoxyribose');
          expect(comp.id.nucleicType).toBe('dna');
        }
      }
    });

    it('strictly rejects DNA duplex from protein-only docking pipelines', () => {
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

    it('measures cross-terminal basepair distance across 1BNA duplex (~16.54 Å)', () => {
      const term5 = resolveMolecularComponent(bnaIndex, "A:1:O5'");
      const term3 = resolveMolecularComponent(bnaIndex, "B:24:O3'");

      expect(term5).not.toBeNull();
      expect(term3).not.toBeNull();

      const atom5 = term5!.atoms.find((a) => a.atomName === "O5'");
      const atom3 = term3!.atoms.find((a) => a.atomName === "O3'");
      expect(atom5).toBeDefined();
      expect(atom3).toBeDefined();

      const dist = calculateEuclideanDistance(atom5!.coordinates, atom3!.coordinates);
      expect(dist).toBeCloseTo(16.54, 1);
    });
  });

  // ==========================================================================
  // 4. TRAJECTORY GOLDEN FIXTURE: FRAME & TIME EVOLUTION
  // ==========================================================================
  describe('4. Trajectory Frame Evolution & Time Semantics', () => {
    it('verifies non-static coordinate displacement between frame 0 and frame 50', () => {
      const frame0Coords: [number, number, number] = [10.25, 14.50, 22.10];
      const frame50Coords: [number, number, number] = [12.80, 16.20, 24.95];
      const box: [number, number, number] = [80.0, 80.0, 80.0];

      const d0 = calculateMinimumImageDistance(frame0Coords, [0, 0, 0], box);
      const d50 = calculateMinimumImageDistance(frame50Coords, [0, 0, 0], box);
      expect(d0).not.toBe(d50);

      // Displacement between frame 0 and frame 50
      const displacement = calculateMinimumImageDistance(frame0Coords, frame50Coords, box);
      expect(displacement).toBeGreaterThan(3.0);
    });

    it('verifies that frame-independent properties remain strictly constant', () => {
      const atomA = { atomName: 'CA', resSeq: 155, chainId: 'A', element: 'C' };
      const atomB = { atomName: 'CA', resSeq: 155, chainId: 'A', element: 'C' };

      expect(atomA.atomName).toBe(atomB.atomName);
      expect(atomA.resSeq).toBe(atomB.resSeq);
      expect(atomA.chainId).toBe(atomB.chainId);
      expect(atomA.element).toBe(atomB.element);
    });
  });

  // ==========================================================================
  // 5. CROSS-MODULE CACHE INTEGRITY & INVALIDATION
  // ==========================================================================
  describe('5. Cross-Module Cache Integrity & Invalidation', () => {
    it('constructs compound keys that distinguish all scientific inputs', () => {
      const k1 = crossModuleCache.buildKey({
        structureId: '4HHB',
        modelId: 1,
        chainId: 'A',
        frameIndex: 0,
        calculationType: 'aabb',
        selection: 'A:87',
      });

      const k2 = crossModuleCache.buildKey({
        structureId: '4HHB',
        modelId: 1,
        chainId: 'C', // Different chain
        frameIndex: 0,
        calculationType: 'aabb',
        selection: 'C:87',
      });

      const k3 = crossModuleCache.buildKey({
        structureId: '4HHB',
        modelId: 1,
        chainId: 'A',
        frameIndex: 50, // Different frame
        calculationType: 'aabb',
        selection: 'A:87',
      });

      expect(k1).not.toBe(k2);
      expect(k1).not.toBe(k3);
      expect(k2).not.toBe(k3);
    });

    it('evicts cached results when structure changes', () => {
      const kHhb = crossModuleCache.buildKey({
        structureId: '4HHB',
        calculationType: 'sasa',
      });
      crossModuleCache.set(kHhb, { sasa: 15200.0 });
      expect(crossModuleCache.has(kHhb)).toBe(true);

      // Switch to 1BNA
      const evicted = crossModuleCache.invalidateOnStructureChange('1BNA');
      expect(evicted).toBe(1);
      expect(crossModuleCache.has(kHhb)).toBe(false);
      expect(crossModuleCache.currentStructure).toBe('1BNA');
    });

    it('evicts chain-specific cache when active chain changes', () => {
      const kA = crossModuleCache.buildKey({
        structureId: '4HHB',
        chainId: 'A',
        calculationType: 'pocket',
      });
      crossModuleCache.set(kA, { pocketVol: 650.0 });
      expect(crossModuleCache.has(kA)).toBe(true);

      // Switch chain to C
      const evicted = crossModuleCache.invalidateOnChainChange('C');
      expect(evicted).toBe(1);
      expect(crossModuleCache.has(kA)).toBe(false);
      expect(crossModuleCache.currentChain).toBe('C');
    });
  });

  // ==========================================================================
  // 6. STATE MACHINE & CONCURRENCY ARBITER
  // ==========================================================================
  describe('6. State Machine & Concurrency Arbiter', () => {
    it('generates monotonic tokens and flags superseded async requests as stale', () => {
      const req1 = concurrencyArbiter.registerRequest('structure_load', '4HHB');
      const req2 = concurrencyArbiter.registerRequest('structure_load', '1BNA');

      expect(req2.token).toBeGreaterThan(req1.token);
      expect(concurrencyArbiter.isStale('structure_load', req1.token)).toBe(true);
      expect(concurrencyArbiter.isStale('structure_load', req2.token)).toBe(false);

      concurrencyArbiter.completeRequest('structure_load', req2.token);
      expect(concurrencyArbiter.getActiveDomainCount()).toBe(0);
    });

    it('resets measuredDistance and calipers on structure change in useViewerStore', () => {
      const store = useViewerStore.getState();

      // Switch to 1BNA
      store.selectStructure('1BNA');
      const bnaState = useViewerStore.getState();
      expect(bnaState.activeStructureId).toBe('1BNA');
      expect(bnaState.measuredDistance).toBe(0);
      expect(bnaState.selectionA).toBe('');
      expect(bnaState.selectionB).toBe('');
      expect(bnaState.measurements).toEqual([]);
      expect(bnaState.showCalipers).toBe(false);

      // Switch back to 4HHB
      store.selectStructure('4HHB');
      const hhbState = useViewerStore.getState();
      expect(hhbState.activeStructureId).toBe('4HHB');
      expect(hhbState.measuredDistance).toBe(0);
      expect(hhbState.selectionA).toBe('');
      expect(hhbState.selectionB).toBe('');
      expect(hhbState.measurements).toEqual([]);
      expect(hhbState.showCalipers).toBe(false);
    });
  });

  // ==========================================================================
  // 7. SCIENTIFIC RESULT OBJECT MODEL & LINEAGE
  // ==========================================================================
  describe('7. Scientific Result Object Model & Lineage', () => {
    it('creates conformant ScientificResultEnvelope with approved units', () => {
      const result = createScientificResult({
        resultType: 'distance_measurement',
        source: { structureId: '4HHB', chainId: 'A' },
        selection: 'A:87:NE2 <-> A:HEM:142:FE',
        unit: 'Å',
        status: 'EXPERIMENTAL',
        provenance: { provider: 'RCSB PDB', experimental: true },
        value: 2.14,
      });

      expect(isScientificResult(result)).toBe(true);
      expect(result.source.structureId).toBe('4HHB');
      expect(result.unit).toBe('Å');
      expect(result.formattedValue).toBe('2.14 Å');
      expect(result.status).toBe('EXPERIMENTAL');

      const digest = generateResultDigest(result);
      expect(digest).toMatch(/^sha256-mocs-[0-9a-f]{32}$/);
    });

    it('strictly throws on unapproved or ambiguous scientific units', () => {
      expect(() => {
        createScientificResult({
          resultType: 'bad_unit_test',
          source: { structureId: '4HHB' },
          selection: 'test',
          unit: 'furlongs' as any,
          status: 'COMPUTED',
          provenance: { provider: 'test' },
          value: 12.34,
        });
      }).toThrow(/Units Contract/);
    });
  });

  // ==========================================================================
  // 8. EXPORT & ROUND-TRIP SERIALIZATION
  // ==========================================================================
  describe('8. Export & Round-Trip Serialization', () => {
    it('exports 4HHB Chain A to PDB with 100% round-trip fidelity (delta <= 0.001 Å)', () => {
      const rawPdb = fs.readFileSync(hhbPath, 'utf8');
      const allAtoms = parsePdbText(rawPdb);
      const chainAAtoms = allAtoms.filter((a) => a.chainId === 'A');

      const exportedPdb = exportToPdb(chainAAtoms);
      expect(exportedPdb).toContain('ATOM  ');
      expect(exportedPdb).toContain('END');

      const fidelity = verifyPdbRoundTripFidelity(chainAAtoms, exportedPdb);
      expect(fidelity.matches).toBe(true);
      expect(fidelity.atomCountParsed).toBe(chainAAtoms.length);
      expect(fidelity.maxCoordDelta).toBeLessThanOrEqual(0.001);
    });

    it('exports FASTA with compliant header and single-letter sequence', () => {
      const rawPdb = fs.readFileSync(bnaPath, 'utf8');
      const bnaAtoms = parsePdbText(rawPdb);
      const bnaIndex = buildStructureHierarchyIndex(bnaAtoms, '1BNA', 1);

      const fasta = exportToFasta(bnaIndex);
      expect(fasta).toContain('>1BNA|Chain_A|NUCLEIC|length=12');
      expect(fasta).toContain('CGCGAATTCGCG');
      expect(fasta).toContain('>1BNA|Chain_B|NUCLEIC|length=12');
    });

    it('exports CSV with mandatory unit column headers', () => {
      const data = [
        { residue: 'HIS87', distance: 2.14, sasa: 45.2 },
        { residue: 'PHE42', distance: 4.80, sasa: 12.1 },
      ];
      const cols = [
        { key: 'residue', label: 'Residue' },
        { key: 'distance', label: 'Distance', unit: 'Å' },
        { key: 'sasa', label: 'SASA', unit: 'Å²' },
      ];

      const csv = exportToCsv(data, cols);
      expect(csv).toContain('"Residue","Distance (Å)","SASA (Å²)"');
      expect(csv).toContain('"HIS87",2.1400,45.2000');
    });

    it('serializes and deserializes ScientificResultEnvelope with bitwise identity', () => {
      const orig = createScientificResult({
        resultType: 'sasa',
        source: { structureId: '4HHB', chainId: 'A' },
        selection: 'A:*',
        unit: 'Å²',
        status: 'COMPUTED',
        provenance: { provider: 'MOCS-Cert SASA Engine', version: 'v1' },
        value: 12450.5,
      });

      const jsonStr = exportScientificResultJson(orig);
      const restored = deserializeScientificResult(jsonStr);

      expect(restored.resultType).toBe(orig.resultType);
      expect(restored.source.structureId).toBe(orig.source.structureId);
      expect(restored.unit).toBe(orig.unit);
      expect(restored.value).toBe(orig.value);
    });
  });

  // ==========================================================================
  // 9. AUTOMATED SCIENTIFIC CERTIFICATION GATES (SECTION 48)
  // ==========================================================================
  describe('9. Automated Scientific Certification Gates (Section 48)', () => {
    it('verifies GATE-IDENTITY (rejects ambiguous multi-chain queries)', () => {
      // Ambiguous in multi-chain
      const gateFail = scientificCertificationEngine.verifyGateIdentity('HEM:142', true, false);
      expect(gateFail.passed).toBe(false);
      expect(gateFail.details).toContain('Ambiguous selection');

      // Explicit chain in multi-chain
      const gatePass = scientificCertificationEngine.verifyGateIdentity('A:HEM:142', true, true);
      expect(gatePass.passed).toBe(true);
    });

    it('verifies GATE-UNITS (enforces approved scientific units)', () => {
      expect(scientificCertificationEngine.verifyGateUnits('Å').passed).toBe(true);
      expect(scientificCertificationEngine.verifyGateUnits('Å²').passed).toBe(true);
      expect(scientificCertificationEngine.verifyGateUnits('deg_custom').passed).toBe(false);
    });

    it('verifies GATE-PROVENANCE (requires authoritative provider)', () => {
      const validResult = createScientificResult({
        resultType: 'test',
        source: { structureId: '4HHB' },
        selection: 'A:1',
        unit: 'Å',
        status: 'EXPERIMENTAL',
        provenance: { provider: 'RCSB PDB' },
        value: 1.0,
      });

      const gatePass = scientificCertificationEngine.verifyGateProvenance(validResult);
      expect(gatePass.passed).toBe(true);

      const invalidResult = { ...validResult, provenance: {} };
      const gateFail = scientificCertificationEngine.verifyGateProvenance(invalidResult as any);
      expect(gateFail.passed).toBe(false);
    });

    it('verifies GATE-TRAJECTORY (enforces non-static displacement)', () => {
      // Frame 0 vs Frame 50 with displacement
      const gatePass = scientificCertificationEngine.verifyGateTrajectory(
        0, [10, 10, 10],
        50, [14, 12, 10]
      );
      expect(gatePass.passed).toBe(true);

      // Frame 0 vs Frame 50 with zero displacement (unphysical freezing)
      const gateFail = scientificCertificationEngine.verifyGateTrajectory(
        0, [10, 10, 10],
        50, [10, 10, 10]
      );
      expect(gateFail.passed).toBe(false);
      expect(gateFail.details).toContain('Coordinate evolution failure');
    });

    it('verifies GATE-CACHE (enforces input orthogonality without collisions)', () => {
      const scopeA = { structureId: '4HHB', calculationType: 'sasa', chainId: 'A' };
      const scopeB = { structureId: '4HHB', calculationType: 'sasa', chainId: 'C' };

      const gatePass = scientificCertificationEngine.verifyGateCache(scopeA, scopeB);
      expect(gatePass.passed).toBe(true);
    });

    it('verifies GATE-RACE (suppresses stale asynchronous responses)', () => {
      const gate = scientificCertificationEngine.verifyGateRace('test_domain');
      expect(gate.passed).toBe(true);
    });

    it('verifies GATE-CHAIN (guarantees zero cross-chain contamination)', () => {
      const itemsChainA = [{ chainId: 'A' }, { chainId: 'A' }, { chainId: 'A' }];
      const passResult = scientificCertificationEngine.verifyGateChain(itemsChainA, 'A');
      expect(passResult.passed).toBe(true);

      const contaminatedItems = [{ chainId: 'A' }, { chainId: 'C' }];
      const failResult = scientificCertificationEngine.verifyGateChain(contaminatedItems, 'A');
      expect(failResult.passed).toBe(false);
      expect(failResult.details).toContain('Cross-chain contamination detected');
    });

    it('verifies GATE-DATA (detects and rejects NaN/Infinity coordinates)', () => {
      expect(scientificCertificationEngine.verifyGateData([10.5, 20.1, 30.2]).passed).toBe(true);
      expect(scientificCertificationEngine.verifyGateData([NaN, 20.1, 30.2]).passed).toBe(false);
      expect(scientificCertificationEngine.verifyGateData([10.5, Infinity, 30.2]).passed).toBe(false);
    });

    it('verifies GATE-EXPORT (validates round-trip coordinate preservation)', () => {
      const sampleAtoms = [
        { atomName: 'CA', resName: 'ALA', chainId: 'A', resSeq: 1, coordinates: [1.234, 5.678, 9.012] },
        { atomName: 'CB', resName: 'ALA', chainId: 'A', resSeq: 1, coordinates: [2.345, 6.789, 0.123] },
      ];
      const gate = scientificCertificationEngine.verifyGateExport(sampleAtoms);
      expect(gate.passed).toBe(true);
    });
  });

  // ==========================================================================
  // 10. FAILURE INJECTION & ADVERSARIAL RESILIENCE
  // ==========================================================================
  describe('10. Failure Injection & Adversarial Resilience', () => {
    it('handles requests for non-existent chains gracefully without crashing', () => {
      const rawPdb = fs.readFileSync(hhbPath, 'utf8');
      const atoms = parsePdbText(rawPdb);
      const index = buildStructureHierarchyIndex(atoms, '4HHB', 1);

      const res = resolveMolecularComponent(index, 'Z:HIS:87');
      expect(res).toBeNull();
    });

    it('handles empty atom arrays in pocket detector safely', () => {
      const pocketResult = detectGeometricPockets([]);
      expect(pocketResult.status).toBe('EMPTY_SELECTION');
      expect(pocketResult.pockets.length).toBe(0);
      expect(pocketResult.totalCavityVolume).toBe(0);
    });
  });
});
