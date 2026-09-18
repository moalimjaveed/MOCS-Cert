/**
 * Structure Metadata & Crystallographic Parameter Parser
 * 
 * Epistemic Rules:
 * 1. Do not infer experimental method from file format.
 * 2. Do not assign crystallographic resolution to NMR or computed models.
 * 3. Never substitute R-work for R-free if R-free is missing.
 * 4. Pre-1992 structures (like 4HHB from 1984) pre-date R-free cross-validation;
 *    R-free must be explicitly reported as null with historic context.
 */

import type {
  ExperimentalMethod,
  ResolutionMetadata,
  CrystallographicRefinement,
  ValueOrigin,
} from './types';

/**
 * Classifies the experimental or computational origin of a structure.
 */
export function classifyExperimentalMethod(
  methodStr?: string | null,
  kind?: string | null
): ExperimentalMethod {
  if (kind === 'predicted') {
    return 'COMPUTED_PREDICTION';
  }
  if (kind === 'designed') {
    return 'DE_NOVO_DESIGN';
  }
  if (kind === 'synthetic' || kind === 'trajectory') {
    return 'SYNTHETIC_BENCHMARK';
  }

  if (!methodStr) {
    return 'UNKNOWN';
  }

  const norm = methodStr.toUpperCase();
  if (norm.includes('NEUTRON')) {
    return 'NEUTRON_DIFFRACTION';
  }
  if (norm.includes('ELECTRON CRYSTALLOGRAPHY')) {
    return 'ELECTRON_CRYSTALLOGRAPHY';
  }
  if (norm.includes('ELECTRON MICROSCOPY') || norm.includes('CRYO-EM') || norm.includes('CRYO EM')) {
    return 'ELECTRON_MICROSCOPY';
  }
  if (norm.includes('SOLUTION NMR')) {
    return 'SOLUTION_NMR';
  }
  if (norm.includes('SOLID-STATE NMR') || norm.includes('SOLID STATE NMR') || norm.includes('SSNMR')) {
    return 'SOLID_STATE_NMR';
  }
  if (norm.includes('NMR')) {
    return 'SOLUTION_NMR';
  }
  if (norm.includes('X-RAY') || norm.includes('DIFFRACTION') || norm.includes('SYNCHROTRON')) {
    return 'X_RAY_DIFFRACTION';
  }
  if (
    norm.includes('ALPHAFOLD') ||
    norm.includes('ESMFOLD') ||
    norm.includes('PREDICTION') ||
    norm.includes('COMPUTED') ||
    norm.includes('IN SILICO') ||
    norm.includes('DEEP LEARNING')
  ) {
    return 'COMPUTED_PREDICTION';
  }

  return 'UNKNOWN';
}

/**
 * Parses and validates physical resolution.
 * Rejects resolution for NMR or in silico models where physical diffraction limits do not exist.
 */
export function parseResolutionMetadata(
  resolutionInput: any,
  method: ExperimentalMethod
): ResolutionMetadata {
  const isDiffractionApplicable =
    method === 'X_RAY_DIFFRACTION' ||
    method === 'ELECTRON_MICROSCOPY' ||
    method === 'NEUTRON_DIFFRACTION' ||
    method === 'ELECTRON_CRYSTALLOGRAPHY';

  if (!isDiffractionApplicable) {
    let reason = 'Diffraction resolution is not applicable to this technique.';
    if (method === 'SOLUTION_NMR' || method === 'SOLID_STATE_NMR') {
      reason = 'NMR does not have a diffraction resolution; solution quality is governed by experimental distance/dihedral restraint counts and ensemble RMSD.';
    } else if (method === 'COMPUTED_PREDICTION' || method === 'DE_NOVO_DESIGN') {
      reason = 'Computed predictions do not possess experimental diffraction limits; quality is assessed via confidence metrics (e.g. pLDDT, PAE).';
    } else if (method === 'SYNTHETIC_BENCHMARK') {
      reason = 'Synthetic coordinate benchmark has no physical experimental diffraction resolution.';
    }

    return {
      resolutionAngstrom: null,
      origin: 'SOURCE_METADATA',
      method,
      isDiffractionApplicable: false,
      notes: reason,
    };
  }

  if (
    typeof resolutionInput === 'string' &&
    (resolutionInput.toUpperCase().includes('PLDDT') || resolutionInput.toUpperCase().includes('SCORE'))
  ) {
    return {
      resolutionAngstrom: null,
      origin: 'SOURCE_METADATA',
      method,
      isDiffractionApplicable: false,
      notes: 'Computed predictions do not possess experimental diffraction limits; confidence scores cannot be interpreted as resolution.',
    };
  }

  let numRes: number | null = null;
  if (typeof resolutionInput === 'number' && Number.isFinite(resolutionInput)) {
    if (resolutionInput > 0 && resolutionInput < 30) {
      numRes = resolutionInput;
    }
  } else if (typeof resolutionInput === 'string') {
    const match = resolutionInput.match(/(\d+\.?\d*)/);
    if (match) {
      const val = parseFloat(match[1]);
      if (Number.isFinite(val) && val > 0 && val < 30) {
        numRes = val;
      }
    }
  }

  if (numRes === null) {
    return {
      resolutionAngstrom: null,
      origin: 'SOURCE_METADATA',
      method,
      isDiffractionApplicable: true,
      notes: 'Unrecorded or unphysical resolution value.',
    };
  }

  const isCryo = method === 'ELECTRON_MICROSCOPY';
  const notes = isCryo
    ? `Nominal cryo-EM map reconstruction resolution: ${numRes.toFixed(2)} Å (FSC threshold dependent, NOT crystallographic Bragg limit).`
    : `Diffraction resolution: ${numRes.toFixed(2)} Å (represents high-angle Bragg diffraction limit, NOT per-atom positional uncertainty).`;

  return {
    resolutionAngstrom: Number(numRes.toFixed(2)),
    origin: 'SOURCE_METADATA',
    method,
    isDiffractionApplicable: true,
    notes,
  };
}

/**
 * Parses crystallographic refinement parameters (R-work, R-free, Space Group, Unit Cell).
 */
export function parseCrystallographicRefinement(
  input: {
    rWork?: number | string | null;
    rFree?: number | string | null;
    refinementProgram?: string | null;
    spaceGroup?: string | null;
    unitCell?: { a: number; b: number; c: number; alpha: number; beta: number; gamma: number } | null;
    depositionYear?: number | null;
  },
  method: ExperimentalMethod
): CrystallographicRefinement {
  if (method !== 'X_RAY_DIFFRACTION' && method !== 'NEUTRON_DIFFRACTION') {
    return {
      rWork: null,
      rFree: null,
      refinementProgram: null,
      spaceGroup: null,
      unitCell: null,
      origin: 'SOURCE_METADATA',
      notes: `Crystallographic R-factors are not applicable to non-crystallographic method: ${method}.`,
    };
  }

  const parseR = (val: any): number | null => {
    if (typeof val === 'number' && Number.isFinite(val) && val >= 0 && val <= 1.0) {
      return Number(val.toFixed(4));
    }
    if (typeof val === 'string') {
      const match = val.match(/(\d+\.?\d*)/);
      if (match) {
        const parsed = parseFloat(match[1]);
        if (Number.isFinite(parsed)) {
          // Normalize percentage e.g. 13.5% -> 0.135
          const normalized = parsed > 1.0 ? parsed / 100.0 : parsed;
          if (normalized >= 0 && normalized <= 1.0) return Number(normalized.toFixed(4));
        }
      }
    }
    return null;
  };

  const rWork = parseR(input.rWork);
  let rFree = parseR(input.rFree);
  let notes = 'Crystallographic refinement parameters from deposited entry.';

  if (rFree !== null && rWork !== null) {
    if (rFree < rWork) {
      notes = `Atypical refinement: R-free (${rFree}) is less than R-work (${rWork}), suggesting possible data leakage or uncross-validated test set.`;
    } else {
      notes = `Valid R-factor cross-validation: R-work = ${rWork}, R-free = ${rFree}.`;
    }
  } else if (rFree === null && input.depositionYear && input.depositionYear < 1992) {
    notes = `Pre-dates R-free cross-validation: R-free was not recorded (deposition in ${input.depositionYear} pre-dates Brünger's 1992 cross-validation protocol).`;
  } else if (rFree === null) {
    notes = 'R-free not recorded in deposition header.';
  }

  return {
    rWork,
    rFree,
    refinementProgram: input.refinementProgram ?? null,
    spaceGroup: input.spaceGroup ?? null,
    unitCell: input.unitCell ?? null,
    origin: 'SOURCE_METADATA',
    notes,
  };
}
