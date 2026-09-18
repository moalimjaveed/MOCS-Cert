/**
 * PDB CONECT Record Parser & Multiplicity Resolver
 * 
 * Epistemic Rules:
 * 1. PDB CONECT records explicitly specify connectivity between non-standard residues,
 *    ligands, cofactors, metal ions, and crosslinks.
 * 2. Repeated bonded atom serials in CONECT records represent higher bond orders (double, triple).
 * 3. Never invent connections where CONECT lines are malformed.
 */

import { buildCanonicalBondKey } from './atomIdentity';
import type { CanonicalAtomKey, CanonicalBondKey, BondType } from './types';

export interface ParsedConectBond {
  key: CanonicalBondKey;
  atomAKey: CanonicalAtomKey;
  atomBKey: CanonicalAtomKey;
  multiplicity: number; // 1 = single, 2 = double, 3 = triple
  bondType: BondType;
}

/**
 * Parses raw PDB text lines and extracts deposited CONECT records.
 * Resolves atom serial numbers to CanonicalAtomKeys using the provided serial-to-atom key lookup.
 */
export function parsePdbConectRecords(
  pdbText: string,
  serialToKeyMap: Map<number, CanonicalAtomKey>
): ParsedConectBond[] {
  if (!pdbText) return [];

  const lines = pdbText.split(/\r?\n/);
  // Count frequency of undirected pairs to resolve bond multiplicity
  const pairCounts = new Map<CanonicalBondKey, { keyA: CanonicalAtomKey; keyB: CanonicalAtomKey; count: number }>();

  for (const line of lines) {
    if (!line.startsWith('CONECT')) continue;

    const sourceSerialStr = line.substring(6, 11).trim();
    if (!sourceSerialStr) continue;
    const sourceSerial = parseInt(sourceSerialStr, 10);
    if (!Number.isFinite(sourceSerial)) continue;

    const sourceKey = serialToKeyMap.get(sourceSerial);
    if (!sourceKey) continue;

    // CONECT lines contain up to 4 targets per line in columns (11-16, 16-21, 21-26, 26-31)
    // Additional target fields can appear in continuation lines or extended columns
    const targetCols = [
      line.substring(11, 16),
      line.substring(16, 21),
      line.substring(21, 26),
      line.substring(26, 31),
    ];

    for (const col of targetCols) {
      const targetSerialStr = col.trim();
      if (!targetSerialStr) continue;
      const targetSerial = parseInt(targetSerialStr, 10);
      if (!Number.isFinite(targetSerial)) continue;

      if (sourceSerial === targetSerial) {
        // Discard malformed self-loop
        continue;
      }

      const targetKey = serialToKeyMap.get(targetSerial);
      if (!targetKey) continue;

      const bondKey = buildCanonicalBondKey(sourceKey, targetKey);
      if (!pairCounts.has(bondKey)) {
        pairCounts.set(bondKey, {
          keyA: sourceKey < targetKey ? sourceKey : targetKey,
          keyB: sourceKey < targetKey ? targetKey : sourceKey,
          count: 0,
        });
      }

      pairCounts.get(bondKey)!.count++;
    }
  }

  const result: ParsedConectBond[] = [];
  for (const [bondKey, item] of pairCounts.entries()) {
    // In standard PDB, each direction (A->B and B->A) can be listed once for a single bond.
    // When double bonds are explicitly represented in PDB, the serial is listed twice in each direction (count = 4)
    // or listed twice in one direction (count = 2).
    let multiplicity = 1;
    if (item.count >= 6) {
      multiplicity = 3;
    } else if (item.count >= 4) {
      multiplicity = 2;
    }

    let bondType: BondType = 'COVALENT_SINGLE';
    if (multiplicity === 2) bondType = 'COVALENT_DOUBLE';
    else if (multiplicity === 3) bondType = 'COVALENT_TRIPLE';

    result.push({
      key: bondKey,
      atomAKey: item.keyA,
      atomBKey: item.keyB,
      multiplicity,
      bondType,
    });
  }

  return result;
}
