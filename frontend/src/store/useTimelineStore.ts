/**
 * Zustand slice managing the timeline lattice and dyadic zoom.
 */

import { create } from 'zustand';
import type { BlockLatticeItem, SubBlockItem } from '../types/timeline';

export interface TimelineState {
  blocks: BlockLatticeItem[];
  selectedBlockId: number | null;
  activeSubBlocks: SubBlockItem[];
  isRefining: boolean;
  cursorTimeNs: number;
  isPlaying: boolean;
  setBlocks: (blocks: BlockLatticeItem[]) => void;
  selectBlock: (blockId: number | null) => void;
  setSubBlocks: (subBlocks: SubBlockItem[]) => void;
  clearSubBlocks: () => void;
  setRefining: (val: boolean) => void;
  setCursorTimeNs: (time: number) => void;
  togglePlay: () => void;
  resetTimeline: () => void;
}

export const useTimelineStore = create<TimelineState>((set) => ({
  blocks: [],
  selectedBlockId: null,
  activeSubBlocks: [],
  isRefining: false,
  cursorTimeNs: 0.0,
  isPlaying: false,
  setBlocks: (blocks) => set({ blocks }),
  selectBlock: (blockId) => set({ selectedBlockId: blockId }),
  setSubBlocks: (subBlocks) => set({ activeSubBlocks: subBlocks }),
  clearSubBlocks: () => set({ activeSubBlocks: [] }),
  setRefining: (val) => set({ isRefining: val }),
  setCursorTimeNs: (time) => set({ cursorTimeNs: time }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  resetTimeline: () => set({
    selectedBlockId: null,
    activeSubBlocks: [],
    isRefining: false,
    cursorTimeNs: 0,
    isPlaying: false,
  }),
}));
