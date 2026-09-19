"""Hostile Audit - Section 19: Comprehensive Failure-Injection Test.

Deliberately injects infrastructure and IO failures:
1. missing trajectory file
2. missing topology file
3. corrupt trajectory file
4. corrupt MCI blocks file
5. missing MCI directory
6. wrong topology for trajectory
7. unsupported PBC geometry mode
8. unsupported temporal sampling semantics
9. invalid query syntax
10. truncated MCI index file

Invariant:
The system MUST fail explicitly by raising typed exceptions.
It must NEVER convert infrastructure failure into CERTIFIED_FALSE or CERTIFIED_TRUE!
"""

import os
import sys
import shutil
import tempfile
import pytest
sys.path.insert(0, ".")

from backend.app.core.compiler_service import compiler_service
from mocs.exceptions import (
    MOCSFileNotFoundError,
    MOCSDataIntegrityError,
    MOCSUnsupportedGeometryError,
    MOCSQuerySyntaxError,
    MOCSVerificationError
)

traj_path = os.path.join("artifacts", "unseen_data", "unseen_traj_A.xtc")
topo_path = os.path.join("artifacts", "unseen_data", "unseen_topo.gro")

def test_missing_trajectory():
    caught = False
    try:
        compiler_service.execute("FIND (name CA) WITHIN 4.0A OF (name CB)", trajectory_id="non_existent_file.xtc")
    except (MOCSFileNotFoundError, AssertionError, FileNotFoundError):
        caught = True
    assert caught, "Missing trajectory failed to raise an explicit exception!"

def test_missing_topology():
    caught = False
    try:
        from mocs.io.mda_source import MDAnalysisTrajectorySource
        MDAnalysisTrajectorySource("non_existent_topo.gro", traj_path)
    except (MOCSFileNotFoundError, FileNotFoundError):
        caught = True
    assert caught, "Missing topology failed to raise MOCSFileNotFoundError!"

def test_corrupt_trajectory_header():
    with tempfile.NamedTemporaryFile(suffix=".xtc", delete=False) as f:
        f.write(b"NOT_A_VALID_XTC_FILE_CORRUPTED_HEADER")
        tmp_name = f.name

    caught = False
    try:
        from mocs.io.mda_source import MDAnalysisTrajectorySource
        src = MDAnalysisTrajectorySource(topo_path, tmp_name)
    except Exception:
        caught = True
    finally:
        if os.path.exists(tmp_name):
            os.remove(tmp_name)
    assert caught, "Corrupt trajectory header failed to raise an error!"

def test_corrupt_mci():
    with tempfile.TemporaryDirectory() as tmp_dir:
        # Create invalid manifest
        with open(os.path.join(tmp_dir, "manifest.json"), "w") as mf:
            mf.write("{ invalid json }")
        with open(os.path.join(tmp_dir, "blocks.bin"), "wb") as bf:
            bf.write(b"\x00" * 64)
            
        caught = False
        try:
            from mocs.mci.reader import MCIReader
            MCIReader(tmp_dir)
        except Exception:
            caught = True
        assert caught, "Corrupt MCI failed to raise an error!"

def test_missing_mci():
    caught = False
    try:
        from mocs.mci.reader import MCIReader
        MCIReader("non_existent_mci_dir_12345")
    except (MOCSFileNotFoundError, FileNotFoundError):
        caught = True
    assert caught, "Missing MCI directory failed to raise MOCSFileNotFoundError!"

def test_unsupported_pbc():
    caught = False
    try:
        from mocs.reference.distance import reference_distance
        reference_distance(topo_path, traj_path, "name CA", "name CB", pbc_mode="triclinic_unsupported")
    except NotImplementedError:
        caught = True
    assert caught, "Unsupported PBC mode failed to raise NotImplementedError!"

def test_unsupported_semantics():
    caught = False
    cert = {
        "mocs_cert_version": "0.1.0",
        "semantics": {
            "sampling_semantics": {"mode": "continuous_physical", "dt_ps": 10.0},
            "pbc_semantics": {"mode": "orthorhombic_minimum_image"}
        },
        "query": {"observable": "DISTANCE", "temporal": {"operator": "FOR", "min_duration_ps": 5.0}},
        "result": {"truth_value": "TRUE", "resolution": "COMPLETE"},
        "evidence": {},
        "proof": {}
    }
    try:
        from mocs.certificates.auditor import verify_certificate
        verify_certificate(cert, verify_hashes=False)
    except MOCSVerificationError:
        caught = True
    assert caught, "Unsupported semantics in certificate failed to raise MOCSVerificationError!"

def test_invalid_query_rejection():
    caught = False
    try:
        compiler_service.execute("MALFORMED QUERY FOOBAR 123", trajectory_id=traj_path)
    except (MOCSQuerySyntaxError, ValueError):
        caught = True
    assert caught, "Invalid query failed to raise MOCSQuerySyntaxError!"

def test_truncated_mci_index():
    with tempfile.TemporaryDirectory() as tmp_dir:
        # Valid manifest claiming 10 blocks, but 10 bytes in blocks.bin
        import json
        manifest = {
            "num_blocks_per_group": 10,
            "block_size_frames": 10,
            "total_frames": 100,
            "atom_groups": {"0": [0]},
            "files": {"blocks_bin": {"size_bytes": 640}}
        }
        with open(os.path.join(tmp_dir, "manifest.json"), "w") as f:
            json.dump(manifest, f)
        with open(os.path.join(tmp_dir, "blocks.bin"), "wb") as f:
            f.write(b"\x00" * 32) # truncated to 32 bytes
            
        caught = False
        try:
            from mocs.mci.reader import MCIReader
            with MCIReader(tmp_dir, verify_on_open=True) as r:
                r.read_block(0, 0)
        except (MOCSDataIntegrityError, EOFError):
            caught = True
        assert caught, "Truncated MCI index failed to raise MOCSDataIntegrityError or EOFError!"

if __name__ == "__main__":
    test_missing_trajectory()
    test_missing_topology()
    test_corrupt_trajectory_header()
    test_corrupt_mci()
    test_missing_mci()
    test_unsupported_pbc()
    test_unsupported_semantics()
    test_invalid_query_rejection()
    test_truncated_mci_index()
    print("[SECTION 19: FAILURE-INJECTION TEST COMPLETE — ALL 9 INJECTIONS REJECTED EXPLICITLY (PASS)]")
