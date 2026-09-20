/**
 * MOCS-Cert Molecular Sequence & Annotation Subsystem
 * 
 * Epistemic Rules:
 * 1. Primary sequence is biological ground truth; coordinate sequence is experimental physical observation.
 * 2. Unresolved residues are missing in density, never non-existent.
 * 3. Never fabricate coordinates for missing residues.
 * 4. Entity != Chain instance; Author numbering != 0-based sequence index.
 * 5. Every annotation carries strict provenance and is chain-isolated.
 */

export * from './types';
export * from './residueIdentity';
export * from './entityMapping';
export * from './sequenceAlignment';
export * from './uniprotClient';
export * from './annotationModel';
export * from './nucleicSequence';
export * from './sequenceCache';
