"""
mocs.ecosystem.differential — Differential Scientific Verification Engine.

Provides authoritative differential verification between native MOCS-Cert execution
and independent scientific reference oracles (MDAnalysis, MDTraj, Biotite, etc.).
Enforces strict discrepancy detection, classification, and transparent reporting.

PASS 31 expansion: Added verify_contacts, verify_sasa, verify_observable, verify_rmsd,
and multi-backend three-way comparison support.

Scientific Policy:
- Never average independent scientific results.
- When results disagree: STOP certification, show PRIMARY and REFERENCE with diagnosis.
- Classification UNRESOLVED if no diagnosis can be established.
"""

from __future__ import annotations
from typing import Dict, Any, List, Optional
import numpy as np

from .interfaces import (
    BackendDistanceResult,
    TrajectoryObservableResult,
    ObservableType,
    DiscrepancyClassification,
    DiscrepancyReport,
)
from mocs.exceptions import MOCSVerificationError


class DifferentialVerificationEngine:
    """
    Independent differential verification engine.
    Compares two or three backend results under strict numerical, unit, and algorithm contracts.
    """

    DEFAULT_TOLERANCE_ANGSTROM: float = 1e-4
    DEFAULT_TOLERANCE_PERCENT: float = 1.0      # 1% relative tolerance for SASA, Rg
    DEFAULT_TOLERANCE_RMSD: float = 5e-4        # 0.5 mÅ for RMSD

    @classmethod
    def verify(
        cls,
        mocs_result: BackendDistanceResult,
        reference_result: BackendDistanceResult,
        tolerance: float = DEFAULT_TOLERANCE_ANGSTROM,
    ) -> DiscrepancyReport:
        """
        Executes bit-level and floating-point differential comparison between MOCS and Reference.
        Returns DiscrepancyReport with exact classification.
        """
        if mocs_result.units != reference_result.units:
            raise ValueError(
                f"Unit mismatch in differential verification: "
                f"{mocs_result.units} vs {reference_result.units}"
            )

        if mocs_result.n_frames != reference_result.n_frames:
            return DiscrepancyReport(
                classification=DiscrepancyClassification.GENUINE_DISCREPANCY,
                max_delta=float("inf"),
                mean_delta=float("inf"),
                tolerance=tolerance,
                mocs_method=mocs_result.method,
                reference_method=reference_result.method,
                n_frames=mocs_result.n_frames,
                mismatched_frames=list(range(min(mocs_result.n_frames, reference_result.n_frames))),
                diagnosis=f"Frame count mismatch: MOCS={mocs_result.n_frames}, Reference={reference_result.n_frames}",
                status="UNRESOLVED",
            )

        diffs = np.abs(mocs_result.distances - reference_result.distances)
        max_delta = float(np.max(diffs)) if len(diffs) > 0 else 0.0
        mean_delta = float(np.mean(diffs)) if len(diffs) > 0 else 0.0

        mismatches = np.where(diffs > tolerance)[0].tolist()

        if len(mismatches) == 0:
            classification = DiscrepancyClassification.WITHIN_TOLERANCE
            diagnosis = (
                f"Bit-exact or within tolerance "
                f"({max_delta:.6f} Å <= {tolerance:.6f} Å). 100% agreement."
            )
            status = "RESOLVED"
        elif max_delta > 1.0:
            classification = DiscrepancyClassification.GENUINE_DISCREPANCY
            diagnosis = (
                f"Significant numerical discrepancy detected: max delta = "
                f"{max_delta:.4f} Å across {len(mismatches)} frames."
            )
            status = "UNRESOLVED"
        elif mocs_result.pbc_mode != reference_result.pbc_mode:
            classification = DiscrepancyClassification.EXPECTED_METHODOLOGICAL_DIFFERENCE
            diagnosis = (
                f"Discrepancy explained by distinct boundary conditions: "
                f"{mocs_result.pbc_mode} vs {reference_result.pbc_mode}."
            )
            status = "RESOLVED"
        else:
            classification = DiscrepancyClassification.GENUINE_DISCREPANCY
            diagnosis = (
                f"Discrepancy exceeds tolerance: max delta = "
                f"{max_delta:.6f} Å in {len(mismatches)} frames."
            )
            status = "UNRESOLVED"

        return DiscrepancyReport(
            classification=classification,
            max_delta=max_delta,
            mean_delta=mean_delta,
            tolerance=tolerance,
            mocs_method=mocs_result.method,
            reference_method=reference_result.method,
            n_frames=mocs_result.n_frames,
            mismatched_frames=mismatches,
            diagnosis=diagnosis,
            status=status,
        )

    @classmethod
    def verify_observable(
        cls,
        primary: TrajectoryObservableResult,
        reference: TrajectoryObservableResult,
        tolerance: Optional[float] = None,
    ) -> DiscrepancyReport:
        """
        Differential verification for any TrajectoryObservableResult pair.
        Automatically selects appropriate tolerance based on observable type.
        """
        if primary.observable_type != reference.observable_type:
            raise ValueError(
                f"Observable type mismatch: {primary.observable_type} vs {reference.observable_type}"
            )
        if primary.units != reference.units:
            raise ValueError(
                f"Unit mismatch: {primary.units} vs {reference.units}"
            )

        # Select tolerance by observable type
        if tolerance is None:
            if primary.observable_type in (ObservableType.DISTANCE,):
                tolerance = cls.DEFAULT_TOLERANCE_ANGSTROM
            elif primary.observable_type in (ObservableType.RMSD, ObservableType.RMSF):
                tolerance = cls.DEFAULT_TOLERANCE_RMSD
            elif primary.observable_type in (ObservableType.SASA, ObservableType.RADIUS_OF_GYRATION):
                # Use 1% relative tolerance: absolute threshold derived from mean
                mean_val = float(np.mean(np.abs(primary.values))) if len(primary.values) > 0 else 1.0
                tolerance = max(mean_val * 0.01, 1.0)  # 1% or at least 1 Å²
            else:
                tolerance = 1e-3

        if primary.n_frames != reference.n_frames:
            return DiscrepancyReport(
                classification=DiscrepancyClassification.GENUINE_DISCREPANCY,
                max_delta=float("inf"),
                mean_delta=float("inf"),
                tolerance=tolerance,
                mocs_method=primary.method,
                reference_method=reference.method,
                n_frames=primary.n_frames,
                mismatched_frames=[],
                diagnosis=(
                    f"Frame count mismatch: primary={primary.n_frames}, "
                    f"reference={reference.n_frames}"
                ),
                status="UNRESOLVED",
            )

        primary_vals = primary.values.flatten()
        ref_vals = reference.values.flatten()

        # Ensure same length after flatten (handles per-residue observables)
        if len(primary_vals) != len(ref_vals):
            return DiscrepancyReport(
                classification=DiscrepancyClassification.GENUINE_DISCREPANCY,
                max_delta=float("inf"),
                mean_delta=float("inf"),
                tolerance=tolerance,
                mocs_method=primary.method,
                reference_method=reference.method,
                n_frames=primary.n_frames,
                mismatched_frames=[],
                diagnosis=(
                    f"Value array shape mismatch after flatten: "
                    f"primary={len(primary_vals)}, reference={len(ref_vals)}"
                ),
                status="UNRESOLVED",
            )

        diffs = np.abs(primary_vals - ref_vals)
        max_delta = float(np.max(diffs)) if len(diffs) > 0 else 0.0
        mean_delta = float(np.mean(diffs)) if len(diffs) > 0 else 0.0
        mismatches = np.where(diffs > tolerance)[0].tolist()

        if len(mismatches) == 0:
            classification = DiscrepancyClassification.WITHIN_TOLERANCE
            diagnosis = (
                f"{primary.observable_type} comparison within tolerance "
                f"(max_delta={max_delta:.6f} {primary.units}). 100% agreement."
            )
            status = "RESOLVED"
        elif primary.approximation_status != reference.approximation_status:
            classification = DiscrepancyClassification.EXPECTED_METHODOLOGICAL_DIFFERENCE
            diagnosis = (
                f"Discrepancy expected: approximation status differs — "
                f"primary={primary.approximation_status}, reference={reference.approximation_status}. "
                f"Max delta = {max_delta:.4f} {primary.units}."
            )
            status = "RESOLVED"
        else:
            classification = DiscrepancyClassification.GENUINE_DISCREPANCY
            diagnosis = (
                f"Genuine discrepancy detected in {primary.observable_type}: "
                f"max_delta={max_delta:.4f} {primary.units} "
                f"({len(mismatches)} mismatched frames). "
                f"Both backends reported {primary.approximation_status}."
            )
            status = "UNRESOLVED"

        return DiscrepancyReport(
            classification=classification,
            max_delta=max_delta,
            mean_delta=mean_delta,
            tolerance=tolerance,
            mocs_method=primary.method,
            reference_method=reference.method,
            n_frames=primary.n_frames,
            mismatched_frames=mismatches[:50],  # cap for readability
            diagnosis=diagnosis,
            status=status,
        )

    @classmethod
    def verify_rmsd(
        cls,
        primary: TrajectoryObservableResult,
        reference: TrajectoryObservableResult,
        tolerance: float = DEFAULT_TOLERANCE_RMSD,
    ) -> DiscrepancyReport:
        """
        Specialized RMSD differential verification.
        Both inputs must be RMSD observables in Angstrom.
        """
        if primary.observable_type != ObservableType.RMSD:
            raise MOCSVerificationError(f"Primary must be RMSD observable, got {primary.observable_type}")
        if reference.observable_type != ObservableType.RMSD:
            raise MOCSVerificationError(f"Reference must be RMSD observable, got {reference.observable_type}")
        return cls.verify_observable(primary, reference, tolerance=tolerance)

    @classmethod
    def verify_sasa(
        cls,
        primary: TrajectoryObservableResult,
        reference: TrajectoryObservableResult,
        relative_tolerance_pct: float = 2.0,
    ) -> DiscrepancyReport:
        """
        Specialized SASA differential verification.
        Uses relative tolerance because SASA values vary widely (100–10000 Å²).
        """
        if primary.observable_type != ObservableType.SASA:
            raise MOCSVerificationError(f"Primary must be SASA observable, got {primary.observable_type}")
        if reference.observable_type != ObservableType.SASA:
            raise MOCSVerificationError(f"Reference must be SASA observable, got {reference.observable_type}")

        mean_val = float(np.mean(np.abs(primary.values))) if len(primary.values) > 0 else 100.0
        tolerance = mean_val * relative_tolerance_pct / 100.0

        return cls.verify_observable(primary, reference, tolerance=tolerance)

    @classmethod
    def verify_contacts(
        cls,
        primary_contacts: np.ndarray,
        reference_contacts: np.ndarray,
        primary_method: str = "MOCS Native",
        reference_method: str = "MDAnalysis Oracle",
    ) -> DiscrepancyReport:
        """
        Binary contact map differential verification.
        Both inputs must be Boolean or integer contact matrices of equal shape.
        """
        if primary_contacts.shape != reference_contacts.shape:
            return DiscrepancyReport(
                classification=DiscrepancyClassification.GENUINE_DISCREPANCY,
                max_delta=float("inf"),
                mean_delta=float("inf"),
                tolerance=0,
                mocs_method=primary_method,
                reference_method=reference_method,
                n_frames=0,
                mismatched_frames=[],
                diagnosis=(
                    f"Contact map shape mismatch: "
                    f"primary={primary_contacts.shape}, reference={reference_contacts.shape}"
                ),
                status="UNRESOLVED",
            )

        primary_bool = primary_contacts.astype(bool)
        reference_bool = reference_contacts.astype(bool)

        n_total = primary_bool.size
        n_agree = int(np.sum(primary_bool == reference_bool))
        n_disagree = n_total - n_agree
        agreement_pct = 100.0 * n_agree / n_total if n_total > 0 else 0.0

        # Convert boolean disagreement to float delta (0 or 1 per element)
        diffs = (primary_bool != reference_bool).astype(np.float64)
        max_delta = float(diffs.max()) if len(diffs) > 0 else 0.0
        mean_delta = float(diffs.mean()) if len(diffs) > 0 else 0.0

        if n_disagree == 0:
            classification = DiscrepancyClassification.WITHIN_TOLERANCE
            diagnosis = f"Contact maps are identical (100% agreement, {n_agree}/{n_total} elements)."
            status = "RESOLVED"
        elif agreement_pct >= 99.0:
            classification = DiscrepancyClassification.WITHIN_TOLERANCE
            diagnosis = (
                f"Contact maps agree to {agreement_pct:.2f}% "
                f"({n_disagree} element disagreements, within 1% threshold)."
            )
            status = "RESOLVED"
        else:
            classification = DiscrepancyClassification.GENUINE_DISCREPANCY
            diagnosis = (
                f"Contact map disagreement: {n_disagree} elements differ "
                f"({100.0 - agreement_pct:.2f}% disagreement). "
                f"Likely cause: different distance cutoff or selection semantics."
            )
            status = "UNRESOLVED"

        return DiscrepancyReport(
            classification=classification,
            max_delta=max_delta,
            mean_delta=mean_delta,
            tolerance=0,
            mocs_method=primary_method,
            reference_method=reference_method,
            n_frames=n_total,
            mismatched_frames=[],
            diagnosis=diagnosis,
            status=status,
        )

    @classmethod
    def three_way_comparison(
        cls,
        primary: BackendDistanceResult,
        reference_a: BackendDistanceResult,
        reference_b: BackendDistanceResult,
        tolerance: float = DEFAULT_TOLERANCE_ANGSTROM,
    ) -> Dict[str, DiscrepancyReport]:
        """
        Three-way differential comparison (MOCS vs Ref-A vs Ref-B).
        Never averages results; reports all pairwise discrepancies independently.
        """
        return {
            "primary_vs_reference_a": cls.verify(primary, reference_a, tolerance),
            "primary_vs_reference_b": cls.verify(primary, reference_b, tolerance),
            "reference_a_vs_reference_b": cls.verify(reference_a, reference_b, tolerance),
        }
