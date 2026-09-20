"""
mocs.workflow.steps — Workflow Step Abstraction and Lifecycle Status.

Defines the 11-stage pipeline step abstraction and execution states for
reproducible scientific workflows.
"""

from __future__ import annotations
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Any, List, Optional
import uuid

from .artifacts import compute_hash


class WorkflowStepType(str, Enum):
    SOURCE = "SOURCE"
    INGEST = "INGEST"
    VALIDATE = "VALIDATE"
    NORMALIZE = "NORMALIZE"
    SELECT = "SELECT"
    TRANSFORM = "TRANSFORM"
    ANALYZE = "ANALYZE"
    CROSS_CHECK = "CROSS_CHECK"
    VISUALIZE = "VISUALIZE"
    CERTIFY = "CERTIFY"
    EXPORT = "EXPORT"


class WorkflowStepStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    PARTIAL = "PARTIAL"
    INVALID = "INVALID"


@dataclass
class WorkflowStep:
    """
    Typed, auditable unit of execution in a scientific workflow graph.
    Every step is reproducible from declared inputs, parameters, and seeds.
    """
    step_id: str
    step_type: WorkflowStepType
    name: str
    inputs: List[str]  # parent artifact IDs
    outputs: List[str] = field(default_factory=list)  # generated artifact IDs
    parameters: Dict[str, Any] = field(default_factory=dict)
    backend_name: str = "Native MOCS-Cert"
    software_version: str = "0.1.0"
    determinism: bool = True
    seed: Optional[int] = None
    units: Optional[str] = None
    provenance: Dict[str, Any] = field(default_factory=dict)
    status: WorkflowStepStatus = WorkflowStepStatus.PENDING
    error_state: Optional[Dict[str, Any]] = None
    timestamp: float = field(default_factory=time.time)
    execution_duration_ms: float = 0.0
    input_fingerprint: str = ""
    output_fingerprint: str = ""

    @classmethod
    def create(
        cls,
        step_type: WorkflowStepType,
        name: str,
        inputs: List[str],
        parameters: Optional[Dict[str, Any]] = None,
        backend_name: str = "Native MOCS-Cert",
        software_version: str = "0.1.0",
        seed: Optional[int] = 42,
        units: Optional[str] = None,
        provenance: Optional[Dict[str, Any]] = None,
    ) -> WorkflowStep:
        sid = f"step_{str(uuid.uuid4())[:8]}"
        in_fp = compute_hash({"inputs": sorted(inputs), "params": parameters or {}, "seed": seed})
        return cls(
            step_id=sid,
            step_type=step_type,
            name=name,
            inputs=inputs,
            parameters=parameters or {},
            backend_name=backend_name,
            software_version=software_version,
            determinism=True,
            seed=seed,
            units=units,
            provenance=provenance or {},
            status=WorkflowStepStatus.PENDING,
            input_fingerprint=in_fp,
        )

    def mark_running(self) -> None:
        self.status = WorkflowStepStatus.RUNNING

    def mark_completed(self, outputs: List[str], duration_ms: float, out_fp: Optional[str] = None) -> None:
        self.status = WorkflowStepStatus.COMPLETED
        self.outputs = outputs
        self.execution_duration_ms = duration_ms
        self.output_fingerprint = out_fp or compute_hash({"outputs": sorted(outputs), "step": self.step_id})

    def mark_failed(self, error: Exception, recovery_hint: Optional[str] = None) -> None:
        self.status = WorkflowStepStatus.FAILED
        self.error_state = {
            "error_type": type(error).__name__,
            "message": str(error),
            "recovery_hint": recovery_hint or "Check backend availability, file paths, or parameter types.",
            "timestamp": time.time(),
        }

    def mark_cancelled(self) -> None:
        self.status = WorkflowStepStatus.CANCELLED

    def mark_invalid(self, reason: str) -> None:
        self.status = WorkflowStepStatus.INVALID
        self.error_state = {"error_type": "InvalidStepError", "message": reason, "timestamp": time.time()}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "step_id": self.step_id,
            "step_type": self.step_type.value,
            "name": self.name,
            "inputs": self.inputs,
            "outputs": self.outputs,
            "parameters": self.parameters,
            "backend_name": self.backend_name,
            "software_version": self.software_version,
            "determinism": self.determinism,
            "seed": self.seed,
            "units": self.units,
            "provenance": self.provenance,
            "status": self.status.value,
            "error_state": self.error_state,
            "timestamp": self.timestamp,
            "execution_duration_ms": self.execution_duration_ms,
            "input_fingerprint": self.input_fingerprint,
            "output_fingerprint": self.output_fingerprint,
        }
