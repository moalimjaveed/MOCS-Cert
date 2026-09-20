/**
 * Canonical Molecular Measurement Manager & Lifecycle Engine
 * 
 * Epistemic Status: ESTABLISHED
 * 
 * Manages the lifecycle of molecular measurements:
 * - Deterministic creation from validated endpoints
 * - Multi-measurement list tracking with unique IDs
 * - Invalidation & cleanup on structure changes (prevents ghost calipers)
 * - Separation of scientific validity from visual toggle state
 */

import type {
  CanonicalMeasurement,
  MeasurementAtomRef,
  MeasurementType,
  MeasurementUnit,
} from './types';
import {
  calculateEuclideanDistance,
  calculateMinimumImageDistance,
  calculateBondAngleDeg,
  calculateDihedralAngleDeg,
  formatDistance,
  formatAngle,
} from './calculations';

let idCounter = 0;
function generateMeasurementId(type: MeasurementType, atoms: MeasurementAtomRef[]): string {
  idCounter += 1;
  const labels = atoms.map((a) => a.label || `${a.chainId || ''}:${a.resSeq || ''}:${a.atomName || ''}`).join('-');
  return `meas-${type}-${labels}-${Date.now().toString(36)}-${idCounter}`;
}

/**
 * Creates a canonical distance measurement between two validated atom endpoints.
 */
export function createDistanceMeasurement(
  atomA: MeasurementAtomRef,
  atomB: MeasurementAtomRef,
  options: {
    isPbc?: boolean;
    boxExtents?: [number, number, number];
  } = {}
): CanonicalMeasurement {
  const isPbc = Boolean(options.isPbc);
  const box = options.boxExtents || [80.0, 80.0, 80.0];

  const rawDist = isPbc
    ? calculateMinimumImageDistance(atomA.coords, atomB.coords, box)
    : calculateEuclideanDistance(atomA.coords, atomB.coords);

  const isValid = Number.isFinite(rawDist);
  const formattedValue = formatDistance(isValid ? rawDist : null, 2);

  return {
    id: generateMeasurementId('distance', [atomA, atomB]),
    type: 'distance',
    atoms: [atomA, atomB],
    rawValue: isValid ? rawDist : 0.0,
    formattedValue,
    unit: 'Å',
    isValid,
    isPbc,
    boxExtents: isPbc ? box : undefined,
    error: isValid ? undefined : 'Invalid endpoint coordinates (non-finite or missing)',
    createdAt: Date.now(),
  };
}

/**
 * Creates a canonical 3-point bond angle measurement (A -> B -> C, vertex at B).
 */
export function createAngleMeasurement(
  atomA: MeasurementAtomRef,
  atomB: MeasurementAtomRef,
  atomC: MeasurementAtomRef
): CanonicalMeasurement {
  const rawAngle = calculateBondAngleDeg(atomA.coords, atomB.coords, atomC.coords);
  const isValid = rawAngle !== null && Number.isFinite(rawAngle);
  const formattedValue = formatAngle(isValid ? rawAngle : null, 2);

  return {
    id: generateMeasurementId('angle', [atomA, atomB, atomC]),
    type: 'angle',
    atoms: [atomA, atomB, atomC],
    rawValue: isValid ? rawAngle! : 0.0,
    formattedValue,
    unit: '°',
    isValid,
    error: isValid ? undefined : 'Degenerate or coincident geometry for 3-point angle',
    createdAt: Date.now(),
  };
}

/**
 * Creates a canonical 4-point dihedral angle measurement (A - B - C - D).
 */
export function createDihedralMeasurement(
  atomA: MeasurementAtomRef,
  atomB: MeasurementAtomRef,
  atomC: MeasurementAtomRef,
  atomD: MeasurementAtomRef
): CanonicalMeasurement {
  const rawDihedral = calculateDihedralAngleDeg(
    atomA.coords,
    atomB.coords,
    atomC.coords,
    atomD.coords
  );
  const isValid = rawDihedral !== null && Number.isFinite(rawDihedral);
  const formattedValue = formatAngle(isValid ? rawDihedral : null, 2);

  return {
    id: generateMeasurementId('dihedral', [atomA, atomB, atomC, atomD]),
    type: 'dihedral',
    atoms: [atomA, atomB, atomC, atomD],
    rawValue: isValid ? rawDihedral! : 0.0,
    formattedValue,
    unit: '°',
    isValid,
    error: isValid ? undefined : 'Collinear or degenerate geometry for 4-point dihedral',
    createdAt: Date.now(),
  };
}

/**
 * In-memory manager for multi-measurement lifecycle.
 */
export class MeasurementLifecycleManager {
  private measurements: Map<string, CanonicalMeasurement> = new Map();
  private currentStructureId: string | null = null;

  constructor(structureId?: string) {
    if (structureId) {
      this.currentStructureId = structureId;
    }
  }

  setStructure(structureId: string): void {
    if (this.currentStructureId !== structureId) {
      // Structure changed: clear all previous measurements to prevent ghost calipers
      this.clearAll();
      this.currentStructureId = structureId;
    }
  }

  add(measurement: CanonicalMeasurement): void {
    this.measurements.set(measurement.id, measurement);
  }

  remove(id: string): boolean {
    return this.measurements.delete(id);
  }

  clearAll(): void {
    this.measurements.clear();
  }

  getAll(): CanonicalMeasurement[] {
    return Array.from(this.measurements.values());
  }

  getById(id: string): CanonicalMeasurement | undefined {
    return this.measurements.get(id);
  }

  getValidMeasurements(): CanonicalMeasurement[] {
    return this.getAll().filter((m) => m.isValid);
  }
}
