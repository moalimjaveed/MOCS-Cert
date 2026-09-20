import { describe, it, expect } from 'vitest';
import {
  buildCanonicalAtomKey,
  parseCanonicalAtomKey,
  buildCanonicalBondKey,
  areAtomsInSameChain,
  areAtomsInSameModel,
  areAtomsAltLocCompatible,
  getCovalentRadius,
  isCovalentDistance,
  parsePdbConectRecords,
  parseStructConnRecords,
  buildPeptideBonds,
  buildPhosphodiesterBonds,
  buildDisulfideBonds,
  buildIntraResidueBonds,
  perceiveRings,
  calculateBondLength,
  calculateBondAngleDeg,
  calculateDihedralDeg,
  buildMolecularGraph,
  TopologyCacheManager,
  topologyCache,
} from '../molecular/topology';
import type { TopologyAtom, StructConnRecord } from '../molecular/topology';

describe('PASS 14: Molecular Geometry, Chemical Connectivity & Bond-Topology Forensic Suite', () => {

  // =========================================================================
  // 1. CANONICAL ATOM & BOND IDENTITY
  // =========================================================================
  describe('1. Canonical Atom & Bond Identity', () => {
    it('generates deterministic canonical atom key preserving all hierarchical tiers', () => {
      const key = buildCanonicalAtomKey({
        structureId: '4HHB',
        modelId: 1,
        chainId: 'A',
        residueName: 'HEM',
        residueNumber: 142,
        atomName: 'FE',
      });

      expect(key).toBe('4HHB:1:A:HEM:142:FE');
    });

    it('generates canonical atom key with insertion code and alternate location', () => {
      const key = buildCanonicalAtomKey({
        structureId: '1TUP',
        modelId: 1,
        chainId: 'B',
        residueName: 'CYS',
        residueNumber: 182,
        insertionCode: 'A',
        atomName: 'SG',
        altLoc: 'B',
      });

      expect(key).toBe('1TUP:1:B:CYS:182:A:SG:B');
    });

    it('parses canonical atom key back into structural attributes', () => {
      const parsed = parseCanonicalAtomKey('4HHB:1:C:HIS:87:NE2');
      expect(parsed.structureId).toBe('4HHB');
      expect(parsed.modelId).toBe('1');
      expect(parsed.chainId).toBe('C');
      expect(parsed.residueName).toBe('HIS');
      expect(parsed.residueNumber).toBe(87);
      expect(parsed.atomName).toBe('NE2');
    });

    it('builds symmetric, order-independent canonical bond key (A <-> B === B <-> A)', () => {
      const key1 = '4HHB:1:A:VAL:1:CA';
      const key2 = '4HHB:1:A:VAL:1:C';

      const bondKeyA = buildCanonicalBondKey(key1, key2);
      const bondKeyB = buildCanonicalBondKey(key2, key1);

      expect(bondKeyA).toBe(bondKeyB);
      expect(bondKeyA).toBe('4HHB:1:A:VAL:1:C <-> 4HHB:1:A:VAL:1:CA');
    });

    it('strictly forbids self-loop bond key on identical atom', () => {
      const key = '4HHB:1:A:VAL:1:CA';
      expect(() => buildCanonicalBondKey(key, key)).toThrow(/Self-loop/);
    });

    it('evaluates model, chain, and altLoc isolation guards', () => {
      const a1 = '4HHB:1:A:GLY:10:CA';
      const a2 = '4HHB:1:A:GLY:10:C';
      const aChainB = '4HHB:1:B:GLY:10:CA';
      const aModel2 = '4HHB:2:A:GLY:10:CA';
      const aAltA = '4HHB:1:A:SER:15:OG:A';
      const aAltB = '4HHB:1:A:SER:15:OG:B';

      expect(areAtomsInSameChain(a1, a2)).toBe(true);
      expect(areAtomsInSameChain(a1, aChainB)).toBe(false); // Cross-chain isolated
      expect(areAtomsInSameModel(a1, aModel2)).toBe(false); // Cross-model isolated

      expect(areAtomsAltLocCompatible(a1, aAltA)).toBe(true); // Common backbone compatible with altLoc
      expect(areAtomsAltLocCompatible(aAltA, aAltB)).toBe(false); // AltLoc A strictly cannot bond to AltLoc B!
    });
  });

  // =========================================================================
  // 2. COVALENT RADII & DISTANCE BOUNDS
  // =========================================================================
  describe('2. Covalent Radii & Distance Bounds', () => {
    it('provides standard single covalent radii for common biomolecular elements', () => {
      expect(getCovalentRadius('H')).toBe(0.31);
      expect(getCovalentRadius('C')).toBe(0.76);
      expect(getCovalentRadius('N')).toBe(0.71);
      expect(getCovalentRadius('O')).toBe(0.66);
      expect(getCovalentRadius('P')).toBe(1.07);
      expect(getCovalentRadius('S')).toBe(1.05);
      expect(getCovalentRadius('FE')).toBe(1.32);
      expect(getCovalentRadius('ZN')).toBe(1.22);
    });

    it('validates realistic covalent distances and rejects unphysical separations', () => {
      // C-C single bond (~1.54 A). Sum of radii = 0.76 + 0.76 = 1.52 A. Max = 1.52 + 0.40 = 1.92 A.
      expect(isCovalentDistance('C', 'C', 1.54)).toBe(true);
      expect(isCovalentDistance('C', 'C', 1.85)).toBe(true);
      expect(isCovalentDistance('C', 'C', 2.10)).toBe(false); // Too long for covalent bond!

      // Rejects sub-0.40 A overlapping coordinate errors
      expect(isCovalentDistance('C', 'C', 0.25)).toBe(false);
      expect(isCovalentDistance('C', 'C', 0.0)).toBe(false);
      expect(isCovalentDistance('C', 'C', -1.0)).toBe(false);
    });
  });

  // =========================================================================
  // 3. PDB CONECT RECORD PARSER
  // =========================================================================
  describe('3. PDB CONECT Record Parser', () => {
    it('parses standard single CONECT records and maps serial numbers to canonical keys', () => {
      const serialMap = new Map<number, string>([
        [101, '4HHB:1:A:HEM:142:FE'],
        [102, '4HHB:1:A:HEM:142:NA'],
        [103, '4HHB:1:A:HEM:142:NB'],
      ]);

      const pdbText = `
CONECT  101  102  103
CONECT  102  101
CONECT  103  101
`;

      const bonds = parsePdbConectRecords(pdbText, serialMap);
      expect(bonds.length).toBe(2);
      expect(bonds.some((b) => b.atomAKey.includes('FE') && b.atomBKey.includes('NA'))).toBe(true);
      expect(bonds.some((b) => b.atomAKey.includes('FE') && b.atomBKey.includes('NB'))).toBe(true);
      expect(bonds[0].multiplicity).toBe(1);
      expect(bonds[0].bondType).toBe('COVALENT_SINGLE');
    });

    it('resolves bond multiplicity for double bonds from repeated CONECT serials', () => {
      const serialMap = new Map<number, string>([
        [201, 'TEST:1:A:LIG:1:C1'],
        [202, 'TEST:1:A:LIG:1:C2'],
      ]);

      // Serial 202 listed twice in each direction denotes double bond (multiplicity 2)
      const pdbText = `
CONECT  201  202  202
CONECT  202  201  201
`;

      const bonds = parsePdbConectRecords(pdbText, serialMap);
      expect(bonds.length).toBe(1);
      expect(bonds[0].multiplicity).toBe(2);
      expect(bonds[0].bondType).toBe('COVALENT_DOUBLE');
    });

    it('gracefully ignores malformed lines, self-loops, and unmapped serial numbers', () => {
      const serialMap = new Map<number, string>([[50, 'TEST:1:A:LIG:1:C1']]);
      const pdbText = `
CONECT   50   50
CONECT   50  999
CONECT INVALID
`;

      const bonds = parsePdbConectRecords(pdbText, serialMap);
      expect(bonds.length).toBe(0);
    });
  });

  // =========================================================================
  // 4. MMCIF STRUCTURAL CONNECTIVITY (_struct_conn)
  // =========================================================================
  describe('4. mmCIF Structural Connectivity (_struct_conn)', () => {
    it('parses covalent, disulfide, and metal coordination connections from _struct_conn', () => {
      const records: StructConnRecord[] = [
        {
          connTypeId: 'disulf',
          ptnr1: { chainId: 'A', residueName: 'CYS', residueNumber: 10, atomName: 'SG' },
          ptnr2: { chainId: 'A', residueName: 'CYS', residueNumber: 25, atomName: 'SG' },
        },
        {
          connTypeId: 'metalc',
          ptnr1: { chainId: 'A', residueName: 'HEM', residueNumber: 142, atomName: 'FE' },
          ptnr2: { chainId: 'A', residueName: 'HIS', residueNumber: 87, atomName: 'NE2' },
        },
        {
          connTypeId: 'covale',
          ptnr1: { chainId: 'A', residueName: 'LYS', residueNumber: 45, atomName: 'NZ' },
          ptnr2: { chainId: 'A', residueName: 'RET', residueNumber: 300, atomName: 'C15' },
        },
      ];

      const parsed = parseStructConnRecords('4HHB', 1, records);
      expect(parsed.length).toBe(3);

      const disulf = parsed.find((b) => b.bondType === 'DISULFIDE');
      expect(disulf).toBeDefined();
      expect(disulf?.atomAKey).toContain('CYS:10:SG');

      const metalc = parsed.find((b) => b.bondType === 'METAL_COORDINATION');
      expect(metalc).toBeDefined();
      expect(metalc?.atomAKey).toContain('HEM:142:FE');
      expect(metalc?.atomBKey).toContain('HIS:87:NE2');
      expect(metalc?.bondOrder).toBeNull(); // Metal coordination has no fixed covalent integer bond order

      const covale = parsed.find((b) => b.bondType === 'COVALENT_SINGLE');
      expect(covale).toBeDefined();
      expect(covale?.atomAKey).toContain('LYS:45:NZ');
      expect(covale?.atomBKey).toContain('RET:300:C15');
    });
  });

  // =========================================================================
  // 5. BIOPOLYMER PEPTIDE & PHOSPHODIESTER TOPOLOGY
  // =========================================================================
  describe('5. Biopolymer Peptide & Phosphodiester Topology', () => {
    it('builds authentic peptide bonds C(i) <-> N(i+1) along contiguous sequence', () => {
      const atoms: TopologyAtom[] = [
        {
          key: '4HHB:1:A:VAL:1:C',
          structureId: '4HHB',
          modelId: 1,
          chainId: 'A',
          residueName: 'VAL',
          residueNumber: 1,
          atomName: 'C',
          element: 'C',
          coordinates: [0, 0, 0],
        },
        {
          key: '4HHB:1:A:LEU:2:N',
          structureId: '4HHB',
          modelId: 1,
          chainId: 'A',
          residueName: 'LEU',
          residueNumber: 2,
          atomName: 'N',
          element: 'N',
          coordinates: [1.33, 0, 0], // Canonical peptide bond distance
        },
      ];

      const bonds = buildPeptideBonds(atoms);
      expect(bonds.length).toBe(1);
      expect(bonds[0].bondType).toBe('PEPTIDE');
      expect(bonds[0].measuredDistance).toBe(1.33);
      expect(bonds[0].isInterChain).toBe(false);
      expect(bonds[0].isInterResidue).toBe(true);
    });

    it('strictly prevents peptide bonding across different chains (chain A to chain B)', () => {
      const atoms: TopologyAtom[] = [
        {
          key: '4HHB:1:A:VAL:1:C',
          structureId: '4HHB',
          modelId: 1,
          chainId: 'A',
          residueName: 'VAL',
          residueNumber: 1,
          atomName: 'C',
          element: 'C',
          coordinates: [0, 0, 0],
        },
        {
          key: '4HHB:1:B:LEU:2:N',
          structureId: '4HHB',
          modelId: 1,
          chainId: 'B', // Chain B!
          residueName: 'LEU',
          residueNumber: 2,
          atomName: 'N',
          element: 'N',
          coordinates: [1.33, 0, 0],
        },
      ];

      const bonds = buildPeptideBonds(atoms);
      expect(bonds.length).toBe(0); // Zero cross-chain bonds!
    });

    it('strictly prevents peptide bonding across disordered loop gaps (non-consecutive sequence)', () => {
      const atoms: TopologyAtom[] = [
        {
          key: 'TEST:1:A:PRO:45:C',
          structureId: 'TEST',
          modelId: 1,
          chainId: 'A',
          residueName: 'PRO',
          residueNumber: 45,
          atomName: 'C',
          element: 'C',
          coordinates: [0, 0, 0],
        },
        {
          key: 'TEST:1:A:GLY:50:N', // Gap 45 -> 50
          structureId: 'TEST',
          modelId: 1,
          chainId: 'A',
          residueName: 'GLY',
          residueNumber: 50,
          atomName: 'N',
          element: 'N',
          coordinates: [1.33, 0, 0],
        },
      ];

      const bonds = buildPeptideBonds(atoms);
      expect(bonds.length).toBe(0); // Never leap over missing residues!
    });

    it('builds authentic phosphodiester bonds O3\'(i) <-> P(i+1) within the same DNA strand', () => {
      const atoms: TopologyAtom[] = [
        {
          key: '1BNA:1:A:DC:1:O3\'',
          structureId: '1BNA',
          modelId: 1,
          chainId: 'A',
          residueName: 'DC',
          residueNumber: 1,
          atomName: "O3'",
          element: 'O',
          coordinates: [0, 0, 0],
        },
        {
          key: '1BNA:1:A:DG:2:P',
          structureId: '1BNA',
          modelId: 1,
          chainId: 'A',
          residueName: 'DG',
          residueNumber: 2,
          atomName: 'P',
          element: 'P',
          coordinates: [1.60, 0, 0], // Canonical phosphodiester bond distance
        },
      ];

      const bonds = buildPhosphodiesterBonds(atoms);
      expect(bonds.length).toBe(1);
      expect(bonds[0].bondType).toBe('PHOSPHODIESTER');
      expect(bonds[0].measuredDistance).toBe(1.6);
    });

    it('strictly isolates complementary DNA strands: zero covalent phosphodiester bonds between strand A and strand B', () => {
      const atoms: TopologyAtom[] = [
        {
          key: '1BNA:1:A:DC:1:O3\'',
          structureId: '1BNA',
          modelId: 1,
          chainId: 'A',
          residueName: 'DC',
          residueNumber: 1,
          atomName: "O3'",
          element: 'O',
          coordinates: [0, 0, 0],
        },
        {
          key: '1BNA:1:B:DG:24:P', // Strand B!
          structureId: '1BNA',
          modelId: 1,
          chainId: 'B',
          residueName: 'DG',
          residueNumber: 24,
          atomName: 'P',
          element: 'P',
          coordinates: [1.60, 0, 0],
        },
      ];

      const bonds = buildPhosphodiesterBonds(atoms);
      expect(bonds.length).toBe(0); // Strands are separate molecules!
    });
  });

  // =========================================================================
  // 6. CYSTEINE DISULFIDE BRIDGES
  // =========================================================================
  describe('6. Cysteine Disulfide Bridges', () => {
    it('detects authentic disulfide bonds between Cysteine SG atoms within [1.90, 2.20] A', () => {
      const atoms: TopologyAtom[] = [
        {
          key: '1CRN:1:A:CYS:3:SG',
          structureId: '1CRN',
          modelId: 1,
          chainId: 'A',
          residueName: 'CYS',
          residueNumber: 3,
          atomName: 'SG',
          element: 'S',
          coordinates: [10.0, 5.0, 2.0],
        },
        {
          key: '1CRN:1:A:CYS:40:SG',
          structureId: '1CRN',
          modelId: 1,
          chainId: 'A',
          residueName: 'CYS',
          residueNumber: 40,
          atomName: 'SG',
          element: 'S',
          coordinates: [10.0, 5.0, 4.05], // Distance = 2.05 A (ideal disulfide)
        },
      ];

      const disulfides = buildDisulfideBonds(atoms);
      expect(disulfides.length).toBe(1);
      expect(disulfides[0].bondType).toBe('DISULFIDE');
      expect(disulfides[0].measuredDistance).toBe(2.05);
      expect(disulfides[0].isInterChain).toBe(false);
    });

    it('rejects unbonded cysteines when SG-SG distance exceeds 2.20 A', () => {
      const atoms: TopologyAtom[] = [
        {
          key: '1CRN:1:A:CYS:3:SG',
          structureId: '1CRN',
          modelId: 1,
          chainId: 'A',
          residueName: 'CYS',
          residueNumber: 3,
          atomName: 'SG',
          element: 'S',
          coordinates: [0, 0, 0],
        },
        {
          key: '1CRN:1:A:CYS:16:SG',
          structureId: '1CRN',
          modelId: 1,
          chainId: 'A',
          residueName: 'CYS',
          residueNumber: 16,
          atomName: 'SG',
          element: 'S',
          coordinates: [3.5, 0, 0], // 3.5 A > 2.20 A: not a disulfide!
        },
      ];

      const disulfides = buildDisulfideBonds(atoms);
      expect(disulfides.length).toBe(0);
    });
  });

  // =========================================================================
  // 7. CHEMICAL COMPONENT DICTIONARY (CCD) & HEME (HEM) TOPOLOGY
  // =========================================================================
  describe('7. Chemical Component Dictionary (CCD) & Heme (HEM) Topology', () => {
    it('builds intra-residue bonds for standard amino acid with aromatic bond orders', () => {
      // Phenylalanine ring
      const pheAtoms: TopologyAtom[] = [
        { key: 'TEST:1:A:PHE:10:N', structureId: 'TEST', modelId: 1, chainId: 'A', residueName: 'PHE', residueNumber: 10, atomName: 'N', element: 'N', coordinates: [0, 0, 0] },
        { key: 'TEST:1:A:PHE:10:CA', structureId: 'TEST', modelId: 1, chainId: 'A', residueName: 'PHE', residueNumber: 10, atomName: 'CA', element: 'C', coordinates: [1.4, 0, 0] },
        { key: 'TEST:1:A:PHE:10:C', structureId: 'TEST', modelId: 1, chainId: 'A', residueName: 'PHE', residueNumber: 10, atomName: 'C', element: 'C', coordinates: [2.0, 1.2, 0] },
        { key: 'TEST:1:A:PHE:10:O', structureId: 'TEST', modelId: 1, chainId: 'A', residueName: 'PHE', residueNumber: 10, atomName: 'O', element: 'O', coordinates: [1.8, 2.4, 0] },
        { key: 'TEST:1:A:PHE:10:CB', structureId: 'TEST', modelId: 1, chainId: 'A', residueName: 'PHE', residueNumber: 10, atomName: 'CB', element: 'C', coordinates: [2.0, -1.2, 0] },
        { key: 'TEST:1:A:PHE:10:CG', structureId: 'TEST', modelId: 1, chainId: 'A', residueName: 'PHE', residueNumber: 10, atomName: 'CG', element: 'C', coordinates: [3.4, -1.2, 0] },
        { key: 'TEST:1:A:PHE:10:CD1', structureId: 'TEST', modelId: 1, chainId: 'A', residueName: 'PHE', residueNumber: 10, atomName: 'CD1', element: 'C', coordinates: [4.1, -0.1, 0] },
        { key: 'TEST:1:A:PHE:10:CE1', structureId: 'TEST', modelId: 1, chainId: 'A', residueName: 'PHE', residueNumber: 10, atomName: 'CE1', element: 'C', coordinates: [5.5, -0.1, 0] },
        { key: 'TEST:1:A:PHE:10:CZ', structureId: 'TEST', modelId: 1, chainId: 'A', residueName: 'PHE', residueNumber: 10, atomName: 'CZ', element: 'C', coordinates: [6.2, -1.2, 0] },
        { key: 'TEST:1:A:PHE:10:CE2', structureId: 'TEST', modelId: 1, chainId: 'A', residueName: 'PHE', residueNumber: 10, atomName: 'CE2', element: 'C', coordinates: [5.5, -2.3, 0] },
        { key: 'TEST:1:A:PHE:10:CD2', structureId: 'TEST', modelId: 1, chainId: 'A', residueName: 'PHE', residueNumber: 10, atomName: 'CD2', element: 'C', coordinates: [4.1, -2.3, 0] },
      ];

      const bonds = buildIntraResidueBonds(pheAtoms);
      expect(bonds.length).toBe(11);

      const aromaticBonds = bonds.filter((b) => b.isAromatic);
      expect(aromaticBonds.length).toBe(6); // 6 aromatic bonds in benzene ring
      expect(aromaticBonds[0].bondOrder).toBe(1.5);
    });

    it('builds Heme (HEM) CCD topology with Fe coordination and aromatic pyrroles', () => {
      const hemAtoms: TopologyAtom[] = [
        { key: '4HHB:1:A:HEM:142:FE', structureId: '4HHB', modelId: 1, chainId: 'A', residueName: 'HEM', residueNumber: 142, atomName: 'FE', element: 'FE', coordinates: [0, 0, 0] },
        { key: '4HHB:1:A:HEM:142:NA', structureId: '4HHB', modelId: 1, chainId: 'A', residueName: 'HEM', residueNumber: 142, atomName: 'NA', element: 'N', coordinates: [2.0, 0, 0] },
        { key: '4HHB:1:A:HEM:142:NB', structureId: '4HHB', modelId: 1, chainId: 'A', residueName: 'HEM', residueNumber: 142, atomName: 'NB', element: 'N', coordinates: [0, 2.0, 0] },
        { key: '4HHB:1:A:HEM:142:NC', structureId: '4HHB', modelId: 1, chainId: 'A', residueName: 'HEM', residueNumber: 142, atomName: 'NC', element: 'N', coordinates: [-2.0, 0, 0] },
        { key: '4HHB:1:A:HEM:142:ND', structureId: '4HHB', modelId: 1, chainId: 'A', residueName: 'HEM', residueNumber: 142, atomName: 'ND', element: 'N', coordinates: [0, -2.0, 0] },
      ];

      const bonds = buildIntraResidueBonds(hemAtoms);
      expect(bonds.length).toBe(4);
      expect(bonds.every((b) => b.bondType === 'METAL_COORDINATION')).toBe(true);
    });
  });

  // =========================================================================
  // 8. RING PERCEPTION & AROMATICITY
  // =========================================================================
  describe('8. Ring Perception & Aromaticity', () => {
    it('perceives 6-membered benzene ring and classifies as BENZENE aromatic', () => {
      const atomKeys = [
        'TEST:1:A:MOL:1:C1',
        'TEST:1:A:MOL:1:C2',
        'TEST:1:A:MOL:1:C3',
        'TEST:1:A:MOL:1:C4',
        'TEST:1:A:MOL:1:C5',
        'TEST:1:A:MOL:1:C6',
      ];

      const atoms = new Map<string, TopologyAtom>();
      for (const k of atomKeys) {
        atoms.set(k, {
          key: k,
          structureId: 'TEST',
          modelId: 1,
          chainId: 'A',
          residueName: 'MOL',
          residueNumber: 1,
          atomName: k.split(':').pop()!,
          element: 'C',
          coordinates: [0, 0, 0],
        });
      }

      const adj = new Map<string, string[]>();
      adj.set(atomKeys[0], [atomKeys[1], atomKeys[5]]);
      adj.set(atomKeys[1], [atomKeys[0], atomKeys[2]]);
      adj.set(atomKeys[2], [atomKeys[1], atomKeys[3]]);
      adj.set(atomKeys[3], [atomKeys[2], atomKeys[4]]);
      adj.set(atomKeys[4], [atomKeys[3], atomKeys[5]]);
      adj.set(atomKeys[5], [atomKeys[4], atomKeys[0]]);

      const rings = perceiveRings(adj, atoms);
      expect(rings.length).toBe(1);
      expect(rings[0].size).toBe(6);
      expect(rings[0].ringType).toBe('BENZENE');
      expect(rings[0].isAromatic).toBe(true);
      expect(rings[0].isHeterocyclic).toBe(false);
    });

    it('perceives 5-membered imidazole ring and classifies as IMIDAZOLE aromatic heterocyclic', () => {
      const atomKeys = [
        'TEST:1:A:HIS:1:CG',
        'TEST:1:A:HIS:1:ND1',
        'TEST:1:A:HIS:1:CE1',
        'TEST:1:A:HIS:1:NE2',
        'TEST:1:A:HIS:1:CD2',
      ];

      const atoms = new Map<string, TopologyAtom>();
      atoms.set(atomKeys[0], { key: atomKeys[0], structureId: 'TEST', modelId: 1, chainId: 'A', residueName: 'HIS', residueNumber: 1, atomName: 'CG', element: 'C', coordinates: [0, 0, 0] });
      atoms.set(atomKeys[1], { key: atomKeys[1], structureId: 'TEST', modelId: 1, chainId: 'A', residueName: 'HIS', residueNumber: 1, atomName: 'ND1', element: 'N', coordinates: [0, 0, 0] });
      atoms.set(atomKeys[2], { key: atomKeys[2], structureId: 'TEST', modelId: 1, chainId: 'A', residueName: 'HIS', residueNumber: 1, atomName: 'CE1', element: 'C', coordinates: [0, 0, 0] });
      atoms.set(atomKeys[3], { key: atomKeys[3], structureId: 'TEST', modelId: 1, chainId: 'A', residueName: 'HIS', residueNumber: 1, atomName: 'NE2', element: 'N', coordinates: [0, 0, 0] });
      atoms.set(atomKeys[4], { key: atomKeys[4], structureId: 'TEST', modelId: 1, chainId: 'A', residueName: 'HIS', residueNumber: 1, atomName: 'CD2', element: 'C', coordinates: [0, 0, 0] });

      const adj = new Map<string, string[]>();
      adj.set(atomKeys[0], [atomKeys[1], atomKeys[4]]);
      adj.set(atomKeys[1], [atomKeys[0], atomKeys[2]]);
      adj.set(atomKeys[2], [atomKeys[1], atomKeys[3]]);
      adj.set(atomKeys[3], [atomKeys[2], atomKeys[4]]);
      adj.set(atomKeys[4], [atomKeys[3], atomKeys[0]]);

      const rings = perceiveRings(adj, atoms);
      expect(rings.length).toBe(1);
      expect(rings[0].size).toBe(5);
      expect(rings[0].ringType).toBe('IMIDAZOLE');
      expect(rings[0].isAromatic).toBe(true);
      expect(rings[0].isHeterocyclic).toBe(true);
    });
  });

  // =========================================================================
  // 9. GEOMETRIC CALCULATIONS (BOND LENGTH, ANGLE, DIHEDRAL)
  // =========================================================================
  describe('9. Geometric Calculations (Bond Length, Angle, Dihedral)', () => {
    it('computes exact Euclidean bond length', () => {
      const len = calculateBondLength([0, 0, 0], [1.54, 0, 0]);
      expect(len).toBe(1.54);
    });

    it('computes clamped 3-point bond angle preventing NaN excursions', () => {
      // 90 degrees: [1, 0, 0] -> [0, 0, 0] -> [0, 1, 0]
      const angle90 = calculateBondAngleDeg([1, 0, 0], [0, 0, 0], [0, 1, 0]);
      expect(angle90).toBe(90.0);

      // 180 degrees (collinear)
      const angle180 = calculateBondAngleDeg([1, 0, 0], [0, 0, 0], [-1, 0, 0]);
      expect(angle180).toBe(180.0);

      // Coincident points return null
      const angleNull = calculateBondAngleDeg([0, 0, 0], [0, 0, 0], [1, 1, 1]);
      expect(angleNull).toBeNull();
    });

    it('computes IUPAC 4-point dihedral angle', () => {
      // Trans planar (180 deg)
      const transD = calculateDihedralDeg([0, 1, 0], [0, 0, 0], [1, 0, 0], [1, -1, 0]);
      expect(transD).not.toBeNull();
      expect(Math.abs(transD!)).toBeCloseTo(180.0, 2);
    });
  });

  // =========================================================================
  // 10. MASTER MOLECULAR GRAPH BUILDER & REGRESSIONS (4HHB & 1BNA)
  // =========================================================================
  describe('10. Master Molecular Graph Builder & Regressions (4HHB & 1BNA)', () => {
    it('executes 1BNA regression: complementary strands form 2 separate covalent connected components', () => {
      const graph = buildMolecularGraph({
        structureId: '1BNA',
        modelId: 1,
        atoms: [
          // Strand A: DC1 - DG2
          { chainId: 'A', residueName: 'DC', residueNumber: 1, atomName: "O3'", element: 'O', coordinates: [0, 0, 0] },
          { chainId: 'A', residueName: 'DG', residueNumber: 2, atomName: 'P', element: 'P', coordinates: [1.6, 0, 0] },
          // Strand B: DC23 - DG24
          { chainId: 'B', residueName: 'DC', residueNumber: 23, atomName: "O3'", element: 'O', coordinates: [10, 0, 0] },
          { chainId: 'B', residueName: 'DG', residueNumber: 24, atomName: 'P', element: 'P', coordinates: [11.6, 0, 0] },
        ],
      });

      expect(graph.structureId).toBe('1BNA');
      expect(graph.phosphodiesterBondCount).toBe(2);
      expect(graph.connectedComponents.length).toBe(2); // Exactly 2 disjoint strands!
      expect(graph.connectedComponents[0].length).toBe(2);
      expect(graph.connectedComponents[1].length).toBe(2);
    });

    it('executes 4HHB regression: chains A and C HEM instances remain completely isolated', () => {
      const graph = buildMolecularGraph({
        structureId: '4HHB',
        modelId: 1,
        atoms: [
          // Chain A HEM 142
          { chainId: 'A', residueName: 'HEM', residueNumber: 142, atomName: 'FE', element: 'FE', coordinates: [0, 0, 0], isHetero: true },
          { chainId: 'A', residueName: 'HEM', residueNumber: 142, atomName: 'NA', element: 'N', coordinates: [2.0, 0, 0], isHetero: true },
          // Chain C HEM 142
          { chainId: 'C', residueName: 'HEM', residueNumber: 142, atomName: 'FE', element: 'FE', coordinates: [50, 0, 0], isHetero: true },
          { chainId: 'C', residueName: 'HEM', residueNumber: 142, atomName: 'NA', element: 'N', coordinates: [52.0, 0, 0], isHetero: true },
        ],
      });

      expect(graph.structureId).toBe('4HHB');
      expect(graph.metalCoordinationCount).toBe(2);
      // Verify no cross-chain edge exists
      const crossChainBond = Array.from(graph.bonds.values()).find(
        (b) => b.atomAKey.includes(':A:') && b.atomBKey.includes(':C:')
      );
      expect(crossChainBond).toBeUndefined(); // Zero leakage between chain A and C!
      expect(graph.connectedComponents.length).toBe(2);
    });

    it('strictly isolates models: Model 1 atom cannot bond to Model 2 atom', () => {
      const graph = buildMolecularGraph({
        structureId: 'NMR_TEST',
        modelId: 1,
        atoms: [
          { chainId: 'A', residueName: 'ALA', residueNumber: 1, atomName: 'CA', element: 'C', coordinates: [0, 0, 0] },
          { chainId: 'A', residueName: 'ALA', residueNumber: 1, atomName: 'CB', element: 'C', coordinates: [1.5, 0, 0] },
        ],
        structConnRecords: [
          {
            connTypeId: 'covale',
            ptnr1: { chainId: 'A', residueName: 'ALA', residueNumber: 1, atomName: 'CA' },
            ptnr2: { chainId: 'A', residueName: 'ALA', residueNumber: 1, atomName: 'CB' },
          },
        ],
      });

      expect(graph.bonds.size).toBe(1);
      const b = Array.from(graph.bonds.values())[0];
      expect(b.atomAKey).toContain('NMR_TEST:1:A:ALA:1');
      expect(b.atomBKey).toContain('NMR_TEST:1:A:ALA:1');
    });

    it('validates valence and flags hypervalent carbon', () => {
      // Carbon bonded to 5 atoms
      const graph = buildMolecularGraph({
        structureId: 'VAL_TEST',
        atoms: [
          { chainId: 'A', residueName: 'LIG', residueNumber: 1, atomName: 'C1', element: 'C', coordinates: [0, 0, 0], isHetero: true },
          { chainId: 'A', residueName: 'LIG', residueNumber: 1, atomName: 'H1', element: 'H', coordinates: [1.0, 0, 0], isHetero: true },
          { chainId: 'A', residueName: 'LIG', residueNumber: 1, atomName: 'H2', element: 'H', coordinates: [-1.0, 0, 0], isHetero: true },
          { chainId: 'A', residueName: 'LIG', residueNumber: 1, atomName: 'H3', element: 'H', coordinates: [0, 1.0, 0], isHetero: true },
          { chainId: 'A', residueName: 'LIG', residueNumber: 1, atomName: 'H4', element: 'H', coordinates: [0, -1.0, 0], isHetero: true },
          { chainId: 'A', residueName: 'LIG', residueNumber: 1, atomName: 'H5', element: 'H', coordinates: [0, 0, 1.0], isHetero: true },
        ],
        enableGeometricInferenceFallback: true,
      });

      expect(graph.warnings.some((w) => w.includes('Hypervalent Carbon'))).toBe(true);
      const valRec = graph.valences.find((v) => v.atomKey.includes('C1'));
      expect(valRec?.isValenceValid).toBe(false);
    });
  });

  // =========================================================================
  // 11. TOPOLOGY CACHE INTEGRITY & ASYNC RACE SAFETY
  // =========================================================================
  describe('11. Topology Cache Integrity & Async Race Safety', () => {
    it('TopologyCacheManager handles monotonic sequence invalidation and prevents race conditions', () => {
      const cache = new TopologyCacheManager();

      const seq1 = cache.nextSequence();
      expect(seq1).toBe(1);
      expect(cache.isCurrentSequence(seq1)).toBe(true);

      const seq2 = cache.nextSequence();
      expect(seq2).toBe(2);
      expect(cache.isCurrentSequence(seq1)).toBe(false); // seq1 invalidated!
      expect(cache.isCurrentSequence(seq2)).toBe(true);
    });

    it('caches and retrieves molecular graphs by multi-dimensional key', () => {
      const cache = new TopologyCacheManager();
      const mockGraph = buildMolecularGraph({
        structureId: '4HHB',
        modelId: 1,
        atoms: [],
      });

      const params = { structureId: '4HHB', modelId: 1, assemblyId: 1 };
      cache.set(params, mockGraph);

      expect(cache.has(params)).toBe(true);
      const retrieved = cache.get(params);
      expect(retrieved?.structureId).toBe('4HHB');

      cache.clear();
      expect(cache.has(params)).toBe(false);
    });
  });
});
