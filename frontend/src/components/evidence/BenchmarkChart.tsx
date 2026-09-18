import React, { useEffect, useState } from 'react';
import { BarChart3, Zap, HardDrive, Database, TrendingUp } from 'lucide-react';
import { fetchBenchmarks } from '../../api/client';
import type { BenchmarkResponse } from '../../types/benchmark';

export const BenchmarkChart: React.FC = () => {
  const [data, setData] = useState<BenchmarkResponse | null>(null);

  useEffect(() => {
    fetchBenchmarks()
      .then((res) => setData(res))
      .catch((e) => console.error('Failed to load benchmarks', e));
  }, []);

  const baselines = data?.baselines || [];
  const maxTime = baselines.length > 0
    ? Math.max(1.0, ...baselines.map((b) => b.wall_time_seconds ?? 0))
    : 1.0;

  return (
    <div className="flex flex-col h-full bg-[#FFFFFF] rounded-[8px] border border-[#E5E5E5] p-3 text-xs select-none overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#E5E5E5] shrink-0">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-[#005FB8]" />
          <span className="font-semibold text-[#1C1C1C] uppercase tracking-wider text-[12px]">
            MOBench Comparative Wall-Time Benchmarks
          </span>
        </div>
        <span className="px-2 py-0.5 rounded-[3px] bg-[#0969DA] text-white font-semibold text-[10px]">
          {data?.speedup_vs_mdanalysis != null ? `${data.speedup_vs_mdanalysis.toFixed(1)}× MEASURED` : 'AWAITING BENCHMARK'}
        </span>
      </div>

      {/* Top 3 Scientific Result Tiles: structured format (LABEL -> value -> meaning) */}
      <div className="grid grid-cols-3 gap-2 my-3 shrink-0">
        <div className="p-2.5 rounded-[6px] bg-[#FAFAFA] border border-[#E5E5E5] flex flex-col items-center text-center">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[#64748B]">Speedup vs MDAnalysis</span>
          <span className="text-[20px] font-bold text-[#1C1C1C] mt-0.5">
            {data?.speedup_vs_mdanalysis != null ? `${data.speedup_vs_mdanalysis.toFixed(1)}×` : '—'}
          </span>
          <span className="text-[10.5px] text-[#64748B] mt-0.5">
            {data?.speedup_vs_mdanalysis != null ? `Measured on trajectory` : 'Not yet measured'}
          </span>
        </div>

        <div className="p-2.5 rounded-[6px] bg-[#FAFAFA] border border-[#E5E5E5] flex flex-col items-center text-center">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[#64748B]">I/O Reduction</span>
          <span className="text-[20px] font-bold text-[#005FB8] mt-0.5">
            {data?.io_reduction_pct != null ? `${data.io_reduction_pct.toFixed(2)}%` : '—'}
          </span>
          <span className="text-[10.5px] text-[#64748B] mt-0.5">
            {data?.data_read_pct != null ? `${data.data_read_pct.toFixed(2)}% bytes read` : 'Not yet measured'}
          </span>
        </div>

        <div className="p-2.5 rounded-[6px] bg-[#FAFAFA] border border-[#E5E5E5] flex flex-col items-center text-center">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[#64748B]">Atoms Materialized</span>
          <span className="text-[20px] font-bold text-[#1C1C1C] mt-0.5">
            {data?.atoms_analyzed_pct != null ? `${data.atoms_analyzed_pct.toFixed(1)}%` : '—'}
          </span>
          <span className="text-[10.5px] text-[#64748B] mt-0.5">
            {data?.index_bytes_mb != null ? `Index: ${data.index_bytes_mb.toFixed(2)} MB` : 'Not yet measured'}
          </span>
        </div>
      </div>

      {/* Horizontal Bar Chart */}
      <div className="space-y-3 flex-1 pt-1">
        {baselines.map((baseline) => {
          const isMocs = baseline.name.includes('MOCS');
          const isMeasured = baseline.status !== 'NOT_MEASURED' && baseline.wall_time_seconds != null;
          const widthPct = isMeasured && maxTime > 0
            ? ((baseline.wall_time_seconds ?? 0) / maxTime) * 100
            : 0;

          return (
            <div key={baseline.name} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 font-medium">
                  {isMocs && <Zap className="w-3 h-3 text-[#005FB8] fill-[#005FB8]" />}
                  <span className={isMocs ? 'text-[#005FB8] font-bold' : 'text-[#1C1C1C]'}>
                    {baseline.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#5C5C5C] tabular-nums">
                    {isMeasured ? `${(baseline.wall_time_seconds ?? 0).toFixed(3)} s` : 'NOT MEASURED'}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded-[3px] text-[10px] font-bold ${
                      isMocs
                        ? 'bg-[#0969DA] text-white'
                        : isMeasured
                        ? 'bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]'
                        : 'bg-[#F1F5F9] text-[#94A3B8]'
                    }`}
                  >
                    {isMeasured ? `${baseline.relative_speed}×` : '—'}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-3 rounded-[3px] bg-[#F1F5F9] border border-[#E2E8F0] overflow-hidden flex">
                <div
                  className={`h-full rounded-[2px] transition-all duration-700 ${
                    isMocs ? 'bg-[#005FB8]' : 'bg-[#94A3B8]'
                  }`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
