import React from 'react';
import { clsx } from 'clsx';

export type MocsButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type MocsButtonSize = 'sm' | 'md';

export interface MocsButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: MocsButtonVariant;
  size?: MocsButtonSize;
  /** Icon rendered before the label */
  icon?: React.ReactNode;
  /** Show loading spinner and disable interaction */
  loading?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<MocsButtonVariant, string> = {
  primary:
    'bg-[#005FB8] text-white border-transparent hover:bg-[#00529F] active:bg-[#00488B] disabled:opacity-50 disabled:cursor-not-allowed',
  secondary:
    'bg-[#FFFFFF] text-[#1C1C1C] border border-[#D1D1D1] hover:bg-[#F8FAFC] active:bg-[#F1F5F9] disabled:opacity-50 disabled:cursor-not-allowed',
  ghost:
    'bg-transparent text-[#1C1C1C] border-transparent hover:bg-[#F3F3F3] active:bg-[#E9EAEB] disabled:opacity-50 disabled:cursor-not-allowed',
  destructive:
    'bg-[#C42B1C] text-white border-transparent hover:bg-[#B01C10] active:bg-[#9A170D] disabled:opacity-50 disabled:cursor-not-allowed',
};

const sizeClasses: Record<MocsButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-8 px-3 text-xs gap-2',
};

/**
 * MocsButton — canonical MOCS-Cert action button.
 *
 * Semantic hierarchy: primary | secondary | ghost | destructive.
 * Radius: 4px (canonical scale). No pill shape.
 * Typography: Segoe UI Variable (inherits from body).
 */
export const MocsButton: React.FC<MocsButtonProps> = ({
  variant = 'secondary',
  size = 'sm',
  icon,
  loading = false,
  className = '',
  children,
  disabled,
  type = 'button',
  ...props
}) => {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex items-center justify-center font-semibold rounded-[4px] border tracking-wide transition-colors duration-100 cursor-pointer shrink-0 select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005FB8]',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span
          className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0"
          aria-hidden="true"
        />
      ) : (
        icon && <span className="shrink-0 flex items-center">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
};
