import React from 'react';
import { ChevronDown } from 'lucide-react';
import { PropertyGrid } from './PropertyGrid';
import { PropertyRow } from './PropertyRow';

export interface QueryContractSectionProps {
  quantifier?: string;
  operator?: string;
  semantics?: string;
  pbc?: string;
  boundingModel?: string;
  cellModel?: string;
  cellAngles?: [number, number, number];
  precision?: string;
  isOpen?: boolean;
  onToggle?: () => void;
}

export const QueryContractSection: React.FC<QueryContractSectionProps> = ({
  quantifier = 'EXISTS',
  operator = 'DISTANCE-v1',
  semantics = 'sampled_frames',
  pbc = 'orthorhombic_minimum_image',
  boundingModel = 'AABB',
  cellModel,
  cellAngles,
  precision = 'float64',
  isOpen = true,
  onToggle,
}) => {
  return (
    <div data-testid="section-query-contract">
      <div
        role={onToggle ? "button" : undefined}
        tabIndex={onToggle ? 0 : undefined}
        onClick={onToggle}
        className={`text-[11px] font-semibold text-[#5C5C5C] uppercase tracking-wider mb-2 select-text flex items-center justify-between ${onToggle ? 'cursor-pointer hover:text-[#1C1C1C]' : ''}`}
      >
        <span>Query Contract</span>
        {onToggle && (
          <ChevronDown
            className={`w-3.5 h-3.5 text-[#8A8A8A] transition-transform duration-150 ${
              isOpen ? '' : '-rotate-90'
            }`}
            aria-hidden="true"
          />
        )}
      </div>
      <div className={isOpen ? '' : 'hidden'}>
      <PropertyGrid testId="query-contract-grid">
        <PropertyRow
          label="Quantifier"
          value={quantifier}
          testId="contract-quantifier"
        />
        <PropertyRow
          label="Operator"
          value={operator}
          testId="contract-operator"
        />
        <PropertyRow
          label="Semantics"
          value={semantics}
          testId="contract-semantics"
        />
        <PropertyRow
          label="PBC"
          value={pbc}
          title={pbc}
          testId="contract-pbc"
        />
        <PropertyRow
          label="Bounding"
          value={boundingModel}
          title={boundingModel}
          testId="contract-bounding-model"
        />
        {cellModel && (
          <PropertyRow
            label="Geometry"
            value={cellAngles ? `${cellModel} [${cellAngles.map(a => Math.round(a) + '°').join(', ')}]` : cellModel}
            title={cellModel}
            testId="contract-cell-model"
          />
        )}
        <PropertyRow
          label="Precision"
          value={precision}
          testId="contract-precision"
        />
      </PropertyGrid>
      </div>
    </div>
  );
};
