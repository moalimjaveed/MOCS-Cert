/**
 * MOCS-Cert Quality Cache & Race Safety Engine
 * 
 * Epistemic Rules:
 * 1. Cache keys must preserve structureId, modelId, and validation scope.
 * 2. Race condition prevention: Cancels out-of-order async calculations on structure transition.
 * 3. Never reuse Quality Reports across different structures or coordinates.
 */

import type { StructureQualityReport } from './types';

export interface QualityCacheKeyParams {
  structureId: string;
  modelId?: string | number;
  frameIndex?: number;
  scope?: string;
}

export class QualityCacheManager {
  private cache = new Map<string, StructureQualityReport>();
  private activeSequence = 0;

  /**
   * Generates a deterministic cache key.
   */
  public generateKey(params: QualityCacheKeyParams): string {
    const sId = (params.structureId || '').toUpperCase().trim();
    const mId = String(params.modelId ?? 1);
    const fIdx = params.frameIndex !== undefined ? `frame:${params.frameIndex}` : 'static';
    const sc = (params.scope || 'ALL').toUpperCase().trim();

    return `${sId}::model:${mId}::${fIdx}::${sc}`;
  }

  public get(params: QualityCacheKeyParams): StructureQualityReport | undefined {
    const key = this.generateKey(params);
    return this.cache.get(key);
  }

  public set(params: QualityCacheKeyParams, value: StructureQualityReport): void {
    const key = this.generateKey(params);
    this.cache.set(key, value);
  }

  public has(params: QualityCacheKeyParams): boolean {
    const key = this.generateKey(params);
    return this.cache.has(key);
  }

  public clear(): void {
    this.cache.clear();
  }

  /**
   * Begins a new asynchronous calculation sequence, invalidating previous in-flight sequences.
   */
  public nextSequence(): number {
    this.activeSequence++;
    return this.activeSequence;
  }

  /**
   * Verifies whether a completed async calculation is still valid for the active sequence.
   */
  public isCurrentSequence(seq: number): boolean {
    return seq === this.activeSequence;
  }
}

export const qualityCache = new QualityCacheManager();
