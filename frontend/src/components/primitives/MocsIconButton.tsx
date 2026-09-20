import React from 'react';
import { clsx } from 'clsx';
import type { MocsButtonVariant, MocsButtonSize } from './MocsButton';

const variantClasses: Record<MocsButtonVariant, string> = {
  primary:
    'bg-[#005FB8] text-white border-transparent hover:bg-[#00529F] active:bg-[#00488B] disabled:opacity-50 disabled:cursor-not-allowed',
  secondary:
    'bg-[#FFFFFF] text-[#1C1C1C] border border-[#D1D1D1] hover:bg-[#F8FAFC] active:bg-[#F1F5F9] disabled:opacity-50 disabled:cursor-not-allowed',
  ghost:
    'bg-transparent text-[#5C5C5C] border-transparent hover:bg-[#F3F3F3] active:bg-[#E9EAEB] hover:text-[#1C1C1C] disabled:opacity-50 disabled:cursor-not-allowed',
  destructive:
    'bg-[#C42B1C] text-white border-transparent hover:bg-[#B01C10] active:bg-[#9A170D] disabled:opacity-50 disabled:cursor-not-allowed',
};

const sizeClasses: Record<MocsButtonSize, string> = {
  sm: 'w-7 h-7',
  md: 'w-8 h-8',
};

export interface MocsIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** ARIA label is required for icon-only buttons */
  'aria-label': string;
  variant?: MocsButtonVariant;
  size?: MocsButtonSize;
  icon: React.ReactNode;
  /** Show loading spinner */
  loading?: boolean;
}

/**
 * MocsIconButton — canonical square icon-only button.
 *
 * aria-label is required (enforced by TypeScript).
 * Same variant scale as MocsButton.
 */
export const MocsIconButton: React.FC<MocsIconButtonProps> = ({
  'aria-label': ariaLabel,
  variant = 'ghost',
  size = 'sm',
  icon,
  loading = false,
  className = '',
  disabled,
  type = 'button',
  ...props
}) => {
  return (
    <button
      type={type}
      aria-label={ariaLabel}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex items-center justify-center rounded-[4px] border transition-colors duration-100 cursor-pointer shrink-0 select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005FB8]',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span
          className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
      ) : (
        <span className="flex items-center justify-center" aria-hidden="true">
          {icon}
        </span>
      )}
    </button>
  );
};
