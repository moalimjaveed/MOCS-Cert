/**
 * Zustand slice managing trajectory metadata and hardware status.
 */

import { create } from 'zustand';

export interface ScanState {
  trajectoryId: string | null;
  topologyId: string | null;
  totalFrames: number | null;
  timeSpanNs: number | null;
  timestepPs: number | null;
  atomCount: number | null;
  pbcMode: string;
  metadataStatus: 'idle' | 'loading' | 'ready' | 'error';
  cellType?: 'orthorhombic' | 'triclinic';
  cellModel?: string;
  cellAngles?: [number, number, number];
  cellLengths?: [number, number, number];
  cellVectors?: number[][];
  samplingSemantics: string;
  boundingModel: 'AABB' | 'KDOP14';
  mciStatus: string;
  arrayBackend: string;
  activeAccelerator: string;
  isLoading: boolean;
  setMetadata: (data: Partial<ScanState>) => void;
  setLoading: (loading: boolean) => void;
  setBoundingModel: (model: 'AABB' | 'KDOP14') => void;
}

export const useScanStore = create<ScanState>((set) => ({
  trajectoryId: null,
  topologyId: null,
  totalFrames: null,
  timeSpanNs: null,
  timestepPs: null,
  atomCount: null,
  pbcMode: 'auto',
  metadataStatus: 'idle',
  samplingSemantics: 'sampled_frames',
  boundingModel: 'AABB',
  mciStatus: 'PENDING',
  arrayBackend: 'numpy',
  activeAccelerator: 'CPU',
  isLoading: false,
  setMetadata: (data) => set((state) => ({ ...state, ...data })),
  setLoading: (loading) => set({ isLoading: loading }),
  setBoundingModel: (model) => set({ boundingModel: model }),
}));
