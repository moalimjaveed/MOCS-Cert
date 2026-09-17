/**
 * Canonical Cryptographic Hashing (SHA-256).
 * No FNV, pseudo-hash, or short hash for authoritative scientific identity.
 */

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  let bytes: Uint8Array;
  if (typeof data === 'string') {
    bytes = new TextEncoder().encode(data);
  } else {
    bytes = data;
  }

  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Node.js fallback if subtle is unavailable
  try {
    // Dynamic import to avoid bundling issues in pure browser builds
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = await (Function('return import("node:crypto")')() as Promise<any>);
    return nodeCrypto.createHash('sha256').update(bytes).digest('hex');
  } catch {
    throw new Error('No cryptographic SHA-256 implementation available in runtime environment');
  }
}
