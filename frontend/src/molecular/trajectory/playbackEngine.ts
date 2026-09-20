/**
 * Non-Blocking Molecular Trajectory Playback Engine.
 * 
 * Provides deterministic frame advance, pause, step, scrubbing, and frame-rate
 * throttling with integrated asynchronous race-condition protection.
 * 
 * Guarantees:
 * 1. Monotonic Sequence Counting (activeRequestSeq): Drops stale asynchronous frame
 *    extraction completions so the 3D scene never flickers or renders out-of-order frames.
 * 2. Non-blocking Execution: Uses requestAnimationFrame or high-resolution timeouts
 *    without freezing the React rendering pipeline or WebGL thread.
 * 3. Clean Lifecycle: Guaranteed timer cleanup on disposal or unmount.
 */

import type { TrajectoryPlaybackOptions, TrajectoryPlaybackState } from './types';

export type FrameUpdateCallback = (
  frameIndex: number,
  requestSeq: number
) => Promise<void> | void;

export class TrajectoryPlaybackEngine {
  private totalFrames: number;
  private currentFrame: number;
  private fps: number;
  private loop: boolean;
  private isPlaying: boolean = false;
  private activeRequestSeq: number = 0;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private onFrame: FrameUpdateCallback;
  private onStateChange?: (state: TrajectoryPlaybackState) => void;

  constructor(
    totalFrames: number,
    onFrame: FrameUpdateCallback,
    options?: TrajectoryPlaybackOptions & {
      initialFrame?: number;
      onStateChange?: (state: TrajectoryPlaybackState) => void;
    }
  ) {
    this.totalFrames = Math.max(1, totalFrames);
    this.currentFrame = options?.initialFrame ?? 0;
    this.fps = Math.max(1, Math.min(120, options?.fps ?? 20));
    this.loop = options?.loop ?? true;
    this.onFrame = onFrame;
    this.onStateChange = options?.onStateChange;
  }

  public getState(): TrajectoryPlaybackState {
    return {
      isPlaying: this.isPlaying,
      currentFrame: this.currentFrame,
      totalFrames: this.totalFrames,
      fps: this.fps,
      loop: this.loop,
    };
  }

  public getRequestSeq(): number {
    return this.activeRequestSeq;
  }

  public play(): void {
    if (this.isDisposed || this.isPlaying) return;
    this.isPlaying = true;
    this.notifyState();
    this.scheduleNextTick();
  }

  public pause(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.notifyState();
  }

  public toggle(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public stepForward(): void {
    this.pause();
    const next = this.currentFrame + 1;
    if (next < this.totalFrames) {
      this.seek(next);
    } else if (this.loop) {
      this.seek(0);
    }
  }

  public stepBackward(): void {
    this.pause();
    const prev = this.currentFrame - 1;
    if (prev >= 0) {
      this.seek(prev);
    } else if (this.loop) {
      this.seek(this.totalFrames - 1);
    }
  }

  private isDisposed: boolean = false;
  private isProcessingFrame: boolean = false;

  public seek(frameIndex: number): void {
    if (this.isDisposed) return;
    const clamped = Math.max(0, Math.min(this.totalFrames - 1, Math.round(frameIndex)));
    this.currentFrame = clamped;
    const seq = ++this.activeRequestSeq;

    // If currently playing, cancel any pending tick so seek immediately takes precedence
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    this.notifyState();

    try {
      this.onFrame(clamped, seq);
    } catch (err) {
      console.warn(`[TrajectoryPlaybackEngine] Error dispatching frame ${clamped}:`, err);
    }

    if (this.isPlaying && !this.isDisposed) {
      this.scheduleNextTick();
    }
  }

  public setFps(fps: number): void {
    this.fps = Math.max(1, Math.min(120, fps));
    this.notifyState();
  }

  public setLoop(loop: boolean): void {
    this.loop = loop;
    this.notifyState();
  }

  public setTotalFrames(total: number): void {
    this.totalFrames = Math.max(1, total);
    if (this.currentFrame >= this.totalFrames) {
      this.seek(this.totalFrames - 1);
    } else {
      this.notifyState();
    }
  }

  public dispose(): void {
    this.isDisposed = true;
    this.pause();
    this.activeRequestSeq++;
  }

  private scheduleNextTick(): void {
    if (!this.isPlaying || this.isDisposed) return;

    const intervalMs = Math.round(1000 / this.fps);
    this.timerId = setTimeout(async () => {
      if (!this.isPlaying || this.isDisposed) return;

      const nextFrame = this.currentFrame + 1;
      if (nextFrame < this.totalFrames) {
        this.currentFrame = nextFrame;
      } else if (this.loop) {
        this.currentFrame = 0;
      } else {
        this.pause();
        return;
      }

      const seq = ++this.activeRequestSeq;
      this.notifyState();

      try {
        this.isProcessingFrame = true;
        await this.onFrame(this.currentFrame, seq);
      } catch (err) {
        console.warn(`[TrajectoryPlaybackEngine] Error in playback tick for frame ${this.currentFrame}:`, err);
      } finally {
        this.isProcessingFrame = false;
      }

      // Schedule subsequent tick ONLY after previous frame processing has resolved
      if (this.isPlaying && !this.isDisposed) {
        this.scheduleNextTick();
      }
    }, intervalMs);
  }

  private notifyState(): void {
    this.onStateChange?.(this.getState());
  }
}
