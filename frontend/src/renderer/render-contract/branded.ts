/**
 * Branded nominal type utilities and canonical identifiers.
 * Enforces compile-time type safety so raw strings cannot accidentally be used in place of validated IDs.
 */

declare const BrandSymbol: unique symbol;

export type Brand<T, B extends string> = T & { readonly [BrandSymbol]: B };

/** Canonical string key representation of a SourceAtomId */
export type SourceAtomIdString = Brand<string, 'SourceAtomId'>;

/** Canonical string key representation of a SpatialInstanceId */
export type SpatialInstanceIdString = Brand<string, 'SpatialInstanceId'>;

/** Canonical SHA-256 certificate digest */
export type CertificateDigest = Brand<string, 'CertificateDigest'>;

/** Canonical query specification string */
export type CanonicalQueryString = Brand<string, 'CanonicalQuery'>;

export function brandSourceAtomId(key: string): SourceAtomIdString {
  return key as SourceAtomIdString;
}

export function brandSpatialInstanceId(key: string): SpatialInstanceIdString {
  return key as SpatialInstanceIdString;
}

export function brandCertificateDigest(hash: string): CertificateDigest {
  if (!/^[a-f0-9]{64}$/i.test(hash)) {
    throw new TypeError(`Invalid CertificateDigest: expected 64-character hex string, got '${hash}'`);
  }
  return hash.toLowerCase() as CertificateDigest;
}

export function brandCanonicalQuery(query: string): CanonicalQueryString {
  return query.trim() as CanonicalQueryString;
}
