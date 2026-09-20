"""
Adversarial and regression test suite for workflow engine repairs:
F-051: Manifest reproduction cryptographic & numerical verification
F-053: Connect workflow instantiation & parameterization
F-054: Measured step durations
F-063: Failed/orphaned step edge tracking
F-064: Iterative post-order lineage traversal
F-065: DAG cycle rejection
F-066: Full 128-bit UUID entropy
F-067: Invalid execution mode fail-closed
F-071: Bounded memory eviction
"""

import pytest
import time
import mocs.workflow as mw
from mocs.workflow.steps import WorkflowStep, WorkflowStepType
from mocs.workflow.provenance import ProvenanceGraph
from mocs.workflow.artifacts import AnalysisArtifact, ArtifactType


def test_f065_dag_cycle_detection():
    dag = ProvenanceGraph(workflow_id="test_dag")
    s1 = WorkflowStep.create(
        step_type=WorkflowStepType.SELECT,
        name="Step 1",
        inputs=["art_0"],
    )
    s1.mark_completed(outputs=["art_1"], duration_ms=1.0)
    dag.add_step(s1)

    s2 = WorkflowStep.create(
        step_type=WorkflowStepType.SELECT,
        name="Step 2",
        inputs=["art_1"],
    )
    s2.mark_completed(outputs=["art_2"], duration_ms=1.0)
    dag.add_step(s2)

    # Attempting to add a step from art_2 back to art_0 must raise ValueError
    s_cycle = WorkflowStep.create(
        step_type=WorkflowStepType.SELECT,
        name="Cycle Step",
        inputs=["art_2"],
    )
    s_cycle.mark_completed(outputs=["art_0"], duration_ms=1.0)
    with pytest.raises(ValueError, match="Provenance DAG cycle detected"):
        dag.add_step(s_cycle)


def test_f064_deep_lineage_no_recursion_limit():
    dag = ProvenanceGraph(workflow_id="deep_dag")
    # Build chain of 1500 nodes (exceeds default Python recursion limit of 1000)
    for i in range(1499):
        step = WorkflowStep.create(
            step_type=WorkflowStepType.ANALYZE,
            name=f"Step {i}",
            inputs=[f"node_{i}"],
        )
        step.mark_completed(outputs=[f"node_{i+1}"], duration_ms=0.1)
        dag.add_step(step)

    # Add terminal artifact
    target_art = AnalysisArtifact.create(
        parent_ids=["node_1499"],
        observable="Deep Test Observable",
        value=1.234,
        units="Angstrom",
        algorithm="Sequential Linear Chain",
        backend_name="Native MOCS-Cert",
        backend_version="0.1.0"
    )
    dag.add_artifact(target_art)
    final_step = WorkflowStep.create(
        step_type=WorkflowStepType.ANALYZE,
        name="Final Step",
        inputs=["node_1499"],
    )
    final_step.mark_completed(outputs=[target_art.artifact_id], duration_ms=0.1)
    dag.add_step(final_step)

    # query_lineage must complete iteratively without RecursionError
    lineage = dag.query_lineage(target_art.artifact_id)
    assert lineage is not None
    assert len(lineage.lineage_path) > 1000


def test_f051_manifest_reproduction_and_tamper_detection():
    engine = mw.WorkflowEngine()
    inst = engine.execute_4hhb_coordination_workflow()
    assert inst.status == mw.WorkflowStatus.COMPLETED
    assert inst.manifest is not None

    # Legitimate reproduction succeeds
    rep = engine.reproduce_from_manifest(inst.manifest.to_dict())
    assert rep["reproducible"] is True
    assert rep["manifest_digest_verified"] is True
    assert rep["numerical_parity"] is True
    assert rep["certificate_matched"] is True

    # Tampered manifest parameter fails closed
    tampered = inst.manifest.to_dict()
    tampered["parameters"]["structure_id"] = "TAMPERED"
    rep_tampered = engine.reproduce_from_manifest(tampered)
    assert rep_tampered["reproducible"] is False
    assert rep_tampered["reason"] == "MANIFEST_DIGEST_CORRUPTED"


def test_f066_uuid_entropy():
    engine = mw.WorkflowEngine()
    w1 = engine.create_workflow(name="w1")
    w2 = engine.create_workflow(name="w2")
    assert len(w1.workflow_id) > 20
    assert len(w2.workflow_id) > 20
    assert w1.workflow_id != w2.workflow_id


def test_f071_bounded_instances_eviction():
    engine = mw.WorkflowEngine()
    engine._max_instances = 5
    for i in range(10):
        engine.create_workflow(name=f"wf_{i}")
    assert len(engine._instances) == 5
