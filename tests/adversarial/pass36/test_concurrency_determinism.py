"""
PASS 36 — Section 24: Concurrency Determinism Suite.

Verifies that concurrent execution across multiple worker threads never alters
scientific results, truth values, bounds, or witness intervals.
"""

import concurrent.futures
import pytest
from backend.app.core.compiler_service import compiler_service


class TestConcurrencyDeterminism:
    """Rigorous proof of scientific determinism under concurrent execution."""

    def test_concurrent_query_execution_determinism(self):
        """
        Executes identical queries concurrently across 8 threads and verifies
        that all outputs are byte-for-byte or field-for-field identical.
        """
        query = "FIND (name CA) WITHIN 4.0A OF (name O2)"

        # 1. Baseline sequential execution
        baseline = compiler_service.execute(query)

        # 2. Concurrent execution with 8 workers
        results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
            futures = [executor.submit(compiler_service.execute, query) for _ in range(16)]
            for fut in concurrent.futures.as_completed(futures):
                results.append(fut.result())

        # 3. Assert strict determinism
        for idx, res in enumerate(results):
            assert res.truth_value == baseline.truth_value, f"Worker {idx} truth mismatch: {res.truth_value} vs {baseline.truth_value}"
            assert res.resolution_status == baseline.resolution_status, f"Worker {idx} resolution mismatch"
            assert res.blocks_examined == baseline.blocks_examined
            assert res.blocks_certified_true == baseline.blocks_certified_true
            assert res.blocks_certified_false == baseline.blocks_certified_false

            # Compare certificate block bounds (scientific deduction evidence)
            b_blocks = baseline.certificate["evidence"]["inspected_block_bounds"]
            r_blocks = res.certificate["evidence"]["inspected_block_bounds"]
            assert len(b_blocks) == len(r_blocks)
            for bb, rb in zip(b_blocks, r_blocks):
                assert bb["block_id"] == rb["block_id"]
                assert bb["lower_bound"] == rb["lower_bound"]
                assert bb["upper_bound"] == rb["upper_bound"]
                assert bb["truth_value"] == rb["truth_value"]
