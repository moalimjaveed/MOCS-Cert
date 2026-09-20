import { CanonicalStructure, CanonicalTrajectory, SourceAtomId } from '@mocs/core';
import { CanonicalScene, CameraProjectionMode, RepresentationType, ScientificProofScene } from '@mocs/scene';
import { RendererRuntimeState } from './runtimeState.js';
import { RendererCapabilities } from './capabilities.js';
import { VisibilityFilter } from './material.js';

export interface CameraOptions {
  readonly durationMs?: number;
  readonly fovDegrees?: number;
}

export interface FocusTarget {
  readonly position: readonly [number, number, number];
  readonly radius?: number;
}

/**
 * Renderer-Neutral Contract for Molecular Viewports.
 * Does NOT expose Mol*, NGL, or 3Dmol specific types.
 */
export interface MolecularRenderer {
  readonly capabilities: RendererCapabilities;

  /** Initializes the renderer into the target HTML container */
  init(container: HTMLElement): Promise<void>;

  /** Loads a canonical structure transactionally */
  loadStructure(structure: CanonicalStructure, initialPdbData?: string): Promise<void>;

  /** Loads an accompanying trajectory */
  loadTrajectory?(trajectory: CanonicalTrajectory): Promise<void>;

  /** Switches trajectory frame */
  setFrame?(frameNumber: number): Promise<void>;

  /** Sets component-specific representation */
  setRepresentation(componentId: string, representation: RepresentationType): Promise<void>;

  /** Updates structural visibility filters (suppress solvent/water/ions) */
  setVisibility(filter: Partial<VisibilityFilter>): Promise<void>;

  /** Applies atom reticle selection */
  selectAtoms(atoms: readonly SourceAtomId[], positions: readonly (readonly [number, number, number])[]): Promise<void>;

  /** Clears selection */
  clearSelection(): Promise<void>;

  /** Enables or disables camera-aware pocket cutaway inspection mode for target positions */
  setInspectionMode?(
    enabled: boolean,
    targetPositions: readonly (readonly [number, number, number])[],
    radius?: number
  ): Promise<void>;

  /** Sets camera projection mode */
  setCameraMode(mode: CameraProjectionMode): Promise<void>;

  /** Fits camera to the entire molecular structure */
  fitStructure(options?: CameraOptions): Promise<void>;

  /** Focuses camera on exact resolved 3D coordinates */
  focusPosition(target: FocusTarget, options?: CameraOptions): Promise<void>;

  /** Gets camera snapshot for state restoration */
  getCameraSnapshot?(): any;

  /** Restores camera snapshot */
  setCameraSnapshot?(snapshot: any, durationMs?: number): void;

  /** Clears any active inspection cutaway clipping */
  clearInspectionCutaway?(): Promise<void>;

  /** Projects the scientific proof scene (AABB wireframes/corners, calipers, reticles) */
  projectProofScene(proofScene: ScientificProofScene, revision: number): Promise<void>;

  /** Clears all proof geometry with guaranteed zero residual nodes */
  clearProofScene(): Promise<void>;

  /** Commits a full CanonicalScene */
  commitScene(scene: CanonicalScene): Promise<void>;

  /** Queries actual committed runtime state directly from the underlying engine */
  getRuntimeState(): RendererRuntimeState;

  /** Notifies the renderer of container dimension changes */
  handleResize?(): void;

  /** Disposes the renderer instance and cleans up WebGL context */
  dispose(): Promise<void>;
}
