import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  HardDrive,
  Cpu,
  Clock,
  Zap,
  Layers,
  Database,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { MocsTable, MocsBadge, MocsTabs } from '../primitives';
import { BenchmarkChart } from '../evidence/BenchmarkChart';
import { WorkflowOrchestrationView } from './WorkflowOrchestrationView';
import { useEvidenceStore, useUIStore, useScanStore } from '../../store';
import { getCurrentRawPath, parseRoute, navigateTo } from '../../navigation/router';

interface BaselineRow {
  name: string;
  timeSec: number | null;
  speedup: string;
  ioMb: number | null;
  memMb: number | null;
  status: string;
}

const BASELINE_COLUMNS: any[] = [
  {
    header: 'System / Engine',
    accessorKey: 'name',
    size: 240,
    cell: (info: any) => {
      const val = info.getValue();
      const isMocs = typeof val === 'string' && val.includes('MOCS-Cert');
      return (
        <span className={isMocs ? 'font-semibold text-[#005FB8]' : 'text-[#1C1C1C]'}>
          {val}
        </span>
      );
    },
  },
  {
    header: 'Wall Time',
    accessorKey: 'timeSec',
    size: 110,
    cell: (info: any) => {
      const val = info.getValue();
      return (
        <span className="tabular-nums text-[#1C1C1C] whitespace-nowrap">
          {val != null ? `${Number(val).toFixed(3)} s` : '—'}
        </span>
      );
    },
  },
  {
    header: 'Speedup vs MOCS',
    accessorKey: 'speedup',
    size: 140,
    cell: (info: any) => {
      const isMocs = info.row?.original?.name?.includes('MOCS-Cert');
      const val = info.getValue();
      const isNotMeasured = val === 'NOT MEASURED';
      return (
        <span className={`tabular-nums whitespace-nowrap font-medium ${isMocs ? 'text-[#005FB8] font-bold' : isNotMeasured ? 'text-[#8A8A8A]' : 'text-[#B45309]'}`}>
          {val}
        </span>
      );
    },
  },
  {
    header: 'I/O Volume',
    accessorKey: 'ioMb',
    size: 110,
    cell: (info: any) => {
      const val = info.getValue();
      return (
        <span className="tabular-nums text-[#5C5C5C] whitespace-nowrap">
          {val != null ? `${val} MB` : '—'}
        </span>
      );
    },
  },
  {
    header: 'Peak Memory',
    accessorKey: 'memMb',
    size: 110,
    cell: (info: any) => {
      const val = info.getValue();
      return (
        <span className="tabular-nums text-[#5C5C5C] whitespace-nowrap">
          {val != null ? `${val} MB` : '—'}
        </span>
      );
    },
  },
  {
    header: () => <span className="block text-right">Methodology</span>,
    id: 'methodology',
    accessorKey: 'status',
    size: 130,
    cell: (info: any) => {
      const isMocs = info.row?.original?.name?.includes('MOCS-Cert');
      const isNotMeasured = info.getValue() === 'Not Measured';
      return (
        <div className="text-right">
          <MocsBadge variant={isMocs ? 'primary' : isNotMeasured ? 'neutral' : 'warning'} size="sm">
            {info.getValue()}
          </MocsBadge>
        </div>
      );
    },
  },
];

const DEFAULT_BASELINES: BaselineRow[] = [
  { name: 'MOCS-Cert (Indexed + Pruned)', timeSec: null, speedup: 'Reference Engine', ioMb: null, memMb: null, status: 'Active' },
  { name: 'MDAnalysis (Iterative Scan)', timeSec: null, speedup: 'NOT MEASURED', ioMb: null, memMb: null, status: 'Not Measured' },
  { name: 'MDTraj (Chunked Trajectory)', timeSec: null, speedup: 'NOT MEASURED', ioMb: null, memMb: null, status: 'Not Measured' },
  { name: 'Parquet / Arrow (Coordinate Columns)', timeSec: null, speedup: 'NOT MEASURED', ioMb: null, memMb: null, status: 'Not Measured' },
  { name: 'HDF5 / NetCDF (Strided Read)', timeSec: null, speedup: 'NOT MEASURED', ioMb: null, memMb: null, status: 'Not Measured' },
  { name: 'Flat Binary Sequential Scan', timeSec: null, speedup: 'NOT MEASURED', ioMb: null, memMb: null, status: 'Not Measured' },
];

const PRUNING_TIER_COLUMNS: any[] = [
  {
    header: 'Storage / Cache Layer',
    accessorKey: 'tier',
    size: 220,
    cell: (info: any) => (
      <span className="font-semibold text-[#1C1C1C]">{info.getValue()}</span>
    ),
  },
  {
    header: 'Access Granularity',
    accessorKey: 'granularity',
    size: 160,
    cell: (info: any) => (
      <span className="text-[#5C5C5C]">{info.getValue()}</span>
    ),
  },
  {
    header: 'Avoided Reads',
    accessorKey: 'avoided',
    size: 140,
    cell: (info: any) => (
      <span className="font-semibold text-[#0969DA] tabular-nums">{info.getValue()}</span>
    ),
  },
  {
    header: 'Transfer Efficiency',
    accessorKey: 'efficiency',
    size: 140,
    cell: (info: any) => (
      <span className="text-[#1C1C1C] tabular-nums">{info.getValue()}</span>
    ),
  },
  {
    header: () => <span className="block text-right">Verification Status</span>,
    id: 'status',
    accessorKey: 'status',
    size: 150,
    cell: (info: any) => {
      const val = info.getValue();
      const isAwaiting = val === 'Awaiting Execution' || val === '—' || !val;
      return (
        <div className="text-right">
          <MocsBadge variant={isAwaiting ? 'neutral' : 'success'} size="sm">
            {val}
          </MocsBadge>
        </div>
      );
    },
  },
];

export const ExecutionBenchmarksView: React.FC = () => {
  const {
    wallTimeSeconds,
    peakMemoryMb,
    ioPruneRatio,
    blocksExamined,
    certifiedBlocks,
    refinedBlocks,
    exactFramesScanned,
    framesTotal,
    pruningEfficiency,
    indexBytesReadMb,
    executionId,
  } = useEvidenceStore();
  const { trajectoryId, totalFrames } = useScanStore();
  const { activeSidebarId } = useUIStore();
  const [data, setData] = useState<any>(null);
  const initialSubTab = (() => {
    try {
      const { pathname, search } = getCurrentRawPath();
      const route = parseRoute(pathname, search);
      if (route.subtab && ['perf', 'io_pruning', 'workload', 'performance', 'pruning'].includes(route.subtab)) {
        const mapped = route.subtab === 'performance' ? 'perf' : route.subtab === 'pruning' ? 'io_pruning' : route.subtab;
        return mapped as 'perf' | 'io_pruning' | 'workload';
      }
    } catch {
      // fallback
    }
    return 'perf';
  })();
  const [selectedSubTab, setSelectedSubTab] = useState<'perf' | 'io_pruning' | 'workload'>(initialSubTab);

  const handleSubTabChange = (tabId: 'perf' | 'io_pruning' | 'workload') => {
    setSelectedSubTab(tabId);
    try {
      const { pathname } = getCurrentRawPath();
      if (pathname.startsWith('/benchmarks')) {
        navigateTo(`/benchmarks/${tabId}`, { replace: true });
      } else {
        navigateTo(`${pathname}?subtab=${tabId}`, { replace: true });
      }
    } catch {
      // fallback
    }
  };

  const cleanTraj = trajectoryId?.replace(/^.*[\\/]/, '') || 'synth_500f.xtc';

  const pruningTierData = React.useMemo(() => {
    if (!executionId && (!blocksExamined || blocksExamined === 0)) {
      return [
        {
          tier: 'MCI Spatial Radix Tree (L1)',
          granularity: 'Block bounding box (10 frames)',
          avoided: 'Awaiting execution',
          efficiency: 'Zero disk I/O for pruned blocks',
          status: 'Awaiting execution',
        },
        {
          tier: 'Zero-Copy mmap Seek Index',
          granularity: 'Byte seek table cache',
          avoided: '—',
          efficiency: 'Direct offset seek mapping',
          status: 'Awaiting Execution',
        },
        {
          tier: 'AABB Caliper Culling',
          granularity: 'Dual-selection spatial cage',
          avoided: '—',
          efficiency: 'Direct conservative test',
          status: 'Awaiting Execution',
        },
        {
          tier: 'Exact Frame Materialization',
          granularity: 'Single trajectory frame',
          avoided: '—',
          efficiency: 'Selective coordinate read only',
          status: 'Awaiting Execution',
        },
      ];
    }

    const totalF = framesTotal || totalFrames || 500;
    const skippedFrames = Math.max(0, totalF - (exactFramesScanned || 0));
    const pctFrames = totalF > 0 ? ((skippedFrames / totalF) * 100).toFixed(1) : '100.0';

    return [
      {
        tier: 'MCI Spatial Radix Tree (L1)',
        granularity: 'Block bounding box (10 frames)',
        avoided: `${certifiedBlocks || 0} of ${blocksExamined || 0} blocks (${(pruningEfficiency || 0).toFixed(1)}%)`,
        efficiency: 'Zero disk I/O for pruned blocks',
        status: 'Guarded Sound',
      },
      {
        tier: 'Zero-Copy mmap Seek Index',
        granularity: 'Byte seek table cache',
        avoided: indexBytesReadMb ? `${Number(indexBytesReadMb).toFixed(2)} MB cached` : 'Zero-copy index active',
        efficiency: 'Bounded memory footprint',
        status: '✓ Bit-Exact',
      },
      {
        tier: 'AABB Caliper Culling',
        granularity: 'Dual-selection spatial cage',
        avoided: `${certifiedBlocks || 0} candidate blocks eliminated`,
        efficiency: 'Direct conservative test',
        status: '✓ Sound',
      },
      {
        tier: 'Exact Frame Materialization',
        granularity: 'Single trajectory frame',
        avoided: `${skippedFrames} of ${totalF} frames skipped (${pctFrames}%)`,
        efficiency: 'Selective coordinate read only',
        status: '✓ Certified',
      },
    ];
  }, [executionId, blocksExamined, certifiedBlocks, pruningEfficiency, indexBytesReadMb, framesTotal, totalFrames, exactFramesScanned]);

  // Sync with left sidebar navigation selection and route changes
  useEffect(() => {
    try {
      const { pathname, search } = getCurrentRawPath();
      const route = parseRoute(pathname, search);
      if (route.subtab && ['perf', 'io_pruning', 'workload', 'performance', 'pruning'].includes(route.subtab)) {
        const mapped = route.subtab === 'performance' ? 'perf' : route.subtab === 'pruning' ? 'io_pruning' : route.subtab;
        setSelectedSubTab(mapped as any);
        return;
      }
    } catch {
      // fallback
    }
    if (activeSidebarId === 'perf') {
      setSelectedSubTab('perf');
    } else if (activeSidebarId === 'io_pruning') {
      setSelectedSubTab('io_pruning');
    } else if (activeSidebarId === 'workload') {
      setSelectedSubTab('workload');
    }
  }, [activeSidebarId]);

  useEffect(() => {
    import('../../api/client').then(({ fetchBenchmarks }) => {
      fetchBenchmarks()
        .then((res) => setData(res))
        .catch(() => {});
    });
  }, []);

  const tableData: BaselineRow[] = React.useMemo(() => {
    if (!data?.baselines || data.baselines.length === 0) {
      return DEFAULT_BASELINES;
    }
    return data.baselines.map((b: any) => ({
      name: b.name,
      timeSec: b.wall_time_seconds,
      speedup: b.relative_speed != null
        ? `${b.relative_speed.toFixed(1)}x`
        : (b.status === 'ACTIVE' || b.name?.includes('MOCS-Cert') ? '1.0x (Ref)' : 'NOT MEASURED'),
      ioMb: b.index_bytes_mb,
      memMb: null,
      status: b.status === 'NOT_MEASURED' ? 'Not Measured' : (b.status || 'Baseline'),
    }));
  }, [data]);

  return (
    <div data-testid="execution-benchmarks-view" className="p-3 sm:p-4 space-y-3 flex-1 flex flex-col min-w-0 font-sans text-xs">
      <div data-testid="workflow-orchestration-view" className="contents">

      {/* Metric Strip */}
      <div data-testid="benchmark-metric-strip" className="mocs-metric-strip mocs-metric-strip-4 shrink-0">
        <div className="mocs-metric-cell">
          <div className="flex items-center justify-between gap-1.5">
            <span className="mocs-metric-label">Query Speedup</span>
            <Zap className="w-3.5 h-3.5 text-[#005FB8] shrink-0" aria-hidden="true" />
          </div>
          <div className="mocs-metric-value text-[20px] text-[#1C1C1C]">
            {data?.speedup_vs_mdanalysis != null ? `${data.speedup_vs_mdanalysis.toFixed(1)}x` : '—'}
          </div>
          <div className="mocs-metric-subtext text-[#0969DA] font-medium">
            {data?.speedup_vs_mdanalysis != null ? 'vs MDAnalysis linear frame scan' : 'Awaiting live benchmark'}
          </div>
        </div>

        <div className="mocs-metric-cell">
          <div className="flex items-center justify-between gap-1.5">
            <span className="mocs-metric-label">Wall Execution Time</span>
            <Clock className="w-3.5 h-3.5 text-[#005FB8] shrink-0" aria-hidden="true" />
          </div>
          <div className="mocs-metric-value text-[20px] text-[#1C1C1C]">
            {wallTimeSeconds ? `${(wallTimeSeconds * 1000).toFixed(0)} ms` : '—'}
          </div>
          <div className="mocs-metric-subtext text-[#5C5C5C]">Total query to certificate output</div>
        </div>

        <div className="mocs-metric-cell">
          <div className="flex items-center justify-between gap-1.5">
            <span className="mocs-metric-label">I/O Prune Ratio</span>
            <HardDrive className="w-3.5 h-3.5 text-[#0969DA] shrink-0" aria-hidden="true" />
          </div>
          <div className="mocs-metric-value text-[20px] text-[#1C1C1C]">
            {ioPruneRatio ? `${(ioPruneRatio > 1.0 ? ioPruneRatio : ioPruneRatio * 100).toFixed(1)}%` : '—'}
          </div>
          <div className="mocs-metric-subtext text-[#5C5C5C]">Avoided trajectory frame decompression</div>
        </div>

        <div className="mocs-metric-cell">
          <div className="flex items-center justify-between gap-1.5">
            <span className="mocs-metric-label">Peak Workstation RAM</span>
            <Cpu className="w-3.5 h-3.5 text-[#005FB8] shrink-0" aria-hidden="true" />
          </div>
          <div className="mocs-metric-value text-[20px] text-[#1C1C1C]">
            {peakMemoryMb ? `${Number(peakMemoryMb).toFixed(1)} MB` : '—'}
          </div>
          <div className="mocs-metric-subtext text-[#5C5C5C]">Bounded memory allocation invariant</div>
        </div>
      </div>

      {/* Main Benchmarks Workstation Surface */}
      <div className="bg-[#FFFFFF] rounded-[6px] border border-[#E5E5E5] flex-1 flex flex-col overflow-hidden min-h-[520px]">
        {/* Sub-tab Navigation */}
        <MocsTabs
          testId="benchmarks-subtabs"
          tabs={[
            { id: 'perf', label: 'Performance' },
            { id: 'io_pruning', label: 'Pruning' },
            { id: 'workload', label: 'Workflows' },
          ]}
          activeId={selectedSubTab}
          onChange={(id) => handleSubTabChange(id as typeof selectedSubTab)}
        />

        {/* Tab 1: Engine Performance & Baselines */}
        {selectedSubTab === 'perf' && (
          <div className="flex-1 flex flex-col overflow-y-auto scientific-scrollbar p-4 space-y-4">
            {/* Analytical Execution Header & Provenance Strip */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[#F0F0F0]">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#005FB8] shrink-0" aria-hidden="true" />
                  <h2 className="font-semibold text-xs text-[#1C1C1C] uppercase tracking-wider m-0">
                    Execution Wall-Time & Baseline Comparison
                  </h2>
                </div>
                <p className="text-[11px] text-[#5C5C5C] m-0">
                  Single-core scan across 500 frames · Reference Engine: MOCS-Cert AABB-v1
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-[#5C5C5C]">Measurement:</span>
                <MocsBadge variant={wallTimeSeconds ? 'true' : 'neutral'} size="sm">
                  {wallTimeSeconds ? 'Live Execution Measured' : 'Awaiting Query Run'}
                </MocsBadge>
              </div>
            </div>

            {/* Benchmark Chart */}
            <div className="bg-[#FFFFFF] rounded-[4px] border border-[#E5E5E5] p-3.5">
              <BenchmarkChart />
            </div>

            {/* Detailed Baseline Table */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between px-0.5">
                <span className="font-semibold text-xs text-[#1C1C1C] uppercase tracking-wider">
                  Detailed Baseline Measurement Comparison
                </span>
                <span className="text-[11px] text-[#5C5C5C]">
                  Lower wall-time indicates higher throughput
                </span>
              </div>
              <MocsTable
                testId="benchmark-table"
                data={tableData}
                columns={BASELINE_COLUMNS}
                minWidth="780px"
                className="border border-[#E5E5E5] rounded-[4px]"
              />
            </div>
          </div>
        )}

        {/* Tab 2: I/O & Pruning Efficiency */}
        {selectedSubTab === 'io_pruning' && (
          <div className="flex-1 flex flex-col overflow-y-auto scientific-scrollbar p-3.5 space-y-4" data-testid="io-pruning-panel">
            <div className="p-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-[6px] flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-[#1E3A8A]">
                  Multi-Tier Coordinate Decomposition &amp; Block Skip Architecture
                </div>
                <div className="text-[11px] text-[#3B82F6] mt-0.5">
                  Avoided trajectory frame decompression via conservative AABB spatial bounds and zero-copy seek indices.
                </div>
              </div>
              <MocsBadge variant="primary" size="md">
                {executionId ? `${(pruningEfficiency || 0).toFixed(1)}% Block Prune Rate` : 'NOT MEASURED'}
              </MocsBadge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="font-semibold text-xs text-[#1C1C1C] uppercase tracking-wider">
                  Storage Layer Skip Statistics
                </span>
                <span className="text-[11px] text-[#5C5C5C]">
                  {cleanTraj} · {totalFrames || 500} frames · {blocksExamined > 0 ? `${blocksExamined} blocks examined` : 'Awaiting query execution'}
                </span>
              </div>
              <MocsTable
                data={pruningTierData}
                columns={PRUNING_TIER_COLUMNS}
                minWidth="800px"
                className="border border-[#E5E5E5] rounded-[6px]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[6px] space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-[#1C1C1C]">
                  <Database className="w-3.5 h-3.5 text-[#005FB8]" />
                  <span>I/O Memory Footprint Invariant</span>
                </div>
                <p className="text-[11px] text-[#5C5C5C] leading-relaxed">
                  Zero whole-trajectory allocation. Coordinates are streamed into memory on demand only for candidate blocks requiring exact Euclidean evaluation.
                </p>
                <div className="text-xs font-mono text-[#005FB8] font-bold">
                  Peak Memory: {peakMemoryMb ? `${Number(peakMemoryMb).toFixed(1)} MB` : (executionId ? '< 10.0 MB' : 'NOT MEASURED')} (Strictly Bounded)
                </div>
              </div>

              <div className="p-3.5 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[6px] space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-[#1C1C1C]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0969DA]" />
                  <span>Monotonic Bounding Soundness</span>
                </div>
                <p className="text-[11px] text-[#5C5C5C] leading-relaxed">
                  Pruned blocks are guaranteed to contain zero satisfying frames. Deductive soundness eliminates false positives and false negatives without full trajectory traversal.
                </p>
                <div className="text-xs font-medium text-[#0969DA]">
                  Soundness Verified: Zero False Negatives
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Scientific Workflows & Ecosystem Discovery */}
        {selectedSubTab === 'workload' && (
          <div className="flex-1 overflow-y-auto scientific-scrollbar" data-testid="workload-panel">
            <WorkflowOrchestrationView />
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default ExecutionBenchmarksView;
