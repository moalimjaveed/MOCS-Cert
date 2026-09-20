import { describe, it, expect } from 'vitest';
import {
  serializeCanonicalCoordinates,
  hashCanonicalCoordinates,
  serializeCoordinates,
} from '@mocs/evidence';

describe('Evidence — Canonical Binary Coordinate Serialization', () => {
  it('encodes Little-Endian Float64 coordinates with exact bit-for-bit repeatability', async () => {
    const coords = new Float64Array([1.2345678, 2.3456789, 3.4567891, 10.0, 20.0, 30.0]);

    const buf1 = serializeCanonicalCoordinates({ coords, modelNumber: 1, frameIdentity: 0 });
    const buf2 = serializeCanonicalCoordinates({ coords, modelNumber: 1, frameIdentity: 0 });

    expect(buf1.byteLength).toBe(24 + 2 * 24); // 24 byte header + 2 atoms * 24 bytes = 72 bytes
    expect(buf1.byteLength).toBe(buf2.byteLength);

    const bytes1 = new Uint8Array(buf1);
    const bytes2 = new Uint8Array(buf2);
    for (let i = 0; i < bytes1.length; i++) {
      expect(bytes1[i]).toBe(bytes2[i]);
    }

    const hash1 = await hashCanonicalCoordinates({ coords, modelNumber: 1, frameIdentity: 0 });
    const hash2 = await hashCanonicalCoordinates({ coords, modelNumber: 1, frameIdentity: 0 });
    expect(hash1).toBe(hash2);
  });

  it('strictly normalizes -0 to +0 per IEEE-754 bit-identity invariant', async () => {
    const coordsPositiveZero = new Float64Array([0.0, 1.0, 2.0]);
    const coordsNegativeZero = new Float64Array([-0.0, 1.0, 2.0]);

    const hashPositive = await hashCanonicalCoordinates({ coords: coordsPositiveZero, modelNumber: 1, frameIdentity: 0 });
    const hashNegative = await hashCanonicalCoordinates({ coords: coordsNegativeZero, modelNumber: 1, frameIdentity: 0 });

    // Despite IEEE-754 sign bit difference (-0.0 vs +0.0), scientific normalization ensures bit-for-bit identical hashes
    expect(hashPositive).toBe(hashNegative);
  });

  it('fail-closed: rejects non-finite values (NaN, Infinity, -Infinity)', () => {
    const nanCoords = new Float64Array([NaN, 1.0, 2.0]);
    const infCoords = new Float64Array([1.0, Infinity, 2.0]);
    const negInfCoords = new Float64Array([1.0, 2.0, -Infinity]);

    expect(() => serializeCanonicalCoordinates({ coords: nanCoords })).toThrow(/non-finite value/);
    expect(() => serializeCanonicalCoordinates({ coords: infCoords })).toThrow(/non-finite value/);
    expect(() => serializeCanonicalCoordinates({ coords: negInfCoords })).toThrow(/non-finite value/);
  });

  it('embeds trajectory frame identity into the 24-byte header', async () => {
    const coords = new Float64Array([1.0, 2.0, 3.0]);
    const hashFrame0 = await hashCanonicalCoordinates({ coords, modelNumber: 1, frameIdentity: 0 });
    const hashFrame1 = await hashCanonicalCoordinates({ coords, modelNumber: 1, frameIdentity: 1 });

    // Changing trajectory frame changes coordinate header hash even if coordinates are identical
    expect(hashFrame0).not.toBe(hashFrame1);
  });
});
