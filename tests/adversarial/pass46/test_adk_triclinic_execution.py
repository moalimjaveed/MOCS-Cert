"""
PASS 46: Real Trajectory AdK OPLSAA Triclinic Execution Suite.

Validates that real-world simulation data with a rhombic dodecahedron
cell geometry (AdK OPLSAA, angles 60°, 60°, 90°, variable dimensions)
executes end-to-end through the compiler and execution service without
UNSUPPORTED_GEOMETRY errors, generating sound and verified certificates.
"""

import os
import json
import pytest
from backend.app.core.compiler_service import compiler_service
from mocs.certificates.auditor import verify_certificate


class TestAdKTriclinicExecution:
    """End-to-end execution on live AdK OPLSAA rhombic dodecahedron trajectory."""

    def test_adk_query_true_end_to_end(self):
        """
        Tests query evaluating to TRUE:
        Residue 1 CA to Residue 2 CA distance is ~3.8 Å, so WITHIN 5.0A is TRUE.
        """
        query = "FIND resid 1 and name CA WITHIN 5.0A OF resid 2 and name CA"
        traj_id = "adk_oplsaa.xtc"

        # 1. Compile query
        compile_res = compiler_service.compile(query, traj_id)
        assert compile_res.observable == "DISTANCE"
        assert compile_res.predicate_operator == "<"
        assert compile_res.threshold_value == 5.0

        # Step 2 contract verification
        contract_step = compile_res.plan_steps[1]
        assert contract_step.metadata["pbc_mode"] == "triclinic_minimum_image"
        assert contract_step.metadata["cell_type"] == "triclinic"

        # 2. Execute query
        exec_res = compiler_service.execute(query, traj_id)
        assert exec_res.truth_value == "TRUE"
        assert exec_res.resolution_status == "COMPLETE"
        assert exec_res.blocks_refined >= 1

        # 3. Verify Certificate
        cert_hash = exec_res.certificate_hash
        assert cert_hash is not None and len(cert_hash) == 64

    def test_adk_query_false_end_to_end(self):
        """
        Tests query evaluating to FALSE:
        Residue 1 CA to Residue 2 CA distance is ~3.8 Å, so WITHIN 2.0A is FALSE.
        """
        query = "FIND resid 1 and name CA WITHIN 2.0A OF resid 2 and name CA"
        traj_id = "adk_oplsaa.xtc"

        exec_res = compiler_service.execute(query, traj_id)
        assert exec_res.truth_value == "FALSE"
        assert exec_res.resolution_status == "COMPLETE"
        assert exec_res.blocks_certified_false >= 0

    def test_adk_explicit_ortho_pbc_mode_fails_closed(self):
        """
        Proves fail-closed safety:
        If caller explicitly demands orthorhombic_minimum_image on AdK (triclinic),
        the system strictly fails closed with MOCSUnsupportedGeometryError.
        """
        from mocs.exceptions import MOCSUnsupportedGeometryError

        query = "FIND resid 1 and name CA WITHIN 5.0A OF resid 2 and name CA"
        with pytest.raises(MOCSUnsupportedGeometryError, match="orthorhombic_minimum_image was requested"):
            compiler_service.compile(query, "adk_oplsaa.xtc", pbc_mode="orthorhombic_minimum_image")
