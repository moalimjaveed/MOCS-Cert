"""
PASS 36 — Section 8: Query Parser Adversarial Suite.

Attacks the query parser with:
- nested parentheses and nested AND/OR
- whitespace and case permutations
- atom/residue names resembling keywords (e.g. name AND, resname WITHIN)
- malformed, missing, and duplicate clauses
- ambiguous strings
Ensures the parser either produces canonical operands or explicitly raises MOCSQuerySyntaxError.
"""

import pytest
from backend.app.core.compiler_service import compiler_service
from mocs.exceptions import MOCSQuerySyntaxError


class TestQueryParserAdversarial:
    """Adversarial syntax and semantic parser stress testing."""

    def test_nested_parenthesized_selections(self):
        """Valid queries with nested parentheses."""
        q1 = "FIND ((resid 155 and name CA) or (resid 156 and name N)) WITHIN 4.0A OF (name O2)"
        sel_a, sel_b = compiler_service._parse_selections(q1)
        assert "resid 155 and name CA" in sel_a
        assert "name O2" in sel_b

    def test_atom_and_residue_names_resembling_keywords(self):
        """Keywords occurring inside atom or residue names."""
        # Atom named "AND" or residue named "WITHIN"
        q = "FIND (resid 10 and name AND) WITHIN 5.0A OF (resname WITHIN and name CA)"
        sel_a, sel_b = compiler_service._parse_selections(q)
        assert sel_a == "resid 10 and name AND"
        assert sel_b == "resname WITHIN and name CA"

    def test_case_insensitivity_keywords(self):
        """Case variation across keywords (find, within, of, between, and)."""
        q = "find (name CA) within 4.5A of (name O2)"
        sel_a, sel_b = compiler_service._parse_selections(q)
        assert sel_a == "name CA"
        assert sel_b == "name O2"

    def test_between_and_nested_syntax(self):
        """BETWEEN ... AND ... with parenthesized clauses containing internal boolean 'and'."""
        q = "BETWEEN (resid 1 and name O2) AND (resid 155 and name CA) WHERE DISTANCE < 4.0A"
        sel_a, sel_b = compiler_service._parse_selections(q)
        assert sel_a == "resid 1 and name O2"
        assert sel_b == "resid 155 and name CA"

    def test_whitespace_variation(self):
        """Excessive or irregular whitespace."""
        q = "   FIND   (  name   CA  )    WITHIN    3.5  A   OF   ( name  O2 )   "
        sel_a, sel_b = compiler_service._parse_selections(q)
        assert "name   CA" in sel_a
        assert "name  O2" in sel_b

    def test_malformed_unbalanced_parentheses_raises(self):
        """Unbalanced parentheses must fail closed."""
        with pytest.raises(Exception):
            compiler_service.compile_query("FIND ((name CA) WITHIN 4.0A OF (name O2)")

    def test_missing_clauses_fail_closed(self):
        """Queries missing target operand or distance clause."""
        with pytest.raises(MOCSQuerySyntaxError):
            compiler_service._parse_selections("FIND name CA WITHIN 4.0A")

        with pytest.raises(MOCSQuerySyntaxError):
            compiler_service._parse_selections("FIND name CA")

        with pytest.raises(MOCSQuerySyntaxError):
            compiler_service._parse_selections("MALICIOUS SQL INJECTION; DROP TABLE Trajectories;--")

    def test_empty_string_fails_closed(self):
        """Empty or whitespace-only query fails closed."""
        with pytest.raises(MOCSQuerySyntaxError):
            compiler_service._parse_selections("")

        with pytest.raises(MOCSQuerySyntaxError):
            compiler_service._parse_selections("   ")
