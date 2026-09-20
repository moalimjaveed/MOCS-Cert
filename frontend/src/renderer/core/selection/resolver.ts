import { CanonicalStructure } from '../structure/structure.js';
import { ParsedAtomQuery } from './query.js';
import { parseAtomQuery } from './parser.js';
import { ResolvedAtomMatch } from './ambiguity.js';
import { ScientificAmbiguityError, ScientificError } from '../errors/errors.js';

export interface ResolveOptions {
  readonly modelNum?: number;
  readonly entityId?: string;
  readonly allowMultiMatch?: boolean;
  readonly preferredChain?: string;
}

/**
 * Resolves an atom query string or parsed query against canonical structure.
 * Fails closed on ambiguous matches.
 */
export function resolveAtomQuery(
  structure: CanonicalStructure,
  queryInput: string | ParsedAtomQuery,
  options?: ResolveOptions
): ResolvedAtomMatch[] {
  const query = typeof queryInput === 'string' ? parseAtomQuery(queryInput) : queryInput;
  const targetModelNum = query.modelNum ?? options?.modelNum ?? structure.models[0]?.modelNum ?? 1;

  const model = structure.models.find((m) => m.modelNum === targetModelNum);
  if (!model) {
    throw new ScientificError(`Model ${targetModelNum} does not exist in dataset '${structure.datasetId}'`);
  }

  const matches: ResolvedAtomMatch[] = [];
  const atoms = structure.topology.atoms;
  const coords = model.coordinates;

  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i];

    if (query.chain && a.chain.toUpperCase() !== query.chain.toUpperCase()) {
      continue;
    }
    if (query.resSeq !== undefined && a.resSeq !== query.resSeq) {
      continue;
    }
    if (query.resName && a.resName.toUpperCase() !== query.resName.toUpperCase()) {
      continue;
    }
    if (query.atomName && a.name.toUpperCase() !== query.atomName.toUpperCase()) {
      continue;
    }
    if (query.altLoc && (a.altLoc || '').toUpperCase() !== query.altLoc.toUpperCase()) {
      continue;
    }
    if (options?.entityId && a.entityId && a.entityId !== options.entityId) {
      continue;
    }

    const pos: [number, number, number] = [coords[i * 3], coords[i * 3 + 1], coords[i * 3 + 2]];

    matches.push({
      atomIndex: i,
      position: pos,
      sourceAtomId: {
        dataset: structure.datasetId,
        model: targetModelNum,
        entity: a.entityId || '1',
        chain: a.chain,
        seq: a.resSeq,
        insertionCode: a.insCode,
        component: a.resName,
        atom: a.name,
        altLoc: a.altLoc,
      },
    });
  }

  if (matches.length === 0) {
    throw new ScientificError(`No matching atoms found for query '${query.raw}' in dataset '${structure.datasetId}'`);
  }

  // If exact single atom query was requested (i.e. atomName was specified and not allowMultiMatch)
  if (query.atomName && !options?.allowMultiMatch) {
    if (matches.length > 1) {
      // Check if they are alternate locations
      const altLocs = new Set(matches.map((m) => m.sourceAtomId.altLoc || 'none'));
      if (altLocs.size > 1 && !query.altLoc) {
        throw new ScientificAmbiguityError(
          query.raw,
          matches.length,
          matches,
          `Query '${query.raw}' has multiple alternate locations (${Array.from(altLocs).join(', ')}). Specify @altLoc to resolve.`
        );
      }
      // Check if multiple chains or entities matched
      const chains = new Set(matches.map((m) => m.sourceAtomId.chain));
      if (chains.size > 1 && !query.chain) {
        if (options?.preferredChain && chains.has(options.preferredChain)) {
          const preferredMatches = matches.filter((m) => m.sourceAtomId.chain === options.preferredChain);
          if (preferredMatches.length === 1) {
            return preferredMatches;
          }
        }
        throw new ScientificAmbiguityError(
          query.raw,
          matches.length,
          matches,
          `Query '${query.raw}' matches multiple chains (${Array.from(chains).join(', ')}). Specify chain to resolve.`
        );
      }

      throw new ScientificAmbiguityError(query.raw, matches.length, matches);
    }
  }

  return matches;
}

/**
 * Resolves a single exact atom. Fails closed if not exactly 1 match.
 */
export function resolveExactAtom(
  structure: CanonicalStructure,
  queryInput: string | ParsedAtomQuery,
  options?: ResolveOptions
): ResolvedAtomMatch {
  const matches = resolveAtomQuery(structure, queryInput, { ...options, allowMultiMatch: false });
  if (matches.length !== 1) {
    throw new ScientificAmbiguityError(
      typeof queryInput === 'string' ? queryInput : queryInput.raw,
      matches.length,
      matches
    );
  }
  return matches[0];
}
