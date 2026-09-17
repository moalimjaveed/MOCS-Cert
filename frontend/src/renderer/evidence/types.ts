export type ContentHash = string & { readonly __brand: 'ContentHash' };
export function makeContentHash(s: string): ContentHash { return s as ContentHash; }

export type DatasetId = string & { readonly __brand: 'DatasetId' };
export function makeDatasetId(s: string): DatasetId { return s as DatasetId; }

export type ModelNumber = number & { readonly __brand: 'ModelNumber' };
export function makeModelNumber(n: number): ModelNumber { return n as ModelNumber; }

export type EvidenceId = string & { readonly __brand: 'EvidenceId' };
export function makeEvidenceId(s: string): EvidenceId {
  return s as EvidenceId;
}

export type CertificationState =
  | 'UNVERIFIED'
  | 'INPUT_VALIDATED'
  | 'QUERY_RESOLVED'
  | 'COMPUTATION_COMPLETE'
  | 'VERIFICATION_COMPLETE'
  | 'EVIDENCE_SEALED'
  | 'CERTIFIED';

export type ProofType =
  | 'AABB'
  | 'DISTANCE_CALIPER'
  | 'SELECTION'
  | 'INSPECTION_CUTAWAY'
  | 'STRUCTURE_INGESTION';

export interface VerificationRecord {
  readonly invariant: string;
  readonly passed: boolean;
  readonly details?: string;
  readonly checkedAt: string;
}

export interface EvidenceRecord {
  readonly evidenceId: EvidenceId;
  readonly createdAt: string; // ISO 8601
  readonly supersedes: EvidenceId | null;
  readonly supersededBy: EvidenceId | null;
  readonly invalidationReason?: string;
  readonly certificationState: CertificationState;

  // Scientific Scope
  readonly proofType: ProofType;
  readonly datasetBundle: {
    readonly datasetId: DatasetId | string;
    readonly format: string;
    readonly contentHash: ContentHash | string;
  };
  readonly modelNumber: ModelNumber | number;
  readonly assemblyId: string | null;
  readonly frameIdentity: number | string | null;
  readonly canonicalQuery: {
    readonly expression: string;
    readonly queryHash: string;
  };
  readonly resolutionContext: Record<string, unknown>;
  readonly algorithmId: string;
  readonly algorithmVersion: string;
  readonly parameters: Record<string, unknown>;
  readonly scientificResult: Record<string, unknown>;

  // Version Metadata
  readonly schemaVersion: string;
  readonly compilerVersion: string;
  readonly rendererVersion: string;
  readonly molstarVersion: string;

  // Cryptographic Proofs & Hash Chain
  readonly verificationRecords: readonly VerificationRecord[];
  readonly scientificDigest: ContentHash | string;
  readonly provenanceDigest: ContentHash | string;
  readonly previousLedgerDigest: ContentHash | string | null;
  readonly ledgerDigest: ContentHash | string;
}

export interface Certificate {
  readonly certificateId: string;
  readonly evidenceId: EvidenceId;
  readonly issuedAt: string;
  readonly scientificDigest: ContentHash | string;
  readonly sceneDigest?: ContentHash | string;
  readonly certificateDigest: ContentHash | string;
}
