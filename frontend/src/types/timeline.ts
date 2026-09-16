/**
 * Timeline block lattice and dyadic refinement types.
 */

export interface SubBlockItem {
  child_id: string;
  parent_id: number;
  frame_start: number;
  frame_end_exclusive: number;
  lower_bound: number;
  upper_bound: number;
  truth_value: string;
  status: string;
}

export interface BlockLatticeItem {
  block_id: number;
  frame_start: number;
  frame_end_exclusive: number;
  time_start_ns: number;
  time_end_ns: number;
  lower_bound: number;
  upper_bound: number;
  truth_value: 'TRUE' | 'FALSE' | 'UNKNOWN' | string;
  status: 'CERTIFIED_TRUE' | 'CERTIFIED_FALSE' | 'REFINED' | 'EXACT' | 'UNKNOWN' | string;
  child_blocks: SubBlockItem[];
  exact_frames: number;
  refined_count: number;
}

export interface BlockRefineResponse {
  parent_block_id: number;
  parent_bounds: { L: number; U: number };
  child_blocks: SubBlockItem[];
  monotonic_non_expansion_verified: boolean;
  summary: string;
}
