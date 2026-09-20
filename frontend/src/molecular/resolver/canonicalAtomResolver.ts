/**
 * Authoritative Canonical Atom & Residue Resolver
 *
 * Epistemic Status: ESTABLISHED
 *
 * Resolves user identifiers across arbitrary datasets (4HHB, 1BNA, 1TUP, synth_500f, 6VXX):
 * - Exact single atoms: "A:155:CA", "A:87:NE2", "A:1:O5'", "LIG:1:O2", "HEM:142:FE"
 * - Residue targets: "A:248", "A:248:ARG", "E:11", "E:11:DT", "HEM:142"
 * - Models and AltLocs: "M1:A:87:NE2", "A:87:NE2@A"
 *
 * Returns typed CanonicalResolutionResult. Fails closed with typed error records,
 * never returning undefined or letting downstream code crash with .ref.
 */

import { CanonicalStructure, resolveAtomQuery, parseAtomQuery, ParsedAtomQuery, ResolvedAtomMatch } from '@mocs/core';

export type CanonicalResolutionError =
  | { kind: 'DATASET_NOT_READY'; query: string; datasetId?: string; reason: string }
  | { kind: 'STRUCTURE_NOT_READY'; query: string; datasetId?: string; reason: string }
  | { kind: 'ATOM_NOT_FOUND'; query: string; datasetId: string; reason: string }
  | { kind: 'RESIDUE_NOT_FOUND'; query: string; datasetId: string; reason: string }
  | { kind: 'AMBIGUOUS_MATCH'; query: string; datasetId: string; matchCount: number; matches: ResolvedAtomMatch[]; reason: string }
  | { kind: 'INVALID_QUERY'; query: string; reason: string };

export interface CanonicalAtomMatch extends ResolvedAtomMatch {
  readonly atomName: string;
  readonly residueName: string;
  readonly resSeq: number;
  readonly residueId: number;
  readonly chainId: string;
}

export interface CanonicalResolutionSuccess {
  readonly ok: true;
  readonly targetType: 'atom' | 'residue';
  readonly query: string;
  readonly datasetId: string;
  readonly matches: readonly CanonicalAtomMatch[];
  readonly primaryMatch: CanonicalAtomMatch;
  readonly centroid: readonly [number, number, number];
  readonly boundingRadius: number;
  readonly label: string;
}

export type CanonicalResolutionResult =
  | CanonicalResolutionSuccess
  | { readonly ok: false; readonly error: CanonicalResolutionError };

/**
 * Normalizes query string delimiters (slashes, spaces) to canonical colon notation.
 */
export function normalizeIdentifierQuery(query: string): string {
  if (!query) return '';
  const trimmed = query.trim();
  // Strip 'Chain ' prefix if present: "Chain A · HIS 87 · NE2" -> "A:87:NE2"
  if (/^chain\s+[A-Za-z0-9]/i.test(trimmed)) {
    const parts = trimmed.split(/[·•\s]+/).filter(Boolean);
    if (parts.length >= 3) {
      const chain = parts[1];
      const res = parts[2];
      const seq = parts[3];
      const atom = parts[4];
      if (atom) {
        return `${chain}:${seq}:${atom}`;
      }
      return `${chain}:${seq}`;
    }
  }
  return trimmed.replace(/[/\s]+/g, ':').replace(/:+/g, ':');
}

/**
 * Authoritative Canonical Resolver: Resolves any atom or residue query
 * against a CanonicalStructure, returning typed success or typed error.
 */
export function resolveCanonicalIdentifier(
  structure: CanonicalStructure | null | undefined,
  queryInput: string,
  options: { preferredChain?: string; modelNum?: number } = {}
): CanonicalResolutionResult {
  const query = (queryInput || '').trim();
  if (!query) {
    return {
      ok: false,
      error: {
        kind: 'INVALID_QUERY',
        query,
        reason: 'Empty molecular identifier query string',
      },
    };
  }

  if (!structure) {
    return {
      ok: false,
      error: {
        kind: 'STRUCTURE_NOT_READY',
        query,
        reason: 'Structural coordinate model is not loaded or ready',
      },
    };
  }

  const normalized = normalizeIdentifierQuery(query);
  let parsed: ParsedAtomQuery;
  try {
    parsed = parseAtomQuery(normalized);
  } catch (err: any) {
    return {
      ok: false,
      error: {
        kind: 'INVALID_QUERY',
        query,
        reason: err?.message || `Unrecognized query syntax: '${query}'`,
      },
    };
  }

  let matches: ResolvedAtomMatch[] = [];
  try {
    matches = resolveAtomQuery(structure, parsed, {
      allowMultiMatch: true,
      preferredChain: options.preferredChain,
      modelNum: options.modelNum,
    });
  } catch {
    matches = [];
  }

  // If no matches were found, but chain and resSeq were provided, check for chain offset / ordinal numbering
  // (e.g. 1TUP DNA chain E numbered 1001-1021 where E:11 or E:11:DT refers to the 11th residue / 1011)
  if (matches.length === 0 && parsed.chain && parsed.resSeq !== undefined) {
    const chainAtoms = structure.topology.atoms.filter(
      (a) => a.chain.toUpperCase() === parsed.chain!.toUpperCase()
    );
    if (chainAtoms.length > 0) {
      // 1. Check 1000/2000 offset
      const offsets = [1000, 2000, 3000];
      for (const off of offsets) {
        const candidateSeq = parsed.resSeq + off;
        try {
          const candidateMatches = resolveAtomQuery(structure, { ...parsed, resSeq: candidateSeq }, {
            allowMultiMatch: true,
            preferredChain: options.preferredChain,
            modelNum: options.modelNum,
          });
          if (candidateMatches.length > 0) {
            matches = candidateMatches;
            break;
          }
        } catch {
          // continue search
        }
      }

      // 2. If still no matches, check 1-based ordinal residue order in chain
      if (matches.length === 0) {
        const uniqueResSeqs: number[] = [];
        const seen = new Set<number>();
        for (const a of chainAtoms) {
          if (!seen.has(a.resSeq)) {
            seen.add(a.resSeq);
            uniqueResSeqs.push(a.resSeq);
          }
        }
        uniqueResSeqs.sort((a, b) => a - b);
        if (parsed.resSeq >= 1 && parsed.resSeq <= uniqueResSeqs.length) {
          const candidateSeq = uniqueResSeqs[parsed.resSeq - 1];
          try {
            const candidateMatches = resolveAtomQuery(structure, { ...parsed, resSeq: candidateSeq }, {
              allowMultiMatch: true,
              preferredChain: options.preferredChain,
              modelNum: options.modelNum,
            });
            if (candidateMatches.length > 0) {
              matches = candidateMatches;
            }
          } catch {
            // continue search
          }
        }
      }
    }
  }

  // If multiple matches were found and a preferredChain is specified, filter to the preferredChain
  if (matches.length > 1 && options.preferredChain) {
    const preferred = matches.filter((m) => m.sourceAtomId.chain === options.preferredChain);
    if (preferred.length > 0) {
      matches = preferred;
    }
  }

  if (matches.length === 0) {
    return {
      ok: false,
      error: parsed.atomName
        ? {
            kind: 'ATOM_NOT_FOUND',
            query,
            datasetId: structure.datasetId,
            reason: `No matching atoms for '${query}' in dataset '${structure.datasetId}'`,
          }
        : {
            kind: 'RESIDUE_NOT_FOUND',
            query,
            datasetId: structure.datasetId,
            reason: `No matching residue for '${query}' in dataset '${structure.datasetId}'`,
          },
    };
  }

  // Calculate 3D geometric centroid across all matched atoms
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  for (let i = 0; i < matches.length; i++) {
    const p = matches[i].position;
    sumX += p[0];
    sumY += p[1];
    sumZ += p[2];
  }
  const centroid: [number, number, number] = [
    Number((sumX / matches.length).toFixed(3)),
    Number((sumY / matches.length).toFixed(3)),
    Number((sumZ / matches.length).toFixed(3)),
  ];

  // Calculate bounding sphere radius enclosing all matched atoms
  let maxDistSq = 0;
  for (let i = 0; i < matches.length; i++) {
    const p = matches[i].position;
    const dx = p[0] - centroid[0];
    const dy = p[1] - centroid[1];
    const dz = p[2] - centroid[2];
    const dSq = dx * dx + dy * dy + dz * dz;
    if (dSq > maxDistSq) maxDistSq = dSq;
  }
  const boundingRadius = Number(Math.max(0.85, Math.sqrt(maxDistSq)).toFixed(2));

  // Determine target type & primary representative match
  const isExactAtom = Boolean(parsed.atomName);
  let rawPrimary = matches[0];

  if (isExactAtom) {
    rawPrimary = matches[0];
  } else {
    // Representative atom heuristic for residues: CA for protein, C1'/P for nucleic
    const caMatch = matches.find((m) => m.sourceAtomId.atom.toUpperCase() === 'CA');
    const nucleicMatch = matches.find((m) =>
      ["C1'", 'P', "O5'", "C3'"].includes(m.sourceAtomId.atom.toUpperCase())
    );
    if (caMatch) {
      rawPrimary = caMatch;
    } else if (nucleicMatch) {
      rawPrimary = nucleicMatch;
    } else {
      rawPrimary = matches[0];
    }
  }

  const primaryMatch: CanonicalAtomMatch = {
    ...rawPrimary,
    atomName: rawPrimary.sourceAtomId.atom,
    residueName: rawPrimary.sourceAtomId.component,
    resSeq: rawPrimary.sourceAtomId.seq,
    residueId: rawPrimary.sourceAtomId.seq,
    chainId: rawPrimary.sourceAtomId.chain,
  };

  const richMatches: CanonicalAtomMatch[] = matches.map((m) => ({
    ...m,
    atomName: m.sourceAtomId.atom,
    residueName: m.sourceAtomId.component,
    resSeq: m.sourceAtomId.seq,
    residueId: m.sourceAtomId.seq,
    chainId: m.sourceAtomId.chain,
  }));

  const s = primaryMatch.sourceAtomId;
  const label = isExactAtom
    ? `Chain ${s.chain} · ${s.component} ${s.seq} · ${s.atom}`
    : `Chain ${s.chain} · ${s.component} ${s.seq}`;

  return {
    ok: true,
    targetType: isExactAtom ? 'atom' : 'residue',
    query,
    datasetId: structure.datasetId,
    matches: richMatches,
    primaryMatch,
    centroid,
    boundingRadius,
    label,
  };
}
