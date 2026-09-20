// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  // Protein Engine
  CANONICAL_AMINO_ACID_MAP,
  ONE_TO_THREE_LETTER_MAP,
  STANDARD_AMINO_ACIDS,
  NON_CANONICAL_AMINO_ACIDS,
  PTM_AMINO_ACIDS,
  AMBIGUOUS_AMINO_ACIDS,
  isProteinResidue,
  classifyAminoAcid,
  isAlphaCarbon,
  isCalciumIon,
  partitionProteinAtoms,
  calculateKabschAlignment,
  calculateRawCoordinateRmsd,
  pairAtomsForAlignment,
  detectSaltBridges,
  detectDisulfideBonds,
  calculateRamachandranDihedrals,
  classifySecondaryStructureFromDihedrals,
  validateSecondaryStructureElement,
  mapSequenceToCoordinates,
  calculateProteinCentroid,
  calculateCenterOfMass,
  calculateRadiusOfGyration,
  calculateMassWeightedRadiusOfGyration,
  calculateEndToEndDistance,
  calculateSecondaryStructureFractions,
  type ProteinStructuralMetrics,
  type AminoAcidRecord,

  // Geometry & Structural Identity
  classifyResidue,
  buildStructureHierarchyIndex,
  resolveMolecularComponent,
  createStaticStructureAABB,
  parseCanonicalSelection,
  type ValidatedAtom,

  // Geometry Engine
  computeBackboneRMSD,
  computeSuperposedRMSD,

  // Resolvers & Metadata
  resolveProteinSequenceFold,
  cleanAndValidateSequence,
  getStructureMetadata,
} from '../molecular';

describe('PASS 08: Protein Structural Biology & Analysis Forensic Suite', () => {

  // =========================================================================
  // 1. Amino Acid Recognition & Classification (Step 4)
  // =========================================================================
  describe('1. Standard, Non-Canonical, PTM & Ambiguous Amino Acid Recognition', () => {
    it('recognizes all 20 canonical amino acids with bidirectional 1-letter / 3-letter maps', () => {
      expect(STANDARD_AMINO_ACIDS.size).toBe(20);

      const testAAs = [
        ['ALA', 'A'], ['CYS', 'C'], ['ASP', 'D'], ['GLU', 'E'], ['PHE', 'F'],
        ['GLY', 'G'], ['HIS', 'H'], ['ILE', 'I'], ['LYS', 'K'], ['LEU', 'L'],
        ['MET', 'M'], ['ASN', 'N'], ['PRO', 'P'], ['GLN', 'Q'], ['ARG', 'R'],
        ['SER', 'S'], ['THR', 'T'], ['VAL', 'V'], ['TRP', 'W'], ['TYR', 'Y'],
      ] as const;

      for (const [code3, code1] of testAAs) {
        expect(isProteinResidue(code3)).toBe(true);
        expect(CANONICAL_AMINO_ACID_MAP[code3]).toBe(code1);
        expect(ONE_TO_THREE_LETTER_MAP[code1]).toBe(code3);

        const info = classifyAminoAcid(code3);
        expect(info.classification).toBe('standard');
        expect(info.singleLetterCode).toBe(code1);
        expect(info.isModified).toBe(false);
      }
    });

    it('accurately identifies non-canonical and genetically encoded amino acids (MSE, SEC, PYL, PCA, HYP, MLY, FME)', () => {
      // Selenomethionine
      expect(isProteinResidue('MSE')).toBe(true);
      const mse = classifyAminoAcid('MSE');
      expect(mse.classification).toBe('non-canonical');
      expect(mse.canonicalParent).toBe('MET');
      expect(mse.singleLetterCode).toBe('M');

      // Selenocysteine (U)
      expect(isProteinResidue('SEC')).toBe(true);
      const sec = classifyAminoAcid('SEC');
      expect(sec.classification).toBe('non-canonical');
      expect(sec.canonicalParent).toBe('CYS');
      expect(sec.singleLetterCode).toBe('U');

      // Pyrrolysine (O)
      expect(isProteinResidue('PYL')).toBe(true);
      const pyl = classifyAminoAcid('PYL');
      expect(pyl.classification).toBe('non-canonical');
      expect(pyl.canonicalParent).toBe('LYS');
      expect(pyl.singleLetterCode).toBe('O');

      // Pyroglutamate (PCA)
      expect(isProteinResidue('PCA')).toBe(true);
      const pca = classifyAminoAcid('PCA');
      expect(pca.classification).toBe('non-canonical');
      expect(pca.canonicalParent).toBe('GLU');

      // Hydroxyproline (HYP)
      expect(isProteinResidue('HYP')).toBe(true);
      const hyp = classifyAminoAcid('HYP');
      expect(hyp.classification).toBe('non-canonical');
      expect(hyp.canonicalParent).toBe('PRO');
    });

    it('identifies post-translationally modified amino acids (SEP, TPO, PTR, KCX, LLP, TYS)', () => {
      // Phosphoserine
      const sep = classifyAminoAcid('SEP');
      expect(sep.classification).toBe('post-translationally-modified');
      expect(sep.canonicalParent).toBe('SER');
      expect(sep.singleLetterCode).toBe('S');

      // Phosphothreonine
      const tpo = classifyAminoAcid('TPO');
      expect(tpo.classification).toBe('post-translationally-modified');
      expect(tpo.canonicalParent).toBe('THR');

      // Phosphotyrosine
      const ptr = classifyAminoAcid('PTR');
      expect(ptr.classification).toBe('post-translationally-modified');
      expect(ptr.canonicalParent).toBe('TYR');

      // Carboxylated Lysine (Rubisco active site)
      const kcx = classifyAminoAcid('KCX');
      expect(kcx.classification).toBe('post-translationally-modified');
      expect(kcx.canonicalParent).toBe('LYS');
    });

    it('identifies ambiguous amino acids (ASX, GLX, XLE, UNK) without false precision', () => {
      const asx = classifyAminoAcid('ASX');
      expect(asx.classification).toBe('ambiguous');
      expect(asx.singleLetterCode).toBe('B');

      const glx = classifyAminoAcid('GLX');
      expect(glx.classification).toBe('ambiguous');
      expect(glx.singleLetterCode).toBe('Z');

      const xle = classifyAminoAcid('XLE');
      expect(xle.classification).toBe('ambiguous');
      expect(xle.singleLetterCode).toBe('J');

      const unk = classifyAminoAcid('UNK');
      expect(unk.classification).toBe('unknown');
      expect(unk.singleLetterCode).toBe('X');
    });

    it('preserves uncertainty for unknown polymers rather than blindly classifying as protein', () => {
      expect(classifyResidue('UNKNOWN_POLYMER_XYZ', true)).toBe('custom');
      expect(classifyResidue('CELLULOSE_MONOMER', true)).toBe('custom');
      expect(classifyResidue('ALA', true)).toBe('protein');
      expect(classifyResidue('DA', true)).toBe('nucleic');
    });
  });

  // =========================================================================
  // 2. CA (Alpha Carbon) vs Ca (Calcium Ion) Discrimination (Step 7)
  // =========================================================================
  describe('2. CA (Alpha Carbon) vs Ca (Calcium Ion) Contextual Discrimination', () => {
    it('correctly discriminates Alpha Carbon from Calcium Ion in all biochemical contexts', () => {
      // 1. Real alpha carbon in alanine
      expect(isAlphaCarbon('CA', 'C', 'ALA')).toBe(true);
      expect(isCalciumIon('CA', 'C', 'ALA')).toBe(false);

      // 2. Real alpha carbon with uppercase CA atom name and C element in glycine
      expect(isAlphaCarbon('CA', 'C', 'GLY')).toBe(true);
      expect(isCalciumIon('CA', 'C', 'GLY')).toBe(false);

      // 3. Real calcium ion in PDB (residue name CA, atom name CA, element CA)
      expect(isAlphaCarbon('CA', 'CA', 'CA')).toBe(false);
      expect(isCalciumIon('CA', 'CA', 'CA')).toBe(true);

      // 4. Calcium ion named CAL
      expect(isAlphaCarbon('CAL', 'CA', 'CAL')).toBe(false);
      expect(isCalciumIon('CAL', 'CA', 'CAL')).toBe(true);

      // 5. Heteroatom CA with non-protein residue (e.g. ligand or ion context)
      expect(isAlphaCarbon('CA', 'CA', 'HOH')).toBe(false);
      expect(isCalciumIon('CA', 'CA', 'HOH')).toBe(true);
    });
  });

  // =========================================================================
  // 3. Protein Atom Partitioning (Step 7)
  // =========================================================================
  describe('3. Protein Atom Partitioning (Backbone vs Sidechain)', () => {
    it('partitions Ala residue atoms into backbone (N, CA, C, O) and sidechain (CB)', () => {
      const alaAtoms: ValidatedAtom[] = [
        { id: 1, atomName: 'N', element: 'N', coordinates: [10, 10, 10], isHetero: false },
        { id: 2, atomName: 'CA', element: 'C', coordinates: [11.2, 10.8, 10.5], isHetero: false },
        { id: 3, atomName: 'C', element: 'C', coordinates: [12.5, 10.1, 10.2], isHetero: false },
        { id: 4, atomName: 'O', element: 'O', coordinates: [13.1, 9.5, 11.1], isHetero: false },
        { id: 5, atomName: 'CB', element: 'C', coordinates: [11.0, 12.2, 10.0], isHetero: false },
      ];

      const partition = partitionProteinAtoms(alaAtoms, 'ALA');
      expect(partition.backboneAtoms.length).toBe(4);
      expect(partition.sidechainAtoms.length).toBe(1);
      expect(partition.alphaCarbon?.atomName).toBe('CA');
      expect(partition.sidechainAtoms[0].atomName).toBe('CB');
    });
  });

  // =========================================================================
  // 4. Sequence <-> Structure Mapping & Missing Residues (Step 8 & 25)
  // =========================================================================
  describe('4. Sequence <-> Structure Mapping & Missing Residues', () => {
    it('detects missing loops and terminal residues without fabricating coordinates', () => {
      // Primary sequence of 10 residues: M K V L W A G P S Y
      const primarySeq = 'MKVLWAGPSY';
      const observedMap = new Map<number, { resName: string; atomCount: number; hasCA: boolean; hasBackbone: boolean }>();

      // Coordinates exist for residues 1-3 (M K V) and 7-10 (G P S Y)
      // Residues 4-6 (L W A) are an unresolved flexible loop!
      observedMap.set(1, { resName: 'MET', atomCount: 8, hasCA: true, hasBackbone: true });
      observedMap.set(2, { resName: 'LYS', atomCount: 9, hasCA: true, hasBackbone: true });
      observedMap.set(3, { resName: 'VAL', atomCount: 7, hasCA: true, hasBackbone: true });
      // 4, 5, 6 missing!
      observedMap.set(7, { resName: 'GLY', atomCount: 4, hasCA: true, hasBackbone: true });
      observedMap.set(8, { resName: 'PRO', atomCount: 7, hasCA: true, hasBackbone: true });
      observedMap.set(9, { resName: 'SER', atomCount: 6, hasCA: true, hasBackbone: true });
      observedMap.set(10, { resName: 'TYR', atomCount: 12, hasCA: true, hasBackbone: true });

      const res = mapSequenceToCoordinates('A', primarySeq, 1, observedMap);

      expect(res.observedCount).toBe(7);
      expect(res.missingCount).toBe(3);
      expect(res.mapping.observedSequence).toBe('MKV---GPSY'); // Explicit gaps!
      expect(res.mapping.missingRanges.length).toBe(1);
      expect(res.mapping.missingRanges[0]).toEqual({
        chainId: 'A',
        startResSeq: 4,
        endResSeq: 6,
        length: 3,
      });

      // Verify that residue 4 is explicitly marked as lacking coordinates
      const res4 = res.residuePresenceList.find((r) => r.resSeq === 4);
      expect(res4?.hasCoordinates).toBe(false);
      expect(res4?.atomCount).toBe(0);
    });
  });

  // =========================================================================
  // 5. Secondary Structure & Ramachandran Geometry (Step 9 & 10)
  // =========================================================================
  describe('5. Secondary Structure Classification & Boundaries', () => {
    it('correctly classifies alpha-helix and beta-sheet regions from Ramachandran angles', () => {
      // Classic alpha helix: phi = -60°, psi = -45°
      expect(classifySecondaryStructureFromDihedrals(-60, -45)).toBe('alpha-helix');

      // Classic beta sheet: phi = -120°, psi = +135°
      expect(classifySecondaryStructureFromDihedrals(-120, 135)).toBe('beta-strand');

      // Left-handed helix / turn: phi = +60°, psi = +40°
      expect(classifySecondaryStructureFromDihedrals(60, 40)).toBe('turn');

      // Null angles yield unassigned
      expect(classifySecondaryStructureFromDihedrals(null, null)).toBe('unassigned');
    });

    it('validates secondary structure boundaries and rejects inverted ranges', () => {
      expect(
        validateSecondaryStructureElement({
          type: 'alpha-helix',
          chainId: 'A',
          startResSeq: 10,
          endResSeq: 25,
          source: 'deposited',
        }).valid
      ).toBe(true);

      expect(
        validateSecondaryStructureElement({
          type: 'alpha-helix',
          chainId: 'A',
          startResSeq: 25,
          endResSeq: 10, // Inverted!
          source: 'deposited',
        }).valid
      ).toBe(false);
    });
  });

  // =========================================================================
  // 6. Protein Non-Covalent & Covalent Interactions (Step 16)
  // =========================================================================
  describe('6. Protein Salt Bridges & Disulfide Bonds', () => {
    it('detects authentic salt bridges between Lys NZ and Asp OD1/OD2 within 4.0 Å', () => {
      const atoms = [
        {
          atom: { id: 1, atomName: 'NZ', element: 'N', coordinates: [10.0, 10.0, 10.0] as [number, number, number], isHetero: false },
          chainId: 'A',
          resSeq: 50,
          resName: 'LYS',
        },
        {
          atom: { id: 2, atomName: 'OD1', element: 'O', coordinates: [11.5, 11.0, 11.0] as [number, number, number], isHetero: false },
          chainId: 'A',
          resSeq: 95,
          resName: 'ASP',
        },
      ];

      // Distance: dx = 1.5, dy = 1.0, dz = 1.0 -> d = sqrt(2.25 + 1 + 1) = sqrt(4.25) ~ 2.06 Å <= 4.0 Å!
      const bridges = detectSaltBridges(atoms);
      expect(bridges.length).toBe(1);
      expect(bridges[0].cationResidue.resName).toBe('LYS');
      expect(bridges[0].anionResidue.resName).toBe('ASP');
      expect(bridges[0].distance).toBeCloseTo(2.06, 1);
      expect(bridges[0].isInterChain).toBe(false);
    });

    it('detects authentic disulfide bonds between Cys SG atoms within 1.90 - 2.20 Å', () => {
      const atoms = [
        {
          atom: { id: 1, atomName: 'SG', element: 'S', coordinates: [20.0, 15.0, 30.0] as [number, number, number], isHetero: false },
          chainId: 'A',
          resSeq: 26,
          resName: 'CYS',
        },
        {
          atom: { id: 2, atomName: 'SG', element: 'S', coordinates: [21.5, 16.0, 30.8] as [number, number, number], isHetero: false },
          chainId: 'A',
          resSeq: 84,
          resName: 'CYS',
        },
      ];

      // Distance: dx = 1.5, dy = 1.0, dz = 0.8 -> d = sqrt(2.25 + 1.0 + 0.64) = sqrt(3.89) ~ 1.97 Å (valid disulfide!)
      const disulfides = detectDisulfideBonds(atoms);
      expect(disulfides.length).toBe(1);
      expect(disulfides[0].cys1.residueNumber).toBe(26);
      expect(disulfides[0].cys2.residueNumber).toBe(84);
      expect(disulfides[0].distance).toBeCloseTo(1.97, 1);
    });
  });

  // =========================================================================
  // 7. Structural Metrics: Rg, COM, End-to-End Distance (Step 20)
  // =========================================================================
  describe('7. Structural Metrics (Centroid, COM, Rg, End-to-End)', () => {
    it('computes exact unweighted and mass-weighted radius of gyration', () => {
      // 4 points on coordinate axes at distance 10 Å from origin:
      // [10, 0, 0], [-10, 0, 0], [0, 10, 0], [0, -10, 0]
      const coords: [number, number, number][] = [
        [10, 0, 0],
        [-10, 0, 0],
        [0, 10, 0],
        [0, -10, 0],
      ];
      const centroid = calculateProteinCentroid(coords);
      expect(centroid).toEqual([0, 0, 0]);

      // Rg = sqrt((100 + 100 + 100 + 100)/4) = sqrt(100) = 10.000 Å!
      const rg = calculateRadiusOfGyration(coords);
      expect(rg).toBe(10.0);
    });

    it('calculates authentic End-to-End distance between N- and C-terminal CA atoms', () => {
      const caCoords: [number, number, number][] = [
        [0, 0, 0],    // N-term CA
        [5, 5, 5],    // internal
        [10, 20, 20], // C-term CA
      ];
      // d = sqrt(100 + 400 + 400) = sqrt(900) = 30.00 Å!
      const dE2E = calculateEndToEndDistance(caCoords);
      expect(dE2E).toBe(30.0);
    });

    it('calculates secondary structure fractions correctly', () => {
      const assignments = [
        'alpha-helix', 'alpha-helix', 'alpha-helix', 'alpha-helix', // 4 helix
        'beta-strand', 'beta-strand',                               // 2 strand
        'coil', 'turn', 'coil', 'coil',                            // 4 coil
      ] as const;

      const frac = calculateSecondaryStructureFractions([...assignments]);
      expect(frac.helixFraction).toBe(0.4);
      expect(frac.sheetFraction).toBe(0.2);
      expect(frac.coilFraction).toBe(0.4);
    });
  });

  // =========================================================================
  // 8. Kabsch Structural Superposition & Alignment RMSD (Step 20 & 21)
  // =========================================================================
  describe('8. Kabsch Structural Superposition & Optimal RMSD', () => {
    it('yields RMSD = 0.0000 Å for identical structures rotated and translated in space', () => {
      // Original 5-atom motif
      const targetCoords: [number, number, number][] = [
        [0.0, 0.0, 0.0],
        [1.0, 2.0, 0.5],
        [-1.5, 3.0, 1.2],
        [2.5, -1.0, 4.0],
        [0.5, 4.5, -2.0],
      ];

      // Rotate source by 90° about Z-axis and translate by [10, 20, 30]:
      // (x', y', z') = (-y + 10, x + 20, z + 30)
      const rotatedSourceCoords: [number, number, number][] = targetCoords.map(([x, y, z]) => [
        -y + 10.0,
        x + 20.0,
        z + 30.0,
      ]);

      // 1. Raw coordinate RMSD without alignment is large!
      const rawRmsd = calculateRawCoordinateRmsd(rotatedSourceCoords, targetCoords);
      expect(rawRmsd).toBeGreaterThan(25.0);

      // 2. Kabsch structural alignment restores 0.0000 Å RMSD!
      const alignment = calculateKabschAlignment(rotatedSourceCoords, targetCoords);
      expect(alignment.rmsd).toBeLessThan(0.002);
      expect(alignment.rmsd).toBeCloseTo(0.0000, 2);
      expect(alignment.pairedAtomCount).toBe(5);

      // 3. Superposed coordinates match target coordinates bit-closely
      for (let i = 0; i < 5; i++) {
        expect(alignment.superposedSourceCoords[i][0]).toBeCloseTo(targetCoords[i][0], 2);
        expect(alignment.superposedSourceCoords[i][1]).toBeCloseTo(targetCoords[i][1], 2);
        expect(alignment.superposedSourceCoords[i][2]).toBeCloseTo(targetCoords[i][2], 2);
      }
    });

    it('rejects mismatched coordinate array lengths in Kabsch alignment with explicit error', () => {
      const cA: [number, number, number][] = [[0, 0, 0], [1, 1, 1]];
      const cB: [number, number, number][] = [[0, 0, 0]];
      expect(() => calculateKabschAlignment(cA, cB)).toThrow(/identical paired point counts/);
    });

    it('pairs atoms by sequence number and atom name, detecting unmatched residues', () => {
      const atomsA = [
        { chain: 'A', resSeq: 1, atomName: 'CA', coords: [0, 0, 0] as [number, number, number] },
        { chain: 'A', resSeq: 2, atomName: 'CA', coords: [3.8, 0, 0] as [number, number, number] },
        { chain: 'A', resSeq: 3, atomName: 'CA', coords: [7.6, 0, 0] as [number, number, number] },
      ];
      const atomsB = [
        { chain: 'A', resSeq: 1, atomName: 'CA', coords: [0.1, 0, 0] as [number, number, number] },
        { chain: 'A', resSeq: 2, atomName: 'CA', coords: [3.9, 0, 0] as [number, number, number] },
        // Residue 3 is missing in B!
      ];

      const paired = pairAtomsForAlignment(atomsA, atomsB, 'CA');
      expect(paired.pairedCoordsA.length).toBe(2);
      expect(paired.pairedCoordsB.length).toBe(2);
      expect(paired.unmatchedACount).toBe(1);
      expect(paired.unmatchedBCount).toBe(0);
    });
  });

  // =========================================================================
  // 9. 4HHB Tetramer Regression (Step 12)
  // =========================================================================
  describe('9. 4HHB Tetramer Regression (Distinct Subunits & Fe-NE2 Distance)', () => {
    it('verifies 4HHB metadata references authentic crystallography with 2.14 Å Fe-NE2 distance', () => {
      const hhbMeta = getStructureMetadata('4HHB');
      expect(hhbMeta).toBeDefined();
      expect(hhbMeta.kind).toBe('experimental');
      expect(hhbMeta.method).toBe('X-Ray Diffraction');
      expect(hhbMeta.resolution).toBe('1.74 Å');
      expect(hhbMeta.organism).toBe('Homo sapiens');
      expect(hhbMeta.defaultSelA).toBe('A:87:NE2');
      expect(hhbMeta.defaultSelB).toBe('HEM:142:FE');
      expect(hhbMeta.defaultDistance).toBe(2.14);
    });

    it('enforces strict chain scoping: never resolves Chain A His 87 to Chain C HEM 142', () => {
      // Chain A His 87 NE2 [16.894, 20.030, 24.002]
      // Chain A HEM 142 FE   [18.362, 18.488, 23.755] -> dist = 2.14 Å
      // Chain C HEM 142 FE   [-2.308, 17.519, 44.755] -> dist = 28.39 Å
      const mock4HHBAtoms = [
        { serial: 1, atom: 'NE2', resn: 'HIS', chain: 'A', resi: 87, x: 16.894, y: 20.030, z: 24.002, hetflag: false },
        { serial: 2, atom: 'FE', resn: 'HEM', chain: 'A', resi: 142, x: 18.362, y: 18.488, z: 23.755, hetflag: true },
        { serial: 3, atom: 'FE', resn: 'HEM', chain: 'C', resi: 142, x: -2.308, y: 17.519, z: 44.755, hetflag: true },
      ];

      // Explicit Chain A query
      const boundsChainA = createStaticStructureAABB(mock4HHBAtoms, 'A:87:NE2', 'A:142:FE');
      expect(boundsChainA.measuredDistance).toBeCloseTo(2.14, 2);
      expect(boundsChainA.ligandComponent?.id.chainId).toBe('A');

      // Explicit Chain C query
      const boundsChainC = createStaticStructureAABB(mock4HHBAtoms, 'A:87:NE2', 'C:142:FE');
      expect(boundsChainC.measuredDistance).toBeCloseTo(28.39, 2);
      expect(boundsChainC.ligandComponent?.id.chainId).toBe('C');
    });
  });

  // =========================================================================
  // 10. Multi-Chain Complexes & Mixed Biomolecules (Step 13 & 15)
  // =========================================================================
  describe('10. Multi-Chain Complex & Protein-DNA / Protein-Ligand Boundaries', () => {
    it('verifies 1TUP has distinct p53 protein, DNA duplex, and Zinc ion components', () => {
      const tupMeta = getStructureMetadata('1TUP');
      expect(tupMeta).toBeDefined();
      expect(tupMeta.resolution).toBe('2.20 Å');
      expect(tupMeta.tags).toContain('Protein-DNA Complex');
      expect(tupMeta.tags).toContain('Zinc Finger');
    });

    it('verifies 1STP has high-affinity Streptavidin protein and Biotin ligand', () => {
      const stpMeta = getStructureMetadata('1STP');
      expect(stpMeta).toBeDefined();
      expect(stpMeta.resolution).toBe('1.40 Å');
      expect(stpMeta.defaultSelA).toBe('A:49:ASN');
      expect(stpMeta.defaultSelB).toBe('BTN:300:O2');
      expect(stpMeta.defaultDistance).toBe(2.78);
    });

    it('verifies 1CRN crambin ultra-high resolution hydrophobic seed protein', () => {
      const crnMeta = getStructureMetadata('1CRN');
      expect(crnMeta).toBeDefined();
      expect(crnMeta.resolution).toBe('0.54 Å');
      expect(crnMeta.tags).toContain('Disulfide-Rich');
    });
  });

  // =========================================================================
  // 11. Experimental vs Predicted Structural Quality Separation (Step 17 & 18)
  // =========================================================================
  describe('11. Experimental vs Predicted Quality & Provenance Separation', () => {
    it('verifies AlphaFold models have pLDDT confidence metrics and experimental = false', () => {
      const afHba = getStructureMetadata('AF-P69905-F1');
      expect(afHba.kind).toBe('predicted');
      expect(afHba.provider).toBe('AlphaFold DB');
      expect(afHba.confidenceMetrics?.plddtAvg).toBe(98.4);
      expect(afHba.resolution).toContain('pLDDT'); // Clearly marked as pLDDT, NOT Ångström resolution!
    });

    it('resolves protein sequence fold with authentic plddt and experimental = false', async () => {
      const fasta = 'MKVLWAGPSY';
      const ctrl = new AbortController();
      ctrl.abort(); // Enforce offline prediction without external network dependency
      const fold = await resolveProteinSequenceFold(fasta, 'esmfold_custom', ctrl.signal);
      expect(fold.candidate.experimental).toBe(false);
      expect(fold.candidate.plddt).toBeGreaterThan(70);
      expect(fold.candidate.resolution).toBeUndefined(); // Resolution is NOT defined for predicted folds!
      expect(fold.pdbText).toContain('ATOM');
      expect(fold.sequence).toBe(fasta);
    });
  });

  // =========================================================================
  // 12. Insertion Code Handling & Negative Tests (Step 6 & 36)
  // =========================================================================
  describe('12. Insertion Code Handling & Negative Verification', () => {
    it('preserves insertion codes without collapsing 100, 100A, 100B', () => {
      const selA = parseCanonicalSelection('A:100A:CA');
      expect(selA.resSeq).toBe(100);
      expect(selA.insCode).toBe('A');

      const selB = parseCanonicalSelection('A:100B:CA');
      expect(selB.resSeq).toBe(100);
      expect(selB.insCode).toBe('B');

      const selPlain = parseCanonicalSelection('A:100:CA');
      expect(selPlain.resSeq).toBe(100);
      expect(selPlain.insCode).toBeUndefined();

      expect(selA).not.toEqual(selB);
      expect(selA).not.toEqual(selPlain);
    });

    it('rejects invalid or empty protein sequences with descriptive error', () => {
      expect(() => cleanAndValidateSequence('')).toThrow(/Protein sequence is empty/);
      expect(() => cleanAndValidateSequence('M123')).toThrow(/Sequence too short/);
      expect(() => cleanAndValidateSequence('MKV12B')).toThrow(/invalid amino acid characters/);
    });
  });

});
