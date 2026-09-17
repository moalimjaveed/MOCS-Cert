import { PluginContext } from 'molstar/lib/mol-plugin/context.js';
import { StateObjectRef, StateSelection } from 'molstar/lib/mol-state/index.js';
import { CutawayCylinderParams } from '@mocs/geometry';
import { RepresentationType } from '@mocs/scene';
import { VisibilityFilter } from '@mocs/render-contract';
import { Vec3, Mat4 } from 'molstar/lib/mol-math/linear-algebra.js';
import { PROOF_TAGS } from './MolstarState.js';
import type { DatasetCapabilities } from '../../molecular/types/index.js';

export const INSPECTION_TRANSPARENCY_TAG = 'mocs-inspection-transparency';

export interface ActiveDatasetSession {
  datasetId: string;
  revision: number;
  proteinCompRef: string | null;
  proteinReprRef: string | null;
  nucleicCompRef: string | null;
  nucleicReprRef: string | null;
  ligandCompRef: string | null;
  ligandReprRef: string | null;
  solventCompRef: string | null;
  solventReprRef: string | null;
  ionCompRef: string | null;
  ionReprRef: string | null;
  capabilities: DatasetCapabilities;
}

export class MolstarRepresentationManager {
  private session: ActiveDatasetSession | null = null;
  private proteinReprRef: string | null = null;
  private ligandReprRef: string | null = null;
  private nucleicReprRef: string | null = null;
  private solventReprRef: string | null = null;
  private ionReprRef: string | null = null;

  private proteinCompRef: StateObjectRef | null = null;
  private ligandCompRef: StateObjectRef | null = null;
  private nucleicCompRef: StateObjectRef | null = null;
  private solventCompRef: StateObjectRef | null = null;
  private ionCompRef: StateObjectRef | null = null;

  constructor(private readonly plugin: PluginContext) {}

  public hasValidCell(ref: StateObjectRef | string | null | undefined): boolean {
    if (!ref) return false;
    const refStr = typeof ref === 'string' ? ref : StateObjectRef.resolveRef(ref);
    if (!refStr) return false;
    const cells = this.plugin?.state?.data?.cells;
    return Boolean(cells && cells.has(refStr));
  }

  public getRef(ref: StateObjectRef | string | null | undefined): string | null {
    if (!ref) return null;
    return typeof ref === 'string' ? ref : (StateObjectRef.resolveRef(ref) ?? null);
  }

  getActiveSession(): ActiveDatasetSession | null {
    return this.session;
  }

  getDatasetCapabilities(): DatasetCapabilities | null {
    return this.session?.capabilities ?? null;
  }

  disposeSession(): void {
    this.session = null;
    this.proteinReprRef = null;
    this.ligandReprRef = null;
    this.nucleicReprRef = null;
    this.solventReprRef = null;
    this.ionReprRef = null;

    this.proteinCompRef = null;
    this.ligandCompRef = null;
    this.nucleicCompRef = null;
    this.solventCompRef = null;
    this.ionCompRef = null;
  }

  async applyDefaultRepresentations(
    structureRef: StateObjectRef,
    datasetId = 'dataset',
    revision = 1
  ): Promise<DatasetCapabilities> {
    this.disposeSession();
    const builder = this.plugin.builders.structure;

    // 1. Protein component
    let proteinComp: StateObjectRef | null = null;
    try {
      const res = await builder.tryCreateComponentStatic(structureRef, 'protein', {
        label: 'Protein',
        tags: [PROOF_TAGS.REPRESENTATION, 'mocs-comp-protein'],
      });
      proteinComp = res ?? null;
    } catch {
      proteinComp = null;
    }

    // 2. Nucleic Acid component
    let nucleicComp: StateObjectRef | null = null;
    try {
      const res = await builder.tryCreateComponentStatic(structureRef, 'nucleic', {
        label: 'Nucleic Acid',
        tags: [PROOF_TAGS.REPRESENTATION, 'mocs-comp-nucleic'],
      });
      nucleicComp = res ?? null;
    } catch {
      nucleicComp = null;
    }

    // Fallback: If neither protein nor nucleic matched, try polymer
    if (!proteinComp && !nucleicComp) {
      try {
        const polymerComp = await builder.tryCreateComponentStatic(structureRef, 'polymer', {
          label: 'Polymer',
          tags: [PROOF_TAGS.REPRESENTATION, 'mocs-comp-polymer'],
        });
        if (polymerComp && this.hasValidCell(polymerComp)) {
          proteinComp = polymerComp;
        }
      } catch {
        // No polymer
      }
    }

    // 3. Ligand component
    let ligandComp: StateObjectRef | null = null;
    try {
      const res = await builder.tryCreateComponentStatic(structureRef, 'ligand', {
        label: 'Ligand',
        tags: [PROOF_TAGS.REPRESENTATION, 'mocs-comp-ligand'],
      });
      ligandComp = res ?? null;
    } catch {
      ligandComp = null;
    }

    // 4. Solvent / Water component
    let solventComp: StateObjectRef | null = null;
    try {
      const res = await builder.tryCreateComponentStatic(structureRef, 'water', {
        label: 'Water (Solvent)',
        tags: [PROOF_TAGS.REPRESENTATION, 'mocs-comp-solvent'],
      });
      solventComp = res ?? null;
    } catch {
      solventComp = null;
    }

    // 5. Ion component
    let ionComp: StateObjectRef | null = null;
    try {
      const res = await builder.tryCreateComponentStatic(structureRef, 'ion', {
        label: 'Ions',
        tags: [PROOF_TAGS.REPRESENTATION, 'mocs-comp-ion'],
      });
      ionComp = res ?? null;
    } catch {
      ionComp = null;
    }

    // Create Protein Representation (Cartoon)
    if (proteinComp && this.hasValidCell(proteinComp)) {
      this.proteinCompRef = proteinComp;
      try {
        const repr = await builder.representation.addRepresentation(proteinComp, {
          type: 'cartoon',
          colorTheme: { name: 'chain-id' },
        });
        if (repr && this.hasValidCell(repr)) {
          this.proteinReprRef = this.getRef(repr);
        }
      } catch (err) {
        console.warn('[MolstarRepresentation] Failed to add protein representation:', err);
      }
    }

    // Create Nucleic Representation (Cartoon)
    if (nucleicComp && this.hasValidCell(nucleicComp)) {
      this.nucleicCompRef = nucleicComp;
      try {
        const repr = await builder.representation.addRepresentation(nucleicComp, {
          type: 'cartoon',
          colorTheme: { name: 'chain-id' },
        });
        if (repr && this.hasValidCell(repr)) {
          this.nucleicReprRef = this.getRef(repr);
        }
      } catch (err) {
        console.warn('[MolstarRepresentation] Failed to add nucleic representation:', err);
      }
    }

    // Create Ligand Representation (Ball and Stick)
    if (ligandComp && this.hasValidCell(ligandComp)) {
      this.ligandCompRef = ligandComp;
      try {
        const repr = await builder.representation.addRepresentation(ligandComp, {
          type: 'ball-and-stick',
          colorTheme: { name: 'element-symbol' },
        });
        if (repr && this.hasValidCell(repr)) {
          this.ligandReprRef = this.getRef(repr);
        }
      } catch (err) {
        console.warn('[MolstarRepresentation] Failed to add ligand representation:', err);
      }
    }

    // Create Solvent Representation (Ball and Stick, hidden by default for scientific clarity)
    if (solventComp && this.hasValidCell(solventComp)) {
      this.solventCompRef = solventComp;
      try {
        const repr = await builder.representation.addRepresentation(solventComp, {
          type: 'ball-and-stick',
          colorTheme: { name: 'element-symbol' },
        });
        if (repr && this.hasValidCell(repr)) {
          const reprRefStr = this.getRef(repr);
          this.solventReprRef = reprRefStr;
          if (reprRefStr) {
            this.plugin.state.data.updateCellState(reprRefStr, { isHidden: true });
          }
        }
      } catch (err) {
        console.warn('[MolstarRepresentation] Failed to add solvent representation:', err);
      }
    }

    // Create Ion Representation (Ball and Stick)
    if (ionComp && this.hasValidCell(ionComp)) {
      this.ionCompRef = ionComp;
      try {
        const repr = await builder.representation.addRepresentation(ionComp, {
          type: 'ball-and-stick',
          colorTheme: { name: 'element-symbol' },
        });
        if (repr && this.hasValidCell(repr)) {
          this.ionReprRef = this.getRef(repr);
        }
      } catch (err) {
        console.warn('[MolstarRepresentation] Failed to add ion representation:', err);
      }
    }

    const hasProtein = this.proteinCompRef !== null;
    const hasNucleic = this.nucleicCompRef !== null;
    const hasLigand = this.ligandCompRef !== null;
    const hasSolvent = this.solventCompRef !== null;
    const hasIon = this.ionCompRef !== null;
    const isTrajectory = Boolean(
      datasetId.toLowerCase().includes('synth') || datasetId.toLowerCase().includes('trajectory')
    );

    const capabilities: DatasetCapabilities = {
      protein: hasProtein,
      dna: hasNucleic,
      rna: hasNucleic,
      nucleic: hasNucleic,
      ligand: hasLigand,
      solvent: hasSolvent,
      ions: hasIon,
      trajectory: isTrajectory,
      measurements: true,
      aabbProtein: hasProtein,
      aabbNucleic: hasNucleic,
      aabbLigand: hasLigand,
      focus: true,
      explore: true,
      hasBlocks: isTrajectory,
    };

    this.session = {
      datasetId,
      revision,
      proteinCompRef: this.getRef(this.proteinCompRef),
      proteinReprRef: this.proteinReprRef,
      nucleicCompRef: this.getRef(this.nucleicCompRef),
      nucleicReprRef: this.nucleicReprRef,
      ligandCompRef: this.getRef(this.ligandCompRef),
      ligandReprRef: this.ligandReprRef,
      solventCompRef: this.getRef(this.solventCompRef),
      solventReprRef: this.solventReprRef,
      ionCompRef: this.getRef(this.ionCompRef),
      ionReprRef: this.ionReprRef,
      capabilities,
    };

    return capabilities;
  }

  async setComponentRepresentation(
    componentKind: 'protein' | 'nucleic' | 'ligand' | 'solvent' | 'ion',
    reprType: RepresentationType
  ): Promise<void> {
    let compRef: StateObjectRef | null = null;
    let existingRef: string | null = null;

    switch (componentKind) {
      case 'protein':
        compRef = this.proteinCompRef;
        existingRef = this.proteinReprRef;
        break;
      case 'nucleic':
        compRef = this.nucleicCompRef;
        existingRef = this.nucleicReprRef;
        break;
      case 'ligand':
        compRef = this.ligandCompRef;
        existingRef = this.ligandReprRef;
        break;
      case 'solvent':
        compRef = this.solventCompRef;
        existingRef = this.solventReprRef;
        break;
      case 'ion':
        compRef = this.ionCompRef;
        existingRef = this.ionReprRef;
        break;
    }

    if (!compRef || !this.hasValidCell(compRef)) return;

    // Remove existing representation if present and valid
    if (existingRef && this.hasValidCell(existingRef)) {
      const update = this.plugin.build();
      update.delete(existingRef);
      await update.commit();
    }

    if (reprType === 'off') {
      this.updateReprRef(componentKind, null);
      return;
    }

    let molstarReprType: string = reprType;
    if (reprType === 'ball-and-stick' || reprType === 'stick') {
      molstarReprType = 'ball-and-stick';
    } else if (reprType === 'surface') {
      molstarReprType = 'gaussian-surface';
    } else if (reprType === 'spacefill') {
      molstarReprType = 'spacefill';
    } else if (reprType === 'backbone') {
      molstarReprType = 'backbone';
    } else if (reprType === 'cartoon') {
      molstarReprType = 'cartoon';
    }

    const colorTheme =
      componentKind === 'protein' || componentKind === 'nucleic' ? 'chain-id' : 'element-symbol';

    try {
      const newRepr = await this.plugin.builders.structure.representation.addRepresentation(compRef, {
        type: molstarReprType as any,
        colorTheme: { name: colorTheme as any },
      });

      const ref = newRepr && newRepr.ref && this.hasValidCell(newRepr.ref) ? newRepr.ref : null;
      this.updateReprRef(componentKind, ref);
    } catch (err) {
      console.warn(`[MolstarRepresentation] Failed to set ${componentKind} representation:`, err);
    }
  }

  private updateReprRef(
    componentKind: 'protein' | 'nucleic' | 'ligand' | 'solvent' | 'ion',
    ref: string | null
  ): void {
    switch (componentKind) {
      case 'protein':
        this.proteinReprRef = ref;
        if (this.session) this.session.proteinReprRef = ref;
        break;
      case 'nucleic':
        this.nucleicReprRef = ref;
        if (this.session) this.session.nucleicReprRef = ref;
        break;
      case 'ligand':
        this.ligandReprRef = ref;
        if (this.session) this.session.ligandReprRef = ref;
        break;
      case 'solvent':
        this.solventReprRef = ref;
        if (this.session) this.session.solventReprRef = ref;
        break;
      case 'ion':
        this.ionReprRef = ref;
        if (this.session) this.session.ionReprRef = ref;
        break;
    }
  }

  async setVisibility(filter: Partial<VisibilityFilter>): Promise<void> {
    if (filter.protein !== undefined && this.proteinReprRef && this.hasValidCell(this.proteinReprRef)) {
      this.plugin.state.data.updateCellState(this.proteinReprRef, { isHidden: !filter.protein });
    }
    if (filter.nucleic !== undefined && this.nucleicReprRef && this.hasValidCell(this.nucleicReprRef)) {
      this.plugin.state.data.updateCellState(this.nucleicReprRef, { isHidden: !filter.nucleic });
    }
    if (filter.ligand !== undefined && this.ligandReprRef && this.hasValidCell(this.ligandReprRef)) {
      this.plugin.state.data.updateCellState(this.ligandReprRef, { isHidden: !filter.ligand });
    }
    if (filter.solvent !== undefined && this.solventReprRef && this.hasValidCell(this.solventReprRef)) {
      this.plugin.state.data.updateCellState(this.solventReprRef, { isHidden: !filter.solvent });
    }
    if (filter.ions !== undefined && this.ionReprRef && this.hasValidCell(this.ionReprRef)) {
      this.plugin.state.data.updateCellState(this.ionReprRef, { isHidden: !filter.ions });
    }
  }

  /**
   * Applies camera-aware directional pocket cutaway clipping directly to the active
   * biopolymer representations, cleanly revealing the interior active site without radial fog.
   */
  async applyPocketCutaway(cylinder: CutawayCylinderParams): Promise<void> {
    const candidateRefs = [
      this.proteinReprRef,
      this.nucleicReprRef,
      this.ligandReprRef,
    ].filter((r): r is string => Boolean(r && this.hasValidCell(r)));

    if (candidateRefs.length === 0) return;

    const clipObject = {
      type: 'cylinder' as const,
      invert: cylinder.invert ?? false,
      position: Vec3.create(cylinder.position[0], cylinder.position[1], cylinder.position[2]),
      rotation: {
        axis: Vec3.create(cylinder.rotation.axis[0], cylinder.rotation.axis[1], cylinder.rotation.axis[2]),
        angle: cylinder.rotation.angle,
      },
      scale: Vec3.create(cylinder.scale[0], cylinder.scale[1], cylinder.scale[2]),
      transform: Mat4.identity(),
    };

    const update = this.plugin.build();
    for (const ref of candidateRefs) {
      update.to(ref).update((old: any) => {
        if (!old || !old.type) return old;
        return {
          ...old,
          type: {
            ...old.type,
            params: {
              ...old.type.params,
              clip: {
                variant: 'pixel',
                objects: [clipObject],
              },
            },
          },
        };
      });
    }
    await update.commit();
  }

  /**
   * Removes all pocket cutaway clipping, immediately restoring 100% solid, normal cartoon across all biopolymers.
   */
  async clearPocketCutaway(): Promise<void> {
    const candidateRefs = [
      this.proteinReprRef,
      this.nucleicReprRef,
      this.ligandReprRef,
      this.solventReprRef,
      this.ionReprRef,
    ].filter((r): r is string => Boolean(r && this.hasValidCell(r)));

    if (candidateRefs.length > 0) {
      const update = this.plugin.build();
      for (const ref of candidateRefs) {
        update.to(ref).update((old: any) => {
          if (!old || !old.type) return old;
          return {
            ...old,
            type: {
              ...old.type,
              params: {
                ...old.type.params,
                clip: {
                  variant: 'pixel',
                  objects: [],
                },
              },
            },
          };
        });
      }
      await update.commit();
    }
    await this.clearInspectionOcclusion();
  }

  /**
   * Removes local inspection transparency, restoring full 100% normal protein opacity.
   */
  async clearInspectionOcclusion(): Promise<void> {
    const data = this.plugin.state.data;
    const cells = data.select(StateSelection.Generators.root.subtree().withTag(INSPECTION_TRANSPARENCY_TAG));

    if (cells.length === 0) return;

    const update = this.plugin.build();
    for (const c of cells) {
      if (c && c.transform && c.transform.ref && this.hasValidCell(c.transform.ref)) {
        update.delete(c.transform.ref);
      }
    }
    await update.commit();
  }
}

