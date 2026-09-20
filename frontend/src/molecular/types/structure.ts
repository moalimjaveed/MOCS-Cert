/**
 * Molecular structure domain types and coordinate bounds.
 */

export type StructureSource =
  | 'local'
  | 'rcsb'
  | 'alphafold'
  | 'three_beacons'
  | 'model_archive'
  | 'esmfold'
  | 'rfdiffusion'
  | 'proteinmpnn'
  | 'boltz'
  | 'computed'
  | 'trajectory';

export type StructureCategory =
  | 'existing_experimental'
  | 'computed_predicted'
  | 'designed_candidate'
  | 'trajectory_dataset'
  | 'user_supplied';

export type StructureFormat =
  | 'bcif'
  | 'mmcif'
  | 'cif'
  | 'pdb'
  | 'gro';

export type BoundKind = 'static' | 'current_frame' | 'mocs_block';

export interface CoordinateAABB {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
  size: [number, number, number];
  radius: number;
}

export interface AtomCoordinate {
  x: number;
  y: number;
  z: number;
  element: string;
  atomName: string;
  residueName: string;
  residueSeq: number;
  chain: string;
  isHetero: boolean;
}

export interface MolecularSelectionQuery {
  chain?: string;
  residueSeq?: number;
  residueName?: string;
  atomName?: string;
}

export interface StructureEntityInfo {
  polymerChains: string[];
  ligandResidues: Array<{
    name: string;
    chain: string;
    seqNumber: number;
    atomCount: number;
  }>;
  totalAtoms: number;
}

/**
 * Canonical Hierarchical Structural Identity Types
 * STRUCTURE -> MODEL -> ENTITY/CHAIN -> RESIDUE/COMPONENT -> ATOM -> COORDINATE
 */
export interface StructureIdentity {
  structureId: string;
  source: StructureSource;
  format?: StructureFormat;
}

export interface AssemblyIdentity {
  structureId: string;
  assemblyId: string; // e.g. 'deposited' (asymmetric unit), '1', '2'
  isAsymmetricUnit: boolean;
}

export interface ModelIdentity {
  structureId: string;
  modelId: number | string;
}

export interface EntityIdentity {
  structureId: string;
  entityId: string | number;
  entityType: 'polymer' | 'non-polymer' | 'macrolide' | 'water' | 'branched';
  description?: string;
}

export interface ChainIdentity {
  structureId: string;
  modelId: number | string;
  chainId: string;       // auth_asym_id or label_asym_id
  labelChainId?: string; // label_asym_id if different from auth
  entityId?: string | number;
}

export interface ResidueIdentity {
  structureId: string;
  modelId: number | string;
  chainId: string;
  residueName: string;   // e.g. 'HEM', 'ALA', 'DC'
  residueNumber: number; // auth_seq_id
  insertionCode?: string;// pdbx_PDB_ins_code
}

export interface AtomIdentity {
  structureId: string;
  modelId: number | string;
  chainId: string;
  residueName: string;
  residueNumber: number;
  insertionCode?: string;
  atomName: string;      // auth_atom_id / label_atom_id (e.g. 'NE2', 'FE', 'CA', "O5'")
  element: string;       // type_symbol (e.g. 'Fe', 'N', 'C', 'O')
  altLoc?: string;       // label_alt_id
}

/**
 * Discriminated union separating static experimental structures from dynamic trajectory witnesses.
 */
export type MolecularSource =
  | {
      kind: 'experimental';
      provider: string;
      structureId: string;
      observableProtein?: string;
      observableLigand?: string;
      expectedDistance?: number;
      assemblyId?: string;
    }
  | {
      kind: 'trajectory';
      trajectory: string;
      topology: string;
      observableProtein?: string;
      observableLigand?: string;
      expectedWitnessDistance?: number;
    };

export interface MolecularSelection {
  structureId: string;
  modelIndex: number;
  chainId: string;
  residueId: number;
  residueName: string;
  atomName: string;
  element: string;
  coordinates: [number, number, number];
  bFactor?: number;
  occupancy?: number;
  entityType?: 'protein' | 'ligand' | 'solvent' | 'ion' | 'nucleic' | 'other';
  formattedLabel: string;
  displayLabel: string;
}

export interface AtomRef {
  label: string;
  coords: [number, number, number];
  chain?: string;
  resSeq?: number;
  resName?: string;
  atomName?: string;
}

export type MeasurementToolState =
  | 'idle'
  | 'selecting-first-atom'
  | 'selecting-second-atom'
  | 'measured';

export type AABBMode = 'selection' | 'block';

export interface BoxExtrema {
  min: [number, number, number];
  max: [number, number, number];
}

export interface BoxDimensions {
  deltaX: number;
  deltaY: number;
  deltaZ: number;
  volume: number;
}

export type StructureErrorCode =
  | 'RESOURCE_NOT_FOUND'        // 404
  | 'ACCESS_DENIED'             // 401, 403
  | 'TIMEOUT'                   // 408, client timeout
  | 'RATE_LIMITED'              // 429
  | 'PROVIDER_ERROR'            // 5xx
  | 'NETWORK_ERROR'             // Network failure / disconnected
  | 'INVALID_PROVIDER_RESPONSE' // Non-JSON, unexpected body
  | 'PARSE_ERROR'               // Format parser failure
  | 'UNKNOWN_ERROR';

export interface StructureMetadata {
  id: string;
  name: string;
  displayId?: string; // Explicit user-facing display identifier (e.g. 'AF-P69905-F1')
  accession?: string; // Canonical provider accession (e.g. 'P69905' or '4HHB')
  modelId?: string; // Provider model entity ID (e.g. 'AF-P69905-F1')
  modelVersion?: number | string; // Provider model version (e.g. 6 or 'v6')
  source?: StructureSource;
  downloadUrl?: string;
  kind?: 'experimental' | 'trajectory' | 'predicted' | 'designed' | 'user_supplied';
  category?: StructureCategory;
  provider: string;
  description: string;
  defaultSelA?: string;
  defaultSelB?: string;
  defaultDistance?: number;
  organism?: string;
  method?: string;
  resolution?: string; // Crystallographic/cryo-EM resolution in Ångströms (strictly for experimental structures)
  computationalMetric?: string; // Explicit computational design/prediction metric (e.g. pLDDT, scTM, ipTM)
  sequence?: string;
  tags?: string[];
  assemblyId?: string;
  assemblies?: string[];
  confidenceMetrics?: {
    plddtAvg?: number;
    ptmScore?: number;
    paeMax?: number;
  };
}

export type SpatialEnvelopeSemantic =
  | 'current-frame'
  | 'block-envelope'
  | 'query-selection';

export type SpatialEnvelopeTarget =
  | 'protein'
  | 'nucleic'
  | 'ligand'
  | 'selection';

export interface SpatialEnvelope {
  box: {
    min: [number, number, number];
    max: [number, number, number];
  };
  semantic: SpatialEnvelopeSemantic;
  target: SpatialEnvelopeTarget;
  selectionLabel?: string;
  frame?: number;
  blockStart?: number;
  blockEndExclusive?: number;
  source?: string;
  color: string;
  atomCoords?: [number, number, number][];
  epistemicState?: 'TRUE' | 'FALSE' | 'UNKNOWN' | 'UNRESOLVABLE';
}

export interface SpatialEnvelopeOptions {
  semantic: SpatialEnvelopeSemantic;
  target: SpatialEnvelopeTarget;
  selectionLabel?: string;
  frame?: number;
  blockStart?: number;
  blockEndExclusive?: number;
  source?: string;
  color: string;
  epistemicState?: 'TRUE' | 'FALSE' | 'UNKNOWN' | 'UNRESOLVABLE';
  isInspected?: boolean;
  isHovered?: boolean;
  atomCoords?: [number, number, number][];
  componentBound?: any;
  componentId?: any;
}

