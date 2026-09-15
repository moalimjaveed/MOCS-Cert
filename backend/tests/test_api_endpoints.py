from fastapi.testclient import TestClient
from backend.app.main import app
import pytest

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["version"] == "0.1.0"
    assert "array_backend" in data
    assert "active_accelerator" in data

def test_trajectories_metadata():
    response = client.get("/api/v1/trajectories")
    assert response.status_code == 200
    data = response.json()
    assert "trajectory_id" in data
    assert data["total_frames"] > 0
    assert data["atom_count"] > 0
    assert data["time_span_ns"] > 0
    assert data["pbc_mode"] == "orthorhombic_minimum_image"
    assert data["sampling_semantics"] == "sampled_frames"

def test_trajectories_blocks():
    response = client.get("/api/v1/trajectories/blocks")
    assert response.status_code == 200
    blocks = response.json()
    assert len(blocks) > 0
    # Invariant: Every block must have valid bounds where lower <= upper
    for b in blocks:
        assert "block_id" in b
        assert "lower_bound" in b
        assert "upper_bound" in b
        assert b["lower_bound"] <= b["upper_bound"] + 1e-7

def test_get_single_block():
    response = client.get("/api/v1/trajectories/blocks/41")
    assert response.status_code == 200
    b41 = response.json()
    assert b41["block_id"] == 41
    assert "truth_value" in b41
    assert "status" in b41
    assert b41["lower_bound"] <= b41["upper_bound"]

def test_get_nonexistent_block():
    response = client.get("/api/v1/trajectories/blocks/9999")
    assert response.status_code == 404

def test_query_compile():
    query_dsl = "FIND (RES :LIG AND ATOM :O2) WITHIN 4.0A OF (RES :ALA AND ATOM :CA) WHERE DURATION >= 5ns"
    payload = {
        "query_text": query_dsl
    }
    response = client.post("/api/v1/query/compile", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "query_id" in data
    assert len(data["plan_steps"]) == 9
    assert data["plan_steps"][0]["name"] == "SCIENTIFIC QUERY"
    assert data["plan_steps"][0]["status"] == "completed"

def test_query_execute():
    query_dsl = "FIND (name CA) WITHIN 4.0 A OF (name O2)"
    payload = {
        "query_text": query_dsl
    }
    response = client.post("/api/v1/query/execute", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "query_id" in data
    assert data["blocks_examined"] > 0
    assert data["certified_blocks"] + data["refined_blocks"] == data["blocks_examined"]
    assert data["resolution_status"] == "COMPLETE"
    assert "certificate" in data
    assert data["certificate_id"].startswith("mocs://cert")

def test_query_missing_selections_fails_closed():
    # P0-3: Queries without explicit selections must fail closed
    payload = {"query_text": "FIND DISTANCE < 4.0 A"}
    response = client.post("/api/v1/query/execute", json=payload)
    assert response.status_code == 400

def test_refine_block():
    payload = {
        "block_id": 41,
        "subdivision_factor": 2
    }
    response = client.post("/api/v1/refine/block", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["parent_block_id"] == 41
    assert len(data["child_blocks"]) > 0
    assert data["monotonic_non_expansion_verified"] is True
    # Verify monotonic non-expansion for every child block against parent bounds
    pL = data["parent_bounds"]["L"]
    pU = data["parent_bounds"]["U"]
    for ch in data["child_blocks"]:
        assert ch["lower_bound"] >= pL - 1e-7, f"Child lower bound {ch['lower_bound']} < parent {pL}"
        assert ch["upper_bound"] <= pU + 1e-7, f"Child upper bound {ch['upper_bound']} > parent {pU}"

def test_certificate_verify():
    exec_res = client.post("/api/v1/query/execute", json={"query_text": "FIND (name CA) WITHIN 4.0 A OF (name O2)"})
    cert = exec_res.json()["certificate"]

    verify_payload = {
        "certificate": cert,
        "verify_hashes": True
    }
    response = client.post("/api/v1/certificates/verify", json=verify_payload)
    assert response.status_code == 200
    vdata = response.json()
    assert vdata["is_valid"] is True
    assert vdata["source_commitment_verified"] is True
    assert vdata["mci_commitment_verified"] is True
    assert vdata["semantics_verified"] is True
    assert vdata["evidence_consistent"] is True

def test_benchmarks():
    response = client.get("/api/v1/benchmarks?query_id=q1")
    assert response.status_code == 200
    bdata = response.json()
    assert len(bdata["baselines"]) == 4
    names = [b["name"] for b in bdata["baselines"]]
    assert "MDAnalysis" in names
    assert "MDTraj" in names
    assert "pytraj" in names
    assert "MOCS-Cert" in names

def test_websocket_query_stream():
    with client.websocket_connect("/ws/query") as websocket:
        # Test ping/pong
        websocket.send_json({"action": "ping"})
        msg = websocket.receive_json()
        assert msg["type"] == "pong"

        # Test block refinement stream
        websocket.send_json({"action": "refine_block", "block_id": 41})
        msg_refine = websocket.receive_json()
        assert msg_refine["type"] == "block_refined"
        assert msg_refine["data"]["parent_block_id"] == 41
