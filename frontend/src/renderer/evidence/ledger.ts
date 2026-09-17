/**
 * MOCS-Cert — Evidence Ledger
 *
 * Append-only record of scientific operations and proofs.
 * Records are immutable. Invalidation uses forward supersedes relationships.
 * No React, no Mol*, no Three.js.
 */

import type { EvidenceRecord, EvidenceId, CertificationState } from './types.js';
import { makeEvidenceId } from './types.js';
import { ok, err, Result } from '@mocs/render-contract';
import { computeScientificDigest, computeProvenanceDigest, computeLedgerChainDigest } from './hashing.js';

let _evidenceCounter = 0;
function nextEvidenceId(): EvidenceId {
  return makeEvidenceId(`ev:${Date.now()}:${++_evidenceCounter}`);
}

export type EvidenceDraft = Omit<
  EvidenceRecord,
  | 'evidenceId'
  | 'createdAt'
  | 'supersedes'
  | 'supersededBy'
  | 'scientificDigest'
  | 'provenanceDigest'
  | 'previousLedgerDigest'
  | 'ledgerDigest'
  | 'schemaVersion'
  | 'compilerVersion'
  | 'rendererVersion'
  | 'molstarVersion'
> & {
  supersedes?: EvidenceId | null;
  schemaVersion?: string;
  compilerVersion?: string;
  rendererVersion?: string;
  molstarVersion?: string;
};

export class EvidenceLedger {
  private readonly _records: Map<EvidenceId, EvidenceRecord> = new Map();

  /** Returns all records in insertion order. */
  get records(): readonly EvidenceRecord[] {
    return Array.from(this._records.values());
  }

  /** Returns record count. */
  get count(): number {
    return this._records.size;
  }

  /** Returns a record by ID. */
  get(id: EvidenceId): EvidenceRecord | undefined {
    return this._records.get(id);
  }

  /**
   * Appends a new evidence record cryptographically chained to the prior record.
   * Computes scientific, provenance, and hash chain digests before storing.
   */
  async append(draft: EvidenceDraft): Promise<Result<EvidenceRecord>> {
    try {
      const recordsList = Array.from(this._records.values());
      const previousRecord = recordsList.length > 0 ? recordsList[recordsList.length - 1] : null;
      const previousLedgerDigest = previousRecord ? previousRecord.ledgerDigest : null;

      const scientificDigest = await computeScientificDigest(draft);
      const provenanceDigest = await computeProvenanceDigest(scientificDigest, draft.verificationRecords);
      const ledgerDigest = await computeLedgerChainDigest(previousLedgerDigest, scientificDigest, provenanceDigest);

      const record: EvidenceRecord = {
        ...draft,
        schemaVersion: draft.schemaVersion ?? '2.0.0',
        compilerVersion: draft.compilerVersion ?? '2.0.0',
        rendererVersion: draft.rendererVersion ?? '2.0.0',
        molstarVersion: draft.molstarVersion ?? '5.11.0',
        evidenceId: nextEvidenceId(),
        createdAt: new Date().toISOString(),
        supersedes: draft.supersedes ?? null,
        supersededBy: null,
        scientificDigest,
        provenanceDigest,
        previousLedgerDigest,
        ledgerDigest,
      };

      this._records.set(record.evidenceId, record);
      return ok(record);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * Supersedes an existing record with a new one.
   * The old record is marked as superseded (never deleted).
   * Returns the new record.
   */
  async supersede(
    oldId: EvidenceId,
    invalidationReason: string,
    newDraft: EvidenceDraft
  ): Promise<Result<EvidenceRecord>> {
    const old = this._records.get(oldId);
    if (!old) {
      return err(new Error(`Cannot supersede unknown evidence record: ${oldId}`));
    }
    if (old.supersededBy !== null) {
      return err(new Error(`Evidence record ${oldId} is already superseded by ${old.supersededBy}`));
    }

    const newResult = await this.append({
      ...newDraft,
      supersedes: oldId,
      invalidationReason,
    });
    if (!newResult.ok) return newResult;

    // Mark old record as superseded (immutable update via replacement).
    const updatedOld: EvidenceRecord = { ...old, supersededBy: newResult.value.evidenceId };
    this._records.set(oldId, updatedOld);

    return ok(newResult.value);
  }

  /**
   * Returns only active (non-superseded) records.
   */
  get activeRecords(): readonly EvidenceRecord[] {
    return Array.from(this._records.values()).filter((r) => r.supersededBy === null);
  }

  /**
   * Advances the certification state of a record.
   */
  advanceCertification(
    id: EvidenceId,
    expectedCurrent: CertificationState,
    next: CertificationState
  ): Result<EvidenceRecord> {
    const record = this._records.get(id);
    if (!record) {
      return err(new Error(`Unknown evidence record: ${id}`));
    }
    if (record.certificationState !== expectedCurrent) {
      return err(new Error(`Cannot advance certification: expected state ${expectedCurrent}, got ${record.certificationState}`));
    }
    if (record.supersededBy !== null) {
      return err(new Error(`Cannot advance superseded record: ${id}`));
    }

    const updated: EvidenceRecord = { ...record, certificationState: next };
    this._records.set(id, updated);
    return ok(updated);
  }

  /**
   * Verifies the cryptographic hash chain and relational integrity of the entire ledger.
   * Detects any historical tampering or modifications.
   */
  async verifyLedgerIntegrity(): Promise<boolean> {
    const recordsList = Array.from(this._records.values());
    for (let i = 0; i < recordsList.length; i++) {
      const record = recordsList[i];
      const prevRecord = i > 0 ? recordsList[i - 1] : null;
      const expectedPrevDigest = prevRecord ? prevRecord.ledgerDigest : null;

      // 1. Verify hash chain link to previous record
      if (record.previousLedgerDigest !== expectedPrevDigest) {
        return false;
      }

      // 2. Verify scientific digest integrity
      const recomputedScientific = await computeScientificDigest(record);
      if (recomputedScientific !== record.scientificDigest) {
        return false;
      }

      // 3. Verify provenance digest integrity
      const recomputedProvenance = await computeProvenanceDigest(recomputedScientific, record.verificationRecords);
      if (recomputedProvenance !== record.provenanceDigest) {
        return false;
      }

      // 4. Verify ledger chain digest integrity
      const recomputedLedger = await computeLedgerChainDigest(
        expectedPrevDigest,
        recomputedScientific,
        recomputedProvenance
      );
      if (recomputedLedger !== record.ledgerDigest) {
        return false;
      }

      // 5. Verify relational supersedes integrity
      if (record.supersedes) {
        const superseded = this._records.get(record.supersedes);
        if (!superseded || superseded.supersededBy !== record.evidenceId) {
          return false;
        }
      }
    }
    return true;
  }
}
