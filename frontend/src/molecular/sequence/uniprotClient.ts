/**
 * MOCS-Cert Molecular Sequence & Annotation Subsystem — UniProt Client & Registry
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: UniProtKB REST API & Swiss-Prot curated features
 * 
 * Validates accessions against the strict standard regex and provides
 * authoritative offline records for benchmark structures so testing is 100% reproducible.
 */

import type { UniProtEntry, UniProtFeature } from './types';

/**
 * Strict regex for standard UniProtKB accessions.
 * Swiss-Prot / TrEMBL format:
 * [OPQ][0-9][A-Z0-9]{3}[0-9] | [A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}
 */
export const UNIPROT_ACCESSION_REGEX = /^(?:[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2})$/;

/**
 * Checks if a string is a syntactically valid UniProtKB accession.
 */
export function isValidUniProtAccession(accession: string): boolean {
  if (!accession) return false;
  return UNIPROT_ACCESSION_REGEX.test(accession.trim().toUpperCase());
}

/**
 * Authoritative curated records for benchmark structures.
 */
export const BENCHMARK_UNIPROT_ENTRIES: Record<string, UniProtEntry> = {
  // P69905: Human Hemoglobin subunit alpha (142 aa in precursor with initiator Met)
  'P69905': {
    accession: 'P69905',
    id: 'HBA_HUMAN',
    name: 'Hemoglobin subunit alpha',
    organism: {
      scientificName: 'Homo sapiens',
      commonName: 'Human',
      taxonId: 9606,
    },
    sequence: 'MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSHGSAQVKGHGKKVADALTNAVAHVDDMPNALSALSDLHAHKLRVDPVNFKLLSHCLLVTLAAHLPAEFTPAVHASLDKFLASVSTVLTSKYR',
    sequenceLength: 142,
    sequenceVersion: 2,
    isReviewed: true,
    gene: 'HBA1',
    features: [
      {
        type: 'INIT_MET',
        category: 'PTM',
        description: 'Removed in mature form',
        begin: 1,
        end: 1,
        evidenceCode: 'ECO:0000269',
      },
      {
        type: 'BINDING',
        category: 'BINDING_SITE',
        description: 'Heme (Fe) axial ligand (proximal His88 / author His87)',
        begin: 88,
        end: 88,
        evidenceCode: 'ECO:0000269',
      },
      {
        type: 'SITE',
        category: 'ACTIVE_SITE',
        description: 'Distal histidine (His59 / author His58)',
        begin: 59,
        end: 59,
        evidenceCode: 'ECO:0000269',
      },
      {
        type: 'DOMAIN',
        category: 'DOMAIN',
        description: 'Globin domain',
        begin: 9,
        end: 141,
        evidenceCode: 'ECO:0000255',
      },
    ],
  },

  // P68871: Human Hemoglobin subunit beta (147 aa in precursor with initiator Met)
  'P68871': {
    accession: 'P68871',
    id: 'HBB_HUMAN',
    name: 'Hemoglobin subunit beta',
    organism: {
      scientificName: 'Homo sapiens',
      commonName: 'Human',
      taxonId: 9606,
    },
    sequence: 'MVHLTPEEKSAVTALWGKVNVDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAVMGNPKVKAHGKKVLGAFSDGLAHLDNLKGTFATLSELHCDKLHVDPENFRLLGNVLVCVLAHHFGKEFTPPVQAAYQKVVAGVANALAHKYH',
    sequenceLength: 147,
    sequenceVersion: 2,
    isReviewed: true,
    gene: 'HBB',
    features: [
      {
        type: 'INIT_MET',
        category: 'PTM',
        description: 'Removed in mature form',
        begin: 1,
        end: 1,
        evidenceCode: 'ECO:0000269',
      },
      {
        type: 'BINDING',
        category: 'BINDING_SITE',
        description: 'Heme (Fe) axial ligand (proximal His93 / author His92)',
        begin: 93,
        end: 93,
        evidenceCode: 'ECO:0000269',
      },
      {
        type: 'SITE',
        category: 'ACTIVE_SITE',
        description: 'Distal histidine (His64 / author His63)',
        begin: 64,
        end: 64,
        evidenceCode: 'ECO:0000269',
      },
      {
        type: 'VARIANT',
        category: 'VARIANT',
        description: 'Sickle cell anemia (HbS: E7V / author Glu6Val)',
        begin: 7,
        end: 7,
        alternativeSequence: 'V',
        evidenceCode: 'ECO:0000269',
      },
      {
        type: 'DOMAIN',
        category: 'DOMAIN',
        description: 'Globin domain',
        begin: 6,
        end: 145,
        evidenceCode: 'ECO:0000255',
      },
    ],
  },

  // P04637: Cellular tumor antigen p53 (393 aa)
  'P04637': {
    accession: 'P04637',
    id: 'P53_HUMAN',
    name: 'Cellular tumor antigen p53',
    organism: {
      scientificName: 'Homo sapiens',
      commonName: 'Human',
      taxonId: 9606,
    },
    sequence: 'MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGPDEAPRMPEAAPPVAPAPAAPTPAAPAPAPSWPLSSSVPSQKTYQGSYGFRLGFLHSGTAKSVTCTYSPALNKMFCQLAKTCPVQLWVDSTPPPGTRVRAMAIYKQSQHMTEVVRRCPHHERCSDSDGLAPPQHLIRVEGNLRVEYLDDRNTFRHSVVVPYEPPEVGSDCTTIHYNYMCNSSCMGGMNRRPILTIITLEDSSGNLLGRNSFEVRVCACPGRDRRTEEENLRKKGEPHHELPPGSTKRALPNNTSSSPQPKKKPLDGEYFTLQIRGRERFEMFRELNEALELKDAQAGKEPGGSRAHSSHLKSKKGQSTSRHKKLMFKTEGPDSD',
    sequenceLength: 393,
    sequenceVersion: 4,
    isReviewed: true,
    gene: 'TP53',
    features: [
      {
        type: 'DOMAIN',
        category: 'DOMAIN',
        description: 'DNA-binding domain',
        begin: 102,
        end: 292,
        evidenceCode: 'ECO:0000255',
      },
      {
        type: 'METAL',
        category: 'METAL_BINDING',
        description: 'Zinc coordination site (Cys176)',
        begin: 176,
        end: 176,
        evidenceCode: 'ECO:0000269',
      },
      {
        type: 'METAL',
        category: 'METAL_BINDING',
        description: 'Zinc coordination site (His179)',
        begin: 179,
        end: 179,
        evidenceCode: 'ECO:0000269',
      },
      {
        type: 'METAL',
        category: 'METAL_BINDING',
        description: 'Zinc coordination site (Cys238)',
        begin: 238,
        end: 238,
        evidenceCode: 'ECO:0000269',
      },
      {
        type: 'METAL',
        category: 'METAL_BINDING',
        description: 'Zinc coordination site (Cys242)',
        begin: 242,
        end: 242,
        evidenceCode: 'ECO:0000269',
      },
      {
        type: 'VARIANT',
        category: 'VARIANT',
        description: 'Cancer hotspot mutation R175H',
        begin: 175,
        end: 175,
        alternativeSequence: 'H',
        evidenceCode: 'ECO:0000269',
      },
      {
        type: 'VARIANT',
        category: 'VARIANT',
        description: 'Cancer hotspot mutation R248W',
        begin: 248,
        end: 248,
        alternativeSequence: 'W',
        evidenceCode: 'ECO:0000269',
      },
      {
        type: 'VARIANT',
        category: 'VARIANT',
        description: 'Cancer hotspot mutation R273H',
        begin: 273,
        end: 273,
        alternativeSequence: 'H',
        evidenceCode: 'ECO:0000269',
      },
      {
        type: 'MOD_RES',
        category: 'PTM',
        description: 'Phosphoserine (pSer15)',
        begin: 15,
        end: 15,
        evidenceCode: 'ECO:0000269',
      },
      {
        type: 'MOD_RES',
        category: 'PTM',
        description: 'N6-acetyllysine (AcLys382)',
        begin: 382,
        end: 382,
        evidenceCode: 'ECO:0000269',
      },
    ],
  },

  // P22629: Streptavidin
  'P22629': {
    accession: 'P22629',
    id: 'SAV_STRVI',
    name: 'Streptavidin',
    organism: {
      scientificName: 'Streptomyces avidinii',
      taxonId: 1895,
    },
    sequence: 'MRKIVVAAIAVSLTTVSITASASADPSKDSKAQVSAAEAGITGTWYNQLGSTFIVTAGADGALTGTYESAVGNAESRYVLTGRYDSAPATDGSGTALGWTVAWKNNYRNAHSATTWSGQYVGGAEARINTQWLLTSGTTEANAWKSTLVGHDTFTKVKPSAASIDAAKKAGVNNGNPLDAVQQ',
    sequenceLength: 183,
    sequenceVersion: 1,
    isReviewed: true,
    features: [
      {
        type: 'SIGNAL',
        category: 'DOMAIN',
        description: 'Signal peptide',
        begin: 1,
        end: 24,
        evidenceCode: 'ECO:0000269',
      },
      {
        type: 'BINDING',
        category: 'BINDING_SITE',
        description: 'Biotin binding site (Trp108)',
        begin: 108,
        end: 108,
        evidenceCode: 'ECO:0000269',
      },
    ],
  },

  // P01542: Crambin
  'P01542': {
    accession: 'P01542',
    id: 'CRAM_CRAAB',
    name: 'Crambin',
    organism: {
      scientificName: 'Crambe hispanica',
      taxonId: 3721,
    },
    sequence: 'TTCCPSIVARSNFNVCRLPGTPEAICATYTGCIIIPGATCPGDYAN',
    sequenceLength: 46,
    sequenceVersion: 1,
    isReviewed: true,
    features: [
      {
        type: 'DISULFID',
        category: 'DISULFIDE',
        description: 'Disulfide bond 3-40',
        begin: 3,
        end: 40,
        evidenceCode: 'ECO:0000269',
      },
      {
        type: 'DISULFID',
        category: 'DISULFIDE',
        description: 'Disulfide bond 4-32',
        begin: 4,
        end: 32,
        evidenceCode: 'ECO:0000269',
      },
      {
        type: 'DISULFID',
        category: 'DISULFIDE',
        description: 'Disulfide bond 16-26',
        begin: 16,
        end: 26,
        evidenceCode: 'ECO:0000269',
      },
    ],
  },
};

const dynamicUniProtCache = new Map<string, UniProtEntry>();

/**
 * Registers an offline UniProt entry in the memory cache.
 */
export function registerOfflineUniProtEntry(entry: UniProtEntry): void {
  dynamicUniProtCache.set(entry.accession.toUpperCase(), entry);
}

/**
 * Retrieves a UniProt entry from the offline benchmark registry or cache.
 */
export function getOfflineUniProtEntry(accession: string): UniProtEntry | undefined {
  const norm = accession.trim().toUpperCase();
  const cached = dynamicUniProtCache.get(norm);
  if (cached) return cached;
  return BENCHMARK_UNIPROT_ENTRIES[norm];
}

/**
 * Fetches a UniProt entry by accession, checking offline cache first then falling back to REST.
 */
export async function fetchUniProtEntry(accession: string): Promise<UniProtEntry> {
  const norm = accession.trim().toUpperCase();
  if (!isValidUniProtAccession(norm)) {
    throw new Error(`Invalid UniProt accession format: "${accession}". Must match standard accession pattern.`);
  }

  const local = getOfflineUniProtEntry(norm);
  if (local) return local;

  // Attempt fetch via UniProt REST API with 5-second timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const url = `https://rest.uniprot.org/uniprotkb/${norm}.json`;
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) {
      throw new Error(`UniProt API request failed with status ${resp.status}: ${resp.statusText}`);
    }
    const data = await resp.json();
    const entry: UniProtEntry = {
      accession: data.primaryAccession || norm,
      id: data.uniProtkbId || norm,
      name: data.proteinDescription?.recommendedName?.fullName?.value || norm,
      organism: {
        scientificName: data.organism?.scientificName || 'Unknown',
        commonName: data.organism?.commonName,
        taxonId: data.organism?.taxonId || 0,
      },
      sequence: data.sequence?.value || '',
      sequenceLength: data.sequence?.length || 0,
      sequenceVersion: data.entryAudit?.sequenceVersion || 1,
      isReviewed: data.entryType === 'UniProtKB reviewed (Swiss-Prot)',
      gene: data.genes?.[0]?.geneName?.value,
      features: (data.features || []).map((f: any) => ({
        type: f.type,
        category: mapFeatureToCategory(f.type),
        description: f.description || f.type,
        begin: f.location?.start?.value || 0,
        end: f.location?.end?.value || 0,
        evidenceCode: f.evidences?.[0]?.evidenceCode,
        alternativeSequence: f.alternativeSequence?.originalSequence,
      })),
    };

    registerOfflineUniProtEntry(entry);
    return entry;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`UniProt API request timed out for accession ${norm}`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function mapFeatureToCategory(type: string): UniProtFeature['category'] {
  switch (type) {
    case 'ACT_SITE':
      return 'ACTIVE_SITE';
    case 'BINDING':
      return 'BINDING_SITE';
    case 'METAL':
      return 'METAL_BINDING';
    case 'MOD_RES':
    case 'LIPID':
    case 'CARBOHYD':
      return 'PTM';
    case 'VARIANT':
      return 'VARIANT';
    case 'MUTAGEN':
      return 'MUTATION';
    case 'DOMAIN':
    case 'REGION':
    case 'REPEAT':
    case 'MOTIF':
    case 'SIGNAL':
    case 'TRANSIT':
      return 'DOMAIN';
    case 'DISULFID':
      return 'DISULFIDE';
    case 'CROSSLNK':
      return 'CROSS_LINK';
    case 'HELIX':
    case 'STRAND':
    case 'TURN':
      return 'SECONDARY_STRUCTURE';
    default:
      return 'DOMAIN';
  }
}
