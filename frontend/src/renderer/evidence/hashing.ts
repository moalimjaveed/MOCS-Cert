/**
 * MOCS-Cert — Hashing and Canonicalization
 *
 * Uses RFC 8785 JCS (JSON Canonicalization Scheme) for JSON data.
 * Uses a documented fixed-endian binary format for coordinate data.
 *
 * Scientific digest excludes volatile timestamps and environment metadata.
 * Scene digest is separate from scientific digest.
 * Certificate digest covers everything.
 *
 * No React, no Mol*, no Three.js.
 */

import type { EvidenceRecord, Certificate } from './types.js';

// ---------------------------------------------------------------------------
// JCS Canonicalization (RFC 8785)
// ---------------------------------------------------------------------------

/**
 * Produces a JCS-canonical JSON string (RFC 8785).
 * Keys are sorted strictly by UTF-16 code units recursively.
 * Numbers are serialized per IEEE 754 without trailing zeros.
 */
export function jcsSerialize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`JCS: non-finite number: ${value}`);
    return String(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(jcsSerialize).join(',') + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as object).sort();
    const pairs = keys.map((k) => `${JSON.stringify(k)}:${jcsSerialize((value as Record<string, unknown>)[k])}`);
    return '{' + pairs.join(',') + '}';
  }
  throw new Error(`JCS: unsupported type: ${typeof value}`);
}

// ---------------------------------------------------------------------------
// Coordinate Binary Format
// ---------------------------------------------------------------------------

function normalizeFloat(val: number): number {
  if (!Number.isFinite(val)) {
    throw new Error(`Scientific coordinate violates numeric invariant: non-finite value ${val}`);
  }
  // Normalize -0 to +0 per IEEE-754 bit determinism
  return Object.is(val, -0) ? 0 : val;
}

/**
 * Canonical binary serialization for coordinate arrays.
 *
 * Format:
 *   [4 bytes] magic: 0x4D4F4353 ("MOCS")
 *   [4 bytes] version: 0x00000001
 *   [4 bytes] atomCount (uint32, little-endian)
 *   [atomCount * 24 bytes] coordinates: x, y, z as float64 little-endian
 */
export function serializeCoordinates(
  coords: Float64Array | (readonly [number, number, number])[],
  atomCount?: number
): ArrayBuffer {
  const count = atomCount ?? (Array.isArray(coords) ? coords.length : coords.length / 3);
  const buffer = new ArrayBuffer(12 + count * 24);
  const view = new DataView(buffer);
  view.setUint32(0, 0x4D4F4353, true); // "MOCS"
  view.setUint32(4, 0x00000001, true); // version 1
  view.setUint32(8, count, true);

  if (Array.isArray(coords)) {
    for (let i = 0; i < count; i++) {
      const pt = coords[i] ?? [0, 0, 0];
      view.setFloat64(12 + i * 24, normalizeFloat(pt[0]), true);
      view.setFloat64(12 + i * 24 + 8, normalizeFloat(pt[1]), true);
      view.setFloat64(12 + i * 24 + 16, normalizeFloat(pt[2]), true);
    }
  } else {
    for (let i = 0; i < count; i++) {
      view.setFloat64(12 + i * 24, normalizeFloat(coords[i * 3]), true);
      view.setFloat64(12 + i * 24 + 8, normalizeFloat(coords[i * 3 + 1]), true);
      view.setFloat64(12 + i * 24 + 16, normalizeFloat(coords[i * 3 + 2]), true);
    }
  }
  return buffer;
}

/**
 * Enhanced Canonical Coordinate Binary Format (Version 2)
 * Embeds model number and trajectory frame identity into the 24-byte header.
 */
export function serializeCanonicalCoordinates(options: {
  coords: Float64Array | (readonly [number, number, number])[];
  atomCount?: number;
  modelNumber?: number;
  frameIdentity?: number;
}): ArrayBuffer {
  const { coords, modelNumber = 1, frameIdentity = 0 } = options;
  const count = options.atomCount ?? (Array.isArray(coords) ? coords.length : coords.length / 3);
  const buffer = new ArrayBuffer(24 + count * 24);
  const view = new DataView(buffer);

  view.setUint32(0, 0x4D4F4353, true); // "MOCS"
  view.setUint32(4, 0x00000002, true); // version 2
  view.setUint32(8, count, true);
  view.setUint32(12, modelNumber, true);
  view.setUint32(16, frameIdentity, true);
  view.setUint32(20, 0, true); // reserved / padding

  if (Array.isArray(coords)) {
    for (let i = 0; i < count; i++) {
      const pt = coords[i] ?? [0, 0, 0];
      view.setFloat64(24 + i * 24, normalizeFloat(pt[0]), true);
      view.setFloat64(24 + i * 24 + 8, normalizeFloat(pt[1]), true);
      view.setFloat64(24 + i * 24 + 16, normalizeFloat(pt[2]), true);
    }
  } else {
    for (let i = 0; i < count; i++) {
      view.setFloat64(24 + i * 24, normalizeFloat(coords[i * 3]), true);
      view.setFloat64(24 + i * 24 + 8, normalizeFloat(coords[i * 3 + 1]), true);
      view.setFloat64(24 + i * 24 + 16, normalizeFloat(coords[i * 3 + 2]), true);
    }
  }
  return buffer;
}

export async function hashCanonicalCoordinates(options: {
  coords: Float64Array | (readonly [number, number, number])[];
  atomCount?: number;
  modelNumber?: number;
  frameIdentity?: number;
}): Promise<string> {
  const buf = serializeCanonicalCoordinates(options);
  return sha256Hex(buf);
}

// ---------------------------------------------------------------------------
// Hash computation (SubtleCrypto with Node fallback)
// ---------------------------------------------------------------------------

export async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  let bytes: Uint8Array;
  if (typeof data === 'string') {
    bytes = new TextEncoder().encode(data);
  } else if (data instanceof Uint8Array) {
    bytes = data;
  } else {
    bytes = new Uint8Array(data);
  }

  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Node.js fallback
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = await (Function('return import("node:crypto")')() as Promise<any>);
    return nodeCrypto.createHash('sha256').update(bytes).digest('hex');
  } catch {
    throw new Error('No cryptographic SHA-256 implementation available in runtime environment');
  }
}

export async function hashString(s: string): Promise<string> {
  return sha256Hex(s);
}

export async function hashBytes(buf: ArrayBuffer): Promise<string> {
  return sha256Hex(buf);
}

// ---------------------------------------------------------------------------
// Scientific Digest
// ---------------------------------------------------------------------------

/**
 * Computes the scientific digest for an evidence record.
 *
 * Includes: datasetBundle, modelNumber, assemblyId, frameIdentity,
 *           canonicalQuery, resolutionContext, algorithmId, algorithmVersion,
 *           parameters, scientificResult.
 *
 * Excludes: timestamps, environment metadata, UI state, camera state.
 */
export async function computeScientificDigest(record: {
  datasetBundle: EvidenceRecord['datasetBundle'];
  modelNumber: EvidenceRecord['modelNumber'];
  assemblyId: EvidenceRecord['assemblyId'];
  frameIdentity: EvidenceRecord['frameIdentity'];
  canonicalQuery: EvidenceRecord['canonicalQuery'];
  resolutionContext: EvidenceRecord['resolutionContext'];
  algorithmId: EvidenceRecord['algorithmId'];
  algorithmVersion: EvidenceRecord['algorithmVersion'];
  parameters: EvidenceRecord['parameters'];
  scientificResult: EvidenceRecord['scientificResult'];
}): Promise<string> {
  const payload = {
    algorithmId: record.algorithmId,
    algorithmVersion: record.algorithmVersion,
    assemblyId: record.assemblyId,
    canonicalQuery: {
      expression: record.canonicalQuery.expression,
      queryHash: record.canonicalQuery.queryHash,
    },
    datasetBundle: record.datasetBundle,
    frameIdentity: record.frameIdentity,
    modelNumber: record.modelNumber,
    parameters: record.parameters,
    resolutionContext: record.resolutionContext,
    scientificResult: record.scientificResult,
  };
  return hashString(jcsSerialize(payload));
}

/**
 * Computes the provenance digest for an evidence record.
 * Includes the scientific digest plus verification records.
 */
export async function computeProvenanceDigest(
  scientificDigest: string,
  verificationRecords: EvidenceRecord['verificationRecords']
): Promise<string> {
  const payload = { scientificDigest, verificationRecords };
  return hashString(jcsSerialize(payload));
}

/**
 * Computes the certificate digest.
 * Covers all certificate fields including scene digest.
 */
export async function computeCertificateDigest(cert: Omit<Certificate, 'certificateDigest'>): Promise<string> {
  return hashString(jcsSerialize(cert));
}

/**
 * Computes the cryptographic hash chain link for an append-only ledger record.
 * hash_n = SHA256(previousLedgerDigest + ":" + scientificDigest + ":" + provenanceDigest)
 */
export async function computeLedgerChainDigest(
  previousLedgerDigest: string | null,
  scientificDigest: string,
  provenanceDigest: string
): Promise<string> {
  const payload = previousLedgerDigest
    ? `CHAIN:${previousLedgerDigest}:${scientificDigest}:${provenanceDigest}`
    : `GENESIS:${scientificDigest}:${provenanceDigest}`;
  return hashString(payload);
}

