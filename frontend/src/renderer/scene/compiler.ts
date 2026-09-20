/**
 * @mocs/scene — Deterministic Scene Compiler
 *
 * Compiles a dataset, scientific query, and proof specification into a pure,
 * immutable, backend-neutral CanonicalScene specification.
 *
 * Design invariants:
 *   1. Dataset-agnostic: atom queries come from ProofSpecification, never hardcoded.
 *   2. Resolution failures are explicit typed records, never silently empty arrays.
 *   3. No side-effects, no timestamps, no renderer coupling.
 *   4. Mol* is a downstream rendering backend only.
 */

import { CanonicalStructure, resolveExactAtom } from '@mocs/core';
import { computePointAABB, createMeasurementCaliper } from '@mocs/geometry';
import { CanonicalScene } from './scene.js';
import { MolecularScene, MolecularObject, RepresentationType } from './molecularScene.js';
import {
  ScientificProofScene,
  ProofAABBItem,
  ProofCaliperItem,
  ProofReticleItem,
  ProofResolutionFailure,
  AABBStyle,
} from './proofScene.js';
import { resolveCanonicalIdentifier } from '../../molecular/resolver/canonicalAtomResolver.js';

const STANDARD_AMINO_ACIDS = new Set([
  'ALA', 'ARG', 'ASN', 'ASP', 'CYS', 'GLN', 'GLU', 'GLY', 'HIS', 'ILE',
  'LEU', 'LYS', 'MET', 'PHE', 'PRO', 'SER', 'THR', 'TRP', 'TYR', 'VAL',
  'SEC', 'PYL', 'ASX', 'GLX', 'XLE',
]);

const STANDARD_NUCLEIC_ACIDS = new Set([
  'DA', 'DT', 'DC', 'DG', 'DI', 'A', 'U', 'C', 'G', 'I',
  'ADE', 'THY', 'CYT', 'GUA', 'URA',
]);

const SOLVENT_RESIDUES = new Set(['HOH', 'WAT', 'DOD', 'TIP', 'TIP3', 'TIP4', 'SOL']);
const COMMON_IONS = new Set(['NA', 'CL', 'MG', 'ZN', 'CA', 'FE', 'K', 'MN', 'CU', 'CO']);

/**
 * Explicit distance measurement specification.
 * Both atom queries are required — no fallback to hardcoded identifiers.
 */
export interface DistanceMeasurementSpec {
  /** Canonical atom query string for the first endpoint, e.g. 'A:87:NE2' or 'A:248:ARG' */
  readonly atomAQuery: string;
  /** Canonical atom query string for the second endpoint, e.g. 'HEM:142:FE' or 'E:11:DT' */
  readonly atomBQuery: string;
  /** Optional preferred chain for disambiguation when query is ambiguous */
  readonly preferredChain?: string;
  /** Color hex for the caliper line, defaults to 0x10b981 */
  readonly colorHex?: number;
}

/**
 * Pre-computed block-level AABB specification.
 * Coordinates come directly from the proof store (useProofStore.boxA / boxB),
 * not from atom extraction — the dyadic block bounds are already canonical.
 */
export interface BlockAABBSpec {
  /** Unique identifier, e.g. 'block-41-A' */
  readonly id: string;
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
  /** RGBA hex colour for the wireframe cage, defaults to 0x005FB8 (Cobalt TRUE) */
  readonly colorHex?: number;
}

export interface ProofSpecification {
  modelNum?: number;
  aabbProtein?: boolean;
  aabbLigand?: boolean;
  aabbNucleic?: boolean;
  aabbStyle?: AABBStyle;
  /**
   * Distance measurement spec. Must provide both atom query strings explicitly.
   * Passing `true` is no longer accepted — use { atomAQuery, atomBQuery }.
   */
  distanceMeasurement?: DistanceMeasurementSpec;
  activeSelections?: readonly string[];
  /**
   * Pre-computed block-level AABBs from useProofStore.
   * When a block is focused in proof inspection mode, the boxA/boxB coordinates
   * are passed here and projected directly into the 3D scene without re-deriving
   * them from atom positions.
   */
  blockAABBs?: readonly BlockAABBSpec[];
}


/**
 * Extracts [x,y,z] tuples for atoms whose topology entries pass the predicate.
 * Uses the interleaved Float64Array coordinates from the specified or first model.
 */
function extractCoords(
  structure: CanonicalStructure,
  predicate: (atom: CanonicalStructure['topology']['atoms'][number]) => boolean,
  targetCoords?: Float64Array
): Array<readonly [number, number, number]> {
  const atoms = structure.topology.atoms;
  const coords = targetCoords ?? structure.models[0]?.coordinates;
  if (!coords) return [];
  const result: Array<readonly [number, number, number]> = [];
  for (let i = 0; i < atoms.length; i++) {
    if (predicate(atoms[i])) {
      result.push([coords[i * 3], coords[i * 3 + 1], coords[i * 3 + 2]]);
    }
  }
  return result;
}

/**
 * Extracts coordinates specifically for a molecular component kind (protein, nucleic, ligand).
 * Prioritizes pre-classified structure.components if populated, with robust topology fallback.
 */
function extractComponentCoords(
  structure: CanonicalStructure,
  kind: 'protein' | 'nucleic' | 'ligand',
  targetCoords?: Float64Array
): Array<readonly [number, number, number]> {
  const coords = targetCoords ?? structure.models[0]?.coordinates;
  if (!coords) return [];

  const comp = structure.components?.find((c) => c.kind === kind);
  if (comp && comp.atomIndices && comp.atomIndices.length > 0) {
    const result: Array<readonly [number, number, number]> = [];
    for (let i = 0; i < comp.atomIndices.length; i++) {
      const idx = comp.atomIndices[i];
      result.push([coords[idx * 3], coords[idx * 3 + 1], coords[idx * 3 + 2]]);
    }
    return result;
  }

  // Fallback to inspecting atoms in topology
  const atoms = structure.topology?.atoms || [];
  const result: Array<readonly [number, number, number]> = [];
  for (let i = 0; i < atoms.length; i++) {
    const atom = atoms[i];
    const upRes = (atom.resName || '').toUpperCase();
    let matches = false;

    if (kind === 'protein') {
      matches =
        STANDARD_AMINO_ACIDS.has(upRes) ||
        (upRes !== 'HEM' &&
          !STANDARD_NUCLEIC_ACIDS.has(upRes) &&
          !SOLVENT_RESIDUES.has(upRes) &&
          !COMMON_IONS.has(upRes) &&
          !atom.name.includes('FE'));
    } else if (kind === 'nucleic') {
      matches = STANDARD_NUCLEIC_ACIDS.has(upRes);
    } else if (kind === 'ligand') {
      matches =
        upRes === 'HEM' ||
        (!STANDARD_AMINO_ACIDS.has(upRes) &&
          !STANDARD_NUCLEIC_ACIDS.has(upRes) &&
          !SOLVENT_RESIDUES.has(upRes) &&
          !COMMON_IONS.has(upRes));
    }

    if (matches) {
      result.push([coords[i * 3], coords[i * 3 + 1], coords[i * 3 + 2]]);
    }
  }

  return result;
}

export function compileRenderScene(
  structure: CanonicalStructure,
  revision: number,
  spec: ProofSpecification = {}
): CanonicalScene {
  const datasetId = structure.datasetId;
  const targetModel = (spec.modelNum ? structure.models.find((m) => m.modelNum === spec.modelNum) : null) ?? structure.models[0];
  const modelNum = targetModel?.modelNum ?? 1;
  const targetCoords = targetModel?.coordinates;

  // 1. Compile Molecular Objects (MolecularScene)
  const objects: MolecularObject[] = [
    {
      id: `${datasetId}-protein`,
      componentKind: 'protein',
      targetComponentId: `${datasetId}-protein`,
      visibility: true,
      representation: 'cartoon' as RepresentationType,
      colorTheme: 'chain-id',
      material: 'diffuse',
      quality: 'balanced',
    },
    {
      id: `${datasetId}-ligand`,
      componentKind: 'ligand',
      targetComponentId: `${datasetId}-ligand`,
      visibility: true,
      representation: 'ball-and-stick' as RepresentationType,
      colorTheme: 'element-symbol',
      material: 'diffuse',
      quality: 'balanced',
    },
  ];

  const molecularScene: MolecularScene = {
    datasetId,
    modelNum,
    objects,
  };

  // 2. Compile Proof Geometry Items (AABBs, Calipers, Reticles)
  const aabbs: ProofAABBItem[] = [];
  const calipers: ProofCaliperItem[] = [];
  const reticles: ProofReticleItem[] = [];
  const resolutionFailures: ProofResolutionFailure[] = [];

  const style: AABBStyle = spec.aabbStyle ?? 'wireframe';

  // ── Protein AABB ──────────────────────────────────────────────────────────
  if (spec.aabbProtein) {
    const proteinCoords = extractComponentCoords(structure, 'protein', targetCoords);
    if (proteinCoords.length > 0) {
      const aabbRes = computePointAABB(proteinCoords, {
        componentIdentity: 'protein',
        spatialIdentity: `${datasetId}-model-${modelNum}-protein`,
        frameIdentity: 0,
      });
      if (aabbRes.ok) {
        aabbs.push({
          id: `${datasetId}-aabb-protein`,
          aabb: aabbRes.value,
          style,
          colorHex: 0x38bdf8,
        });
      } else {
        resolutionFailures.push({
          kind: 'aabb',
          query: 'protein',
          reason: `AABB computation failed: ${aabbRes.error?.message ?? 'unknown'}`,
          datasetId,
        });
      }
    } else {
      resolutionFailures.push({
        kind: 'aabb',
        query: 'protein',
        reason: 'No protein atoms found in dataset topology',
        datasetId,
      });
    }
  }

  // ── Nucleic Acid AABB ──────────────────────────────────────────────────────
  if (spec.aabbNucleic) {
    const nucleicCoords = extractComponentCoords(structure, 'nucleic', targetCoords);
    if (nucleicCoords.length > 0) {
      const aabbRes = computePointAABB(nucleicCoords, {
        componentIdentity: 'nucleic',
        spatialIdentity: `${datasetId}-model-${modelNum}-nucleic`,
        frameIdentity: 0,
      });
      if (aabbRes.ok) {
        aabbs.push({
          id: `${datasetId}-aabb-nucleic`,
          aabb: aabbRes.value,
          style,
          colorHex: 0xa78bfa, // Distinctive violet for nucleic acid
        });
      } else {
        resolutionFailures.push({
          kind: 'aabb',
          query: 'nucleic',
          reason: `AABB computation failed: ${aabbRes.error?.message ?? 'unknown'}`,
          datasetId,
        });
      }
    } else {
      resolutionFailures.push({
        kind: 'aabb',
        query: 'nucleic',
        reason: 'No nucleic acid atoms found in dataset topology',
        datasetId,
      });
    }
  }

  // ── Ligand AABB ───────────────────────────────────────────────────────────
  if (spec.aabbLigand) {
    const ligandCoords = extractComponentCoords(structure, 'ligand', targetCoords);
    if (ligandCoords.length > 0) {
      const aabbRes = computePointAABB(ligandCoords, {
        componentIdentity: 'ligand',
        spatialIdentity: `${datasetId}-model-${modelNum}-ligand`,
        frameIdentity: 0,
      });
      if (aabbRes.ok) {
        aabbs.push({
          id: `${datasetId}-aabb-ligand`,
          aabb: aabbRes.value,
          style,
          colorHex: 0xf59e0b,
        });
      } else {
        resolutionFailures.push({
          kind: 'aabb',
          query: 'ligand',
          reason: `AABB computation failed: ${aabbRes.error?.message ?? 'unknown'}`,
          datasetId,
        });
      }
    } else {
      resolutionFailures.push({
        kind: 'aabb',
        query: 'ligand',
        reason: 'No ligand atoms found in dataset topology',
        datasetId,
      });
    }
  }

  // ── Active Site Reticles ───────────────────────────────────────────────────
  if (spec.activeSelections) {
    for (const query of spec.activeSelections) {
      try {
        const canonical = resolveCanonicalIdentifier(structure, query, { modelNum });
        if (canonical.ok) {
          const primary = canonical.primaryMatch;
          reticles.push({
            id: `reticle-${query}`,
            sourceAtomId: primary.sourceAtomId,
            position: canonical.centroid,
            colorHex: query.includes('FE') ? 0xef4444 : 0x06b6d4,
            radiusAngstroms: Math.max(0.85, canonical.boundingRadius),
          });
        } else {
          const match = resolveExactAtom(structure, query, { modelNum });
          reticles.push({
            id: `reticle-${query}`,
            sourceAtomId: match.sourceAtomId,
            position: match.position,
            colorHex: query.includes('FE') ? 0xef4444 : 0x06b6d4,
            radiusAngstroms: 0.85,
          });
        }
      } catch (err) {
        // Explicit failure — the caller asked for this atom and it doesn't exist
        resolutionFailures.push({
          kind: 'reticle',
          query,
          reason:
            err instanceof Error
              ? err.message
              : `Atom '${query}' could not be resolved in dataset '${datasetId}'`,
          datasetId,
        });
      }
    }
  }

  // ── Distance Caliper (dataset-agnostic — queries come from spec) ───────────
  if (spec.distanceMeasurement) {
    const { atomAQuery, atomBQuery, preferredChain, colorHex = 0x10b981 } = spec.distanceMeasurement;
    let atomAResolved = false;
    let atomBResolved = false;
    let atomAErr: string | null = null;
    let atomBErr: string | null = null;
    let atomAPos: readonly [number, number, number] | null = null;
    let atomBPos: readonly [number, number, number] | null = null;

    // Resolve atom/residue A
    const resA = resolveCanonicalIdentifier(structure, atomAQuery, { preferredChain, modelNum });
    if (resA.ok) {
      atomAPos = resA.centroid;
      atomAResolved = true;
    } else {
      try {
        const matchA = resolveExactAtom(structure, atomAQuery, { preferredChain, modelNum });
        atomAPos = matchA.position;
        atomAResolved = true;
      } catch (err) {
        atomAErr =
          resA.error?.reason ||
          (err instanceof Error ? err.message : `Atom '${atomAQuery}' not found in dataset '${datasetId}'`);
      }
    }

    // Resolve atom/residue B
    const resB = resolveCanonicalIdentifier(structure, atomBQuery, { preferredChain, modelNum });
    if (resB.ok) {
      atomBPos = resB.centroid;
      atomBResolved = true;
    } else {
      try {
        const matchB = resolveExactAtom(structure, atomBQuery, { preferredChain, modelNum });
        atomBPos = matchB.position;
        atomBResolved = true;
      } catch (err) {
        atomBErr =
          resB.error?.reason ||
          (err instanceof Error ? err.message : `Atom '${atomBQuery}' not found in dataset '${datasetId}'`);
      }
    }

    if (atomAResolved && atomBResolved && atomAPos && atomBPos) {
      const caliper = createMeasurementCaliper(
        `${atomAQuery}--${atomBQuery}`,
        atomAQuery,
        atomBQuery,
        atomAPos,
        atomBPos
      );
      calipers.push({
        id: `caliper-${atomAQuery}--${atomBQuery}`,
        caliper,
        colorHex,
        showDistanceLabel: true,
      });
    } else {
      // Produce one failure record per unresolved atom
      if (!atomAResolved && atomAErr) {
        resolutionFailures.push({
          kind: 'caliper',
          query: atomAQuery,
          reason: atomAErr,
          datasetId,
        });
      }
      if (!atomBResolved && atomBErr) {
        resolutionFailures.push({
          kind: 'caliper',
          query: atomBQuery,
          reason: atomBErr,
          datasetId,
        });
      }
    }
  }

  // ── Block-Level AABBs (pre-computed from useProofStore) ───────────────────
  // These carry coordinates from the dyadic block proof bounds (boxA / boxB)
  // and do not require atom extraction from the structure topology.
  if (spec.blockAABBs && spec.blockAABBs.length > 0) {
    for (const blockSpec of spec.blockAABBs) {
      if (
        blockSpec.min &&
        blockSpec.max &&
        blockSpec.min.some((v) => v !== 0) || blockSpec.max.some((v) => v !== 0)
      ) {
        // Construct a ScientificAABB-compatible object from pre-computed min/max
        const center: readonly [number, number, number] = [
          (blockSpec.min[0] + blockSpec.max[0]) / 2,
          (blockSpec.min[1] + blockSpec.max[1]) / 2,
          (blockSpec.min[2] + blockSpec.max[2]) / 2,
        ];
        const halfDiag = Math.sqrt(
          Math.pow((blockSpec.max[0] - blockSpec.min[0]) / 2, 2) +
          Math.pow((blockSpec.max[1] - blockSpec.min[1]) / 2, 2) +
          Math.pow((blockSpec.max[2] - blockSpec.min[2]) / 2, 2)
        );
        aabbs.push({
          id: blockSpec.id,
          aabb: {
            min: blockSpec.min as [number, number, number],
            max: blockSpec.max as [number, number, number],
            center: center as [number, number, number],
            boundingRadius: halfDiag,
            componentIdentity: 'block',
            spatialIdentity: blockSpec.id,
            frameIdentity: 0,
          } as any,
          style,
          colorHex: blockSpec.colorHex ?? 0x005fb8,
        });
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const proofScene: ScientificProofScene = {
    aabbs,
    calipers,
    reticles,
    resolutionFailures,
  };

  return {
    sceneRevision: revision,
    datasetId,
    modelNum,
    molecularScene,
    proofScene,
  };
}

