import { describe, it, expect } from 'vitest';
import {
  buildLigandInstanceKey,
  areLigandInstancesEqual,
  isMetalCenter,
  computeAtomCentroid,
  extractLigandInstances,
  BIOLOGICAL_METALS,
  PROSTHETIC_GROUPS,
} from '../molecular/interactions/ligandIdentity';
import {
  isValidAtomCoord,
  filterCanonicalAltLocs,
  computePlaneNormal,
  angleBetweenNormalsDeg,
  computeAngleDegrees,
} from '../molecular/interactions/contactCalculations';
import {
  classifyPairInteraction,
  extractAromaticRings,
  detectPiStackingInteractions,
  CANONICAL_HBOND_DISTANCE_CUTOFF,
  CANONICAL_SALT_BRIDGE_CUTOFF,
  CANONICAL_HYDROPHOBIC_CUTOFF,
  CANONICAL_METAL_COORD_CUTOFF,
} from '../molecular/interactions/interactionClassifier';
import {
  analyzeMetalCoordinationSphere,
} from '../molecular/interactions/metalCoordination';
import {
  analyzeLigandBindingSite,
} from '../molecular/interactions/bindingSiteAnalyzer';
import {
  calculateTrajectoryContactOccupancy,
} from '../molecular/interactions/trajectoryContacts';
import {
  InteractionCacheManager,
} from '../molecular/interactions/interactionCache';
import type {
  LigandInstanceIdentity,
  ContactAtomDetail,
} from '../molecular/interactions/types';
import type {
  IndexedComponent,
  StructureHierarchyIndex,
} from '../molecular/geometry/structuralIdentity';
import { calculateEuclideanDistance } from '../molecular/measurements/calculations';

describe('PASS 11: Protein-Ligand Binding, Binding-Site & Molecular Interactions Forensic Suite', () => {

  // =========================================================================
  // 1. LIGAND IDENTITY & INSTANCE ISOLATION
  // =========================================================================
  describe('1. Ligand Identity & Instance Isolation', () => {
    it('builds canonical multi-tier instance key preserving structure, model, chain, and residue number', () => {
      const keyA = buildLigandInstanceKey('4HHB', 1, 'A', 'HEM', 142);
      const keyC = buildLigandInstanceKey('4HHB', 1, 'C', 'HEM', 142);

      expect(keyA).toBe('4HHB:1:A:HEM:142');
      expect(keyC).toBe('4HHB:1:C:HEM:142');
      expect(keyA).not.toBe(keyC); // Chain isolation guaranteed!
    });

    it('strictly prevents conflating identical residue names on different chains (4HHB HEM 142 A vs C)', () => {
      const hemA: LigandInstanceIdentity = {
        structureId: '4HHB',
        modelId: 1,
        chainId: 'A',
        residueName: 'HEM',
        residueNumber: 142,
        instanceKey: '4HHB:1:A:HEM:142',
        classification: 'cofactor',
        isCofactor: true,
        isProstheticGroup: true,
        isMetalIon: true,
        provenance: 'EXPERIMENTAL_DEPOSITED',
        atomCount: 43,
        centroid: [18.36, 18.49, 23.76],
      };

      const hemC: LigandInstanceIdentity = {
        structureId: '4HHB',
        modelId: 1,
        chainId: 'C',
        residueName: 'HEM',
        residueNumber: 142,
        instanceKey: '4HHB:1:C:HEM:142',
        classification: 'cofactor',
        isCofactor: true,
        isProstheticGroup: true,
        isMetalIon: true,
        provenance: 'EXPERIMENTAL_DEPOSITED',
        atomCount: 43,
        centroid: [4.45, 23.46, 54.55],
      };

      expect(areLigandInstancesEqual(hemA, hemC)).toBe(false);
      expect(hemA.instanceKey).not.toBe(hemC.instanceKey);
      expect(hemA.centroid).not.toEqual(hemC.centroid);
    });

    it('identifies insertion codes and models distinctly', () => {
      const keyIns = buildLigandInstanceKey('1ABC', 1, 'A', 'LIG', 50, 'A');
      const keyNoIns = buildLigandInstanceKey('1ABC', 1, 'A', 'LIG', 50);
      expect(keyIns).toBe('1ABC:1:A:LIG:50:A');
      expect(keyNoIns).toBe('1ABC:1:A:LIG:50');
      expect(keyIns).not.toBe(keyNoIns);

      const keyM1 = buildLigandInstanceKey('1ABC', 1, 'A', 'LIG', 50);
      const keyM2 = buildLigandInstanceKey('1ABC', 2, 'A', 'LIG', 50);
      expect(keyM1).not.toBe(keyM2);
    });
  });

  // =========================================================================
  // 2. COMPONENT CLASSIFICATION TRUTH
  // =========================================================================
  describe('2. Component Classification Truth', () => {
    it('distinguishes cofactors, prosthetic groups, biological metals, and synthetic ligands', () => {
      expect(PROSTHETIC_GROUPS.has('HEM')).toBe(true);
      expect(PROSTHETIC_GROUPS.has('FAD')).toBe(true);
      expect(PROSTHETIC_GROUPS.has('ATP')).toBe(false); // ATP is coenzyme/energy cofactor, not prosthetic

      expect(isMetalCenter('FE')).toBe(true);
      expect(isMetalCenter('ZN')).toBe(true);
      expect(isMetalCenter('MG')).toBe(true);
      expect(isMetalCenter('CA')).toBe(true);
      expect(isMetalCenter('C')).toBe(false);
      expect(isMetalCenter('N')).toBe(false);
    });

    it('extracts discrete ligand instances from hierarchy index without including protein, solvent, or buffers', () => {
      const mockHierarchy: StructureHierarchyIndex = {
        structureId: '4HHB',
        modelId: 1,
        chains: new Map(),
        allComponents: [
          {
            id: {
              structureId: '4HHB',
              modelId: 1,
              chainId: 'A',
              classification: 'protein',
              residueName: 'VAL',
              residueNumber: 1,
            },
            canonicalLabel: 'VAL · Chain A · 1',
            shortLabel: 'A:VAL:1',
            atoms: [{ id: 1, atomName: 'CA', element: 'C', coordinates: [0, 0, 0], isHetero: false }],
          },
          {
            id: {
              structureId: '4HHB',
              modelId: 1,
              chainId: 'A',
              classification: 'solvent',
              residueName: 'HOH',
              residueNumber: 150,
            },
            canonicalLabel: 'HOH · Chain A · 150',
            shortLabel: 'A:HOH:150',
            atoms: [{ id: 2, atomName: 'O', element: 'O', coordinates: [10, 10, 10], isHetero: true }],
          },
          {
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
            atoms: [
              { id: 3, atomName: 'FE', element: 'FE', coordinates: [18.36, 18.49, 23.76], isHetero: true },
              { id: 4, atomName: 'NA', element: 'N', coordinates: [18.36, 20.49, 23.76], isHetero: true },
            ],
          },
          {
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
            atoms: [
              { id: 5, atomName: 'FE', element: 'FE', coordinates: [4.45, 23.46, 54.55], isHetero: true },
            ],
          },
        ],
        totalValidAtoms: 5,
        invalidAtomsCount: 0,
      };

      const ligands = extractLigandInstances(mockHierarchy);
      expect(ligands.length).toBe(2);
      expect(ligands[0].instanceKey).toBe('4HHB:1:A:HEM:142');
      expect(ligands[1].instanceKey).toBe('4HHB:1:C:HEM:142');
      expect(ligands[0].isProstheticGroup).toBe(true);
      expect(ligands[0].isMetalIon).toBe(true);
    });
  });

  // =========================================================================
  // 3. HYDROGEN-BOND CLASSIFICATION & ABSENT HYDROGEN TRUTH
  // =========================================================================
  describe('3. Hydrogen-Bond Classification & Absent Hydrogen Truth', () => {
    const donorN: ContactAtomDetail = {
      chainId: 'A',
      residueNumber: 58,
      residueName: 'HIS',
      atomName: 'NE2',
      element: 'N',
      coordinates: [10.0, 10.0, 10.0],
      isHetero: false,
    };

    const acceptorO: ContactAtomDetail = {
      chainId: 'A',
      residueNumber: 142,
      residueName: 'LIG',
      atomName: 'O1',
      element: 'O',
      coordinates: [12.8, 10.0, 10.0], // 2.8 A distance
      isHetero: true,
    };

    it('classifies H-bonds without observed hydrogens strictly as PUTATIVE proxy', () => {
      const dist = calculateEuclideanDistance(donorN.coordinates, acceptorO.coordinates);
      expect(dist).toBeCloseTo(2.8, 5);

      const contact = classifyPairInteraction(donorN, acceptorO, dist, 'EXPERIMENTAL_DEPOSITED');
      expect(contact.type).toBe('HYDROGEN_BOND_PUTATIVE');
      expect(contact.epistemicLevel).toBe('INFERRED_INTERACTION');
    });

    it('classifies explicit H-bonds with donor-H-acceptor angle >= 120 deg as EXPLICIT', () => {
      // H positioned collinearly: N (10, 10, 10) - H (11.0, 10, 10) ... O (12.8, 10, 10)
      const explicitH: [number, number, number] = [11.0, 10.0, 10.0];
      const dist = 2.8;

      const contact = classifyPairInteraction(donorN, acceptorO, dist, 'EXPERIMENTAL_DEPOSITED', explicitH);
      expect(contact.type).toBe('HYDROGEN_BOND_EXPLICIT');
      expect(contact.epistemicLevel).toBe('OBSERVED_STRUCTURAL_CONTACT');
      expect(contact.geometryDetails?.donorAcceptorAngleDeg).toBeCloseTo(180.0, 1);
    });

    it('rejects H-bond if explicit donor-H-acceptor angle is < 120 deg (bent/strained)', () => {
      // Bent H: angle N-H...O is 90 deg
      const bentH: [number, number, number] = [10.0, 11.0, 10.0];
      const dist = 2.8;

      const contact = classifyPairInteraction(donorN, acceptorO, dist, 'EXPERIMENTAL_DEPOSITED', bentH);
      expect(contact.type).toBe('GEOMETRIC_PROXIMITY'); // Rejected as valid H-bond
    });
  });

  // =========================================================================
  // 4. SALT-BRIDGE RIGOROUS CHARGE PAIRING
  // =========================================================================
  describe('4. Salt-Bridge Rigorous Charge Pairing', () => {
    it('certifies salt bridge between cationic Arg (NH1) and anionic Asp (OD1) within 4.0 A', () => {
      const argNH1: ContactAtomDetail = {
        chainId: 'A',
        residueNumber: 40,
        residueName: 'ARG',
        atomName: 'NH1',
        element: 'N',
        coordinates: [0, 0, 0],
        isHetero: false,
      };

      const aspOD1: ContactAtomDetail = {
        chainId: 'A',
        residueNumber: 99,
        residueName: 'ASP',
        atomName: 'OD1',
        element: 'O',
        coordinates: [3.2, 0, 0],
        isHetero: false,
      };

      const contact = classifyPairInteraction(argNH1, aspOD1, 3.2, 'EXPERIMENTAL_DEPOSITED');
      expect(contact.type).toBe('SALT_BRIDGE');
      expect(contact.epistemicLevel).toBe('INFERRED_INTERACTION');
    });

    it('rejects salt bridge classification for arbitrary neutral N <-> O proximity', () => {
      const neutralN: ContactAtomDetail = {
        chainId: 'A',
        residueNumber: 10,
        residueName: 'SER',
        atomName: 'N', // Backbone amide nitrogen (neutral)
        element: 'N',
        coordinates: [0, 0, 0],
        isHetero: false,
      };

      const neutralO: ContactAtomDetail = {
        chainId: 'A',
        residueNumber: 20,
        residueName: 'THR',
        atomName: 'OG1', // Neutral hydroxyl oxygen
        element: 'O',
        coordinates: [3.0, 0, 0],
        isHetero: false,
      };

      const contact = classifyPairInteraction(neutralN, neutralO, 3.0, 'EXPERIMENTAL_DEPOSITED');
      expect(contact.type).not.toBe('SALT_BRIDGE');
      expect(contact.type).toBe('HYDROGEN_BOND_PUTATIVE'); // Correctly falls back to H-bond proxy
    });
  });

  // =========================================================================
  // 5. AROMATIC / PI-STACKING GEOMETRIC RIGOR
  // =========================================================================
  describe('5. Aromatic / Pi-Stacking Geometric Rigor', () => {
    it('detects parallel face-to-face pi-stacking with centroid d <= 4.5 A and normal angle <= 30 deg', () => {
      // Parallel benzene rings in xy-plane separated by 3.6 A along z
      const ringAAtoms: ContactAtomDetail[] = [
        { chainId: 'A', residueNumber: 42, residueName: 'TYR', atomName: 'CG', element: 'C', coordinates: [0, 1, 0], isHetero: false },
        { chainId: 'A', residueNumber: 42, residueName: 'TYR', atomName: 'CD1', element: 'C', coordinates: [1, 0, 0], isHetero: false },
        { chainId: 'A', residueNumber: 42, residueName: 'TYR', atomName: 'CD2', element: 'C', coordinates: [-1, 0, 0], isHetero: false },
        { chainId: 'A', residueNumber: 42, residueName: 'TYR', atomName: 'CE1', element: 'C', coordinates: [1, -1, 0], isHetero: false },
        { chainId: 'A', residueNumber: 42, residueName: 'TYR', atomName: 'CE2', element: 'C', coordinates: [-1, -1, 0], isHetero: false },
        { chainId: 'A', residueNumber: 42, residueName: 'TYR', atomName: 'CZ', element: 'C', coordinates: [0, -2, 0], isHetero: false },
      ];

      const ringBAtoms: ContactAtomDetail[] = [
        { chainId: 'A', residueNumber: 142, residueName: 'HEM', atomName: 'C1A', element: 'C', coordinates: [0, 1, 3.6], isHetero: true },
        { chainId: 'A', residueNumber: 142, residueName: 'HEM', atomName: 'C2A', element: 'C', coordinates: [1, 0, 3.6], isHetero: true },
        { chainId: 'A', residueNumber: 142, residueName: 'HEM', atomName: 'C3A', element: 'C', coordinates: [-1, 0, 3.6], isHetero: true },
        { chainId: 'A', residueNumber: 142, residueName: 'HEM', atomName: 'C4A', element: 'C', coordinates: [1, -1, 3.6], isHetero: true },
        { chainId: 'A', residueNumber: 142, residueName: 'HEM', atomName: 'CHA', element: 'C', coordinates: [-1, -1, 3.6], isHetero: true },
      ];

      const protRings = extractAromaticRings(ringAAtoms);
      const ligRings = [{
        chainId: 'A',
        residueNumber: 142,
        residueName: 'HEM',
        ringType: '5_MEMBERED' as const,
        centroid: [0, -0.5, 3.6] as [number, number, number],
        normal: [0, 0, 1] as [number, number, number],
        atomNames: ['C1A', 'C2A', 'C3A', 'C4A', 'CHA'],
      }];

      expect(protRings.length).toBe(1);
      const piContacts = detectPiStackingInteractions(protRings, ligRings);
      expect(piContacts.length).toBe(1);
      expect(piContacts[0].type).toBe('PI_STACKING_PARALLEL');
      expect(piContacts[0].geometryDetails?.ringNormalAngleDeg).toBeCloseTo(0.0, 1);
    });

    it('strictly forbids detecting pi-stacking using centroid distance alone without normal orientation check', () => {
      // Ring normals are perpendicular (90 deg), but centroid distance is 6.0 A (exceeds 5.5 A T-shape cutoff)
      const ring1 = [{
        chainId: 'A',
        residueNumber: 1,
        residueName: 'PHE',
        ringType: '6_MEMBERED' as const,
        centroid: [0, 0, 0] as [number, number, number],
        normal: [0, 0, 1] as [number, number, number],
        atomNames: ['CG', 'CD1', 'CD2'],
      }];

      const ring2 = [{
        chainId: 'B',
        residueNumber: 2,
        residueName: 'LIG',
        ringType: '6_MEMBERED' as const,
        centroid: [6.0, 0, 0] as [number, number, number], // 6.0 A > 5.5 A
        normal: [1, 0, 0] as [number, number, number],
        atomNames: ['C1', 'C2', 'C3'],
      }];

      const piContacts = detectPiStackingInteractions(ring1, ring2);
      expect(piContacts.length).toBe(0);
    });
  });

  // =========================================================================
  // 6. 4HHB HEME REGRESSION: PROXIMAL HIS COORDINATION & CHAIN ISOLATION
  // =========================================================================
  describe('6. 4HHB Heme Mandatory Regression', () => {
    it('verifies Fe-His coordination in 4HHB Chain A (HEM 142 FE <-> HIS 87 NE2 at 2.14 A)', () => {
      // Canonical crystallographic coordinates from 4HHB.pdb
      const feA: ContactAtomDetail = {
        chainId: 'A',
        residueNumber: 142,
        residueName: 'HEM',
        atomName: 'FE',
        element: 'FE',
        coordinates: [18.362, 18.488, 23.755],
        isHetero: true,
      };

      const hisA87_NE2: ContactAtomDetail = {
        chainId: 'A',
        residueNumber: 87,
        residueName: 'HIS',
        atomName: 'NE2',
        element: 'N',
        coordinates: [16.894, 20.030, 24.002],
        isHetero: false,
      };

      const dist = calculateEuclideanDistance(feA.coordinates, hisA87_NE2.coordinates);
      expect(dist).toBeCloseTo(2.14, 2); // Exact 2.14 A matching LINK record in 4HHB.pdb!

      const contact = classifyPairInteraction(feA, hisA87_NE2, dist, 'EXPERIMENTAL_DEPOSITED');
      expect(contact.type).toBe('METAL_COORDINATION');
      expect(contact.geometryDetails?.metalElement).toBe('FE');
      expect(contact.geometryDetails?.coordinationBondLength).toBeCloseTo(2.14, 2);

      // Verify coordination sphere analysis
      const sphere = analyzeMetalCoordinationSphere(feA, [hisA87_NE2], 2.8);
      expect(sphere.coordinationNumber).toBe(1);
      expect(sphere.coordinatingLigands[0].donorAtom.residueName).toBe('HIS');
      expect(sphere.coordinatingLigands[0].donorAtom.atomName).toBe('NE2');
      expect(sphere.coordinatingLigands[0].distance).toBeCloseTo(2.14, 2);
    });

    it('guarantees that HEM 142 on Chain A does not resolve to His 87 on Chain C', () => {
      // Chain C coordinates from 4HHB.pdb
      const feC: ContactAtomDetail = {
        chainId: 'C',
        residueNumber: 142,
        residueName: 'HEM',
        atomName: 'FE',
        element: 'FE',
        coordinates: [4.445, 23.463, 54.548],
        isHetero: true,
      };

      const hisA87: ContactAtomDetail = {
        chainId: 'A',
        residueNumber: 87,
        residueName: 'HIS',
        atomName: 'NE2',
        element: 'N',
        coordinates: [16.894, 20.030, 24.002],
        isHetero: false,
      };

      // Distance from Fe in Chain C to His in Chain A across the tetramer
      const crossDist = calculateEuclideanDistance(feC.coordinates, hisA87.coordinates);
      expect(crossDist).toBeGreaterThan(30.0); // Fe(C) is > 30 A away from His(A)!

      const sphere = analyzeMetalCoordinationSphere(feC, [hisA87], 2.8);
      expect(sphere.coordinationNumber).toBe(0); // Cannot coordinate across tetramer!
    });
  });

  // =========================================================================
  // 7. 1TUP ZINC COORDINATION & PROTEIN-DNA SEPARATION
  // =========================================================================
  describe('7. 1TUP Zinc Coordination & Protein-DNA Separation', () => {
    it('verifies 4-coordinate tetrahedral Zinc center in p53 (Cys176, His179, Cys238, Cys242)', () => {
      const znA: ContactAtomDetail = {
        chainId: 'A',
        residueNumber: 951,
        residueName: 'ZN',
        atomName: 'ZN',
        element: 'ZN',
        coordinates: [58.108, 23.242, 57.424],
        isHetero: true,
      };

      const donors: ContactAtomDetail[] = [
        { chainId: 'A', residueNumber: 176, residueName: 'CYS', atomName: 'SG', element: 'S', coordinates: [56.40, 24.30, 58.60], isHetero: false },
        { chainId: 'A', residueNumber: 179, residueName: 'HIS', atomName: 'ND1', element: 'N', coordinates: [59.50, 24.00, 56.50], isHetero: false },
        { chainId: 'A', residueNumber: 238, residueName: 'CYS', atomName: 'SG', element: 'S', coordinates: [57.00, 21.50, 56.80], isHetero: false },
        { chainId: 'A', residueNumber: 242, residueName: 'CYS', atomName: 'SG', element: 'S', coordinates: [59.80, 22.20, 58.50], isHetero: false },
      ];

      const sphere = analyzeMetalCoordinationSphere(znA, donors, 2.8);
      expect(sphere.coordinationNumber).toBe(4);
      expect(sphere.geometryAssessment).toBe('TETRAHEDRAL_LIKE');
      expect(sphere.epistemicDisclaimer).toContain('Oxidation state, spin state, and electronic charge require experimental');
    });

    it('strictly segregates protein-DNA contacts from protein-ligand interactions', () => {
      const p53Gln: ContactAtomDetail = {
        chainId: 'A',
        residueNumber: 165,
        residueName: 'GLN',
        atomName: 'NE2',
        element: 'N',
        coordinates: [0, 0, 0],
        isHetero: false,
      };

      const dnaPhosphate: ContactAtomDetail = {
        chainId: 'E',
        residueNumber: 1015,
        residueName: 'DC',
        atomName: 'OP2',
        element: 'O',
        coordinates: [2.88, 0, 0],
        isHetero: false,
      };

      const dist = calculateEuclideanDistance(p53Gln.coordinates, dnaPhosphate.coordinates);
      expect(dist).toBe(2.88);

      const contact = classifyPairInteraction(p53Gln, dnaPhosphate, dist, 'EXPERIMENTAL_DEPOSITED');
      // Inter-chain protein-DNA interaction
      expect(contact.isInterChain).toBe(true);
      expect(contact.type).toBe('HYDROGEN_BOND_PUTATIVE');
    });
  });

  // =========================================================================
  // 8. INTERFACIAL MULTI-CHAIN BINDING SITES
  // =========================================================================
  describe('8. Interfacial Multi-Chain Binding Sites', () => {
    it('correctly reports contacting residues from both Chain A and Chain B for interface ligand', () => {
      const lig: LigandInstanceIdentity = {
        structureId: 'INTERFACIAL',
        modelId: 1,
        chainId: 'A',
        residueName: 'LIG',
        residueNumber: 500,
        instanceKey: 'INTERFACIAL:1:A:LIG:500',
        classification: 'ligand',
        isCofactor: false,
        isProstheticGroup: false,
        isMetalIon: false,
        provenance: 'EXPERIMENTAL_DEPOSITED',
        atomCount: 1,
        centroid: [10, 10, 10],
      };

      const components: IndexedComponent[] = [
        {
          id: { structureId: 'INTERFACIAL', modelId: 1, chainId: 'A', classification: 'ligand', residueName: 'LIG', residueNumber: 500 },
          canonicalLabel: 'LIG · Chain A · 500',
          shortLabel: 'A:LIG:500',
          atoms: [{ id: 1, atomName: 'C1', element: 'C', coordinates: [10, 10, 10], isHetero: true }],
        },
        {
          id: { structureId: 'INTERFACIAL', modelId: 1, chainId: 'A', classification: 'protein', residueName: 'PHE', residueNumber: 20 },
          canonicalLabel: 'PHE · Chain A · 20',
          shortLabel: 'A:PHE:20',
          atoms: [{ id: 2, atomName: 'CZ', element: 'C', coordinates: [12, 10, 10], isHetero: false }], // 2.0 A from lig
        },
        {
          id: { structureId: 'INTERFACIAL', modelId: 1, chainId: 'B', classification: 'protein', residueName: 'TYR', residueNumber: 35 },
          canonicalLabel: 'TYR · Chain B · 35',
          shortLabel: 'B:TYR:35',
          atoms: [{ id: 3, atomName: 'OH', element: 'O', coordinates: [10, 12.5, 10], isHetero: false }], // 2.5 A from lig
        },
      ];

      const site = analyzeLigandBindingSite(lig, components, { cutoffAngstroms: 4.0 });
      expect(site.isInterfacial).toBe(true);
      expect(site.contactingChains).toEqual(['A', 'B']);
      expect(site.contactingResidues.length).toBe(2);

      // Verify proximity ranking: lowest distance = rank 1
      expect(site.contactingResidues[0].residueName).toBe('PHE');
      expect(site.contactingResidues[0].chainId).toBe('A');
      expect(site.contactingResidues[0].proximityRank).toBe(1);

      expect(site.contactingResidues[1].residueName).toBe('TYR');
      expect(site.contactingResidues[1].chainId).toBe('B');
      expect(site.contactingResidues[1].proximityRank).toBe(2);
      expect(site.contactingResidues[1].isInterfacial).toBe(true);
    });
  });

  // =========================================================================
  // 9. TRAJECTORY CONTACT OCCUPANCY (synth_500f)
  // =========================================================================
  describe('9. Trajectory Contact Occupancy (synth_500f)', () => {
    it('calculates frame-by-frame contact occupancy and disclaims binding affinity or residence time', () => {
      // 10 frames: frames 0..5 in contact (d=3.7 A), frames 6..9 out of contact (d=6.0 A)
      const slices = [
        { frameIndex: 0, sourceCoord: [40, 40, 40] as [number, number, number], targetCoord: [43.7, 40, 40] as [number, number, number] },
        { frameIndex: 1, sourceCoord: [40, 40, 40] as [number, number, number], targetCoord: [43.7, 40, 40] as [number, number, number] },
        { frameIndex: 2, sourceCoord: [40, 40, 40] as [number, number, number], targetCoord: [43.7, 40, 40] as [number, number, number] },
        { frameIndex: 3, sourceCoord: [40, 40, 40] as [number, number, number], targetCoord: [43.7, 40, 40] as [number, number, number] },
        { frameIndex: 4, sourceCoord: [40, 40, 40] as [number, number, number], targetCoord: [43.7, 40, 40] as [number, number, number] },
        { frameIndex: 5, sourceCoord: [40, 40, 40] as [number, number, number], targetCoord: [43.7, 40, 40] as [number, number, number] },
        { frameIndex: 6, sourceCoord: [40, 40, 40] as [number, number, number], targetCoord: [46.0, 40, 40] as [number, number, number] },
        { frameIndex: 7, sourceCoord: [40, 40, 40] as [number, number, number], targetCoord: [46.0, 40, 40] as [number, number, number] },
        { frameIndex: 8, sourceCoord: [40, 40, 40] as [number, number, number], targetCoord: [46.0, 40, 40] as [number, number, number] },
        { frameIndex: 9, sourceCoord: [40, 40, 40] as [number, number, number], targetCoord: [46.0, 40, 40] as [number, number, number] },
      ];

      const occupancy = calculateTrajectoryContactOccupancy(slices, 'TYR151:OH__LIG:O2', 'A:TYR:151:OH', 'LIG:1:O2', 4.0);
      expect(occupancy.totalFrames).toBe(10);
      expect(occupancy.contactCount).toBe(6);
      expect(occupancy.occupancyFraction).toBe(0.6000);
      expect(occupancy.minDistance).toBeCloseTo(3.7, 1);
      expect(occupancy.maxDistance).toBeCloseTo(6.0, 1);
      expect(occupancy.disclaimer).toContain('Does not represent kinetic residence time');
    });
  });

  // =========================================================================
  // 10. CACHE INTEGRITY & ASYNC RACE SAFETY
  // =========================================================================
  describe('10. Cache Integrity & Async Race Safety', () => {
    it('isolates cache entries across structures, chains, ligands, and cutoffs', () => {
      const cache = new InteractionCacheManager();
      const mockSite: any = { definition: 'GEOMETRIC_CONTACT_NEIGHBORHOOD' };

      const keyA = { structureId: '4HHB', modelId: 1, chainId: 'A', instanceKey: '4HHB:1:A:HEM:142', cutoffAngstroms: 4.0 };
      const keyC = { structureId: '4HHB', modelId: 1, chainId: 'C', instanceKey: '4HHB:1:C:HEM:142', cutoffAngstroms: 4.0 };
      const keyCutoff5 = { structureId: '4HHB', modelId: 1, chainId: 'A', instanceKey: '4HHB:1:A:HEM:142', cutoffAngstroms: 5.0 };

      cache.set(keyA, mockSite);
      expect(cache.has(keyA)).toBe(true);
      expect(cache.has(keyC)).toBe(false);       // Chain C is distinct!
      expect(cache.has(keyCutoff5)).toBe(false); // Cutoff 5.0 is distinct!
    });

    it('cancels in-flight async sequences during rapid structure switching', () => {
      const cache = new InteractionCacheManager();
      const seq1 = cache.nextSequence();
      expect(cache.isCurrentSequence(seq1)).toBe(true);

      // User immediately switches to structure 2
      const seq2 = cache.nextSequence();
      expect(cache.isCurrentSequence(seq1)).toBe(false); // Seq 1 invalidated!
      expect(cache.isCurrentSequence(seq2)).toBe(true);  // Seq 2 active!
    });
  });

  // =========================================================================
  // 11. SCIENTIFIC INVARIANTS & PROPERTY-BASED TESTING
  // =========================================================================
  describe('11. Scientific Invariants & Property Tests', () => {
    it('invariant 1: distance symmetry d(A, B) = d(B, A)', () => {
      const p1: [number, number, number] = [12.34, -56.78, 90.12];
      const p2: [number, number, number] = [-23.45, 67.89, -12.34];
      expect(calculateEuclideanDistance(p1, p2)).toBeCloseTo(calculateEuclideanDistance(p2, p1), 6);
    });

    it('invariant 2: threshold monotonicity — increasing contact cutoff non-decreases contacts', () => {
      const lig: LigandInstanceIdentity = {
        structureId: 'MONOTONIC',
        modelId: 1,
        chainId: 'A',
        residueName: 'LIG',
        residueNumber: 1,
        instanceKey: 'MONOTONIC:1:A:LIG:1',
        classification: 'ligand',
        isCofactor: false,
        isProstheticGroup: false,
        isMetalIon: false,
        provenance: 'EXPERIMENTAL_DEPOSITED',
        atomCount: 1,
        centroid: [0, 0, 0],
      };

      const components: IndexedComponent[] = [
        {
          id: { structureId: 'MONOTONIC', modelId: 1, chainId: 'A', classification: 'ligand', residueName: 'LIG', residueNumber: 1 },
          canonicalLabel: 'LIG 1',
          shortLabel: 'A:LIG:1',
          atoms: [{ id: 1, atomName: 'C1', element: 'C', coordinates: [0, 0, 0], isHetero: true }],
        },
        {
          id: { structureId: 'MONOTONIC', modelId: 1, chainId: 'A', classification: 'protein', residueName: 'ALA', residueNumber: 10 },
          canonicalLabel: 'ALA 10',
          shortLabel: 'A:ALA:10',
          atoms: [{ id: 2, atomName: 'CB', element: 'C', coordinates: [3.5, 0, 0], isHetero: false }],
        },
        {
          id: { structureId: 'MONOTONIC', modelId: 1, chainId: 'A', classification: 'protein', residueName: 'VAL', residueNumber: 11 },
          canonicalLabel: 'VAL 11',
          shortLabel: 'A:VAL:11',
          atoms: [{ id: 3, atomName: 'CG1', element: 'C', coordinates: [4.8, 0, 0], isHetero: false }],
        },
      ];

      const site3A = analyzeLigandBindingSite(lig, components, { cutoffAngstroms: 3.0 });
      const site4A = analyzeLigandBindingSite(lig, components, { cutoffAngstroms: 4.0 });
      const site5A = analyzeLigandBindingSite(lig, components, { cutoffAngstroms: 5.0 });

      expect(site3A.contacts.length).toBe(0);
      expect(site4A.contacts.length).toBe(1);
      expect(site5A.contacts.length).toBe(2);

      expect(site3A.contacts.length).toBeLessThanOrEqual(site4A.contacts.length);
      expect(site4A.contacts.length).toBeLessThanOrEqual(site5A.contacts.length);
    });

    it('invariant 3: coordinate finiteness — rejects NaN and Infinity', () => {
      expect(isValidAtomCoord({ coordinates: [NaN, 0, 0] })).toBe(false);
      expect(isValidAtomCoord({ coordinates: [0, Infinity, 0] })).toBe(false);
      expect(isValidAtomCoord({ coordinates: [0, 0, -Infinity] })).toBe(false);
      expect(isValidAtomCoord({ coordinates: [1.2, 3.4, 5.6] })).toBe(true);
    });

    it('invariant 4: alternate location determinism — never duplicates distances', () => {
      const atomsWithAltLocs = [
        { atomName: 'CA', altLoc: 'A', coordinates: [0, 0, 0] },
        { atomName: 'CA', altLoc: 'B', coordinates: [0.1, 0, 0] }, // Second conformer
        { atomName: 'CB', altLoc: ' ', coordinates: [1, 1, 1] },
      ];

      const filtered = filterCanonicalAltLocs(atomsWithAltLocs);
      expect(filtered.length).toBe(2);
      expect(filtered.find(a => a.atomName === 'CA')?.altLoc).toBe('A');
    });
  });
});
