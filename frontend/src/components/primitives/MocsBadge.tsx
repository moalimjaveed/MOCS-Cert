import React from 'react';
import { Check, X, AlertTriangle, HelpCircle } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * Epistemic truth variants aligned to MOCS-Cert RULE.md color system:
 *   TRUE / success  → Cobalt #0969DA
 *   FALSE / error   → Rose   #C42B1C
 *   UNKNOWN /warning→ Amber  #B45309
 *   UNRESOLVABLE/speculative → Violet #6D28D9
 *   primary         → MOCS Blue #005FB8
 *   neutral         → Slate  #5C5C5C
 */
export type MocsBadgeVariant =
  | 'true'
  | 'false'
  | 'unknown'
  | 'unresolvable'
  | 'success'
  | 'error'
  | 'warning'
  | 'primary'
  | 'neutral';

export type MocsBadgeSize = 'sm' | 'md';

export interface MocsBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: MocsBadgeVariant;
  size?: MocsBadgeSize;
  /** Override the auto-resolved icon */
  icon?: React.ReactNode;
  /** Show in tabular-nums monospace style */
  mono?: boolean;
  children: React.ReactNode;
  testId?: string;
}

type VariantConfig = {
  bg: string;
  DefaultIcon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }> | null;
};

const variantConfig: Record<MocsBadgeVariant, VariantConfig> = {
  true:          { bg: 'bg-[#0969DA] border-transparent', DefaultIcon: Check },
  success:       { bg: 'bg-[#0969DA] border-transparent', DefaultIcon: Check },
  false:         { bg: 'bg-[#C42B1C] border-transparent', DefaultIcon: X },
  error:         { bg: 'bg-[#C42B1C] border-transparent', DefaultIcon: X },
  unknown:       { bg: 'bg-[#B45309] border-transparent', DefaultIcon: AlertTriangle },
  warning:       { bg: 'bg-[#B45309] border-transparent', DefaultIcon: AlertTriangle },
  unresolvable:  { bg: 'bg-[#6D28D9] border-transparent', DefaultIcon: HelpCircle },
  primary:       { bg: 'bg-[#005FB8] border-transparent', DefaultIcon: null },
  neutral:       { bg: 'bg-[#5C5C5C] border-transparent', DefaultIcon: null },
};

const sizeClasses: Record<MocsBadgeSize, string> = {
  sm: 'h-[22px] px-2 text-[11px] gap-1.5',
  md: 'h-[26px] px-2.5 text-xs gap-1.5',
};

/**
 * MocsBadge — single canonical badge component.
 *
 * Replaces StatusBadge, EpistemicBadge, VerificationBadge, and all
 * inline badge <span> elements throughout the application.
 *
 * Rules:
 * - Solid fill + white text. NO pale tints.
 * - Radius: rounded-[4px] (canonical scale)
 * - Use only for state, classification, or compact categorical metadata.
 * - Do NOT use for labels, descriptions, or decorative text.
 */
export const MocsBadge: React.FC<MocsBadgeProps> = ({
  variant = 'neutral',
  size = 'sm',
  icon,
  mono = false,
  children,
  testId,
  className = '',
  ...props
}) => {
  const { bg, DefaultIcon } = variantConfig[variant];
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  const resolvedIcon = icon !== undefined
    ? icon
    : DefaultIcon
    ? <DefaultIcon className={`${iconSize} stroke-[2.5] text-white shrink-0`} aria-hidden />
    : null;

  return (
    <span
      data-testid={testId}
      className={clsx(
        'inline-flex items-center rounded-[4px] border font-semibold leading-none shrink-0 select-none text-white',
        bg,
        sizeClasses[size],
        mono && 'tabular-nums',
        className,
      )}
      {...props}
    >
      {resolvedIcon && (
        <span className="shrink-0 flex items-center justify-center">{resolvedIcon}</span>
      )}
      <span>{children}</span>
    </span>
  );
};

/**
 * Derive MocsBadge variant from a MOCS truth-value string.
 * Handles: "TRUE", "FALSE", "UNKNOWN", "UNRESOLVABLE", "CERTIFIED TRUE", etc.
 */
export function truthValueToVariant(truth: string): MocsBadgeVariant {
  const u = truth.toUpperCase();
  if (u.includes('TRUE')) return 'true';
  if (u.includes('FALSE')) return 'false';
  if (u.includes('UNRESOLVABLE') || u.includes('UNSUPPORTED')) return 'unresolvable';
  if (u.includes('UNKNOWN')) return 'unknown';
  if (u.includes('SOUND') || u.includes('EXACT') || u.includes('COMPLETE')) return 'success';
  return 'neutral';
}
