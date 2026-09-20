"""
mocs.ecosystem.interfaces — Authoritative Interfaces for Open-Source Scientific Integrations.

Defines canonical representations for structures, trajectories, analysis backends,
differential verification, provenance metadata, and molecular observables across
the scientific software ecosystem.

PASS 31 expansion: Added ObservableType, TrajectoryObservableResult, InteractionResult,
CavityResult, DesignResult, PredictionResult, CrystallographicResult, WorkflowProvenance,
and the full AbstractAnalysisBackend capability contract.
"""

from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Any, List, Optional, Tuple, Sequence
import numpy as np


# ---------------------------------------------------------------------------
# Source & Provenance Types
# ---------------------------------------------------------------------------

class StructureSourceType(str, Enum):
    EXPERIMENTAL = "Experimental (RCSB PDB)"
    PREDICTED = "Predicted (AlphaFold DB)"
    GENERATED = "Generated (Computational Design)"
    SYNTHETIC = "Synthetic (MOCS Benchmark)"


class IntegrationStatus(str, Enum):
    IMPLEMENTED = "IMPLEMENTED"           # Native MOCS-Cert implementation
    INTEGRATED = "INTEGRATED"            # Directly bundled/imported
    INTEGRATED_AS_ORACLE = "INTEGRATED_AS_ORACLE"  # Used as independent reference
    IN_PROCESS = "IN_PROCESS"            # Direct in-process library
    OPTIONAL_ADAPTER = "OPTIONAL_ADAPTER"  # Available if installed
    OPTIONAL_LIBRARY = "OPTIONAL_LIBRARY"  # Available as optional python package
    EXTERNAL_WORKER = "EXTERNAL_WORKER"  # Subprocess/CLI boundary
    SUBPROCESS = "SUBPROCESS"            # Subprocess execution boundary
    ORACLE = "ORACLE"                    # Independent reference/oracle
    ORACLE_ONLY = "ORACLE_ONLY"          # Differential reference only
    STUDIED_NOT_INTEGRATED = "STUDIED_NOT_INTEGRATED"
    DATASET = "DATASET"                  # Benchmark dataset resource (not runtime backend)
    PROVIDER = "PROVIDER"                # External service or interoperability provider
    ARCHITECTURAL_INSPIRATION = "ARCHITECTURAL_INSPIRATION"  # Architectural study / design pattern
    PLANNED = "PLANNED"
    RESEARCH_ONLY = "RESEARCH_ONLY"
    DEFERRED = "DEFERRED"
    REJECTED = "REJECTED"
    UNSUPPORTED = "UNSUPPORTED"


class DomainScope(str, Enum):
    """Separation of core molecular science from adjacent computational biology."""
    CORE_MOLECULAR = "CORE_MOLECULAR"
    ADJACENT_BIOLOGY = "ADJACENT_BIOLOGY"


class QualityTier(str, Enum):
    """Scientific software maturity and trustworthiness classification."""
    TIER_S = "S"  # Mature, validated, scientifically trusted (peer-reviewed, widely cited)
    TIER_A = "A"  # Mature, suitable, independent verification available
    TIER_B = "B"  # Useful, less mature, limited validation
    TIER_C = "C"  # Experimental / research-only
    TIER_D = "D"  # Unverified / do not integrate


class LicenseClass(str, Enum):
    PERMISSIVE = "Permissive"              # MIT, BSD, Apache-2.0 — safe to bundle
    WEAK_COPYLEFT = "Weak Copyleft"        # LGPL, MPL — dynamic linking boundary
    STRONG_COPYLEFT = "Strong Copyleft"    # GPL — subprocess/oracle boundary required
    PUBLIC_DOMAIN = "Public Domain"        # CC0
    PERMISSIVE_ATTRIBUTION = "Permissive Attribution"  # CC-BY
    NON_COMMERCIAL = "Non-Commercial"      # Rejected for open-source bundling
    MIXED = "Mixed"                        # Multiple licenses apply


# ---------------------------------------------------------------------------
# Observable Types
# ---------------------------------------------------------------------------

class ObservableType(str, Enum):
    """Registry of all supported molecular observables with semantic definitions."""
    # Geometry
    DISTANCE = "distance"          # Inter-atomic Euclidean distance [Å]
    ANGLE = "angle"                # Bond angle [degrees]
    DIHEDRAL = "dihedral"          # Torsion angle [degrees]; range [-180, 180)
    RMSD = "rmsd"                  # Root-mean-square deviation from reference [Å]
    RMSF = "rmsf"                  # Root-mean-square fluctuation per residue [Å]
    RADIUS_OF_GYRATION = "rg"      # Radius of gyration [Å]
    # Solvent / Surface
    SASA = "sasa"                  # Solvent-accessible surface area [Å²]
    # Contacts & Interactions
    CONTACTS = "contacts"          # Atom/residue contact map (Boolean or count)
    HBONDS = "hbonds"              # Hydrogen bonds (donor-acceptor pairs)
    SALT_BRIDGES = "salt_bridges"  # Electrostatic salt bridges
    PI_STACKING = "pi_stacking"    # Aromatic ring π–π stacking interactions
    HYDROPHOBIC = "hydrophobic"    # Hydrophobic contacts
    METAL_COORD = "metal_coord"    # Metal coordination contacts
    # Dynamics
    PCA = "pca"                    # Principal component analysis of trajectory
    NORMAL_MODES = "normal_modes"  # Normal-mode analysis (ANM/GNM)
    CROSS_CORRELATION = "cross_correlation"  # Residue cross-correlation matrix
    # Statistical
    RADIAL_DISTRIBUTION = "radial_distribution"  # Radial distribution function g(r)
    DENSITY = "density"            # Atomic density map
    COORDINATION_NUMBER = "coordination_number"
    CLUSTERING = "clustering"      # Trajectory cluster membership
    # Thermodynamics
    FREE_ENERGY = "free_energy"    # ΔG or PMF [kcal/mol or kJ/mol]
    MBAR_FREE_ENERGY = "mbar"      # MBAR/WHAM free-energy estimate
    # Cryo-EM & Experimental Maps (PASS 32)
    CRYO_EM_MAP = "cryo_em_map"    # Density map (MRC/CCP4) statistics & voxels
    # Design & Modeling (PASS 32)
    SEQUENCE_DESIGN = "sequence_design"  # Protein sequence design (ProteinMPNN)
    COMPLEX_PREDICTION = "complex_prediction"  # Biomolecular complex prediction (Boltz, OpenFold)
    DOCKING = "docking"            # Small-molecule / macromolecular docking (Vina, Smina)
    # PASS 33 Harvest Observables
    POCKET_PREDICTION = "pocket_prediction"      # Pocket & cavity detection (P2Rank, fpocket)
    POCKET_ENSEMBLE = "pocket_ensemble"          # Cross-method pocket comparison
    INTERACTION_FINGERPRINT = "interaction_fingerprint"  # Non-covalent interaction fingerprints (ProLIF)
    INTERACTION_ENSEMBLE = "interaction_ensemble"        # Multi-engine interaction comparison
    STRUCTURE_SEARCH = "structure_search"        # Macromolecular structural search (Foldseek)
    SEQUENCE_HOMOLOGY = "sequence_homology"      # Sequence homology search (MMseqs2, HMMER)
    LIGAND_VALIDATION = "ligand_validation"      # In silico ligand validation (PoseBusters, RDKit)
    CONSENSUS_PREDICTION = "consensus_prediction"  # Multi-model prediction difference & consensus
    BENCHMARK_SPEC = "benchmark_spec"            # Benchmark dataset specification & split governance
    SIFTS_MAPPING = "sifts_mapping"              # Sequence-to-structure residue mapping (PDBe-SIFTS)


# ---------------------------------------------------------------------------
# Core Structure Records
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ProvenanceRecord:
    source_type: StructureSourceType
    source_id: str
    method: str
    version: str
    sha256_hash: str
    resolution_angstrom: Optional[float] = None
    confidence_score: Optional[float] = None  # e.g., pLDDT for AlphaFold
    experimental_technique: Optional[str] = None  # e.g., X-RAY DIFFRACTION, CRYO-EM
    citation: Optional[str] = None
    extra_metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AtomRecord:
    index: int
    name: str
    resname: str
    chain: str
    resseq: int
    coordinates: np.ndarray  # shape (3,), float64 in Angstroms
    element: str = ""
    b_factor: float = 0.0
    occupancy: float = 1.0


@dataclass
class CanonicalStructure:
    identifier: str
    provenance: ProvenanceRecord
    chains: List[str]
    residues: List[Tuple[str, int, str]]  # (chain, resseq, resname)
    atoms: List[AtomRecord]
    box: Optional[np.ndarray] = None  # shape (3,) or (6,)
    secondary_structure: Optional[Dict[str, str]] = None  # residue_key -> "H/E/C"
    missing_residues: Optional[List[Tuple[str, int, str]]] = None

    @property
    def atom_count(self) -> int:
        return len(self.atoms)

    @property
    def coordinates(self) -> np.ndarray:
        if not self.atoms:
            return np.empty((0, 3), dtype=np.float64)
        return np.array([a.coordinates for a in self.atoms], dtype=np.float64)


# ---------------------------------------------------------------------------
# Abstract Provider
# ---------------------------------------------------------------------------

class StructureProvider(ABC):
    """Abstract Base Class for structural biology ingestion providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @property
    @abstractmethod
    def source_type(self) -> StructureSourceType:
        pass

    @abstractmethod
    def load_structure(self, identifier: str) -> CanonicalStructure:
        """Load structure by identifier or file path, returning CanonicalStructure."""
        pass


# ---------------------------------------------------------------------------
# Backend Distance Result (retained for compatibility)
# ---------------------------------------------------------------------------

@dataclass
class BackendDistanceResult:
    distances: np.ndarray  # shape (n_frames,), float64
    n_frames: int
    method: str
    version: str
    provenance: Dict[str, Any]
    units: str = "Angstrom"
    execution_time_ms: float = 0.0
    pbc_mode: str = "orthorhombic_minimum_image"


# ---------------------------------------------------------------------------
# Trajectory Observable Result (PASS 31)
# ---------------------------------------------------------------------------

@dataclass
class TrajectoryObservableResult:
    """Universal result container for any trajectory observable computation."""
    observable_type: ObservableType
    values: np.ndarray          # shape (n_frames,) or (n_frames, n_pairs) etc.
    n_frames: int
    method: str
    backend: str
    version: str
    units: str
    provenance: Dict[str, Any]
    execution_time_ms: float = 0.0
    uncertainty: Optional[np.ndarray] = None
    limitations: List[str] = field(default_factory=list)
    approximation_status: str = "EXACT"  # "EXACT", "APPROXIMATE", "HEURISTIC"


# ---------------------------------------------------------------------------
# Interaction / Protein-Ligand Results (PASS 31)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class AtomPair:
    """An identified atom pair involved in an interaction."""
    donor_chain: str
    donor_resname: str
    donor_resseq: int
    donor_atom: str
    acceptor_chain: str
    acceptor_resname: str
    acceptor_resseq: int
    acceptor_atom: str
    distance_angstrom: float


@dataclass
class InteractionResult:
    """
    Canonical result for protein-ligand or protein-protein noncovalent interactions.

    Every interaction must carry full geometry, atom identities, method, backend,
    version, and explicit limitations. Never report interactions without these.
    """
    interaction_type: str           # e.g., "HBOND", "SALT_BRIDGE", "PI_STACKING"
    interactions: List[AtomPair]
    n_interactions: int
    method: str                     # Algorithm / detection method
    backend: str                    # Backend used (e.g., "PLIP", "Native MOCS")
    version: str
    provenance: Dict[str, Any]
    ligand_id: Optional[str] = None
    frame_index: Optional[int] = None
    limitations: List[str] = field(default_factory=list)
    approximation_status: str = "HEURISTIC"   # Interactions are always heuristic


# ---------------------------------------------------------------------------
# Cavity / Pocket Detection Results (PASS 31)
# ---------------------------------------------------------------------------

@dataclass
class CavityResult:
    """
    Canonical result for geometric cavity / binding-site detection.

    IMPORTANT: A geometric cavity IS NOT a confirmed active site.
    This type must never be labeled as 'active site' without experimental evidence.
    """
    cavity_id: int
    center_angstrom: np.ndarray     # shape (3,) — geometric center of cavity
    volume_angstrom3: float
    druggability_score: Optional[float]  # fpocket druggability score if available
    n_alpha_spheres: Optional[int]  # fpocket internal representation
    method: str                     # Detection method (e.g., "fpocket", "geometry")
    backend: str
    version: str
    provenance: Dict[str, Any]
    limitations: List[str] = field(default_factory=list)
    is_confirmed_active_site: bool = False  # Must remain False unless experimentally validated


@dataclass
class CavitySetResult:
    """Collection of cavity results from one run."""
    cavities: List[CavityResult]
    n_cavities: int
    structure_id: str
    method: str
    backend: str
    version: str
    provenance: Dict[str, Any]
    limitations: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Protein Design Results (PASS 31)
# ---------------------------------------------------------------------------

@dataclass
class DesignResult:
    """
    Result from a de novo or inverse-folding protein design computation.

    Every generated artifact retains full seed, parameters, and model provenance.
    Generated structures must NEVER be labeled as experimental.
    """
    design_id: str
    sequence: str                   # Designed amino acid sequence (one-letter)
    backbone_source: Optional[str]  # PDB ID or description of input backbone
    model_checkpoint: str           # Model weights identifier / SHA
    seed: int                       # Random seed used
    parameters: Dict[str, Any]      # All non-default model parameters
    mpnn_score: Optional[float]     # ProteinMPNN log-likelihood score
    sc_tm_score: Optional[float]    # Self-consistency TM-score if computed
    method: str                     # e.g., "ProteinMPNN", "RFdiffusion"
    backend: str
    version: str
    license: str
    citation: str
    provenance: Dict[str, Any]
    limitations: List[str] = field(default_factory=list)
    validation_passed: bool = False  # Must pass geometry/clashscore check


# ---------------------------------------------------------------------------
# Structure Prediction Results (PASS 31)
# ---------------------------------------------------------------------------

@dataclass
class PredictionResult:
    """
    Result from a structure prediction model (AlphaFold, Boltz, ESMFold, etc.).

    Predictions MUST carry per-residue confidence and MUST NEVER be labeled
    as experimental without explicit provenance override.
    """
    prediction_id: str
    sequence: str
    per_residue_plddt: np.ndarray   # shape (n_residues,); range [0, 100]
    mean_plddt: float
    ptm_score: Optional[float]      # Predicted TM-score (inter-chain interface)
    model_name: str                 # e.g., "alphafold_monomer_v2.3"
    model_version: str
    weights_id: str                 # Weights SHA or release tag
    msa_source: Optional[str]       # MSA database used (if applicable)
    template_data: Optional[str]    # Template PDB IDs or "none"
    seed: Optional[int]
    license: str
    citation: str
    provenance: Dict[str, Any]
    source_type: StructureSourceType = StructureSourceType.PREDICTED
    limitations: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Crystallographic Results (PASS 31)
# ---------------------------------------------------------------------------

@dataclass
class CrystallographicResult:
    """
    Canonical result from crystallographic symmetry analysis and unit-cell operations.
    Used by Gemmi and related backends.
    """
    space_group: str
    unit_cell: Tuple[float, float, float, float, float, float]  # a, b, c, α, β, γ
    biological_assemblies: List[str]   # Assembly identifiers
    n_symmetry_operations: int
    resolution_angstrom: Optional[float]
    r_factor: Optional[float]
    r_free: Optional[float]
    method: str
    backend: str
    version: str
    provenance: Dict[str, Any]
    limitations: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Workflow Provenance Node (PASS 31)
# ---------------------------------------------------------------------------

@dataclass
class WorkflowProvenanceNode:
    """
    A single node in the scientific provenance graph.

    Every analysis step produces one node: SOURCE → PARSER → NORMALIZATION →
    SELECTION → TRANSFORMATION → ANALYSIS → VERIFICATION → CERTIFICATE.
    """
    step_id: str
    operation: str           # Human-readable operation name
    input_ids: List[str]     # IDs of upstream nodes (DAG parents)
    backend: str
    version: str
    parameters: Dict[str, Any]
    output_sha256: str       # SHA-256 of the serialized output
    timestamp_utc: str       # ISO 8601
    status: str              # "OK", "WARNING", "FAILED"
    limitations: List[str] = field(default_factory=list)


@dataclass
class WorkflowProvenance:
    """Full provenance graph for a scientific workflow run."""
    workflow_id: str
    workflow_type: str       # e.g., "TRAJECTORY_ANALYSIS", "PROTEIN_LIGAND"
    nodes: List[WorkflowProvenanceNode]
    final_certificate_sha256: Optional[str]
    reproducibility_bundle_sha256: Optional[str]


# ---------------------------------------------------------------------------
# Abstract Analysis Backend (expanded, PASS 31)
# ---------------------------------------------------------------------------

class AnalysisBackend(ABC):
    """Abstract Base Class for trajectory and molecular analysis backends."""

    @property
    @abstractmethod
    def backend_name(self) -> str:
        pass

    @property
    @abstractmethod
    def version(self) -> str:
        pass

    @property
    @abstractmethod
    def license(self) -> str:
        pass

    @property
    @abstractmethod
    def capabilities(self) -> List[str]:
        pass

    @abstractmethod
    def compute_distance(
        self,
        topology_path: str,
        trajectory_path: str,
        selection_a: str,
        selection_b: str,
        pbc_mode: str = "orthorhombic_minimum_image"
    ) -> BackendDistanceResult:
        """Execute distance analysis across trajectory frames."""
        pass

    def validate_output(self, result: BackendDistanceResult) -> bool:
        """Verify output contract: finite floats, non-negative, shape matches n_frames."""
        if not isinstance(result.distances, np.ndarray):
            return False
        if len(result.distances) != result.n_frames:
            return False
        if not np.all(np.isfinite(result.distances)):
            return False
        if np.any(result.distances < 0.0):
            return False
        return True

    def is_available(self) -> bool:
        """Check whether this backend is installed and usable."""
        return "not installed" not in self.version


# ---------------------------------------------------------------------------
# Discrepancy Classification & Report
# ---------------------------------------------------------------------------

class DiscrepancyClassification(str, Enum):
    WITHIN_TOLERANCE = "WITHIN_TOLERANCE"
    DIFFERENT_ALGORITHM = "DIFFERENT_ALGORITHM"
    EXPECTED_METHODOLOGICAL_DIFFERENCE = "EXPECTED_METHODOLOGICAL_DIFFERENCE"
    GENUINE_DISCREPANCY = "GENUINE_DISCREPANCY"
    UNRESOLVED = "UNRESOLVED"


@dataclass
class DiscrepancyReport:
    classification: DiscrepancyClassification
    max_delta: float
    mean_delta: float
    tolerance: float
    mocs_method: str
    reference_method: str
    n_frames: int
    mismatched_frames: List[int]
    diagnosis: str
    primary_result: Optional[float] = None
    reference_result: Optional[float] = None
    likely_cause: Optional[str] = None
    status: str = "RESOLVED"   # "RESOLVED", "UNRESOLVED"


# ---------------------------------------------------------------------------
# Cryo-EM & Experimental Density Maps (PASS 32)
# ---------------------------------------------------------------------------

@dataclass
class CryoEMMapResult:
    """
    Canonical representation of a 3D Cryo-EM or electron tomography density map.
    Derived from standard MRC2014 or CCP4 files via mrcfile or Gemmi.
    """
    map_id: str
    grid_dimensions: Tuple[int, int, int]   # nx, ny, nz
    cell_dimensions: Tuple[float, float, float, float, float, float]  # a, b, c, alpha, beta, gamma [Å, deg]
    voxel_size: Tuple[float, float, float]  # voxel spacing in [Å/voxel]
    origin: Tuple[float, float, float]      # origin offset in [Å]
    density_min: float
    density_max: float
    density_mean: float
    density_rms: float
    space_group: int
    resolution_reported_angstrom: Optional[float]  # Reported FSC 0.143 resolution
    format: str                            # "MRC2014" or "CCP4"
    backend: str                           # "mrcfile" or "Gemmi"
    version: str
    provenance: Dict[str, Any]
    limitations: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Protein Sequence Design (PASS 32)
# ---------------------------------------------------------------------------

@dataclass
class SequenceDesignResult:
    """
    Result of machine learning sequence design (inverse folding, e.g., ProteinMPNN).
    """
    design_id: str
    target_structure_id: str
    native_sequence: str
    designed_sequence: str
    sequence_recovery: float               # Percentage match to native [0.0, 100.0]
    score: float                           # Global model score / log-odds
    model_name: str                        # "ProteinMPNN"
    model_version: str
    temperature: float                     # Sampling temperature (e.g. 0.1)
    seed: Optional[int]
    fixed_positions: List[int]
    redesigned_positions: List[int]
    backend: str
    version: str
    provenance: Dict[str, Any]
    limitations: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Biomolecular Complex Prediction (PASS 32)
# ---------------------------------------------------------------------------

@dataclass
class ComplexPredictionResult:
    """
    Result from next-generation multi-entity cofolding predictions (Boltz-1, OpenFold).
    Supports protein monomer, multimer complexes, protein-DNA, protein-RNA, and protein-ligand.
    """
    complex_id: str
    entities: List[Dict[str, Any]]          # [{chain: "A", type: "protein", seq: "..."}, ...]
    iptm_score: float                       # Interface predicted TM-score [0.0, 1.0]
    ptm_score: float                        # Predicted TM-score [0.0, 1.0]
    mean_plddt: float                       # Mean pLDDT confidence [0.0, 100.0]
    per_chain_plddt: Dict[str, float]       # Chain -> mean pLDDT
    model_name: str                         # e.g. "Boltz-1", "OpenFold"
    model_version: str
    weights_id: str
    seed: Optional[int]
    num_recycles: int
    source_type: StructureSourceType = StructureSourceType.PREDICTED
    backend: str = "Boltz-1"
    version: str = "v0.4.1"
    provenance: Dict[str, Any] = field(default_factory=dict)
    limitations: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Docking Poses & Consensus Scoring (PASS 32)
# ---------------------------------------------------------------------------

@dataclass
class DockingPoseResult:
    """
    Individual ligand binding pose generated by docking tools (AutoDock Vina, Smina).
    """
    pose_id: str
    ligand_id: str
    pose_index: int
    affinity_kcal_mol: float                # Empirical affinity score in kcal/mol
    rmsd_to_reference: Optional[float]      # Heavy-atom RMSD to crystallographic reference
    scoring_function: str                   # "vina", "vinardo", "smina_custom"
    box_center: Tuple[float, float, float]  # Grid search center (x, y, z) in Å
    box_size: Tuple[float, float, float]    # Grid search box dimensions (dx, dy, dz) in Å
    backend: str
    version: str
    provenance: Dict[str, Any]
    limitations: List[str] = field(default_factory=list)


@dataclass
class DockingResultSet:
    """Collection of ranked docking poses with search configuration."""
    docking_id: str
    receptor_id: str
    ligand_id: str
    poses: List[DockingPoseResult]
    best_affinity_kcal_mol: float
    scoring_function: str
    backend: str
    version: str
    provenance: Dict[str, Any]
    limitations: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# PASS 33: Pocket Detection & Ensemble Comparisons
# ---------------------------------------------------------------------------

@dataclass
class PocketPredictionResult:
    """
    Result of pocket detection (P2Rank, fpocket).
    Preserves exact upstream scores without renaming to 'druggability' or thermodynamic ΔG.
    """
    pocket_id: str
    structure_id: str
    prediction_score: float             # Raw upstream score (e.g. P2Rank score or fpocket druggability score)
    probability: Optional[float]         # Probability/confidence if provided by upstream (0.0 to 1.0)
    center: Tuple[float, float, float]  # Pocket geometric center (x, y, z) in Å
    residue_ids: List[str]               # Residues defining the binding cavity
    surface_atom_count: int              # Contributing surface atoms
    pocket_descriptors: Dict[str, Any]   # Method-specific descriptors (e.g., volume, SASA, polarity)
    backend: str                         # "P2Rank", "fpocket", "mdpocket"
    version: str
    provenance: Dict[str, Any]
    limitations: List[str] = field(default_factory=list)


@dataclass
class PocketEnsembleResult:
    """
    Comparative multi-engine pocket evaluation (P2Rank vs fpocket vs mdpocket).
    Reports spatial correspondence, residue Jaccard overlap, and explicit disagreement.
    """
    structure_id: str
    methods: List[str]                   # e.g., ["P2Rank", "fpocket"]
    pockets_by_method: Dict[str, List[PocketPredictionResult]]
    pocket_correspondence: List[Dict[str, Any]]  # Pairs/tuples of matched pockets with center distance
    spatial_overlap_angstrom: Dict[str, float]   # Center-to-center Euclidean distances in Å
    residue_jaccard_indices: Dict[str, float]    # Residue overlap Jaccard index [0.0, 1.0]
    volume_differences: Dict[str, float]         # Volume delta (Å³) between matching cavities
    disagreement_notes: List[str]                # Explicit scientific disagreement reporting
    backend: str = "PocketEnsembleEngine"
    version: str = "v1.0.0"
    provenance: Dict[str, Any] = field(default_factory=dict)
    limitations: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# PASS 33: Interaction Fingerprints & Ensemble
# ---------------------------------------------------------------------------

@dataclass
class InteractionFingerprintResult:
    """
    Protein-ligand interaction fingerprint with atom-level geometric parameters (ProLIF, PLIP).
    """
    complex_id: str
    receptor_id: str
    ligand_id: str
    bitvector: List[int]                # Binary interaction bitvector
    interactions: List[Dict[str, Any]]  # Atom-specific interactions (type, receptor_atom, ligand_atom, distance_angstrom, angle_degrees)
    total_contacts: int
    contact_types: List[str]            # e.g., ["HBond", "Hydrophobic", "PiStacking", "SaltBridge"]
    backend: str                        # "ProLIF", "PLIP"
    version: str
    provenance: Dict[str, Any]
    limitations: List[str] = field(default_factory=list)


@dataclass
class InteractionEnsembleResult:
    """
    Cross-engine non-covalent interaction comparison (ProLIF vs PLIP vs Arpeggio).
    """
    complex_id: str
    methods: List[str]                   # e.g., ["ProLIF", "PLIP"]
    interactions_by_method: Dict[str, InteractionFingerprintResult]
    common_interactions: List[Dict[str, Any]]
    unique_interactions: Dict[str, List[Dict[str, Any]]]
    disagreement_notes: List[str]
    backend: str = "InteractionEnsembleEngine"
    version: str = "v1.0.0"
    provenance: Dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# PASS 33: Structure & Sequence Search
# ---------------------------------------------------------------------------

@dataclass
class StructureSearchResult:
    """
    Result from macromolecular structural homology search (Foldseek, TM-align).
    Strictly separates structural alignment metrics from database annotations.
    """
    query_structure_id: str
    hits: List[Dict[str, Any]]          # [{target_id, tm_score, rmsd, aligned_length, seq_identity, query_coverage, target_coverage}]
    alignment_algorithm: str            # "Foldseek-3Di", "TM-align", "US-align"
    database_searched: str              # "PDB100", "AFDB-v4"
    backend: str                        # "Foldseek"
    version: str
    provenance: Dict[str, Any]
    limitations: List[str] = field(default_factory=list)


@dataclass
class SequenceHomologyResult:
    """
    Result from sequence homology search (MMseqs2, HMMER, HH-suite).
    Strictly separates raw alignment metrics from optional external taxonomy annotations.
    """
    query_sequence_id: str
    hits: List[Dict[str, Any]]          # [{target_id, e_value, bitscore, raw_score, seq_identity, query_coverage, target_coverage}]
    database_searched: str
    backend: str                        # "MMseqs2", "PyHMMER"
    version: str
    taxonomy_annotation_source: Optional[str] = None  # Separated taxonomy metadata
    provenance: Dict[str, Any] = field(default_factory=dict)
    limitations: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# PASS 33: Ligand Pose Validation
# ---------------------------------------------------------------------------

@dataclass
class LigandValidationResult:
    """
    In silico chemical and geometric sanity check for docked or generated ligands (PoseBusters, RDKit).
    """
    ligand_id: str
    passes_all_checks: bool
    bond_length_check: bool             # Bond lengths within physical tolerance
    bond_angle_check: bool              # Bond angles within physical tolerance
    clash_check: bool                   # No severe steric overlaps with receptor (< 2.0 Å)
    stereochemistry_check: bool         # Chiral centers preserved without inversion
    aromaticity_check: bool             # Aromatic rings flat and valid
    formal_charge_check: bool           # Realistic formal charges
    clash_count: int
    max_bond_deviation_angstrom: float
    violations: List[str]
    backend: str                        # "PoseBusters", "RDKit"
    version: str
    provenance: Dict[str, Any]
    limitations: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# PASS 33: Prediction Consensus & Disagreement (Without Coordinate Averaging)
# ---------------------------------------------------------------------------

@dataclass
class EnsembleConsensusResult:
    """
    Multi-model structural difference and consensus report (Boltz-1, OpenFold, Chai-1, Protenix).
    CRITICAL: Never averages coordinates. Aligns structures and maps consensus spans vs disagreement loops.
    """
    sequence_id: str
    models_evaluated: List[str]         # e.g., ["Boltz-1", "OpenFold", "Chai-1"]
    pairwise_rmsd_matrix: Dict[str, Dict[str, float]]  # Pairwise C-alpha RMSD in Å
    mean_pairwise_rmsd: float
    consensus_residue_spans: List[Tuple[int, int]]     # 1-indexed residue spans where all pairwise distances < threshold
    disagreement_residue_spans: List[Tuple[int, int]]  # High-variance / flexible loop / domain shifts (>= threshold)
    model_confidences: Dict[str, Dict[str, float]]     # Model -> {plddt, ptm, iptm} (retained per model)
    distance_threshold_angstrom: float = 1.5
    backend: str = "ConsensusPredictionEngine"
    version: str = "v1.0.0"
    provenance: Dict[str, Any] = field(default_factory=dict)
    limitations: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# PASS 33: Dataset Benchmark & Leakage Governance
# ---------------------------------------------------------------------------

@dataclass
class DatasetBenchmarkSpec:
    """
    Benchmark dataset resource specification (ProteinNet, SidechainNet, PDBBind).
    Enforces split protection, release cutoff dates, and data leakage checks.
    """
    dataset_name: str                   # "ProteinNet", "SidechainNet", "PDBBind"
    version: str                        # e.g., "CASP12", "v2020"
    split_type: str                     # "TRAIN", "VALIDATION", "TEST"
    release_cutoff_date: str            # YYYY-MM-DD
    sequence_clustering_threshold: float # e.g., 0.30 (30% identity)
    total_entries: int
    has_data_leakage: bool
    leakage_details: List[str]
    provenance: Dict[str, Any]
    limitations: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# PASS 33: Sequence ↔ Structure Mapping (PDBe-SIFTS)
# ---------------------------------------------------------------------------

@dataclass
class SequenceStructureMapping:
    """
    Residue-level alignment between UniProt sequence and PDB 3D coordinates (PDBe-SIFTS).
    Preserves author vs label numbering, insertion codes, and missing coordinates.
    """
    uniprot_accession: str
    pdb_id: str
    entity_id: str
    chain_id: str
    residue_mappings: List[Dict[str, Any]]  # [{uniprot_pos, uniprot_aa, pdb_resnum, pdb_inscode, pdb_aa, has_3d_coords}]
    missing_residue_count: int
    coverage_percentage: float
    backend: str = "PDBe-SIFTS"
    version: str = "v2.0"
    provenance: Dict[str, Any] = field(default_factory=dict)
    limitations: List[str] = field(default_factory=list)

