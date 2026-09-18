/**
 * Canonical Molecular Measurement System Types
 * 
 * Epistemic Status: ESTABLISHED
 * All measurements follow:
 * USER INTENT -> EXACT STRUCTURAL SELECTION -> EXACT ATOM IDENTITY ->
 * VALID COORDINATES -> MATHEMATICAL CALCULATION -> UNIT -> RESULT -> VISUAL ANNOTATION
 */

export type MeasurementType = 'distance' | 'angle' | 'dihedral';

export type MeasurementUnit = 'Å' | '°';

export interface MeasurementAtomRef {
  /** Human-readable label (e.g., 'A:87:NE2' or 'HEM:142:FE') */
  label: string;
  /** Full precision Cartesian 3D coordinates [x, y, z] in Ångström */
  coords: [number, number, number];
  structureId?: string;
  modelId?: number | string;
  chainId?: string;
  resName?: string;
  resSeq?: number;
  atomName?: string;
  element?: string;
  altLoc?: string;
}

export interface CanonicalMeasurement {
  /** Unique deterministic or UUID identifier */
  id: string;
  type: MeasurementType;
  /** Endpoints involved in the measurement (2 for distance, 3 for angle, 4 for dihedral) */
  atoms: MeasurementAtomRef[];
  /** Full-precision internal value (distance in Å or angle in degrees) */
  rawValue: number;
  /** Formatted string rounded strictly for display (e.g. '2.14 Å' or '109.47°') */
  formattedValue: string;
  unit: MeasurementUnit;
  /** Epistemic validity status */
  isValid: boolean;
  /** Periodic boundary condition minimum-image calculation flag */
  isPbc?: boolean;
  /** Simulation box extents if PBC applied */
  boxExtents?: [number, number, number];
  /** Explicit warning or validation failure message */
  error?: string;
  createdAt: number;
}

export interface MeasurementValidationResult {
  isValid: boolean;
  error?: string;
}
