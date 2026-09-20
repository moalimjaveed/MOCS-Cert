/**
 * MOCS-Cert Molecular Surfaces, Solvent Accessibility & Spatial Analysis Subsystem
 * 
 * Epistemic Rules:
 * 1. Visual rendering meshes are NOT quantitative molecular surfaces.
 * 2. Bounding box volume (AABB) is NOT molecular volume.
 * 3. SASA is computed via Shrake-Rupley isotropic Fibonacci sphere integration.
 * 4. Geometric cavities are explicitly labeled "Predicted Geometric Cavity", NEVER validated binding sites.
 * 5. Strict chain isolation: ligand pockets never contaminate across chains.
 */

export * from './types';
export * from './atomicRadii';
export * from './spatialGrid';
export * from './sasaEngine';
export * from './volumeEngine';
export * from './pocketEngine';
export * from './surfaceCache';
