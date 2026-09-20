/**
 * MOCS-Cert Multi-Dimensional Interaction Cache & Race Safety Engine
 * 
 * Epistemic Rules:
 * 1. Cache keys must preserve structure, model, chain, ligand instance, cutoff, and frame.
 * 2. Never reuse Ligand A results for Ligand B.
 * 3. Race condition prevention: Aborts in-flight async calculations on structure/ligand transition.
 */

import type { BindingSiteNeighborhood } from './types';

export interface InteractionCacheKeyParams {
  structureId: string;
  modelId: string | number;
  chainId: string;
  instanceKey: string;
  cutoffAngstroms: number;
  algorithm?: string;
  provenance?: string;
  frameIndex?: number;
}

export class InteractionCacheManager {
  private cache = new Map<string, BindingSiteNeighborhood>();
  private activeSequence = 0;

  /**
   * Generates a deterministic multi-dimensional cache key.
   */
  public generateKey(params: InteractionCacheKeyParams): string {
    const sId = (params.structureId || '').toUpperCase().trim();
    const mId = String(params.modelId ?? 1);
    const cId = (params.chainId || '').toUpperCase().trim();
    const inst = (params.instanceKey || '').toUpperCase().trim();
    const cut = Number(params.cutoffAngstroms).toFixed(2);
    const alg = (params.algorithm || 'DEFAULT').toUpperCase().trim();
    const prov = (params.provenance || 'EXPERIMENTAL').toUpperCase().trim();
    const fIdx = params.frameIndex !== undefined ? `frame:${params.frameIndex}` : 'static';

    return `${sId}::${mId}::${cId}::${inst}::${cut}::${alg}::${prov}::${fIdx}`;
  }

  public get(params: InteractionCacheKeyParams): BindingSiteNeighborhood | undefined {
    const key = this.generateKey(params);
    return this.cache.get(key);
  }

  public set(params: InteractionCacheKeyParams, value: BindingSiteNeighborhood): void {
    const key = this.generateKey(params);
    this.cache.set(key, value);
  }

  public has(params: InteractionCacheKeyParams): boolean {
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

export const interactionCache = new InteractionCacheManager();
