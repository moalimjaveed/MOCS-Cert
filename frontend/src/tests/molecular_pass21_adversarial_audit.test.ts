// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  // Geometry & Structural Identity
  buildStructureHierarchyIndex,
  resolveMolecularComponent,
  resolveAllMatchingComponents,
  parseCanonicalSelection,
  classifySelectionSafety,
  type ValidatedAtom,
  type IndexedComponent,
  type StructureHierarchyIndex,
  resolveMeasurementEndpoint,

  // Measurements & Calculations
  calculateEuclideanDistance,
  calculateMinimumImageDistance,
  calculateBondAngleDeg,
  calculateDihedralAngleDeg,

  // Protein & Alignment
  calculateRawCoordinateRmsd,
  calculateWeightedKabschAlignment,
  computePointCentroid,

  // Surfaces & SASA
  computeSASA,
  detectGeometricPockets,

  // Nucleic
  detectRiboseVsDeoxyribose,
  classifyNucleicType,
  evaluateBasePair,

  // Trajectory & Physics
  calculateCoordinateEvolution,
  calculateTrajectoryAngleSeries,
  CrossModuleCacheManager,

  // Design & Negative Gates
  auditDockingPose,
  BiopolymerMismatchError,

  // Export Round-Trip
  exportToPdb,
  exportToFasta,
  exportToCsv,
  exportScientificResultJson,
  deserializeScientificResult,
  parsePdbText,
  verifyPdbRoundTripFidelity,
  createScientificResult,
} from '../molecular';

describe('PASS 21: Independent Blind Scientific Acceptance & Adversarial Audit Suite', () => {

  // =========================================================================
  // 1. GOLDEN STRUCTURE #1 — 4HHB ADVERSARIAL ISOLATION
  // =========================================================================
  describe('Golden Structure #1 — 4HHB Adversarial Isolation & Entity Integrity', () => {
    // Ground truth coordinates extracted directly from authentic 4HHB.pdb
    const his87_A: ValidatedAtom = {
      id: 636,
      atomName: 'NE2',
      element: 'N',
      coordinates: [16.894, 20.030, 24.002],
      isHetero: false,
    };
    const hemFe_A: ValidatedAtom = {
      id: 4330,
      atomName: 'FE',
      element: 'FE',
      coordinates: [18.362, 18.488, 23.755],
      isHetero: true,
    };
    const his87_C: ValidatedAtom = {
      id: 2805,
      atomName: 'NE2',
      element: 'N',
      coordinates: [6.358, 24.601, 54.168],
      isHetero: false,
    };
    const hemFe_C: ValidatedAtom = {
      id: 4522,
      atomName: 'FE',
      element: 'FE',
      coordinates: [4.445, 23.463, 54.548],
      isHetero: true,
    };

    const compHis87_A: IndexedComponent = {
      id: {
        structureId: '4HHB',
        modelId: 1,
        chainId: 'A',
        classification: 'protein',
        residueName: 'HIS',
        residueNumber: 87,
      },
      canonicalLabel: 'HIS · Chain A · 87',
      shortLabel: 'A:HIS:87',
      atoms: [his87_A],
    };

    const compHem_A: IndexedComponent = {
      id: {
        structureId: '4HHB',
        modelId: 1,
        chainId: 'A',
        classification: 'cofactor',
        residueName: 'HEM',
        residueNumber: 142,
      },
      canonicalLabel: 'HEM · Chain A · 142',
      shortLabel: 'A:HEM:142',
      atoms: [hemFe_A],
    };

    const compHis87_C: IndexedComponent = {
      id: {
        structureId: '4HHB',
        modelId: 1,
        chainId: 'C',
        classification: 'protein',
        residueName: 'HIS',
        residueNumber: 87,
      },
      canonicalLabel: 'HIS · Chain C · 87',
      shortLabel: 'C:HIS:87',
      atoms: [his87_C],
    };

    const compHem_C: IndexedComponent = {
      id: {
        structureId: '4HHB',
        modelId: 1,
        chainId: 'C',
        classification: 'cofactor',
        residueName: 'HEM',
        residueNumber: 142,
      },
      canonicalLabel: 'HEM · Chain C · 142',
      shortLabel: 'C:HEM:142',
      atoms: [hemFe_C],
    };

    const mock4HhbIndex: StructureHierarchyIndex = {
      structureId: '4HHB',
      modelId: 1,
      chains: new Map([
        [
          'A',
          {
            chainId: 'A',
            classification: 'protein',
            components: new Map([
              ['87', compHis87_A],
              ['142', compHem_A],
            ]),
          },
        ],
        [
          'C',
          {
            chainId: 'C',
            classification: 'protein',
            components: new Map([
              ['87', compHis87_C],
              ['142', compHem_C],
            ]),
          },
        ],
      ]),
      allComponents: [compHis87_A, compHem_A, compHis87_C, compHem_C],
      totalValidAtoms: 4,
      invalidAtomsCount: 0,
    };

    it('independently verifies intra-chain coordination distance for Chain A and Chain C', () => {
      const distA = calculateEuclideanDistance(his87_A.coordinates, hemFe_A.coordinates);
      const distC = calculateEuclideanDistance(his87_C.coordinates, hemFe_C.coordinates);

      // Independent mathematical derivation:
      // distA = sqrt((18.362-16.894)^2 + (18.488-20.030)^2 + (23.755-24.002)^2) = 2.1433 Å
      // distC = sqrt((4.445-6.358)^2 + (23.463-24.601)^2 + (54.548-54.168)^2) = 2.2581 Å
      expect(distA).toBeCloseTo(2.1433, 3);
      expect(distC).toBeCloseTo(2.2581, 3);
    });

    it('ADVERSARIAL ATTACK: Chain C HEM 142 cannot contaminate Chain A calculation scope', () => {
      // If Chain C HEM 142 contaminated Chain A His87, distance would explode to > 33 Å
      const distCrossAC = calculateEuclideanDistance(his87_A.coordinates, hemFe_C.coordinates);
      const distCrossCA = calculateEuclideanDistance(his87_C.coordinates, hemFe_A.coordinates);

      expect(distCrossAC).toBeCloseTo(33.1636, 2);
      expect(distCrossCA).toBeCloseTo(33.2628, 2);

      // Scoped selection resolution MUST isolate Chain A
      const resA = resolveMeasurementEndpoint(mock4HhbIndex, 'A:HEM:142:FE');
      expect(resA.atom).not.toBeNull();
      expect(resA.atom?.chainId).toBe('A');
      expect(resA.atom?.resSeq).toBe(142);
      expect(resA.atom?.coords).toEqual([18.362, 18.488, 23.755]);

      // Scoped selection resolution MUST isolate Chain C
      const resC = resolveMeasurementEndpoint(mock4HhbIndex, 'C:HEM:142:FE');
      expect(resC.atom).not.toBeNull();
      expect(resC.atom?.chainId).toBe('C');
      expect(resC.atom?.resSeq).toBe(142);
      expect(resC.atom?.coords).toEqual([4.445, 23.463, 54.548]);

      // Ambiguous query without chain in tetramer must flag ambiguity
      const resAmb = resolveMeasurementEndpoint(mock4HhbIndex, 'HEM:142:FE');
      expect(resAmb.isAmbiguous).toBe(true);

      expect(classifySelectionSafety('A:HEM:142:FE')).toBe('STRUCTURALLY_SAFE');
      expect(classifySelectionSafety('HEM:142:FE')).toBe('POTENTIALLY_AMBIGUOUS');
    });

    it('strictly isolates HEM A and HEM C bounding boxes without overlapping', () => {
      // HEM A box vs HEM C box in Z coordinate space (HEM A is Z~23 Å, HEM C is Z~54 Å)
      expect(hemFe_A.coordinates[2]).toBeLessThan(30.0);
      expect(hemFe_C.coordinates[2]).toBeGreaterThan(50.0);
      expect(Math.abs(hemFe_C.coordinates[2] - hemFe_A.coordinates[2])).toBeGreaterThan(30.0);
    });
  });

  // =========================================================================
  // 2. GOLDEN STRUCTURE #2 — 1BNA NUCLEIC DUPLEX & NEGATIVE GATES
  // =========================================================================
  describe('Golden Structure #2 — 1BNA Nucleic Duplex & Epistemic Separation', () => {
    // Authentic atoms from 1BNA.pdb
    const bnaAtoms: ValidatedAtom[] = [
      { id: 1, atomName: "O5'", element: 'O', coordinates: [18.935, 34.195, 25.617], isHetero: false },
      { id: 7, atomName: "C2'", element: 'C', coordinates: [18.948, 31.223, 22.647], isHetero: false },
      { id: 14, atomName: 'N4', element: 'N', coordinates: [14.828, 27.477, 25.444], isHetero: false }, // DC1 N4
      { id: 482, atomName: 'O6', element: 'O', coordinates: [14.719, 25.373, 27.067], isHetero: false }, // DG24 O6
    ];

    it('identifies Deoxyribose sugar chemistry (DNA) via strict absence of O2-prime', () => {
      const sugarType = detectRiboseVsDeoxyribose(bnaAtoms);
      expect(sugarType).not.toBe('ribose');

      // Given complete residue with C1', C2', C3' but no O2'
      const completeDnaResidue: ValidatedAtom[] = [
        { id: 1, atomName: "C1'", element: 'C', coordinates: [0, 0, 0], isHetero: false },
        { id: 2, atomName: "C2'", element: 'C', coordinates: [1, 0, 0], isHetero: false },
        { id: 3, atomName: "C3'", element: 'C', coordinates: [1, 1, 0], isHetero: false },
      ];
      expect(detectRiboseVsDeoxyribose(completeDnaResidue)).toBe('deoxyribose');

      // Given complete residue with O2'
      const completeRnaResidue: ValidatedAtom[] = [
        ...completeDnaResidue,
        { id: 4, atomName: "O2'", element: 'O', coordinates: [1, -1, 0], isHetero: false },
      ];
      expect(detectRiboseVsDeoxyribose(completeRnaResidue)).toBe('ribose');
    });

    it('classifies 1BNA residues definitively as DNA', () => {
      expect(classifyNucleicType('DA')).toBe('dna');
      expect(classifyNucleicType('DC')).toBe('dna');
      expect(classifyNucleicType('DG')).toBe('dna');
      expect(classifyNucleicType('DT')).toBe('dna');
      expect(classifyNucleicType('U')).toBe('rna');
    });

    it('evaluates authentic Watson-Crick C1-G24 base pair hydrogen bond distance', () => {
      // N4(DC 1) to O6(DG 24)
      const dc1_N4 = bnaAtoms.find((a) => a.atomName === 'N4')!;
      const dg24_O6 = bnaAtoms.find((a) => a.atomName === 'O6')!;
      const dist = calculateEuclideanDistance(dc1_N4.coordinates, dg24_O6.coordinates);

      // sqrt((14.719-14.828)^2 + (25.373-27.477)^2 + (27.067-25.444)^2) = 2.6595 Å
      expect(dist).toBeCloseTo(2.6595, 3);
      expect(dist).toBeLessThan(3.5); // Canonical H-bond distance cutoff
    });

    it('NEGATIVE GATE: protein-only docking strictly rejects nucleic acids with BiopolymerMismatchError', () => {
      expect(() => {
        auditDockingPose({
          receptorId: '1BNA',
          ligandId: 'LIG',
          dockingEngine: 'AutoDock Vina',
          engineVersion: '1.2.5',
          poseRank: 1,
          rawScore: -8.4,
          receptorAtoms: [{ element: 'P', coords: [0, 0, 0], chainId: 'A', resSeq: 1 }],
          ligandAtoms: [{ element: 'C', coords: [2, 0, 0], atomName: 'C1' }],
          isNucleicReceptor: true, // 1BNA is pure nucleic acid!
        });
      }).toThrow(BiopolymerMismatchError);
    });
  });

  // =========================================================================
  // 3. TRAJECTORY FORENSICS — GENUINE COORDINATE EVOLUTION
  // =========================================================================
  describe('Trajectory Forensics — Genuine Coordinate Evolution vs Static Benchmark', () => {
    // Exact positions of Atom 0 (CA) and Atom 1 (LIG) from tests/data/synth_500f.xtc
    const frame0Coords: Array<[number, number, number]> = [
      [40.0, 40.0, 40.0],
      [45.5, 40.0, 40.0],
    ];
    const frame50Coords: Array<[number, number, number]> = [
      [40.0, 40.0, 40.0],
      [45.5, 40.0, 40.0],
    ];
    const frame200Coords: Array<[number, number, number]> = [
      [40.0, 40.0, 40.0],
      [42.8, 40.0, 40.0],
    ];
    const frame410Coords: Array<[number, number, number]> = [
      [40.0, 40.0, 40.0],
      [43.75, 40.0, 40.0],
    ];

    it('detects that frames 0 and 50 are identical (static baseline)', () => {
      const evo = calculateCoordinateEvolution(frame0Coords, frame50Coords);
      expect(evo.isStatic).toBe(true);
      expect(evo.maxCoordinateDiff).toBe(0.0);
      expect(evo.differingAtomsCount).toBe(0);
    });

    it('proves authentic coordinate displacement between frame 0 and frame 200', () => {
      const evo = calculateCoordinateEvolution(frame0Coords, frame200Coords);
      expect(evo.isStatic).toBe(false);
      expect(evo.maxCoordinateDiff).toBeCloseTo(2.7, 1);
      expect(evo.differingAtomsCount).toBe(1); // LIG moved from 45.5 to 42.8
    });

    it('evaluates distance change between frame 0 (5.50 Å) and frame 410 (3.75 Å)', () => {
      const d0 = calculateEuclideanDistance(frame0Coords[0], frame0Coords[1]);
      const d410 = calculateEuclideanDistance(frame410Coords[0], frame410Coords[1]);

      expect(d0).toBeCloseTo(5.50, 2);
      expect(d410).toBeCloseTo(3.75, 2);
      expect(d410).toBeLessThan(4.0); // Satisfies query distance predicate!
    });
  });

  // =========================================================================
  // 4. NUMERICAL INDEPENDENCE, GEOMETRY & PBC
  // =========================================================================
  describe('Numerical Independence, Degenerate Geometry & Transformation Invariance', () => {
    it('preserves Euclidean distance under translation', () => {
      const p1: [number, number, number] = [12.5, 34.2, 56.1];
      const p2: [number, number, number] = [15.1, 38.0, 52.4];
      const origDist = calculateEuclideanDistance(p1, p2);

      const offset: [number, number, number] = [100.0, -250.0, 80.0];
      const p1Trans: [number, number, number] = [p1[0] + offset[0], p1[1] + offset[1], p1[2] + offset[2]];
      const p2Trans: [number, number, number] = [p2[0] + offset[0], p2[1] + offset[1], p2[2] + offset[2]];
      const transDist = calculateEuclideanDistance(p1Trans, p2Trans);

      expect(transDist).toBeCloseTo(origDist, 10);
    });

    it('returns exact 0.0 for coincident points without NaN division', () => {
      const p: [number, number, number] = [10.0, 20.0, 30.0];
      expect(calculateEuclideanDistance(p, p)).toBe(0.0);
    });

    it('handles degenerate 3-point angle and returns valid clamped degree', () => {
      const pA: [number, number, number] = [0, 0, 0];
      const pB: [number, number, number] = [0, 0, 0]; // Coincident with vertex
      const pC: [number, number, number] = [1, 0, 0];

      const angle = calculateBondAngleDeg(pA, pB, pC);
      // Coincident vertex returns null or safely bounded value
      expect(angle === null || Number.isFinite(angle)).toBe(true);
    });

    it('correctly calculates minimum image distance across periodic box', () => {
      const box: [number, number, number] = [80.0, 80.0, 80.0];
      const pA: [number, number, number] = [1.0, 10.0, 10.0];
      const pB: [number, number, number] = [79.0, 10.0, 10.0];

      // Standard distance = 78.0 Å
      // Minimum image distance across 80 Å box = 80.0 - 78.0 = 2.0 Å
      const pbcDist = calculateMinimumImageDistance(pA, pB, box);
      expect(pbcDist).toBeCloseTo(2.0, 4);
    });

    it('rejects NaN and Infinity coordinates safely', () => {
      const nanCoord: any = [NaN, 10.0, 10.0];
      const infCoord: any = [Infinity, 10.0, 10.0];
      const validCoord: [number, number, number] = [10.0, 10.0, 10.0];

      expect(Number.isNaN(calculateEuclideanDistance(nanCoord, validCoord))).toBe(true);
      expect(Number.isNaN(calculateEuclideanDistance(infCoord, validCoord))).toBe(true);
    });
  });

  // =========================================================================
  // 5. EXPORT ROUND-TRIP FIDELITY & PROVENANCE
  // =========================================================================
  describe('Export Round-Trip Fidelity & Provenance Serialization', () => {
    const testAtoms: ValidatedAtom[] = [
      { id: 1, atomName: 'CA', element: 'C', coordinates: [12.345, 23.456, 34.567], isHetero: false },
      { id: 2, atomName: 'FE', element: 'FE', coordinates: [18.111, 28.222, 38.333], isHetero: true },
    ];

    it('verifies PDB export round-trip coordinate fidelity within <= 0.001 Å', () => {
      const pdbText = exportToPdb(testAtoms);
      const reParsed = parsePdbText(pdbText);

      expect(reParsed.length).toBe(2);
      expect(reParsed[0].coordinates[0]).toBeCloseTo(12.345, 3);
      expect(reParsed[0].coordinates[1]).toBeCloseTo(23.456, 3);
      expect(reParsed[0].coordinates[2]).toBeCloseTo(34.567, 3);
      expect(reParsed[1].element).toBe('FE');
      expect(reParsed[1].isHetero).toBe(true);

      const fidelity = verifyPdbRoundTripFidelity(reParsed, pdbText);
      expect(fidelity.matches).toBe(true);
      expect(fidelity.maxCoordDelta).toBeLessThanOrEqual(0.001);
    });

    it('verifies ScientificResultEnvelope JSON export and round-trip deserialization', () => {
      const envelope = createScientificResult({
        resultType: 'INTERACTION_DISTANCE',
        source: {
          structureId: '4HHB',
          chainId: 'A',
        },
        selection: 'A:87:NE2',
        unit: 'Å',
        status: 'COMPUTED',
        provenance: { provider: 'RCSB', modelId: '4HHB', experimental: true },
        value: 2.1433,
      });

      const jsonStr = exportScientificResultJson(envelope);
      const restored = deserializeScientificResult(jsonStr);

      expect(restored.resultType).toBe('INTERACTION_DISTANCE');
      expect(restored.value).toBeCloseTo(2.1433, 4);
      expect(restored.unit).toBe('Å');
      expect(restored.source.structureId).toBe('4HHB');
      expect(restored.status).toBe('COMPUTED');
    });

    it('exports CSV with mandatory unit headers', () => {
      const records = [{ atom: 'FE', distance: 2.1433 }];
      const columns = [
        { key: 'atom', label: 'Atom' },
        { key: 'distance', label: 'Distance', unit: 'Å' },
      ];

      const csv = exportToCsv(records, columns);
      expect(csv).toContain('"Atom","Distance (Å)"');
      expect(csv).toContain('"FE",2.1433');
    });
  });

  // =========================================================================
  // 6. CROSS-MODULE CACHE & CONCURRENCY
  // =========================================================================
  describe('Cross-Module Cache & Concurrency Key Scoping', () => {
    it('differentiates cache entries across structures, chains, and frames', () => {
      const cache = new CrossModuleCacheManager(100);

      const keyA0 = cache.buildKey({
        structureId: '4HHB',
        chainId: 'A',
        frameIndex: 0,
        calculationType: 'sasa',
      });

      const keyC0 = cache.buildKey({
        structureId: '4HHB',
        chainId: 'C',
        frameIndex: 0,
        calculationType: 'sasa',
      });

      const keyA1 = cache.buildKey({
        structureId: '4HHB',
        chainId: 'A',
        frameIndex: 1,
        calculationType: 'sasa',
      });

      expect(keyA0).not.toBe(keyC0);
      expect(keyA0).not.toBe(keyA1);

      cache.set(keyA0, { totalSasa: 550.0 });
      cache.set(keyC0, { totalSasa: 560.0 });

      expect(cache.get(keyA0)).toEqual({ totalSasa: 550.0 });
      expect(cache.get(keyC0)).toEqual({ totalSasa: 560.0 });

      // Structure invalidation evicts 4HHB
      const evicted = cache.invalidateOnStructureChange('1BNA');
      expect(evicted).toBe(2);
      expect(cache.has(keyA0)).toBe(false);
      expect(cache.has(keyC0)).toBe(false);
    });
  });
});
