// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  buildCanonicalAtomKey,
  parseCanonicalAtomKey,
  areAtomsAltLocCompatible,
} from '../molecular/topology/atomIdentity';
import {
  parsePdbConectRecords,
} from '../molecular/topology/conectParser';
import {
  extractPlddtFromPdb,
} from '../molecular/prediction/confidenceParser';
import {
  buildStructureHierarchyIndex,
} from '../molecular/geometry/componentPipeline';
import {
  createScientificResult,
  exportScientificResultToJson,
  parseScientificResultFromJson,
  exportScientificResultToCsv,
  parseScientificResultFromCsv,
  generateResultDigest,
  type ScientificResultEnvelope,
} from '../molecular/integration/scientificResultModel';
import {
  createBox3FromCoordinates,
  box3ToCoordinateAABB,
} from '../molecular/geometry/coordinateBounds';
import {
  calculateProteinCentroid,
} from '../molecular/protein/metrics';

describe('PASS 24 — Adversarial Data Corruption, Parser Differential & Round-Trip Integrity Suite', () => {

  // ===========================================================================
  // 1. STRUCTURAL IDENTITY ISOLATION (4HHB Heme/His Tetramer & 1BNA DNA Duplex)
  // ===========================================================================
  describe('Structural Identity Isolation', () => {
    it('isolates heme cofactors and proximal/distal histidines across all 4HHB tetramer chains', () => {
      // 4HHB has 4 chains (A, B, C, D):
      // Chains A & C are alpha chains: Proximal His87 (NE2), Distal His58 (NE2), Heme 142 (FE)
      // Chains B & D are beta chains: Proximal His92 (NE2), Distal His63 (NE2), Heme 142 (FE)
      const aHemeFe = buildCanonicalAtomKey({ structureId: '4HHB', modelId: 1, chainId: 'A', residueName: 'HEM', residueNumber: 142, atomName: 'FE' });
      const bHemeFe = buildCanonicalAtomKey({ structureId: '4HHB', modelId: 1, chainId: 'B', residueName: 'HEM', residueNumber: 142, atomName: 'FE' });
      const cHemeFe = buildCanonicalAtomKey({ structureId: '4HHB', modelId: 1, chainId: 'C', residueName: 'HEM', residueNumber: 142, atomName: 'FE' });
      const dHemeFe = buildCanonicalAtomKey({ structureId: '4HHB', modelId: 1, chainId: 'D', residueName: 'HEM', residueNumber: 142, atomName: 'FE' });

      const aProxHis = buildCanonicalAtomKey({ structureId: '4HHB', modelId: 1, chainId: 'A', residueName: 'HIS', residueNumber: 87, atomName: 'NE2' });
      const cProxHis = buildCanonicalAtomKey({ structureId: '4HHB', modelId: 1, chainId: 'C', residueName: 'HIS', residueNumber: 87, atomName: 'NE2' });
      const bProxHis = buildCanonicalAtomKey({ structureId: '4HHB', modelId: 1, chainId: 'B', residueName: 'HIS', residueNumber: 92, atomName: 'NE2' });
      const dProxHis = buildCanonicalAtomKey({ structureId: '4HHB', modelId: 1, chainId: 'D', residueName: 'HIS', residueNumber: 92, atomName: 'NE2' });

      // All 8 canonical atom keys must be strictly unique
      const keys = [aHemeFe, bHemeFe, cHemeFe, dHemeFe, aProxHis, cProxHis, bProxHis, dProxHis];
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(8);

      // Verify exact chain isolation
      expect(aHemeFe).not.toBe(cHemeFe);
      expect(aProxHis).not.toBe(cProxHis);
      expect(bHemeFe).not.toBe(dHemeFe);
      expect(bProxHis).not.toBe(dProxHis);

      // Deconstruction preserves chain and residue numbers
      const parsedA = parseCanonicalAtomKey(aHemeFe);
      const parsedC = parseCanonicalAtomKey(cHemeFe);
      expect(parsedA.chainId).toBe('A');
      expect(parsedC.chainId).toBe('C');
      expect(parsedA.residueNumber).toBe(142);
      expect(parsedC.residueNumber).toBe(142);
    });

    it('isolates complementary DNA strands and backbones in 1BNA dodecamer', () => {
      // 1BNA: Dickerson-Drew B-DNA dodecamer
      // Strand A (CGCGAATTCGCG, residues 1-12)
      // Strand B (CGCGAATTCGCG, residues 13-24)
      const strandA_G4_P = buildCanonicalAtomKey({ structureId: '1BNA', chainId: 'A', residueName: 'DG', residueNumber: 4, atomName: 'P' });
      const strandB_G16_P = buildCanonicalAtomKey({ structureId: '1BNA', chainId: 'B', residueName: 'DG', residueNumber: 16, atomName: 'P' });

      const strandA_C9_C1 = buildCanonicalAtomKey({ structureId: '1BNA', chainId: 'A', residueName: 'DC', residueNumber: 9, atomName: "C1'" });
      const strandB_C21_C1 = buildCanonicalAtomKey({ structureId: '1BNA', chainId: 'B', residueName: 'DC', residueNumber: 21, atomName: "C1'" });

      expect(strandA_G4_P).not.toBe(strandB_G16_P);
      expect(strandA_C9_C1).not.toBe(strandB_C21_C1);

      const parsedG4 = parseCanonicalAtomKey(strandA_G4_P);
      expect(parsedG4.chainId).toBe('A');
      expect(parsedG4.residueNumber).toBe(4);
      expect(parsedG4.residueName).toBe('DG');
      expect(parsedG4.atomName).toBe('P');
    });
  });

  // ===========================================================================
  // 2. CANONICAL ATOM KEY ROUND-TRIP & ALTLOC COMPATIBILITY
  // ===========================================================================
  describe('Canonical Atom Key Round-Trip & AltLoc', () => {
    it('round-trips standard 6-token atom keys', () => {
      const original = {
        structureId: '4HHB',
        modelId: '1',
        chainId: 'A',
        residueName: 'HIS',
        residueNumber: 87,
        atomName: 'NE2',
      };
      const key = buildCanonicalAtomKey(original);
      expect(key).toBe('4HHB:1:A:HIS:87:NE2');

      const parsed = parseCanonicalAtomKey(key);
      expect(parsed.structureId).toBe('4HHB');
      expect(parsed.modelId).toBe('1');
      expect(parsed.chainId).toBe('A');
      expect(parsed.residueName).toBe('HIS');
      expect(parsed.residueNumber).toBe(87);
      expect(parsed.atomName).toBe('NE2');
      expect(parsed.insertionCode).toBeNull();
      expect(parsed.altLoc).toBeNull();
    });

    it('round-trips 7-token atom keys with insertion codes', () => {
      const original = {
        structureId: '1TUP',
        modelId: '1',
        chainId: 'B',
        residueName: 'CYS',
        residueNumber: 182,
        insertionCode: 'A',
        atomName: 'SG',
      };
      const key = buildCanonicalAtomKey(original);
      expect(key).toBe('1TUP:1:B:CYS:182:A:SG');

      const parsed = parseCanonicalAtomKey(key);
      expect(parsed.structureId).toBe('1TUP');
      expect(parsed.chainId).toBe('B');
      expect(parsed.residueNumber).toBe(182);
      expect(parsed.insertionCode).toBe('A');
      expect(parsed.atomName).toBe('SG');
      expect(parsed.altLoc).toBeNull();
    });

    it('round-trips 7-token atom keys with alternate location indicator', () => {
      const original = {
        structureId: '4HHB',
        modelId: '1',
        chainId: 'A',
        residueName: 'VAL',
        residueNumber: 1,
        atomName: 'CG1',
        altLoc: 'A',
      };
      const key = buildCanonicalAtomKey(original);
      expect(key).toBe('4HHB:1:A:VAL:1:CG1:A');

      const parsed = parseCanonicalAtomKey(key);
      expect(parsed.structureId).toBe('4HHB');
      expect(parsed.chainId).toBe('A');
      expect(parsed.residueNumber).toBe(1);
      expect(parsed.atomName).toBe('CG1');
      expect(parsed.altLoc).toBe('A');
      expect(parsed.insertionCode).toBeNull();
    });

    it('round-trips 8-token atom keys with BOTH insertion code and altLoc', () => {
      const original = {
        structureId: '1TUP',
        modelId: '1',
        chainId: 'B',
        residueName: 'CYS',
        residueNumber: 182,
        insertionCode: 'A',
        atomName: 'SG',
        altLoc: 'B',
      };
      const key = buildCanonicalAtomKey(original);
      expect(key).toBe('1TUP:1:B:CYS:182:A:SG:B');

      const parsed = parseCanonicalAtomKey(key);
      expect(parsed.structureId).toBe('1TUP');
      expect(parsed.chainId).toBe('B');
      expect(parsed.residueNumber).toBe(182);
      expect(parsed.insertionCode).toBe('A');
      expect(parsed.atomName).toBe('SG');
      expect(parsed.altLoc).toBe('B');
    });

    it('enforces alternate location compatibility rules', () => {
      const atomMain = buildCanonicalAtomKey({ structureId: '1ABC', chainId: 'A', residueName: 'LEU', residueNumber: 10, atomName: 'CA' });
      const atomAltA = buildCanonicalAtomKey({ structureId: '1ABC', chainId: 'A', residueName: 'LEU', residueNumber: 10, atomName: 'CD1', altLoc: 'A' });
      const atomAltB = buildCanonicalAtomKey({ structureId: '1ABC', chainId: 'A', residueName: 'LEU', residueNumber: 10, atomName: 'CD1', altLoc: 'B' });

      // Main conformation (no altLoc) is compatible with everything
      expect(areAtomsAltLocCompatible(atomMain, atomAltA)).toBe(true);
      expect(areAtomsAltLocCompatible(atomMain, atomAltB)).toBe(true);

      // Same altLoc conformers are compatible
      expect(areAtomsAltLocCompatible(atomAltA, atomAltA)).toBe(true);

      // Mutually exclusive alternate conformers must NEVER be compatible
      expect(areAtomsAltLocCompatible(atomAltA, atomAltB)).toBe(false);
      expect(areAtomsAltLocCompatible(atomAltB, atomAltA)).toBe(false);
    });
  });

  // ===========================================================================
  // 3. CONECT PARSER BOND MULTIPLICITY ATTACK (TRIPLE & DOUBLE BONDS)
  // ===========================================================================
  describe('CONECT Parser Multiplicity Attack', () => {
    it('correctly resolves triple bonds when count >= 6 without swallowing into double bonds', () => {
      const keyA = buildCanonicalAtomKey({ structureId: 'MOL', chainId: 'A', residueName: 'ACE', residueNumber: 1, atomName: 'C1' });
      const keyB = buildCanonicalAtomKey({ structureId: 'MOL', chainId: 'A', residueName: 'ACE', residueNumber: 1, atomName: 'C2' });

      const serialToKey = new Map<number, string>([
        [1, keyA],
        [2, keyB],
      ]);

      // Triple bond represented by 3 entries in both directions (total count = 6)
      const pdbText = [
        'CONECT    1    2    2    2',
        'CONECT    2    1    1    1',
      ].join('\n');

      const bonds = parsePdbConectRecords(pdbText, serialToKey);
      expect(bonds.length).toBe(1);
      expect(bonds[0].multiplicity).toBe(3);
      expect(bonds[0].bondType).toBe('COVALENT_TRIPLE');
    });

    it('correctly resolves double bonds when count >= 4 and < 6', () => {
      const keyA = buildCanonicalAtomKey({ structureId: 'MOL', chainId: 'A', residueName: 'BEN', residueNumber: 1, atomName: 'C1' });
      const keyB = buildCanonicalAtomKey({ structureId: 'MOL', chainId: 'A', residueName: 'BEN', residueNumber: 1, atomName: 'C2' });

      const serialToKey = new Map<number, string>([
        [1, keyA],
        [2, keyB],
      ]);

      // Double bond: 2 entries in both directions (count = 4)
      const pdbText = [
        'CONECT    1    2    2',
        'CONECT    2    1    1',
      ].join('\n');

      const bonds = parsePdbConectRecords(pdbText, serialToKey);
      expect(bonds.length).toBe(1);
      expect(bonds[0].multiplicity).toBe(2);
      expect(bonds[0].bondType).toBe('COVALENT_DOUBLE');
    });

    it('correctly resolves single bonds when count < 4', () => {
      const keyA = buildCanonicalAtomKey({ structureId: 'MOL', chainId: 'A', residueName: 'ETH', residueNumber: 1, atomName: 'C1' });
      const keyB = buildCanonicalAtomKey({ structureId: 'MOL', chainId: 'A', residueName: 'ETH', residueNumber: 1, atomName: 'C2' });

      const serialToKey = new Map<number, string>([
        [1, keyA],
        [2, keyB],
      ]);

      // Single bond: 1 entry in both directions (count = 2)
      const pdbText = [
        'CONECT    1    2',
        'CONECT    2    1',
      ].join('\n');

      const bonds = parsePdbConectRecords(pdbText, serialToKey);
      expect(bonds.length).toBe(1);
      expect(bonds[0].multiplicity).toBe(1);
      expect(bonds[0].bondType).toBe('COVALENT_SINGLE');
    });

    it('discards malformed self-loops in CONECT records', () => {
      const keyA = buildCanonicalAtomKey({ structureId: 'MOL', chainId: 'A', residueName: 'ETH', residueNumber: 1, atomName: 'C1' });
      const serialToKey = new Map<number, string>([[1, keyA]]);

      const pdbText = 'CONECT    1    1';
      const bonds = parsePdbConectRecords(pdbText, serialToKey);
      expect(bonds.length).toBe(0);
    });
  });

  // ===========================================================================
  // 4. INSERTION CODE PRESERVATION IN pLDDT & COMPONENT PIPELINE
  // ===========================================================================
  describe('Insertion Code Preservation', () => {
    it('preserves distinct residue scores when insertion codes are present without dropping as duplicates', () => {
      // PDB lines with residue 87 and residue 87A on Chain A
      const pdbText = [
        'ATOM    600  CA  HIS A  87      12.000  15.000  18.000  1.00 85.50           C',
        'ATOM    610  CA  HIS A  87A     13.000  16.000  19.000  1.00 92.30           C',
        'ATOM    620  CA  ALA A  88      14.000  17.000  20.000  1.00 78.40           C',
      ].join('\n');

      const scores = extractPlddtFromPdb(pdbText);
      expect(scores.length).toBe(3);

      const score87 = scores.find(s => s.residueNumber === 87 && !s.insertionCode);
      const score87A = scores.find(s => s.residueNumber === 87 && s.insertionCode === 'A');
      const score88 = scores.find(s => s.residueNumber === 88);

      expect(score87).toBeDefined();
      expect(score87?.score).toBeCloseTo(85.50, 2);

      expect(score87A).toBeDefined();
      expect(score87A?.score).toBeCloseTo(92.30, 2);

      expect(score88).toBeDefined();
      expect(score88?.score).toBeCloseTo(78.40, 2);
    });

    it('handles string residue numbers and embedded insertion codes in componentPipeline', () => {
      const mockStructure = {
        atoms: [
          {
            serial: 1,
            chain: 'A',
            resi: '87A',
            resn: 'HIS',
            atom: 'CA',
            elem: 'C',
            coordinates: [10.0, 10.0, 10.0],
          },
          {
            serial: 2,
            chain: 'A',
            resi: '142',
            resn: 'HEM',
            atom: 'FE',
            elem: 'FE',
            coordinates: [15.0, 15.0, 15.0],
            hetflag: true,
          }
        ]
      };

      const index = buildStructureHierarchyIndex(mockStructure.atoms);
      expect(index.totalValidAtoms).toBe(2);

      const chainA = index.chains.get('A');
      expect(chainA).toBeDefined();

      const components = Array.from(chainA?.components.values() || []);
      const comp87A = components.find(c => c.id.residueNumber === 87 && c.id.insertionCode === 'A');
      expect(comp87A).toBeDefined();
      expect(comp87A?.id.residueNumber).toBe(87);
      expect(comp87A?.id.insertionCode).toBe('A');
      expect(comp87A?.id.residueName).toBe('HIS');

      const comp142 = components.find(c => c.id.residueNumber === 142);
      expect(comp142).toBeDefined();
      expect(comp142?.id.residueNumber).toBe(142);
      expect(comp142?.id.residueName).toBe('HEM');
    });
  });

  // ===========================================================================
  // 5. BIDIRECTIONAL SERIALIZATION ROUND-TRIP (JSON & CSV)
  // ===========================================================================
  describe('Bidirectional Serialization Round-Trip', () => {
    it('round-trips a ScientificResultEnvelope through JSON with exact numerical & digest recovery', async () => {
      const originalEnvelope = createScientificResult({
        resultType: 'DISTANCE_MEASUREMENT',
        value: 12.345678,
        formattedValue: '12.345678 Å',
        unit: 'Å',
        parameters: {
          algorithm: 'EUCLIDEAN_3D',
          method: 'EXACT_COORDINATES',
          threshold: 15.0,
        },
        source: {
          structureId: '4HHB',
          modelId: 1,
          chainId: 'A',
        },
        selection: 'A:142:FE - A:87:NE2',
        status: 'COMPUTED',
        provenance: {
          pipelineStage: 'INTERACTION_MEASUREMENT',
          softwareVersion: 'MOCS-Cert-0.1.0',
          isApproximation: false,
        },
      });

      // Export to JSON string
      const jsonStr = exportScientificResultToJson(originalEnvelope);
      expect(typeof jsonStr).toBe('string');

      // Parse back to ScientificResultEnvelope
      const recoveredEnvelope = parseScientificResultFromJson(jsonStr);

      // Verify exact numerical recovery
      expect(recoveredEnvelope.resultType).toBe(originalEnvelope.resultType);
      expect(recoveredEnvelope.value).toBeCloseTo(12.345678, 6);
      expect(recoveredEnvelope.formattedValue).toBe('12.345678 Å');
      expect(recoveredEnvelope.unit).toBe('Å');
      expect(recoveredEnvelope.source.structureId).toBe('4HHB');
      expect(recoveredEnvelope.source.chainId).toBe('A');
      expect(recoveredEnvelope.parameters.isApproximation).toBe(false);

      // Verify cryptographic digest matches
      const expectedDigest = generateResultDigest(recoveredEnvelope);
      expect(recoveredEnvelope.sha256Digest).toBe(expectedDigest);
    });

    it('rejects tampered JSON payloads with altered values or corrupt digests', () => {
      const validEnvelope = createScientificResult({
        resultType: 'RADIUS_OF_GYRATION',
        value: 15.4321,
        formattedValue: '15.4321 Å',
        unit: 'Å',
        parameters: { algorithm: 'STANDARD_RG' },
        source: { structureId: '1BNA' },
        selection: '*',
        status: 'COMPUTED',
        provenance: {
          pipelineStage: 'METRICS',
          softwareVersion: 'MOCS-Cert-0.1.0',
          isApproximation: false,
        },
      });

      const jsonStr = exportScientificResultToJson(validEnvelope);
      const parsedObj = JSON.parse(jsonStr);

      // Tamper with the numerical value
      parsedObj.value = 999.999;
      const tamperedJsonStr = JSON.stringify(parsedObj);

      // Deserialization must fail closed due to SHA-256 digest mismatch
      expect(() => parseScientificResultFromJson(tamperedJsonStr)).toThrow(
        /Cryptographic digest mismatch/
      );
    });

    it('rejects JSON payloads with unapproved scientific units', () => {
      const invalidJson = JSON.stringify({
        resultType: 'ENERGY',
        value: 100,
        unit: 'LIGHT_YEARS_PER_HOUR', // Unapproved!
        source: { structureId: '4HHB' },
      });

      expect(() => parseScientificResultFromJson(invalidJson)).toThrow(
        /Unrecognized scientific unit/
      );
    });

    it('round-trips a ScientificResultEnvelope through CSV', () => {
      const envelope = createScientificResult({
        resultType: 'SASA_CALCULATION',
        value: 5432.1,
        formattedValue: '5432.10 Å²',
        unit: 'Å²',
        parameters: { algorithm: 'SHRAKE_RUPLEY', method: 'SURFACE' },
        source: { structureId: '4HHB', chainId: 'A' },
        selection: 'A',
        status: 'COMPUTED',
        provenance: {
          pipelineStage: 'SURFACE_ANALYSIS',
          softwareVersion: 'MOCS-Cert-0.1.0',
          isApproximation: false,
        },
      });

      const csvText = exportScientificResultToCsv([envelope]);
      expect(csvText).toContain('SASA_CALCULATION');

      const recovered = parseScientificResultFromCsv(csvText);
      expect(recovered.length).toBe(1);
      expect(recovered[0].resultType).toBe('SASA_CALCULATION');
      expect(recovered[0].value).toBeCloseTo(5432.1, 4);
      expect(recovered[0].unit).toBe('Å²');
      expect(recovered[0].source.structureId).toBe('4HHB');
      expect(recovered[0].source.chainId).toBe('A');
    });

    it('rejects malformed CSV without proper lineage headers', () => {
      const badCsv = 'Some,random,csv,header\n1,2,3,4';
      expect(() => parseScientificResultFromCsv(badCsv)).toThrow(
        /Malformed CSV/
      );
    });
  });

  // ===========================================================================
  // 6. ATOM REORDERING INVARIANCE
  // ===========================================================================
  describe('Atom Reordering Invariance', () => {
    it('verifies that spatial bounds (AABB) and centroid are invariant to atom order permutation', () => {
      const origCoords: Array<[number, number, number]> = [
        [10.0, 15.0, 20.0],
        [30.0, -5.0, 12.0],
        [-15.0, 40.0, 8.0],
        [22.0, 18.0, -10.0],
        [5.0, 2.0, 33.0],
      ];

      // Reordered coordinates (reverse and interleaved)
      const permutedCoords: Array<[number, number, number]> = [
        [5.0, 2.0, 33.0],
        [22.0, 18.0, -10.0],
        [10.0, 15.0, 20.0],
        [-15.0, 40.0, 8.0],
        [30.0, -5.0, 12.0],
      ];

      const boxOrig = createBox3FromCoordinates(origCoords);
      const boxPerm = createBox3FromCoordinates(permutedCoords);

      expect(boxOrig.min.x).toBeCloseTo(boxPerm.min.x, 10);
      expect(boxOrig.min.y).toBeCloseTo(boxPerm.min.y, 10);
      expect(boxOrig.min.z).toBeCloseTo(boxPerm.min.z, 10);
      expect(boxOrig.max.x).toBeCloseTo(boxPerm.max.x, 10);
      expect(boxOrig.max.y).toBeCloseTo(boxPerm.max.y, 10);
      expect(boxOrig.max.z).toBeCloseTo(boxPerm.max.z, 10);

      const centroidOrig = calculateProteinCentroid(origCoords);
      const centroidPerm = calculateProteinCentroid(permutedCoords);

      expect(centroidOrig[0]).toBeCloseTo(centroidPerm[0], 10);
      expect(centroidOrig[1]).toBeCloseTo(centroidPerm[1], 10);
      expect(centroidOrig[2]).toBeCloseTo(centroidPerm[2], 10);
    });
  });

  // ===========================================================================
  // 7. MULTI-MODEL ISOLATION (NMR ENSEMBLES)
  // ===========================================================================
  describe('Multi-Model Isolation', () => {
    it('strictly isolates atoms across NMR models preventing cross-model key collisions', () => {
      const model1_atom = buildCanonicalAtomKey({ structureId: '2KCU', modelId: 1, chainId: 'A', residueName: 'GLY', residueNumber: 1, atomName: 'CA' });
      const model2_atom = buildCanonicalAtomKey({ structureId: '2KCU', modelId: 2, chainId: 'A', residueName: 'GLY', residueNumber: 1, atomName: 'CA' });

      expect(model1_atom).not.toBe(model2_atom);

      const parsed1 = parseCanonicalAtomKey(model1_atom);
      const parsed2 = parseCanonicalAtomKey(model2_atom);

      expect(parsed1.modelId).toBe('1');
      expect(parsed2.modelId).toBe('2');
      expect(parsed1.chainId).toBe(parsed2.chainId);
      expect(parsed1.residueNumber).toBe(parsed2.residueNumber);
    });
  });

  // ===========================================================================
  // 8. MALFORMED PDB FAIL-CLOSED BEHAVIOR
  // ===========================================================================
  describe('Malformed PDB Fail-Closed Behavior', () => {
    it('fails closed on malformed residue numbers in pLDDT parser', () => {
      const badPdb = 'ATOM    600  CA  HIS A  XYZ     12.000  15.000  18.000  1.00 85.50           C';
      expect(() => extractPlddtFromPdb(badPdb)).toThrow(/Invalid residue sequence number/);
    });

    it('fails closed on NaN B-factor in pLDDT parser', () => {
      const badPdb = 'ATOM    600  CA  HIS A  87      12.000  15.000  18.000  1.00   NaN           C';
      expect(() => extractPlddtFromPdb(badPdb)).toThrow(/Invalid B-factor/);
    });

    it('fails closed on empty or non-string PDB inputs', () => {
      expect(() => extractPlddtFromPdb('')).toThrow(/non-empty string/);
    });
  });

});
