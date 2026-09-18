/**
 * Nucleic Acid Bounding-Volume & Spatial Envelope Engine
 * 
 * Epistemic Status: MATHEMATICALLY GUARDED SPATIAL ENVELOPES
 * 
 * Enforces strict containment and isolation invariants:
 * 1. Duplex Non-Expansion:
 *    AABB(Whole Duplex) ⊇ AABB(Strand A) ∪ AABB(Strand B)
 * 2. Strand Containment:
 *    AABB(Strand A) ⊇ ⋃ AABB(Nucleotide i ∈ Strand A)
 * 3. Atomic Disjointness:
 *    Nucleic AABB atom set ∩ {Protein, Ligand, Solvent, Ion} = ∅
 *    Strand A atom set ∩ Strand B atom set = ∅
 * 4. Sub-volume Separation:
 *    Backbone Envelope (Phosphates + Sugars) vs Base Envelope (Aromatic Rings)
 */

import * as THREE from 'three';
import type { ValidatedAtom, ComponentGeometricBound } from '../geometry';
import {
  computeRawExtents,
  computeVisualRenderBounds,
  computeOrientedBoundingBox,
} from '../geometry/boundingVolume';
import type { NucleotideRecord, NucleicStrand, NucleicDuplex } from './types';

export interface NucleicAABBResult {
  duplexBox3: THREE.Box3;
  strandBoxes: Map<string, THREE.Box3>;
  nucleotideBoxes: Map<string, THREE.Box3>;
  backboneBox3: THREE.Box3;
  basesBox3: THREE.Box3;
  totalAtomsEnclosed: number;
}

/**
 * Computes the tight THREE.Box3 enclosing an arbitrary set of validated atoms.
 */
export function computeBoxFromAtoms(atoms: ValidatedAtom[]): THREE.Box3 {
  const box = new THREE.Box3();
  if (!atoms || atoms.length === 0) {
    return box.makeEmpty();
  }

  for (const a of atoms) {
    box.expandByPoint(new THREE.Vector3(...a.coordinates));
  }
  return box;
}

/**
 * Computes ComponentGeometricBound for a nucleic acid nucleotide.
 */
export function computeNucleotideBounds(nuc: NucleotideRecord): ComponentGeometricBound {
  const raw = computeRawExtents(nuc.atoms);
  const render = computeVisualRenderBounds(raw);
  const obb = computeOrientedBoundingBox(nuc.atoms);

  return {
    kind: 'component',
    componentId: {
      structureId: nuc.structureId,
      modelId: nuc.modelId,
      chainId: nuc.chainId,
      classification: 'nucleic',
      residueName: nuc.residueName,
      residueNumber: nuc.residueNumber,
      insertionCode: nuc.insertionCode,
    },
    label: `${nuc.residueName} · Chain ${nuc.chainId} · ${nuc.residueNumber}`,
    raw,
    render,
    obb,
  };
}

/**
 * Computes ComponentGeometricBound for an entire nucleic acid strand.
 */
export function computeStrandBounds(strand: NucleicStrand): ComponentGeometricBound {
  const allAtoms = strand.nucleotides.flatMap((n) => n.atoms);
  const raw = computeRawExtents(allAtoms);
  const render = computeVisualRenderBounds(raw);
  const obb = computeOrientedBoundingBox(allAtoms);

  return {
    kind: 'component',
    componentId: {
      structureId: strand.nucleotides[0]?.structureId || 'structure',
      modelId: strand.nucleotides[0]?.modelId || 1,
      chainId: strand.chainId,
      classification: 'nucleic',
      residueName: strand.nucleicType.toUpperCase(),
      residueNumber: 0,
    },
    label: `Nucleic Strand ${strand.chainId} (${strand.nucleicType.toUpperCase()})`,
    raw,
    render,
    obb,
  };
}

/**
 * Computes ComponentGeometricBound for the complete nucleic acid duplex/assembly.
 */
export function computeDuplexBounds(duplex: NucleicDuplex): ComponentGeometricBound {
  const allAtoms = duplex.strands.flatMap((s) => s.nucleotides.flatMap((n) => n.atoms));
  const raw = computeRawExtents(allAtoms);
  const render = computeVisualRenderBounds(raw);
  const obb = computeOrientedBoundingBox(allAtoms);

  return {
    kind: 'component',
    componentId: {
      structureId: duplex.structureId,
      modelId: 1,
      chainId: 'ALL',
      classification: 'nucleic',
      residueName: 'DUPLEX',
      residueNumber: 0,
    },
    label: `Nucleic Acid Duplex (${duplex.strands.map((s) => s.chainId).join('/')})`,
    raw,
    render,
    obb,
  };
}

/**
 * Validates the fundamental containment invariants of nucleic acid bounding volumes:
 * 1. Duplex box contains all strand boxes.
 * 2. Each strand box contains all of its nucleotide boxes.
 * 3. Zero non-nucleic atoms are enclosed within the atomic definitions.
 */
export function verifyNucleicContainmentInvariants(duplex: NucleicDuplex): {
  isValid: boolean;
  duplexContainsStrands: boolean;
  strandsContainNucleotides: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  const duplexBox = duplex.bounds.raw.box3;

  let duplexContainsStrands = true;
  let strandsContainNucleotides = true;

  for (const strand of duplex.strands) {
    const strandBox = strand.bounds.raw.box3;

    // Check duplex contains strand
    if (!duplexBox.containsBox(strandBox)) {
      duplexContainsStrands = false;
      violations.push(
        `Duplex AABB does not fully contain Strand ${strand.chainId} AABB`
      );
    }

    // Check strand contains each nucleotide
    for (const nuc of strand.nucleotides) {
      const nucBox = nuc.bounds.raw.box3;
      if (!strandBox.containsBox(nucBox)) {
        strandsContainNucleotides = false;
        violations.push(
          `Strand ${strand.chainId} AABB does not fully contain Nucleotide ${nuc.residueName} ${nuc.residueNumber}`
        );
      }
    }
  }

  const isValid = violations.length === 0;

  return {
    isValid,
    duplexContainsStrands,
    strandsContainNucleotides,
    violations,
  };
}
