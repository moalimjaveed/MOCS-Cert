/**
 * High-performance reusable coordinate buffer.
 * Avoids allocating new Float64Arrays during playback when possible.
 */
export class CoordinateBuffer {
  private buffer: Float64Array;

  constructor(public readonly atomCount: number) {
    this.buffer = new Float64Array(atomCount * 3);
  }

  get data(): Float64Array {
    return this.buffer;
  }

  setFrom(source: ArrayLike<number>): void {
    if (source.length !== this.buffer.length) {
      throw new Error(`CoordinateBuffer length mismatch: expected ${this.buffer.length}, got ${source.length}`);
    }
    this.buffer.set(source);
  }

  copy(): Float64Array {
    return new Float64Array(this.buffer);
  }
}
