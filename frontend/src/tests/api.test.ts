import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const ExecutionPlanStepSchema = z.object({
  step_id: z.number(),
  name: z.string(),
  description: z.string(),
  status: z.enum(['completed', 'in_progress', 'pending', 'skipped']),
  metadata: z.record(z.string(), z.any()).optional(),
});

const QueryCompileResponseSchema = z.object({
  query_id: z.string(),
  observable: z.string(),
  predicate_operator: z.string(),
  threshold_value: z.number(),
  unit: z.string(),
  selection_a: z.string(),
  selection_b: z.string(),
  quantifier: z.string(),
  chosen_plan: z.string(),
  estimated_prune_rate: z.number(),
  estimated_speedup: z.number(),
  plan_steps: z.array(ExecutionPlanStepSchema),
});

const SubBlockItemSchema = z.object({
  child_id: z.string(),
  parent_id: z.number(),
  frame_start: z.number(),
  frame_end_exclusive: z.number(),
  lower_bound: z.number(),
  upper_bound: z.number(),
  truth_value: z.string(),
  status: z.string(),
});

const BlockLatticeItemSchema = z.object({
  block_id: z.number(),
  frame_start: z.number(),
  frame_end_exclusive: z.number(),
  time_start_ns: z.number(),
  time_end_ns: z.number(),
  lower_bound: z.number(),
  upper_bound: z.number(),
  truth_value: z.string(),
  status: z.string(),
  child_blocks: z.array(SubBlockItemSchema),
});

describe('Zod Runtime Schema Validation', () => {
  it('validates QueryCompileResponse payload matching backend', () => {
    const samplePayload = {
      query_id: 'q_9f05e88b',
      observable: 'DISTANCE',
      predicate_operator: '<',
      threshold_value: 4.0,
      unit: 'A',
      selection_a: 'A:155:CA',
      selection_b: 'LIG:1:02',
      quantifier: 'EXISTS',
      chosen_plan: 'Plan-B',
      estimated_prune_rate: 0.971,
      estimated_speedup: 5.3,
      plan_steps: [
        {
          step_id: 1,
          name: 'SCIENTIFIC QUERY',
          description: 'Lexical parsing',
          status: 'completed' as const,
        },
      ],
    };

    const parsed = QueryCompileResponseSchema.parse(samplePayload);
    expect(parsed.query_id).toBe('q_9f05e88b');
    expect(parsed.threshold_value).toBe(4.0);
    expect(parsed.plan_steps.length).toBe(1);
  });

  it('validates canonical Block 41 payload', () => {
    const block41 = {
      block_id: 41,
      frame_start: 41000,
      frame_end_exclusive: 41416,
      time_start_ns: 410.0,
      time_end_ns: 420.0,
      lower_bound: 3.72,
      upper_bound: 4.21,
      truth_value: 'UNKNOWN',
      status: 'REFINED',
      child_blocks: [
        {
          child_id: '41.0',
          parent_id: 41,
          frame_start: 41000,
          frame_end_exclusive: 41200,
          lower_bound: 4.1,
          upper_bound: 4.35,
          truth_value: 'FALSE',
          status: 'CERTIFIED_FALSE',
        },
      ],
    };

    const parsed = BlockLatticeItemSchema.parse(block41);
    expect(parsed.block_id).toBe(41);
    expect(parsed.lower_bound).toBe(3.72);
    expect(parsed.upper_bound).toBe(4.21);
    expect(parsed.child_blocks[0].child_id).toBe('41.0');
  });
});
