/**
 * Multi-baseline benchmarking types (Figure 1).
 */

export interface BenchmarkBaseline {
  name: string;
  status?: string;
  wall_time_seconds: number | null;
  relative_speed: number | null;
  data_read_pct: number | null;
  atoms_analyzed_pct: number | null;
  index_bytes_mb: number | null;
}

export interface BenchmarkResponse {
  query_id: string;
  speedup_vs_mdanalysis: number;
  io_reduction_pct: number;
  data_read_pct: number;
  atoms_analyzed_pct: number;
  index_bytes_mb: number;
  baselines: BenchmarkBaseline[];
}
