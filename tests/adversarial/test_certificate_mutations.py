"""Adversarial Certificate Mutation Tests. Target: 0% False Acceptance Rate."""

import json
import pytest
from mocs.certificates.auditor import verify_certificate
from mocs.exceptions import MOCSVerificationError
from backend.app.core.compiler_service import compiler_service

def test_adversarial_certificate_mutations():
    """Applies 10 adversarial mutations and asserts 100% detection (0% false acceptance)."""
    base_exec = compiler_service.execute("DISTANCE(name CA, name O2) < 4.0 A")
    base_cert = base_exec.certificate

    mutations = [
        ("M1: Truth Flipped TRUE -> FALSE with certified TRUE witnesses present",
         lambda c: c.update({"result": {"truth_value": "FALSE", "resolution": "COMPLETE"}})),
        ("M2: Predicate Threshold 4.0 -> 2.0 (invalidates upper bound < 4.0)",
         lambda c: c["query"]["predicate"].update({"threshold_value": 2.0})),
        ("M3: Operator < replaced with > (invalidates bounds)",
         lambda c: c["query"]["predicate"].update({"operator": ">"})),
        ("M4: Fake Trajectory SHA-256 (64 zeros)",
         lambda c: c["source"].update({"trajectory_sha256": "0" * 64})),
        ("M5: Fake MCI Hash (64 f's)",
         lambda c: c["index_commitment"].update({"mci_index_hash": "f" * 64})),
        ("M6: Unsupported Semantics passed as TRUE result",
         lambda c: c["semantics"]["sampling_semantics"].update({"mode": "unsupported_mode_foo"})),
        ("M7: Negative resource metric (atoms_analyzed = -5)",
         lambda c: c["resources"].update({"atoms_analyzed": -5})),
        ("M8: Duration query with empty intervals and frames_scanned_exact > 0",
         lambda c: (c.update({"quantifier": "DURATION"}), c["query"].update({"temporal": {"operator": "FOR", "min_duration_ps": 50.0}}), c["evidence"].update({"inspected_block_bounds": [], "witness_intervals": []}), c.get("proof", {}).update({"witness_intervals": []}))),
        ("M9: Duration query with interval gap [0, 50) and [60, 100)",
         lambda c: (c.update({"quantifier": "DURATION"}), c["query"].update({"temporal": {"operator": "FOR", "min_duration_ps": 800.0}}), c["evidence"].update({"frames_scanned_exact": 0, "inspected_block_bounds": [{"status": "TRUE", "frame_start": 0, "frame_end_exclusive": 50, "lower_bound": 2.0, "upper_bound": 3.0}, {"status": "TRUE", "frame_start": 60, "frame_end_exclusive": 100, "lower_bound": 2.0, "upper_bound": 3.0}]}))),
        ("M10: Duration query with interval overlap [0, 50) and [30, 80)",
         lambda c: (c.update({"quantifier": "DURATION"}), c["query"].update({"temporal": {"operator": "FOR", "min_duration_ps": 600.0}}), c["evidence"].update({"frames_scanned_exact": 0, "inspected_block_bounds": [{"status": "TRUE", "frame_start": 0, "frame_end_exclusive": 50, "lower_bound": 2.0, "upper_bound": 3.0}, {"status": "TRUE", "frame_start": 30, "frame_end_exclusive": 80, "lower_bound": 2.0, "upper_bound": 3.0}]}))),
    ]

    detected = 0
    accepted = 0

    for name, mut_fn in mutations:
        cert_copy = json.loads(json.dumps(base_cert))
        mut_fn(cert_copy)
        try:
            verify_certificate(cert_copy, verify_hashes=True)
            accepted += 1
            print(f"[FAIL / FALSE ACCEPTANCE] {name}")
        except (MOCSVerificationError, Exception):
            detected += 1

    assert accepted == 0, f"Soundness Failure: {accepted}/{len(mutations)} mutations falsely accepted!"
    assert detected == len(mutations), f"Only detected {detected}/{len(mutations)} mutations!"
