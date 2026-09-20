"""PASS 39 — Golden Query Corpus Automated Test Suite.

Rigorously verifies QUERY 001 through QUERY 012 against the canonical
FastAPI endpoint: POST /api/v1/query/execute.
"""

import os
import json
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)
CORPUS_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "query_corpus")

def load_corpus_fixture(filename: str):
    path = os.path.join(CORPUS_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

class TestGoldenQueryCorpus:
    """Automated verification of the 12 canonical golden queries."""

    def test_query_001_single_atom_distance(self):
        fixture = load_corpus_fixture("query_001_single_atom_distance.json")
        payload = {"query_text": fixture["query_text"], **fixture["request_params"]}
        res = client.post("/api/v1/query/execute", json=payload)
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["truth_value"] == fixture["expected"]["truth_value"]
        assert data["resolution_status"] == fixture["expected"]["resolution_status"]
        assert data["quantifier"] == fixture["expected"]["quantifier"]
        assert data["blocks_examined"] == fixture["expected"]["blocks_examined"]
        assert data["certified_blocks"] >= fixture["expected"]["certified_blocks_min"]
        assert data["refined_blocks"] >= fixture["expected"]["refined_blocks_min"]
        assert len(data["plan_steps"]) == 9
        assert data["execution_id"].startswith("exec_")

    def test_query_002_multi_atom_distance(self):
        fixture = load_corpus_fixture("query_002_multi_atom_distance.json")
        payload = {"query_text": fixture["query_text"], **fixture["request_params"]}
        res = client.post("/api/v1/query/execute", json=payload)
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["truth_value"] == fixture["expected"]["truth_value"]
        assert data["atoms_analyzed"] == fixture["expected"]["atoms_analyzed"]
        assert data["blocks_examined"] == fixture["expected"]["blocks_examined"]

    def test_query_003_existential(self):
        fixture = load_corpus_fixture("query_003_existential.json")
        payload = {"query_text": fixture["query_text"], **fixture["request_params"]}
        res = client.post("/api/v1/query/execute", json=payload)
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["truth_value"] == fixture["expected"]["truth_value"]
        assert data["quantifier"] == "EXISTS"
        assert len(data["witness_intervals"]) > 0

    def test_query_004_universal(self):
        fixture = load_corpus_fixture("query_004_universal.json")
        payload = {"query_text": fixture["query_text"], **fixture["request_params"]}
        res = client.post("/api/v1/query/execute", json=payload)
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["truth_value"] == fixture["expected"]["truth_value"]
        assert data["quantifier"] == "FORALL"
        assert data["certified_blocks"] == fixture["expected"]["certified_blocks"]

    def test_query_005_threshold_boundary(self):
        fixture = load_corpus_fixture("query_005_threshold_boundary.json")
        payload = {"query_text": fixture["query_text"], **fixture["request_params"]}
        res = client.post("/api/v1/query/execute", json=payload)
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["truth_value"] == fixture["expected"]["truth_value"]
        assert data["blocks_examined"] == fixture["expected"]["blocks_examined"]

    def test_query_006_unknown_refinement(self):
        fixture = load_corpus_fixture("query_006_unknown_refinement.json")
        payload = {"query_text": fixture["query_text"], **fixture["request_params"]}
        res = client.post("/api/v1/query/execute", json=payload)
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["truth_value"] == fixture["expected"]["truth_value"]
        assert data["refined_blocks"] >= fixture["expected"]["refined_blocks_min"]
        assert data["exact_frames_scanned"] >= fixture["expected"]["exact_frames_scanned_min"]

    def test_query_007_false_pruning(self):
        fixture = load_corpus_fixture("query_007_false_pruning.json")
        payload = {"query_text": fixture["query_text"], **fixture["request_params"]}
        res = client.post("/api/v1/query/execute", json=payload)
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["truth_value"] == fixture["expected"]["truth_value"]
        assert data["pruning_efficiency"] == fixture["expected"]["pruning_efficiency"]
        assert data["blocks_certified_false"] == fixture["expected"]["blocks_certified_false"]
        assert data["refined_blocks"] == 0
        assert data["exact_frames_scanned"] == 0

    def test_query_008_true_witness(self):
        fixture = load_corpus_fixture("query_008_true_witness.json")
        payload = {"query_text": fixture["query_text"], **fixture["request_params"]}
        res = client.post("/api/v1/query/execute", json=payload)
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["truth_value"] == fixture["expected"]["truth_value"]
        assert data["pruning_efficiency"] == fixture["expected"]["pruning_efficiency"]
        assert data["blocks_certified_true"] == fixture["expected"]["blocks_certified_true"]
        assert data["refined_blocks"] == 0
        assert data["exact_frames_scanned"] == 0

    def test_query_009_invalid_selection(self):
        fixture = load_corpus_fixture("query_009_invalid_selection.json")
        payload = {"query_text": fixture["query_text"], **fixture["request_params"]}
        res = client.post("/api/v1/query/execute", json=payload)
        assert res.status_code == fixture["expected"]["http_status"]
        data = res.json()
        assert data["error_code"] == fixture["expected"]["error_code"]
        assert data["location"] == fixture["expected"]["location"]
        assert "action" in data

    def test_query_010_unsupported_geometry(self):
        fixture = load_corpus_fixture("query_010_unsupported_geometry.json")
        payload = {"query_text": fixture["query_text"], **fixture["request_params"]}
        res = client.post("/api/v1/query/execute", json=payload)
        assert res.status_code == fixture["expected"]["http_status"]
        data = res.json()
        assert data["error_code"] == fixture["expected"]["error_code"]
        assert data["location"] == fixture["expected"]["location"]
        assert "action" in data

    def test_query_011_unsupported_temporal(self):
        fixture = load_corpus_fixture("query_011_unsupported_temporal.json")
        payload = {"query_text": fixture["query_text"], **fixture["request_params"]}
        res = client.post("/api/v1/query/execute", json=payload)
        assert res.status_code == fixture["expected"]["http_status"]
        data = res.json()
        assert data["truth_value"] == fixture["expected"]["truth_value"]
        assert data["resolution_status"] == fixture["expected"]["resolution_status"]

    def test_query_012_malformed_syntax(self):
        fixture = load_corpus_fixture("query_012_malformed_syntax.json")
        payload = {"query_text": fixture["query_text"], **fixture["request_params"]}
        res = client.post("/api/v1/query/execute", json=payload)
        assert res.status_code == fixture["expected"]["http_status"]
        data = res.json()
        assert data["error_code"] == fixture["expected"]["error_code"]
        assert data["location"] == fixture["expected"]["location"]
