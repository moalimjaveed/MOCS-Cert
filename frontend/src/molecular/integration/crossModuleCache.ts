/**
 * MOCS-Cert Cross-Module Cache & Invalidation Coordinator
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: Compound Canonical Cache Keys & Cascading Cross-Subsystem Invalidation
 */

export interface CacheKeyScope {
  structureId: string;
  modelId?: string | number;
  chainId?: string;
  frameIndex?: number;
  calculationType: string;
  selection?: string;
  params?: Record<string, any>;
  version?: string;
}

function canonicalizeParams(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalizeParams).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalizeParams(obj[k])).join(',') + '}';
}

export class CrossModuleCacheManager {
  private cache = new Map<string, { value: any; timestamp: number }>();
  private maxEntries: number;
  private currentStructureId: string = '4HHB';
  private currentChainId: string = 'A';
  private currentFrameIndex: number = 0;

  constructor(maxEntries = 200) {
    this.maxEntries = maxEntries;
  }

  /**
   * Generates a canonical, unambiguous compound key incorporating all scientific inputs.
   */
  public buildKey(scope: CacheKeyScope): string {
    const sId = (scope.structureId || 'STRUCTURE').trim().toUpperCase();
    const mId = scope.modelId ?? 1;
    const cId = scope.chainId ? scope.chainId.trim().toUpperCase() : '*';
    const fIdx = scope.frameIndex !== undefined ? scope.frameIndex : '*';
    const type = scope.calculationType.trim().toLowerCase();
    const sel = scope.selection ? scope.selection.trim() : '*';
    const paramsStr = scope.params ? canonicalizeParams(scope.params) : '';
    const ver = scope.version || 'v1';

    return `${sId}::m${mId}::c${cId}::f${fIdx}::${type}::[${sel}]::${paramsStr}::${ver}`;
  }

  public get<T = any>(key: string): T | undefined {
    const entry = this.cache.get(key);
    return entry ? entry.value : undefined;
  }

  public set<T = any>(key: string, value: T): void {
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  public has(key: string): boolean {
    return this.cache.has(key);
  }

  public delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Forcibly evicts all entries belonging to a given structure ID (or the current structure if omitted).
   * Essential for structure reload/re-import scenarios where structure ID remains unchanged.
   */
  public invalidateStructure(structureId?: string): number {
    const target = (structureId || this.currentStructureId).trim().toUpperCase();
    let evictedCount = 0;
    const prefix = `${target}::`;
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        evictedCount++;
      }
    }
    return evictedCount;
  }

  /**
   * Invalidation trigger when structure changes (e.g. 4HHB -> 1BNA).
   * Evicts all entries belonging to the previous structure.
   */
  public invalidateOnStructureChange(newStructureId: string): number {
    const norm = newStructureId.trim().toUpperCase();
    if (this.currentStructureId === norm) return 0;

    let evictedCount = 0;
    const oldPrefix = `${this.currentStructureId}::`;
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(oldPrefix)) {
        this.cache.delete(key);
        evictedCount++;
      }
    }

    this.currentStructureId = norm;
    return evictedCount;
  }

  /**
   * Forcibly evicts all entries belonging to a given chain ID (or current chain if omitted).
   */
  public invalidateChain(chainId?: string): number {
    const target = (chainId || this.currentChainId).trim().toUpperCase();
    let evictedCount = 0;
    const chainToken = `::c${target}::`;
    for (const key of Array.from(this.cache.keys())) {
      if (key.includes(chainToken)) {
        this.cache.delete(key);
        evictedCount++;
      }
    }
    return evictedCount;
  }

  /**
   * Invalidation trigger when chain changes (e.g. Chain A -> Chain C in 4HHB).
   * Evicts chain-specific analysis while preserving whole-structure metadata.
   */
  public invalidateOnChainChange(newChainId: string): number {
    const normChain = newChainId.trim().toUpperCase();
    if (this.currentChainId === normChain) return 0;

    let evictedCount = 0;
    const chainToken = `::c${this.currentChainId}::`;
    for (const key of Array.from(this.cache.keys())) {
      if (key.includes(chainToken)) {
        this.cache.delete(key);
        evictedCount++;
      }
    }

    this.currentChainId = normChain;
    return evictedCount;
  }

  /**
   * Forcibly evicts all entries belonging to a given frame index (or current frame if omitted).
   */
  public invalidateFrame(frameIndex?: number): number {
    const target = frameIndex ?? this.currentFrameIndex;
    let evictedCount = 0;
    const frameToken = `::f${target}::`;
    for (const key of Array.from(this.cache.keys())) {
      if (key.includes(frameToken)) {
        this.cache.delete(key);
        evictedCount++;
      }
    }
    return evictedCount;
  }

  /**
   * Invalidation trigger when trajectory frame changes (e.g. frame 0 -> frame 50).
   * Evicts frame-dependent metrics (instantaneous distance, SASA, contacts, AABB).
   */
  public invalidateOnFrameChange(newFrameIndex: number): number {
    if (this.currentFrameIndex === newFrameIndex) return 0;

    let evictedCount = 0;
    const frameToken = `::f${this.currentFrameIndex}::`;
    for (const key of Array.from(this.cache.keys())) {
      if (key.includes(frameToken)) {
        this.cache.delete(key);
        evictedCount++;
      }
    }

    this.currentFrameIndex = newFrameIndex;
    return evictedCount;
  }

  /**
   * Clears all cached data across all subsystems.
   */
  public clearAll(): void {
    this.cache.clear();
  }

  public get size(): number {
    return this.cache.size;
  }

  public get currentStructure(): string {
    return this.currentStructureId;
  }

  public get currentChain(): string {
    return this.currentChainId;
  }

  public get currentFrame(): number {
    return this.currentFrameIndex;
  }
}

export const crossModuleCache = new CrossModuleCacheManager();
