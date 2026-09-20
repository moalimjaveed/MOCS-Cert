/**
 * MOCS-Cert PASS 15 Forensic Test Suite:
 * Molecular Sequence, Structure Sequence, Residue Identity, UniProt/RCSB Mapping,
 * Entity/Chain Mapping, Observed vs Canonical Sequence, Mutations, PTMs, and Provenance.
 */

import { describe, it, expect } from 'vitest';
import {
  buildCanonicalResidueKey,
  parseCanonicalResidueKey,
  compareResiduesByAuthorNumber,
  formatResidueDisplay,
  isModifiedResidue,
  getParentResidueName,
  MODIFIED_RESIDUE_PARENTS,
  BENCHMARK_ENTITIES,
  getEntitiesForStructure,
  getEntityForChain,
  getChainsForEntity,
  isHomomer,
  isHeteromer,
  alignCanonicalToStructureSequence,
  translateUniprotPosToAuthor,
  translateAuthorPosToUniprot,
  isValidUniProtAccession,
  getOfflineUniProtEntry,
  fetchUniProtEntry,
  generateAnnotationsFromUniProt,
  filterAnnotationsByChain,
  filterAnnotationsByCategory,
  getAnnotationsForResidue,
  classifyMutation,
  isDeoxyribonucleotide,
  isRibonucleotide,
  isNucleicAcid,
  getNucleic1LetterCode,
  getWatsonCrickComplement,
  generateReverseComplement,
  validateNucleicSequence,
  SequenceCache,
  sequenceCache,
} from '../molecular/sequence';
import type { SequenceResidue } from '../molecular/sequence';

describe('PASS 15 — Molecular Sequence, Entity Mapping & Annotation Provenance', () => {

  // 1. Canonical Residue Key & Insertion Code Sorting
  describe('1. Canonical Residue Key & Insertion Code Sorting', () => {
    it('builds and parses canonical residue keys correctly', () => {
      const key = buildCanonicalResidueKey('4HHB', 1, '1', 'A', 'VAL', 1);
      expect(key).toBe('4HHB:1:1:A:VAL:1');

      const parsed = parseCanonicalResidueKey(key);
      expect(parsed.structureId).toBe('4HHB');
      expect(parsed.modelId).toBe(1);
      expect(parsed.entityId).toBe('1');
      expect(parsed.chainId).toBe('A');
      expect(parsed.residueName).toBe('VAL');
      expect(parsed.authorResNum).toBe(1);
      expect(parsed.insertionCode).toBeUndefined();
    });

    it('correctly handles insertion codes in canonical keys', () => {
      const keyWithIns = buildCanonicalResidueKey('1TUP', 1, '1', 'A', 'ARG', 100, 'A');
      expect(keyWithIns).toBe('1TUP:1:1:A:ARG:100:A');

      const parsed = parseCanonicalResidueKey(keyWithIns);
      expect(parsed.authorResNum).toBe(100);
      expect(parsed.insertionCode).toBe('A');
    });

    it('sorts residues strictly by author number and insertion code', () => {
      const residues = [
        { authorResNum: 101 },
        { authorResNum: 100, insertionCode: 'B' },
        { authorResNum: 99 },
        { authorResNum: 100, insertionCode: 'A' },
        { authorResNum: 100 },
        { authorResNum: -2 },
        { authorResNum: 0 },
      ];

      residues.sort(compareResiduesByAuthorNumber);

      expect(residues.map((r) => `${r.authorResNum}${r.insertionCode || ''}`)).toEqual([
        '-2',
        '0',
        '99',
        '100',
        '100A',
        '100B',
        '101',
      ]);
    });

    it('formats residue display labels across all supported styles', () => {
      const res = {
        resName: 'HIS',
        authorResNum: 87,
        authAsymId: 'A',
        code1: 'H',
      };

      expect(formatResidueDisplay(res, 'compact')).toBe('H87');
      expect(formatResidueDisplay(res, 'author')).toBe('A:87');
      expect(formatResidueDisplay(res, 'standard')).toBe('HIS87:A');
      expect(formatResidueDisplay(res, 'full')).toBe('HIS 87 (Chain A)');

      const resIns = {
        resName: 'LYS',
        authorResNum: 100,
        insertionCode: 'B',
        authAsymId: 'B',
        code1: 'K',
      };
      expect(formatResidueDisplay(resIns, 'compact')).toBe('K100B');
      expect(formatResidueDisplay(resIns, 'standard')).toBe('LYS100B:B');
    });
  });

  // 2. Entity vs Chain Instance Mapping
  describe('2. Entity vs Chain Instance Mapping', () => {
    it('resolves 4HHB as heterotetramer (alpha2 beta2) with 2 polymer entities and 4 chains', () => {
      const entities = getEntitiesForStructure('4HHB');
      expect(entities.length).toBe(4);

      // Entity 1: alpha-globin (Chains A and C)
      const ent1 = getEntityForChain('4HHB', 'A');
      expect(ent1).toBeDefined();
      expect(ent1?.entityId).toBe('1');
      expect(ent1?.uniprotAccession).toBe('P69905');
      expect(ent1?.chainIds).toEqual(['A', 'C']);
      expect(ent1?.stoichiometry).toBe(2);
      expect(ent1?.sequenceLength).toBe(141);

      // Entity 2: beta-globin (Chains B and D)
      const ent2 = getEntityForChain('4HHB', 'B');
      expect(ent2).toBeDefined();
      expect(ent2?.entityId).toBe('2');
      expect(ent2?.uniprotAccession).toBe('P68871');
      expect(ent2?.chainIds).toEqual(['B', 'D']);
      expect(ent2?.stoichiometry).toBe(2);
      expect(ent2?.sequenceLength).toBe(146);

      // Chains for entity query
      expect(getChainsForEntity('4HHB', '1')).toEqual(['A', 'C']);
      expect(getChainsForEntity('4HHB', '2')).toEqual(['B', 'D']);

      // Complex classification
      expect(isHeteromer('4HHB')).toBe(true);
      expect(isHomomer('4HHB')).toBe(false);
    });

    it('resolves 1BNA duplex with 2 distinct polymer DNA strands', () => {
      const entities = getEntitiesForStructure('1BNA');
      expect(entities.length).toBe(2);

      const entA = getEntityForChain('1BNA', 'A');
      const entB = getEntityForChain('1BNA', 'B');

      expect(entA?.entityId).toBe('1');
      expect(entB?.entityId).toBe('2');
      expect(entA?.canonicalSequence).toBe('CGCGAATTCGCG');
      expect(entB?.canonicalSequence).toBe('CGCGAATTCGCG');
      expect(entA?.polymerType).toBe('polydeoxyribonucleotide');
    });

    it('resolves 1TUP p53-DNA complex with protein chains A, B, C and DNA strands D, E', () => {
      const p53Entity = getEntityForChain('1TUP', 'A');
      expect(p53Entity?.uniprotAccession).toBe('P04637');
      expect(p53Entity?.chainIds).toEqual(['A', 'B', 'C']);
      expect(p53Entity?.stoichiometry).toBe(3);

      const dnaStrandD = getEntityForChain('1TUP', 'D');
      expect(dnaStrandD?.entityId).toBe('2');
      expect(dnaStrandD?.polymerType).toBe('polydeoxyribonucleotide');
    });
  });

  // 3. Author Numbering vs Sequence Index & Missing Residues
  describe('3. Author Numbering, Gaps & Missing Residue Preservation', () => {
    it('preserves missing loop residues without fabricating coordinates', () => {
      // Create a mock chain with 10 residues where residues 4-6 are unresolved (missing density)
      const mockResidues: SequenceResidue[] = [];
      const aaCodes = ['V', 'L', 'S', 'P', 'A', 'D', 'K', 'T', 'N', 'V'];
      const aa3 = ['VAL', 'LEU', 'SER', 'PRO', 'ALA', 'ASP', 'LYS', 'THR', 'ASN', 'VAL'];

      for (let i = 0; i < 10; i++) {
        const hasCoords = i < 3 || i > 5; // Residues 3, 4, 5 (author 4, 5, 6) missing
        mockResidues.push({
          index: i,
          seqResNum: i + 1,
          authorResNum: i + 1,
          labelAsymId: 'A',
          authAsymId: 'A',
          entityId: '1',
          resName: aa3[i],
          code1: aaCodes[i],
          hasCoordinates: hasCoords,
          isModified: false,
          mutationType: 'WILD_TYPE',
          missingReason: hasCoords ? 'NOT_APPLICABLE' : 'UNRESOLVED_DENSITY',
          canonicalKey: buildCanonicalResidueKey('TEST', 1, '1', 'A', aa3[i], i + 1),
        });
      }

      const alignment = alignCanonicalToStructureSequence('VLSPADKTNV', mockResidues);

      expect(alignment.alignedCount).toBe(10);
      expect(alignment.identityFraction).toBe(1.0);
      expect(alignment.missingSegments.length).toBe(1);
      expect(alignment.missingSegments[0]).toEqual({
        startAuthor: 4,
        endAuthor: 6,
        length: 3,
        reason: 'UNRESOLVED_DENSITY',
      });

      // Crucial: missing residues remain in sequence array!
      expect(mockResidues.length).toBe(10);
      expect(mockResidues[3].hasCoordinates).toBe(false);
      expect(mockResidues[3].authorResNum).toBe(4);
    });

    it('correctly classifies terminal disorder when N- or C-terminal residues lack density', () => {
      const mockResidues: SequenceResidue[] = [
        {
          index: 0,
          seqResNum: 1,
          authorResNum: 1,
          labelAsymId: 'A',
          authAsymId: 'A',
          entityId: '1',
          resName: 'MET',
          code1: 'M',
          hasCoordinates: false,
          isModified: false,
          mutationType: 'WILD_TYPE',
          missingReason: 'TERMINAL_FLEXIBILITY',
          canonicalKey: 'TEST:1:1:A:MET:1',
        },
        {
          index: 1,
          seqResNum: 2,
          authorResNum: 2,
          labelAsymId: 'A',
          authAsymId: 'A',
          entityId: '1',
          resName: 'VAL',
          code1: 'V',
          hasCoordinates: true,
          isModified: false,
          mutationType: 'WILD_TYPE',
          missingReason: 'NOT_APPLICABLE',
          canonicalKey: 'TEST:1:1:A:VAL:2',
        },
      ];

      const alignment = alignCanonicalToStructureSequence('MV', mockResidues);
      expect(alignment.missingSegments.length).toBe(1);
      expect(alignment.missingSegments[0].reason).toBe('TERMINAL_FLEXIBILITY');
    });
  });

  // 4. Sequence-to-Structure Alignment & Initiator Met Cleavage
  describe('4. Sequence-to-Structure Alignment & Initiator Met Cleavage', () => {
    it('correctly maps 4HHB alpha-globin: detects initiator Met cleavage and maps proximal His88 -> author His87', () => {
      const uniprotAlpha = getOfflineUniProtEntry('P69905')!;
      expect(uniprotAlpha).toBeDefined();
      expect(uniprotAlpha.sequence.startsWith('MVLSPAD')).toBe(true);

      // In 4HHB, chain A sequence starts with Val (initiator Met cleaved)
      const entA = getEntityForChain('4HHB', 'A')!;
      const canonMature = entA.canonicalSequence;
      expect(canonMature.startsWith('VLSPAD')).toBe(true);

      // Construct mock sequence residues for 4HHB chain A (author 1 to 141)
      const residues: SequenceResidue[] = [];
      for (let i = 0; i < canonMature.length; i++) {
        const code1 = canonMature[i];
        residues.push({
          index: i,
          seqResNum: i + 1,
          authorResNum: i + 1,
          labelAsymId: 'A',
          authAsymId: 'A',
          entityId: '1',
          resName: code1 === 'V' ? 'VAL' : (code1 === 'H' ? 'HIS' : 'ALA'),
          code1,
          hasCoordinates: true,
          isModified: false,
          mutationType: 'WILD_TYPE',
          missingReason: 'NOT_APPLICABLE',
          canonicalKey: buildCanonicalResidueKey('4HHB', 1, '1', 'A', code1 === 'H' ? 'HIS' : 'RES', i + 1),
        });
      }

      const alignment = alignCanonicalToStructureSequence(uniprotAlpha.sequence, residues);

      expect(alignment.initiatorMethionineCleaved).toBe(true);
      expect(alignment.alignedCount).toBe(141);

      // UniProt pos 1 (Met) is cleaved, not in author sequence
      expect(translateUniprotPosToAuthor(alignment, 1)).toBeUndefined();

      // UniProt pos 2 (Val) maps to author residue 1
      expect(translateUniprotPosToAuthor(alignment, 2)).toBe(1);
      expect(translateAuthorPosToUniprot(alignment, 1)).toBe(2);

      // Proximal His: UniProt pos 88 maps to author residue 87
      expect(translateUniprotPosToAuthor(alignment, 88)).toBe(87);
      expect(translateAuthorPosToUniprot(alignment, 87)).toBe(88);

      // Distal His: UniProt pos 59 maps to author residue 58
      expect(translateUniprotPosToAuthor(alignment, 59)).toBe(58);
      expect(translateAuthorPosToUniprot(alignment, 58)).toBe(59);
    });

    it('correctly maps 4HHB beta-globin: maps Sickle Cell variant Glu7 -> author Glu6, proximal His93 -> author His92', () => {
      const uniprotBeta = getOfflineUniProtEntry('P68871')!;
      expect(uniprotBeta.sequence.startsWith('MVHLTPE')).toBe(true);

      const entB = getEntityForChain('4HHB', 'B')!;
      const canonMature = entB.canonicalSequence;

      const residues: SequenceResidue[] = [];
      for (let i = 0; i < canonMature.length; i++) {
        const code1 = canonMature[i];
        residues.push({
          index: i,
          seqResNum: i + 1,
          authorResNum: i + 1,
          labelAsymId: 'B',
          authAsymId: 'B',
          entityId: '2',
          resName: 'RES',
          code1,
          hasCoordinates: true,
          isModified: false,
          mutationType: 'WILD_TYPE',
          missingReason: 'NOT_APPLICABLE',
          canonicalKey: buildCanonicalResidueKey('4HHB', 1, '2', 'B', 'RES', i + 1),
        });
      }

      const alignment = alignCanonicalToStructureSequence(uniprotBeta.sequence, residues);
      expect(alignment.initiatorMethionineCleaved).toBe(true);

      // HbS Sickle Cell Mutation: UniProt position 7 maps to author residue 6
      expect(translateUniprotPosToAuthor(alignment, 7)).toBe(6);
      expect(translateAuthorPosToUniprot(alignment, 6)).toBe(7);

      // Proximal His: UniProt position 93 maps to author residue 92
      expect(translateUniprotPosToAuthor(alignment, 93)).toBe(92);
      expect(translateAuthorPosToUniprot(alignment, 92)).toBe(93);
    });
  });

  // 5. UniProt Accession Syntax & Offline Cache
  describe('5. UniProt Accession Syntax & Offline Cache', () => {
    it('strictly validates standard UniProtKB accession format', () => {
      // Valid Swiss-Prot / TrEMBL accessions
      expect(isValidUniProtAccession('P69905')).toBe(true);
      expect(isValidUniProtAccession('P68871')).toBe(true);
      expect(isValidUniProtAccession('P04637')).toBe(true);
      expect(isValidUniProtAccession('Q9Y6K1')).toBe(true);
      expect(isValidUniProtAccession('A0A024RBG1')).toBe(true);

      // Invalid accessions
      expect(isValidUniProtAccession('')).toBe(false);
      expect(isValidUniProtAccession('XYZ')).toBe(false);
      expect(isValidUniProtAccession('12345')).toBe(false);
      expect(isValidUniProtAccession('P699051234567')).toBe(false);
      expect(isValidUniProtAccession('4HHB')).toBe(false); // PDB ID, not UniProt accession
    });

    it('retrieves offline benchmark records with full metadata', async () => {
      const p53 = await fetchUniProtEntry('P04637');
      expect(p53.accession).toBe('P04637');
      expect(p53.id).toBe('P53_HUMAN');
      expect(p53.isReviewed).toBe(true);
      expect(p53.features.length).toBeGreaterThan(5);

      // Verify zinc finger coordination features exist
      const zincFeats = p53.features.filter((f) => f.category === 'METAL_BINDING');
      expect(zincFeats.length).toBe(4);
    });
  });

  // 6. Residue Annotations & Cross-Chain Isolation
  describe('6. Residue Annotations & Strict Cross-Chain Isolation', () => {
    it('maps UniProt features to exact canonical residue keys on Chain A', () => {
      const uniprotAlpha = getOfflineUniProtEntry('P69905')!;
      const canonAlpha = BENCHMARK_ENTITIES['4HHB'][0].canonicalSequence;

      const residuesA: SequenceResidue[] = [];
      for (let i = 0; i < canonAlpha.length; i++) {
        const code1 = canonAlpha[i];
        residuesA.push({
          index: i,
          seqResNum: i + 1,
          authorResNum: i + 1,
          labelAsymId: 'A',
          authAsymId: 'A',
          entityId: '1',
          resName: code1 === 'H' ? 'HIS' : 'ALA',
          code1,
          hasCoordinates: true,
          isModified: false,
          mutationType: 'WILD_TYPE',
          missingReason: 'NOT_APPLICABLE',
          canonicalKey: buildCanonicalResidueKey('4HHB', 1, '1', 'A', code1 === 'H' ? 'HIS' : 'ALA', i + 1),
        });
      }

      const alignment = alignCanonicalToStructureSequence(uniprotAlpha.sequence, residuesA);
      const annotationsA = generateAnnotationsFromUniProt(
        uniprotAlpha,
        '4HHB',
        1,
        '1',
        'A',
        alignment,
        residuesA
      );

      expect(annotationsA.length).toBeGreaterThan(0);

      // Verify proximal heme binding site is correctly mapped to author residue 87
      const hemeSite = annotationsA.find((a) => a.category === 'BINDING_SITE');
      expect(hemeSite).toBeDefined();
      expect(hemeSite?.authorRange).toEqual({ start: 87, end: 87 });
      expect(hemeSite?.canonicalResidueKeys).toEqual(['4HHB:1:1:A:HIS:87']);
      expect(hemeSite?.provenance).toBe('UNIPROT_REVIEWED');

      // STRICT ISOLATION: Annotations for Chain A must never return for Chain B
      const chainBMatches = filterAnnotationsByChain(annotationsA, 'B');
      expect(chainBMatches.length).toBe(0);

      const chainAMatches = filterAnnotationsByChain(annotationsA, 'A');
      expect(chainAMatches.length).toBe(annotationsA.length);
    });

    it('correctly maps modified residues and PTM parents', () => {
      expect(isModifiedResidue('MSE')).toBe(true);
      expect(getParentResidueName('MSE')).toBe('MET');

      expect(isModifiedResidue('SEP')).toBe(true);
      expect(getParentResidueName('SEP')).toBe('SER');

      expect(isModifiedResidue('TPO')).toBe(true);
      expect(getParentResidueName('TPO')).toBe('THR');

      expect(isModifiedResidue('PTR')).toBe(true);
      expect(getParentResidueName('PTR')).toBe('TYR');

      expect(isModifiedResidue('ALA')).toBe(false);
      expect(getParentResidueName('ALA')).toBe('ALA');
    });

    it('classifies mutations, expression tags, and wild type residues', () => {
      expect(classifyMutation('GLU', 'GLU')).toBe('WILD_TYPE');
      expect(classifyMutation('GLU', 'VAL')).toBe('NATURAL_VARIANT');
      expect(classifyMutation('HIS', 'HIS', true)).toBe('EXPRESSION_TAG');
    });
  });

  // 7. Nucleic Acid Sequence Semantics & Strand Independence
  describe('7. Nucleic Acid Sequence Semantics & Strand Independence', () => {
    it('validates 1BNA 5 to 3 sequence directionality and Watson-Crick reverse complement', () => {
      const strandA = 'CGCGAATTCGCG';
      const reverseComp = generateReverseComplement(strandA);

      // Palindromic EcoRI recognition sequence: reverse complement is identical
      expect(reverseComp).toBe('CGCGAATTCGCG');

      // Non-palindromic sequence
      const nonPal = 'ATGC';
      expect(generateReverseComplement(nonPal)).toBe('GCAT');
    });

    it('accurately differentiates deoxyribonucleotides and ribonucleotides', () => {
      expect(isDeoxyribonucleotide('DA')).toBe(true);
      expect(isDeoxyribonucleotide('DC')).toBe(true);
      expect(isDeoxyribonucleotide('A')).toBe(false);

      expect(isRibonucleotide('A')).toBe(true);
      expect(isRibonucleotide('U')).toBe(true);
      expect(isRibonucleotide('DA')).toBe(false);

      // Modified base 5MC (5-methylcytosine)
      expect(isNucleicAcid('5MC')).toBe(true);
      expect(getNucleic1LetterCode('5MC')).toBe('C');
    });

    it('validates nucleic sequence strings strictly', () => {
      expect(validateNucleicSequence('CGCGAATTCGCG', 'DNA').isValid).toBe(true);
      expect(validateNucleicSequence('CGCGAATUCGCG', 'DNA').isValid).toBe(false); // Uracil in DNA
      expect(validateNucleicSequence('AUCGAUCG', 'RNA').isValid).toBe(true);
      expect(validateNucleicSequence('ATCGAUCG', 'RNA').isValid).toBe(false); // Thymine in RNA
      expect(validateNucleicSequence('').isValid).toBe(false); // Empty sequence
    });
  });

  // 8. Sequence Cache & Monotonic Race Invalidation
  describe('8. Sequence Cache & Monotonic Race Invalidation', () => {
    it('manages cache keys and enforces monotonic cancellation tokens', () => {
      const cache = new SequenceCache(3);

      const token1 = cache.nextSequence();
      const token2 = cache.nextSequence();

      expect(token2).toBeGreaterThan(token1);
      expect(cache.isCurrentSequence(token1)).toBe(false); // Stale!
      expect(cache.isCurrentSequence(token2)).toBe(true);  // Active!

      const key = cache.buildKey('4HHB', 1, '1', 'A');
      expect(key).toBe('4HHB::model:1::entity:1::chain:A');
    });

    it('evicts oldest entries when cache exceeds capacity', () => {
      const cache = new SequenceCache(2);
      const mockRecord = (chain: string) => ({
        structureId: 'TEST',
        modelId: 1,
        chainId: chain,
        entityId: '1',
        canonicalSequence: 'A',
        depositedSequence: 'A',
        observedSequence: 'A',
        residues: [],
        mapping: {} as any,
        annotations: [],
        stats: {
          totalResidues: 1,
          observedResidues: 1,
          missingResidues: 0,
          modifiedResidues: 0,
          mutationCount: 0,
          percentObserved: 100,
        },
      });

      const keyA = cache.buildKey('TEST', 1, '1', 'A');
      const keyB = cache.buildKey('TEST', 1, '1', 'B');
      const keyC = cache.buildKey('TEST', 1, '1', 'C');

      cache.set(keyA, mockRecord('A'));
      cache.set(keyB, mockRecord('B'));
      expect(cache.size).toBe(2);
      expect(cache.has(keyA)).toBe(true);

      // Inserting third entry should evict keyA
      cache.set(keyC, mockRecord('C'));
      expect(cache.size).toBe(2);
      expect(cache.has(keyA)).toBe(false);
      expect(cache.has(keyB)).toBe(true);
      expect(cache.has(keyC)).toBe(true);
    });
  });
});
