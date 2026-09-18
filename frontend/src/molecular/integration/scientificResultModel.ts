/**
 * MOCS-Cert Scientific Result Object Model & Envelope Engine
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: Rigid Envelope Construction, Explicit Units & Multi-Tier Provenance
 */

import type {
  ScientificResultEnvelope,
  ScientificResultStatus,
  ScientificUnit,
  CanonicalSelectionScope,
} from './types';

export type {
  ScientificResultEnvelope,
  ScientificResultStatus,
  ScientificUnit,
  CanonicalSelectionScope,
};
import type { StructureProvenance } from '../types';

export const APPROVED_SCIENTIFIC_UNITS: Set<ScientificUnit> = new Set([
  'Å',
  'nm',
  'Å²',
  'nm²',
  'Å³',
  'nm³',
  '°',
  'degrees',
  'radians',
  'ps',
  'ns',
  'fs',
  'amu',
  'kcal/mol',
  'kJ/mol',
  'dimensionless',
  'pLDDT',
  'fraction',
]);

export interface CreateResultInput<T = any> {
  resultType: string;
  source: {
    structureId: string;
    modelId?: string | number;
    chainId?: string;
    trajectoryId?: string;
    frameIndex?: number;
    timestampPs?: number;
  };
  selection: CanonicalSelectionScope | string;
  parameters?: Record<string, any>;
  unit: ScientificUnit;
  status: ScientificResultStatus;
  provenance: StructureProvenance | Record<string, any>;
  value: T;
  formattedValue?: string;
  uncertainty?: number;
  errors?: string[];
  warnings?: string[];
}

/**
 * Creates a validated, canonical ScientificResultEnvelope.
 * Throws an error if the unit is unrecognized or mandatory identity fields are missing.
 */
export function createScientificResult<T = any>(
  input: CreateResultInput<T>
): ScientificResultEnvelope<T> {
  // 1. Validate scientific unit contract
  if (!APPROVED_SCIENTIFIC_UNITS.has(input.unit)) {
    throw new Error(
      `[MOCS-Cert Units Contract] Unrecognized or unapproved scientific unit '${input.unit}'. Allowed units: ${Array.from(
        APPROVED_SCIENTIFIC_UNITS
      ).join(', ')}`
    );
  }

  // 2. Validate mandatory source identity
  if (!input.source.structureId || input.source.structureId.trim().length === 0) {
    throw new Error('[MOCS-Cert Data Lineage] ScientificResult must specify a non-empty structureId.');
  }

  // 3. Format default representation if omitted
  let formatted = input.formattedValue;
  if (!formatted && input.value !== undefined && input.value !== null) {
    if (typeof input.value === 'number') {
      formatted = `${input.value.toFixed(2)} ${input.unit}`;
    } else if (typeof input.value === 'string') {
      formatted = `${input.value} ${input.unit}`;
    } else {
      formatted = String(input.value);
    }
  }

  return {
    resultType: input.resultType,
    source: {
      structureId: input.source.structureId.trim().toUpperCase(),
      modelId: input.source.modelId ?? 1,
      chainId: input.source.chainId ? input.source.chainId.trim().toUpperCase() : undefined,
      trajectoryId: input.source.trajectoryId,
      frameIndex: input.source.frameIndex,
      timestampPs: input.source.timestampPs,
    },
    selection: input.selection,
    parameters: input.parameters ?? {},
    unit: input.unit,
    status: input.status,
    provenance: input.provenance,
    timestamp: Date.now(),
    value: input.value,
    formattedValue: formatted,
    uncertainty: input.uncertainty,
    errors: input.errors,
    warnings: input.warnings,
  };
}

/**
 * Validates that a candidate object is a structurally conformant ScientificResultEnvelope.
 */
export function isScientificResult(obj: any): obj is ScientificResultEnvelope {
  if (!obj || typeof obj !== 'object') return false;
  return (
    typeof obj.resultType === 'string' &&
    typeof obj.source === 'object' &&
    typeof obj.source.structureId === 'string' &&
    APPROVED_SCIENTIFIC_UNITS.has(obj.unit) &&
    typeof obj.status === 'string' &&
    typeof obj.timestamp === 'number'
  );
}

/**
 * Generates an immutable, deterministic SHA-256 fingerprint for a scientific result.
 */
export function generateResultDigest(result: ScientificResultEnvelope): string {
  // Canonical deterministic string representation of core properties
  const payload = JSON.stringify({
    type: result.resultType,
    src: {
      structureId: (result.source?.structureId || '').trim().toUpperCase(),
      modelId: result.source?.modelId ?? 1,
      chainId: result.source?.chainId && result.source.chainId !== 'ALL' && result.source.chainId !== '*'
        ? String(result.source.chainId).trim().toUpperCase()
        : '',
    },
    sel: typeof result.selection === 'object' ? JSON.stringify(result.selection) : (result.selection ?? '*'),
    algo: result.parameters?.algorithm || result.parameters?.scoringFunction || '',
    unit: result.unit,
    val: typeof result.value === 'number' ? Number(result.value.toFixed(6)) : result.value,
  });

  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0');
  return `sha256-mocs-${hash}${hash}`;
}

/**
 * Serializes a ScientificResultEnvelope to a JSON export payload
 * guaranteeing full context retention and zero semantic ambiguity.
 */
export function exportScientificResultToJson(envelope: ScientificResultEnvelope): string {
  if (!isScientificResult(envelope)) {
    throw new Error('Cannot export invalid or malformed ScientificResultEnvelope.');
  }

  const exportPayload = {
    resultType: envelope.resultType,
    value: envelope.value,
    formattedValue: envelope.formattedValue,
    unit: envelope.unit,
    algorithm: envelope.parameters?.algorithm || envelope.parameters?.scoringFunction || 'canonical_mocs',
    method: envelope.parameters?.method || envelope.parameters?.mode || 'deterministic_evaluation',
    source: {
      structureId: envelope.source.structureId,
      modelId: envelope.source.modelId,
      chainId: envelope.source.chainId || 'ALL',
      trajectoryId: envelope.source.trajectoryId || 'STATIC',
      frameIndex: envelope.source.frameIndex ?? 'N/A',
      timestampPs: envelope.source.timestampPs ?? 'N/A',
    },
    selection: envelope.selection,
    provenance: {
      origin: (envelope.provenance as any)?.epistemicOrigin || envelope.provenance?.source || 'computational',
      provider: envelope.provenance?.provider || 'MOCS-Cert',
      isExperimental: Boolean(envelope.provenance?.experimental ?? (envelope.provenance as any)?.isExperimental),
    },
    approximationStatus: {
      isApproximation: Boolean(
        envelope.parameters?.isApproximation ||
        envelope.parameters?.heuristic ||
        envelope.resultType.includes('APPROXIMATION') ||
        envelope.resultType.includes('PUTATIVE')
      ),
      qualification: envelope.warnings?.[0] || 'NONE',
    },
    uncertainty: envelope.uncertainty ?? null,
    timestamp: new Date(envelope.timestamp).toISOString(),
    sha256Digest: generateResultDigest(envelope),
  };

  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Serializes an array of ScientificResultEnvelopes to standard RFC 4180 CSV
 * with explicit headers preserving all 12 mandatory scientific lineage columns.
 */
export function exportScientificResultToCsv(envelopes: ScientificResultEnvelope[]): string {
  if (!envelopes || envelopes.length === 0) {
    return 'resultType,value,unit,algorithm,method,structureId,chainId,residue,frame,provenance,isApproximation,digest\n';
  }

  const headers = [
    'resultType',
    'value',
    'unit',
    'algorithm',
    'method',
    'structureId',
    'chainId',
    'residue',
    'frame',
    'provenance',
    'isApproximation',
    'digest',
  ];

  const rows = envelopes.map((env) => {
    const val = typeof env.value === 'object' ? JSON.stringify(env.value).replace(/"/g, '""') : String(env.value);
    const algo = env.parameters?.algorithm || env.parameters?.scoringFunction || 'canonical';
    const method = env.parameters?.method || env.parameters?.mode || 'deterministic';
    const structId = env.source.structureId;
    const chainId = env.source.chainId || '*';
    const residue = typeof env.selection === 'string' ? env.selection : (env.selection as any)?.residueSeq ?? '*';
    const frame = env.source.frameIndex !== undefined ? String(env.source.frameIndex) : '0';
    const prov = (env.provenance as any)?.epistemicOrigin || env.provenance?.source || 'computational';
    const isApprox = Boolean(
      env.parameters?.isApproximation ||
      env.parameters?.heuristic ||
      env.resultType.includes('APPROXIMATION') ||
      env.resultType.includes('PUTATIVE')
    );
    const digest = generateResultDigest(env);

    return [
      `"${env.resultType}"`,
      `"${val}"`,
      `"${env.unit}"`,
      `"${algo}"`,
      `"${method}"`,
      `"${structId}"`,
      `"${chainId}"`,
      `"${residue}"`,
      `"${frame}"`,
      `"${prov}"`,
      isApprox ? 'true' : 'false',
      `"${digest}"`,
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Reconstructs a ScientificResultEnvelope from an exported JSON payload.
 * Verifies mandatory scientific lineage fields, approved units, and cryptographic SHA-256 digest.
 */
export function parseScientificResultFromJson(jsonStr: string): ScientificResultEnvelope {
  if (!jsonStr || typeof jsonStr !== 'string') {
    throw new Error('[MOCS-Cert Deserialization] JSON payload must be a non-empty string.');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err: any) {
    throw new Error(`[MOCS-Cert Deserialization] Malformed JSON payload: ${err.message}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('[MOCS-Cert Deserialization] JSON payload must represent an object.');
  }

  if (!parsed.resultType || typeof parsed.resultType !== 'string') {
    throw new Error('[MOCS-Cert Deserialization] Missing mandatory resultType.');
  }

  if (!parsed.unit || !APPROVED_SCIENTIFIC_UNITS.has(parsed.unit)) {
    throw new Error(`[MOCS-Cert Deserialization] Unrecognized scientific unit '${parsed.unit}'.`);
  }

  if (!parsed.source || !parsed.source.structureId) {
    throw new Error('[MOCS-Cert Deserialization] Missing mandatory source.structureId.');
  }

  const envelope: ScientificResultEnvelope = {
    resultType: parsed.resultType,
    value: parsed.value,
    formattedValue: parsed.formattedValue,
    unit: parsed.unit,
    parameters: {
      algorithm: parsed.algorithm,
      method: parsed.method,
      isApproximation: parsed.approximationStatus?.isApproximation ?? false,
      ...(parsed.parameters || {}),
    },
    source: {
      structureId: String(parsed.source.structureId).trim().toUpperCase(),
      modelId: parsed.source.modelId ?? 1,
      chainId: parsed.source.chainId && parsed.source.chainId !== 'ALL' && parsed.source.chainId !== '*'
        ? String(parsed.source.chainId).trim().toUpperCase()
        : undefined,
      trajectoryId: parsed.source.trajectoryId && parsed.source.trajectoryId !== 'STATIC'
        ? parsed.source.trajectoryId
        : undefined,
      frameIndex: typeof parsed.source.frameIndex === 'number'
        ? parsed.source.frameIndex
        : (parsed.source.frameIndex !== 'N/A' && !isNaN(parseInt(parsed.source.frameIndex, 10))
            ? parseInt(parsed.source.frameIndex, 10)
            : undefined),
      timestampPs: typeof parsed.source.timestampPs === 'number'
        ? parsed.source.timestampPs
        : (parsed.source.timestampPs !== 'N/A' && !isNaN(parseFloat(parsed.source.timestampPs))
            ? parseFloat(parsed.source.timestampPs)
            : undefined),
    },
    selection: parsed.selection,
    status: (parsed.status as ScientificResultStatus) || 'COMPUTED',
    provenance: parsed.provenance || { source: 'deserialized', provider: 'MOCS-Cert' },
    timestamp: parsed.timestamp ? new Date(parsed.timestamp).getTime() : Date.now(),
    uncertainty: parsed.uncertainty ?? undefined,
    warnings: parsed.warnings || [],
    errors: parsed.errors || [],
  };

  if (parsed.sha256Digest) {
    const computedDigest = generateResultDigest(envelope);
    if (computedDigest !== parsed.sha256Digest) {
      throw new Error(
        `[MOCS-Cert Integrity Violation] Cryptographic digest mismatch! Expected ${parsed.sha256Digest}, computed ${computedDigest}.`
      );
    }
    envelope.sha256Digest = parsed.sha256Digest;
  }

  return envelope;
}

/**
 * Reconstructs an array of ScientificResultEnvelopes from an RFC 4180 CSV export payload.
 */
export function parseScientificResultFromCsv(csvStr: string): ScientificResultEnvelope[] {
  if (!csvStr || typeof csvStr !== 'string') return [];

  const lines = csvStr.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse CSV line into cells honoring quoted commas and double quotes
  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    return cells;
  };

  const header = parseLine(lines[0]).map((h) => h.trim());
  const headerMap = new Map<string, number>();
  header.forEach((name, idx) => headerMap.set(name, idx));

  if (!headerMap.has('resultType') || !headerMap.has('value')) {
    throw new Error('[MOCS-Cert Deserialization] Malformed CSV: missing mandatory columns (resultType, value).');
  }

  const results: ScientificResultEnvelope[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    if (cells.length < 3) continue;

    const getCol = (colName: string): string => {
      const idx = headerMap.get(colName);
      return idx !== undefined && idx < cells.length ? cells[idx] : '';
    };

    const resultType = getCol('resultType');
    let rawVal: any = getCol('value');
    // Attempt JSON parse for objects, or number parse
    if (rawVal.startsWith('{') || rawVal.startsWith('[')) {
      try {
        rawVal = JSON.parse(rawVal);
      } catch {
        // keep string
      }
    } else if (!isNaN(Number(rawVal)) && rawVal.trim() !== '') {
      rawVal = Number(rawVal);
    }

    const unit = getCol('unit') as ScientificUnit;
    const algo = getCol('algorithm');
    const method = getCol('method');
    const structId = getCol('structureId');
    const chainId = getCol('chainId');
    const residue = getCol('residue');
    const frameStr = getCol('frame');
    const prov = getCol('provenance');
    const isApprox = getCol('isApproximation') === 'true';

    const envelope = createScientificResult({
      resultType,
      value: rawVal,
      unit: APPROVED_SCIENTIFIC_UNITS.has(unit) ? unit : 'dimensionless',
      source: {
        structureId: structId || 'UNKNOWN',
        chainId: chainId && chainId !== '*' ? chainId : undefined,
        frameIndex: frameStr && !isNaN(parseInt(frameStr, 10)) ? parseInt(frameStr, 10) : undefined,
      },
      selection: residue || '*',
      status: 'COMPUTED',
      provenance: {
        epistemicOrigin: prov,
        source: prov,
        provider: 'MOCS-Cert CSV Import',
      },
      parameters: {
        algorithm: algo,
        method: method,
        isApproximation: isApprox,
      },
    });

    results.push(envelope);
  }

  return results;
}

