/**
 * Typed REST API client for MOCS-Cert backend.
 */

import type {
  QueryCompileResponse,
  QueryExecuteResponse,
  QueryExecuteRequest,
  ExecutionErrorCode
} from '../types/query';
import type { BlockLatticeItem, BlockRefineResponse } from '../types/timeline';
import type { CertificateVerifyResponse } from '../types/certificate';
import type { BenchmarkResponse } from '../types/benchmark';

import { getApiBaseUrl } from './config';

const getBase = () => getApiBaseUrl();

export interface ApiErrorOptions {
  errorCode?: ExecutionErrorCode;
  location?: string;
  action?: string;
  detail?: string;
  status?: number;
}

interface ApiErrorEnvelope {
  error_code?: ExecutionErrorCode;
  message?: string;
  location?: string;
  action?: string;
  detail?: unknown;
}

export class ApiError extends Error {
  errorCode: ExecutionErrorCode;
  location?: string;
  action?: string;
  detail?: string;
  status: number;

  constructor(
    message: string,
    statusOrOptions?: number | ApiErrorOptions,
    maybeOptions?: ApiErrorOptions
  ) {
    super(message);
    this.name = 'ApiError';
    const opts: ApiErrorOptions = (typeof statusOrOptions === 'object' && statusOrOptions !== null)
      ? statusOrOptions
      : (maybeOptions || {});
    const status = typeof statusOrOptions === 'number'
      ? statusOrOptions
      : (opts.status || 500);

    this.status = status;
    this.errorCode = opts.errorCode || 'SERVER_ERROR';
    this.location = opts.location;
    this.action = opts.action;
    this.detail = opts.detail;
  }
}

async function handleResponse<T>(res: Response, fallbackPrefix: string): Promise<T> {
  if (res.ok) {
    return res.json();
  }

  let errorBody: ApiErrorEnvelope | null = null;
  try {
    const parsed: unknown = await res.json();
    if (parsed !== null && typeof parsed === 'object') {
      errorBody = parsed as ApiErrorEnvelope;
    }
  } catch {
    // Non-JSON error payload
  }

  if (errorBody) {
    const errorCode: ExecutionErrorCode = errorBody.error_code || (res.status === 400 ? 'PARSE_FAILED' : 'SERVER_ERROR');
    const detail = typeof errorBody.detail === 'string'
      ? errorBody.detail
      : errorBody.detail === undefined ? undefined : JSON.stringify(errorBody.detail);
    const message = errorBody.message || detail || `${fallbackPrefix}: ${res.statusText}`;
    throw new ApiError(message, {
      errorCode,
      location: errorBody.location,
      action: errorBody.action,
      detail,
      status: res.status,
    });
  }

  throw new ApiError(`${fallbackPrefix}: ${res.statusText || 'Unknown Error'}`, {
    errorCode: 'SERVER_ERROR',
    status: res.status,
  });
}

export async function fetchTrajectoryMetadata(): Promise<Record<string, any>> {
  const res = await fetch(`${getBase()}/trajectories`);
  return handleResponse<Record<string, any>>(res, 'Failed to fetch trajectory metadata');
}

export async function fetchBlocks(): Promise<BlockLatticeItem[]> {
  const res = await fetch(`${getBase()}/trajectories/blocks`);
  return handleResponse<BlockLatticeItem[]>(res, 'Failed to fetch trajectory blocks');
}

export async function fetchBlockById(blockId: number): Promise<BlockLatticeItem> {
  const res = await fetch(`${getBase()}/trajectories/blocks/${blockId}`);
  return handleResponse<BlockLatticeItem>(res, `Failed to fetch block ${blockId}`);
}

export async function compileQuery(
  queryText: string,
  options?: Partial<QueryExecuteRequest>
): Promise<QueryCompileResponse> {
  const res = await fetch(`${getBase()}/query/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query_text: queryText,
      trajectory_id: options?.trajectory_id || 'synth_500f.xtc',
      sampling_semantics: options?.sampling_semantics || 'sampled_frames',
      pbc_mode: options?.pbc_mode || 'auto',
      precision: options?.precision || 'float64',
      bounding_model: options?.bounding_model || 'AABB',
    }),
  });
  return handleResponse<QueryCompileResponse>(res, 'Compilation failed');
}

export async function executeQuery(
  queryText: string,
  options?: Partial<QueryExecuteRequest>
): Promise<QueryExecuteResponse> {
  const res = await fetch(`${getBase()}/query/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query_text: queryText,
      trajectory_id: options?.trajectory_id || 'synth_500f.xtc',
      sampling_semantics: options?.sampling_semantics || 'sampled_frames',
      pbc_mode: options?.pbc_mode || 'auto',
      precision: options?.precision || 'float64',
      quantifier: options?.quantifier || 'EXISTS',
      bounding_model: options?.bounding_model || 'AABB',
    }),
  });
  return handleResponse<QueryExecuteResponse>(res, 'Query execution failed');
}

export async function refineBlock(blockId: number, subdivisionFactor: number = 2): Promise<BlockRefineResponse> {
  const res = await fetch(`${getBase()}/refine/block`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ block_id: blockId, subdivision_factor: subdivisionFactor }),
  });
  return handleResponse<BlockRefineResponse>(res, 'Block refinement failed');
}

export async function verifyCertificate(certificate: Record<string, any>): Promise<CertificateVerifyResponse> {
  const res = await fetch(`${getBase()}/certificates/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ certificate, verify_hashes: true }),
  });
  return handleResponse<CertificateVerifyResponse>(res, 'Certificate verification failed');
}

export async function fetchBenchmarks(queryId: string = 'q1'): Promise<BenchmarkResponse> {
  const res = await fetch(`${getBase()}/benchmarks?query_id=${encodeURIComponent(queryId)}`);
  return handleResponse<BenchmarkResponse>(res, 'Failed to fetch benchmarks');
}
