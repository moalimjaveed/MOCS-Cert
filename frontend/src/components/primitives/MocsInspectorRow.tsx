import React from 'react';
import { clsx } from 'clsx';

export type MocsInspectorRowHighlight = 'default' | 'blue' | 'amber';

export interface MocsInspectorRowProps {
  label: string;
  value: React.ReactNode;
  /** Optional tooltip title on the value element */
  title?: string;
  /** Render value in monospace (for machine identifiers, hashes) */
  mono?: boolean;
  /** Semantic color on the value */
  highlight?: MocsInspectorRowHighlight;
  /** Reduce font weight and color for secondary rows */
  secondary?: boolean;
  testId?: string;
  className?: string;
}

const highlightClasses: Record<MocsInspectorRowHighlight, string> = {
  default: '',
  blue: 'text-[#0969DA]',
  amber: 'text-[#9D5D00]',
};

/**
 * MocsInspectorRow — canonical inspector property row.
 *
 * Two-column baseline-aligned layout:
 *   [label (muted, left)]  [value (right-aligned)]
 *
 * Consolidates PropertyRow. Adds mono flag for machine identifiers.
 * Used in RightInspector, EvidenceSection, and any dense key-value display.
 */
export const MocsInspectorRow: React.FC<MocsInspectorRowProps> = ({
  label,
  value,
  title,
  mono = false,
  highlight = 'default',
  secondary = false,
  testId,
  className = '',
}) => {
  return (
    <div
      data-testid={testId}
      data-inspector-row="true"
      className={clsx(
        'flex items-baseline justify-between gap-3 py-1 min-w-0 w-full text-[12px] sm:text-[13px] leading-normal',
        className,
      )}
    >
      <span className="text-[#5C5C5C] select-text shrink-0">{label}</span>
      <span
        title={title}
        className={clsx(
          'text-right font-medium min-w-0 break-words [overflow-wrap:anywhere]',
          secondary ? 'text-[#333333]' : 'text-[#1C1C1C]',
          highlightClasses[highlight],
          mono && 'font-cascadia tabular-nums',
        )}
      >
        {value}
      </span>
    </div>
  );
};
