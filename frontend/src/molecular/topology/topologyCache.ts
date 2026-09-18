/**
 * Molecular Topology Cache & Race Condition Safety Engine
 * 
 * Epistemic Rules:
 * 1. Cache keys must preserve structure, model, assembly, source, and frame.
 * 2. Race condition prevention: Cancels out-of-order async calculations on structure transition.
 * 3. Never reuse topology across different structures or models.
 */

import type { MolecularGraph } from './types';

export interface TopologyCacheKeyParams {
  structureId: string;
  modelId?: string | number;
  assemblyId?: string | number;
  source?: string;
  frameIndex?: number;
}

export class TopologyCacheManager {
  private cache = new Map<string, MolecularGraph>();
  private activeSequence = 0;

  /**
   * Generates a deterministic multi-dimensional cache key.
   */
  public generateKey(params: TopologyCacheKeyParams): string {
    const sId = (params.structureId || '').toUpperCase().trim();
    const mId = String(params.modelId ?? 1);
    const aId = String(params.assemblyId ?? '1');
    const src = (params.source || 'DEFAULT').toUpperCase().trim();
    const fIdx = params.frameIndex !== undefined ? `frame:${params.frameIndex}` : 'static';

    return `${sId}::model:${mId}::assembly:${aId}::source:${src}::${fIdx}`;
  }

  public get(params: TopologyCacheKeyParams): MolecularGraph | undefined {
    const key = this.generateKey(params);
    return this.cache.get(key);
  }

  public set(params: TopologyCacheKeyParams, value: MolecularGraph): void {
    const key = this.generateKey(params);
    this.cache.set(key, value);
  }

  public has(params: TopologyCacheKeyParams): boolean {
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

export const topologyCache = new TopologyCacheManager();
