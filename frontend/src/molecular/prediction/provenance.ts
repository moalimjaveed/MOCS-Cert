/**
 * Model Provenance, SHA-256 Digest & Epistemic Audit Module
 * 
 * Strict forensic tracking of:
 * - Model origin (experimental vs predicted vs designed vs synthetic)
 * - Cryptographic sequence digest (deterministic SHA-256)
 * - Scientific caveats and prohibited over-claiming terminology
 */

import type {
  ModelProvenance,
  PredictionProvider,
  StructureEpistemicOrigin,
} from './types';

// Standard SHA-256 Constants (FIPS 180-4)
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr(n: number, x: number): number {
  return (x >>> n) | (x << (32 - n));
}

function ch(x: number, y: number, z: number): number {
  return (x & y) ^ (~x & z);
}

function maj(x: number, y: number, z: number): number {
  return (x & y) ^ (x & z) ^ (y & z);
}

function sigma0(x: number): number {
  return rotr(2, x) ^ rotr(13, x) ^ rotr(22, x);
}

function sigma1(x: number): number {
  return rotr(6, x) ^ rotr(11, x) ^ rotr(25, x);
}

function gamma0(x: number): number {
  return rotr(7, x) ^ rotr(18, x) ^ (x >>> 3);
}

function gamma1(x: number): number {
  return rotr(17, x) ^ rotr(19, x) ^ (x >>> 10);
}

/**
 * Pure, deterministic SHA-256 implementation in standard TypeScript.
 * Yields canonical 64-character lowercase hexadecimal digest.
 */
export function computeSequenceSha256(input: string): string {
  // UTF-8 encode string to byte array
  const utf8: number[] = [];
  for (let i = 0; i < input.length; i++) {
    let charCode = input.charCodeAt(i);
    if (charCode < 0x80) {
      utf8.push(charCode);
    } else if (charCode < 0x800) {
      utf8.push(0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f));
    } else if (charCode < 0xd800 || charCode >= 0xe000) {
      utf8.push(
        0xe0 | (charCode >> 12),
        0x80 | ((charCode >> 6) & 0x3f),
        0x80 | (charCode & 0x3f)
      );
    } else {
      i++;
      charCode = 0x10000 + (((charCode & 0x3ff) << 10) | (input.charCodeAt(i) & 0x3ff));
      utf8.push(
        0xf0 | (charCode >> 18),
        0x80 | ((charCode >> 12) & 0x3f),
        0x80 | ((charCode >> 6) & 0x3f),
        0x80 | (charCode & 0x3f)
      );
    }
  }

  const bitLength = utf8.length * 8;
  utf8.push(0x80);
  while ((utf8.length % 64) !== 56) {
    utf8.push(0);
  }

  // Append 64-bit big-endian length
  const highBits = Math.floor(bitLength / 0x100000000);
  const lowBits = bitLength >>> 0;
  for (let i = 24; i >= 0; i -= 8) utf8.push((highBits >>> i) & 0xff);
  for (let i = 24; i >= 0; i -= 8) utf8.push((lowBits >>> i) & 0xff);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Int32Array(64);

  for (let chunk = 0; chunk < utf8.length; chunk += 64) {
    for (let i = 0; i < 16; i++) {
      const idx = chunk + i * 4;
      w[i] =
        (utf8[idx] << 24) |
        (utf8[idx + 1] << 16) |
        (utf8[idx + 2] << 8) |
        utf8[idx + 3];
    }
    for (let i = 16; i < 64; i++) {
      w[i] = (gamma1(w[i - 2]) + w[i - 7] + gamma0(w[i - 15]) + w[i - 16]) | 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const t1 = (h + sigma1(e) + ch(e, f, g) + K[i] + w[i]) | 0;
      const t2 = (sigma0(a) + maj(a, b, c)) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return `${toHex(h0)}${toHex(h1)}${toHex(h2)}${toHex(h3)}${toHex(h4)}${toHex(h5)}${toHex(h6)}${toHex(h7)}`;
}

export const STANDARD_SCIENTIFIC_CAVEATS: Record<StructureEpistemicOrigin, string[]> = {
  experimental: [
    'Experimental structure derived from empirical biophysical measurement (X-ray, Cryo-EM, or NMR).',
  ],
  predicted: [
    'Model is a computational prediction, not an experimental structure.',
    'Regions with pLDDT < 50 should be treated as disordered or flexible hypotheses rather than rigid atomic conformations.',
    'High pLDDT indicates confident model prediction, not experimental validation.',
    'Do not interpret predicted multi-chain complexes or docking poses as experimental proof of binding affinity.',
  ],
  designed: [
    'De novo designed candidate generated via generative machine learning (e.g. RFdiffusion / ProteinMPNN).',
    'Structure represents an unvalidated computational design requiring experimental expression and biophysical validation.',
    'Predicted binding interfaces and affinities are computational hypotheses.',
  ],
  synthetic_calibration: [
    'Synthetic geometric calibration model for deterministic testing and offline fallback.',
    'Coordinates are mathematically synthesized and do not represent biological folding.',
  ],
};

const PROVIDER_NAMES: Record<string, string> = {
  alphafold_db: 'AlphaFold DB (DeepMind / EMBL-EBI)',
  esmfold: 'ESMFold (Meta AI)',
  boltz: 'Boltz-1 Biomolecular Predictor',
  colabfold: 'ColabFold Pipeline',
  rosettafold: 'RoseTTAFold / All-Atom',
  rfdiffusion: 'RFdiffusion Generative Backbone',
  proteinmpnn: 'ProteinMPNN Sequence Design',
  custom_ml: 'Custom Machine Learning Model',
  synthetic_calibration: 'MOCS-Cert Calibrated Secondary Structure Generator',
};

export interface CreateModelProvenanceOptions {
  provider: PredictionProvider | string;
  modelName: string;
  modelVersion?: string;
  epistemicOrigin: StructureEpistemicOrigin;
  sequence: string;
  randomSeed?: number | string;
  parameters?: Record<string, any>;
  customCaveats?: string[];
}

/**
 * Creates an immutable ModelProvenance record.
 * Invariant: isExperimental is strictly FALSE for predicted, designed, and synthetic models.
 */
export function createModelProvenance(options: CreateModelProvenanceOptions): ModelProvenance {
  const {
    provider,
    modelName,
    modelVersion,
    epistemicOrigin,
    sequence,
    randomSeed,
    parameters,
    customCaveats,
  } = options;

  const isExperimental = epistemicOrigin === 'experimental';
  const providerDisplayName = PROVIDER_NAMES[provider] || String(provider);
  const sequenceSha256 = computeSequenceSha256(sequence);
  const generationTimestamp = new Date().toISOString();

  const standardCaveats = STANDARD_SCIENTIFIC_CAVEATS[epistemicOrigin] || [];
  const scientificCaveats = [
    ...standardCaveats,
    ...(customCaveats || []),
  ];

  return {
    provider,
    providerDisplayName,
    modelName,
    modelVersion,
    epistemicOrigin,
    isExperimental,
    sequenceSha256,
    randomSeed,
    generationTimestamp,
    parameters,
    scientificCaveats,
  };
}

/**
 * Prohibited hype or over-claiming terminology in scientific reports.
 */
const PROHIBITED_CLAIMS: Array<{ regex: RegExp; claim: string; replacement: string }> = [
  {
    regex: /\bexperimentally\s+verified\b/i,
    claim: 'experimentally verified',
    replacement: 'computationally predicted',
  },
  {
    regex: /\bexperimentally\s+confirmed\b/i,
    claim: 'experimentally confirmed',
    replacement: 'computationally inferred',
  },
  {
    regex: /\bproven\s+structure\b/i,
    claim: 'proven structure',
    replacement: 'predicted structural model',
  },
  {
    regex: /\bbinding\s+validated\b/i,
    claim: 'binding validated',
    replacement: 'predicted binding candidate',
  },
  {
    regex: /\bground\s+truth\s+structure\b/i,
    claim: 'ground truth structure',
    replacement: 'high-confidence computed model',
  },
  {
    regex: /\bguaranteed\s+accuracy\b/i,
    claim: 'guaranteed accuracy',
    replacement: 'statistically estimated confidence',
  },
  {
    regex: /\btrue\s+binding\s+pose\b/i,
    claim: 'true binding pose',
    replacement: 'predicted docking hypothesis',
  },
  {
    regex: /\b(?:binding\s+free\s+energy|docking\s+free\s+energy|\bΔG°?\s*=\s*-?\d+)\b/i,
    claim: 'docking score as binding free energy',
    replacement: 'empirical docking pose score (dimensionless)',
  },
  {
    regex: /(?:\baabb\s+is\s+molecular\s+volume|\bmolecular\s+volume[^\.]*\(aabb\))/i,
    claim: 'AABB as molecular volume',
    replacement: 'Cartesian bounding box envelope volume',
  },
  {
    regex: /\b(?:chemically\s+validated\s+interaction|validated\s+hydrogen\s+bond\s+without\s+hydrogens)\b/i,
    claim: 'proximity as chemically validated interaction',
    replacement: 'putative interaction candidate (geometric proxy)',
  },
  {
    regex: /\b(?:rmsd\s+proves\s+stability|folding\s+stability\s+proven\s+by\s+rmsd)\b/i,
    claim: 'RMSD as folding stability',
    replacement: 'coordinate fluctuation metric',
  },
  {
    regex: /\b(?:probability\s+of\s+correctness|probability\s+the\s+protein\s+is\s+correct)\b/i,
    claim: 'pLDDT as probability of correctness',
    replacement: 'local distance difference test confidence score',
  },
  {
    regex: /\b(?:pae\s+is\s+rmsd|predicted\s+aligned\s+error\s+rmsd)\b/i,
    claim: 'PAE as coordinate RMSD',
    replacement: 'directional predicted aligned error',
  },
  {
    regex: /\b(?:geometric\s+cavity\s+is\s+active\s+site|active\s+site\s+detected\s+by\s+grid)\b/i,
    claim: 'geometric cavity as active site',
    replacement: 'predicted geometric cavity',
  },
  {
    regex: /\b(?:local\s+neural[\s-]network\s+inference\s+executed|running\s+alphafold\s+locally)\b/i,
    claim: 'external prediction as local inference',
    replacement: 'externally resolved model / audited metadata',
  },
];

export interface TerminologyAuditResult {
  isClean: boolean;
  violations: string[];
  recommendations: Record<string, string>;
}

/**
 * Audits text (e.g. model notes, UI summaries) to ensure no misleading or
 * scientifically indefensible claims are made about predicted structures.
 */
export function assertScientificallyDefensibleTerminology(text: string): TerminologyAuditResult {
  const violations: string[] = [];
  const recommendations: Record<string, string> = {};

  for (const rule of PROHIBITED_CLAIMS) {
    if (rule.regex.test(text)) {
      violations.push(rule.claim);
      recommendations[rule.claim] = rule.replacement;
    }
  }

  return {
    isClean: violations.length === 0,
    violations,
    recommendations,
  };
}

/**
 * Distinguishes epistemic origin from structure metadata or candidates.
 */
export function distinguishModelOrigin(metadata: any): StructureEpistemicOrigin {
  if (!metadata) return 'predicted';

  const category = metadata.category || '';
  const provider = (metadata.provider || '').toLowerCase();
  const source = (metadata.source || '').toLowerCase();
  const kind = (metadata.kind || '').toLowerCase();

  if (category === 'existing_experimental' || kind === 'experimental' || provider === 'rcsb') {
    return 'experimental';
  }
  if (
    category === 'designed_candidate' ||
    provider.includes('rfdiffusion') ||
    provider.includes('proteinmpnn') ||
    source === 'rfdiffusion' ||
    source === 'proteinmpnn'
  ) {
    return 'designed';
  }
  if (provider.includes('synthetic') || source.includes('synthetic')) {
    return 'synthetic_calibration';
  }
  return 'predicted';
}
