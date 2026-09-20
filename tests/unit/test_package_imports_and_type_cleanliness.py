"""Regression Test Suite for Package Imports and Type Annotation Cleanliness.

Verifies:
1. Clean top-level package import: `import mocs`.
2. Independent module imports (e.g., `mocs.certificates.auditor`).
3. Annotation evaluation via `typing.get_type_hints()` and `inspect.get_annotations()`
   without raising `NameError` for deferred or unimported type symbols (Tuple, Any, PeriodicCell).
4. Independent backend application import: `import backend.app.main`.
"""

import inspect
import typing
import pytest


def test_clean_package_import():
    """Verify clean top-level import of mocs package."""
    import mocs
    assert hasattr(mocs, "__version__"), "mocs must define __version__"
    assert mocs.__version__ == "0.1.0"


def test_independent_auditor_import_and_annotations():
    """Verify independent import of mocs.certificates.auditor and type resolution of Tuple."""
    from mocs.certificates.auditor import diff_against_reference, verify_certificate, audit_data_provenance

    # Verify functions are callable and imported
    assert callable(diff_against_reference)
    assert callable(verify_certificate)
    assert callable(audit_data_provenance)

    # In Python 3.14+ (PEP 649) and typing.get_type_hints, annotations are evaluated.
    # This must not raise NameError: name 'Tuple' is not defined.
    hints = typing.get_type_hints(diff_against_reference)
    assert "return" in hints
    ret_hint = hints["return"]
    # Check that Tuple[bool, Optional[str]] is correctly evaluated
    origin = typing.get_origin(ret_hint)
    assert origin is tuple or origin is typing.Tuple
    args = typing.get_args(ret_hint)
    assert args[0] is bool

    # Also test inspect.get_annotations
    ann = inspect.get_annotations(diff_against_reference)
    assert "return" in ann


def test_periodic_cell_type_cleanliness():
    """Verify mocs.bounds.periodic_cell imports independently and resolves Any in annotations."""
    from mocs.bounds.periodic_cell import PeriodicCell

    assert callable(PeriodicCell.from_dimensions)
    hints = typing.get_type_hints(PeriodicCell.compute_kdop_bounds)
    assert "kdop_a" in hints
    assert hints["kdop_a"] is typing.Any


def test_workflow_provenance_type_cleanliness():
    """Verify mocs.workflow.provenance resolves Tuple without NameError."""
    from mocs.workflow.provenance import ProvenanceGraph, LineageReport

    hints = typing.get_type_hints(LineageReport)
    assert "target_artifact_id" in hints
    assert hints["target_artifact_id"] is str


def test_io_sources_type_cleanliness():
    """Verify mocs.io sources evaluate typing.get_type_hints with PeriodicCell resolved."""
    from mocs.io.source import TrajectorySource
    from mocs.io.synthetic_source import SyntheticTrajectorySource
    from mocs.io.mda_source import MDAnalysisTrajectorySource

    # Check TrajectorySource.get_cell returns PeriodicCell
    hints_get_cell = typing.get_type_hints(TrajectorySource.get_cell)
    from mocs.bounds.periodic_cell import PeriodicCell
    assert hints_get_cell["return"] is PeriodicCell

    hints_read_block = typing.get_type_hints(TrajectorySource.read_block_cells)
    assert typing.get_origin(hints_read_block["return"]) in (list, typing.List)


def test_backend_main_import():
    """Verify FastAPI backend application imports cleanly without cascading errors."""
    import backend.app.main
    assert hasattr(backend.app.main, "app")
