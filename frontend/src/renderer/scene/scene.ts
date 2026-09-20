import { MolecularScene } from './molecularScene.js';
import { ScientificProofScene } from './proofScene.js';
import { CameraScene } from './cameraScene.js';

/**
 * The Canonical, Renderer-Neutral Scene.
 * Represents the complete desired visual and proof state, versioned by sceneRevision.
 */
export interface CanonicalScene {
  readonly sceneRevision: number;
  readonly datasetId: string;
  readonly modelNum: number;
  readonly molecularScene: MolecularScene;
  readonly proofScene: ScientificProofScene;
  readonly cameraScene?: CameraScene;
}
