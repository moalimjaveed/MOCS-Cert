/**
 * MOCS-Cert Molecular Surfaces — Surface Cache & Async Cancellation
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: Atomic Monotonic Sequence Tokens & Bounded LRU Cache
 */

import type { SasaResult, MolecularVolumeResult, CavityDetectionResult } from './types';

export interface CachedSurfaceData {
  sasa?: SasaResult;
  volume?: MolecularVolumeResult;
  cavities?: CavityDetectionResult;
  timestamp: number;
}

export class SurfaceCache {
  private cache = new Map<string, CachedSurfaceData>();
  private currentSequenceId = 0;
  private readonly maxEntries: number;

  constructor(maxEntries = 50) {
    this.maxEntries = maxEntries;
  }

  public buildKey(
    structureId: string,
    modelId: number,
    chainId: string,
    frameIndex: number,
    probeRadius: number
  ): string {
    return `${structureId.trim().toUpperCase()}::m${modelId}::c${chainId.trim().toUpperCase()}::f${frameIndex}::p${probeRadius.toFixed(2)}`;
  }

  public nextSequence(): number {
    this.currentSequenceId++;
    return this.currentSequenceId;
  }

  public isCurrentSequence(seqId: number): boolean {
    return seqId === this.currentSequenceId;
  }

  public get(key: string): CachedSurfaceData | undefined {
    return this.cache.get(key);
  }

  public set(key: string, data: CachedSurfaceData): void {
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, data);
  }

  public has(key: string): boolean {
    return this.cache.has(key);
  }

  public clear(): void {
    this.cache.clear();
    this.currentSequenceId++;
  }

  public get size(): number {
    return this.cache.size;
  }
}

export const surfaceCache = new SurfaceCache();
