"""Tests for molecular structure resolution and retrieval endpoints."""

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_molecular_structure_rcsb_metadata():
    """Verify RCSB PDB metadata resolution with valid 4-character PDB ID."""
    response = client.get("/api/v1/molecular/structure?source=rcsb&pdbId=4HHB&metaOnly=true")
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "rcsb"
    assert data["provider"] == "RCSB PDB"
    assert data["model_id"] == "4HHB"
    assert data["experimental"] is True
    assert "https://models.rcsb.org/4HHB.bcif" in data["source_url"]

def test_molecular_structure_rcsb_case_normalization():
    """Verify lowercase PDB ID is normalized to uppercase."""
    response = client.get("/api/v1/molecular/structure?source=rcsb&pdbId=4hhb&format=cif&metaOnly=true")
    assert response.status_code == 200
    data = response.json()
    assert data["model_id"] == "4HHB"
    assert "https://files.rcsb.org/download/4HHB.cif" in data["source_url"]

def test_molecular_structure_alphafold_metadata():
    """Verify AlphaFold DB metadata resolution with valid UniProt accession."""
    response = client.get("/api/v1/molecular/structure?source=alphafold&uniprotId=P69905&metaOnly=true")
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "alphafold"
    assert data["provider"] == "AlphaFold DB"
    assert data["model_id"] == "AF-P69905-F1"
    assert data["experimental"] is False
    assert "https://alphafold.ebi.ac.uk/files/AF-P69905-F1-model_v4.cif" in data["source_url"]

def test_molecular_structure_invalid_pdb_id():
    """Verify invalid PDB IDs are strictly rejected."""
    # Too short
    res_short = client.get("/api/v1/molecular/structure?source=rcsb&pdbId=4H&metaOnly=true")
    assert res_short.status_code == 400

    # Too long
    res_long = client.get("/api/v1/molecular/structure?source=rcsb&pdbId=4HHB12&metaOnly=true")
    assert res_long.status_code == 400

    # Malicious injection attempt
    res_inj = client.get("/api/v1/molecular/structure?source=rcsb&pdbId=../../etc/passwd&metaOnly=true")
    assert res_inj.status_code == 400

def test_molecular_structure_invalid_source():
    """Verify unsupported sources are rejected."""
    res = client.get("/api/v1/molecular/structure?source=invalid&metaOnly=true")
    assert res.status_code == 422 or res.status_code == 400

def test_molecular_structure_alias_route():
    """Verify /api/molecular/structure alias is reachable."""
    res = client.get("/api/molecular/structure?source=rcsb&pdbId=1STP&metaOnly=true")
    assert res.status_code == 200
    data = res.json()
    assert data["model_id"] == "1STP"
    assert data["experimental"] is True

def test_molecular_structure_model_archive_metadata():
    """Verify ModelArchive metadata resolution and ID validation."""
    # Valid ModelArchive ID
    res = client.get("/api/v1/molecular/structure?source=model_archive&pdbId=ma-bak-ce-0001&metaOnly=true")
    assert res.status_code == 200
    data = res.json()
    assert data["source"] == "model_archive"
    assert data["model_id"] == "ma-bak-ce-0001"
    assert "https://www.modelarchive.org/api/projects/ma-bak-ce-0001?format=cif" in data["source_url"]

    # Invalid ModelArchive ID
    res_bad = client.get("/api/v1/molecular/structure?source=model_archive&pdbId=INVALID_MA_ID!&metaOnly=true")
    assert res_bad.status_code == 400

def test_molecular_structure_assembly():
    """Verify biological assembly URL generation for RCSB."""
    res = client.get("/api/v1/molecular/structure?source=rcsb&pdbId=4HHB&assemblyId=2&format=bcif&metaOnly=true")
    assert res.status_code == 200
    data = res.json()
    assert "https://models.rcsb.org/v1/4HHB/assembly?assembly_id=2" in data["source_url"]

def test_molecular_structure_local_jailed():
    """Verify local source loading respects DATA_ROOT sandboxing."""
    # Traversal attempt
    res_trav = client.get("/api/v1/molecular/structure?source=local&pdbId=../../etc/shadow&metaOnly=true")
    assert res_trav.status_code == 400

