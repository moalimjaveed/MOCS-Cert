import React, { useMemo } from 'react';
import katex from 'katex';
import DOMPurify from 'dompurify';
import 'katex/dist/katex.min.css';
import { Calculator, AlertTriangle, Layers, RefreshCw, CheckCircle } from 'lucide-react';
import { useProofStore, useTimelineStore } from '../../store';
import { refineBlock } from '../../api/client';
import { wsService } from '../../api/websocket';

export const MathematicalDetails: React.FC = () => {
  const {
    focusedBlockId,
    timeRangeNs,
    lowerBound,
    upperBound,
    threshold,
    condition,
    status,
    explanation,
  } = useProofStore();

  const { selectedBlockId, setSubBlocks, isRefining, setRefining } = useTimelineStore();
  const targetBlockId = focusedBlockId ?? selectedBlockId;

  // Pre-render KaTeX LaTeX equations safely
  const lFormulaHtml = useMemo(() => {
    return DOMPurify.sanitize(katex.renderToString(
      'L = \\sqrt{\\sum_{\\mu \\in \\{x,y,z\\}} \\left(\\max(0, |\\Delta c_\\mu| - (r_{a,\\mu} + r_{b,\\mu}))\\right)^2}',
      { displayMode: true, throwOnError: false }
    ));
  }, []);

  const uFormulaHtml = useMemo(() => {
    return DOMPurify.sanitize(katex.renderToString(
      'U = \\sqrt{\\sum_{\\mu \\in \\{x,y,z\\}} \\left(\\min(L_\\mu / 2, |\\Delta c_\\mu| + (r_{a,\\mu} + r_{b,\\mu}))\\right)^2}',
      { displayMode: true, throwOnError: false }
    ));
  }, []);

  const pbcFormulaHtml = useMemo(() => {
    return DOMPurify.sanitize(katex.renderToString(
      '\\Delta c_\\mu = (c_{b,\\mu} - c_{a,\\mu}) - L_\\mu \\left\\lfloor \\frac{c_{b,\\mu} - c_{a,\\mu}}{L_\\mu} + 0.5 \\right\\rfloor',
      { displayMode: true, throwOnError: false }
    ));
  }, []);

  const handleRefine = async () => {
    if (targetBlockId === null) return;
    try {
      setRefining(true);
      if (wsService.isConnected) {
        wsService.send({ action: 'refine_block', block_id: targetBlockId });
      }
      const res = await refineBlock(targetBlockId);
      setSubBlocks(res.child_blocks);
    } catch (err) {
      console.error('Refine failed', err);
    } finally {
      setRefining(false);
    }
  };

  const isStraddling = lowerBound < threshold && upperBound >= threshold;

  return (
    <div className="flex flex-col h-full bg-[#FFFFFF] rounded-[8px] border border-[#E5E5E5] p-3 text-xs select-none overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#E5E5E5] shrink-0">
        <div className="flex items-center gap-2">
          <Calculator className="w-3.5 h-3.5 text-[#005FB8]" />
          <span className="font-semibold text-[#1C1C1C] uppercase tracking-wider text-[12px]">
            Mathematical Details {targetBlockId !== null ? `(Block ${targetBlockId})` : '(No Block Selected)'}
          </span>
        </div>
        <span
          className={`px-2 py-0.5 rounded-[3px] text-[10px] font-semibold text-white ${
            isStraddling
              ? 'bg-[#B45309]'
              : lowerBound >= threshold
              ? 'bg-[#C42B1C]'
              : 'bg-[#0969DA]'
          }`}
        >
          {status}
        </span>
      </div>

      {/* Interval Bounds derivations */}
      <div className="my-2 space-y-2">
        <div className="p-2.5 rounded-[6px] bg-[#FAFAFA] border border-[#E5E5E5]">
          <div className="text-[10.5px] text-[#64748B] mb-1 font-semibold uppercase tracking-wider">
            Conservative Euclidean Bounding Formulas (PBC Min-Image):
          </div>
          <div
            className="py-1 text-[#1C1C1C] overflow-x-auto text-[11px]"
            dangerouslySetInnerHTML={{ __html: lFormulaHtml }}
          />
          <div
            className="py-1 text-[#1C1C1C] overflow-x-auto text-[11px]"
            dangerouslySetInnerHTML={{ __html: uFormulaHtml }}
          />
        </div>

        {/* Concrete Evaluated Block Values */}
        <div className="p-2.5 rounded-[6px] bg-[#FAFAFA] border border-[#E5E5E5]">
          <div className="text-[11px] text-[#1C1C1C] mb-1.5 font-semibold">
            Concrete Evaluation for Block {focusedBlockId ?? 41} [{timeRangeNs[0]}–{timeRangeNs[1]} ns]:
          </div>
          <div className="grid grid-cols-2 gap-2 mt-1.5 text-[11px]">
            <div className="p-2 rounded-[4px] bg-[#FFFFFF] border border-[#E5E5E5] flex justify-between items-center">
              <span className="text-[#64748B]">Lower Bound (L):</span>
              <strong className="text-[#1C1C1C] tabular-nums text-xs font-bold">{lowerBound.toFixed(2)} Å</strong>
            </div>
            <div className="p-2 rounded-[4px] bg-[#FFFFFF] border border-[#E5E5E5] flex justify-between items-center">
              <span className="text-[#64748B]">Upper Bound (U):</span>
              <strong className="text-[#1C1C1C] tabular-nums text-xs font-bold">{upperBound.toFixed(2)} Å</strong>
            </div>
          </div>

          <div className="mt-2 p-2 rounded-[4px] bg-[#FFFFFF] border border-[#E5E5E5] text-[11px] flex justify-between items-center">
            <span className="text-[#64748B]">Threshold Condition:</span>
            <span className="tabular-nums font-semibold text-[#005FB8]">
              distance &lt; {threshold.toFixed(1)} Å
            </span>
          </div>
        </div>

        {/* Straddle Warning Callout */}
        <div className="p-2.5 rounded-[4px] bg-[#FFFFFF] border-l-4 border-l-[#B45309] border border-[#E5E5E5] text-[#1C1C1C] text-[11px] leading-relaxed flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
          <div>
            <strong className="text-[#B45309]">Predicate Straddling: </strong>
            <span>{explanation}</span>
          </div>
        </div>

        {/* Refine Block Button */}
        {isStraddling && (
          <button
            onClick={handleRefine}
            disabled={isRefining}
            className={`w-full py-2 rounded-[4px] text-xs font-semibold tracking-wide flex items-center justify-center gap-2 transition cursor-pointer ${
              isRefining
                ? 'bg-[#F1F5F9] text-[#94A3B8] cursor-not-allowed'
                : 'bg-[#005FB8] hover:bg-[#004C99] text-white font-semibold'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefining ? 'animate-spin' : ''}`} />
            <span>{isRefining ? 'PERFORMING DYADIC SUBDIVISION...' : `REFINE BLOCK ${targetBlockId ?? ''} ON-DEMAND`}</span>
          </button>
        )}
      </div>
    </div>
  );
};
