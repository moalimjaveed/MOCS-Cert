/**
 * MOCS-Cert Molecular Surfaces, Solvent Accessibility & Pocket Geometry — Types
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: Lee-Richards / Shrake-Rupley, Bondi/Mantina vdW Radii, Tien et al. RSA
 */

export type SurfaceClassification =
  | 'VDW_SURFACE'
  | 'SOLVENT_ACCESSIBLE_SURFACE'
  | 'SOLVENT_EXCLUDED_SURFACE'
  | 'VISUAL_APPROXIMATION_MESH';

export type ResidueExposureCategory = 'BURIED' | 'INTERMEDIATE' | 'EXPOSED';

export interface SurfaceAtomInput {
  atomId?: string | number;
  element: string;
  coordinates: [number, number, number];
  radius?: number;
  resName?: string;
  resSeq?: number;
  chainId?: string;
  insCode?: string;
  canonicalKey?: string;
  isHetero?: boolean;
}

export interface SasaResult {
  status: 'SUCCESS' | 'EMPTY_SELECTION' | 'ERROR';
  totalSasa: number; // Å²
  atomSasa: Map<string, number>; // key: canonicalKey or atom index -> SASA in Å²
  residueSasa: Map<string, number>; // key: `${chainId}:${resSeq}${insCode || ''}` -> SASA in Å²
  chainSasa: Map<string, number>; // key: chainId -> SASA in Å²
  probeRadius: number; // Å
  testPointCount: number; // points per sphere
  algorithm: 'SHRAKE_RUPLEY';
  units: 'Å²';
  provenance: 'COMPUTATIONAL_GEOMETRY';
  atomCount: number;
}

export interface RsaResult {
  residueKey: string;
  resName: string;
  resSeq: number;
  chainId: string;
  sasa: number; // Å²
  referenceMaxSasa: number; // Å²
  rsa: number; // fraction [0, 1]
  exposureCategory: ResidueExposureCategory;
  referenceSource: 'Tien_et_al_2013' | 'UNAVAILABLE';
}

export interface MolecularVolumeResult {
  status: 'SUCCESS' | 'EMPTY_SELECTION' | 'ERROR';
  vdwVolume: number; // Å³
  solventExcludedVolume?: number; // Å³
  boundingVolumeAABB: number; // Å³ (ΔX * ΔY * ΔZ)
  packingFraction: number; // vdwVolume / boundingVolumeAABB
  gridResolution: number; // Å (voxel width)
  units: 'Å³';
  provenance: 'COMPUTATIONAL_GEOMETRY';
  atomCount: number;
}

export interface GeometricPocket {
  pocketId: string;
  volume: number; // Å³
  surfaceArea: number; // Å²
  centerOfMass: [number, number, number];
  voxelCount: number;
  liningResidueKeys: string[];
  liningChainIds: string[];
  isBuried: boolean; // True if completely enclosed void, false if open surface pocket
  asphericity: number; // Geometric shape eccentricity [0, 1]
}

export interface CavityDetectionResult {
  status: 'SUCCESS' | 'EMPTY_SELECTION' | 'NO_CAVITIES_FOUND';
  pockets: GeometricPocket[];
  totalCavityVolume: number; // Å³
  largestPocketVolume: number; // Å³
  gridSpacing: number; // Å
  probeRadius: number; // Å
  provenance: 'COMPUTATIONAL_PREDICTION'; // Explicitly predicted, NOT biological validation
}

export interface LigandPocketResult {
  status: 'SUCCESS' | 'LIGAND_NOT_FOUND' | 'EMPTY_SELECTION';
  ligandId: string;
  chainId: string;
  residueName: string;
  residueNumber: number;
  pocketVolume: number; // Å³
  pocketSurfaceArea: number; // Å²
  liningResidueKeys: string[];
  liningProteinChains: string[];
  isIsolatedToChain: boolean;
  provenance: 'COMPUTATIONAL_PREDICTION';
}
