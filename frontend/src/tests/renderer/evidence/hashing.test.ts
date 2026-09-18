import { describe, it, expect } from 'vitest';
import {
  jcsSerialize,
  serializeCoordinates,
  sha256Hex,
  hashString,
  computeScientificDigest,
  computeProvenanceDigest,
} from '@mocs/evidence';

describe('Evidence: RFC 8785 JCS & Binary Coordinate Hashing', () => {
  it('canonicalizes object keys in alphabetical UTF-16 code unit order', () => {
    const unordered = {
      zebra: 100,
      apple: 'first',
      middle: {
        nestedZ: true,
        nestedA: false,
      },
    };
    const jcs = jcsSerialize(unordered);
    expect(jcs).toBe('{"apple":"first","middle":{"nestedA":false,"nestedZ":true},"zebra":100}');
  });

  it('serializes numbers according to IEEE 754 without extraneous decimals or whitespace', () => {
    expect(jcsSerialize(42)).toBe('42');
    expect(jcsSerialize(-10.5)).toBe('-10.5');
    expect(jcsSerialize(0)).toBe('0');
    expect(jcsSerialize(null)).toBe('null');
    expect(jcsSerialize(true)).toBe('true');
    expect(jcsSerialize(false)).toBe('false');
  });

  it('fails closed on non-finite numbers', () => {
    expect(() => jcsSerialize(NaN)).toThrow(/non-finite/);
    expect(() => jcsSerialize(Infinity)).toThrow(/non-finite/);
    expect(() => jcsSerialize(-Infinity)).toThrow(/non-finite/);
  });

  it('serializes coordinates to canonical binary format with MOCS header', () => {
    const coords: [number, number, number][] = [
      [17.14, 6.59, 14.79],
      [15.72, 7.82, 14.79],
    ];
    const buffer = serializeCoordinates(coords);
    expect(buffer.byteLength).toBe(12 + 2 * 24);

    const view = new DataView(buffer);
    // Magic "MOCS" = 0x4D4F4353
    expect(view.getUint32(0, true)).toBe(0x4d4f4353);
    // Version = 1
    expect(view.getUint32(4, true)).toBe(1);
    // Atom count = 2
    expect(view.getUint32(8, true)).toBe(2);

    // Coords
    expect(view.getFloat64(12, true)).toBeCloseTo(17.14, 5);
    expect(view.getFloat64(20, true)).toBeCloseTo(6.59, 5);
    expect(view.getFloat64(28, true)).toBeCloseTo(14.79, 5);
  });

  it('computes repeatable SHA-256 digests', async () => {
    const text = 'Canonical Scientific Proof String';
    const hash1 = await hashString(text);
    const hash2 = await hashString(text);

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);

    // Mutating character produces distinct cryptographic digest
    const hashAltered = await hashString('Canonical Scientific Proof String.');
    expect(hashAltered).not.toBe(hash1);
  });

  it('computes repeatable scientific digest excluding volatile properties', async () => {
    const draft = {
      datasetBundle: {
        datasetId: '4hhb',
        format: 'pdb',
        contentHash: 'abc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      },
      modelNumber: 1,
      assemblyId: null,
      frameIdentity: null,
      canonicalQuery: {
        expression: 'A:87:NE2',
        queryHash: 'queryhash123',
      },
      resolutionContext: { asymId: 'A', compId: 'HIS' },
      algorithmId: 'MINIMUM_AABB_ENVELOPE',
      algorithmVersion: '1.0.0',
      parameters: { padding: 0.5 },
      scientificResult: { min: [10, 10, 10], max: [20, 20, 20] },
    };

    const digest1 = await computeScientificDigest(draft);
    const digest2 = await computeScientificDigest(draft);
    expect(digest1).toHaveLength(64);
    expect(digest1).toBe(digest2);
  });
});
