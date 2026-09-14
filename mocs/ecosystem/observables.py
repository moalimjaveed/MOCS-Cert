"""
mocs.ecosystem.observables — Molecular Observable Registry and Computation.

Provides a unified registry for all supported molecular observables, their
semantic definitions, supported backends, units, and computation wrappers.

PASS 31: New module providing the Observable computation layer above raw backends.

Scientific Policy:
- Only expose an observable when its scientific semantics are explicitly defined.
- Every result must carry units, method, backend, version, and limitations.
- No orphan numbers: every computed value must have full provenance.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional, Callable
import numpy as np

from .interfaces import ObservableType, TrajectoryObservableResult


@dataclass(frozen=True)
class ObservableDefinition:
    """
    Formal definition of a molecular observable.
    Every observable exposed in MOCS-Cert must have one of these.
    """
    observable_type: ObservableType
    display_name: str
    definition: str              # Scientific definition in plain English
    mathematical_definition: str  # LaTeX-compatible formula
    units: str
    typical_range: str           # Human-readable typical value range
    known_limitations: List[str]
    primary_backends: List[str]  # Backends that can compute this observable
    reference_citations: List[str]


# ---------------------------------------------------------------------------
# Observable Registry
# ---------------------------------------------------------------------------

OBSERVABLE_REGISTRY: Dict[ObservableType, ObservableDefinition] = {
    ObservableType.DISTANCE: ObservableDefinition(
        observable_type=ObservableType.DISTANCE,
        display_name="Interatomic Distance",
        definition=(
            "Euclidean distance between the positions of two selected atoms at each trajectory frame, "
            "with optional periodic boundary condition (PBC) minimum-image convention applied."
        ),
        mathematical_definition=r"d(t) = \|\mathbf{r}_A(t) - \mathbf{r}_B(t)\|_2 \text{ [with optional PBC wrapping]}",
        units="Angstrom",
        typical_range="0.5–50 Å (covalent ~1–2 Å, non-covalent 2.5–10 Å)",
        known_limitations=[
            "PBC wrapping mode must match simulation protocol exactly",
            "COM distance between groups requires specification of center-of-mass convention",
        ],
        primary_backends=["Native MOCS-Cert", "MDAnalysis", "MDTraj"],
        reference_citations=[
            "Michaud-Agrawal et al., J. Comput. Chem. 32, 2319-2327 (2011)",
        ],
    ),
    ObservableType.RMSD: ObservableDefinition(
        observable_type=ObservableType.RMSD,
        display_name="Root-Mean-Square Deviation",
        definition=(
            "RMSD of a selection of atoms from their positions in a reference frame, "
            "after optimal rigid-body superposition (rotation + translation). "
            "Measures how much a structure deviates from the reference over time."
        ),
        mathematical_definition=(
            r"\text{RMSD}(t) = \sqrt{\frac{1}{N}\sum_{i=1}^{N}\|\mathbf{r}_i(t) - \mathbf{r}_i^{\text{ref}}\|^2}"
        ),
        units="Angstrom",
        typical_range="0–15 Å (folded protein backbone: 0.5–5 Å)",
        known_limitations=[
            "RMSD is sensitive to domain motions; consider per-domain analysis for multi-domain proteins",
            "Reference frame selection significantly affects interpretation",
            "Does not capture conformational diversity: a system can visit the same RMSD from different structures",
        ],
        primary_backends=["MDAnalysis", "MDTraj"],
        reference_citations=[
            "Kabsch, Acta Crystallogr. A 32, 922-923 (1976) (optimal superposition algorithm)",
        ],
    ),
    ObservableType.RMSF: ObservableDefinition(
        observable_type=ObservableType.RMSF,
        display_name="Root-Mean-Square Fluctuation",
        definition=(
            "Per-residue (or per-atom) time-averaged fluctuation from the mean position. "
            "Measures local flexibility along the protein sequence."
        ),
        mathematical_definition=(
            r"\text{RMSF}_i = \sqrt{\langle\|\mathbf{r}_i(t) - \langle\mathbf{r}_i\rangle\|^2\rangle_t}"
        ),
        units="Angstrom",
        typical_range="0.2–10 Å (rigid core: <1 Å; flexible loops: 3–10 Å)",
        known_limitations=[
            "Sensitive to trajectory length; insufficient sampling leads to unreliable RMSF",
            "B-factors from X-ray crystallography are related but not identical (include lattice effects)",
        ],
        primary_backends=["MDAnalysis", "MDTraj"],
        reference_citations=[
            "Michaud-Agrawal et al., J. Comput. Chem. 32, 2319-2327 (2011)",
        ],
    ),
    ObservableType.RADIUS_OF_GYRATION: ObservableDefinition(
        observable_type=ObservableType.RADIUS_OF_GYRATION,
        display_name="Radius of Gyration",
        definition=(
            "Mass-weighted root-mean-square distance of atoms from the center of mass. "
            "Measures the compactness or size of a molecular assembly."
        ),
        mathematical_definition=(
            r"R_g(t) = \sqrt{\frac{\sum_i m_i \|\mathbf{r}_i(t) - \mathbf{r}_{cm}(t)\|^2}{\sum_i m_i}}"
        ),
        units="Angstrom",
        typical_range="5–100 Å (small protein: 10–20 Å; large complex: 30–100 Å)",
        known_limitations=[
            "Depends on mass weighting; use consistent mass assignment across backends",
            "Insensitive to the shape of the molecule (two very different shapes can have the same Rg)",
        ],
        primary_backends=["MDAnalysis", "MDTraj"],
        reference_citations=[
            "Flory, Statistical Mechanics of Chain Molecules (1969)",
        ],
    ),
    ObservableType.SASA: ObservableDefinition(
        observable_type=ObservableType.SASA,
        display_name="Solvent-Accessible Surface Area",
        definition=(
            "Area of the molecular surface that is accessible to a probe sphere "
            "(typically radius 1.4 Å representing a water molecule). "
            "Measures solvent exposure of atoms or residues."
        ),
        mathematical_definition=(
            r"\text{SASA} = \int_{\text{solvent-accessible surface}} dA"
        ),
        units="Angstrom^2",
        typical_range="500–50000 Å² (small protein: 5000–15000 Å²)",
        known_limitations=[
            "Result depends on probe radius and algorithm (Shrake-Rupley vs Connolly vs Lee-Richards)",
            "Different backends use different algorithms; comparison requires matching parameters",
            "Per-atom VdW radii parametrization affects results",
        ],
        primary_backends=["MDTraj (Shrake-Rupley)", "MDAnalysis (FreeSASA)"],
        reference_citations=[
            "Shrake & Rupley, J. Mol. Biol. 79, 351-371 (1973)",
            "Lee & Richards, J. Mol. Biol. 55, 379-400 (1971)",
        ],
    ),
    ObservableType.CONTACTS: ObservableDefinition(
        observable_type=ObservableType.CONTACTS,
        display_name="Residue / Atom Contacts",
        definition=(
            "Binary or count-based contact map indicating whether pairs of atoms or residues "
            "are within a specified distance cutoff at each trajectory frame."
        ),
        mathematical_definition=(
            r"C_{ij}(t) = \begin{cases} 1 & \text{if } d_{ij}(t) \leq d_{cut} \\ 0 & \text{otherwise} \end{cases}"
        ),
        units="Boolean (0/1) or count",
        typical_range="Cutoff typically 8–12 Å for Cα contacts; 4.5–5.0 Å for all-atom contacts",
        known_limitations=[
            "Strongly sensitive to distance cutoff choice",
            "Sequential contacts (|i-j| < 4) are typically excluded from analysis",
            "Contact definition varies across literature; always specify cutoff and selection",
        ],
        primary_backends=["MDAnalysis", "Biotite", "Native MOCS-Cert"],
        reference_citations=[
            "Plaxco et al., J. Mol. Biol. 277, 985-994 (1998)",
        ],
    ),
    ObservableType.HBONDS: ObservableDefinition(
        observable_type=ObservableType.HBONDS,
        display_name="Hydrogen Bonds",
        definition=(
            "Donor-acceptor atom pairs satisfying geometric criteria for hydrogen bonding. "
            "Typically: donor-acceptor distance < 3.5 Å AND donor-H-acceptor angle > 120°."
        ),
        mathematical_definition=(
            r"H\text{-bond}: d_{DA} < 3.5\,\text{Å} \land \angle DHA > 120°"
        ),
        units="Count (per frame) or pair list",
        typical_range="5–100 H-bonds per protein-water system",
        known_limitations=[
            "Geometric criteria are heuristic, not quantum-mechanical",
            "Different implementations use different cutoffs (MDTraj Baker-Hubbard vs MDAnalysis WaterBridges)",
            "Requires explicit hydrogen atoms in topology; united-atom force fields require reconstruction",
        ],
        primary_backends=["MDTraj (Baker-Hubbard)", "MDAnalysis", "PLIP (oracle)"],
        reference_citations=[
            "Baker & Hubbard, Prog. Biophys. Mol. Biol. 44, 97-179 (1984)",
        ],
    ),
    ObservableType.FREE_ENERGY: ObservableDefinition(
        observable_type=ObservableType.FREE_ENERGY,
        display_name="Free Energy",
        definition=(
            "Thermodynamic free energy change (ΔG) estimated from alchemical perturbation, "
            "umbrella sampling, metadynamics, or MBAR analysis of simulation data."
        ),
        mathematical_definition=r"\Delta G = -k_BT \ln \langle e^{-\beta \Delta U} \rangle_0",
        units="kcal/mol or kJ/mol",
        typical_range="0.1–50 kcal/mol depending on process",
        known_limitations=[
            "Requires well-converged, properly designed alchemical or enhanced-sampling simulations",
            "MOCS-Cert does NOT run simulations; this observable requires pre-collected simulation data",
            "Force field accuracy limits thermodynamic estimates",
            "Empirical docking scores (Vina) are NOT thermodynamic ΔG",
        ],
        primary_backends=["pymbar", "alchemlyb"],
        reference_citations=[
            "Shirts & Chodera, J. Chem. Phys. 129, 124105 (2008)",
            "Zwanzig, J. Chem. Phys. 22, 1420-1426 (1954)",
        ],
    ),
    ObservableType.NORMAL_MODES: ObservableDefinition(
        observable_type=ObservableType.NORMAL_MODES,
        display_name="Normal Modes (ANM/GNM)",
        definition=(
            "Collective motions of the protein computed from the Hessian of a coarse-grained "
            "elastic network model. ANM (Anisotropic Network Model) gives directionality; "
            "GNM (Gaussian Network Model) gives magnitudes only."
        ),
        mathematical_definition=(
            r"\mathbf{H}\mathbf{u}_k = \lambda_k \mathbf{u}_k \quad"
            r"H_{ij} = \begin{cases} -\gamma & d_{ij} \leq r_c \\ 0 & \text{otherwise} \end{cases}"
        ),
        units="Dimensionless (eigenvectors); eigenvalues in spring constant units",
        typical_range="Low-frequency modes (λ₁–λ₁₀) describe global collective motions",
        known_limitations=[
            "Coarse-grained approximation (CA atoms only); not equivalent to full MD",
            "ANM does not capture side-chain motions or solvent effects",
            "Eigenvalue magnitudes depend on spring constant γ parametrization",
        ],
        primary_backends=["ProDy"],
        reference_citations=[
            "Bahar et al., Folding Des. 2, 173-181 (1997) (GNM)",
            "Atilgan et al., Biophys. J. 80, 505-515 (2001) (ANM)",
        ],
    ),
}


class ObservableRegistry:
    """Query interface for the molecular observable registry."""

    @classmethod
    def get(cls, observable_type: ObservableType) -> Optional[ObservableDefinition]:
        return OBSERVABLE_REGISTRY.get(observable_type)

    @classmethod
    def all_observables(cls) -> List[ObservableDefinition]:
        return list(OBSERVABLE_REGISTRY.values())

    @classmethod
    def get_by_backend(cls, backend_name: str) -> List[ObservableDefinition]:
        return [
            obs for obs in OBSERVABLE_REGISTRY.values()
            if any(backend_name.lower() in b.lower() for b in obs.primary_backends)
        ]

    @classmethod
    def get_capabilities_list(cls) -> List[str]:
        """Return a flat list of all observable display names."""
        return [obs.display_name for obs in OBSERVABLE_REGISTRY.values()]

    @classmethod
    def verify_result_contract(cls, result: TrajectoryObservableResult) -> List[str]:
        """
        Validate that a TrajectoryObservableResult meets the universal result contract.
        Returns list of violations (empty = valid).
        """
        violations: List[str] = []

        if not result.method:
            violations.append("result.method must not be empty")
        if not result.backend:
            violations.append("result.backend must not be empty")
        if not result.version:
            violations.append("result.version must not be empty")
        if not result.units:
            violations.append("result.units must not be empty")
        if not result.provenance:
            violations.append("result.provenance must not be empty dict")
        if len(result.values) == 0:
            violations.append("result.values must not be empty array")
        if result.n_frames <= 0:
            violations.append("result.n_frames must be positive")
        if len(result.values.shape) == 1 and len(result.values) != result.n_frames:
            violations.append(
                f"result.values length ({len(result.values)}) != n_frames ({result.n_frames})"
            )
        if not np.all(np.isfinite(result.values)):
            violations.append("result.values contains non-finite values (NaN or Inf)")

        return violations
