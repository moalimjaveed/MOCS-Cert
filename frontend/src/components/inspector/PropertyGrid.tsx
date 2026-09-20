import React from 'react';

export interface PropertyGridProps {
  children: React.ReactNode;
  className?: string;
  testId?: string;
}

export const PropertyGrid: React.FC<PropertyGridProps> = ({
  children,
  className = '',
  testId,
}) => {
  return (
    <div
      data-testid={testId}
      className={`w-full min-w-0 space-y-1 ${className}`}
    >
      {children}
    </div>
  );
};
