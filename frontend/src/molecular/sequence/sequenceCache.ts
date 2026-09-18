/**
 * MOCS-Cert Molecular Sequence & Annotation Subsystem — Sequence Cache & Race Invalidator
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: Atomic Monotonic Sequence Cancellation Token
 * 
 * Prevents asynchronous race conditions where rapid structure/chain selection
 * allows an earlier, slower network or computation promise to overwrite fresh data.
 */

import type { SequenceStructureRecord } from './types';

export class SequenceCache {
  private cache = new Map<string, SequenceStructureRecord>();
  private currentSequenceId = 0;
  private readonly maxEntries: number;

  constructor(maxEntries = 100) {
    this.maxEntries = maxEntries;
  }

  /**
   * Generates a cache key for a structure, model, entity, and chain.
   */
  public buildKey(structureId: string, modelId: number, entityId: string, chainId: string): string {
    return `${structureId.trim().toUpperCase()}::model:${modelId}::entity:${entityId.trim()}::chain:${chainId.trim()}`;
  }

  /**
   * Increments and returns the next monotonic sequence token.
   */
  public nextSequence(): number {
    this.currentSequenceId++;
    return this.currentSequenceId;
  }

  /**
   * Checks if the given sequence token is still the active, newest request.
   */
  public isCurrentSequence(seqId: number): boolean {
    return seqId === this.currentSequenceId;
  }

  /**
   * Retrieves a cached record if present.
   */
  public get(key: string): SequenceStructureRecord | undefined {
    return this.cache.get(key);
  }

  /**
   * Stores a record in the cache, enforcing bounded entry capacity.
   */
  public set(key: string, record: SequenceStructureRecord): void {
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, record);
  }

  /**
   * Checks if a key exists in cache.
   */
  public has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Clears the cache and advances the sequence ID.
   */
  public clear(): void {
    this.cache.clear();
    this.currentSequenceId++;
  }

  /**
   * Current number of cached records.
   */
  public get size(): number {
    return this.cache.size;
  }
}

export const sequenceCache = new SequenceCache();
