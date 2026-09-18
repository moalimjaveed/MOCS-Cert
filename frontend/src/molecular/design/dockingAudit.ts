/**
 * MOCS-Cert Molecular Docking & Binding Hypothesis Audit Engine
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: AutoDock Vina (Trott & Olson, 2010), DiffDock (Corso et al., 2023)
 * 
 * Non-Negotiable Epistemic Principles:
 * 1. A docking score is an empirical scoring function or geometric pose likelihood, NOT an experimentally verified binding affinity (Kd, Ki, IC50).
 * 2. Docking scores must NEVER be converted to or reported as thermodynamic ΔG° unless calibrated against rigorous experimental thermodynamics.
 * 3. Protein docking pipelines must strictly reject nucleic acids (e.g. 1BNA) rather than forcing non-protein biopolymers through protein-only parameterizations.
 */

import { calculateEuclideanDistance } from '../measurements/calculations';
import type { DockingPoseProvenance } from './types';

export class BiopolymerMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BiopolymerMismatchError';
  }
}

export interface ReceptorAtom {
  element: string;
  coords: [number, number, number];
  chainId: string;
  resSeq: number;
}

export interface LigandAtom {
  element: string;
  coords: [number, number, number];
  atomName: string;
}

export interface AuditDockingPoseOptions {
  receptorId: string;
  ligandId: string;
  dockingEngine: string; // e.g. 'AutoDock Vina', 'DiffDock'
  engineVersion: string;
  poseRank: number;
  rawScore: number;
  scoreMetric?: string;
  receptorAtoms: ReceptorAtom[];
  ligandAtoms: LigandAtom[];
  isNucleicReceptor?: boolean;
  randomSeed?: number;
}

const BONDI_VDW_RADII: Record<string, number> = {
  H: 1.20,
  C: 1.70,
  N: 1.55,
  O: 1.52,
  P: 1.80,
  S: 1.80,
  FE: 1.80,
  ZN: 1.39,
  CL: 1.75,
  F: 1.47,
  BR: 1.85,
  I: 1.98,
};

function getVdwRadius(element: string): number {
  const norm = element.toUpperCase().trim();
  return BONDI_VDW_RADII[norm] ?? 1.70;
}

/**
 * Audits a predicted docking pose for biopolymer compatibility, receptor clashes,
 * and scientific scoring honesty.
 */
export function auditDockingPose(options: AuditDockingPoseOptions): DockingPoseProvenance {
  const {
    receptorId,
    ligandId,
    dockingEngine,
    engineVersion,
    poseRank,
    rawScore,
    scoreMetric = 'Empirical Docking Pose Score',
    receptorAtoms,
    ligandAtoms,
    isNucleicReceptor = false,
    randomSeed,
  } = options;

  // Epistemic Guard 1: Reject nucleic acid biopolymers on protein-only docking pipelines
  if (isNucleicReceptor) {
    throw new BiopolymerMismatchError(
      `Biopolymer type mismatch: receptor '${receptorId}' contains nucleic acid biopolymer chains, which are unsupported by protein-only docking engines.`
    );
  }

  if (!receptorAtoms || receptorAtoms.length === 0) {
    throw new Error('Docking audit requires non-empty receptor atomic coordinates.');
  }
  if (!ligandAtoms || ligandAtoms.length === 0) {
    throw new Error('Docking audit requires non-empty ligand atomic coordinates.');
  }

  // Epistemic Guard 2: Heavy-atom steric clash evaluation
  let clashCount = 0;
  const clashThresholdOverlap = 0.40; // Overlap > 0.4 A constitutes severe steric overlap

  for (const lAtom of ligandAtoms) {
    if (lAtom.element.toUpperCase() === 'H') continue;
    const rL = getVdwRadius(lAtom.element);

    for (const rAtom of receptorAtoms) {
      if (rAtom.element.toUpperCase() === 'H') continue;
      const rR = getVdwRadius(rAtom.element);
      const sumVdw = rL + rR;

      const d = calculateEuclideanDistance(lAtom.coords, rAtom.coords);
      const overlap = sumVdw - d;

      if (overlap > clashThresholdOverlap) {
        clashCount++;
      }
    }
  }

  const coordinates: Array<[number, number, number]> = ligandAtoms.map((a) => a.coords);

  return {
    receptorId,
    ligandId,
    dockingEngine,
    engineVersion,
    poseRank,
    dockingScore: Number(rawScore.toFixed(2)),
    scoreMetric,
    isExperimentalAffinity: false,
    coordinates,
    randomSeed,
    receptorClashCount: clashCount,
    severeClashes: clashCount > 0,
    scientificCaveats: [
      'Predicted docking pose represents a computational hypothesis and must not be cited as experimental evidence of binding.',
      'Docking score is an empirical scoring function estimate and does not constitute a measured thermodynamic free energy (ΔG°) or dissociation constant (Kd/Ki).',
    ],
  };
}
