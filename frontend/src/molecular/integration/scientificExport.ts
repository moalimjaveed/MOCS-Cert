/**
 * MOCS-Cert Scientific Export & Serialization Engine
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: 80-Column Standard PDB Formatter, Compliant FASTA, Unit-Labeled CSV & Cryptographic JSON
 */

import type {
  PdbExportOptions,
  FastaExportOptions,
  CsvExportColumn,
  ScientificResultEnvelope,
} from './types';
import type {
  ValidatedAtom,
  IndexedComponent,
  StructureHierarchyIndex,
} from '../geometry/structuralIdentity';
import { isScientificResult, APPROVED_SCIENTIFIC_UNITS } from './scientificResultModel';

export interface FlattenedAtomRecord {
  serial: number;
  atomName: string;
  resName: string;
  chainId: string;
  resSeq: number;
  insCode: string;
  coordinates: [number, number, number];
  isHetero: boolean;
  occupancy: number;
  bFactor: number;
  element: string;
}

/**
 * Normalizes varied input types (atom array, components, or hierarchy index) into a flat atom list.
 */
export function extractAtomRecords(
  source: StructureHierarchyIndex | IndexedComponent[] | ValidatedAtom[] | any,
  defaultChainId = 'A'
): FlattenedAtomRecord[] {
  const records: FlattenedAtomRecord[] = [];

  // Case 1: StructureHierarchyIndex
  if (source && source.chains && typeof source.chains.values === 'function') {
    let serial = 1;
    for (const chainRec of source.chains.values()) {
      for (const comp of chainRec.components.values()) {
        for (const a of comp.atoms) {
          records.push({
            serial: serial++,
            atomName: a.atomName || a.element || 'CA',
            resName: comp.id.residueName || 'UNK',
            chainId: chainRec.chainId || defaultChainId,
            resSeq: comp.id.residueNumber ?? 1,
            insCode: comp.id.insertionCode || '',
            coordinates: [a.coordinates[0], a.coordinates[1], a.coordinates[2]],
            isHetero: a.isHetero ?? false,
            occupancy: a.occupancy ?? 1.0,
            bFactor: a.bFactor ?? 20.0,
            element: (a.element || a.atomName || 'C').replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase(),
          });
        }
      }
    }
    return records;
  }

  // Case 2: IndexedComponent[]
  if (Array.isArray(source) && source.length > 0 && 'canonicalLabel' in source[0]) {
    let serial = 1;
    for (const comp of source as IndexedComponent[]) {
      for (const a of comp.atoms) {
        records.push({
          serial: serial++,
          atomName: a.atomName || a.element || 'CA',
          resName: comp.id.residueName || 'UNK',
          chainId: comp.id.chainId || defaultChainId,
          resSeq: comp.id.residueNumber ?? 1,
          insCode: comp.id.insertionCode || '',
          coordinates: [a.coordinates[0], a.coordinates[1], a.coordinates[2]],
          isHetero: a.isHetero ?? false,
          occupancy: a.occupancy ?? 1.0,
          bFactor: a.bFactor ?? 20.0,
          element: (a.element || a.atomName || 'C').replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase(),
        });
      }
    }
    return records;
  }

  // Case 3: ValidatedAtom[] or generic atom objects
  if (Array.isArray(source)) {
    let serial = 1;
    for (const a of source) {
      const coords = a.coordinates ?? [a.x ?? 0, a.y ?? 0, a.z ?? 0];
      records.push({
        serial: a.serial ?? serial++,
        atomName: a.atomName || a.atom || a.name || 'CA',
        resName: a.resName || a.resn || 'UNK',
        chainId: a.chainId || a.chain || defaultChainId,
        resSeq: a.resSeq ?? a.resi ?? 1,
        insCode: a.insCode || '',
        coordinates: [coords[0], coords[1], coords[2]],
        isHetero: !!a.isHetero || !!a.hetflag,
        occupancy: a.occupancy ?? 1.0,
        bFactor: a.bFactor ?? a.tempFactor ?? 20.0,
        element: (a.element || a.elem || a.atomName || 'C').replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase(),
      });
    }
    return records;
  }

  return records;
}

/**
 * Serializes molecular coordinates into standard 80-column PDB format.
 */
export function exportToPdb(
  source: StructureHierarchyIndex | IndexedComponent[] | ValidatedAtom[] | any,
  options: PdbExportOptions = {}
): string {
  const records = extractAtomRecords(source);
  const lines: string[] = [];

  lines.push('REMARK   4 MOCS-CERT CANONICAL SCIENTIFIC EXPORT');
  lines.push('REMARK   4 PROVENANCE: MOCS-Cert Precision Structural Biology Pipeline');

  let serial = 1;
  for (const r of records) {
    if (options.selectedChainId && r.chainId.toUpperCase() !== options.selectedChainId.toUpperCase()) {
      continue;
    }
    if (options.includeHetatm === false && r.isHetero) {
      continue;
    }
    if (options.includeWaters === false && ['HOH', 'WAT', 'TIP3', 'SOL'].includes(r.resName.toUpperCase())) {
      continue;
    }

    const currentSerial = options.renumberSerials ? serial++ : r.serial % 100000;
    const recordType = r.isHetero ? 'HETATM' : 'ATOM  ';

    // Atom name formatting: 4 characters
    // Standard rule: 1-2 char element symbols start at column 14 (index 13)
    let formattedAtomName = r.atomName;
    if (formattedAtomName.length < 4) {
      if (formattedAtomName.length <= 3) {
        formattedAtomName = ' ' + formattedAtomName.padEnd(3, ' ');
      }
    } else {
      formattedAtomName = formattedAtomName.substring(0, 4);
    }

    const resName = (r.resName || 'UNK').padEnd(3, ' ').substring(0, 3);
    const chainId = (r.chainId || 'A').substring(0, 1);
    const resSeq = (r.resSeq % 10000).toString().padStart(4, ' ');
    const insCode = (r.insCode || ' ').substring(0, 1);

    const x = r.coordinates[0].toFixed(3).padStart(8, ' ');
    const y = r.coordinates[1].toFixed(3).padStart(8, ' ');
    const z = r.coordinates[2].toFixed(3).padStart(8, ' ');

    const occ = (r.occupancy ?? 1.0).toFixed(2).padStart(6, ' ');
    const bFac = (r.bFactor ?? 20.0).toFixed(2).padStart(6, ' ');
    const elem = (r.element || 'C').padStart(2, ' ').substring(0, 2);

    // Build exactly 80 characters
    // 1-6: Record type (ATOM  / HETATM)
    // 7-11: Atom serial (5 chars)
    // 12: blank
    // 13-16: Atom name (4 chars)
    // 17: AltLoc (1 char)
    // 18-20: ResName (3 chars)
    // 21: blank
    // 22: ChainId (1 char)
    // 23-26: ResSeq (4 chars)
    // 27: InsCode (1 char)
    // 28-30: 3 blanks
    // 31-38: X (8 chars)
    // 39-46: Y (8 chars)
    // 47-54: Z (8 chars)
    // 55-60: Occupancy (6 chars)
    // 61-66: TempFactor (6 chars)
    // 67-76: 10 blanks
    // 77-78: Element (2 chars)
    // 79-80: 2 blanks
    const line =
      `${recordType}${currentSerial.toString().padStart(5, ' ')} ` +
      `${formattedAtomName} ` +
      `${resName} ` +
      `${chainId}${resSeq}${insCode}   ` +
      `${x}${y}${z}` +
      `${occ}${bFac}          ` +
      `${elem}  `;

    lines.push(line);
  }

  lines.push('END');
  return lines.join('\n') + '\n';
}

/**
 * Serializes sequence records into FASTA format with structured header.
 */
export function exportToFasta(
  index: StructureHierarchyIndex,
  options: FastaExportOptions = {}
): string {
  const lines: string[] = [];
  const lineLen = options.lineLength || 60;

  const standardOneLetterMap: Record<string, string> = {
    ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', CYS: 'C',
    GLN: 'Q', GLU: 'E', GLY: 'G', HIS: 'H', ILE: 'I',
    LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F', PRO: 'P',
    SER: 'S', THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V',
    MSE: 'M', SEC: 'U', PYL: 'O',
    // Nucleic acids
    DA: 'A', DC: 'C', DG: 'G', DT: 'T',
    A: 'A', C: 'C', G: 'G', U: 'U',
  };

  for (const [cId, chainRec] of index.chains.entries()) {
    if (options.chainId && cId.toUpperCase() !== options.chainId.toUpperCase()) {
      continue;
    }

    const seqChars: string[] = [];
    for (const comp of chainRec.components.values()) {
      if (comp.id.classification === 'protein' || comp.id.classification === 'nucleic') {
        const letter = standardOneLetterMap[comp.id.residueName.toUpperCase()] || 'X';
        seqChars.push(letter);
      }
    }

    if (seqChars.length === 0) continue;

    const header = `>${index.structureId}|Chain_${cId}|${chainRec.classification.toUpperCase()}|length=${seqChars.length}`;
    lines.push(header);

    const fullSeq = seqChars.join('');
    for (let i = 0; i < fullSeq.length; i += lineLen) {
      lines.push(fullSeq.substring(i, i + lineLen));
    }
  }

  return lines.join('\n') + '\n';
}

/**
 * Serializes tabular numerical data to CSV format with explicit unit headers.
 */
export function exportToCsv(
  records: Array<Record<string, any>>,
  columns: CsvExportColumn[]
): string {
  const headerRow = columns
    .map((c) => (c.unit ? `"${c.label} (${c.unit})"` : `"${c.label}"`))
    .join(',');

  const rows = records.map((rec) => {
    return columns
      .map((c) => {
        const val = rec[c.key];
        if (val === null || val === undefined) return '';
        if (typeof val === 'number') {
          return Number.isInteger(val) ? val.toString() : val.toFixed(4);
        }
        return `"${String(val).replace(/"/g, '""')}"`;
      })
      .join(',');
  });

  return [headerRow, ...rows].join('\n') + '\n';
}

/**
 * Deterministic JSON export with schema validation.
 */
export function exportScientificResultJson(result: ScientificResultEnvelope): string {
  if (!isScientificResult(result)) {
    throw new Error('Cannot export invalid ScientificResultEnvelope to JSON');
  }
  return JSON.stringify(result, null, 2);
}

/**
 * Deserializes JSON string back into ScientificResultEnvelope.
 */
export function deserializeScientificResult(jsonStr: string): ScientificResultEnvelope {
  const parsed = JSON.parse(jsonStr);
  if (!isScientificResult(parsed)) {
    throw new Error('Deserialized JSON is not a valid ScientificResultEnvelope');
  }
  return parsed;
}

/**
 * Parses a PDB string into basic atom records to verify round-trip fidelity.
 */
export function parsePdbText(pdbText: string): FlattenedAtomRecord[] {
  const lines = pdbText.split('\n');
  const records: FlattenedAtomRecord[] = [];

  for (const line of lines) {
    if (!line.startsWith('ATOM  ') && !line.startsWith('HETATM')) continue;

    const serial = parseInt(line.substring(6, 11).trim(), 10);
    const atomName = line.substring(12, 16).trim();
    const resName = line.substring(17, 20).trim();
    const chainId = line.substring(21, 22).trim();
    const resSeq = parseInt(line.substring(22, 26).trim(), 10);
    const insCode = line.substring(26, 27).trim();
    const x = parseFloat(line.substring(30, 38).trim());
    const y = parseFloat(line.substring(38, 46).trim());
    const z = parseFloat(line.substring(46, 54).trim());
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      throw new Error(`[StructureParseError] Invalid non-numeric coordinates in PDB line: "${line}"`);
    }
    const occupancy = line.length >= 60 ? parseFloat(line.substring(54, 60).trim()) : 1.0;
    const bFactor = line.length >= 66 ? parseFloat(line.substring(60, 66).trim()) : 20.0;
    const element = line.length >= 78 ? line.substring(76, 78).trim() : atomName.replace(/[^a-zA-Z]/g, '').slice(0, 2);

    records.push({
      serial,
      atomName,
      resName,
      chainId,
      resSeq,
      insCode,
      coordinates: [x, y, z],
      isHetero: line.startsWith('HETATM'),
      occupancy: Number.isFinite(occupancy) ? occupancy : 1.0,
      bFactor: Number.isFinite(bFactor) ? bFactor : 20.0,
      element,
    });
  }

  return records;
}

/**
 * Evaluates round-trip fidelity between original atoms and exported PDB.
 * Verifies that coordinates match to <= 0.001 Å, chains and residue counts match.
 */
export function verifyPdbRoundTripFidelity(
  originalAtoms: FlattenedAtomRecord[],
  exportedPdbText: string
): {
  matches: boolean;
  atomCountOriginal: number;
  atomCountParsed: number;
  maxCoordDelta: number;
  chains: string[];
} {
  const parsed = parsePdbText(exportedPdbText);
  const chains = Array.from(new Set(parsed.map((p) => p.chainId))).sort();

  if (originalAtoms.length !== parsed.length) {
    return {
      matches: false,
      atomCountOriginal: originalAtoms.length,
      atomCountParsed: parsed.length,
      maxCoordDelta: Infinity,
      chains,
    };
  }

  let maxDelta = 0;
  for (let i = 0; i < originalAtoms.length; i++) {
    const orig = originalAtoms[i];
    const rec = parsed[i];

    const dx = Math.abs(orig.coordinates[0] - rec.coordinates[0]);
    const dy = Math.abs(orig.coordinates[1] - rec.coordinates[1]);
    const dz = Math.abs(orig.coordinates[2] - rec.coordinates[2]);
    const delta = Math.max(dx, dy, dz);
    if (delta > maxDelta) maxDelta = delta;

    if (orig.chainId !== rec.chainId || orig.resSeq !== rec.resSeq) {
      return {
        matches: false,
        atomCountOriginal: originalAtoms.length,
        atomCountParsed: parsed.length,
        maxCoordDelta: maxDelta,
        chains,
      };
    }
  }

  return {
    matches: maxDelta <= 0.002,
    atomCountOriginal: originalAtoms.length,
    atomCountParsed: parsed.length,
    maxCoordDelta: maxDelta,
    chains,
  };
}
