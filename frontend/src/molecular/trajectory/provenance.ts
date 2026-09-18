/**
 * Trajectory MD Provenance, Physical Observables & Scientific Honesty Auditor.
 * 
 * Epistemic Mandates:
 * 1. Coordinates alone do NOT prove which force field, integrator, or ensemble was used.
 * 2. Never fabricate physical simulation observables (temperature, pressure, potential/kinetic energy).
 * 3. Never declare a trajectory "converged" or "thermodynamically stable" without explicit free-energy
 *    or block-averaging evidence.
 * 4. Clearly designate synthetic coordinate benchmarks vs real physical MD simulations.
 */

import type { TrajectoryProvenance, TrajectoryAuthenticity } from './types';

export interface RawTrajectoryProvenanceInput {
  engine?: string | null;
  version?: string | null;
  forceField?: string | null;
  integrator?: string | null;
  timestepPs?: number | null;
  temperatureK?: number | null;
  pressureBar?: number | null;
  ensemble?: string | null;
  pbcType?: string | null;
  isSynthetic?: boolean;
  observablesRecorded?: string[];
  notes?: string;
}

/**
 * Audits and sanitizes trajectory provenance claims.
 * Drops speculative inferences and flags unrecorded physical observables.
 */
export function auditTrajectoryProvenance(
  input: RawTrajectoryProvenanceInput,
  options?: { isCoordinateOnlyFile?: boolean }
): {
  provenance: TrajectoryProvenance;
  authenticity: TrajectoryAuthenticity;
  warnings: string[];
} {
  const warnings: string[] = [];

  const isSynthetic = input.isSynthetic ?? false;

  // Epistemic Guard 1: Coordinate-only files (like XTC) do not contain force-field records
  let forceField = input.forceField ?? null;
  if (options?.isCoordinateOnlyFile && forceField && !isSynthetic) {
    warnings.push(
      `Force field '${forceField}' cannot be verified from coordinate files alone (XTC/TRR without TPR/topology metadata).`
    );
  }

  // Epistemic Guard 2: Ensembles (NPT, NVT, NVE)
  let ensemble = input.ensemble ?? null;
  if (options?.isCoordinateOnlyFile && ensemble && !isSynthetic) {
    warnings.push(
      `Simulation ensemble '${ensemble}' is an unverified assertion; cannot be verified from coordinates alone.`
    );
  }

  // Epistemic Guard 3: Physical observables (T, P)
  const temperatureK = typeof input.temperatureK === 'number' && Number.isFinite(input.temperatureK)
    ? input.temperatureK
    : null;
  const pressureBar = typeof input.pressureBar === 'number' && Number.isFinite(input.pressureBar)
    ? input.pressureBar
    : null;

  if (temperatureK === null && !isSynthetic) {
    warnings.push('Temperature observable was not recorded in trajectory coordinate stream.');
  }

  // Authenticity classification
  let authenticity: TrajectoryAuthenticity;
  if (isSynthetic) {
    authenticity = 'SYNTHETIC_COORDINATE_TRAJECTORY';
  } else if (input.engine && (temperatureK !== null || pressureBar !== null)) {
    authenticity = 'REAL_MD_SIMULATION';
  } else {
    authenticity = 'UNKNOWN';
  }

  const provenance: TrajectoryProvenance = {
    engine: input.engine ?? null,
    version: input.version ?? null,
    forceField,
    integrator: input.integrator ?? null,
    timestepPs: typeof input.timestepPs === 'number' && input.timestepPs > 0 ? input.timestepPs : null,
    temperatureK,
    pressureBar,
    ensemble,
    pbcType: input.pbcType ?? null,
    isSynthetic,
    observablesRecorded: input.observablesRecorded ?? [],
    notes: input.notes ?? (isSynthetic ? 'Synthetic benchmark coordinate trajectory.' : ''),
  };

  return { provenance, authenticity, warnings };
}
