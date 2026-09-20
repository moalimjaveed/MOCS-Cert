import React from 'react';

export interface PropertyRowProps {
  label: string;
  value: React.ReactNode;
  title?: string;
  secondary?: boolean;
  highlight?: 'default' | 'amber' | 'blue' | 'emerald' | 'cobalt';
  testId?: string;
  className?: string;
}

export const PropertyRow: React.FC<PropertyRowProps> = ({
  label,
  value,
  title,
  secondary = false,
  highlight = 'default',
  testId,
  className = '',
}) => {
  const getHighlightColor = () => {
    switch (highlight) {
      case 'amber':
        return 'text-[#9D5D00]';
      case 'blue':
      case 'cobalt':
      case 'emerald':
        return 'text-[#0969DA]';
      default:
        return secondary ? 'text-[#333333]' : 'text-[#1C1C1C]';
    }
  };

  return (
    <div
      data-testid={testId}
      data-property-row="true"
      className={`flex items-baseline justify-between gap-3 py-1 min-w-0 w-full text-[12px] sm:text-[13px] leading-normal font-sans ${className}`}
    >
      <span className="text-[#5C5C5C] select-text shrink-0">
        {label}
      </span>
      <span
        title={title}
        className={`text-right font-medium min-w-0 break-words [overflow-wrap:anywhere] ${getHighlightColor()}`}
      >
        {value}
      </span>
    </div>
  );
};
