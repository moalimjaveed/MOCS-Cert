import * as THREE from 'three';
import type { CoordinateAABB, BoundKind, BoxDimensions, BoxExtrema } from '../types';
import {
  createBox3FromCoordinates,
  box3ToCoordinateAABB,
  expandBox3ByScalar,
  computeAtomCoordinatesAABB,
  calculateEuclideanDistance,
  minimumImageDistance,
  computeBoxDimensions,
  computeBoxExtrema,
  createCornerBrackets,
  createCentroidCrosshair,
  createExtentAxes,
} from './coordinateBounds';
import {
  buildStructureHierarchyIndex,
  resolveMolecularComponent,
  resolveAllMatchingComponents,
  ResolvedMolecularComponent,
} from './componentPipeline';
import {
  ComponentGeometricBound,
  computeRawExtents,
  computeVisualRenderBounds,
} from './boundingVolume';
import { parseCanonicalSelection } from './structuralIdentity';
import type { CartesianAtom } from '../intelligence/geometryEngine';

export {
  minimumImageDistance,
  computeBoxDimensions,
  computeBoxExtrema,
  createCornerBrackets,
  createCentroidCrosshair,
  createExtentAxes,
};

export interface StructureDerivedBounds {
  proteinAABB: CoordinateAABB;
  ligandAABB: CoordinateAABB;
  nucleicAABB?: CoordinateAABB;
  extractedAtoms?: CartesianAtom[];
  proteinAtomsCount: number;
  ligandAtomsCount: number;
  nucleicAtomsCount?: number;
  waterAtomsCount?: number;
  ionAtomsCount?: number;
  atomACoords: [number, number, number] | null;
  atomBCoords: [number, number, number] | null;
  measuredDistance: number | null;
  atomAName?: string;
  atomBName?: string;
  isTrajectory?: boolean;
  boundKind: BoundKind;
  proteinBox3?: THREE.Box3;
  nucleicBox3?: THREE.Box3;
  ligandBox3?: THREE.Box3;
  blockBox3?: THREE.Box3;
  fullProteinBox3?: THREE.Box3;
  fullLigandBox3?: THREE.Box3;
  fullNucleicBox3?: THREE.Box3;
  proteinRenderBox3?: THREE.Box3;
  nucleicRenderBox3?: THREE.Box3;
  ligandRenderBox3?: THREE.Box3;
  blockRenderBox3?: THREE.Box3;
  blockId?: number;
  blockTimeRange?: [number, number];
  proteinDimensions?: BoxDimensions;
  proteinExtrema?: BoxExtrema;
  nucleicDimensions?: BoxDimensions;
  nucleicExtrema?: BoxExtrema;
  ligandDimensions?: BoxDimensions;
  ligandExtrema?: BoxExtrema;
  blockDimensions?: BoxDimensions;
  blockExtrema?: BoxExtrema;
  proteinComponent?: ResolvedMolecularComponent;
  ligandComponent?: ResolvedMolecularComponent;
  nucleicComponent?: ResolvedMolecularComponent;
  nucleicComponentA?: ResolvedMolecularComponent;
  nucleicComponentB?: ResolvedMolecularComponent;
  nucleicChainABox3?: THREE.Box3;
  nucleicChainBBox3?: THREE.Box3;
  nucleicType?: 'dna' | 'rna' | 'hybrid' | 'unspecified';
  componentBounds?: ComponentGeometricBound[];
}

/**
 * Diagnostic logger for geometric bounds during development and testing.
 */
export function logGeometryForensicDiagnostic(
  caller: string,
  bounds: StructureDerivedBounds
): void {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    // Diagnostic logging hook for development inspection
  }
}

/**
 * Helper to add padding around an AABB bounding box using THREE.Box3.
 */
export function padAABB(aabb: CoordinateAABB, padding: number): CoordinateAABB {
  if (aabb.size[0] === 0 && aabb.size[1] === 0 && aabb.size[2] === 0 && aabb.radius === 0) {
    return aabb;
  }
  const min = new THREE.Vector3(...aabb.min);
  const max = new THREE.Vector3(...aabb.max);
  const box = new THREE.Box3(min, max);
  box.expandByScalar(padding);
  return box3ToCoordinateAABB(box);
}

/**
 * BOUND TYPE A: STATIC STRUCTURE AABB
 * 
 * Computes tight THREE.Box3 bounding cages enclosing actual selected atoms
 * using canonical structural identity resolution and strict chain scoping.
 * Strictly avoids cross-chain atom merging or arbitrary minimum clamping.
 */
export function createStaticStructureAABB(
  structure: any,
  selectionA = 'A:87:NE2',
  selectionB = 'HEM:142:FE'
): StructureDerivedBounds {
  const index = buildStructureHierarchyIndex(structure, 'static_structure');

  // Resolve component A (e.g. His-87 in Chain A)
  const compA = resolveMolecularComponent(index, selectionA);

  // Resolve component B with strict contextual chain scoping from compA
  // (e.g. HEM-142 in the same chain as His-87)
  const compB = resolveMolecularComponent(index, selectionB, {
    chainId: compA?.id.chainId,
    coords: compA?.bounds.raw.center,
  });

  const tokenA = parseCanonicalSelection(selectionA);
  const tokenB = parseCanonicalSelection(selectionB);

  const matchedAtomA = compA?.atoms.find((a) => !tokenA.atomName || a.atomName === tokenA.atomName);
  const matchedAtomB = compB?.atoms.find((a) => !tokenB.atomName || a.atomName === tokenB.atomName);

  const atomACoords: [number, number, number] | null =
    matchedAtomA?.coordinates || compA?.atoms[0]?.coordinates || null;
  const atomBCoords: [number, number, number] | null =
    matchedAtomB?.coordinates || compB?.atoms[0]?.coordinates || null;

  let proteinCount = 0;
  let ligandCount = 0;
  let nucleicCount = 0;
  let waterCount = 0;
  let ionCount = 0;
  const extractedAtoms: CartesianAtom[] = [];

  for (const comp of index.allComponents) {
    for (const a of comp.atoms) {
      extractedAtoms.push({
        id: typeof a.id === 'number' ? a.id : undefined,
        name: a.atomName,
        resSeq: typeof comp.id.residueNumber === 'number' ? comp.id.residueNumber : comp.id.resSeq,
        resName: comp.id.residueName || comp.id.resName,
        chain: comp.id.chainId,
        chainId: comp.id.chainId,
        coords: a.coordinates,
        x: a.coordinates[0],
        y: a.coordinates[1],
        z: a.coordinates[2],
        element: a.element,
      });
    }
    switch (comp.id.classification) {
      case 'protein':
        proteinCount += comp.atoms.length;
        break;
      case 'ligand':
      case 'cofactor':
        ligandCount += comp.atoms.length;
        break;
      case 'nucleic':
        nucleicCount += comp.atoms.length;
        break;
      case 'solvent':
        waterCount += comp.atoms.length;
        break;
      case 'ion':
        ionCount += comp.atoms.length;
        break;
    }
  }

  const isCompAProtein = compA && compA.id.classification === 'protein';
  const isCompANucleic = compA && compA.id.classification === 'nucleic';
  const isCompBNucleic = compB && compB.id.classification === 'nucleic';
  const isCompBLigand = compB && (compB.id.classification === 'ligand' || compB.id.classification === 'cofactor');

  // Collect nucleic coordinates and strand coordinates
  const nucleicCoords: [number, number, number][] = [];
  const nucleicChainACoords: [number, number, number][] = [];
  const nucleicChainBCoords: [number, number, number][] = [];
  let inferredNucleicType: 'dna' | 'rna' | 'hybrid' | 'unspecified' = 'unspecified';

  for (const comp of index.allComponents) {
    if (comp.id.classification === 'nucleic') {
      if (comp.id.nucleicType && inferredNucleicType === 'unspecified') {
        inferredNucleicType = comp.id.nucleicType;
      }
      for (const a of comp.atoms) {
        nucleicCoords.push(a.coordinates);
        if (comp.id.chainId === 'A') {
          nucleicChainACoords.push(a.coordinates);
        } else if (comp.id.chainId === 'B') {
          nucleicChainBCoords.push(a.coordinates);
        }
      }
    }
  }

  // Scientific unpadded raw boxes
  const rawProteinBox3 = isCompAProtein
    ? createBox3FromCoordinates(compA.atoms.map((a) => a.coordinates))
    : (proteinCount > 0 && atomACoords ? createBox3FromCoordinates([atomACoords]) : new THREE.Box3().makeEmpty());

  const rawNucleicBox3 = nucleicCoords.length > 0
    ? createBox3FromCoordinates(nucleicCoords)
    : isCompANucleic
    ? createBox3FromCoordinates(compA.atoms.map((a) => a.coordinates))
    : isCompBNucleic
    ? createBox3FromCoordinates(compB.atoms.map((a) => a.coordinates))
    : (nucleicCount > 0 && atomACoords ? createBox3FromCoordinates([atomACoords]) : new THREE.Box3().makeEmpty());

  const rawNucleicChainABox3 = nucleicChainACoords.length > 0
    ? createBox3FromCoordinates(nucleicChainACoords)
    : new THREE.Box3().makeEmpty();

  const rawNucleicChainBBox3 = nucleicChainBCoords.length > 0
    ? createBox3FromCoordinates(nucleicChainBCoords)
    : new THREE.Box3().makeEmpty();

  const rawLigandBox3 = isCompBLigand
    ? createBox3FromCoordinates(compB.atoms.map((a) => a.coordinates))
    : (ligandCount > 0 && atomBCoords && !isCompBNucleic ? createBox3FromCoordinates([atomBCoords]) : new THREE.Box3().makeEmpty());

  // Render boxes with controlled clearance for WebGL rasterization
  const renderProteinBox3 = isCompAProtein
    ? compA.bounds.render.box3
    : (rawProteinBox3.isEmpty() ? rawProteinBox3.clone() : expandBox3ByScalar(rawProteinBox3, 0.4));

  const renderNucleicBox3 = rawNucleicBox3.isEmpty()
    ? rawNucleicBox3.clone()
    : expandBox3ByScalar(rawNucleicBox3, 0.4);

  const renderLigandBox3 = isCompBLigand
    ? compB.bounds.render.box3
    : (rawLigandBox3.isEmpty() ? rawLigandBox3.clone() : expandBox3ByScalar(rawLigandBox3, 0.4));

  const measuredDistance = (atomACoords && atomBCoords)
    ? Number(calculateEuclideanDistance(atomACoords, atomBCoords).toFixed(2))
    : null;

  const result: StructureDerivedBounds = {
    proteinAABB: box3ToCoordinateAABB(rawProteinBox3),
    nucleicAABB: box3ToCoordinateAABB(rawNucleicBox3),
    ligandAABB: box3ToCoordinateAABB(rawLigandBox3),
    proteinBox3: rawProteinBox3,
    nucleicBox3: rawNucleicBox3,
    nucleicChainABox3: rawNucleicChainABox3,
    nucleicChainBBox3: rawNucleicChainBBox3,
    ligandBox3: rawLigandBox3,
    proteinRenderBox3: renderProteinBox3,
    nucleicRenderBox3: renderNucleicBox3,
    ligandRenderBox3: renderLigandBox3,
    proteinDimensions: computeBoxDimensions(rawProteinBox3),
    proteinExtrema: computeBoxExtrema(rawProteinBox3),
    nucleicDimensions: computeBoxDimensions(rawNucleicBox3),
    nucleicExtrema: computeBoxExtrema(rawNucleicBox3),
    ligandDimensions: computeBoxDimensions(rawLigandBox3),
    ligandExtrema: computeBoxExtrema(rawLigandBox3),
    proteinAtomsCount: proteinCount,
    ligandAtomsCount: ligandCount,
    nucleicAtomsCount: nucleicCount,
    waterAtomsCount: waterCount,
    ionAtomsCount: ionCount,
    atomACoords,
    atomBCoords,
    measuredDistance: measuredDistance != null ? Number(measuredDistance.toFixed(2)) : null,
    atomAName: selectionA,
    atomBName: selectionB,
    proteinComponent: isCompAProtein ? compA : undefined,
    nucleicComponent: isCompANucleic ? compA : (isCompBNucleic ? compB : undefined),
    nucleicComponentA: isCompANucleic ? compA : undefined,
    nucleicComponentB: isCompBNucleic ? compB : undefined,
    nucleicType: inferredNucleicType,
    ligandComponent: isCompBLigand ? compB : undefined,
    componentBounds: [compA?.bounds, compB?.bounds].filter(Boolean) as ComponentGeometricBound[],
    extractedAtoms,
    isTrajectory: false,
    boundKind: 'static',
  };

  logGeometryForensicDiagnostic('createStaticStructureAABB', result);
  return result;
}

/**
 * BOUND TYPE B: CURRENT FRAME AABB
 * 
 * Computes tight THREE.Box3 bounding cages for selected atoms in the current trajectory frame.
 * Resolves authoritative particle components and computes MOCS minimum-image distance under [80, 80, 80] Å PBC.
 */
export function createCurrentFrameAABB(
  structure: any,
  selectionA = 'A:155:CA',
  selectionB = 'LIG:1:O2',
  boxExtents: [number, number, number] = [80, 80, 80]
): StructureDerivedBounds {
  const index = buildStructureHierarchyIndex(structure, 'trajectory_frame');
  const tokenA = parseCanonicalSelection(selectionA);
  const tokenB = parseCanonicalSelection(selectionB);
  const compA = resolveMolecularComponent(index, selectionA);
  const compB = resolveMolecularComponent(index, selectionB, {
    chainId: compA?.id.chainId,
    coords: compA?.bounds.raw.center,
  });

  const matchedAtomA = compA?.atoms.find((a) => !tokenA.atomName || a.atomName === tokenA.atomName);
  const matchedAtomB = compB?.atoms.find((a) => !tokenB.atomName || a.atomName === tokenB.atomName);

  const finalACoords: [number, number, number] | null =
    matchedAtomA?.coordinates || compA?.atoms[0]?.coordinates || null;
  const finalBCoords: [number, number, number] | null =
    matchedAtomB?.coordinates || compB?.atoms[0]?.coordinates || null;

  const rawProteinBox3 = compA
    ? createBox3FromCoordinates(compA.atoms.map((a) => a.coordinates))
    : (finalACoords ? createBox3FromCoordinates([finalACoords]) : new THREE.Box3().makeEmpty());

  const rawLigandBox3 = compB
    ? createBox3FromCoordinates(compB.atoms.map((a) => a.coordinates))
    : (finalBCoords ? createBox3FromCoordinates([finalBCoords]) : new THREE.Box3().makeEmpty());

  const renderProteinBox3 = compA
    ? compA.bounds.render.box3
    : (rawProteinBox3.isEmpty() ? rawProteinBox3.clone() : expandBox3ByScalar(rawProteinBox3, 0.5));

  const renderLigandBox3 = compB
    ? compB.bounds.render.box3
    : (rawLigandBox3.isEmpty() ? rawLigandBox3.clone() : expandBox3ByScalar(rawLigandBox3, 0.5));

  const measuredDistance = (finalACoords && finalBCoords)
    ? Number(minimumImageDistance(finalACoords, finalBCoords, boxExtents).toFixed(2))
    : null;

  let proteinCount = 0;
  let ligandCount = 0;
  const extractedAtoms: CartesianAtom[] = [];

  for (const comp of index.allComponents) {
    for (const a of comp.atoms) {
      extractedAtoms.push({
        id: typeof a.id === 'number' ? a.id : undefined,
        name: a.atomName,
        resSeq: typeof comp.id.residueNumber === 'number' ? comp.id.residueNumber : comp.id.resSeq,
        resName: comp.id.residueName || comp.id.resName,
        chain: comp.id.chainId,
        chainId: comp.id.chainId,
        coords: a.coordinates,
        x: a.coordinates[0],
        y: a.coordinates[1],
        z: a.coordinates[2],
        element: a.element,
      });
    }
    if (comp.id.classification === 'protein') {
      proteinCount += comp.atoms.length;
    } else {
      ligandCount += comp.atoms.length;
    }
  }

  const result: StructureDerivedBounds = {
    proteinAABB: box3ToCoordinateAABB(rawProteinBox3),
    ligandAABB: box3ToCoordinateAABB(rawLigandBox3),
    proteinBox3: rawProteinBox3,
    ligandBox3: rawLigandBox3,
    proteinRenderBox3: renderProteinBox3,
    ligandRenderBox3: renderLigandBox3,
    proteinDimensions: computeBoxDimensions(rawProteinBox3),
    proteinExtrema: computeBoxExtrema(rawProteinBox3),
    ligandDimensions: computeBoxDimensions(rawLigandBox3),
    ligandExtrema: computeBoxExtrema(rawLigandBox3),
    proteinAtomsCount: proteinCount,
    ligandAtomsCount: ligandCount,
    atomACoords: finalACoords,
    atomBCoords: finalBCoords,
    measuredDistance: measuredDistance != null ? Number(measuredDistance.toFixed(2)) : null,
    atomAName: selectionA,
    atomBName: selectionB,
    proteinComponent: compA || undefined,
    ligandComponent: compB || undefined,
    componentBounds: [compA?.bounds, compB?.bounds].filter(Boolean) as ComponentGeometricBound[],
    extractedAtoms,
    isTrajectory: true,
    boundKind: 'current_frame',
  };

  logGeometryForensicDiagnostic('createCurrentFrameAABB', result);
  return result;
}

/**
 * BOUND TYPE C: MOCS BLOCK AABB
 * 
 * Computes conservative mathematical bounding envelope over all stored frames
 * in an active temporal block (e.g., Block 41 [410 - 420 ns]).
 * Visualizes the certificate / MCI data envelope directly in 3D world space.
 */
export function createMocsBlockAABB(
  blockFrames: Array<{ atomACoords: [number, number, number]; atomBCoords: [number, number, number] }>,
  blockId = 41,
  timeRange: [number, number] = [410, 420],
  selectionAName = 'A:155:CA',
  selectionBName = 'LIG:1:O2',
  box?: [number, number, number] | number[][]
): StructureDerivedBounds {
  const allACoords = blockFrames.map((f) => f.atomACoords);
  const allBCoords = blockFrames.map((f) => f.atomBCoords);

  const rawProteinBox = createBox3FromCoordinates(allACoords);
  const rawLigandBox = createBox3FromCoordinates(allBCoords);
  const rawBlockBox = rawProteinBox.clone().union(rawLigandBox);

  const renderProteinBox = rawProteinBox.isEmpty() ? rawProteinBox.clone() : expandBox3ByScalar(rawProteinBox, 0.3);
  const renderLigandBox = rawLigandBox.isEmpty() ? rawLigandBox.clone() : expandBox3ByScalar(rawLigandBox, 0.3);
  const renderBlockBox = renderProteinBox.clone().union(renderLigandBox);

  const firstA = allACoords.length > 0 ? allACoords[0] : null;
  const firstB = allBCoords.length > 0 ? allBCoords[0] : null;
  const measuredDistance = (firstA && firstB)
    ? (box ? minimumImageDistance(firstA, firstB, box) : Math.hypot(firstB[0] - firstA[0], firstB[1] - firstA[1], firstB[2] - firstA[2]))
    : null;

  const result: StructureDerivedBounds = {
    proteinAABB: box3ToCoordinateAABB(rawProteinBox),
    ligandAABB: box3ToCoordinateAABB(rawLigandBox),
    proteinBox3: rawProteinBox,
    ligandBox3: rawLigandBox,
    blockBox3: renderBlockBox,
    proteinRenderBox3: renderProteinBox,
    ligandRenderBox3: renderLigandBox,
    blockRenderBox3: renderBlockBox,
    proteinDimensions: computeBoxDimensions(rawProteinBox),
    proteinExtrema: computeBoxExtrema(rawProteinBox),
    ligandDimensions: computeBoxDimensions(rawLigandBox),
    ligandExtrema: computeBoxExtrema(rawLigandBox),
    blockDimensions: computeBoxDimensions(rawBlockBox),
    blockExtrema: computeBoxExtrema(rawBlockBox),
    proteinAtomsCount: allACoords.length,
    ligandAtomsCount: allBCoords.length,
    atomACoords: firstA,
    atomBCoords: firstB,
    measuredDistance: measuredDistance != null ? Number(measuredDistance.toFixed(2)) : null,
    atomAName: selectionAName,
    atomBName: selectionBName,
    isTrajectory: true,
    boundKind: 'mocs_block',
    blockId,
    blockTimeRange: timeRange,
  };

  logGeometryForensicDiagnostic('createMocsBlockAABB', result);
  return result;
}

/**
 * Canonical extraction router: Inspects the structure hierarchy and computes
 * molecule-type-specific coordinate bounds (Protein, Nucleic, Ligand, Water, Ion).
 */
export function extractCoordinatesFromMolstarStructure(
  structure: any,
  selectionA = 'A:87:NE2',
  selectionB = 'HEM:142:FE',
  options?: { isTrajectory?: boolean; boxExtents?: [number, number, number] }
): StructureDerivedBounds {
  const emptyBox = new THREE.Box3().makeEmpty();
  if (!structure || !structure.units) {
    return {
      proteinAABB: computeAtomCoordinatesAABB([]),
      ligandAABB: computeAtomCoordinatesAABB([]),
      proteinBox3: emptyBox,
      ligandBox3: emptyBox,
      proteinAtomsCount: 0,
      ligandAtomsCount: 0,
      nucleicAtomsCount: 0,
      waterAtomsCount: 0,
      ionAtomsCount: 0,
      atomACoords: null,
      atomBCoords: null,
      measuredDistance: null,
      boundKind: 'static',
      isTrajectory: false,
    };
  }

  const isTrajectory = Boolean(
    options?.isTrajectory ||
    structure?.__isTrajectory ||
    structure?.models?.[0]?.sourceData?.kind === 'gro' ||
    structure?.models?.[0]?.trajectoryInfo ||
    (structure?.models?.[0]?.trajectory && structure.models[0].trajectory.frameCount > 1)
  );
  if (isTrajectory) {
    return createCurrentFrameAABB(structure, selectionA, selectionB, options?.boxExtents);
  }

  const index = buildStructureHierarchyIndex(structure, 'molstar_structure');

  // Count atoms by classification
  let proteinCount = 0;
  let nucleicCount = 0;
  let ligandCount = 0;
  let waterCount = 0;
  let ionCount = 0;

  const proteinCoords: [number, number, number][] = [];
  const nucleicCoords: [number, number, number][] = [];
  const nucleicChainACoords: [number, number, number][] = [];
  const nucleicChainBCoords: [number, number, number][] = [];
  const ligandCoords: [number, number, number][] = [];
  let inferredNucleicType: 'dna' | 'rna' | 'hybrid' | 'unspecified' = 'unspecified';
  const extractedAtoms: CartesianAtom[] = [];

  for (const comp of index.allComponents) {
    for (const a of comp.atoms) {
      extractedAtoms.push({
        id: typeof a.id === 'number' ? a.id : undefined,
        name: a.atomName,
        resSeq: typeof comp.id.residueNumber === 'number' ? comp.id.residueNumber : comp.id.resSeq,
        resName: comp.id.residueName || comp.id.resName,
        chain: comp.id.chainId,
        chainId: comp.id.chainId,
        coords: a.coordinates,
        x: a.coordinates[0],
        y: a.coordinates[1],
        z: a.coordinates[2],
        element: a.element,
      });
    }
    if (comp.id.classification === 'nucleic') {
      if (comp.id.nucleicType && inferredNucleicType === 'unspecified') {
        inferredNucleicType = comp.id.nucleicType;
      }
      for (const a of comp.atoms) {
        nucleicCount++;
        nucleicCoords.push(a.coordinates);
        if (comp.id.chainId === 'A') {
          nucleicChainACoords.push(a.coordinates);
        } else if (comp.id.chainId === 'B') {
          nucleicChainBCoords.push(a.coordinates);
        }
      }
    } else if (comp.id.classification === 'protein') {
      for (const a of comp.atoms) {
        proteinCount++;
        proteinCoords.push(a.coordinates);
      }
    } else if (comp.id.classification === 'solvent') {
      waterCount += comp.atoms.length;
    } else if (comp.id.classification === 'ion') {
      ionCount += comp.atoms.length;
    } else {
      for (const a of comp.atoms) {
        ligandCount++;
        ligandCoords.push(a.coordinates);
      }
    }
  }

  // Resolve component A and component B using canonical pipeline with strict chain scoping
  const compA = resolveMolecularComponent(index, selectionA);
  const compB = resolveMolecularComponent(index, selectionB, {
    chainId: compA?.id.chainId,
    coords: compA?.bounds.raw.center,
  });

  const isCompAProtein = compA && compA.id.classification === 'protein';
  const isCompANucleic = compA && compA.id.classification === 'nucleic';
  const isCompBNucleic = compB && compB.id.classification === 'nucleic';
  const isCompBLigand = compB && (compB.id.classification === 'ligand' || compB.id.classification === 'cofactor');

  const tokenA = parseCanonicalSelection(selectionA);
  const tokenB = parseCanonicalSelection(selectionB);

  const matchedAtomA = compA?.atoms.find((a) => !tokenA.atomName || a.atomName === tokenA.atomName);
  const matchedAtomB = compB?.atoms.find((a) => !tokenB.atomName || a.atomName === tokenB.atomName);

  const atomACoords: [number, number, number] | null =
    matchedAtomA?.coordinates || compA?.atoms[0]?.coordinates || null;
  const atomBCoords: [number, number, number] | null =
    matchedAtomB?.coordinates || compB?.atoms[0]?.coordinates || null;

  // Raw scientific bounding boxes
  const rawProteinBox3 = isCompAProtein
    ? createBox3FromCoordinates(compA.atoms.map((a) => a.coordinates))
    : (proteinCoords.length > 0 ? createBox3FromCoordinates(proteinCoords) : emptyBox.clone());

  const rawNucleicBox3 = nucleicCoords.length > 0
    ? createBox3FromCoordinates(nucleicCoords)
    : isCompANucleic
    ? createBox3FromCoordinates(compA.atoms.map((a) => a.coordinates))
    : isCompBNucleic
    ? createBox3FromCoordinates(compB.atoms.map((a) => a.coordinates))
    : emptyBox.clone();

  const rawNucleicChainABox3 = nucleicChainACoords.length > 0
    ? createBox3FromCoordinates(nucleicChainACoords)
    : emptyBox.clone();

  const rawNucleicChainBBox3 = nucleicChainBCoords.length > 0
    ? createBox3FromCoordinates(nucleicChainBCoords)
    : emptyBox.clone();

  const rawLigandBox3 = isCompBLigand
    ? createBox3FromCoordinates(compB.atoms.map((a) => a.coordinates))
    : (ligandCoords.length > 0 && !isCompBNucleic ? createBox3FromCoordinates(ligandCoords) : emptyBox.clone());

  // Full authoritative component bounding boxes
  const fullProteinBox3 = proteinCoords.length > 0 ? createBox3FromCoordinates(proteinCoords) : emptyBox.clone();
  const fullLigandBox3 = ligandCoords.length > 0 && !isCompBNucleic ? createBox3FromCoordinates(ligandCoords) : emptyBox.clone();
  const fullNucleicBox3 = nucleicCoords.length > 0 ? createBox3FromCoordinates(nucleicCoords) : emptyBox.clone();

  // Validate bounds are finite
  const validateBoxFinite = (box: THREE.Box3, label: string) => {
    if (!box.isEmpty()) {
      if (!Number.isFinite(box.min.x) || !Number.isFinite(box.min.y) || !Number.isFinite(box.min.z) ||
          !Number.isFinite(box.max.x) || !Number.isFinite(box.max.y) || !Number.isFinite(box.max.z)) {
        console.warn(`[structureBounds] Non-finite coordinate detected in ${label}: min=`, box.min, 'max=', box.max);
      }
    }
  };
  validateBoxFinite(fullProteinBox3, 'fullProteinBox3');
  validateBoxFinite(fullLigandBox3, 'fullLigandBox3');
  validateBoxFinite(fullNucleicBox3, 'fullNucleicBox3');

  // Render boxes with controlled clearance for WebGL rasterization
  const renderProteinBox3 = isCompAProtein
    ? compA.bounds.render.box3
    : (rawProteinBox3.isEmpty() ? emptyBox.clone() : expandBox3ByScalar(rawProteinBox3, 0.3));

  const renderNucleicBox3 = rawNucleicBox3.isEmpty()
    ? emptyBox.clone()
    : expandBox3ByScalar(rawNucleicBox3, 0.3);

  const renderLigandBox3 = isCompBLigand
    ? compB.bounds.render.box3
    : (rawLigandBox3.isEmpty() ? emptyBox.clone() : expandBox3ByScalar(rawLigandBox3, 0.3));

  const measuredDistance =
    atomACoords && atomBCoords ? calculateEuclideanDistance(atomACoords, atomBCoords) : null;

  const result: StructureDerivedBounds = {
    proteinAABB: box3ToCoordinateAABB(rawProteinBox3),
    nucleicAABB: box3ToCoordinateAABB(rawNucleicBox3),
    ligandAABB: box3ToCoordinateAABB(rawLigandBox3),
    proteinBox3: rawProteinBox3,
    nucleicBox3: rawNucleicBox3,
    nucleicChainABox3: rawNucleicChainABox3,
    nucleicChainBBox3: rawNucleicChainBBox3,
    ligandBox3: rawLigandBox3,
    fullProteinBox3,
    fullLigandBox3,
    fullNucleicBox3,
    proteinRenderBox3: renderProteinBox3,
    nucleicRenderBox3: renderNucleicBox3,
    ligandRenderBox3: renderLigandBox3,
    proteinDimensions: computeBoxDimensions(rawProteinBox3),
    proteinExtrema: computeBoxExtrema(rawProteinBox3),
    nucleicDimensions: computeBoxDimensions(rawNucleicBox3),
    nucleicExtrema: computeBoxExtrema(rawNucleicBox3),
    ligandDimensions: computeBoxDimensions(rawLigandBox3),
    ligandExtrema: computeBoxExtrema(rawLigandBox3),
    proteinAtomsCount: proteinCount,
    nucleicAtomsCount: nucleicCount,
    ligandAtomsCount: ligandCount,
    waterAtomsCount: waterCount,
    ionAtomsCount: ionCount,
    atomACoords,
    atomBCoords,
    measuredDistance: measuredDistance != null ? Number(measuredDistance.toFixed(2)) : null,
    atomAName: selectionA,
    atomBName: selectionB,
    proteinComponent: isCompAProtein ? compA : undefined,
    nucleicComponent: isCompANucleic ? compA : (isCompBNucleic ? compB : undefined),
    nucleicComponentA: isCompANucleic ? compA : undefined,
    nucleicComponentB: isCompBNucleic ? compB : undefined,
    nucleicType: inferredNucleicType,
    ligandComponent: isCompBLigand ? compB : undefined,
    componentBounds: [compA?.bounds, compB?.bounds].filter(Boolean) as ComponentGeometricBound[],
    extractedAtoms,
    boundKind: 'static',
    isTrajectory: false,
  };

  logGeometryForensicDiagnostic('extractCoordinatesFromMolstarStructure', result);
  return result;
}

/**
 * Extracts atomic coordinates directly from 3Dmol.js model using the canonical component pipeline.
 */
export function extractCoordinatesFrom3DmolModel(
  model: any,
  selectionA = 'A:87:NE2',
  selectionB = 'HEM:142:FE'
): StructureDerivedBounds {
  const emptyBox = new THREE.Box3().makeEmpty();
  if (!model || !model.selectedAtoms) {
    return {
      proteinAABB: computeAtomCoordinatesAABB([]),
      ligandAABB: computeAtomCoordinatesAABB([]),
      proteinBox3: emptyBox,
      ligandBox3: emptyBox,
      proteinAtomsCount: 0,
      ligandAtomsCount: 0,
      atomACoords: null,
      atomBCoords: null,
      measuredDistance: null,
      boundKind: 'static',
      isTrajectory: false,
    };
  }

  const index = buildStructureHierarchyIndex(model, '3dmol_model');

  const compA = resolveMolecularComponent(index, selectionA);
  const compB = resolveMolecularComponent(index, selectionB, {
    chainId: compA?.id.chainId,
    coords: compA?.bounds.raw.center,
  });

  const tokenA = parseCanonicalSelection(selectionA);
  const tokenB = parseCanonicalSelection(selectionB);

  const matchedAtomA = compA?.atoms.find((a) => !tokenA.atomName || a.atomName === tokenA.atomName);
  const matchedAtomB = compB?.atoms.find((a) => !tokenB.atomName || a.atomName === tokenB.atomName);

  const atomACoords: [number, number, number] | null =
    matchedAtomA?.coordinates || compA?.atoms[0]?.coordinates || null;
  const atomBCoords: [number, number, number] | null =
    matchedAtomB?.coordinates || compB?.atoms[0]?.coordinates || null;

  let proteinCount = 0;
  let nucleicCount = 0;
  let ligandCount = 0;
  let waterCount = 0;
  let ionCount = 0;

  for (const comp of index.allComponents) {
    switch (comp.id.classification) {
      case 'protein':
        proteinCount += comp.atoms.length;
        break;
      case 'nucleic':
        nucleicCount += comp.atoms.length;
        break;
      case 'solvent':
        waterCount += comp.atoms.length;
        break;
      case 'ion':
        ionCount += comp.atoms.length;
        break;
      default:
        ligandCount += comp.atoms.length;
        break;
    }
  }

  const isCompANucleic = compA && compA.id.classification === 'nucleic';
  const isCompAProtein = compA && compA.id.classification === 'protein';

  // Scientific unpadded raw boxes
  const rawProteinBox3 = isCompAProtein
    ? compA.bounds.raw.box3
    : (proteinCount > 0 && atomACoords ? createBox3FromCoordinates([atomACoords]) : emptyBox.clone());

  const rawNucleicBox3 = isCompANucleic
    ? compA.bounds.raw.box3
    : (nucleicCount > 0 && atomACoords ? createBox3FromCoordinates([atomACoords]) : emptyBox.clone());

  const rawLigandBox3 = compB
    ? compB.bounds.raw.box3
    : (atomBCoords ? createBox3FromCoordinates([atomBCoords]) : emptyBox.clone());

  // Render boxes with controlled clearance for WebGL rasterization
  const renderProteinBox3 = isCompAProtein
    ? compA.bounds.render.box3
    : (proteinCount > 0 && atomACoords ? expandBox3ByScalar(createBox3FromCoordinates([atomACoords]), 0.4) : emptyBox.clone());

  const renderNucleicBox3 = isCompANucleic
    ? compA.bounds.render.box3
    : (nucleicCount > 0 && atomACoords ? expandBox3ByScalar(createBox3FromCoordinates([atomACoords]), 0.4) : emptyBox.clone());

  const renderLigandBox3 = compB
    ? compB.bounds.render.box3
    : (atomBCoords ? expandBox3ByScalar(createBox3FromCoordinates([atomBCoords]), 0.4) : emptyBox.clone());

  const measuredDistance = (atomACoords && atomBCoords)
    ? Number(calculateEuclideanDistance(atomACoords, atomBCoords).toFixed(2))
    : null;

  const result: StructureDerivedBounds = {
    proteinAABB: box3ToCoordinateAABB(rawProteinBox3),
    nucleicAABB: box3ToCoordinateAABB(rawNucleicBox3),
    ligandAABB: box3ToCoordinateAABB(rawLigandBox3),
    proteinBox3: rawProteinBox3,
    nucleicBox3: rawNucleicBox3,
    ligandBox3: rawLigandBox3,
    proteinRenderBox3: renderProteinBox3,
    nucleicRenderBox3: renderNucleicBox3,
    ligandRenderBox3: renderLigandBox3,
    proteinDimensions: computeBoxDimensions(rawProteinBox3),
    proteinExtrema: computeBoxExtrema(rawProteinBox3),
    nucleicDimensions: computeBoxDimensions(rawNucleicBox3),
    nucleicExtrema: computeBoxExtrema(rawNucleicBox3),
    ligandDimensions: computeBoxDimensions(rawLigandBox3),
    ligandExtrema: computeBoxExtrema(rawLigandBox3),
    proteinAtomsCount: proteinCount,
    nucleicAtomsCount: nucleicCount,
    ligandAtomsCount: ligandCount,
    waterAtomsCount: waterCount,
    ionAtomsCount: ionCount,
    atomACoords,
    atomBCoords,
    measuredDistance,
    atomAName: selectionA,
    atomBName: selectionB,
    proteinComponent: isCompAProtein ? compA : undefined,
    nucleicComponent: isCompANucleic ? compA : undefined,
    ligandComponent: compB || undefined,
    componentBounds: [compA?.bounds, compB?.bounds].filter(Boolean) as ComponentGeometricBound[],
    isTrajectory: false,
    boundKind: 'static',
  };

  logGeometryForensicDiagnostic('extractCoordinatesFrom3DmolModel', result);
  return result;
}
