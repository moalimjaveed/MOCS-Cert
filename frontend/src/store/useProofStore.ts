/**
 * Zustand slice managing Machine Proof Mode interactive deduction state.
 */

import { create } from 'zustand';

export interface AABBCoordinates {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
  radius: number;
}

export interface ProofState {
  focusedBlockId: number | null;
  timeRangeNs: [number, number];
  lowerBound: number;
  upperBound: number;
  threshold: number;
  condition: string;
  status: string;
  explanation: string;
  boxA: AABBCoordinates;
  boxB: AABBCoordinates;
  executionId: string | null;
  setFocusedBlock: (
    blockId: number,
    timeRange: [number, number],
    lower: number,
    upper: number,
    status: string,
    threshold?: number,
    executionId?: string | null,
    boxA?: AABBCoordinates,
    boxB?: AABBCoordinates
  ) => void;
  resetProof: () => void;
}

const EMPTY_COORDS: AABBCoordinates = {
  min: [0, 0, 0],
  max: [0, 0, 0],
  center: [0, 0, 0],
  radius: 0,
};

const CANONICAL_BOX_A_41: AABBCoordinates = {
  min: [14.2, 28.5, 12.1],
  max: [17.8, 32.1, 15.7],
  center: [16.0, 30.3, 13.9],
  radius: 2.1,
};

const CANONICAL_BOX_B_41: AABBCoordinates = {
  min: [18.5, 31.0, 15.0],
  max: [22.0, 34.5, 18.6],
  center: [20.25, 32.75, 16.8],
  radius: 1.9,
};

export const useProofStore = create<ProofState>((set) => ({
  focusedBlockId: 41,
  timeRangeNs: [410.0, 420.0],
  lowerBound: 3.72,
  upperBound: 4.21,
  threshold: 4.0,
  condition: 'distance < 4.0 Å',
  status: 'UNKNOWN (Straddles Threshold)',
  explanation:
    'Lower bound 3.72 Å < 4.0 Å and Upper bound 4.21 Å ≥ 4.0 Å. Conservative bounds straddle the threshold, requiring dyadic refinement to resolve truth value.',
  boxA: CANONICAL_BOX_A_41,
  boxB: CANONICAL_BOX_B_41,
  executionId: null,

  setFocusedBlock: (blockId, timeRange, lower, upper, status, threshold = 4.0, executionId = null, boxA, boxB) =>
    set({
      focusedBlockId: blockId,
      timeRangeNs: timeRange,
      lowerBound: lower,
      upperBound: upper,
      threshold,
      executionId,
      boxA: boxA ?? (blockId === 41 ? CANONICAL_BOX_A_41 : {
        min: [10.0, 20.0, 10.0],
        max: [15.0, 25.0, 15.0],
        center: [12.5, 22.5, 12.5],
        radius: 3.5,
      }),
      boxB: boxB ?? (blockId === 41 ? CANONICAL_BOX_B_41 : {
        min: [16.0, 26.0, 16.0],
        max: [21.0, 31.0, 21.0],
        center: [18.5, 28.5, 18.5],
        radius: 3.5,
      }),
      condition: `distance < ${threshold.toFixed(1)} Å`,
      status:
        lower < threshold && upper >= threshold
          ? 'UNKNOWN (Straddles Threshold)'
          : upper < threshold
          ? 'CERTIFIED TRUE'
          : 'CERTIFIED FALSE',
      explanation:
        lower < threshold && upper >= threshold
          ? `Lower bound ${lower.toFixed(2)} Å < ${threshold.toFixed(1)} Å and Upper bound ${upper.toFixed(2)} Å ≥ ${threshold.toFixed(1)} Å. Conservative bounds straddle the threshold, requiring dyadic refinement.`
          : upper < threshold
          ? `Upper bound ${upper.toFixed(2)} Å < ${threshold.toFixed(1)} Å strictly satisfies predicate. Certified True.`
          : `Lower bound ${lower.toFixed(2)} Å ≥ ${threshold.toFixed(1)} Å strictly falsifies predicate. Certified False.`,
    }),

  resetProof: () =>
    set({
      focusedBlockId: null,
      timeRangeNs: [0, 0],
      lowerBound: 0,
      upperBound: 0,
      threshold: 0,
      condition: '',
      status: 'NO_EXECUTION',
      explanation: 'No candidate block currently under proof inspection.',
      boxA: EMPTY_COORDS,
      boxB: EMPTY_COORDS,
      executionId: null,
    }),
}));
