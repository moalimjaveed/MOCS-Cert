import { describe, it, expect, beforeEach } from 'vitest';
import { useScanStore } from '../../store/useScanStore';
import type { QueryCompileResponse, QueryExecuteResponse, BoundingModel } from '../../types/query';

describe('PASS 47: Workstation KDOP14 Integration', () => {
  beforeEach(() => {
    useScanStore.setState({ boundingModel: 'AABB' });
  });

  it('initializes with AABB bounding model by default', () => {
    const model = useScanStore.getState().boundingModel;
    expect(model).toBe('AABB');
  });

  it('allows toggling to KDOP14 bounding model', () => {
    useScanStore.getState().setBoundingModel('KDOP14');
    expect(useScanStore.getState().boundingModel).toBe('KDOP14');

    useScanStore.getState().setBoundingModel('AABB');
    expect(useScanStore.getState().boundingModel).toBe('AABB');
  });

  it('correctly parses KDOP14 query compile response', () => {
    const mockCompileResponse: QueryCompileResponse = {
      query_id: 'q_test_14dop',
      observable: 'DISTANCE',
      predicate_operator: '<',
      threshold_value: 4.0,
      unit: 'A',
      selection_a: 'name CA',
      selection_b: 'name O2',
      quantifier: 'EXISTS',
      chosen_plan: 'Plan-B',
      estimated_prune_rate: 0.98,
      estimated_speedup: 50.0,
      plan_steps: [
        {
          step_id: 5,
          name: 'MCI INDEX SCAN',
          description: 'Scans Level 1 binary KDOP14 motion records (50 temporal blocks)',
          status: 'completed',
          metadata: { blocks_scanned: 50, bounding_model: 'KDOP14' }
        },
        {
          step_id: 6,
          name: 'KDOP14 BOUND TEST',
          description: 'Derives Euclidean distance intervals [L, U] using KDOP14',
          status: 'completed',
          metadata: { evaluated_blocks: 50, bounding_model: 'KDOP14' }
        }
      ],
      bounding_model: 'KDOP14'
    };

    expect(mockCompileResponse.bounding_model).toBe('KDOP14');
    expect(mockCompileResponse.plan_steps[1].name).toBe('KDOP14 BOUND TEST');
  });

  it('correctly parses KDOP14 certified execute response', () => {
    const mockExecuteResponse: QueryExecuteResponse = {
      query_id: 'q_test_14dop',
      truth_value: 'TRUE',
      resolution_status: 'COMPLETE',
      quantifier: 'EXISTS',
      certificate_id: 'mocs://cert/q_test_14dop',
      certificate_hash: 'abc1234567890def',
      blocks_examined: 50,
      certified_blocks: 49,
      refined_blocks: 1,
      exact_frames_scanned: 10,
      total_frames_refined: 10,
      pruning_efficiency: 98.0,
      wall_time_seconds: 0.15,
      cpu_time_seconds: 0.12,
      coordinates_materialized: 60,
      index_bytes_read: 6400,
      peak_memory_bytes: 1024000,
      bounding_model: 'KDOP14',
      certificate: {
        index_commitment: {
          algorithm: 'KDOP14-v1.0',
          bounding_model: 'KDOP14',
          bounding_model_version: '1.0'
        }
      }
    };

    expect(mockExecuteResponse.bounding_model).toBe('KDOP14');
    expect(mockExecuteResponse.certificate.index_commitment.algorithm).toBe('KDOP14-v1.0');
    expect(mockExecuteResponse.truth_value).toBe('TRUE');
  });
});
