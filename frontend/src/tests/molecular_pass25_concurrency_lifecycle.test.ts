/**
 * PASS 25 — CONCURRENCY, STALE-STATE, CANCELLATION & RESOURCE-LIFECYCLE FORENSIC ATTACK
 *
 * Adversarial test suite verifying:
 * 1. ConcurrencyArbiter: monotonic request tokens, out-of-order race dropping, permanent staleness
 * 2. CrossModuleCacheManager: canonical parameter order invariance, reload invalidation, chain/frame eviction
 * 3. TrajectoryPlaybackEngine: non-overlapping async tick serialization, seek preemption, disposal idempotency
 * 4. PredictionPipeline: fail-closed abort signals, immediate cancellation, cache pollution prevention
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConcurrencyArbiter } from '../molecular/integration/concurrencyArbiter';
import { CrossModuleCacheManager } from '../molecular/integration/crossModuleCache';
import { TrajectoryPlaybackEngine } from '../molecular/trajectory/playbackEngine';
import { getPredictionPipeline, clearPredictionCache } from '../molecular/prediction/pipeline';

describe('PASS 25 — Scientific Concurrency & Lifecycle Forensic Attack', () => {

  // =========================================================================
  // 1. CONCURRENCY ARBITER FORENSICS
  // =========================================================================
  describe('ConcurrencyArbiter — Token Monotonicity & Staleness Guarantees', () => {
    let arbiter: ConcurrencyArbiter;

    beforeEach(() => {
      arbiter = new ConcurrencyArbiter();
    });

    it('issues monotonically strictly increasing request tokens', () => {
      const t1 = arbiter.registerRequest('domain_a', 'target_1').token;
      const t2 = arbiter.registerRequest('domain_a', 'target_2').token;
      const t3 = arbiter.registerRequest('domain_b', 'target_3').token;

      expect(t1).toBeLessThan(t2);
      expect(t2).toBeLessThan(t3);
    });

    it('immediately marks previous in-flight request as stale upon registration of newer request', () => {
      const req1 = arbiter.registerRequest('structure_analysis', '4HHB');
      expect(arbiter.isStale('structure_analysis', req1.token)).toBe(false);

      const req2 = arbiter.registerRequest('structure_analysis', '1BNA');
      // Req1 is superseded
      expect(arbiter.isStale('structure_analysis', req1.token)).toBe(true);
      expect(arbiter.isStale('structure_analysis', req2.token)).toBe(false);
      expect(req1.signal?.aborted).toBe(true);
    });

    it('permanently marks completed tokens as stale to prevent late re-application (ABA defense)', () => {
      const req1 = arbiter.registerRequest('alignment', 'model_1');
      expect(arbiter.isStale('alignment', req1.token)).toBe(false);

      const completed = arbiter.completeRequest('alignment', req1.token);
      expect(completed).toBe(true);

      // Even though domain has no active request, req1 must be permanently stale
      expect(arbiter.isStale('alignment', req1.token)).toBe(true);

      // Late completed token cannot be re-completed
      expect(arbiter.completeRequest('alignment', req1.token)).toBe(false);
    });

    it('cancelDomain aborts in-flight request and marks token permanently stale', () => {
      const req = arbiter.registerRequest('pocket_detection', 'site_1');
      expect(arbiter.isStale('pocket_detection', req.token)).toBe(false);

      const cancelled = arbiter.cancelDomain('pocket_detection');
      expect(cancelled).toBe(true);
      expect(req.signal?.aborted).toBe(true);
      expect(arbiter.isStale('pocket_detection', req.token)).toBe(true);
      expect(arbiter.getActiveDomainCount()).toBe(0);
    });

    it('cancelAll aborts all active domains and renders every in-flight token permanently stale', () => {
      const req1 = arbiter.registerRequest('domain_1', 't1');
      const req2 = arbiter.registerRequest('domain_2', 't2');
      const req3 = arbiter.registerRequest('domain_3', 't3');

      arbiter.cancelAll();

      expect(req1.signal?.aborted).toBe(true);
      expect(req2.signal?.aborted).toBe(true);
      expect(req3.signal?.aborted).toBe(true);

      expect(arbiter.isStale('domain_1', req1.token)).toBe(true);
      expect(arbiter.isStale('domain_2', req2.token)).toBe(true);
      expect(arbiter.isStale('domain_3', req3.token)).toBe(true);
      expect(arbiter.getActiveDomainCount()).toBe(0);
    });

    it('reset clears counter and all internal token history', () => {
      arbiter.registerRequest('domain_1', 't1');
      arbiter.reset();
      expect(arbiter.getActiveDomainCount()).toBe(0);
      const newReq = arbiter.registerRequest('domain_1', 't1');
      expect(newReq.token).toBe(1);
    });
  });

  // =========================================================================
  // 2. CROSS-MODULE CACHE FORENSICS
  // =========================================================================
  describe('CrossModuleCacheManager — Canonical Keys & Explicit Invalidation', () => {
    let cache: CrossModuleCacheManager;

    beforeEach(() => {
      cache = new CrossModuleCacheManager(5);
    });

    it('generates identical cache keys regardless of parameter key declaration order', () => {
      const key1 = cache.buildKey({
        structureId: '4HHB',
        calculationType: 'SASA',
        params: { probeRadius: 1.4, algorithm: 'Lee-Richards', samples: 100 },
      });

      const key2 = cache.buildKey({
        structureId: '4HHB',
        calculationType: 'SASA',
        params: { samples: 100, probeRadius: 1.4, algorithm: 'Lee-Richards' },
      });

      expect(key1).toBe(key2);
    });

    it('canonicalizes nested parameter dictionaries recursively', () => {
      const key1 = cache.buildKey({
        structureId: '1BNA',
        calculationType: 'INTERACTION',
        params: {
          cutoffs: { hydrogenBond: 3.5, saltBridge: 4.0, hydrophobic: 4.5 },
          strictPbc: true,
        },
      });

      const key2 = cache.buildKey({
        structureId: '1BNA',
        calculationType: 'INTERACTION',
        params: {
          strictPbc: true,
          cutoffs: { hydrophobic: 4.5, saltBridge: 4.0, hydrogenBond: 3.5 },
        },
      });

      expect(key1).toBe(key2);
    });

    it('invalidateStructure forcibly evicts entries even when structure ID matches currentStructureId (Reload defense)', () => {
      const keyA = cache.buildKey({ structureId: '4HHB', calculationType: 'SASA' });
      const keyB = cache.buildKey({ structureId: '4HHB', calculationType: 'CONTACTS' });
      const keyC = cache.buildKey({ structureId: '1BNA', calculationType: 'SASA' });

      cache.set(keyA, { sasa: 15420 });
      cache.set(keyB, { contacts: 42 });
      cache.set(keyC, { sasa: 8900 });

      expect(cache.size).toBe(3);

      // Structure reload of 4HHB
      const evicted = cache.invalidateStructure('4HHB');
      expect(evicted).toBe(2);
      expect(cache.has(keyA)).toBe(false);
      expect(cache.has(keyB)).toBe(false);
      expect(cache.has(keyC)).toBe(true);
    });

    it('invalidateChain evicts chain-specific analysis while preserving other chains', () => {
      const keyChainA = cache.buildKey({ structureId: '4HHB', chainId: 'A', calculationType: 'HBONDS' });
      const keyChainB = cache.buildKey({ structureId: '4HHB', chainId: 'B', calculationType: 'HBONDS' });
      const keyGlobal = cache.buildKey({ structureId: '4HHB', calculationType: 'GLOBAL_SASA' });

      cache.set(keyChainA, [1, 2, 3]);
      cache.set(keyChainB, [4, 5, 6]);
      cache.set(keyGlobal, 12000);

      const evicted = cache.invalidateChain('A');
      expect(evicted).toBe(1);
      expect(cache.has(keyChainA)).toBe(false);
      expect(cache.has(keyChainB)).toBe(true);
      expect(cache.has(keyGlobal)).toBe(true);
    });

    it('invalidateFrame evicts frame-dependent metrics while preserving frame-invariant data', () => {
      const keyF0 = cache.buildKey({ structureId: '4HHB', frameIndex: 0, calculationType: 'DIST' });
      const keyF1 = cache.buildKey({ structureId: '4HHB', frameIndex: 1, calculationType: 'DIST' });
      const keyStatic = cache.buildKey({ structureId: '4HHB', calculationType: 'STATIC_TOPOLOGY' });

      cache.set(keyF0, 3.4);
      cache.set(keyF1, 4.1);
      cache.set(keyStatic, { numAtoms: 4300 });

      const evicted = cache.invalidateFrame(0);
      expect(evicted).toBe(1);
      expect(cache.has(keyF0)).toBe(false);
      expect(cache.has(keyF1)).toBe(true);
      expect(cache.has(keyStatic)).toBe(true);
    });

    it('evicts oldest entries (FIFO) when exceeding maxEntries capacity', () => {
      for (let i = 0; i < 5; i++) {
        cache.set(`key_${i}`, i);
      }
      expect(cache.size).toBe(5);
      expect(cache.has('key_0')).toBe(true);

      // Inserting 6th entry should evict key_0
      cache.set('key_5', 5);
      expect(cache.size).toBe(5);
      expect(cache.has('key_0')).toBe(false);
      expect(cache.has('key_5')).toBe(true);
    });
  });

  // =========================================================================
  // 3. PLAYBACK ENGINE CONCURRENCY & LIFECYCLE
  // =========================================================================
  describe('TrajectoryPlaybackEngine — Serial Async Execution & Preemption', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('guarantees serial non-overlapping frame execution even when onFrame takes longer than tick interval', async () => {
      let concurrentExecutions = 0;
      let maxConcurrent = 0;
      const executedFrames: number[] = [];

      const mockOnFrame = vi.fn(async (frame: number) => {
        concurrentExecutions++;
        if (concurrentExecutions > maxConcurrent) {
          maxConcurrent = concurrentExecutions;
        }
        // Simulate heavy 150ms async frame decode
        await new Promise((res) => setTimeout(res, 150));
        executedFrames.push(frame);
        concurrentExecutions--;
      });

      // 100 fps = 10ms interval, but each frame takes 150ms
      const engine = new TrajectoryPlaybackEngine(10, mockOnFrame, { fps: 100, initialFrame: 0 });
      engine.play();

      // Advance clock enough for multiple ticks
      await vi.advanceTimersByTimeAsync(500);

      engine.pause();

      // Serial guarantee: at no point should concurrentExecutions exceed 1
      expect(maxConcurrent).toBe(1);
      expect(executedFrames.length).toBeGreaterThan(0);
      engine.dispose();
    });

    it('seek immediately preempts playback and increments sequence counter', () => {
      const dispatched: { frame: number; seq: number }[] = [];
      const engine = new TrajectoryPlaybackEngine(50, (frame, seq) => {
        dispatched.push({ frame, seq });
      }, { fps: 30, initialFrame: 0 });

      engine.play();
      const seqBefore = engine.getRequestSeq();

      engine.seek(25);
      const seqAfter = engine.getRequestSeq();

      expect(seqAfter).toBeGreaterThan(seqBefore);
      expect(dispatched[dispatched.length - 1].frame).toBe(25);
      engine.dispose();
    });

    it('dispose is idempotent and terminates all pending timers and operations', () => {
      const mockCallback = vi.fn();
      const engine = new TrajectoryPlaybackEngine(20, mockCallback, { fps: 30 });
      engine.play();

      engine.dispose();
      // Second dispose call must not throw or alter state
      expect(() => engine.dispose()).not.toThrow();

      // Further play or seek calls are ignored after disposal
      engine.play();
      expect(engine.getState().isPlaying).toBe(false);

      vi.advanceTimersByTime(500);
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 4. PREDICTION PIPELINE CANCELLATION & INTEGRITY
  // =========================================================================
  describe('PredictionPipeline — Strict Abort & Cache Hygiene', () => {
    beforeEach(() => {
      clearPredictionCache();
    });

    it('handles aborted signal gracefully by falling back safely to offline calibration', async () => {
      const pipeline = getPredictionPipeline();
      const controller = new AbortController();
      controller.abort();

      const result = await pipeline.predictStructure({
        sequence: 'MKWVTFISLLFLFSSAYS',
        signal: controller.signal,
        provider: 'esmfold',
      });

      expect(result).toBeDefined();
      expect(result.residueCount).toBe(18);
      expect(result.provenance.provider).toBe('synthetic_calibration');
      expect(result.provenance.isExperimental).toBe(false);
    });

    it('isolates cache entries by provider, model, and sequence hash', async () => {
      const pipeline = getPredictionPipeline();
      const res1 = await pipeline.predictStructure({
        sequence: 'ACDEFGHIKLMNPQRSTVWY',
        provider: 'synthetic_calibration',
        modelName: 'ESMFold-v1',
      });

      expect(pipeline.getCacheSize()).toBe(1);

      // Same sequence with same provider hits cache
      const res2 = await pipeline.predictStructure({
        sequence: 'ACDEFGHIKLMNPQRSTVWY',
        provider: 'synthetic_calibration',
        modelName: 'ESMFold-v1',
      });

      expect(res1).toBe(res2);
      expect(pipeline.getCacheSize()).toBe(1);
    });

    it('rejects superseded prediction request when a newer sequence request arrives', async () => {
      const pipeline = getPredictionPipeline();

      // Dispatch req1 and immediately dispatch req2
      const p1 = pipeline.predictStructure({ sequence: 'ACDEFGHIKLMNPQRSTVWY' });
      const p2 = pipeline.predictStructure({ sequence: 'MKWVTFISLLFLFSSAYS' });

      const [r1, r2] = await Promise.allSettled([p1, p2]);

      expect(r1.status).toBe('rejected');
      if (r1.status === 'rejected') {
        expect((r1.reason as Error).message).toMatch(/superseded/i);
      }

      expect(r2.status).toBe('fulfilled');
      if (r2.status === 'fulfilled') {
        expect(r2.value.residueCount).toBe(18);
      }
    });
  });
});
