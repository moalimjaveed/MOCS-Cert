/**
 * Canonical Epistemic Status Presentation Layer for MOCS-Cert.
 * 
 * Enforces the Status Provenance Invariant:
 * Every UI status indicator must be derived from canonical state,
 * never from hardcoded labels or arbitrary decorative styling.
 * 
 * Epistemic Color Tokens:
 * - TRUE: Cobalt (#005FB8)
 * - FALSE: Rose (#D13438)
 * - UNKNOWN: Amber (#B8860B)
 * - UNRESOLVABLE: Violet (#7B1FA2)
 * - VERIFIED / SOUND / BIT-EXACT: Blue (#0969DA / #005FB8)
 * - NEUTRAL / NOT_MEASURED / AWAITING: Slate / Gray (#64748B / #8A8A8A)
 * - ERROR / FAILED / UNSUPPORTED: Crimson (#C42B1C)
 */

export type CanonicalEpistemicState =
  | 'TRUE'
  | 'FALSE'
  | 'UNKNOWN'
  | 'UNRESOLVABLE'
  | 'VERIFIED'
  | 'CERTIFIED'
  | 'BIT-EXACT'
  | 'SOUND'
  | 'GUARDED_SOUND'
  | 'MEASURED'
  | 'NOT_MEASURED'
  | 'STALE'
  | 'UNSUPPORTED'
  | 'FAILED'
  | 'NO_EXECUTION'
  | 'PENDING';

export interface EpistemicPresentation {
  state: CanonicalEpistemicState;
  label: string;
  badgeVariant: 'primary' | 'success' | 'warning' | 'error' | 'neutral' | 'true' | 'false' | 'unknown';
  textColor: string;
  bgColor: string;
  borderColor: string;
  iconName: 'check' | 'x' | 'alert-triangle' | 'help-circle' | 'clock' | 'minus' | 'shield-check';
  description: string;
  isTerminalProof: boolean;
  requiresExecution: boolean;
}

export const EPISTEMIC_REGISTRY: Record<CanonicalEpistemicState, EpistemicPresentation> = {
  TRUE: {
    state: 'TRUE',
    label: 'CERTIFIED TRUE',
    badgeVariant: 'true',
    textColor: 'text-[#005FB8]',
    bgColor: 'bg-[#EBF3FC]',
    borderColor: 'border-[#005FB8]',
    iconName: 'check',
    description: 'Interval upper bound strictly satisfies predicate under conservative AABB geometry.',
    isTerminalProof: true,
    requiresExecution: true,
  },
  FALSE: {
    state: 'FALSE',
    label: 'CERTIFIED FALSE',
    badgeVariant: 'false',
    textColor: 'text-[#D13438]',
    bgColor: 'bg-[#FDF3F3]',
    borderColor: 'border-[#D13438]',
    iconName: 'x',
    description: 'Interval lower bound strictly falsifies predicate under conservative AABB geometry.',
    isTerminalProof: true,
    requiresExecution: true,
  },
  UNKNOWN: {
    state: 'UNKNOWN',
    label: 'UNKNOWN (Straddles)',
    badgeVariant: 'unknown',
    textColor: 'text-[#B8860B]',
    bgColor: 'bg-[#FFFBEB]',
    borderColor: 'border-[#B8860B]',
    iconName: 'alert-triangle',
    description: 'Conservative interval straddles predicate threshold, requiring dyadic refinement.',
    isTerminalProof: false,
    requiresExecution: true,
  },
  UNRESOLVABLE: {
    state: 'UNRESOLVABLE',
    label: 'UNRESOLVABLE',
    badgeVariant: 'neutral',
    textColor: 'text-[#7B1FA2]',
    bgColor: 'bg-[#F9F5FB]',
    borderColor: 'border-[#7B1FA2]',
    iconName: 'help-circle',
    description: 'Trajectory data or coordinate resolution insufficient to resolve truth value.',
    isTerminalProof: true,
    requiresExecution: true,
  },
  VERIFIED: {
    state: 'VERIFIED',
    label: 'VERIFIED',
    badgeVariant: 'success',
    textColor: 'text-[#0969DA]',
    bgColor: 'bg-[#DDF4FF]',
    borderColor: 'border-[#0969DA]',
    iconName: 'shield-check',
    description: 'Cryptographic commitment and mathematical soundness verified.',
    isTerminalProof: true,
    requiresExecution: true,
  },
  CERTIFIED: {
    state: 'CERTIFIED',
    label: 'CERTIFIED',
    badgeVariant: 'primary',
    textColor: 'text-[#005FB8]',
    bgColor: 'bg-[#EBF3FC]',
    borderColor: 'border-[#005FB8]',
    iconName: 'shield-check',
    description: 'Deterministic machine certificate produced and committed.',
    isTerminalProof: true,
    requiresExecution: true,
  },
  'BIT-EXACT': {
    state: 'BIT-EXACT',
    label: 'BIT-EXACT',
    badgeVariant: 'success',
    textColor: 'text-[#0969DA]',
    bgColor: 'bg-[#DDF4FF]',
    borderColor: 'border-[#0969DA]',
    iconName: 'check',
    description: 'Output exactly matches floating-point oracle with zero delta.',
    isTerminalProof: true,
    requiresExecution: true,
  },
  SOUND: {
    state: 'SOUND',
    label: 'SOUND',
    badgeVariant: 'primary',
    textColor: 'text-[#005FB8]',
    bgColor: 'bg-[#EBF3FC]',
    borderColor: 'border-[#005FB8]',
    iconName: 'shield-check',
    description: 'Sound deduction under Kleene 3-valued interval logic.',
    isTerminalProof: true,
    requiresExecution: true,
  },
  GUARDED_SOUND: {
    state: 'GUARDED_SOUND',
    label: 'GUARDED SOUND',
    badgeVariant: 'primary',
    textColor: 'text-[#005FB8]',
    bgColor: 'bg-[#EBF3FC]',
    borderColor: 'border-[#005FB8]',
    iconName: 'shield-check',
    description: 'Soundness guaranteed under periodic boundary minimum image conditions.',
    isTerminalProof: true,
    requiresExecution: true,
  },
  MEASURED: {
    state: 'MEASURED',
    label: 'MEASURED',
    badgeVariant: 'primary',
    textColor: 'text-[#1C1C1C]',
    bgColor: 'bg-[#F3F4F6]',
    borderColor: 'border-[#D1D5DB]',
    iconName: 'check',
    description: 'Empirical measurement obtained from live benchmark execution.',
    isTerminalProof: false,
    requiresExecution: true,
  },
  NOT_MEASURED: {
    state: 'NOT_MEASURED',
    label: 'NOT MEASURED',
    badgeVariant: 'neutral',
    textColor: 'text-[#8A8A8A]',
    bgColor: 'bg-[#FAFAFA]',
    borderColor: 'border-[#E5E5E5]',
    iconName: 'minus',
    description: 'Benchmark metric not executed or baseline comparison absent.',
    isTerminalProof: false,
    requiresExecution: false,
  },
  STALE: {
    state: 'STALE',
    label: 'STALE / INVALIDATED',
    badgeVariant: 'warning',
    textColor: 'text-[#B45309]',
    bgColor: 'bg-[#FFFBEB]',
    borderColor: 'border-[#B45309]',
    iconName: 'clock',
    description: 'Input query or dataset was modified after this state was generated.',
    isTerminalProof: false,
    requiresExecution: false,
  },
  UNSUPPORTED: {
    state: 'UNSUPPORTED',
    label: 'UNSUPPORTED GEOMETRY',
    badgeVariant: 'error',
    textColor: 'text-[#C42B1C]',
    bgColor: 'bg-[#FFF4F2]',
    borderColor: 'border-[#F1A299]',
    iconName: 'alert-triangle',
    description: 'Requested geometry, cell box, or sampling convention is outside certified operational scope.',
    isTerminalProof: true,
    requiresExecution: true,
  },
  FAILED: {
    state: 'FAILED',
    label: 'EXECUTION FAILED',
    badgeVariant: 'error',
    textColor: 'text-[#C42B1C]',
    bgColor: 'bg-[#FFF4F2]',
    borderColor: 'border-[#F1A299]',
    iconName: 'x',
    description: 'Query execution encountered a fatal error during compilation or scanning.',
    isTerminalProof: true,
    requiresExecution: true,
  },
  NO_EXECUTION: {
    state: 'NO_EXECUTION',
    label: 'AWAITING EXECUTION',
    badgeVariant: 'neutral',
    textColor: 'text-[#5C5C5C]',
    bgColor: 'bg-[#F3F3F3]',
    borderColor: 'border-[#E5E5E5]',
    iconName: 'minus',
    description: 'No query execution has been performed for the current dataset and query.',
    isTerminalProof: false,
    requiresExecution: false,
  },
  PENDING: {
    state: 'PENDING',
    label: 'EXECUTING...',
    badgeVariant: 'neutral',
    textColor: 'text-[#005FB8]',
    bgColor: 'bg-[#EBF3FC]',
    borderColor: 'border-[#005FB8]',
    iconName: 'clock',
    description: 'Query compilation or scanning is currently running in the backend.',
    isTerminalProof: false,
    requiresExecution: true,
  },
};

/**
 * Maps any raw status string and execution identity context to a canonical epistemic presentation.
 */
export function resolveEpistemicStatus(
  rawStatus: string | null | undefined,
  context?: {
    executionId?: string | null;
    isExecuting?: boolean;
    hasError?: boolean;
    isStale?: boolean;
  }
): EpistemicPresentation {
  if (context?.isExecuting) {
    return EPISTEMIC_REGISTRY.PENDING;
  }

  if (context?.isStale) {
    return EPISTEMIC_REGISTRY.STALE;
  }

  if (context?.hasError) {
    return EPISTEMIC_REGISTRY.FAILED;
  }

  // If no execution ID exists and status is not explicitly set by an oracle test, return NO_EXECUTION
  if (!context?.executionId && (!rawStatus || rawStatus === 'NO_EXECUTION' || rawStatus === 'NOT_RUN')) {
    return EPISTEMIC_REGISTRY.NO_EXECUTION;
  }

  const clean = (rawStatus || '').toUpperCase().trim();

  if (clean.includes('NOT_MEASURED') || clean === 'NOT MEASURED') return EPISTEMIC_REGISTRY.NOT_MEASURED;
  if (clean.includes('UNSUPPORTED')) return EPISTEMIC_REGISTRY.UNSUPPORTED;
  if (clean.includes('ERROR') || clean.includes('FAILED')) return EPISTEMIC_REGISTRY.FAILED;
  if (clean.includes('UNKNOWN') || clean.includes('STRADDLE')) return EPISTEMIC_REGISTRY.UNKNOWN;
  if (clean.includes('UNRESOLVABLE')) return EPISTEMIC_REGISTRY.UNRESOLVABLE;
  if (clean.includes('TRUE')) return EPISTEMIC_REGISTRY.TRUE;
  if (clean.includes('FALSE')) return EPISTEMIC_REGISTRY.FALSE;
  if (clean.includes('BIT-EXACT') || clean.includes('BIT_EXACT')) return EPISTEMIC_REGISTRY['BIT-EXACT'];
  if (clean.includes('GUARDED')) return EPISTEMIC_REGISTRY.GUARDED_SOUND;
  if (clean.includes('SOUND')) return EPISTEMIC_REGISTRY.SOUND;
  if (clean.includes('VERIFIED')) return EPISTEMIC_REGISTRY.VERIFIED;
  if (clean.includes('CERTIFIED')) return EPISTEMIC_REGISTRY.CERTIFIED;
  if (clean.includes('MEASURED')) return EPISTEMIC_REGISTRY.MEASURED;

  if (!context?.executionId) {
    return EPISTEMIC_REGISTRY.NO_EXECUTION;
  }

  return {
    ...EPISTEMIC_REGISTRY.NO_EXECUTION,
    label: clean || 'UNKNOWN',
  };
}
