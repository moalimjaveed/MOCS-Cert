/**
 * MOCS-Cert Molecular Sequence & Annotation Subsystem — Entity / Chain Mapping
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: wwPDB mmCIF Entity Poly / Chain Scheme
 * 
 * Enforces the strict distinction between:
 * - Entity: A chemically distinct molecular species (polymer, non-polymer, ion, water).
 * - Chain Instance: A physical asymmetric copy (e.g. Chain A and C are distinct copies of Entity 1).
 */

import type { EntityMapping } from './types';

/**
 * Standard authoritative entity mappings for reference benchmark structures.
 */
export const BENCHMARK_ENTITIES: Record<string, EntityMapping[]> = {
  // 4HHB: Human Deoxyhemoglobin Tetramer (alpha2 beta2)
  '4HHB': [
    {
      entityId: '1',
      entityType: 'polymer',
      polymerType: 'polypeptide(L)',
      description: 'Hemoglobin subunit alpha',
      chainIds: ['A', 'C'],
      labelAsymIds: ['A', 'C'],
      uniprotAccession: 'P69905',
      uniprotId: 'HBA_HUMAN',
      stoichiometry: 2,
      // Mature alpha-globin sequence (141 aa; initiator Met1 cleaved)
      canonicalSequence: 'VLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSHGSAQVKGHGKKVADALTNAVAHVDDMPNALSALSDLHAHKLRVDPVNFKLLSHCLLVTLAAHLPAEFTPAVHASLDKFLASVSTVLTSKYR',
      sequenceLength: 141,
      organism: 'Homo sapiens',
    },
    {
      entityId: '2',
      entityType: 'polymer',
      polymerType: 'polypeptide(L)',
      description: 'Hemoglobin subunit beta',
      chainIds: ['B', 'D'],
      labelAsymIds: ['B', 'D'],
      uniprotAccession: 'P68871',
      uniprotId: 'HBB_HUMAN',
      stoichiometry: 2,
      // Mature beta-globin sequence (146 aa; initiator Met1 cleaved)
      canonicalSequence: 'VHLTPEEKSAVTALWGKVNVDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAVMGNPKVKAHGKKVLGAFSDGLAHLDNLKGTFATLSELHCDKLHVDPENFRLLGNVLVCVLAHHFGKEFTPPVQAAYQKVVAGVANALAHKYH',
      sequenceLength: 146,
      organism: 'Homo sapiens',
    },
    {
      entityId: '3',
      entityType: 'non-polymer',
      description: 'PROTOPORPHYRIN IX CONTAINING FE (HEME B)',
      chainIds: ['A', 'B', 'C', 'D'],
      labelAsymIds: ['E', 'F', 'G', 'H'],
      stoichiometry: 4,
      canonicalSequence: '',
      sequenceLength: 0,
    },
    {
      entityId: '4',
      entityType: 'non-polymer',
      description: 'PHOSPHATE ION',
      chainIds: ['A'],
      labelAsymIds: ['I'],
      stoichiometry: 1,
      canonicalSequence: '',
      sequenceLength: 0,
    },
  ],

  // 1BNA: Synthetic B-DNA Dodecamer Duplex (CGCGAATTCGCG)
  '1BNA': [
    {
      entityId: '1',
      entityType: 'polymer',
      polymerType: 'polydeoxyribonucleotide',
      description: "DNA (5'-D(*CP*GP*CP*GP*AP*AP*TP*TP*CP*GP*CP*G)-3')",
      chainIds: ['A'],
      labelAsymIds: ['A'],
      stoichiometry: 1,
      canonicalSequence: 'CGCGAATTCGCG',
      sequenceLength: 12,
      organism: 'Synthetic construct',
    },
    {
      entityId: '2',
      entityType: 'polymer',
      polymerType: 'polydeoxyribonucleotide',
      description: "DNA (5'-D(*CP*GP*CP*GP*AP*AP*TP*TP*CP*GP*CP*G)-3')",
      chainIds: ['B'],
      labelAsymIds: ['B'],
      stoichiometry: 1,
      canonicalSequence: 'CGCGAATTCGCG',
      sequenceLength: 12,
      organism: 'Synthetic construct',
    },
  ],

  // 1TUP: Cellular Tumor Antigen p53 bound to DNA
  '1TUP': [
    {
      entityId: '1',
      entityType: 'polymer',
      polymerType: 'polypeptide(L)',
      description: 'Cellular tumor antigen p53 (core domain)',
      chainIds: ['A', 'B', 'C'],
      labelAsymIds: ['A', 'B', 'C'],
      uniprotAccession: 'P04637',
      uniprotId: 'P53_HUMAN',
      stoichiometry: 3,
      // Core DNA-binding domain (residues 94-312)
      canonicalSequence: 'SSSVPSQKTYQGSYGFRLGFLHSGTAKSVTCTYSPALNKMFCQLAKTCPVQLWVDSTPPPGTRVRAMAIYKQSQHMTEVVRRCPHHERCSDSDGLAPPQHLIRVEGNLRVEYLDDRNTFRHSVVVPYEPPEVGSDCTTIHYNYMCNSSCMGGMNRRPILTIITLEDSSGNLLGRNSFEVRVCACPGRDRRTEEENL',
      sequenceLength: 198,
      organism: 'Homo sapiens',
    },
    {
      entityId: '2',
      entityType: 'polymer',
      polymerType: 'polydeoxyribonucleotide',
      description: "DNA (5'-D(*TP*CP*CP*TP*GP*CP*CP*TP*GP*GP*CP*CP*TP*TP*GP*CP*CP*TP*CP*TP*T)-3')",
      chainIds: ['D'],
      labelAsymIds: ['D'],
      stoichiometry: 1,
      canonicalSequence: 'TCCTGCCTGG CCTTGTCCTT',
      sequenceLength: 21,
      organism: 'Synthetic construct',
    },
    {
      entityId: '3',
      entityType: 'polymer',
      polymerType: 'polydeoxyribonucleotide',
      description: "DNA (5'-D(*AP*AP*GP*GP*AP*CP*AA*GG*CP*CA*GG*CA*GG*AA*GG*CA*GG*AA*GA*GA*A)-3')",
      chainIds: ['E'],
      labelAsymIds: ['E'],
      stoichiometry: 1,
      canonicalSequence: 'AAGGACAAGG CCAGGCAAGG',
      sequenceLength: 21,
      organism: 'Synthetic construct',
    },
    {
      entityId: '4',
      entityType: 'non-polymer',
      description: 'ZINC ION',
      chainIds: ['A', 'B', 'C'],
      labelAsymIds: ['F', 'G', 'H'],
      stoichiometry: 3,
      canonicalSequence: '',
      sequenceLength: 0,
    },
  ],

  // 1STP: Streptavidin / Biotin complex
  '1STP': [
    {
      entityId: '1',
      entityType: 'polymer',
      polymerType: 'polypeptide(L)',
      description: 'Streptavidin',
      chainIds: ['A'],
      labelAsymIds: ['A'],
      uniprotAccession: 'P22629',
      uniprotId: 'SAV_STRVI',
      stoichiometry: 1,
      canonicalSequence: 'DPSKDSKAQVSAAEAGITGTWYNQLGSTFIVTAGADGALTGTYESAVGNAESRYVLTGRYDSAPATDGSGTALGWTVAWKNNYRNAHSATTWSGQYVGGAEARINTQWLLTSGTTEANAWKSTLVGHDTFTKVKPSAAS',
      sequenceLength: 139,
      organism: 'Streptomyces avidinii',
    },
    {
      entityId: '2',
      entityType: 'non-polymer',
      description: 'BIOTIN',
      chainIds: ['A'],
      labelAsymIds: ['B'],
      stoichiometry: 1,
      canonicalSequence: '',
      sequenceLength: 0,
    },
  ],

  // 1CRN: Crambin
  '1CRN': [
    {
      entityId: '1',
      entityType: 'polymer',
      polymerType: 'polypeptide(L)',
      description: 'Crambin',
      chainIds: ['A'],
      labelAsymIds: ['A'],
      uniprotAccession: 'P01542',
      uniprotId: 'CRAM_CRAAB',
      stoichiometry: 1,
      canonicalSequence: 'TTCCPSIVARSNFNVCRLPGTPEAICATYTGCIIIPGATCPGDYAN',
      sequenceLength: 46,
      organism: 'Crambe hispanica',
    },
  ],
};

const dynamicRegistry = new Map<string, EntityMapping[]>();

/**
 * Registers entity mappings for a structure.
 */
export function registerEntityMapping(structureId: string, entities: EntityMapping[]): void {
  dynamicRegistry.set(structureId.trim().toUpperCase(), entities);
}

/**
 * Retrieves all entities for a given structure.
 */
export function getEntitiesForStructure(structureId: string): EntityMapping[] {
  const normId = structureId.trim().toUpperCase();
  const registered = dynamicRegistry.get(normId);
  if (registered) return registered;
  return BENCHMARK_ENTITIES[normId] || [];
}

/**
 * Finds the entity corresponding to a specific chain identifier.
 */
export function getEntityForChain(structureId: string, chainId: string): EntityMapping | undefined {
  const entities = getEntitiesForStructure(structureId);
  const normChain = chainId.trim();
  return entities.find((e) => e.chainIds.includes(normChain));
}

/**
 * Retrieves all chain identifiers associated with a given entity.
 */
export function getChainsForEntity(structureId: string, entityId: string): string[] {
  const entities = getEntitiesForStructure(structureId);
  const normEntity = entityId.trim();
  const entity = entities.find((e) => e.entityId === normEntity);
  return entity ? entity.chainIds : [];
}

/**
 * Determines whether a structure is a homomer (identical polymer subunits).
 */
export function isHomomer(structureId: string): boolean {
  const entities = getEntitiesForStructure(structureId).filter((e) => e.entityType === 'polymer');
  return entities.length === 1 && entities[0].chainIds.length > 1;
}

/**
 * Determines whether a structure is a heteromer (multiple distinct polymer entities).
 */
export function isHeteromer(structureId: string): boolean {
  const entities = getEntitiesForStructure(structureId).filter((e) => e.entityType === 'polymer');
  return entities.length > 1;
}
