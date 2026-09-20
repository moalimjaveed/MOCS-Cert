/**
 * Canonical Nucleic Acid Type Definitions for MOCS-Cert
 * 
 * Establishes DNA and RNA as first-class molecular structures with:
 * - Precise chemical discrimination (DNA vs RNA via ribose O2' presence and standard residue taxonomy)
 * - Chain / Strand scoping (Chain A != Chain B)
 * - Nucleotide identity (Structure -> Model -> Chain -> Residue -> Atom)
 * - Covalent phosphodiester connectivity vs non-covalent base pairing
 * - Component & Duplex bounding cages
 */

import type { ValidatedAtom, ComponentGeometricBound } from '../geometry';

export type NucleicType = 'dna' | 'rna' | 'hybrid' | 'unspecified';

export type NucleotideBaseType =
  | 'A'
  | 'C'
  | 'G'
  | 'T'
  | 'U'
  | 'I'
  | 'modified'
  | 'unknown';

export type SugarType = 'deoxyribose' | 'ribose' | 'modified' | 'indeterminate';

export interface PhosphodiesterBond {
  upstreamNucleotideId: string;
  downstreamNucleotideId: string;
  o3AtomCoords: [number, number, number];
  pAtomCoords: [number, number, number];
  distance: number;
  isValidCovalent: boolean;
}

export interface BasePairInteraction {
  strand1ChainId: string;
  resSeq1: number;
  base1: string;
  strand2ChainId: string;
  resSeq2: number;
  base2: string;
  pairType: 'Watson-Crick' | 'Wobble' | 'Hoogsteen' | 'Non-canonical' | 'candidate';
  hBondCount: number;
  geometryDistance: number;
  isStandardPair: boolean;
}

export interface NucleotideRecord {
  structureId: string;
  modelId: string | number;
  chainId: string;
  residueNumber: number;
  insertionCode?: string;
  residueName: string;
  canonicalBase: NucleotideBaseType;
  nucleicType: NucleicType;
  sugarType: SugarType;
  isModified: boolean;
  has5PrimePhosphate: boolean;
  has3PrimeHydroxyl: boolean;
  has2PrimeHydroxyl: boolean;
  atoms: ValidatedAtom[];
  backboneAtoms: ValidatedAtom[];
  baseAtoms: ValidatedAtom[];
  bounds: ComponentGeometricBound;
}

export interface NucleicStrand {
  chainId: string;
  nucleicType: NucleicType;
  nucleotides: NucleotideRecord[];
  sequence: string;
  is5To3Ordered: boolean;
  hasGaps: boolean;
  bonds: PhosphodiesterBond[];
  bounds: ComponentGeometricBound;
}

export interface NucleicDuplex {
  structureId: string;
  strands: NucleicStrand[];
  basePairs: BasePairInteraction[];
  isDoubleStranded: boolean;
  totalNucleotides: number;
  totalAtoms: number;
  bounds: ComponentGeometricBound;
}
