/**
 * MOCS Mathematical Protein Intelligence — Provider Interfaces (Section 25)
 * 
 * Defines decoupled interfaces for generative protein design, structure prediction,
 * trajectory streaming, and mathematical analysis modules.
 * 
 * Supports pluggable expansion without modifying core rendering pipelines.
 */

import type { StructureMathematicalAnalysis } from './types';

export interface StructurePayload {
  id: string;
  format: 'pdb' | 'mmcif' | 'bcif' | 'gro';
  data: string | ArrayBuffer | Uint8Array;
  metadata?: Record<string, any>;
}

/**
 * 1. Generative Protein Design Provider Interface (ProteinMPNN, RFdiffusion)
 */
export interface ProteinDesignProvider {
  readonly id: string;
  readonly name: string;
  readonly supportedDesignTasks: ('scaffold' | 'binder' | 'sequence_redesign' | 'motif_scaffolding')[];
  designCandidate(params: {
    targetStructureId?: string;
    hotspotResidues?: string[];
    scaffoldLength?: number;
    options?: Record<string, any>;
  }): Promise<{
    candidateId: string;
    sequence: string;
    structureData?: string;
    designScore: number;
  }>;
}

/**
 * 2. Protein Structure Prediction Provider Interface (ESMFold, AlphaFold, Boltz-1)
 */
export interface ProteinStructurePredictionProvider {
  readonly id: string;
  readonly name: string;
  predictStructure(params: {
    sequence: string;
    signal?: AbortSignal;
  }): Promise<{
    structureId: string;
    format: 'pdb' | 'mmcif';
    data: string;
    meanPLDDT: number;
    pTMScore?: number;
  }>;
}

/**
 * 3. Trajectory Streaming Provider Interface (GROMACS GRO/XTC, DCD)
 */
export interface TrajectoryProvider {
  readonly id: string;
  readonly name: string;
  loadTrajectory(params: {
    topologyUrl: string;
    trajectoryUrl: string;
  }): Promise<{
    frameCount: number;
    atomCount: number;
    getFrameCoordinates(frameIndex: number): Promise<Float32Array>;
  }>;
}

/**
 * 4. Structure Source Provider Interface (RCSB PDB, AlphaFold DB, ModelArchive, 3D-Beacons)
 */
export interface StructureSourceProvider {
  readonly id: string;
  readonly name: string;
  canResolve(query: string): boolean;
  resolve(query: string, signal?: AbortSignal): Promise<StructurePayload>;
}

/**
 * 5. Mathematical Analysis Provider Interface
 */
export interface MathematicalAnalysisProvider {
  readonly id: string;
  readonly name: string;
  analyze(atoms: Array<{ coords: [number, number, number]; name?: string }>): Promise<StructureMathematicalAnalysis>;
}
