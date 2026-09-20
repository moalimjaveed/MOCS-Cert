import type {
  MolecularComponentId,
  CanonicalSelectionToken,
  ValidatedAtom,
  IndexedComponent,
  StructureHierarchyIndex,
} from './structuralIdentity';
import {
  parseCanonicalSelection,
  classifyResidue,
  validateCoordinates,
} from './structuralIdentity';
import { classifyNucleicType, detectRiboseVsDeoxyribose } from '../nucleic/classifier';
import {
  computeRawExtents,
  computeVisualRenderBounds,
  computeOrientedBoundingBox,
  ComponentGeometricBound,
  GroupGeometricBound,
} from './boundingVolume';

export interface ResolvedMolecularComponent {
  id: MolecularComponentId;
  canonicalLabel: string; // e.g. "HEM · Chain A · 142"
  shortLabel: string;     // e.g. "A:HEM:142"
  classification: string;
  atoms: ValidatedAtom[];
  bounds: ComponentGeometricBound;
}

/**
 * Builds a canonical StructureHierarchyIndex from Mol*, 3Dmol, or raw atom models.
 * 
 * Strict hierarchy:
 * Structure -> Model -> Chain -> Component (Residue/Ligand) -> Atom Array
 */
export function buildStructureHierarchyIndex(
  source: any,
  structureId = 'structure',
  modelId: string | number = 1
): StructureHierarchyIndex {
  const chains = new Map<
    string,
    {
      chainId: string;
      components: Map<string, IndexedComponent>;
      classification: 'protein' | 'nucleic' | 'hetero' | 'mixed';
    }
  >();

  const allComponents: IndexedComponent[] = [];
  let totalValidAtoms = 0;
  let invalidAtomsCount = 0;

  const getOrCreateChain = (cId: string) => {
    const norm = (cId || 'A').trim();
    let c = chains.get(norm);
    if (!c) {
      c = {
        chainId: norm,
        components: new Map<string, IndexedComponent>(),
        classification: 'mixed',
      };
      chains.set(norm, c);
    }
    return c;
  };

  const getOrCreateComponent = (
    chainRecord: ReturnType<typeof getOrCreateChain>,
    resName: string,
    resSeq: number,
    insCode = '',
    isPolymer = false,
    activeModelId: string | number = modelId
  ) => {
    const key = `${activeModelId}:${resName}:${resSeq}${insCode ? ':' + insCode : ''}`;
    let comp = chainRecord.components.get(key);
    if (!comp) {
      const classification = classifyResidue(resName, isPolymer);
      const nucleicType = classification === 'nucleic' ? classifyNucleicType(resName) : undefined;
      const compId: MolecularComponentId = {
        structureId,
        modelId: activeModelId,
        chainId: chainRecord.chainId,
        classification,
        nucleicType,
        residueName: resName,
        residueNumber: resSeq,
        insertionCode: insCode || undefined,
      };

      comp = {
        id: compId,
        canonicalLabel: `${resName} · Chain ${chainRecord.chainId} · ${resSeq}${insCode || ''}`,
        shortLabel: `${chainRecord.chainId}:${resName}:${resSeq}${insCode || ''}`,
        atoms: [],
      };
      chainRecord.components.set(key, comp);
      allComponents.push(comp);
    }
    return comp;
  };

  // Branch A: Mol* Structure object (units with elements & conformation)
  if (source && source.units && Array.isArray(source.units)) {
    try {
      for (const unit of source.units) {
        const isPolymer = unit.polymerElements != null && unit.polymerElements.length > 0;
        const elements = unit.elements;
        const hierarchy = unit.model?.atomicHierarchy || {};
        const atomsField = hierarchy.atoms;
        const residueSegments = hierarchy.residueAtomSegments;
        const chainSegments = hierarchy.chainAtomSegments;
        const chainsField = hierarchy.chains;
        const residues = hierarchy.residues;

        // Coordinate access: prioritize active unit conformation if present, otherwise unit.model.atomicConformation
        const getX = unit.conformation
          ? (idx: number) => unit.conformation.x(idx)
          : (unit.model?.atomicConformation?.x ? (idx: number) => unit.model.atomicConformation.x[idx] : null);
        const getY = unit.conformation
          ? (idx: number) => unit.conformation.y(idx)
          : (unit.model?.atomicConformation?.y ? (idx: number) => unit.model.atomicConformation.y[idx] : null);
        const getZ = unit.conformation
          ? (idx: number) => unit.conformation.z(idx)
          : (unit.model?.atomicConformation?.z ? (idx: number) => unit.model.atomicConformation.z[idx] : null);

        const unitModelId = unit.model?.id ?? unit.model?.modelNum ?? modelId;
        for (let i = 0; i < elements.length; i++) {
          const eIndex = elements[i];
          const rawX = getX ? getX(eIndex) : 0;
          const rawY = getY ? getY(eIndex) : 0;
          const rawZ = getZ ? getZ(eIndex) : 0;
          const coords = validateCoordinates(rawX, rawY, rawZ);
          if (!coords) {
            invalidAtomsCount++;
            continue;
          }

          const rI = residueSegments ? residueSegments.index[eIndex] : -1;
          const cI = chainSegments ? chainSegments.index[eIndex] : -1;

          let chain = (cI >= 0 && chainsField?.auth_asym_id ? chainsField.auth_asym_id.value(cI) : null) ||
                      (cI >= 0 && chainsField?.label_asym_id ? chainsField.label_asym_id.value(cI) : null) ||
                      'A';
          if (typeof chain === 'string') chain = chain.trim();
          if (!chain) chain = 'A';

          const seq = (rI >= 0 && residues?.auth_seq_id ? residues.auth_seq_id.value(rI) : null) ??
                      (rI >= 0 && residues?.label_seq_id ? residues.label_seq_id.value(rI) : null) ??
                      1;

          const insCode = (
            (rI >= 0 && residues?.pdbx_PDB_ins_code ? residues.pdbx_PDB_ins_code.value(rI) : null) ||
            ''
          ).trim();

          const compName = (
            (rI >= 0 && residues?.label_comp_id ? residues.label_comp_id.value(rI) : null) ||
            (rI >= 0 && residues?.auth_comp_id ? residues.auth_comp_id.value(rI) : null) ||
            (atomsField?.label_comp_id ? atomsField.label_comp_id.value(eIndex) : null) ||
            'UNK'
          ).toUpperCase();

          const atomName = (
            (atomsField?.label_atom_id ? atomsField.label_atom_id.value(eIndex) : null) ||
            (atomsField?.auth_atom_id ? atomsField.auth_atom_id.value(eIndex) : null) ||
            ''
          );

          const element = (atomsField?.type_symbol ? atomsField.type_symbol.value(eIndex) : '') || '';

          const chainRec = getOrCreateChain(chain);
          const compRec = getOrCreateComponent(chainRec, compName, seq, insCode, isPolymer, unitModelId);

          compRec.atoms.push({
            id: eIndex,
            atomName,
            element,
            coordinates: coords,
            isHetero: !isPolymer,
          });
          totalValidAtoms++;
        }
      }
    } catch (err) {
      console.warn('buildStructureHierarchyIndex Mol* error:', err);
    }
  }
  // Branch B: 3Dmol Model or Raw Atom Array
  else if (source && (typeof source.selectedAtoms === 'function' || Array.isArray(source))) {
    try {
      const atomArray: any[] = typeof source.selectedAtoms === 'function'
        ? source.selectedAtoms({})
        : source;

      for (let i = 0; i < atomArray.length; i++) {
        const a = atomArray[i];
        const rawX = a.x ?? a.coordinates?.[0];
        const rawY = a.y ?? a.coordinates?.[1];
        const rawZ = a.z ?? a.coordinates?.[2];

        const coords = validateCoordinates(rawX, rawY, rawZ);
        if (!coords) {
          invalidAtomsCount++;
          continue;
        }

        const chain = (a.chain || a.chainId || 'A').trim();
        const parsedResi = typeof a.resi === 'number' ? a.resi : (typeof a.resi === 'string' ? parseInt(a.resi, 10) : undefined);
        const parsedResSeq = typeof a.resSeq === 'number' ? a.resSeq : (typeof a.resSeq === 'string' ? parseInt(a.resSeq, 10) : undefined);
        const seq = Number.isFinite(parsedResi) ? parsedResi! : (Number.isFinite(parsedResSeq) ? parsedResSeq! : 1);

        const strResi = typeof a.resi === 'string' ? a.resi : '';
        const parsedIns = strResi ? strResi.replace(/^[+-]?\d+/, '').trim() : '';
        const insCode = a.insCode || a.insertionCode || parsedIns || '';

        const compName = (a.resn || a.resName || 'UNK').toUpperCase().trim();
        const atomName = (a.atom || a.atomName || '').trim();
        const element = (a.elem || a.element || '').trim();
        const isHetero = !!a.hetflag || !!a.isHetero;

        const chainRec = getOrCreateChain(chain);
        const compRec = getOrCreateComponent(chainRec, compName, seq, insCode, !isHetero);

        compRec.atoms.push({
          id: a.serial ?? i,
          atomName,
          element,
          coordinates: coords,
          isHetero,
        });
        totalValidAtoms++;
      }
    } catch (err) {
      console.warn('buildStructureHierarchyIndex 3Dmol/Array error:', err);
    }
  }

  // Post-processing:
  // 1. Refine nucleic classification based on authentic sugar chemistry (O2' detection)
  // 2. Compute true chain classification from its constituent polymer components
  for (const chain of chains.values()) {
    let hasProtein = false;
    let hasNucleic = false;

    for (const comp of chain.components.values()) {
      if (comp.id.classification === 'nucleic') {
        hasNucleic = true;
        const sugar = detectRiboseVsDeoxyribose(comp.atoms);
        if (sugar === 'ribose') {
          comp.id.nucleicType = 'rna';
        } else if (sugar === 'deoxyribose') {
          comp.id.nucleicType = 'dna';
        } else if (!comp.id.nucleicType || comp.id.nucleicType === 'unspecified') {
          comp.id.nucleicType = classifyNucleicType(comp.id.residueName);
        }
      } else if (comp.id.classification === 'protein') {
        hasProtein = true;
      }
    }

    if (hasProtein && hasNucleic) {
      chain.classification = 'mixed';
    } else if (hasProtein) {
      chain.classification = 'protein';
    } else if (hasNucleic) {
      chain.classification = 'nucleic';
    } else {
      chain.classification = 'hetero';
    }
  }

  return {
    structureId,
    modelId,
    chains,
    allComponents,
    totalValidAtoms,
    invalidAtomsCount,
  };
}

/**
 * Computes ComponentGeometricBound for an IndexedComponent.
 */
export function computeComponentBounds(comp: IndexedComponent): ComponentGeometricBound {
  const raw = computeRawExtents(comp.atoms);
  const render = computeVisualRenderBounds(raw);
  const obb = computeOrientedBoundingBox(comp.atoms);

  return {
    kind: 'component',
    componentId: comp.id,
    label: comp.canonicalLabel,
    raw,
    render,
    obb,
  };
}

/**
 * Resolves a single molecular component with strict chain scoping.
 * 
 * Rules:
 * 1. If query has explicit chain (e.g. "A:87:NE2" or "A:HEM:142"), matches ONLY that chain.
 * 2. If query omits chain (e.g. "HEM:142:FE"):
 *    - Gathers all matching candidates across chains.
 *    - If multiple candidates exist (e.g. Chain A has HEM 142 and Chain C has HEM 142):
 *      - Resolves to candidate in same chain as referenceContext, OR candidate closest in 3D distance.
 *      - NEVER merges multiple candidates across chains into one box!
 */
export function resolveMolecularComponent(
  index: StructureHierarchyIndex,
  query: string | CanonicalSelectionToken,
  referenceContext?: {
    chainId?: string;
    coords?: [number, number, number];
  }
): ResolvedMolecularComponent | null {
  const token = typeof query === 'string' ? parseCanonicalSelection(query) : query;
  if (!token.raw) return null;

  // Case 1: Explicit chain specified
  if (token.isExplicitChain && token.chainId) {
    const chainRec = index.chains.get(token.chainId);
    if (!chainRec) return null;

    for (const comp of chainRec.components.values()) {
      if (token.resSeq != null && comp.id.residueNumber !== token.resSeq) continue;
      if (token.insCode && comp.id.insertionCode !== token.insCode) continue;
      if (token.resName && comp.id.residueName !== token.resName) continue;

      // Found matching component in explicit chain
      const bounds = computeComponentBounds(comp);
      return {
        id: comp.id,
        canonicalLabel: comp.canonicalLabel,
        shortLabel: comp.shortLabel,
        classification: comp.id.classification,
        atoms: comp.atoms,
        bounds,
      };
    }
    return null;
  }

  // Case 2: Chain omitted (e.g. "HEM:142:FE" or "HEM:142")
  const candidates: IndexedComponent[] = [];

  for (const chainRec of index.chains.values()) {
    for (const comp of chainRec.components.values()) {
      if (token.resSeq != null && comp.id.residueNumber !== token.resSeq) continue;
      if (token.insCode && comp.id.insertionCode !== token.insCode) continue;
      if (token.resName && comp.id.residueName !== token.resName) continue;
      candidates.push(comp);
    }
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) {
    const c = candidates[0];
    return {
      id: c.id,
      canonicalLabel: c.canonicalLabel,
      shortLabel: c.shortLabel,
      classification: c.id.classification,
      atoms: c.atoms,
      bounds: computeComponentBounds(c),
    };
  }

  // Multiple candidates exist (e.g. Chain A HEM 142 and Chain C HEM 142)
  // Contextual resolution: NEVER merge them!
  let bestCandidate = candidates[0];

  if (referenceContext?.chainId) {
    const sameChain = candidates.find((c) => c.id.chainId === referenceContext.chainId);
    if (sameChain) {
      bestCandidate = sameChain;
    }
  } else if (referenceContext?.coords) {
    const [rx, ry, rz] = referenceContext.coords;
    let minDist = Infinity;
    for (const c of candidates) {
      const ext = computeRawExtents(c.atoms);
      const [cx, cy, cz] = ext.center;
      const d = Math.sqrt((cx - rx) ** 2 + (cy - ry) ** 2 + (cz - rz) ** 2);
      if (d < minDist) {
        minDist = d;
        bestCandidate = c;
      }
    }
  }

  return {
    id: bestCandidate.id,
    canonicalLabel: bestCandidate.canonicalLabel,
    shortLabel: bestCandidate.shortLabel,
    classification: bestCandidate.id.classification,
    atoms: bestCandidate.atoms,
    bounds: computeComponentBounds(bestCandidate),
  };
}

/**
 * Resolves all matching components as distinct, independent objects.
 * Useful when inspecting all ligands or all chains of a tetramer.
 */
export function resolveAllMatchingComponents(
  index: StructureHierarchyIndex,
  query: string | CanonicalSelectionToken
): ResolvedMolecularComponent[] {
  const token = typeof query === 'string' ? parseCanonicalSelection(query) : query;
  const results: ResolvedMolecularComponent[] = [];

  for (const chainRec of index.chains.values()) {
    if (token.isExplicitChain && token.chainId && chainRec.chainId !== token.chainId) {
      continue;
    }

    for (const comp of chainRec.components.values()) {
      if (token.resSeq != null && comp.id.residueNumber !== token.resSeq) continue;
      if (token.insCode && comp.id.insertionCode !== token.insCode) continue;
      if (token.resName && comp.id.residueName !== token.resName) continue;

      results.push({
        id: comp.id,
        canonicalLabel: comp.canonicalLabel,
        shortLabel: comp.shortLabel,
        classification: comp.id.classification,
        atoms: comp.atoms,
        bounds: computeComponentBounds(comp),
      });
    }
  }

  return results;
}

/**
 * Creates an explicit GroupGeometricBound enclosing multiple distinct components.
 * Strictly preserves member component identities.
 */
export function createGroupBound(
  components: ResolvedMolecularComponent[],
  groupLabel: string
): GroupGeometricBound {
  const allAtoms = components.flatMap((c) => c.atoms);
  const raw = computeRawExtents(allAtoms);
  const render = computeVisualRenderBounds(raw);

  return {
    kind: 'group',
    groupLabel,
    memberComponentIds: components.map((c) => c.id),
    raw,
    render,
    components: components.map((c) => c.bounds),
  };
}
