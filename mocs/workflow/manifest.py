"""
mocs.workflow.manifest — Reproducibility Manifest (workflow.json) & Exporter.

Serializes complete workflow execution states into cryptographically auditable
manifests, enabling independent reproduction, verification, and multi-format export.
"""

from __future__ import annotations
import json
import time
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional
import hashlib

from .artifacts import compute_hash
from mocs.certificates.canonical import compute_manifest_digest


@dataclass
class ReproducibilityManifest:
    """Canonical workflow reproduction manifest."""
    workflow_id: str
    name: str
    created_at: float
    inputs: List[Dict[str, Any]]
    providers: List[str]
    software_versions: Dict[str, str]
    algorithms: List[str]
    parameters: Dict[str, Any]
    units: Dict[str, str]
    seeds: Dict[str, int]
    transformations: List[Dict[str, Any]]
    backend_choices: Dict[str, str]
    results: Dict[str, Any]
    comparisons: List[Dict[str, Any]]
    certificate: Optional[Dict[str, Any]] = None
    warnings: List[str] = field(default_factory=list)
    limitations: List[str] = field(default_factory=list)
    manifest_digest: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "workflow_id": self.workflow_id,
            "name": self.name,
            "created_at": self.created_at,
            "inputs": self.inputs,
            "providers": self.providers,
            "software_versions": self.software_versions,
            "algorithms": self.algorithms,
            "parameters": self.parameters,
            "units": self.units,
            "seeds": self.seeds,
            "transformations": self.transformations,
            "backend_choices": self.backend_choices,
            "results": self.results,
            "comparisons": self.comparisons,
            "certificate": self.certificate,
            "warnings": self.warnings,
            "limitations": self.limitations,
            "manifest_digest": self.manifest_digest,
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, sort_keys=True, default=str)

    def to_csv(self) -> str:
        """Export workflow observable results in CSV format, safely escaping values (F-061)."""
        import csv
        import io
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
        writer.writerow(["Step", "Observable", "Value", "Units", "Backend", "Version", "Status"])
        for step_name, res in self.results.items():
            obs = str(res.get("observable", "N/A"))
            val = res.get("value", "N/A")
            if isinstance(val, (list, dict)):
                val = f"{str(val)[:30]}..."
            else:
                val = str(val)
            # Prevent CSV formula injection in spreadsheet software
            if val and val[0] in ("=", "+", "-", "@", "\t", "\r"):
                val = "'" + val
            unit = str(res.get("units", "N/A"))
            b_name = str(res.get("backend", "MOCS"))
            b_ver = str(res.get("version", "0.1.0"))
            status = str(res.get("status", "COMPLETED"))
            writer.writerow([step_name, obs, val, unit, b_name, b_ver, status])
        return output.getvalue()

    def to_markdown_report(self) -> str:
        """Generate human-readable scientific audit report with sanitized name (F-062)."""
        safe_name = (
            str(self.name)
            .replace("#", "\\#")
            .replace("*", "\\*")
            .replace("[", "\\[")
            .replace("]", "\\]")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )
        lines = [
            f"# Scientific Workflow Audit Report: {safe_name}",
            f"",
            f"- **Workflow ID**: `{self.workflow_id}`",
            f"- **Timestamp**: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime(self.created_at))}",
            f"- **Manifest SHA-256**: `{self.manifest_digest}`",
            f"- **Status**: {'CERTIFIED' if self.certificate else 'COMPLETED'}",
            f"",
            f"## 1. Primary Inputs & Sources",
        ]
        for inp in self.inputs:
            lines.append(f"- **{inp.get('type', 'Input')}**: `{inp.get('identifier', 'N/A')}` (SHA-256: `{inp.get('fingerprint', '')[:16]}...`)")

        lines.extend([
            f"",
            f"## 2. Software Ecosystem Attribution",
        ])
        for b_name, b_ver in self.software_versions.items():
            lines.append(f"- **{b_name}**: Version `{b_ver}`")

        lines.extend([
            f"",
            f"## 3. Certified Observable Results",
            f"",
            f"| Step | Observable | Value | Units | Engine | Verification |",
            f"|:---|:---|:---|:---|:---|:---|",
        ])
        for step_name, res in self.results.items():
            obs = res.get("observable", "Result")
            val = res.get("value", "N/A")
            unit = res.get("units", "dimensionless")
            backend = res.get("backend", "MOCS")
            status = res.get("status", "VERIFIED")
            lines.append(f"| `{step_name}` | {obs} | `{val}` | {unit} | {backend} | {status} |")

        if self.warnings:
            lines.extend(["", "## 4. Warnings"])
            for w in self.warnings:
                lines.append(f"- [WARNING] {w}")

        if self.limitations:
            lines.extend(["", "## 5. Explicit Scientific Limitations"])
            for lim in self.limitations:
                lines.append(f"- [LIMITATION] {lim}")

        return "\n".join(lines)


class ManifestBuilder:
    """Builder for cryptographically signed ReproducibilityManifest instances."""

    @classmethod
    def build(
        cls,
        workflow_id: str,
        name: str,
        inputs: List[Dict[str, Any]],
        providers: List[str],
        software_versions: Dict[str, str],
        algorithms: List[str],
        parameters: Dict[str, Any],
        units: Dict[str, str],
        seeds: Dict[str, int],
        transformations: List[Dict[str, Any]],
        backend_choices: Dict[str, str],
        results: Dict[str, Any],
        comparisons: List[Dict[str, Any]],
        certificate: Optional[Dict[str, Any]] = None,
        warnings: Optional[List[str]] = None,
        limitations: Optional[List[str]] = None,
    ) -> ReproducibilityManifest:
        # F-055: Commitment digest covers all scientific, governance, and constraint fields
        full_dict = {
            "workflow_id": workflow_id,
            "name": name,
            "inputs": inputs,
            "providers": providers,
            "software_versions": software_versions,
            "algorithms": algorithms,
            "parameters": parameters,
            "units": units,
            "seeds": seeds,
            "transformations": transformations,
            "backend_choices": backend_choices,
            "results": results,
            "comparisons": comparisons,
            "certificate": certificate,
            "warnings": warnings or [],
            "limitations": limitations or [],
        }
        digest = compute_manifest_digest(full_dict)
        return ReproducibilityManifest(
            workflow_id=workflow_id,
            name=name,
            created_at=time.time(),
            inputs=inputs,
            providers=providers,
            software_versions=software_versions,
            algorithms=algorithms,
            parameters=parameters,
            units=units,
            seeds=seeds,
            transformations=transformations,
            backend_choices=backend_choices,
            results=results,
            comparisons=comparisons,
            certificate=certificate,
            warnings=warnings or [],
            limitations=limitations or [],
            manifest_digest=digest,
        )
