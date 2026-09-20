import React from 'react';
import { clsx } from 'clsx';

export interface MocsScientificValueProps {
  /** The numeric value or pre-formatted string */
  value: number | string;
  /** Physical unit (e.g. 'Å', 'ns', 'MB', 'ms', '%') */
  unit?: string;
  /** Decimal places for numeric values. Default: 2 */
  precision?: number;
  /** Render value in monospace font (machine identifiers, addresses) */
  mono?: boolean;
  /** Font size class. Default: 'text-xs' */
  textSize?: string;
  /** Color class. Default: 'text-[#1C1C1C]' */
  color?: string;
  className?: string;
  testId?: string;
}

/**
 * MocsScientificValue — typed scientific value display.
 *
 * Rules:
 * - tabular-nums font variant for all numeric columns
 * - value and unit rendered in a single non-breaking span
 * - consistent decimal precision per scientific display convention
 * - monospace only for true machine identifiers, never for ordinary numbers
 *
 * Examples:
 *   <MocsScientificValue value={4.21} unit="Å" />       → "4.21 Å"
 *   <MocsScientificValue value={166.7} unit="ns" />     → "166.70 ns"
 *   <MocsScientificValue value="0x5E000" mono />        → "0x5E000"
 */
export const MocsScientificValue: React.FC<MocsScientificValueProps> = ({
  value,
  unit,
  precision = 2,
  mono = false,
  textSize = 'text-xs',
  color = 'text-[#1C1C1C]',
  className = '',
  testId,
}) => {
  const formatted =
    typeof value === 'number'
      ? value.toFixed(precision)
      : value;

  return (
    <span
      data-testid={testId}
      className={clsx(
        'tabular-nums font-variant-numeric',
        textSize,
        color,
        mono && 'font-cascadia',
        className,
      )}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {/* Non-breaking: value + unit stay together */}
      <span style={{ whiteSpace: 'nowrap' }}>
        {formatted}
        {unit && <span className="ml-[0.2em] text-[#5C5C5C]">{unit}</span>}
      </span>
    </span>
  );
};
