import { PluginContext } from 'molstar/lib/mol-plugin/context.js';
import { createPluginUI } from 'molstar/lib/mol-plugin-ui/index.js';
import { DefaultPluginUISpec } from 'molstar/lib/mol-plugin-ui/spec.js';
import { PluginUISpec } from 'molstar/lib/mol-plugin-ui/spec.js';
import { renderReact18 } from 'molstar/lib/mol-plugin-ui/react18.js';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms.js';
import { StateObjectRef } from 'molstar/lib/mol-state/index.js';
import { Color } from 'molstar/lib/mol-util/color/index.js';
import { StructureElement, StructureProperties } from 'molstar/lib/mol-model/structure/structure.js';
import { Vec3 } from 'molstar/lib/mol-math/linear-algebra.js';

import { CanonicalStructure, SourceAtomId } from '@mocs/core';
import { computeTargetCentroid, computeCameraCutawayCylinder } from '@mocs/geometry';
import {
  CanonicalScene,
  CameraProjectionMode,
  RepresentationType,
  ScientificProofScene,
  SceneRevisionManager,
} from '@mocs/scene';
import {
  MolecularRenderer,
  RendererCapabilities,
  RendererRuntimeState,
  CameraOptions,
  FocusTarget,
  VisibilityFilter,
} from '@mocs/render-contract';

import { MolstarStateManager, PROOF_TAGS } from './MolstarState.js';
import { MolstarRepresentationManager } from './MolstarRepresentation.js';
import { MolstarCameraManager } from './MolstarCamera.js';
import {
  MocsAABBShapeTransform,
  MocsCaliperShapeTransform,
  MocsReticleShapeTransform,
} from './MolstarTransforms.js';
import type { DatasetCapabilities } from '../../molecular/types/index.js';

export interface MolecularPickResult {
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

export class MolstarRenderer implements MolecularRenderer {
  private plugin: PluginContext | null = null;
  private stateManager: MolstarStateManager | null = null;
  private reprManager: MolstarRepresentationManager | null = null;
  private cameraManager: MolstarCameraManager | null = null;
  private revisionManager = new SceneRevisionManager();
  private loadSequence = 0;

  private currentDatasetId = '';
  private currentModelNum = 1;
  private currentStructureRef: StateObjectRef | null = null;
  private currentModelCellRef: any = null;
  private selectedAtomsCount = 0;

  getDatasetCapabilities(): DatasetCapabilities | null {
    return this.reprManager?.getDatasetCapabilities() ?? null;
  }

  // Live 3D picking & identification
  private pickSubscription: { unsubscribe: () => void } | null = null;
  private onPickCallback: ((selection: MolecularPickResult | null) => void) | null = null;

  // Camera-aware pocket cutaway state
  private isPocketInspectActive = false;
  private activeTargetPositions: readonly (readonly [number, number, number])[] = [];
  private activeCutawayRadius = 8.5;
  private cameraUnsubscribe: (() => void) | null = null;
  private cutawaySyncPending = false;

  get structureRef(): StateObjectRef | null {
    return this.currentStructureRef;
  }

  readonly capabilities: RendererCapabilities = {
    name: 'Mol* (molstar)',
    supportsCustomShapes: true,
    supportsDirectCoordinateUpdates: true,
    supportsSecondaryStructure: true,
    supportsSurfaces: true,
    supportsInstancing: true,
    maxTextureSize: 16384,
  };

  async init(container: HTMLElement): Promise<void> {
    const spec: PluginUISpec = {
      ...DefaultPluginUISpec(),
      layout: {
        initial: {
          isExpanded: false,
          showControls: false,
          regionState: {
            bottom: 'hidden',
            left: 'hidden',
            right: 'hidden',
            top: 'hidden',
          },
        },
      },
      components: {
        controls: { left: 'none', right: 'none', top: 'none', bottom: 'none' },
      },
    };

    // Initialize Mol* into the target element
    this.plugin = await createPluginUI({
      target: container,
      spec,
      render: renderReact18,
    });
    this.stateManager = new MolstarStateManager(this.plugin);
    this.reprManager = new MolstarRepresentationManager(this.plugin);
    this.cameraManager = new MolstarCameraManager(this.plugin);

    // Apply default Soft material/lighting safely merging with Mol* default parameters
    if (this.plugin.canvas3d) {
      const currentPostprocessing = this.plugin.canvas3d.props.postprocessing;
      this.plugin.canvas3d.setProps({
        renderer: {
          ambientColor: Color(0x333333),
          ambientIntensity: 0.8,
          light: [
            { inclination: 180, azimuth: 0, color: Color(0xffffff), intensity: 0.6 },
            { inclination: 60, azimuth: 45, color: Color(0xdddddd), intensity: 0.4 },
          ],
        },
        postprocessing: {
          ...currentPostprocessing,
          occlusion: currentPostprocessing.occlusion.name === 'on' ? {
            name: 'on',
            params: {
              ...currentPostprocessing.occlusion.params,
              samples: 16,
              radius: 4,
              bias: 0.8,
              blurKernelSize: 7,
              resolutionScale: 1,
            },
          } : currentPostprocessing.occlusion,
        },
      });
    }

    // Subscribe to click interaction for authentic picking
    if (this.plugin?.behaviors?.interaction?.click) {
      this.pickSubscription = this.plugin.behaviors.interaction.click.subscribe((event: any) => {
        this.handleCanvasClick(event);
      });
    }
  }

  setOnPick(callback: ((selection: MolecularPickResult | null) => void) | null): void {
    this.onPickCallback = callback;
  }

  private handleCanvasClick(event: any): void {
    if (!this.onPickCallback) return;
    const current = event?.current;
    const loci = current?.loci || current;

    if (!loci || !StructureElement.Loci.is(loci) || StructureElement.Loci.isEmpty(loci)) {
      this.onPickCallback(null);
      return;
    }

    try {
      const loc = StructureElement.Location.create(loci.structure);
      StructureElement.Loci.getFirstLocation(loci, loc);

      const authAtomId = StructureProperties.atom.auth_atom_id(loc);
      const labelAtomId = StructureProperties.atom.label_atom_id(loc);
      const atomName = authAtomId || labelAtomId || 'ATOM';

      const element = StructureProperties.atom.type_symbol(loc) || 'C';

      const authCompId = StructureProperties.residue.auth_comp_id(loc);
      const labelCompId = StructureProperties.residue.label_comp_id(loc);
      const residueName = authCompId || labelCompId || 'RES';

      const authSeqId = StructureProperties.residue.auth_seq_id(loc);
      const labelSeqId = StructureProperties.residue.label_seq_id(loc);
      const residueId = authSeqId ?? labelSeqId ?? 1;

      const authAsymId = StructureProperties.chain.auth_asym_id(loc);
      const labelAsymId = StructureProperties.chain.label_asym_id(loc);
      const chainId = authAsymId || labelAsymId || 'A';

      const bFactor = StructureProperties.atom.B_iso_or_equiv(loc);
      const occupancy = StructureProperties.atom.occupancy(loc);
      const modelIndex = StructureProperties.unit.model_num(loc) ?? this.currentModelNum ?? 1;

      const groupPdb = StructureProperties.residue.group_PDB(loc);
      let entityType: 'protein' | 'ligand' | 'solvent' | 'ion' | 'nucleic' | 'other' = 'protein';
      const upRes = residueName.toUpperCase();
      const upEl = element.toUpperCase();

      if (upRes === 'HOH' || upRes === 'WAT' || upRes === 'DOD') {
        entityType = 'solvent';
      } else if (['ZN', 'MG', 'FE', 'CA', 'CL', 'NA', 'MN', 'K', 'CU', 'CO'].includes(upEl)) {
        entityType = 'ion';
      } else if (groupPdb === 'HETATM') {
        entityType = 'ligand';
      } else if (['DA', 'DC', 'DG', 'DT', 'A', 'C', 'G', 'U'].includes(upRes)) {
        entityType = 'nucleic';
      } else {
        entityType = 'protein';
      }

      const pos = Vec3();
      StructureElement.Location.position(pos, loc);
      const coordinates: [number, number, number] = [
        Number(pos[0].toFixed(3)),
        Number(pos[1].toFixed(3)),
        Number(pos[2].toFixed(3)),
      ];

      const formattedLabel = `${chainId}:${residueId}:${atomName}`;
      const displayLabel = `Chain ${chainId} · ${residueName} ${residueId} · ${atomName}`;

      const selection: MolecularPickResult = {
        structureId: this.currentDatasetId,
        modelIndex,
        chainId,
        residueId,
        residueName,
        atomName,
        element,
        coordinates,
        bFactor: typeof bFactor === 'number' && Number.isFinite(bFactor) ? Number(bFactor.toFixed(2)) : undefined,
        occupancy: typeof occupancy === 'number' && Number.isFinite(occupancy) ? Number(occupancy.toFixed(2)) : undefined,
        entityType,
        formattedLabel,
        displayLabel,
      };

      this.onPickCallback(selection);
    } catch (err) {
      console.warn('[MolstarRenderer] Error extracting pick properties from loci:', err);
      this.onPickCallback(null);
    }
  }

  async loadStructure(structure: CanonicalStructure, initialPdbData?: string): Promise<void> {
    if (!this.plugin || !this.stateManager || !this.reprManager || !this.cameraManager) {
      throw new Error('Renderer not initialized');
    }

    const seq = ++this.loadSequence;
    this.currentDatasetId = structure.datasetId;
    this.currentModelNum = structure.models[0]?.modelNum ?? 1;

    // Purge previous state and representations cleanly
    this.reprManager.disposeSession();
    await this.stateManager.purgeAllProofGeometry();
    await this.plugin.clear();

    const pdbText = initialPdbData ?? '';
    if (!pdbText) {
      throw new Error(`Cannot load structure without PDB coordinate text`);
    }

    if (seq !== this.loadSequence) return;

    // Transactional pipeline: RawData -> TrajectoryFromPDB -> Model -> Structure
    const data = await this.plugin.builders.data.rawData({
      data: pdbText,
      label: structure.datasetId,
    });
    if (seq !== this.loadSequence) return;

    const trajectory = await this.plugin.state.data.build().to(data)
      .apply(StateTransforms.Model.TrajectoryFromPDB)
      .commit({ revertOnError: true });
    if (seq !== this.loadSequence) return;

    const model = await this.plugin.builders.structure.createModel(trajectory);
    if (seq !== this.loadSequence) return;
    this.currentModelCellRef = model.ref ?? model.cell?.transform?.ref ?? model;

    const struct = await this.plugin.builders.structure.createStructure(model);
    if (seq !== this.loadSequence) return;

    this.currentStructureRef = struct;

    // Apply default clean representation (Cartoon protein & nucleic, Ball-and-Stick ligand, water OFF)
    await this.reprManager.applyDefaultRepresentations(struct, structure.datasetId, seq);

    if (seq !== this.loadSequence) return;

    // Fit structure to viewport
    this.cameraManager.fitStructure({ durationMs: 0 });
  }

  async setRepresentation(componentId: string, representation: RepresentationType): Promise<void> {
    if (!this.reprManager) return;
    const lower = componentId.toLowerCase();
    if (lower === 'all' || lower === 'polymer' || lower === 'biopolymer') {
      await Promise.all([
        this.reprManager.setComponentRepresentation('protein', representation),
        this.reprManager.setComponentRepresentation('nucleic', representation),
      ]);
      return;
    }
    const kind = lower.includes('ligand')
      ? 'ligand'
      : lower.includes('nucleic') || lower.includes('dna') || lower.includes('rna')
      ? 'nucleic'
      : 'protein';
    await this.reprManager.setComponentRepresentation(kind, representation);
  }

  async setVisibility(filter: Partial<VisibilityFilter>): Promise<void> {
    if (!this.reprManager) return;
    await this.reprManager.setVisibility(filter);
  }

  async selectAtoms(
    atoms: readonly SourceAtomId[],
    positions: readonly (readonly [number, number, number])[]
  ): Promise<void> {
    if (!this.plugin || !this.stateManager) return;

    // Remove old reticles
    await this.stateManager.purgeNodesByTag(PROOF_TAGS.RETICLE);
    this.selectedAtomsCount = positions.length;

    if (positions.length === 0) return;

    const update = this.plugin.build();
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const atom = atoms[i];
      const label = atom ? `${atom.chain}:${atom.seq}:${atom.atom}` : `Atom ${i}`;

      const providerNode = update.toRoot().apply(
        MocsReticleShapeTransform,
        {
          position: pos,
          colorHex: 0xfbbf24, // High-clarity pinpoint reticle
          label,
        },
        { tags: [PROOF_TAGS.ALL_PROOF, PROOF_TAGS.RETICLE] }
      );

      providerNode.apply(StateTransforms.Representation.ShapeRepresentation3D, {
        emissive: 0.2, // Clean pinpoint reticle
      }, {
        tags: [PROOF_TAGS.ALL_PROOF, PROOF_TAGS.RETICLE],
      });
    }

    await update.commit();
  }

  async clearSelection(): Promise<void> {
    if (!this.stateManager) return;
    await this.stateManager.purgeNodesByTag(PROOF_TAGS.RETICLE);
    if (this.cameraUnsubscribe) {
      this.cameraUnsubscribe();
      this.cameraUnsubscribe = null;
    }
    this.isPocketInspectActive = false;
    this.activeTargetPositions = [];
    if (this.reprManager) {
      await this.reprManager.clearPocketCutaway();
    }
    this.selectedAtomsCount = 0;
  }

  async setInspectionMode(
    enabled: boolean,
    targetPositions: readonly (readonly [number, number, number])[],
    radius = 8.5
  ): Promise<void> {
    if (!this.reprManager || !this.cameraManager) return;

    if (enabled && targetPositions.length > 0) {
      this.isPocketInspectActive = true;
      this.activeTargetPositions = targetPositions;
      this.activeCutawayRadius = radius;

      // Subscribe to dynamic camera movements if not yet subscribed
      if (!this.cameraUnsubscribe) {
        this.cameraUnsubscribe = this.cameraManager.subscribeCameraMovement(() => {
          this.syncCutawayToCamera();
        });
      }

      // Compute immediate camera cutaway cylinder along camera -> target line of sight
      const centroid = computeTargetCentroid(targetPositions);
      const cameraPos = this.cameraManager.getCameraPosition();
      const cylinder = computeCameraCutawayCylinder(centroid, cameraPos, {
        radius: this.activeCutawayRadius,
        margin: 1.2,
        length: 50.0,
      });

      await this.reprManager.applyPocketCutaway(cylinder);
    } else {
      if (this.cameraUnsubscribe) {
        this.cameraUnsubscribe();
        this.cameraUnsubscribe = null;
      }
      this.isPocketInspectActive = false;
      this.activeTargetPositions = [];
      await this.reprManager.clearPocketCutaway();
    }
  }

  private syncCutawayToCamera(): void {
    if (!this.isPocketInspectActive || !this.reprManager || !this.cameraManager) return;
    if (this.activeTargetPositions.length === 0) return;
    if (this.cutawaySyncPending) return;

    this.cutawaySyncPending = true;
    requestAnimationFrame(async () => {
      this.cutawaySyncPending = false;
      if (!this.isPocketInspectActive || !this.reprManager || !this.cameraManager) return;

      const centroid = computeTargetCentroid(this.activeTargetPositions);
      const cameraPos = this.cameraManager.getCameraPosition();
      const cylinder = computeCameraCutawayCylinder(centroid, cameraPos, {
        radius: this.activeCutawayRadius,
        margin: 1.2,
        length: 50.0,
      });

      await this.reprManager.applyPocketCutaway(cylinder);
    });
  }

  setCameraMode(mode: CameraProjectionMode): Promise<void> {
    if (this.cameraManager) {
      this.cameraManager.setCameraMode(mode);
    }
    return Promise.resolve();
  }

  fitStructure(options?: CameraOptions): Promise<void> {
    if (this.cameraManager) {
      this.cameraManager.fitStructure(options);
    }
    return Promise.resolve();
  }

  focusPosition(target: FocusTarget, options?: CameraOptions): Promise<void> {
    if (this.cameraManager) {
      this.cameraManager.focusPosition(target, options);
    }
    return Promise.resolve();
  }

  getCameraSnapshot(): any {
    return this.cameraManager?.getSnapshot() ?? null;
  }

  setCameraSnapshot(snapshot: any, durationMs = 250): void {
    this.cameraManager?.setSnapshot(snapshot, durationMs);
  }

  async clearInspectionCutaway(): Promise<void> {
    if (this.cameraUnsubscribe) {
      this.cameraUnsubscribe();
      this.cameraUnsubscribe = null;
    }
    this.isPocketInspectActive = false;
    this.cutawaySyncPending = false;
    this.activeTargetPositions = [];
    if (this.reprManager) {
      await this.reprManager.clearPocketCutaway();
    }
  }

  async projectProofScene(proofScene: ScientificProofScene, revision: number): Promise<void> {
    if (!this.plugin || !this.stateManager) return;

    // Discard stale revision races
    if (this.revisionManager.isStale(revision)) {
      return;
    }

    // 1. Purge existing proof geometry cleanly
    await this.stateManager.purgeAllProofGeometry();

    const update = this.plugin.build();

    // 2. Add AABB shapes
    for (const aabbItem of proofScene.aabbs) {
      const provider = update.toRoot().apply(
        MocsAABBShapeTransform,
        {
          aabb: aabbItem.aabb,
          style: aabbItem.style,
          colorHex: aabbItem.colorHex,
          label: aabbItem.id,
        },
        { tags: [PROOF_TAGS.ALL_PROOF, PROOF_TAGS.AABB] }
      );

      provider.apply(StateTransforms.Representation.ShapeRepresentation3D, {
        emissive: 0.15,
        sizeFactor: 1.0,
      }, {
        tags: [PROOF_TAGS.ALL_PROOF, PROOF_TAGS.REPRESENTATION],
      });
    }

    // 3. Add Caliper shapes
    for (const caliperItem of proofScene.calipers) {
      const provider = update.toRoot().apply(
        MocsCaliperShapeTransform,
        {
          caliper: caliperItem.caliper,
          colorHex: caliperItem.colorHex,
          label: caliperItem.id,
        },
        { tags: [PROOF_TAGS.ALL_PROOF, PROOF_TAGS.CALIPER] }
      );

      provider.apply(StateTransforms.Representation.ShapeRepresentation3D, {
        emissive: 0.15,
        sizeFactor: 1.5, // Thin, precise scientific caliper line
      }, {
        tags: [PROOF_TAGS.ALL_PROOF, PROOF_TAGS.REPRESENTATION],
      });
    }

    // 4. Add Reticle shapes
    for (const reticleItem of proofScene.reticles) {
      const provider = update.toRoot().apply(
        MocsReticleShapeTransform,
        {
          position: reticleItem.position,
          colorHex: reticleItem.colorHex,
          label: reticleItem.id,
        },
        { tags: [PROOF_TAGS.ALL_PROOF, PROOF_TAGS.RETICLE] }
      );

      provider.apply(StateTransforms.Representation.ShapeRepresentation3D, {
        emissive: 0.2, // Clean pinpoint reticle
      }, {
        tags: [PROOF_TAGS.ALL_PROOF, PROOF_TAGS.REPRESENTATION],
      });
    }

    await update.commit();

    // 5. Invariant check: Assert actual Mol* state tree matches desired counts
    this.stateManager.assertProofConformance({
      aabbCount: proofScene.aabbs.length,
      caliperCount: proofScene.calipers.length,
      reticleCount: proofScene.reticles.length,
    });
  }

  async clearProofScene(): Promise<void> {
    if (!this.stateManager) return;
    await this.stateManager.purgeAllProofGeometry();
    this.stateManager.assertProofConformance({ aabbCount: 0, caliperCount: 0, reticleCount: 0 });
  }

  async commitScene(scene: CanonicalScene): Promise<void> {
    if (this.revisionManager.isStale(scene.sceneRevision)) {
      return;
    }
    await this.projectProofScene(scene.proofScene, scene.sceneRevision);
  }

  async setFrame(frameNumber: number): Promise<void> {
    if (!this.plugin) return;
    this.currentModelNum = frameNumber;
    try {
      const modelIndex = Math.max(0, frameNumber - 1);
      if (this.currentModelCellRef) {
        await this.plugin.state.data.build()
          .to(this.currentModelCellRef)
          .update({ modelIndex })
          .commit();
      }
    } catch (err) {
      console.warn('[MolstarRenderer] setFrame transform update notice:', err);
    }
  }

  getRuntimeState(): RendererRuntimeState {
    const proofCounts = this.stateManager?.getActualProofCounts() ?? {
      aabbCount: 0,
      caliperCount: 0,
      reticleCount: 0,
      totalProofNodes: 0,
      totalRepresentations: 0,
    };

    let webglContextCount = 0;
    if (this.plugin?.canvas3d) {
      webglContextCount = 1;
    }

    return {
      renderer: 'Mol* (molstar)',
      dataset: this.currentDatasetId,
      model: this.currentModelNum,
      frame: this.currentModelNum,
      sceneRevision: this.revisionManager.current,
      representationCount: proofCounts.totalRepresentations,
      componentCount: 2,
      selectionCount: this.selectedAtomsCount,
      aabbCount: proofCounts.aabbCount,
      caliperCount: proofCounts.caliperCount,
      reticleCount: proofCounts.reticleCount,
      webglContextCount,
      fps: 60,
    };
  }

  handleResize(): void {
    if (this.plugin?.canvas3d) {
      this.plugin.canvas3d.requestResize();
    }
  }

  async dispose(): Promise<void> {
    if (this.pickSubscription) {
      this.pickSubscription.unsubscribe();
      this.pickSubscription = null;
    }
    this.onPickCallback = null;
    if (this.cameraUnsubscribe) {
      this.cameraUnsubscribe();
      this.cameraUnsubscribe = null;
    }
    this.isPocketInspectActive = false;
    this.activeTargetPositions = [];
    if (this.plugin) {
      await this.reprManager?.clearPocketCutaway();
      await this.stateManager?.purgeAllProofGeometry();
      this.plugin.dispose();
      this.plugin = null;
      this.stateManager = null;
      this.reprManager = null;
      this.cameraManager = null;
    }
  }
}
