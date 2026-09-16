/**
 * Epistemic Truth Types according to RULE.md §03.
 * Strictly binds colors and logical values:
 * TRUE -> Deep Cobalt (#0969DA)
 * FALSE -> Rose (#F43F5E)
 * UNKNOWN -> Amber (#F59E0B)
 * UNRESOLVABLE -> Violet (#8B5CF6)
 */

export type TruthValue = 'TRUE' | 'FALSE' | 'UNKNOWN' | 'UNRESOLVABLE';

export type BlockStatus = 
  | 'CERTIFIED_TRUE'
  | 'CERTIFIED_FALSE'
  | 'REFINED'
  | 'EXACT'
  | 'UNKNOWN';

export type ResolutionStatus = 
  | 'COMPLETE'
  | 'NEEDS_REFINEMENT'
  | 'UNSUPPORTED_SEMANTICS'
  | 'FAILED';

export const EPISTEMIC_COLORS = {
  TRUE: '#0969DA',
  FALSE: '#F43F5E',
  UNKNOWN: '#F59E0B',
  UNRESOLVABLE: '#8B5CF6',
  AABB_A: '#38BDF8',
  AABB_B: '#FB923C',
} as const;

export function getEpistemicColor(truth: TruthValue | string): string {
  switch (truth) {
    case 'TRUE':
    case 'CERTIFIED_TRUE':
      return EPISTEMIC_COLORS.TRUE;
    case 'FALSE':
    case 'CERTIFIED_FALSE':
      return '#334155'; // Darker slate for False blocks in timeline lattice
    case 'UNKNOWN':
    case 'REFINED':
      return EPISTEMIC_COLORS.UNKNOWN;
    case 'EXACT':
      return '#38BDF8';
    case 'UNRESOLVABLE':
      return EPISTEMIC_COLORS.UNRESOLVABLE;
    default:
      return '#64748B';
  }
}
