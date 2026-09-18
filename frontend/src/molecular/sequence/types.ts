/**
 * MOCS-Cert Molecular Sequence & Annotation Subsystem — Types
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: wwPDB mmCIF Entity Poly / Coordinate Mapping, UniProtKB, CCD
 */

export type CanonicalResidueKey = string; // format: `${structureId}:${modelId}:${entityId}:${chainId}:${residueName}:${authorResNum}${insCode ? ':' + insCode : ''}`

export type SequenceType = 
  | 'CANONICAL_UNIPROT'
  | 'DEPOSITED_POLYMER'
  | 'OBSERVED_COORDINATES'
  | 'SYNTHETIC_CONSTRUCT';

export type MutationType =
  | 'WILD_TYPE'
  | 'ENGINEERED_MUTATION'
  | 'NATURAL_VARIANT'
  | 'EXPRESSION_TAG'
  | 'CLONING_ARTIFACT'
  | 'UNKNOWN';

export type MissingReason =
  | 'UNRESOLVED_DENSITY'
  | 'TERMINAL_FLEXIBILITY'
  | 'EXPRESSION_TAG_DISORDER'
  | 'NOT_APPLICABLE';

export type AnnotationCategory =
  | 'ACTIVE_SITE'
  | 'BINDING_SITE'
  | 'PTM'
  | 'VARIANT'
  | 'MUTATION'
  | 'SECONDARY_STRUCTURE'
  | 'DOMAIN'
  | 'DISULFIDE'
  | 'METAL_BINDING'
  | 'CROSS_LINK';

export type AnnotationProvenance =
  | 'RCSB_DEPOSITED'
  | 'UNIPROT_REVIEWED'
  | 'COMPUTATIONAL_PREDICTION'
  | 'USER_ANNOTATED';

export type EntityType = 'polymer' | 'non-polymer' | 'macrolide' | 'water';

export type PolymerType =
  | 'polypeptide(L)'
  | 'polypeptide(D)'
  | 'polydeoxyribonucleotide'
  | 'polyribonucleotide'
  | 'dna/rna hybrid';

export interface SequenceResidue {
  /** 0-based index in the sequence array */
  index: number;
  /** 1-based canonical sequence position */
  seqResNum: number;
  /** Author-assigned residue number (may be negative, non-1 starting, or discontinuous) */
  authorResNum: number;
  /** Optional insertion code (e.g. 'A', 'B') */
  insertionCode?: string;
  /** mmCIF label_asym_id (internal chain) */
  labelAsymId: string;
  /** Author-assigned chain identifier (auth_asym_id) */
  authAsymId: string;
  /** RCSB Entity identifier */
  entityId: string;
  /** Residue 3-letter or CCD code (e.g. 'VAL', 'HIS', 'MSE', 'DA') */
  resName: string;
  /** 1-letter code representation (e.g. 'V', 'H', 'M', 'A') or 'X' */
  code1: string;
  /** Whether 3D atomic coordinates are resolved for this residue */
  hasCoordinates: boolean;
  /** Whether this is a chemically modified or non-standard residue */
  isModified: boolean;
  /** Parent standard amino acid or nucleotide if modified (e.g. 'MET' for 'MSE') */
  parentResName?: string;
  /** Mutation or sequence variant classification */
  mutationType: MutationType;
  /** Reason coordinates are missing if unresolved */
  missingReason: MissingReason;
  /** Canonical residue key */
  canonicalKey: CanonicalResidueKey;
}

export interface EntityMapping {
  /** RCSB Entity identifier (e.g. '1', '2') */
  entityId: string;
  /** Entity category */
  entityType: EntityType;
  /** Polymer sub-classification */
  polymerType?: PolymerType;
  /** Descriptive molecule name */
  description: string;
  /** Author chain identifiers corresponding to this entity (e.g. ['A', 'C']) */
  chainIds: string[];
  /** mmCIF label_asym_id list */
  labelAsymIds: string[];
  /** UniProt accession if mapped (e.g. 'P69905') */
  uniprotAccession?: string;
  /** UniProt entry identifier (e.g. 'HBA_HUMAN') */
  uniprotId?: string;
  /** Stoichiometric count in the biological assembly (e.g. 2 for alpha in alpha2beta2) */
  stoichiometry: number;
  /** Full canonical biological sequence */
  canonicalSequence: string;
  /** Number of residues in canonical sequence */
  sequenceLength: number;
  /** Organism name if biological */
  organism?: string;
}

export interface ResidueAnnotation {
  /** Globally unique annotation ID */
  annotationId: string;
  /** Functional or structural category */
  category: AnnotationCategory;
  /** Brief human-readable title */
  title: string;
  /** Detailed biochemical description */
  description: string;
  /** Canonical residue keys affected by this annotation */
  canonicalResidueKeys: CanonicalResidueKey[];
  /** Entity identifier */
  entityId: string;
  /** Chain identifier strictly isolated to this chain */
  chainId: string;
  /** 1-based canonical sequence range */
  seqRange: { start: number; end: number };
  /** Author numbering range */
  authorRange: { start: number; end: number };
  /** Epistemic provenance */
  provenance: AnnotationProvenance;
  /** Source database or provider */
  sourceDatabase?: 'UniProt' | 'PDB' | 'Pfam' | 'InterPro' | 'AlphaFoldDB' | 'MOCS_INTERNAL';
  /** Database accession reference */
  accession?: string;
  /** Numerical score or pLDDT confidence if predictive */
  score?: number;
  /** Evidence code (e.g. ECO:0000269) */
  evidenceCode?: string;
}

export interface UniProtFeature {
  type: string;
  category: AnnotationCategory;
  description: string;
  begin: number;
  end: number;
  evidenceCode?: string;
  alternativeSequence?: string;
}

export interface UniProtEntry {
  accession: string;
  id: string;
  name: string;
  organism: {
    scientificName: string;
    commonName?: string;
    taxonId: number;
  };
  sequence: string;
  sequenceLength: number;
  sequenceVersion: number;
  isReviewed: boolean; // Swiss-Prot (true) vs TrEMBL (false)
  gene?: string;
  features: UniProtFeature[];
}

export interface SequenceAlignmentMapping {
  /** 1-based UniProt position to author residue number */
  uniprotToAuthor: Map<number, number>;
  /** Author residue number to 1-based UniProt position */
  authorToUniprot: Map<number, number>;
  /** 0-based sequence index to author residue number */
  indexToAuthor: Map<number, number>;
  /** Author residue number to 0-based sequence index */
  authorToIndex: Map<number, number>;
  /** Sequence offset (authorResNum - seqResNum) */
  numberingOffset: number;
  /** Initiator methionine status */
  initiatorMethionineCleaved: boolean;
  /** Number of aligned residues */
  alignedCount: number;
  /** Sequence identity fraction [0, 1] */
  identityFraction: number;
  /** Gaps in coordinate structure (missing loops / disordered regions) */
  missingSegments: Array<{
    startAuthor: number;
    endAuthor: number;
    length: number;
    reason: MissingReason;
  }>;
}

export interface SequenceStructureRecord {
  structureId: string;
  modelId: number;
  chainId: string;
  entityId: string;
  uniprotAccession?: string;
  canonicalSequence: string;
  depositedSequence: string;
  observedSequence: string;
  residues: SequenceResidue[];
  mapping: SequenceAlignmentMapping;
  annotations: ResidueAnnotation[];
  stats: {
    totalResidues: number;
    observedResidues: number;
    missingResidues: number;
    modifiedResidues: number;
    mutationCount: number;
    percentObserved: number;
  };
}
