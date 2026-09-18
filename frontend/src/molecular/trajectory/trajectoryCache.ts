/**
 * Trajectory Analysis Cache & Asynchronous Race Condition Protection.
 * 
 * Guarantees:
 * 1. Monotonic Sequence Cancellation (activeRequestSeq): Drops stale asynchronous frame
 *    or trajectory analysis computations when the user rapidly scrubs or switches datasets.
 * 2. Composite Key Invariance: Caches results strictly scoped by trajectoryId, analysis type,
 *    reference frame, selection, and parameters.
 * 3. Memory Bound (LRU): Limits entries to prevent memory leaks during extended sessions.
 */

export interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
}

export class TrajectoryAnalysisCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxEntries: number;
  private activeRequestSeq: number = 0;

  constructor(maxEntries: number = 100) {
    this.maxEntries = Math.max(10, maxEntries);
  }

  /**
   * Generates a composite cache key.
   */
  public buildKey(
    trajectoryId: string,
    analysisType: string,
    params: Record<string, any>
  ): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((k) => `${k}=${JSON.stringify(params[k])}`)
      .join('&');
    return `${trajectoryId}::${analysisType}::${sortedParams}`;
  }

  /**
   * Retrieves an item from cache if present.
   */
  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Refresh timestamp for LRU
    entry.timestamp = Date.now();
    return entry.data as T;
  }

  /**
   * Stores an item in cache, evicting the oldest entry if maxEntries is exceeded.
   */
  public set<T>(key: string, data: T): void {
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      // Find oldest entry
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [k, v] of this.cache.entries()) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      key,
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Starts an asynchronous task, incrementing the sequence counter.
   */
  public startAsyncRequest(): number {
    this.activeRequestSeq++;
    return this.activeRequestSeq;
  }

  /**
   * Verifies whether a given sequence number is still current.
   */
  public isRequestActive(seq: number): boolean {
    return seq === this.activeRequestSeq;
  }

  /**
   * Clears the cache and resets sequence counters.
   */
  public clear(): void {
    this.cache.clear();
    this.activeRequestSeq++;
  }

  public size(): number {
    return this.cache.size;
  }
}

export const globalTrajectoryCache = new TrajectoryAnalysisCache();
