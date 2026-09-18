/**
 * MOCS-Cert Molecular Sequence & Annotation Subsystem — Annotation Model & Registry
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: UniProtKB, SIFTS, wwPDB Annotation Ontology
 * 
 * Enforces:
 * 1. Strict provenance: every annotation is explicitly tagged (UNIPROT_REVIEWED, RCSB_DEPOSITED, etc.)
 * 2. Cross-chain highlight isolation: annotations on Chain A never bleed into Chain B or C.
 * 3. Residue key mapping: maps UniProt feature coordinates to exact canonical residue keys.
 */

import type {
  ResidueAnnotation,
  CanonicalResidueKey,
  UniProtEntry,
  SequenceAlignmentMapping,
  SequenceResidue,
  MutationType,
  AnnotationCategory,
} from './types';
import { buildCanonicalResidueKey } from './residueIdentity';

/**
 * Converts UniProt features into chain-specific, structure-mapped ResidueAnnotation records.
 */
export function generateAnnotationsFromUniProt(
  uniprot: UniProtEntry,
  structureId: string,
  modelId: number,
  entityId: string,
  chainId: string,
  mapping: SequenceAlignmentMapping,
  structureResidues: SequenceResidue[]
): ResidueAnnotation[] {
  const annotations: ResidueAnnotation[] = [];
  const authorToResMap = new Map<number, SequenceResidue>();
  for (const res of structureResidues) {
    authorToResMap.set(res.authorResNum, res);
  }

  for (let idx = 0; idx < uniprot.features.length; idx++) {
    const feat = uniprot.features[idx];
    const canonicalKeys: CanonicalResidueKey[] = [];
    let startAuthor = Number.MAX_SAFE_INTEGER;
    let endAuthor = Number.MIN_SAFE_INTEGER;

    for (let uPos = feat.begin; uPos <= feat.end; uPos++) {
      const authNum = mapping.uniprotToAuthor.get(uPos);
      if (authNum !== undefined) {
        const res = authorToResMap.get(authNum);
        if (res) {
          canonicalKeys.push(res.canonicalKey);
          if (authNum < startAuthor) startAuthor = authNum;
          if (authNum > endAuthor) endAuthor = authNum;
        }
      }
    }

    // Only include annotation if at least one residue in this chain matches
    if (canonicalKeys.length > 0) {
      annotations.push({
        annotationId: `${structureId}:${chainId}:${feat.type}:${feat.begin}_${feat.end}:${idx}`,
        category: feat.category,
        title: `${feat.type}: ${feat.description}`,
        description: feat.description,
        canonicalResidueKeys: canonicalKeys,
        entityId,
        chainId, // Strictly isolated to this chain
        seqRange: { start: feat.begin, end: feat.end },
        authorRange: { start: startAuthor, end: endAuthor },
        provenance: 'UNIPROT_REVIEWED',
        sourceDatabase: 'UniProt',
        accession: uniprot.accession,
        evidenceCode: feat.evidenceCode,
      });
    }
  }

  return annotations;
}

/**
 * Filters annotations strictly by chain ID, preventing cross-chain highlight leakage.
 */
export function filterAnnotationsByChain(
  annotations: ResidueAnnotation[],
  chainId: string
): ResidueAnnotation[] {
  const normChain = chainId.trim();
  return annotations.filter((a) => a.chainId === normChain);
}

/**
 * Filters annotations by functional category.
 */
export function filterAnnotationsByCategory(
  annotations: ResidueAnnotation[],
  category: AnnotationCategory
): ResidueAnnotation[] {
  return annotations.filter((a) => a.category === category);
}

/**
 * Finds all annotations that include a specific canonical residue key.
 */
export function getAnnotationsForResidue(
  annotations: ResidueAnnotation[],
  canonicalKey: CanonicalResidueKey
): ResidueAnnotation[] {
  return annotations.filter((a) => a.canonicalResidueKeys.includes(canonicalKey));
}

/**
 * Classifies the mutation type of a residue.
 */
export function classifyMutation(
  wtResName: string,
  obsResName: string,
  isEngineeredTagOrArtifact = false
): MutationType {
  const normWt = wtResName.trim().toUpperCase();
  const normObs = obsResName.trim().toUpperCase();

  if (isEngineeredTagOrArtifact) {
    return 'EXPRESSION_TAG';
  }

  if (normWt === normObs) {
    return 'WILD_TYPE';
  }

  return 'NATURAL_VARIANT';
}
