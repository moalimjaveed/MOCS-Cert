import React, { useRef, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Loader2, Check } from 'lucide-react';
import { triggerVerificationPulse } from '../../motion';

export type CertificateAuditStatus = 'idle' | 'verifying' | 'verified' | 'failed';

export interface CertificateVerificationLoaderProps {
  status?: CertificateAuditStatus;
  isVerifying?: boolean;
  onVerified?: () => void;
}

/**
 * CertificateVerificationLoader
 * Cryptographic certificate audit status indicator.
 * Displays honest verification states: verifying -> verified / failed.
 * Pulses the audit shield ONLY upon successful cryptographic verification.
 */
export const CertificateVerificationLoader: React.FC<CertificateVerificationLoaderProps> = ({
  status = 'verifying',
  isVerifying,
  onVerified,
}) => {
  const shieldRef = useRef<HTMLDivElement>(null);
  const activeStatus: CertificateAuditStatus = isVerifying ? 'verifying' : status;

  useEffect(() => {
    if (activeStatus === 'verified' && shieldRef.current) {
      triggerVerificationPulse(shieldRef.current);
      onVerified?.();
    }
  }, [activeStatus, onVerified]);

  if (activeStatus === 'idle') return null;

  return (
    <div
      data-testid="certificate-verification-loader"
      className="p-3.5 bg-white border border-[#E5E5E5] rounded-md shadow-sm flex items-center gap-3 text-xs select-none"
      role="status"
      aria-live="polite"
      aria-label={`Certificate audit: ${activeStatus}`}
    >
      <div
        ref={shieldRef}
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
          activeStatus === 'verified'
            ? 'bg-[#EBF7EE] text-[#107C10] border-[#B8E3C0]'
            : activeStatus === 'failed'
            ? 'bg-[#FDF3F4] text-[#D13438] border-[#F4BFC3]'
            : 'bg-[#EFF6FC] text-[#005FB8] border-[#C7E0F4]'
        }`}
      >
        {activeStatus === 'failed' ? (
          <ShieldAlert className="w-4 h-4" />
        ) : (
          <ShieldCheck className="w-4 h-4" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[#1C1C1C]">Cryptographic Certificate Audit</span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#F3F2F1] text-[#5C5C5C] font-medium">
            {activeStatus}
          </span>
        </div>
        <p className="text-[11px] text-[#5C5C5C] truncate mt-0.5 font-mono flex items-center gap-1.5">
          {activeStatus === 'verifying' && (
            <>
              <Loader2 className="w-3 h-3 animate-spin text-[#005FB8] shrink-0" />
              Validating SHA-256 Merkle root & interval soundness...
            </>
          )}
          {activeStatus === 'verified' && (
            <>
              <Check className="w-3 h-3 text-[#107C10] shrink-0" />
              Witness intervals validated: Bit-Exact Soundness Certified
            </>
          )}
          {activeStatus === 'failed' && (
            <>
              Verification failed: digest mismatch or non-sound interval
            </>
          )}
        </p>
      </div>
    </div>
  );
};
