import React from 'react';
import { clsx } from 'clsx';

export interface MocsSectionProps {
  /** Section header icon (Lucide component, pre-sized) */
  icon?: React.ReactNode;
  /** Section title text — displayed uppercase with letter-spacing */
  title: string;
  /** Optional secondary descriptor shown after a separator */
  subtitle?: string;
  /** Action buttons rendered in the right slot of the header */
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Padding for content area. Default: 'p-3.5' */
  contentPadding?: string;
  testId?: string;
}

/**
 * MocsSection — canonical MOCS-Cert single-surface section container.
 *
 * Replaces SurfaceCard. Key differences:
 * - Flat content rendering — NO nested border card inside.
 * - Header is a thin strip (h-9), not a padded box.
 * - Content area owns its own spacing.
 * - No shadow. No glassmorphism.
 *
 * Do NOT nest MocsSection inside another MocsSection or inside any
 * bordered container — that creates a card-in-card violation.
 */
export const MocsSection: React.FC<MocsSectionProps> = ({
  icon,
  title,
  subtitle,
  actions,
  children,
  className = '',
  contentPadding = 'p-3.5',
  testId,
}) => {
  return (
    <div
      data-testid={testId}
      className={clsx(
        'bg-[#FFFFFF] rounded-[6px] border border-[#E5E5E5] flex flex-col overflow-hidden',
        className,
      )}
    >
      {/* Section Header Strip */}
      <div className="h-9 px-3.5 border-b border-[#F1F5F9] bg-[#FAFAFA] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <span className="shrink-0 flex items-center text-[#005FB8]" aria-hidden="true">
              {icon}
            </span>
          )}
          <span className="font-semibold text-xs text-[#1C1C1C] uppercase tracking-wider truncate">
            {title}
          </span>
          {subtitle && (
            <>
              <span className="text-[#CBD5E1] select-none" aria-hidden="true">·</span>
              <span className="text-[11px] text-[#5C5C5C] truncate">{subtitle}</span>
            </>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>

      {/* Content Area */}
      <div className={clsx('flex-1 overflow-auto min-h-0', contentPadding)}>
        {children}
      </div>
    </div>
  );
};
