/**
 * Dynamic API and WebSocket configuration for MOCS-Cert.
 *
 * Defaults:
 * - When running on localhost / 127.0.0.1 (local Vite dev or local tests):
 *   Uses relative '/api/v1' and local WebSocket proxy.
 * - When running on a remote cloud deployment (e.g. Cloudflare Pages, Workers):
 *   Defaults to the live Render backend at https://mocs-cert.onrender.com.
 * - Can be explicitly overridden at any time via VITE_API_BASE_URL and VITE_WS_BASE_URL.
 */

const DEFAULT_RENDER_ORIGIN = 'https://mocs-cert.onrender.com';
const DEFAULT_RENDER_WS = 'wss://mocs-cert.onrender.com';

export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    const isLocal =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '';
    if (isLocal) {
      return '/api/v1';
    }
    return `${DEFAULT_RENDER_ORIGIN}/api/v1`;
  }

  return '/api/v1';
}

export function getWsEndpoint(): string {
  const envWs = import.meta.env.VITE_WS_BASE_URL;
  if (typeof envWs === 'string' && envWs.trim().length > 0) {
    return envWs.trim().replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    const isLocal =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '';
    if (isLocal) {
      const defaultProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const defaultHost = window.location.host || 'localhost:8000';
      return `${defaultProto}//${defaultHost}/ws/query`;
    }
    return `${DEFAULT_RENDER_WS}/ws/query`;
  }

  return 'ws://localhost:8000/ws/query';
}
