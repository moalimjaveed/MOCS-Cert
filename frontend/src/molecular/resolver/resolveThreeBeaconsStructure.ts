/**
 * 3D-Beacons Unified Structural Network Resolver
 * 
 * Interoperates with the 3D-Beacons federated network hub
 * (linking PDBe, AlphaFold DB, ModelArchive, SWISS-MODEL, and SASBDB).
 */

import type { StructureCandidate, StructureProvenance } from '../types';
import { normalizeUniProtId } from './resolveAlphaFoldStructure';

export function resolveThreeBeaconsStructure(uniprotId: string): {
  candidate: StructureCandidate;
  provenance: StructureProvenance;
} {
  const cleanId = normalizeUniProtId(uniprotId);
  const modelId = `3DBC-${cleanId}`;
  const url = `https://www.ebi.ac.uk/pdbe/pdbe-kb/3dbeacons/api/v2/summary?uniprot_accession=${cleanId}`;

  const candidate: StructureCandidate = {
    id: `3dbc_${cleanId}`,
    source: 'three_beacons',
    provider: '3D-Beacons Hub',
    modelId,
    format: 'mmcif',
    url,
    experimental: false,
  };

  const provenance: StructureProvenance = {
    source: 'three_beacons',
    provider: '3D-Beacons Network Hub',
    modelId,
    format: 'mmcif',
    experimental: false,
    sourceUrl: url,
  };

  return { candidate, provenance };
}
