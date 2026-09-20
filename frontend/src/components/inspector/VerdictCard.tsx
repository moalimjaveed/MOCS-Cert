import React from 'react';
import {
  Check,
  AlertTriangle,
  X,
  AlertCircle,
  Minus,
} from 'lucide-react';

import { useRendererStore } from '../../store';

export interface VerdictCardProps {
  truthValue: string;
  resolutionStatus?: string;
  testId?: string;
}

export const VerdictCard: React.FC<VerdictCardProps> = ({
  truthValue,
  resolutionStatus = 'COMPLETE',
  testId = 'verdict-card',
}) => {
  const conformanceStatus = useRendererStore((s) => s.conformanceStatus);
  const certificationStatus = useRendererStore((s) => s.certificationStatus);

  const normalizedVerdict = React.useMemo(() => {
    if (conformanceStatus === 'FAIL' || certificationStatus === 'FAILED_CONFORMANCE') {
      return 'FAILED CONFORMANCE';
    }
    if (certificationStatus === 'FAILED_INTEGRITY') {
      return 'FAILED INTEGRITY';
    }
    if (!truthValue || truthValue === 'NO_EXECUTION') return 'NO EXECUTION';
    if (truthValue === 'NOT_RUN') return 'NOT RUN';
    const upper = truthValue.toUpperCase().trim();
    if (upper.startsWith('CERTIFIED ')) return upper;
    if (upper === 'TRUE') return 'CERTIFIED TRUE';
    if (upper === 'FALSE') return 'CERTIFIED FALSE';
    return upper;
  }, [truthValue, conformanceStatus, certificationStatus]);

  const getStateConfig = () => {
    if (normalizedVerdict.includes('TRUE')) {
      return {
        icon: <Check className="w-4 h-4 text-white stroke-[2.5] shrink-0" aria-hidden="true" />,
        accentColor: 'text-[#0969DA]',
        badgeBg: 'bg-[#0969DA]',
        badgeBorder: 'border-transparent',
      };
    }
    if (normalizedVerdict.includes('UNKNOWN')) {
      return {
        icon: <AlertTriangle className="w-4 h-4 text-white shrink-0" aria-hidden="true" />,
        accentColor: 'text-[#B45309]',
        badgeBg: 'bg-[#B45309]',
        badgeBorder: 'border-transparent',
      };
    }
    if (normalizedVerdict.includes('FALSE')) {
      return {
        icon: <X className="w-4 h-4 text-white stroke-[2.5] shrink-0" aria-hidden="true" />,
        accentColor: 'text-[#C42B1C]',
        badgeBg: 'bg-[#C42B1C]',
        badgeBorder: 'border-transparent',
      };
    }
    if (normalizedVerdict.includes('ERROR')) {
      return {
        icon: <AlertCircle className="w-4 h-4 text-white shrink-0" aria-hidden="true" />,
        accentColor: 'text-[#C42B1C]',
        badgeBg: 'bg-[#C42B1C]',
        badgeBorder: 'border-transparent',
      };
    }
    return {
      icon: <Minus className="w-4 h-4 text-white shrink-0" aria-hidden="true" />,
      accentColor: 'text-[#5C5C5C]',
      badgeBg: 'bg-[#5C5C5C]',
      badgeBorder: 'border-transparent',
    };
  };

  const config = getStateConfig();

  return (
    <div
      data-testid={testId}
      className="flex items-center gap-3 py-3.5 px-3.5"
    >
      {/* Semantic Icon Box - Compact rectangular module with 1px border */}
      <div
        className={`w-8 h-8 rounded-[4px] ${config.badgeBg} border ${config.badgeBorder} flex items-center justify-center shrink-0`}
      >
        {config.icon}
      </div>

      <div className="min-w-0 flex-1">
        {/* Exactly ONE occurrence of the canonical verdict text */}
        <div
          data-testid="verdict-title"
          className="text-[15px] sm:text-[16px] font-bold text-[#1C1C1C] tracking-tight leading-snug truncate font-sans"
        >
          {normalizedVerdict}
        </div>
        <div
          data-testid="verdict-resolution"
          className="text-[12px] text-[#5C5C5C] leading-normal mt-0.5"
        >
          Resolution: {resolutionStatus}
        </div>
      </div>
    </div>
  );
};

