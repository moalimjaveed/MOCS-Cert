import { ParsedAtomQuery } from './query.js';

/**
 * Parses user or scientific query strings into structured queries.
 * Examples:
 *   - "A:87:NE2" -> chain: 'A', resSeq: 87, atomName: 'NE2'
 *   - "HEM:142:FE" -> resName: 'HEM', resSeq: 142, atomName: 'FE'
 *   - "A:87:NE2@A" -> altLoc: 'A'
 *   - "M1:A:87:NE2" -> modelNum: 1
 */
export function parseAtomQuery(queryString: string): ParsedAtomQuery {
  const raw = queryString.trim();
  if (!raw) {
    throw new Error('Atom query string cannot be empty');
  }

  let str = raw;
  let modelNum: number | undefined;
  let altLoc: string | undefined;

  // Extract altLoc if present (@A)
  const altIndex = str.indexOf('@');
  if (altIndex !== -1) {
    altLoc = str.slice(altIndex + 1);
    str = str.slice(0, altIndex);
  }

  // Extract model prefix if present (M1:...)
  if (/^M\d+:/i.test(str)) {
    const colon = str.indexOf(':');
    modelNum = parseInt(str.slice(1, colon), 10);
    str = str.slice(colon + 1);
  }

  const parts = str.split(':');

  const STANDARD_RESIDUES = new Set([
    'ALA', 'ARG', 'ASN', 'ASP', 'CYS', 'GLN', 'GLU', 'GLY', 'HIS', 'ILE',
    'LEU', 'LYS', 'MET', 'PHE', 'PRO', 'SER', 'THR', 'TRP', 'TYR', 'VAL',
    'MSE', 'SEC', 'PYL',
    'DA', 'DT', 'DC', 'DG', 'DI', 'A', 'U', 'C', 'G', 'I',
    'HEM', 'BTN', 'ATP', 'ADP', 'GTP', 'GDP', 'NAD', 'FAD', 'LIG', 'HOH', 'WAT'
  ]);

  if (parts.length === 4) {
    // E.g. "A:HEM:142:FE" or "A:87:HIS:NE2"
    let seq = parseInt(parts[2], 10);
    if (!Number.isNaN(seq)) {
      return {
        chain: parts[0],
        resName: parts[1],
        resSeq: seq,
        atomName: parts[3],
        altLoc,
        modelNum,
        raw,
      };
    }
    seq = parseInt(parts[1], 10);
    if (!Number.isNaN(seq)) {
      return {
        chain: parts[0],
        resSeq: seq,
        resName: parts[2],
        atomName: parts[3],
        altLoc,
        modelNum,
        raw,
      };
    }
    throw new Error(`Invalid sequence number in query: '${raw}'`);
  }

  if (parts.length === 3) {
    const seq = parseInt(parts[1], 10);
    if (Number.isNaN(seq)) {
      // Could be chain:resName:seq, e.g. A:ARG:248
      const altSeq = parseInt(parts[2], 10);
      if (!Number.isNaN(altSeq)) {
        return { chain: parts[0], resName: parts[1], resSeq: altSeq, altLoc, modelNum, raw };
      }
      throw new Error(`Invalid sequence number in query: '${raw}'`);
    }

    if (parts[0].length <= 2) {
      // Check if parts[2] is a recognized residue name (e.g. A:248:ARG or E:11:DT)
      const upper3 = parts[2].toUpperCase();
      if (STANDARD_RESIDUES.has(upper3)) {
        return { chain: parts[0], resSeq: seq, resName: parts[2], altLoc, modelNum, raw };
      }
      return { chain: parts[0], resSeq: seq, atomName: parts[2], altLoc, modelNum, raw };
    } else {
      return { resName: parts[0], resSeq: seq, atomName: parts[2], altLoc, modelNum, raw };
    }
  }

  if (parts.length === 2) {
    const seq = parseInt(parts[1], 10);
    if (!Number.isNaN(seq)) {
      if (parts[0].length <= 2) {
        return { chain: parts[0], resSeq: seq, altLoc, modelNum, raw };
      } else {
        return { resName: parts[0], resSeq: seq, altLoc, modelNum, raw };
      }
    }
    // E.g. A:CA
    return { chain: parts[0], atomName: parts[1], altLoc, modelNum, raw };
  }

  if (parts.length === 1) {
    if (parts[0].length <= 2 && /^[A-Za-z0-9]+$/.test(parts[0])) {
      return { chain: parts[0], altLoc, modelNum, raw };
    }
    return { resName: parts[0], altLoc, modelNum, raw };
  }

  throw new Error(`Unrecognized query format: '${raw}'`);
}
