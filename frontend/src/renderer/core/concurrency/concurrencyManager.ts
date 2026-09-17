/**
 * MOCS-Cert — Concurrency & Generation Management.
 *
 * Separate generation counters for separate concerns to avoid race conditions.
 * No React, no Mol*, no Three.js.
 */

export type DatasetGeneration = number & { readonly __brand: 'DatasetGeneration' };
export type FrameGeneration = number & { readonly __brand: 'FrameGeneration' };
export type SelectionGeneration = number & { readonly __brand: 'SelectionGeneration' };
export type SceneRevisionNum = number & { readonly __brand: 'SceneRevisionNum' };

export const INITIAL_DATASET_GENERATION = 0 as DatasetGeneration;
export const INITIAL_FRAME_GENERATION = 0 as FrameGeneration;
export const INITIAL_SELECTION_GENERATION = 0 as SelectionGeneration;
export const INITIAL_SCENE_REVISION = 0 as SceneRevisionNum;

export interface GenerationGuard<T extends number> {
  readonly generation: T;
  isStale: (current: T) => boolean;
}

export function makeGenerationGuard<T extends number>(gen: T): GenerationGuard<T> {
  return {
    generation: gen,
    isStale: (current: T) => current !== gen,
  };
}

export class ConcurrencyManager {
  private _datasetGen: DatasetGeneration = INITIAL_DATASET_GENERATION;
  private _frameGen: FrameGeneration = INITIAL_FRAME_GENERATION;
  private _selectionGen: SelectionGeneration = INITIAL_SELECTION_GENERATION;
  private _sceneRev: SceneRevisionNum = INITIAL_SCENE_REVISION;

  // ---------------------------------------------------------------------------
  // Dataset generation
  // ---------------------------------------------------------------------------

  get datasetGeneration(): DatasetGeneration {
    return this._datasetGen;
  }

  /**
   * Increments the dataset generation and resets frame generation.
   */
  nextDataset(): GenerationGuard<DatasetGeneration> {
    this._datasetGen = (this._datasetGen + 1) as DatasetGeneration;
    this._frameGen = INITIAL_FRAME_GENERATION;
    return makeGenerationGuard(this._datasetGen);
  }

  isDatasetStale(guard: GenerationGuard<DatasetGeneration>): boolean {
    return guard.isStale(this._datasetGen);
  }

  // ---------------------------------------------------------------------------
  // Frame generation
  // ---------------------------------------------------------------------------

  get frameGeneration(): FrameGeneration {
    return this._frameGen;
  }

  nextFrame(): {
    datasetGuard: GenerationGuard<DatasetGeneration>;
    frameGuard: GenerationGuard<FrameGeneration>;
  } {
    this._frameGen = (this._frameGen + 1) as FrameGeneration;
    return {
      datasetGuard: makeGenerationGuard(this._datasetGen),
      frameGuard: makeGenerationGuard(this._frameGen),
    };
  }

  isFrameStale(
    datasetGuard: GenerationGuard<DatasetGeneration>,
    frameGuard: GenerationGuard<FrameGeneration>
  ): boolean {
    return datasetGuard.isStale(this._datasetGen) || frameGuard.isStale(this._frameGen);
  }

  // ---------------------------------------------------------------------------
  // Selection generation
  // ---------------------------------------------------------------------------

  get selectionGeneration(): SelectionGeneration {
    return this._selectionGen;
  }

  nextSelection(): GenerationGuard<SelectionGeneration> {
    this._selectionGen = (this._selectionGen + 1) as SelectionGeneration;
    return makeGenerationGuard(this._selectionGen);
  }

  isSelectionStale(guard: GenerationGuard<SelectionGeneration>): boolean {
    return guard.isStale(this._selectionGen);
  }

  // ---------------------------------------------------------------------------
  // Scene revision
  // ---------------------------------------------------------------------------

  get sceneRevision(): SceneRevisionNum {
    return this._sceneRev;
  }

  nextSceneRevision(): SceneRevisionNum {
    this._sceneRev = (this._sceneRev + 1) as SceneRevisionNum;
    return this._sceneRev;
  }

  isSceneStale(revision: SceneRevisionNum): boolean {
    return revision !== this._sceneRev;
  }
}
