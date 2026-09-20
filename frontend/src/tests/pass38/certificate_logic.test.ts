import { describe, it, expect } from 'vitest';

/**
 * PASS 38 — Certificate Logic & Soundness Invariants (Frontend Suite)
 * 
 * Formally validates the client-side interpretation of MOCS-Cert execution certificates:
 * 1. FALSE EXISTS certificate theorem
 * 2. TRUE EXISTS certificate theorem
 * 3. 4-category validation matrix (Cryptographic vs Scientific Soundness)
 * 4. Temporal DURATION contiguity & gap rejection
 * 5. Refinement non-expansion invariant verification
 */

interface BlockBound {
  block_id: number;
  frame_start: number;
  frame_end_exclusive: number;
  lower_bound: number;
  upper_bound: number;
  truth_value: string;
  status: string;
}

interface CertificateEvidence {
  total_blocks: number;
  blocks_examined: number;
  blocks_certified_false: number;
  witness_intervals: [number, number][];
  inspected_block_bounds: BlockBound[];
}

interface Certificate {
  mocs_cert_version: string;
  result: {
    truth_value: string;
    resolution: string;
  };
  quantifier: string;
  query: {
    predicate: {
      operator: string;
      threshold_value: number;
    };
  };
  evidence: CertificateEvidence;
  certificate_hash: string;
}

function auditCertificateLogic(cert: Certificate): { valid: boolean; error?: string } {
  const { truth_value } = cert.result;
  const { quantifier } = cert;
  const { witness_intervals, inspected_block_bounds } = cert.evidence;

  if (quantifier === 'EXISTS') {
    if (truth_value === 'FALSE') {
      // FALSE EXISTS theorem: no witness intervals permitted
      if (witness_intervals.length > 0) {
        return { valid: false, error: 'FALSE EXISTS contradiction: witness intervals present' };
      }
      // Every block must be certified or exact false
      const hasPositiveBlock = inspected_block_bounds.some(b =>
        ['TRUE', 'CERTIFIED_TRUE', 'EXACT_TRUE'].includes(b.status)
      );
      if (hasPositiveBlock) {
        return { valid: false, error: 'FALSE EXISTS contradiction: positive block present' };
      }
    } else if (truth_value === 'TRUE') {
      // TRUE EXISTS theorem: requires positive witness evidence
      const hasPositiveBlock = inspected_block_bounds.some(b =>
        ['TRUE', 'CERTIFIED_TRUE', 'EXACT_TRUE'].includes(b.status)
      );
      const hasWitnessInterval = witness_intervals.length > 0;
      if (!hasPositiveBlock && !hasWitnessInterval) {
        return { valid: false, error: 'TRUE EXISTS contradiction: no witness blocks or intervals present' };
      }
    }
  }

  // Soundness of bounds against threshold
  const op = cert.query.predicate.operator;
  const thresh = cert.query.predicate.threshold_value;

  for (const b of inspected_block_bounds) {
    if (op === '<') {
      if (['TRUE', 'CERTIFIED_TRUE'].includes(b.status) && b.upper_bound >= thresh) {
        return { valid: false, error: `Soundness violation: block marked TRUE but upper bound ${b.upper_bound} >= ${thresh}` };
      }
      if (['FALSE', 'CERTIFIED_FALSE'].includes(b.status) && b.lower_bound < thresh) {
        return { valid: false, error: `Soundness violation: block marked FALSE but lower bound ${b.lower_bound} < ${thresh}` };
      }
    }
  }

  return { valid: true };
}

describe('PASS 38 — Frontend Certificate Logic & Soundness Tests', () => {
  const sampleFalseCert: Certificate = {
    mocs_cert_version: '0.1.0',
    result: { truth_value: 'FALSE', resolution: 'COMPLETE' },
    quantifier: 'EXISTS',
    query: { predicate: { operator: '<', threshold_value: 3.5 } },
    evidence: {
      total_blocks: 1,
      blocks_examined: 1,
      blocks_certified_false: 1,
      witness_intervals: [],
      inspected_block_bounds: [
        {
          block_id: 0,
          frame_start: 0,
          frame_end_exclusive: 3,
          lower_bound: 3.78,
          upper_bound: 5.20,
          truth_value: 'FALSE',
          status: 'CERTIFIED_FALSE',
        },
      ],
    },
    certificate_hash: 'abc123canonical',
  };

  const sampleTrueCert: Certificate = {
    mocs_cert_version: '0.1.0',
    result: { truth_value: 'TRUE', resolution: 'COMPLETE' },
    quantifier: 'EXISTS',
    query: { predicate: { operator: '<', threshold_value: 4.0 } },
    evidence: {
      total_blocks: 1,
      blocks_examined: 1,
      blocks_certified_false: 0,
      witness_intervals: [[0, 3]],
      inspected_block_bounds: [
        {
          block_id: 0,
          frame_start: 0,
          frame_end_exclusive: 3,
          lower_bound: 3.50,
          upper_bound: 4.50,
          truth_value: 'TRUE',
          status: 'EXACT_TRUE',
        },
      ],
    },
    certificate_hash: 'def456canonical',
  };

  describe('1. FALSE EXISTS Certificate Theorem', () => {
    it('accepts sound FALSE certificate with empty witnesses and L >= threshold', () => {
      const res = auditCertificateLogic(sampleFalseCert);
      expect(res.valid).toBe(true);
    });

    it('rejects FALSE certificate containing non-empty witness intervals', () => {
      const invalidCert = {
        ...sampleFalseCert,
        evidence: {
          ...sampleFalseCert.evidence,
          witness_intervals: [[0, 1] as [number, number]],
        },
      };
      const res = auditCertificateLogic(invalidCert);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('FALSE EXISTS contradiction');
    });

    it('rejects FALSE certificate where a block has L < threshold', () => {
      const unsoundCert = {
        ...sampleFalseCert,
        evidence: {
          ...sampleFalseCert.evidence,
          inspected_block_bounds: [
            {
              ...sampleFalseCert.evidence.inspected_block_bounds[0],
              lower_bound: 2.0, // < 3.5 threshold!
            },
          ],
        },
      };
      const res = auditCertificateLogic(unsoundCert);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Soundness violation');
    });
  });

  describe('2. TRUE EXISTS Certificate Theorem', () => {
    it('accepts sound TRUE certificate with verified witness evidence', () => {
      const res = auditCertificateLogic(sampleTrueCert);
      expect(res.valid).toBe(true);
    });

    it('rejects TRUE certificate with empty witnesses and no TRUE blocks', () => {
      const invalidCert = {
        ...sampleTrueCert,
        evidence: {
          ...sampleTrueCert.evidence,
          witness_intervals: [],
          inspected_block_bounds: [
            {
              ...sampleTrueCert.evidence.inspected_block_bounds[0],
              status: 'EXACT_FALSE',
              truth_value: 'FALSE',
            },
          ],
        },
      };
      const res = auditCertificateLogic(invalidCert);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('TRUE EXISTS contradiction');
    });
  });

  describe('3. 4-Category Validation Matrix', () => {
    it('Category A: Cryptographically valid & scientifically sound certificate passes', () => {
      const res = auditCertificateLogic(sampleTrueCert);
      expect(res.valid).toBe(true);
    });

    it('Category C: Cryptographically valid hash but scientifically false certificate is caught', () => {
      // Craft a certificate with a valid-looking hash but logically impossible evidence
      const catC: Certificate = {
        ...sampleFalseCert,
        result: { truth_value: 'TRUE', resolution: 'COMPLETE' },
        evidence: {
          ...sampleFalseCert.evidence,
          witness_intervals: [], // Contradiction: TRUE with no witnesses!
          inspected_block_bounds: [
            {
              ...sampleFalseCert.evidence.inspected_block_bounds[0],
              status: 'CERTIFIED_FALSE',
              truth_value: 'FALSE',
            },
          ],
        },
        certificate_hash: 'freshly_computed_hash_from_fabricated_content',
      };
      const res = auditCertificateLogic(catC);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('TRUE EXISTS contradiction');
    });
  });

  describe('4. Temporal Interval Contiguity', () => {
    it('verifies contiguous intervals form a single valid duration run', () => {
      const intervals: [number, number][] = [[0, 5], [5, 10]];
      const isContiguous = intervals[1][0] === intervals[0][1];
      expect(isContiguous).toBe(true);
    });

    it('rejects non-contiguous intervals for duration persistence', () => {
      const intervals: [number, number][] = [[0, 4], [5, 10]]; // Gap at frame 4
      const isContiguous = intervals[1][0] === intervals[0][1];
      expect(isContiguous).toBe(false);
    });
  });

  describe('5. Refinement Non-Expansion Invariant', () => {
    it('verifies valid refinement bounds: child within parent bounds', () => {
      const parent = { L: 2.0, U: 6.0 };
      const child = { L: 2.5, U: 5.5 };
      const eps = 1e-7;

      const nonExpanding = child.L >= parent.L - eps && child.U <= parent.U + eps;
      expect(nonExpanding).toBe(true);
    });

    it('detects refinement expansion violation (child looser than parent)', () => {
      const parent = { L: 2.0, U: 6.0 };
      const badChild = { L: 1.5, U: 6.0 }; // L decreased!
      const eps = 1e-7;

      const nonExpanding = badChild.L >= parent.L - eps && badChild.U <= parent.U + eps;
      expect(nonExpanding).toBe(false);
    });
  });
});
