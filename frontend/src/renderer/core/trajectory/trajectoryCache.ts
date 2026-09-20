/**
 * MOCS-Cert — Trajectory Frame Cache.
 *
 * Bounded LRU cache for trajectory frames.
 * Frames are keyed by (trajectoryId, frameNumber).
 * Prevents cross-dataset memory leaks and bounds memory usage.
 * No React, no Mol*, no Three.js.
 */

import { TrajectoryFrame } from './frame.js';

interface CacheEntry {
  readonly frame: TrajectoryFrame;
  readonly cachedAt: number;
  accessCount: number;
  lastAccessedAt: number;
}

export class TrajectoryFrameCache {
  private readonly _cache: Map<string, CacheEntry> = new Map();
  private readonly _maxFrames: number;

  constructor(maxFrames = 50) {
    this._maxFrames = Math.max(1, maxFrames);
  }

  private _key(trajectoryId: string, frameNumber: number): string {
    return `${trajectoryId}\x00${frameNumber}`;
  }

  /**
   * Retrieves a cached frame or null if absent.
   */
  get(trajectoryId: string, frameNumber: number): TrajectoryFrame | null {
    const key = this._key(trajectoryId, frameNumber);
    const entry = this._cache.get(key);
    if (!entry) return null;
    entry.accessCount++;
    entry.lastAccessedAt = performance.now();
    return entry.frame;
  }

  /**
   * Stores a frame, evicting the least recently used frame if capacity is exceeded.
   */
  set(trajectoryId: string, frame: TrajectoryFrame): void {
    const key = this._key(trajectoryId, frame.frameNumber);

    if (this._cache.size >= this._maxFrames && !this._cache.has(key)) {
      this._evictLRU();
    }

    this._cache.set(key, {
      frame,
      cachedAt: performance.now(),
      accessCount: 1,
      lastAccessedAt: performance.now(),
    });
  }

  /**
   * Evicts all frames associated with a trajectory when unloaded.
   */
  evictTrajectory(trajectoryId: string): void {
    const prefix = `${trajectoryId}\x00`;
    for (const key of this._cache.keys()) {
      if (key.startsWith(prefix)) {
        this._cache.delete(key);
      }
    }
  }

  clear(): void {
    this._cache.clear();
  }

  get size(): number {
    return this._cache.size;
  }

  get maxFrames(): number {
    return this._maxFrames;
  }

  private _evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this._cache.entries()) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this._cache.delete(oldestKey);
    }
  }
}
