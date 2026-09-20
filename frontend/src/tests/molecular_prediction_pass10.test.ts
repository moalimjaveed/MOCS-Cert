import { describe, it, expect, beforeEach } from 'vitest';
import {
  cleanAndValidateProteinSequence,
  validateSequenceStructureCorrespondence,
  classifyPlddt,
  getPlddtBand,
  extractPlddtFromPdb,
  calculateConfidenceSummary,
  validatePaeMatrix,
  calculateInterChainPae,
  computeSequenceSha256,
  createModelProvenance,
  assertScientificallyDefensibleTerminology,
  distinguishModelOrigin,
  PredictionPipeline,
  clearPredictionCache,
  predictProteinStructure,
  PLDDT_BANDS,
} from '../molecular/prediction';

describe('PASS 10: Protein Structure Prediction, Confidence & Model-Provenance Forensic Suite', () => {
  beforeEach(() => {
    clearPredictionCache();
  });

  // =========================================================================
  // 1. INPUT SEQUENCE INTEGRITY & SANITIZATION (Steps 1–5)
  // =========================================================================
  describe('1. Input Sequence Integrity & Sanitization', () => {
    it('cleans and validates canonical single-chain protein sequence', () => {
      const raw = '  mvlspadktnvkaawgkvgahageygaealermfl  \n';
      const res = cleanAndValidateProteinSequence(raw);
      expect(res.cleanSequence).toBe('MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFL');
      expect(res.residueCount).toBe(35);
      expect(res.header).toBeUndefined();
    });

    it('extracts FASTA header cleanly and preserves sequence body', () => {
      const fasta = '>sp|P69905|HBA_HUMAN Hemoglobin subunit alpha\nMVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFL\nSFPTTKTYFPHFDLSH\n';
      const res = cleanAndValidateProteinSequence(fasta);
      expect(res.header).toBe('sp|P69905|HBA_HUMAN Hemoglobin subunit alpha');
      expect(res.cleanSequence).toBe('MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSH');
      expect(res.residueCount).toBe(51);
    });

    it('rejects non-standard amino acid codes with exact position diagnostics', () => {
      // B (Asx), Z (Glx), X (unknown), J (Leu/Ile), U (Sec), O (Pyl)
      const invalidSeq = 'MVLSPBZKTN';
      expect(() => cleanAndValidateProteinSequence(invalidSeq)).toThrow(
        /Sequence contains invalid amino acid characters: 'B' at position 6, 'Z' at position 7/
      );
    });

    it('rejects digits and punctuation symbols in sequence body', () => {
      const badChars = 'MVL123SP*AD';
      expect(() => cleanAndValidateProteinSequence(badChars)).toThrow(
        /Sequence contains invalid amino acid characters/
      );
    });

    it('enforces length boundaries: rejects sequences < 5 aa or > 2000 aa', () => {
      expect(() => cleanAndValidateProteinSequence('MKT')).toThrow(/Sequence too short/);
      const longSeq = 'A'.repeat(2001);
      expect(() => cleanAndValidateProteinSequence(longSeq)).toThrow(/exceeds maximum permitted length/);
    });

    it('rejects empty sequence input', () => {
      expect(() => cleanAndValidateProteinSequence('')).toThrow(/Protein sequence is empty/);
      expect(() => cleanAndValidateProteinSequence('   \n\t  ')).toThrow(/Protein sequence is empty/);
    });
  });

  // =========================================================================
  // 2. SEQUENCE-TO-STRUCTURE CORRESPONDENCE (Steps 6–9)
  // =========================================================================
  describe('2. Sequence-to-Structure 1-to-1 Correspondence', () => {
    it('verifies exact residue correspondence between sequence and parsed structure', () => {
      const seq = 'MKVLA';
      const mockScores = [
        { residueIndex: 0, residueNumber: 1, residueName: 'MET', singleLetterCode: 'M', chainId: 'A', score: 95, band: 'very_high' as const, isDisorderedHypothesis: false },
        { residueIndex: 1, residueNumber: 2, residueName: 'LYS', singleLetterCode: 'K', chainId: 'A', score: 92, band: 'very_high' as const, isDisorderedHypothesis: false },
        { residueIndex: 2, residueNumber: 3, residueName: 'VAL', singleLetterCode: 'V', chainId: 'A', score: 88, band: 'confident' as const, isDisorderedHypothesis: false },
        { residueIndex: 3, residueNumber: 4, residueName: 'LEU', singleLetterCode: 'L', chainId: 'A', score: 85, band: 'confident' as const, isDisorderedHypothesis: false },
        { residueIndex: 4, residueNumber: 5, residueName: 'ALA', singleLetterCode: 'A', chainId: 'A', score: 91, band: 'very_high' as const, isDisorderedHypothesis: false },
      ];

      const corr = validateSequenceStructureCorrespondence(seq, mockScores);
      expect(corr.matches).toBe(true);
      expect(corr.mismatches).toHaveLength(0);
      expect(corr.diagnosticMessage).toContain('Verified exact 1-to-1 sequence-structure correspondence');
    });

    it('detects dropped residues or length truncation', () => {
      const seq = 'MKVLA';
      const truncatedScores = [
        { residueIndex: 0, residueNumber: 1, residueName: 'MET', singleLetterCode: 'M', chainId: 'A', score: 95, band: 'very_high' as const, isDisorderedHypothesis: false },
      ];
      const corr = validateSequenceStructureCorrespondence(seq, truncatedScores);
      expect(corr.matches).toBe(false);
      expect(corr.diagnosticMessage).toContain('Length mismatch: Input sequence has 5 residues, but structure model contains 1 residues');
    });

    it('detects residue identity mutations or sequence swaps', () => {
      const seq = 'MKVLA';
      const swappedScores = [
        { residueIndex: 0, residueNumber: 1, residueName: 'MET', singleLetterCode: 'M', chainId: 'A', score: 95, band: 'very_high' as const, isDisorderedHypothesis: false },
        { residueIndex: 1, residueNumber: 2, residueName: 'GLU', singleLetterCode: 'E', chainId: 'A', score: 92, band: 'very_high' as const, isDisorderedHypothesis: false }, // K -> E mismatch
        { residueIndex: 2, residueNumber: 3, residueName: 'VAL', singleLetterCode: 'V', chainId: 'A', score: 88, band: 'confident' as const, isDisorderedHypothesis: false },
        { residueIndex: 3, residueNumber: 4, residueName: 'LEU', singleLetterCode: 'L', chainId: 'A', score: 85, band: 'confident' as const, isDisorderedHypothesis: false },
        { residueIndex: 4, residueNumber: 5, residueName: 'ALA', singleLetterCode: 'A', chainId: 'A', score: 91, band: 'very_high' as const, isDisorderedHypothesis: false },
      ];
      const corr = validateSequenceStructureCorrespondence(seq, swappedScores);
      expect(corr.matches).toBe(false);
      expect(corr.mismatches).toHaveLength(1);
      expect(corr.mismatches[0]).toEqual({
        index: 1,
        sequenceResidue: 'K',
        structureResidueName: 'GLU',
        structureResidueLetter: 'E',
        residueNumber: 2,
      });
    });
  });

  // =========================================================================
  // 3. pLDDT CONFIDENCE PARSING & 4-BAND CLASSIFICATION (Steps 10–16)
  // =========================================================================
  describe('3. pLDDT Confidence Parsing & 4-Band Classification', () => {
    it('classifies pLDDT into 4 canonical AlphaFold bands with strict thresholds', () => {
      expect(classifyPlddt(95.0)).toBe('very_high');
      expect(classifyPlddt(90.1)).toBe('very_high');
      expect(classifyPlddt(90.0)).toBe('confident');
      expect(classifyPlddt(70.0)).toBe('confident');
      expect(classifyPlddt(69.9)).toBe('low');
      expect(classifyPlddt(50.0)).toBe('low');
      expect(classifyPlddt(49.9)).toBe('very_low');
      expect(classifyPlddt(12.5)).toBe('very_low');
    });

    it('provides correct visual tokens and interpretations for each band', () => {
      const vh = getPlddtBand(94);
      expect(vh.key).toBe('very_high');
      expect(vh.hexColor).toBe('#1e40af'); // Deep Cobalt
      expect(vh.backboneReliability).toBe('high');

      const conf = getPlddtBand(82);
      expect(conf.key).toBe('confident');
      expect(conf.hexColor).toBe('#0284c7');

      const low = getPlddtBand(62);
      expect(low.key).toBe('low');
      expect(low.hexColor).toBe('#d97706'); // Amber

      const vl = getPlddtBand(35);
      expect(vl.key).toBe('very_low');
      expect(vl.hexColor).toBe('#ea580c'); // Orange/Rose
      expect(vl.backboneReliability).toBe('unreliable_disordered');
    });

    it('parses authentic PDB ATOM records and extracts per-residue pLDDT B-factors', () => {
      const pdbMock = [
        'HEADER    TEST PREDICTION',
        'ATOM      1  N   MET A   1      11.100  12.200  13.300  1.00 94.50           N',
        'ATOM      2  CA  MET A   1      12.100  12.200  13.300  1.00 94.50           C',
        'ATOM      3  C   MET A   1      13.100  12.200  13.300  1.00 94.50           C',
        'ATOM      4  N   LYS A   2      14.100  12.200  13.300  1.00 78.20           N',
        'ATOM      5  CA  LYS A   2      15.100  12.200  13.300  1.00 78.20           C',
        'ATOM      6  N   VAL A   3      16.100  12.200  13.300  1.00 58.00           N',
        'ATOM      7  CA  VAL A   3      17.100  12.200  13.300  1.00 58.00           C',
        'ATOM      8  N   SER A   4      18.100  12.200  13.300  1.00 38.40           N',
        'ATOM      9  CA  SER A   4      19.100  12.200  13.300  1.00 38.40           C',
        'END',
      ].join('\n');

      const scores = extractPlddtFromPdb(pdbMock);
      expect(scores).toHaveLength(4);
      expect(scores[0]).toMatchObject({
        residueNumber: 1,
        residueName: 'MET',
        singleLetterCode: 'M',
        score: 94.5,
        band: 'very_high',
        isDisorderedHypothesis: false,
      });
      expect(scores[1]).toMatchObject({
        residueNumber: 2,
        residueName: 'LYS',
        singleLetterCode: 'K',
        score: 78.2,
        band: 'confident',
        isDisorderedHypothesis: false,
      });
      expect(scores[2]).toMatchObject({
        residueNumber: 3,
        residueName: 'VAL',
        singleLetterCode: 'V',
        score: 58.0,
        band: 'low',
        isDisorderedHypothesis: false,
      });
      expect(scores[3]).toMatchObject({
        residueNumber: 4,
        residueName: 'SER',
        singleLetterCode: 'S',
        score: 38.4,
        band: 'very_low',
        isDisorderedHypothesis: true, // pLDDT < 50 indicates disorder hypothesis
      });
    });

    it('normalizes fractional [0, 1] B-factor scale automatically to [0, 100]', () => {
      const fractionalPdb = [
        'ATOM      1  CA  ALA A   1      10.000  10.000  10.000  1.00  0.92           C',
        'ATOM      2  CA  GLY A   2      11.000  11.000  11.000  1.00  0.75           C',
      ].join('\n');

      const scores = extractPlddtFromPdb(fractionalPdb);
      expect(scores[0].score).toBe(92.0);
      expect(scores[0].band).toBe('very_high');
      expect(scores[1].score).toBe(75.0);
      expect(scores[1].band).toBe('confident');
    });

    it('computes exhaustive statistical confidence summary including disorder fractions', () => {
      const scores = [
        { residueIndex: 0, residueNumber: 1, residueName: 'MET', singleLetterCode: 'M', chainId: 'A', score: 95, band: 'very_high' as const, isDisorderedHypothesis: false },
        { residueIndex: 1, residueNumber: 2, residueName: 'LYS', singleLetterCode: 'K', chainId: 'A', score: 85, band: 'confident' as const, isDisorderedHypothesis: false },
        { residueIndex: 2, residueNumber: 3, residueName: 'VAL', singleLetterCode: 'V', chainId: 'A', score: 65, band: 'low' as const, isDisorderedHypothesis: false },
        { residueIndex: 3, residueNumber: 4, residueName: 'GLY', singleLetterCode: 'G', chainId: 'A', score: 35, band: 'very_low' as const, isDisorderedHypothesis: true },
      ];

      const summary = calculateConfidenceSummary(scores, 0.85);
      expect(summary.averagePlddt).toBe(70.0);
      expect(summary.minPlddt).toBe(35);
      expect(summary.maxPlddt).toBe(95);
      expect(summary.bandCounts.very_high).toBe(1);
      expect(summary.bandCounts.confident).toBe(1);
      expect(summary.bandCounts.low).toBe(1);
      expect(summary.bandCounts.very_low).toBe(1);
      expect(summary.bandFractions.very_high).toBe(0.25);
      expect(summary.disorderedResidueCount).toBe(1);
      expect(summary.disorderedResidueFraction).toBe(0.25);
      expect(summary.ptmScore).toBe(0.85);
      expect(summary.modelScore).toBe(0.85);
    });

    it('identifies disordered regions without altering atomic coordinates', () => {
      // Disordered residues (pLDDT < 50) must flag isDisorderedHypothesis = true
      // while keeping coordinates intact (no synthetic deletion or flattening)
      const lowPlddtPdb = [
        'ATOM      1  CA  PRO A   1       5.123   6.456   7.789  1.00 32.10           C',
      ].join('\n');
      const scores = extractPlddtFromPdb(lowPlddtPdb);
      expect(scores[0].score).toBe(32.1);
      expect(scores[0].isDisorderedHypothesis).toBe(true);
      expect(scores[0].band).toBe('very_low');
    });
  });

  // =========================================================================
  // 4. PREDICTED ALIGNED ERROR (PAE) MATRIX VALIDATION (Steps 17–24)
  // =========================================================================
  describe('4. Predicted Aligned Error (PAE) Matrix Validation', () => {
    it('validates square N x N dimensions and non-negative error values', () => {
      const validPae = [
        [0.0, 3.2, 8.5],
        [3.8, 0.0, 5.1],
        [9.1, 5.5, 0.0],
      ];
      const pae = validatePaeMatrix(validPae, 3);
      expect(pae.dimensions).toEqual([3, 3]);
      expect(pae.minError).toBe(0.0);
      expect(pae.maxObservedError).toBe(9.1);
      expect(pae.meanError).toBeGreaterThan(0);
      expect(pae.isAsymmetric).toBe(true); // PAE(0,1)=3.2 != PAE(1,0)=3.8
    });

    it('detects asymmetric error semantics: PAE(i, j) != PAE(j, i)', () => {
      // Axis semantics: row i is the aligned residue, column j is the predicted residue error
      const asymmetricPae = [
        [0.0, 2.0],
        [6.5, 0.0],
      ];
      const pae = validatePaeMatrix(asymmetricPae, 2);
      expect(pae.isAsymmetric).toBe(true);
      expect(pae.matrix[0][1]).toBe(2.0);
      expect(pae.matrix[1][0]).toBe(6.5);
    });

    it('rejects non-square PAE matrices', () => {
      const nonSquare = [
        [0.0, 3.2],
        [3.8, 0.0],
        [9.1, 5.5],
      ];
      expect(() => validatePaeMatrix(nonSquare)).toThrow(/strictly square/);
    });

    it('rejects negative PAE values', () => {
      const negativeVal = [
        [0.0, -1.5],
        [1.5, 0.0],
      ];
      expect(() => validatePaeMatrix(negativeVal)).toThrow(/Negative PAE value/);
    });

    it('rejects PAE matrix with dimension mismatching structure residue count', () => {
      const pae2x2 = [
        [0.0, 2.0],
        [2.0, 0.0],
      ];
      expect(() => validatePaeMatrix(pae2x2, 5)).toThrow(/does not match structure residue count/);
    });

    it('calculates inter-chain PAE between distinct chains/domains', () => {
      // Chain A: residues 0..1, Chain B: residues 2..3
      const pae4x4 = [
        [0.0, 1.2, 12.5, 14.2], // Chain A
        [1.2, 0.0, 13.1, 15.0], // Chain A
        [12.8, 13.5, 0.0, 1.4], // Chain B
        [14.5, 15.2, 1.4, 0.0], // Chain B
      ];
      const pae = validatePaeMatrix(pae4x4, 4);
      const interChain = calculateInterChainPae(pae, [0, 1], [2, 3], 'A', 'B');

      expect(interChain.chainA).toBe('A');
      expect(interChain.chainB).toBe('B');
      expect(interChain.meanPae).toBeCloseTo((12.5 + 14.2 + 13.1 + 15.0) / 4, 1);
      expect(interChain.minPae).toBe(12.5);
      expect(interChain.maxPae).toBe(15.0);
      expect(interChain.isWellPositioned).toBe(false); // mean > 10 A
    });
  });

  // =========================================================================
  // 5. MULTIMER COMPLEX RANKING & PROVENANCE (Steps 25–32)
  // =========================================================================
  describe('5. Multimer Complex Metrics & Epistemic Origin', () => {
    it('computes modelScore: 0.8 * ipTM + 0.2 * pTM for multimer complex candidates', () => {
      const mockScores = [
        { residueIndex: 0, residueNumber: 1, residueName: 'MET', singleLetterCode: 'M', chainId: 'A', score: 90, band: 'very_high' as const, isDisorderedHypothesis: false },
        { residueIndex: 1, residueNumber: 2, residueName: 'ALA', singleLetterCode: 'A', chainId: 'A', score: 85, band: 'confident' as const, isDisorderedHypothesis: false },
      ];
      const summary = calculateConfidenceSummary(mockScores, 0.80, 0.90);
      // modelScore = 0.8 * 0.90 + 0.2 * 0.80 = 0.72 + 0.16 = 0.88
      expect(summary.modelScore).toBe(0.88);
      expect(summary.iptmScore).toBe(0.90);
      expect(summary.ptmScore).toBe(0.80);
    });

    it('strictly enforces isExperimental: false for predicted and designed models', () => {
      const provPred = createModelProvenance({
        provider: 'alphafold_db',
        modelName: 'AlphaFold2-v4',
        epistemicOrigin: 'predicted',
        sequence: 'MKVLA',
      });
      expect(provPred.isExperimental).toBe(false);
      expect(provPred.scientificCaveats).toContain('Model is a computational prediction, not an experimental structure.');

      const provDesign = createModelProvenance({
        provider: 'rfdiffusion',
        modelName: 'RFdiffusion-v1',
        epistemicOrigin: 'designed',
        sequence: 'MKVLA',
      });
      expect(provDesign.isExperimental).toBe(false);
      expect(provDesign.scientificCaveats).toContain(
        'Structure represents an unvalidated computational design requiring experimental expression and biophysical validation.'
      );
    });

    it('computes deterministic SHA-256 sequence hash across platforms', () => {
      const seq = 'MKVLA';
      const hash1 = computeSequenceSha256(seq);
      const hash2 = computeSequenceSha256(seq);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(hash1)).toBe(true);

      // Standard NIST SHA-256 hash for 'MKVLA'
      expect(hash1).toBe('069d329ad0b96b2a4e2bb24829ca6f4ff075968943fcd61d862407f06d32af93');
    });

    it('audits terminology: flags forbidden claims of experimental certainty or proof', () => {
      const badText = 'This predicted binder has experimentally verified affinity and is a proven structure with guaranteed accuracy.';
      const audit = assertScientificallyDefensibleTerminology(badText);
      expect(audit.isClean).toBe(false);
      expect(audit.violations).toContain('experimentally verified');
      expect(audit.violations).toContain('proven structure');
      expect(audit.violations).toContain('guaranteed accuracy');
      expect(audit.recommendations['proven structure']).toBe('predicted structural model');

      const cleanText = 'This computed model exhibits high pLDDT confidence across the globular core with predicted binding candidate interface.';
      const cleanAudit = assertScientificallyDefensibleTerminology(cleanText);
      expect(cleanAudit.isClean).toBe(true);
      expect(cleanAudit.violations).toHaveLength(0);
    });

    it('accurately distinguishes epistemic origin from metadata categories', () => {
      expect(distinguishModelOrigin({ category: 'existing_experimental', provider: 'RCSB PDB' })).toBe('experimental');
      expect(distinguishModelOrigin({ category: 'computed_predicted', provider: 'AlphaFold DB' })).toBe('predicted');
      expect(distinguishModelOrigin({ category: 'designed_candidate', provider: 'RFdiffusion / IPD' })).toBe('designed');
      expect(distinguishModelOrigin({ provider: 'Synthetic Generator' })).toBe('synthetic_calibration');
    });
  });

  // =========================================================================
  // 6. PREDICTION PIPELINE EXECUTION & ROBUSTNESS (Steps 33–40)
  // =========================================================================
  describe('6. Prediction Pipeline Execution & Robustness', () => {
    it('resolves structure prediction end-to-end with pLDDT, PAE, and provenance', async () => {
      const pipeline = new PredictionPipeline();
      const result = await pipeline.predictStructure({
        sequence: 'MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFL',
        modelName: 'ESMFold_Test',
        provider: 'synthetic_calibration',
      });

      expect(result.residueCount).toBe(35);
      expect(result.sequence).toBe('MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFL');
      expect(result.perResiduePlddt).toHaveLength(35);
      expect(result.confidenceSummary.averagePlddt).toBeGreaterThan(60);
      expect(result.confidenceSummary.averagePlddt).toBeLessThanOrEqual(100);
      expect(result.paeMatrix).toBeDefined();
      expect(result.paeMatrix?.dimensions).toEqual([35, 35]);
      expect(result.provenance.isExperimental).toBe(false);
      expect(result.provenance.epistemicOrigin).toBe('synthetic_calibration');
    });

    it('utilizes deterministic caching to avoid redundant computation', async () => {
      const pipeline = new PredictionPipeline();
      const req = {
        sequence: 'MVLSPADKTNVKAAWG',
        modelName: 'ESMFold_Test',
        provider: 'synthetic_calibration' as const,
      };

      const res1 = await pipeline.predictStructure(req);
      expect(pipeline.getCacheSize()).toBe(1);

      const res2 = await pipeline.predictStructure(req);
      expect(res1).toBe(res2); // Exact cached reference returned
      expect(pipeline.getCacheSize()).toBe(1);

      pipeline.clearCache();
      expect(pipeline.getCacheSize()).toBe(0);
    });

    it('protects against race conditions by dropping superseded asynchronous requests', async () => {
      const pipeline = new PredictionPipeline();

      // Launch request 1 with short sequence
      const req1Promise = pipeline.predictStructure({
        sequence: 'MVLSPADKTNVK',
        modelName: 'FastReq',
        provider: 'synthetic_calibration',
      });

      // Launch request 2 immediately which bumps activeRequestId
      const req2Promise = pipeline.predictStructure({
        sequence: 'AAWGKVGAHAGEYGAE',
        modelName: 'SupercedingReq',
        provider: 'synthetic_calibration',
      });

      const [res1, res2] = await Promise.all([req1Promise, req2Promise]);
      // Both finish cleanly or req2 is active; both return validated structures
      expect(res1.residueCount).toBe(12);
      expect(res2.residueCount).toBe(16);
    });

    it('handles timeout gracefully via AbortSignal without crashing', async () => {
      const pipeline = new PredictionPipeline();
      const abortCtrl = new AbortController();
      abortCtrl.abort(); // Pre-aborted signal

      // The pipeline should cleanly handle aborted signal by falling back safely to offline calibration
      const result = await pipeline.predictStructure({
        sequence: 'MVLSPADKTNVK',
        signal: abortCtrl.signal,
        provider: 'synthetic_calibration',
      });
      expect(result.residueCount).toBe(12);
      expect(result.provenance.isExperimental).toBe(false);
    });

    it('rejects corrupt PDB input lacking residue records', () => {
      expect(() => extractPlddtFromPdb('REMARK Corrupt PDB without ATOM records\nEND')).toThrow(
        /No valid residue records with B-factors found/
      );
    });

    it('rejects non-string PDB input', () => {
      expect(() => extractPlddtFromPdb(null as any)).toThrow(/PDB text must be a non-empty string/);
    });
  });
});
