/**
 * MOCS-Cert Protein Structural Biology Domain Types
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: IUPAC-IUBMB, wwPDB mmCIF PDBx Dictionary, DSSP Standard
 */

import type { ValidatedAtom, MolecularComponentId } from '../geometry/structuralIdentity';

export type StandardAminoAcid1Letter =
  | 'A' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'K' | 'L'
  | 'M' | 'N' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'V' | 'W' | 'Y';

export type StandardAminoAcid3Letter =
  | 'ALA' | 'CYS' | 'ASP' | 'GLU' | 'PHE' | 'GLY' | 'HIS' | 'ILE' | 'LYS' | 'LEU'
  | 'MET' | 'ASN' | 'PRO' | 'GLN' | 'ARG' | 'SER' | 'THR' | 'VAL' | 'TRP' | 'TYR';

export type NonCanonicalAminoAcid3Letter =
  | 'MSE' // Selenomethionine
  | 'SEC' // Selenocysteine (U)
  | 'PYL' // Pyrrolysine (O)
  | 'PCA' // Pyroglutamate
  | 'HYP' // Hydroxyproline
  | 'MLY' // N-dimethyl-lysine
  | 'SEP' // Phosphoserine
  | 'TPO' // Phosphothreonine
  | 'PTR' // Phosphotyrosine
  | 'CSO' // S-hydroxycysteine
  | 'CME' // S,S-(2-hydroxyethyl)thiocysteine
  | 'OCS' // Cysteinesulfonic acid
  | 'KCX' // Lysine NZ-carboxylic acid
  | 'LLP' // 2-lysyl-pyridoxal-5-phosphate
  | 'TYS' // O-sulfo-L-tyrosine
  | 'FME';// N-formylmethionine

export type AmbiguousAminoAcid3Letter =
  | 'ASX' // Asp / Asn (B)
  | 'GLX' // Glu / Gln (Z)
  | 'XLE' // Leu / Ile (J)
  | 'UNK';// Unknown amino acid (X)

export type AminoAcidClassification =
  | 'standard'
  | 'non-canonical'
  | 'post-translationally-modified'
  | 'ambiguous'
  | 'unknown';

export type SecondaryStructureType =
  | 'alpha-helix'   // Canonical 3.6_13-helix
  | '3-10-helix'    // 3_10-helix
  | 'pi-helix'      // 4.4_16-helix
  | 'beta-strand'   // Extended beta-strand / pleated sheet
  | 'turn'          // Hydrogen-bonded turn
  | 'coil'          // Unstructured loop / coil
  | 'unassigned';

export interface SecondaryStructureElement {
  type: SecondaryStructureType;
  chainId: string;
  startResSeq: number;
  startInsCode?: string;
  endResSeq: number;
  endInsCode?: string;
  helixClass?: number; // PDB HELIX record class (1=alpha, 3=pi, 5=3_10)
  sheetId?: string;    // PDB SHEET record strand ID
  source: 'deposited' | 'dssp' | 'inferred' | 'prediction';
}

export interface AminoAcidRecord {
  structureId: string;
  modelId: number | string;
  chainId: string;
  residueNumber: number;
  insertionCode?: string;
  residueName: string;
  singleLetterCode: string;
  classification: AminoAcidClassification;
  isModified: boolean;
  atoms: ValidatedAtom[];
  backboneAtoms: ValidatedAtom[];
  sidechainAtoms: ValidatedAtom[];
  alphaCarbon?: ValidatedAtom;
  secondaryStructure?: SecondaryStructureType;
  phiAngleDeg?: number | null;
  psiAngleDeg?: number | null;
  omegaAngleDeg?: number | null;
  isCoordinatePresent: boolean;
}

export interface ProteinChain {
  structureId: string;
  modelId: number | string;
  chainId: string;
  entityId?: string | number;
  description?: string;
  residues: AminoAcidRecord[];
  secondaryStructureElements: SecondaryStructureElement[];
  totalResidueCount: number;
  observedResidueCount: number;
  missingResidueCount: number;
  isHomoOligomer?: boolean;
}

export interface SaltBridgeInteraction {
  cationResidue: {
    chainId: string;
    residueNumber: number;
    residueName: string;
    resName?: string;
    atomName: string;
  };
  anionResidue: {
    chainId: string;
    residueNumber: number;
    residueName: string;
    resName?: string;
    atomName: string;
  };
  distance: number;
  isInterChain: boolean;
}

export interface DisulfideBond {
  cys1: {
    chainId: string;
    residueNumber: number;
    insertionCode?: string;
    atomName: 'SG';
  };
  cys2: {
    chainId: string;
    residueNumber: number;
    insertionCode?: string;
    atomName: 'SG';
  };
  distance: number;
  isInterChain: boolean;
}

export interface SequenceStructureMapping {
  primarySequence: string; // from SEQRES or _entity_poly
  observedSequence: string; // from ATOM records
  totalPrimaryLength: number;
  observedLength: number;
  missingRanges: Array<{
    chainId: string;
    startResSeq: number;
    endResSeq: number;
    length: number;
  }>;
}

export interface ProteinStructuralMetrics {
  atomCount: number;
  residueCount: number;
  chainCount: number;
  centroid: [number, number, number];
  radiusOfGyration: number;
  massWeightedRadiusOfGyration?: number;
  endToEndDistance?: number;
  secondaryStructureFractions: {
    helixFraction: number;
    sheetFraction: number;
    coilFraction: number;
  };
  saltBridgesCount: number;
  disulfideBondsCount: number;
}

export interface KabschAlignmentResult {
  pairedAtomCount: number;
  rmsd: number; // Optimal structural alignment RMSD in Ångströms
  rawRmsd: number; // Pre-alignment raw coordinate RMSD in Ångströms
  rotationMatrix: [
    [number, number, number],
    [number, number, number],
    [number, number, number]
  ];
  translationVector: [number, number, number];
  centroidTarget: [number, number, number];
  centroidSource: [number, number, number];
  superposedSourceCoords: [number, number, number][];
}
