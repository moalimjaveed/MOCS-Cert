import { create } from 'zustand';
import type {
  AtomRef,
  MeasurementToolState,
  AABBMode,
  StructureMetadata,
  MolecularSelection,
  DatasetCapabilities,
} from '../molecular/types';
import type { ResolveStructureInput } from '../molecular/resolver/resolveStructure';
import { getStructureMetadata } from '../molecular/data/structureRegistry';
import {
  calculateEuclideanDistance,
  calculateMinimumImageDistance,
  createDistanceMeasurement,
  type CanonicalMeasurement,
} from '../molecular/measurements';
import { useEvidenceStore } from './useEvidenceStore';
import { useProofStore } from './useProofStore';
import { useTimelineStore } from './useTimelineStore';
import { useScanStore } from './useScanStore';

export type MoleculeKind =
  | 'protein'
  | 'nucleic'
  | 'ligand'
  | 'water'
  | 'ion'
  | 'lipid'
  | 'carbohydrate'
  | 'other';

export interface ComponentCounts {
  protein: number;
  nucleic: number;
  ligand: number;
  water: number;
  ion: number;
  lipid: number;
  carbohydrate: number;
}

export interface ViewerState {
  representation: 'cartoon' | 'sticks' | 'surface' | 'spheres' | 'backbone';
  showAABB: boolean;
  showCalipers: boolean;
  showProtein: boolean;
  showNucleic: boolean;
  showLigand: boolean;
  showWater: boolean;
  showIon: boolean;
  showProteinAABB: boolean;
  showNucleicAABB: boolean;
  showLigandAABB: boolean;
  showMeasurementLine: boolean;
  componentCounts: ComponentCounts;
  selectionA: string;
  selectionB: string;
  selectedEntity: MolecularSelection | null;
  setSelectedEntity: (entity: MolecularSelection | null) => void;
  distanceThreshold: number;
  measuredDistance: number;
  cameraDistance: number;
  aabbMode: AABBMode;
  measurementToolState: MeasurementToolState;
  measuringAtomA: AtomRef | null;
  measuringAtomB: AtomRef | null;
  isInspectingAABB: boolean;
  hoveredAABB: 'protein' | 'nucleic' | 'ligand' | 'block' | null;
  cameraProjection: 'perspective' | 'orthographic';
  inspectionMode: 'normal' | 'pocket-inspect';
  inspectionRadius: number;
  setCameraProjection: (proj: 'perspective' | 'orthographic') => void;
  setInspectionMode: (mode: 'normal' | 'pocket-inspect') => void;
  setInspectionRadius: (radius: number) => void;
  isSelectionContextMode: boolean;
  toggleSelectionContextMode: () => void;
  capabilities: DatasetCapabilities | null;
  setCapabilities: (caps: DatasetCapabilities | null) => void;
  // Molecular Explorer State
  isExplorerOpen: boolean;
  activeStructureId: string;
  activeStructureInput: ResolveStructureInput | null;
  activeAssemblyId: string | null;
  boxExtents: [number, number, number];
  recentStructures: StructureMetadata[];
  openExplorer: () => void;
  closeExplorer: () => void;
  selectStructure: (id: string, input?: ResolveStructureInput) => void;
  setActiveAssemblyId: (assemblyId: string | null) => void;
  setBoxExtents: (extents: [number, number, number]) => void;
  setRepresentation: (rep: ViewerState['representation']) => void;
  toggleAABB: () => void;
  toggleCalipers: () => void;
  toggleProtein: () => void;
  toggleNucleic: () => void;
  toggleLigand: () => void;
  toggleWater: () => void;
  toggleIon: () => void;
  toggleProteinAABB: () => void;
  toggleNucleicAABB: () => void;
  toggleLigandAABB: () => void;
  toggleMeasurementLine: () => void;
  toggleInspectingAABB: () => void;
  setInspectingAABB: (val: boolean) => void;
  setHoveredAABB: (val: 'protein' | 'nucleic' | 'ligand' | 'block' | null) => void;
  setComponentCounts: (counts: Partial<ComponentCounts>) => void;
  setSelections: (a: string, b: string) => void;
  clearSelections: () => void;
  setDistanceThreshold: (val: number) => void;
  setMeasuredDistance: (val: number) => void;
  setAABBMode: (mode: AABBMode) => void;
  startMeasurement: () => void;
  cancelMeasurement: () => void;
  clearMeasurement: () => void;
  setMeasuringAtom: (atom: AtomRef, isTrajectory?: boolean, customBoxExtents?: [number, number, number]) => void;
  measurements: CanonicalMeasurement[];
  addMeasurement: (m: CanonicalMeasurement) => void;
  removeMeasurement: (id: string) => void;
  clearMeasurements: () => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  representation: 'cartoon',
  showAABB: false,
  showCalipers: false,
  showProtein: true,
  showNucleic: true,
  showLigand: true,
  showWater: false,
  showIon: true,
  showProteinAABB: false,
  showNucleicAABB: false,
  showLigandAABB: false,
  showMeasurementLine: false,
  componentCounts: {
    protein: 0,
    nucleic: 0,
    ligand: 0,
    water: 0,
    ion: 0,
    lipid: 0,
    carbohydrate: 0,
  },
  selectionA: '',
  selectionB: '',
  selectedEntity: null,
  setSelectedEntity: (entity) =>
    set((state) => {
      if (!entity) {
        return {
          selectedEntity: null,
          selectionA: '',
        };
      }

      // If in measurement mode, advance measurement flow
      if (
        state.measurementToolState === 'selecting-first-atom' ||
        state.measurementToolState === 'selecting-second-atom'
      ) {
        const atomRef: AtomRef = {
          label: entity.formattedLabel,
          coords: entity.coordinates,
          chain: entity.chainId,
          resSeq: entity.residueId,
          resName: entity.residueName,
          atomName: entity.atomName,
        };
        const isTrajectory =
          entity.structureId.toLowerCase().includes('synth') ||
          entity.structureId.toLowerCase().includes('trajectory');

        if (state.measurementToolState === 'selecting-first-atom') {
          return {
            selectedEntity: entity,
            selectionA: entity.formattedLabel,
            measuringAtomA: atomRef,
            measurementToolState: 'selecting-second-atom',
          };
        }

        if (state.measurementToolState === 'selecting-second-atom' && state.measuringAtomA) {
          const p1 = state.measuringAtomA.coords;
          const p2 = atomRef.coords;
          const box = state.boxExtents || [80, 80, 80];
          const dist = isTrajectory
            ? calculateMinimumImageDistance(p1, p2, box)
            : calculateEuclideanDistance(p1, p2);

          if (!Number.isFinite(dist)) {
            return {
              selectedEntity: entity,
              measurementToolState: 'idle',
              measuringAtomA: null,
              measuringAtomB: null,
              showMeasurementLine: false,
            };
          }

          const finalDist = Number(dist.toFixed(2));
          const canonical = createDistanceMeasurement(
            {
              label: state.measuringAtomA.label,
              coords: state.measuringAtomA.coords,
              chainId: state.measuringAtomA.chain,
              resSeq: state.measuringAtomA.resSeq,
              resName: state.measuringAtomA.resName,
              atomName: state.measuringAtomA.atomName,
            },
            {
              label: atomRef.label,
              coords: atomRef.coords,
              chainId: atomRef.chain,
              resSeq: atomRef.resSeq,
              resName: atomRef.resName,
              atomName: atomRef.atomName,
            },
            {
              isPbc: isTrajectory,
              boxExtents: box,
            }
          );

          return {
            selectedEntity: entity,
            measuringAtomB: atomRef,
            measuredDistance: finalDist,
            selectionA: state.measuringAtomA.label,
            selectionB: atomRef.label,
            measurementToolState: 'measured',
            showMeasurementLine: true,
            measurements: [...state.measurements, canonical],
          };
        }
      }

      return {
        selectedEntity: entity,
        selectionA: entity.formattedLabel,
      };
    }),
  distanceThreshold: 4.0,
  measuredDistance: 0,
  cameraDistance: 60.0,
  aabbMode: 'selection',
  measurementToolState: 'idle',
  measuringAtomA: null,
  measuringAtomB: null,
  measurements: [],
  isInspectingAABB: false,
  hoveredAABB: null,
  cameraProjection: 'perspective',
  inspectionMode: 'normal',
  inspectionRadius: 8.5,
  setCameraProjection: (proj) => set({ cameraProjection: proj }),
  setInspectionMode: (mode) => set({ inspectionMode: mode }),
  setInspectionRadius: (radius) => set({ inspectionRadius: radius }),
  isSelectionContextMode: false,
  toggleSelectionContextMode: () =>
    set((state) => ({ isSelectionContextMode: !state.isSelectionContextMode })),
  capabilities: null,
  setCapabilities: (caps) => set({ capabilities: caps }),
  isExplorerOpen: false,
  activeStructureId: '4HHB',
  activeStructureInput: null,
  activeAssemblyId: null,
  boxExtents: [80, 80, 80],
  recentStructures: [
    getStructureMetadata('4HHB'),
    getStructureMetadata('synth_500f'),
    getStructureMetadata('1BNA'),
    getStructureMetadata('1TUP'),
  ],
  openExplorer: () => set({ isExplorerOpen: true }),
  closeExplorer: () => set({ isExplorerOpen: false }),
  setActiveAssemblyId: (assemblyId: string | null) => set({ activeAssemblyId: assemblyId }),
  setBoxExtents: (extents: [number, number, number]) => set({ boxExtents: extents }),
  selectStructure: (id: string, input?: ResolveStructureInput) =>
    set((state) => {
      const meta = getStructureMetadata(id);
      const filtered = (state.recentStructures || []).filter(
        (s): s is StructureMetadata => Boolean(s && s.id && s.id !== id && s.name)
      );
      const updatedRecents = meta && meta.id && meta.name ? [meta, ...filtered].slice(0, 8) : filtered.slice(0, 8);

      // Cascade dataset invalidation to sibling stores at the correct architectural layer.
      // This is the single canonical invalidation point for the whole scientific pipeline.
      // MonacoQueryEditor already reacts to useScanStore.trajectoryId via its own useEffect.
      try {
        useScanStore.getState().setMetadata({
          trajectoryId: id,
          topologyId: null,
          totalFrames: null,
          atomCount: null,
          metadataStatus: 'idle',
        });
        useEvidenceStore.getState().invalidateExecution();
        useProofStore.getState().resetProof();
        useTimelineStore.getState().resetTimeline();
      } catch {
        // Safe fallback in test environments where stores may not yet be registered
      }

      return {
        activeStructureId: id,
        activeStructureInput: input || { pdbId: id },
        activeAssemblyId: input?.assemblyId || null,
        capabilities: null,
        selectionA: '',
        selectionB: '',
        selectedEntity: null,
        measuredDistance: 0,
        measuringAtomA: null,
        measuringAtomB: null,
        measurementToolState: 'idle',
        showAABB: false,
        showProteinAABB: false,
        showNucleicAABB: false,
        showLigandAABB: false,
        showCalipers: false,
        showMeasurementLine: false,
        measurements: [],
        inspectionMode: 'normal',
        recentStructures: updatedRecents,
        isExplorerOpen: false,
      };
    }),

  setRepresentation: (rep) => set({ representation: rep }),
  toggleAABB: () =>
    set((state) => {
      const next = !state.showAABB;
      return {
        showAABB: next,
        showProteinAABB: next,
        showNucleicAABB: next,
        showLigandAABB: next,
      };
    }),
  toggleCalipers: () =>
    set((state) => {
      const next = !state.showCalipers;
      return {
        showCalipers: next,
        showMeasurementLine: next,
      };
    }),
  toggleProtein: () => set((state) => ({ showProtein: !state.showProtein })),
  toggleNucleic: () => set((state) => ({ showNucleic: !state.showNucleic })),
  toggleLigand: () => set((state) => ({ showLigand: !state.showLigand })),
  toggleWater: () => set((state) => ({ showWater: !state.showWater })),
  toggleIon: () => set((state) => ({ showIon: !state.showIon })),
  toggleProteinAABB: () =>
    set((state) => {
      const next = !state.showProteinAABB;
      return {
        showProteinAABB: next,
        showAABB: next || state.showLigandAABB || state.showNucleicAABB,
      };
    }),
  toggleNucleicAABB: () =>
    set((state) => {
      const next = !state.showNucleicAABB;
      return {
        showNucleicAABB: next,
        showAABB: next || state.showProteinAABB || state.showLigandAABB,
      };
    }),
  toggleLigandAABB: () =>
    set((state) => {
      const next = !state.showLigandAABB;
      return {
        showLigandAABB: next,
        showAABB: next || state.showProteinAABB || state.showNucleicAABB,
      };
    }),
  toggleMeasurementLine: () =>
    set((state) => {
      const next = !state.showMeasurementLine;
      return {
        showMeasurementLine: next,
        showCalipers: next,
      };
    }),
  toggleInspectingAABB: () => set((state) => ({ isInspectingAABB: !state.isInspectingAABB })),
  setInspectingAABB: (val) => set({ isInspectingAABB: val }),
  setHoveredAABB: (val) => set({ hoveredAABB: val }),
  setComponentCounts: (counts) =>
    set((state) => ({
      componentCounts: {
        ...state.componentCounts,
        ...counts,
      },
    })),
  setSelections: (a, b) => set({ selectionA: a, selectionB: b }),
  clearSelections: () => set({ selectedEntity: null, selectionA: '', selectionB: '' }),
  setDistanceThreshold: (val) => set({ distanceThreshold: val }),
  setMeasuredDistance: (val) => set({ measuredDistance: val }),
  setAABBMode: (mode) => set({ aabbMode: mode }),
  startMeasurement: () =>
    set({
      measurementToolState: 'selecting-first-atom',
      measuringAtomA: null,
      measuringAtomB: null,
    }),
  cancelMeasurement: () =>
    set({
      measurementToolState: 'idle',
      measuringAtomA: null,
      measuringAtomB: null,
    }),
  clearMeasurement: () =>
    set({
      measurementToolState: 'idle',
      measuringAtomA: null,
      measuringAtomB: null,
      showMeasurementLine: false,
    }),
  addMeasurement: (m: CanonicalMeasurement) =>
    set((state) => ({ measurements: [...state.measurements, m] })),
  removeMeasurement: (id: string) =>
    set((state) => ({ measurements: state.measurements.filter((m) => m.id !== id) })),
  clearMeasurements: () => set({ measurements: [] }),
  setMeasuringAtom: (atom: AtomRef, isTrajectory = false, customBoxExtents?: [number, number, number]) =>
    set((state) => {
      if (state.measurementToolState === 'selecting-first-atom') {
        return {
          measuringAtomA: atom,
          measurementToolState: 'selecting-second-atom',
        };
      }
      if (state.measurementToolState === 'selecting-second-atom' && state.measuringAtomA) {
        const p1 = state.measuringAtomA.coords;
        const p2 = atom.coords;
        const box = customBoxExtents || state.boxExtents || [80, 80, 80];
        const dist = isTrajectory
          ? calculateMinimumImageDistance(p1, p2, box)
          : calculateEuclideanDistance(p1, p2);

        if (!Number.isFinite(dist)) {
          return {
            measurementToolState: 'idle',
            measuringAtomA: null,
            measuringAtomB: null,
            showMeasurementLine: false,
          };
        }

        const finalDist = Number(dist.toFixed(2));
        const canonical = createDistanceMeasurement(
          {
            label: state.measuringAtomA.label,
            coords: state.measuringAtomA.coords,
            chainId: state.measuringAtomA.chain,
            resSeq: state.measuringAtomA.resSeq,
            resName: state.measuringAtomA.resName,
            atomName: state.measuringAtomA.atomName,
          },
          {
            label: atom.label,
            coords: atom.coords,
            chainId: atom.chain,
            resSeq: atom.resSeq,
            resName: atom.resName,
            atomName: atom.atomName,
          },
          {
            isPbc: isTrajectory,
            boxExtents: box,
          }
        );

        return {
          measuringAtomB: atom,
          measuredDistance: finalDist,
          selectionA: state.measuringAtomA.label,
          selectionB: atom.label,
          measurementToolState: 'measured',
          showMeasurementLine: true,
          measurements: [...state.measurements, canonical],
        };
      }
      return {};
    }),
}));

if (typeof window !== 'undefined') {
  (window as any).useViewerStore = useViewerStore;
}
