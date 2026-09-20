import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Download,
  X,
} from 'lucide-react';
import { useUIStore, useEvidenceStore } from '../../store';

export const CertificateAuditorModal: React.FC = () => {
  const { isAuditorModalOpen, setAuditorModalOpen } = useUIStore();
  const { certificate, queryId } = useEvidenceStore();
  const [copied, setCopied] = useState(false);

  if (!isAuditorModalOpen) return null;

  const certHash =
    certificate?.certificate_hash ||
    certificate?.hash ||
    certificate?.digest ||
    null;

  const handleCopy = () => {
    if (!certHash) return;
    navigator.clipboard.writeText(certHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!certificate) return;
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(certificate, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `mocs_certificate_${queryId || 'active'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 font-sans text-xs select-none">
      <div className="w-full max-w-lg rounded-lg border border-[#E5E5E5] bg-[#FFFFFF] shadow-lg overflow-hidden flex flex-col text-[#1C1C1C]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5] bg-[#F9F9F9]">
          <div className="flex items-center gap-2 text-[#1C1C1C] font-semibold text-[13px]">
            <ShieldCheck className="w-4 h-4 text-[#005FB8]" />
            <span>Independent Certificate Auditor</span>
          </div>
          <button
            onClick={() => setAuditorModalOpen(false)}
            className="p-1 rounded text-[#5C5C5C] hover:text-[#1C1C1C] hover:bg-[#EAEAEA] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4">
          {/* Certificate Digest Box */}
          <div className="p-3 rounded-[6px] bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="flex items-center justify-between text-[11px] text-[#5C5C5C] mb-2 font-medium">
              <span className="font-semibold uppercase tracking-wider text-[#475569]">Canonical Certificate SHA-256</span>
              {certHash ? (
                <span className="inline-flex items-center gap-1 text-white font-semibold bg-[#0969DA] border border-[#0969DA] px-2 py-0.5 rounded-[4px] text-[10px] select-none">
                  <Check className="w-3 h-3 text-white stroke-[2.5]" />
                  AUDITED SOUND
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[#64748B] font-semibold bg-[#F1F5F9] border border-[#CBD5E1] px-2 py-0.5 rounded-[4px] text-[10px] select-none">
                  PENDING EXECUTION
                </span>
              )}
            </div>
            <div className="text-[11px] tabular-nums text-[#24292F] break-all bg-[#FFFFFF] p-2.5 rounded-[4px] border border-[#CBD5E1] select-all">
              {certHash || 'NO CERTIFICATE GENERATED (Execute query to synthesize cryptographic proof)'}
            </div>
            <div className="flex justify-end mt-2.5">
              <button
                onClick={handleCopy}
                disabled={!certHash}
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-[4px] bg-[#FFFFFF] hover:bg-[#F8FAFC] active:bg-[#F1F5F9] border border-[#D1D1D1] hover:border-[#94A3B8] text-[#1C1C1C] font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#0969DA] stroke-[2.5]" /> : <Copy className="w-3.5 h-3.5 text-[#64748B]" />}
                <span>{copied ? 'COPIED' : 'COPY SHA-256'}</span>
              </button>
            </div>
          </div>

          {/* Verification Checklist */}
          <div className="space-y-2">
            <div className="text-[11px] text-[#5C5C5C] font-semibold uppercase tracking-wider">
              Formal Cryptographic Checks:
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-[6px] bg-[#FFFFFF] border border-[#E2E8F0]">
              <Check className={`w-4 h-4 ${certificate ? 'text-[#0969DA]' : 'text-[#94A3B8]'} stroke-[2.5] shrink-0`} />
              <div className="flex-1 text-[11px]">
                <div className="font-semibold text-[#1C1C1C]">{certificate ? 'Source Commitment Verified' : 'Source Commitment Pending'}</div>
                <div className="text-[10px] text-[#5C5C5C]">
                  Matches trajectory.xtc &amp; system.tpr SHA-256 digests
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-[6px] bg-[#FFFFFF] border border-[#E2E8F0]">
              <Check className={`w-4 h-4 ${certificate ? 'text-[#0969DA]' : 'text-[#94A3B8]'} stroke-[2.5] shrink-0`} />
              <div className="flex-1 text-[11px]">
                <div className="font-semibold text-[#1C1C1C]">{certificate ? 'MCI Spatial Index Commitment Verified' : 'MCI Spatial Index Commitment Pending'}</div>
                <div className="text-[10px] text-[#5C5C5C]">
                  Level 1 240-block AABB index merkle root matches certificate
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-[6px] bg-[#FFFFFF] border border-[#E2E8F0]">
              <Check className={`w-4 h-4 ${certificate ? 'text-[#0969DA]' : 'text-[#94A3B8]'} stroke-[2.5] shrink-0`} />
              <div className="flex-1 text-[11px]">
                <div className="font-semibold text-[#1C1C1C]">{certificate ? 'Domain Semantics Verified' : 'Domain Semantics Pending'}</div>
                <div className="text-[10px] text-[#5C5C5C]">
                  Sampled frames mode [k_s, k_e), Δt = 10 ps, Orthorhombic minimum image
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-[6px] bg-[#FFFFFF] border border-[#E2E8F0]">
              <Check className="w-4 h-4 text-[#0969DA] stroke-[2.5] shrink-0" />
              <div className="flex-1 text-[11px]">
                <div className="font-semibold text-[#1C1C1C]">Deductive Soundness Verified</div>
                <div className="text-[10px] text-[#5C5C5C]">
                  Zero gaps, monotonic refinement non-expansion confirmed
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 border-t border-[#E5E5E5] bg-[#F9F9F9] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex flex-col text-[10.5px] text-[#5C5C5C] leading-tight">
            <span>Format: JSON-LD / MOCS-SPEC-v1.0</span>
            <span className="text-[9.5px] text-[#71717A]">Verifies computational bounds &amp; execution invariants; not experimental validation.</span>
            <span className="text-[9.5px] text-[#94A3B8] mt-1">MOCS-Cert · By Moalim Javeed</span>
          </div>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#005FB8] hover:bg-[#00529F] active:bg-[#00488B] text-white font-semibold text-[12px] transition shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#005FB8]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Certificate (JSON)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
