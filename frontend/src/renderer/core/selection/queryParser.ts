/**
 * Canonical Query Expression AST Parser.
 * Parses query strings into structured ASTs returning Result<QueryExpression>.
 * No React, no Mol*, no Three.js.
 */

import { Result, ok, err } from '../errors/result.js';

export type QueryAtomTest =
  | { readonly kind: 'chain'; readonly asymId: string }
  | { readonly kind: 'compId'; readonly compId: string }
  | { readonly kind: 'seqId'; readonly seqId: number }
  | { readonly kind: 'insCode'; readonly insCode: string }
  | { readonly kind: 'atomId'; readonly atomId: string }
  | { readonly kind: 'altLoc'; readonly altLoc: string };

export type QueryExpression =
  | { readonly kind: 'all' }
  | { readonly kind: 'tests'; readonly tests: readonly QueryAtomTest[] };

function parseSeqAndIns(s: string): { seq?: number; ins?: string } {
  const m = s.trim().match(/^([+-]?\d+)([A-Za-z])?$/);
  if (m) return { seq: parseInt(m[1], 10), ins: m[2]?.toUpperCase() };
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? {} : { seq: n };
}

/**
 * Parses a query string into a structured QueryExpression AST.
 */
export function parseQueryExpression(raw: string): Result<QueryExpression> {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    return err(new Error('Selection query string is empty'));
  }
  if (trimmed === '*' || trimmed.toLowerCase() === 'all') {
    return ok({ kind: 'all' });
  }
  if (trimmed.includes('::') || trimmed.startsWith(':') || trimmed.endsWith(':')) {
    return err(new Error(`Malformed query string: "${trimmed}"`));
  }

  const parts = trimmed.split(':').map((p) => p.trim());
  const tests: QueryAtomTest[] = [];

  if (parts.length === 1) {
    const { seq } = parseSeqAndIns(parts[0]);
    if (seq !== undefined) {
      tests.push({ kind: 'seqId', seqId: seq });
    } else if (parts[0].length === 1 && /^[A-Za-z0-9]$/.test(parts[0])) {
      tests.push({ kind: 'chain', asymId: parts[0] });
    } else {
      tests.push({ kind: 'compId', compId: parts[0].toUpperCase() });
    }
  } else if (parts.length === 2) {
    const [p0, p1] = parts;
    const { seq, ins } = parseSeqAndIns(p1);
    if (p0.length === 1) {
      tests.push({ kind: 'chain', asymId: p0 });
      if (seq !== undefined) tests.push({ kind: 'seqId', seqId: seq });
      if (ins) tests.push({ kind: 'insCode', insCode: ins });
    } else {
      tests.push({ kind: 'compId', compId: p0.toUpperCase() });
      if (seq !== undefined) tests.push({ kind: 'seqId', seqId: seq });
    }
  } else if (parts.length === 3) {
    const [p0, p1, p2] = parts;
    const { seq: seq1, ins: ins1 } = parseSeqAndIns(p1);
    const { seq: seq2 } = parseSeqAndIns(p2);

    if (seq1 !== undefined && seq2 === undefined) {
      if (p0.length === 1) {
        tests.push({ kind: 'chain', asymId: p0 });
      } else {
        tests.push({ kind: 'compId', compId: p0.toUpperCase() });
      }
      tests.push({ kind: 'seqId', seqId: seq1 });
      if (ins1) tests.push({ kind: 'insCode', insCode: ins1 });
      tests.push({ kind: 'atomId', atomId: p2 });
    } else if (seq1 === undefined && seq2 !== undefined) {
      tests.push({ kind: 'chain', asymId: p0 });
      tests.push({ kind: 'compId', compId: p1.toUpperCase() });
      tests.push({ kind: 'seqId', seqId: seq2 });
    } else {
      return err(new Error(`Cannot parse 3-part query: "${trimmed}"`));
    }
  } else if (parts.length === 4) {
    const [p0, p1, p2, p3] = parts;
    const { seq, ins } = parseSeqAndIns(p2);
    tests.push({ kind: 'chain', asymId: p0 });
    tests.push({ kind: 'compId', compId: p1.toUpperCase() });
    if (seq !== undefined) tests.push({ kind: 'seqId', seqId: seq });
    if (ins) tests.push({ kind: 'insCode', insCode: ins });
    tests.push({ kind: 'atomId', atomId: p3 });
  } else {
    return err(new Error(`Query has too many parts (${parts.length}): "${trimmed}"`));
  }

  return ok({ kind: 'tests', tests });
}
