import { SourceAtomId } from '@mocs/core';

export const HHB_4_ATOMS = {
  PROXIMAL_HIS_NE2: {
    dataset: '4hhb',
    model: 1,
    entity: 'A',
    chain: 'A',
    seq: 87,
    component: 'HIS',
    atom: 'NE2',
  } as SourceAtomId,

  HEME_FE_A: {
    dataset: '4hhb',
    model: 1,
    entity: 'A',
    chain: 'A',
    seq: 142,
    component: 'HEM',
    atom: 'FE',
  } as SourceAtomId,
};

/**
 * Analytical ground truth distance between A:87:NE2 and HEM:142:FE in 4HHB.pdb
 * Coordinates in 4HHB:
 *   A:87:NE2  -> [ -4.116, 12.183, 4.316 ] (ATOM 671)
 *   HEM:142:FE -> [ -2.253, 13.064, 4.316 ] (HETATM 4558)
 * Calculated distance: sqrt((-4.116 - -2.253)^2 + (12.183 - 13.064)^2 + 0^2)
 *   = sqrt((-1.863)^2 + (-0.881)^2)
 *   = sqrt(3.470769 + 0.776161)
 *   = sqrt(4.246930) = 2.0608 Å
 */
export const HHB_4_REFERENCE_DISTANCE = 2.060808;
