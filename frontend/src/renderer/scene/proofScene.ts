import { ScientificAABB } from '@mocs/geometry';
import { MeasurementCaliper } from '@mocs/geometry';
import { SourceAtomId } from '@mocs/core';

export type AABBStyle = 'wireframe' | 'corners' | 'hybrid';

export interface ProofAABBItem {
  readonly id: string;
  readonly aabb: ScientificAABB;
  readonly style: AABBStyle;
  readonly colorHex: number; // e.g. 0x38bdf8 for protein, 0xc084fc for ligand
  readonly lineWidth?: number;
}

export interface ProofCaliperItem {
  readonly id: string;
  readonly caliper: MeasurementCaliper;
  readonly colorHex: number;
  readonly showDistanceLabel: boolean;
}

export interface ProofReticleItem {
  readonly id: string;
  readonly sourceAtomId: SourceAtomId;
  readonly position: readonly [number, number, number];
  readonly colorHex: number;
  readonly radiusAngstroms: number;
}

/**
 * Explicit record of a proof item that was requested but could not be resolved.
 *
 * Semantically different from "not requested":
 *   - resolutionFailures: []   → nothing was requested / all resolved
 *   - resolutionFailures: [X]  → X was requested, but atom lookup failed
 *
 * This prevents interpreting "calipers = []" as "no measurement required"
 * when the actual state is "the requested atoms do not exist in this dataset".
 */
export interface ProofResolutionFailure {
  /** What type of proof item failed to resolve */
  readonly kind: 'caliper' | 'reticle' | 'aabb';
  /** The canonical query string that failed, e.g. 'HEM:93:FE' */
  readonly query: string;
  /** Human-readable explanation surfaced to UI / evidence ledger */
  readonly reason: string;
  /** The dataset in which resolution was attempted */
  readonly datasetId: string;
}

export interface ScientificProofScene {
  readonly aabbs: readonly ProofAABBItem[];
  readonly calipers: readonly ProofCaliperItem[];
  readonly reticles: readonly ProofReticleItem[];
  /**
   * Explicit resolution failures for requested proof items that could not be produced.
   * An empty array means all requested items resolved successfully (or nothing was requested).
   */
  readonly resolutionFailures: readonly ProofResolutionFailure[];
}
