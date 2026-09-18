/**
 * Structural Completeness, Missing Residues & Chain Break Analyzer
 * 
 * Epistemic Rules:
 * 1. Missing coordinates must NEVER be fabricated with arbitrary (0, 0, 0) coordinates.
 * 2. Sequence length must not be reduced simply because coordinates are missing in electron density.
 * 3. Never assume chain continuity solely because residue numbers are sequential.
 *    Peptide bond distance d(C_i, N_{i+1}) must be evaluated.
 */

import { calculateEuclideanDistance } from '../measurements/calculations';
import type {
  MissingAtomRecord,
  MissingResidueRecord,
  ChainBreakRecord,
} from './types';

// Canonical expected heavy atoms for 20 standard amino acids
export const EXPECTED_AMINO_ACID_ATOMS: Record<string, string[]> = {
  ALA: ['N', 'CA', 'C', 'O', 'CB'],
  ARG: ['N', 'CA', 'C', 'O', 'CB', 'CG', 'CD', 'NE', 'CZ', 'NH1', 'NH2'],
  ASN: ['N', 'CA', 'C', 'O', 'CB', 'CG', 'OD1', 'ND2'],
  ASP: ['N', 'CA', 'C', 'O', 'CB', 'CG', 'OD1', 'OD2'],
  CYS: ['N', 'CA', 'C', 'O', 'CB', 'SG'],
  GLN: ['N', 'CA', 'C', 'O', 'CB', 'CG', 'CD', 'OE1', 'NE2'],
  GLU: ['N', 'CA', 'C', 'O', 'CB', 'CG', 'CD', 'OE1', 'OE2'],
  GLY: ['N', 'CA', 'C', 'O'],
  HIS: ['N', 'CA', 'C', 'O', 'CB', 'CG', 'ND1', 'CD2', 'CE1', 'NE2'],
  ILE: ['N', 'CA', 'C', 'O', 'CB', 'CG1', 'CG2', 'CD1'],
  LEU: ['N', 'CA', 'C', 'O', 'CB', 'CG', 'CD1', 'CD2'],
  LYS: ['N', 'CA', 'C', 'O', 'CB', 'CG', 'CD', 'CE', 'NZ'],
  MET: ['N', 'CA', 'C', 'O', 'CB', 'CG', 'SD', 'CE'],
  PHE: ['N', 'CA', 'C', 'O', 'CB', 'CG', 'CD1', 'CD2', 'CE1', 'CE2', 'CZ'],
  PRO: ['N', 'CA', 'C', 'O', 'CB', 'CG', 'CD'],
  SER: ['N', 'CA', 'C', 'O', 'CB', 'OG'],
  THR: ['N', 'CA', 'C', 'O', 'CB', 'OG1', 'CG2'],
  TRP: ['N', 'CA', 'C', 'O', 'CB', 'CG', 'CD1', 'CD2', 'NE1', 'CE2', 'CE3', 'CZ2', 'CZ3', 'CH2'],
  TYR: ['N', 'CA', 'C', 'O', 'CB', 'CG', 'CD1', 'CD2', 'CE1', 'CE2', 'CZ', 'OH'],
  VAL: ['N', 'CA', 'C', 'O', 'CB', 'CG1', 'CG2'],
};

export const STANDARD_AA_SIDECHAINS = EXPECTED_AMINO_ACID_ATOMS;

export interface ModeledResidueInput {
  chainId?: string;
  residueNumber?: number;
  resNum?: number;
  residueName?: string;
  resName?: string;
  insertionCode?: string;
  modeledAtoms?: Array<{ name?: string; atomName?: string; coordinates?: [number, number, number]; coord?: [number, number, number] }>;
  presentAtoms?: string[];
  cCoord?: [number, number, number];
  nCoord?: [number, number, number];
}

/**
 * Identifies missing heavy atoms in modeled residues.
 */
export function auditMissingAtoms(
  residues: ModeledResidueInput[]
): MissingAtomRecord[] {
  const missingRecords: MissingAtomRecord[] = [];

  for (const res of residues) {
    const resName = (res.residueName || res.resName || '').toUpperCase().trim();
    const expected = EXPECTED_AMINO_ACID_ATOMS[resName];
    if (!expected) continue; // Skip non-standard or hetero residues

    const presentSet = new Set<string>();
    if (res.presentAtoms) {
      for (const a of res.presentAtoms) presentSet.add(a.toUpperCase().trim());
    }
    if (res.modeledAtoms) {
      for (const a of res.modeledAtoms) {
        const name = (a.name || a.atomName || '').toUpperCase().trim();
        if (name) presentSet.add(name);
      }
    }

    const missing = expected.filter((name) => !presentSet.has(name));

    if (missing.length > 0) {
      const isBackboneComplete =
        presentSet.has('N') &&
        presentSet.has('CA') &&
        presentSet.has('C') &&
        presentSet.has('O');

      missingRecords.push({
        chainId: res.chainId || 'A',
        residueNumber: res.residueNumber ?? res.resNum ?? 0,
        residueName: resName,
        expectedAtoms: expected,
        modeledAtoms: Array.from(presentSet),
        missingAtoms: missing,
        isBackboneComplete,
      });
    }
  }

  return missingRecords;
}

/**
 * Identifies unresolved residues (present in sequence, but absent from coordinates).
 */
export function auditMissingResidues(
  canonicalSequence: Array<{ chainId: string; resNum: number; resName: string }>,
  modeledResidues: ModeledResidueInput[]
): MissingResidueRecord[] {
  const modeledKeys = new Set(
    modeledResidues.map((r) => `${r.chainId || 'A'}:${r.residueNumber ?? r.resNum}`)
  );

  const missing: MissingResidueRecord[] = [];
  if (canonicalSequence.length === 0) return missing;

  // Group by chain to evaluate termini
  const seqByChain = new Map<string, Array<{ chainId: string; resNum: number; resName: string }>>();
  for (const item of canonicalSequence) {
    if (!seqByChain.has(item.chainId)) {
      seqByChain.set(item.chainId, []);
    }
    seqByChain.get(item.chainId)!.push(item);
  }

  const modeledByChain = new Map<string, number[]>();
  for (const r of modeledResidues) {
    const cId = r.chainId || 'A';
    const num = r.residueNumber ?? r.resNum;
    if (num !== undefined) {
      if (!modeledByChain.has(cId)) modeledByChain.set(cId, []);
      modeledByChain.get(cId)!.push(num);
    }
  }

  for (const [chainId, chainSeq] of seqByChain.entries()) {
    chainSeq.sort((a, b) => a.resNum - b.resNum);
    const modNums = modeledByChain.get(chainId) || [];
    const minModeled = modNums.length > 0 ? Math.min(...modNums) : Infinity;
    const maxModeled = modNums.length > 0 ? Math.max(...modNums) : -Infinity;

    for (const item of chainSeq) {
      const key = `${item.chainId}:${item.resNum}`;
      if (!modeledKeys.has(key)) {
        let region: 'N_TERMINUS' | 'C_TERMINUS' | 'INTERNAL_LOOP' = 'INTERNAL_LOOP';
        if (item.resNum < minModeled) {
          region = 'N_TERMINUS';
        } else if (item.resNum > maxModeled) {
          region = 'C_TERMINUS';
        }

        missing.push({
          chainId: item.chainId,
          residueNumber: item.resNum,
          residueName: item.resName,
          regionDescription: region,
        });
      }
    }
  }

  return missing;
}

/**
 * Audits peptide backbone connectivity and flags chain breaks.
 * Canonical peptide bond length d(C_i, N_{i+1}) is ~1.33 A.
 * A distance > 2.5 A indicates an unmodeled loop gap or chain termination.
 */
export function auditChainBreaks(
  residues: ModeledResidueInput[]
): ChainBreakRecord[] {
  const breaks: ChainBreakRecord[] = [];
  if (!residues || residues.length < 2) return breaks;

  // Group residues by chain and sort by residueNumber
  const chains = new Map<string, ModeledResidueInput[]>();
  for (const r of residues) {
    const cId = r.chainId || 'A';
    if (!chains.has(cId)) {
      chains.set(cId, []);
    }
    chains.get(cId)!.push(r);
  }

  for (const [chainId, chainRes] of chains.entries()) {
    chainRes.sort((a, b) => (a.residueNumber ?? a.resNum ?? 0) - (b.residueNumber ?? b.resNum ?? 0));

    for (let i = 0; i < chainRes.length - 1; i++) {
      const r1 = chainRes[i];
      const r2 = chainRes[i + 1];
      const r1Num = r1.residueNumber ?? r1.resNum ?? 0;
      const r2Num = r2.residueNumber ?? r2.resNum ?? 0;
      const r1Name = r1.residueName ?? r1.resName ?? 'UNK';
      const r2Name = r2.residueName ?? r2.resName ?? 'UNK';

      let cCoord: [number, number, number] | undefined = r1.cCoord;
      if (!cCoord && r1.modeledAtoms) {
        const atom = r1.modeledAtoms.find((a) => (a.name || a.atomName || '').toUpperCase().trim() === 'C');
        cCoord = atom?.coordinates ?? atom?.coord;
      }

      let nCoord: [number, number, number] | undefined = r2.nCoord;
      if (!nCoord && r2.modeledAtoms) {
        const atom = r2.modeledAtoms.find((a) => (a.name || a.atomName || '').toUpperCase().trim() === 'N');
        nCoord = atom?.coordinates ?? atom?.coord;
      }

      if (!cCoord || !nCoord) {
        continue;
      }

      const dist = calculateEuclideanDistance(cCoord, nCoord);
      const isSequenceContiguous = r2Num === r1Num + 1;

      // Canonical peptide bond is 1.33 A; > 2.5 A denotes a structural chain break
      if (dist > 2.5 || !isSequenceContiguous) {
        breaks.push({
          chainId,
          precedingResidueNumber: r1Num,
          succeedingResidueNumber: r2Num,
          precedingResidueName: r1Name,
          succeedingResidueName: r2Name,
          measuredDistanceC_N: Number(dist.toFixed(2)),
          isSequenceContiguous,
          breakType: !isSequenceContiguous ? 'DISORDERED_LOOP_GAP' : 'NON_CONTIGUOUS_INSERTION',
        });
      }
    }
  }

  return breaks;
}
