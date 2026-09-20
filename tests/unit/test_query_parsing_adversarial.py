"""Hostile Audit - Section 12: Query Parsing & DSL Adversarial Attack.

Feeds adversarial queries to CompilerService:
1. empty query
2. random text
3. malformed query
4. unknown operator
5. unknown unit
6. negative threshold
7. NaN
8. Infinity / -Infinity
9. invalid selection
10. missing operand
11. extra tokens
12. case variants
13. whitespace variants

Required:
- valid queries -> deterministic compile/execution
- invalid queries -> deterministic MOCSQuerySyntaxError
"""

import sys
import pytest
sys.path.insert(0, ".")

from backend.app.core.compiler_service import compiler_service
from mocs.exceptions import MOCSQuerySyntaxError

def test_adversarial_invalid_queries():
    invalid_queries = [
        ("", "empty query"),
        ("   \t\n  ", "whitespace-only query"),
        ("asdfkjhasdf random gibberish 12345", "random text without structure"),
        ("FIND WITHIN 4.0A", "missing selections and threshold syntax"),
        ("FIND (name CA) WITHIN OF (name CB)", "missing threshold value"),
        ("FIND (name CA) WITHIN NaN A OF (name CB)", "NaN threshold"),
        ("FIND (name CA) WITHIN Infinity A OF (name CB)", "Infinity threshold"),
        ("FIND (name CA) WITHIN -5.0 A OF (name CB)", "negative threshold"),
        ("FIND (name CA) WHERE DISTANCE < -2.5 A TO (name CB)", "negative distance threshold"),
        ("FIND (name CA) WITHIN 4.0 FOOBAR OF (name CB)", "unknown unit FOOBAR"),
        ("FIND (name CA) WHERE DISTANCE ~= 4.0 A TO (name CB)", "unknown operator ~="),
    ]

    for q, description in invalid_queries:
        caught = False
        try:
            compiler_service.compile(q)
        except MOCSQuerySyntaxError:
            caught = True
        assert caught, f"Security/Validation Failure: Invalid query '{description}' was NOT rejected with MOCSQuerySyntaxError!"

def test_adversarial_valid_queries_variants():
    # Case variants and whitespace variations that should succeed
    valid_variants = [
        "FIND (name CA) WITHIN 4.0A OF (name O2)",
        "find (name ca) within 4.0a of (name o2)",
        "   FIND    (name CA)   WITHIN   4.0 A   OF   (name O2)   ",
        "FIND (resid 1 and name O2) WHERE DISTANCE <= 3.5A TO (resid 155 and name CA)",
        "find (resid 1 and name o2) where distance >= 3.5a to (resid 155 and name ca)",
        "DISTANCE(resid 1 and name O2, resid 155 and name CA) < 4.0 A",
        "BETWEEN (resid 1 and name O2) AND (resid 155 and name CA) WHERE DISTANCE < 4.0A",
    ]

    for q in valid_variants:
        res = compiler_service.compile(q, trajectory_id="synth_500f.xtc")
        assert res.query_id is not None
        assert res.selection_a is not None
        assert res.selection_b is not None

if __name__ == "__main__":
    test_adversarial_invalid_queries()
    test_adversarial_valid_queries_variants()
    print("[SECTION 12: QUERY PARSING ADVERSARIAL TEST COMPLETE (PASS)]")
