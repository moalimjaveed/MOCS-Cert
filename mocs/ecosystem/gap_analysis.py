"""
mocs.ecosystem.gap_analysis — Scientific Capability Taxonomy & Gap Decision Engine.

PASS 32 Flagship Community Scientific Workstation:
Exhaustive taxonomy across 16 core domains (A–P), tracking MOCS-Cert implementation
status against premier open-source tools with explicit decisions:
INTEGRATE, DELEGATE, ORACLE-ONLY, EXTERNAL-WORKER, NATIVE IMPLEMENTATION,
OPTIONAL, RESEARCH-ONLY, REJECT, DEFER.
"""

from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Dict, Any, List, Optional


class GapDecision(str, Enum):
    INTEGRATE = "INTEGRATE"
    DELEGATE = "DELEGATE"
    ORACLE_ONLY = "ORACLE-ONLY"
    EXTERNAL_WORKER = "EXTERNAL-WORKER"
    NATIVE_IMPLEMENTATION = "NATIVE IMPLEMENTATION"
    OPTIONAL = "OPTIONAL"
    RESEARCH_ONLY = "RESEARCH-ONLY"
    REJECT = "REJECT"
    DEFER = "DEFER"


TAXONOMY_DOMAINS: Dict[str, Dict[str, Any]] = {
    "A": {
        "title": "Data Sources",
        "description": "Experimental, predicted, designed, and synthetic structural databases and repositories",
        "primary_packages": ["RCSB PDB", "UniProt", "AlphaFold DB", "PDBe-KB / 3D-Beacons", "EMDB", "PDBbind"],
    },
    "B": {
        "title": "Structure Formats",
        "description": "Standard community file formats for biopolymers, small molecules, and coordinate frames",
        "primary_packages": ["mrcfile", "Gemmi", "Biotite", "MDAnalysis", "Chemfiles"],
    },
    "C": {
        "title": "Structural Biology",
        "description": "Biopolymer structure normalization, assemblies, symmetry, B-factors, and geometry validation",
        "primary_packages": ["Biopython", "ProDy", "Biotite", "Gemmi", "cctbx", "MolProbity"],
    },
    "D": {
        "title": "Molecular Dynamics",
        "description": "Trajectory streaming, PBC handling, geometric observables, RMSD/RMSF, and autocorrelation",
        "primary_packages": ["MDAnalysis", "MDTraj", "ParmEd", "OpenMM", "GROMACS", "LAMMPS", "NAMD", "OpenMMTools"],
    },
    "E": {
        "title": "Chemistry & Small Molecules",
        "description": "Cheminformatics, SMILES/SMARTS, substructure search, fingerprints, and 3D conformer generation",
        "primary_packages": ["RDKit", "Open Babel", "OpenFF Toolkit", "OpenFF Interchange"],
    },
    "F": {
        "title": "Protein–Ligand Interactions & Pockets",
        "description": "Non-covalent contacts, hydrogen bonds, salt bridges, pi-stacking, cavities, and pockets",
        "primary_packages": ["P2Rank", "fpocket", "mdpocket", "ProLIF", "PLIP", "Arpeggio", "PoseBusters"],
    },
    "G": {
        "title": "Protein Structure Prediction",
        "description": "Monomer, multimer, protein-DNA/RNA, and protein-ligand deep learning cofolding",
        "primary_packages": ["AlphaFold DB", "OpenFold", "OpenFold3", "Boltz-1", "Chai-1", "Protenix", "ESMFold"],
    },
    "H": {
        "title": "Protein Design",
        "description": "Inverse folding, sequence design, backbone generation, and motif scaffolding",
        "primary_packages": ["ProteinMPNN", "RFdiffusion", "RFdiffusion2", "BindCraft", "Ovo", "ProteinDJ"],
    },
    "I": {
        "title": "Molecular Docking & Pose Validation",
        "description": "Receptor-ligand binding pose search, empirical scoring, and chemical/physical pose validation",
        "primary_packages": ["AutoDock Vina", "smina", "gnina", "rDock", "DiffDock", "PoseBusters"],
    },
    "J": {
        "title": "Crystallography",
        "description": "Space group symmetry, unit cells, structure factors, and electron density calculations",
        "primary_packages": ["Gemmi", "cctbx", "DIALS"],
    },
    "K": {
        "title": "Cryo-EM & Tomography",
        "description": "3D density map parsing (MRC/CCP4), voxel dimensions, map statistics, and density inspection",
        "primary_packages": ["mrcfile", "TemPy", "RELION", "cisTEM", "EMAN2", "Scipion"],
    },
    "L": {
        "title": "NMR Ensembles",
        "description": "Multi-model structural ensembles, ensemble statistics, and structural flexibility",
        "primary_packages": ["Biopython NMR", "ProDy NMR", "CCPN", "NMRFx"],
    },
    "M": {
        "title": "Structural Dynamics",
        "description": "Normal-mode analysis, anisotropic network models (ANM), PCA, and cross-correlations",
        "primary_packages": ["ProDy", "Biotite", "deeptime"],
    },
    "N": {
        "title": "Machine-Learning Biology & Quantum Chemistry",
        "description": "Protein language model embeddings, neural network potentials, and ab initio quantum methods",
        "primary_packages": ["DeepChem", "TorchANI", "PySCF", "ESMFold"],
    },
    "O": {
        "title": "Bioinformatics & Sequence Homology",
        "description": "Ultra-fast sequence search, profile HMMs, multiple sequence alignment, and clustering",
        "primary_packages": ["MMseqs2", "PyHMMER", "Biopython", "HH-suite", "MAFFT", "MUSCLE", "DIAMOND"],
    },
    "P": {
        "title": "Macromolecular Structural Search",
        "description": "3Di structural alphabet search, structural alignment, TM-score, and fold classification",
        "primary_packages": ["Foldseek", "US-align", "TM-align"],
    },
    "Q": {
        "title": "Free-Energy Calculations & Alchemical Perturbations",
        "description": "Relative and absolute binding free energy, alchemical perturbation networks, MBAR/BAR estimators",
        "primary_packages": ["pymbar", "alchemlyb", "OpenFE", "OpenMMTools"],
    },
    "R": {
        "title": "Sequence-to-Structure Mapping",
        "description": "Residue-level alignment between UniProt sequences and PDB 3D atomic coordinates",
        "primary_packages": ["PDBe-SIFTS"],
    },
    "S": {
        "title": "Benchmark Datasets & Split Integrity",
        "description": "Standard structural biology ML benchmarks, release date cutoffs, and sequence leakage prevention",
        "primary_packages": ["ProteinNet", "SidechainNet", "PDBBind", "CrossDocked"],
    },
    "T": {
        "title": "Molecular Visualization & 3D Media",
        "description": "3D biopolymer rendering, WebGL calipers, publication figures, and photorealistic 3D node graphs",
        "primary_packages": ["Mol*", "3Dmol.js", "NGL Viewer", "MolecularNodes"],
    },
    "U": {
        "title": "Scientific Graph Theory & Spatial Algorithms",
        "description": "Residue interaction networks, graph centrality, spatial AABB trees, and topological invariants",
        "primary_packages": ["MOCS-Cert Native", "NetworkX", "SciPy", "NumPy"],
    },
    "V": {
        "title": "Single-Cell & Spatial Omics",
        "description": "AnnData format streaming, single-cell transcriptomics, spatial coordinates, and cell neighborhood graphs",
        "primary_packages": ["Scanpy", "AnnData", "scvi-tools", "napari", "SpatialData"],
    },
}


@dataclass(frozen=True)
class CapabilityGap:
    capability: str
    domain: str
    current_mocs_status: str
    best_open_source: str
    license: str
    scientific_maturity: str
    integration_mode: str
    oracle: str
    ui_access: str
    priority: str
    status: str
    decision: GapDecision
    decision_rationale: str


CAPABILITY_GAPS: List[CapabilityGap] = [
    # --- PASS 33 Expanded Capability Gaps ---
    # Domain F: Protein-Ligand Interactions & Pockets
    CapabilityGap(
        capability="P2Rank ML Pocket Detection & Ranking",
        domain="F",
        current_mocs_status="P2RankAdapter (External Worker / Subprocess)",
        best_open_source="P2Rank",
        license="MIT",
        scientific_maturity="Tier S (Premier ML pocket ranking)",
        integration_mode="External Worker Subprocess",
        oracle="P2Rank 2.4",
        ui_access="Pocket Panel",
        priority="P0",
        status="ACTIVE",
        decision=GapDecision.EXTERNAL_WORKER,
        decision_rationale="MIT license permits integration; external worker isolates Java runtime while providing machine learning pocket prediction.",
    ),
    CapabilityGap(
        capability="ProLIF Non-Covalent Interaction Fingerprints",
        domain="F",
        current_mocs_status="ProLIFAdapter (In-Process & Analytical Fallback)",
        best_open_source="ProLIF",
        license="Apache-2.0",
        scientific_maturity="Tier S (Leading Python IFP library)",
        integration_mode="In-process native library",
        oracle="ProLIF 2.0",
        ui_access="Interaction Matrix / Bitvector View",
        priority="P0",
        status="ACTIVE",
        decision=GapDecision.INTEGRATE,
        decision_rationale="Permissive Apache-2.0 license; computes deterministic geometric interaction bitvectors across trajectory frames.",
    ),
    CapabilityGap(
        capability="fpocket Voronoi Cavity Detection",
        domain="F",
        current_mocs_status="fpocketAdapter (Subprocess / Oracle)",
        best_open_source="fpocket",
        license="MIT",
        scientific_maturity="Tier S (Classic Voronoi pocket detector)",
        integration_mode="Subprocess CLI worker",
        oracle="fpocket 4.0",
        ui_access="Cavity Surface View",
        priority="P1",
        status="ACTIVE",
        decision=GapDecision.EXTERNAL_WORKER,
        decision_rationale="MIT license permits packaging; C binary runs in external worker producing alpha spheres and volume descriptors.",
    ),
    CapabilityGap(
        capability="Pocket Ensemble Cross-Method Comparison",
        domain="F",
        current_mocs_status="PocketEnsembleEngine (Native MOCS)",
        best_open_source="MOCS Native + P2Rank + fpocket",
        license="Apache-2.0",
        scientific_maturity="Tier S (Rigorous cross-engine consensus)",
        integration_mode="In-process native engine",
        oracle="Multi-method comparison",
        ui_access="Pocket Consensus Inspector",
        priority="P0",
        status="ACTIVE",
        decision=GapDecision.NATIVE_IMPLEMENTATION,
        decision_rationale="Computes spatial Euclidean distance and residue Jaccard overlap to report agreement and discrepancies across methods.",
    ),

    # Domain G: Protein Structure Prediction
    CapabilityGap(
        capability="Multi-Model Prediction Consensus (No Coordinate Averaging)",
        domain="G",
        current_mocs_status="ConsensusPredictionEngine (Native MOCS)",
        best_open_source="MOCS Native + Boltz-1 + OpenFold + Chai-1",
        license="Apache-2.0",
        scientific_maturity="Tier S (Physically rigorous model consensus)",
        integration_mode="In-process native engine",
        oracle="Multi-model alignment",
        ui_access="Structure Difference Studio",
        priority="P0",
        status="ACTIVE",
        decision=GapDecision.NATIVE_IMPLEMENTATION,
        decision_rationale="Strictly prohibits coordinate averaging. Employs C-alpha Kabsch superposition to map consensus spans (<1.5 Å) and flexible loops.",
    ),
    CapabilityGap(
        capability="Chai-1 Biomolecular Complex Prediction",
        domain="G",
        current_mocs_status="Chai-1 registered as optional external worker",
        best_open_source="Chai-1",
        license="Apache-2.0",
        scientific_maturity="Tier A (SOTA complex cofolding)",
        integration_mode="External Worker Subprocess",
        oracle="Chai-1 v0.5",
        ui_access="Complex Prediction Studio",
        priority="P1",
        status="ACTIVE",
        decision=GapDecision.EXTERNAL_WORKER,
        decision_rationale="Apache-2.0 permissive code and weights; multi-entity cofolding with interface confidence metrics.",
    ),

    # Domain I: Molecular Docking & Pose Validation
    CapabilityGap(
        capability="PoseBusters Ligand Physical Sanity Validation",
        domain="I",
        current_mocs_status="PoseBustersAdapter (In-Process & Analytical Validator)",
        best_open_source="PoseBusters",
        license="BSD-3-Clause",
        scientific_maturity="Tier S (Standard benchmark for docked poses)",
        integration_mode="In-process / Subprocess",
        oracle="PoseBusters 0.4",
        ui_access="Pose Quality Audit",
        priority="P0",
        status="ACTIVE",
        decision=GapDecision.INTEGRATE,
        decision_rationale="Permissive BSD-3-Clause license; verifies 18 physical-chemistry sanity checks (bond lengths, clashes, stereochemistry).",
    ),

    # Domain O: Bioinformatics & Sequence Homology
    CapabilityGap(
        capability="MMseqs2 Fast Sequence Search & Clustering",
        domain="O",
        current_mocs_status="MMseqs2Adapter (Subprocess / Oracle)",
        best_open_source="MMseqs2",
        license="GPL-3.0",
        scientific_maturity="Tier S (Ultra-fast sequence search standard)",
        integration_mode="Subprocess CLI worker",
        oracle="MMseqs2 15",
        ui_access="Sequence Search View",
        priority="P0",
        status="ACTIVE",
        decision=GapDecision.EXTERNAL_WORKER,
        decision_rationale="GPL-3.0 copyleft code strictly quarantined behind CLI process boundary. Provides sensitive sequence homology search.",
    ),

    # Domain P: Macromolecular Structural Search
    CapabilityGap(
        capability="Foldseek 3Di Fast Structural Search",
        domain="P",
        current_mocs_status="FoldseekAdapter (Subprocess / Oracle)",
        best_open_source="Foldseek",
        license="GPL-3.0",
        scientific_maturity="Tier S (Revolutionary structure search standard)",
        integration_mode="Subprocess CLI worker",
        oracle="Foldseek v9",
        ui_access="Structure Search View",
        priority="P0",
        status="ACTIVE",
        decision=GapDecision.EXTERNAL_WORKER,
        decision_rationale="GPL-3.0 copyleft code strictly quarantined behind CLI process boundary. Searches millions of AlphaFold structures in seconds.",
    ),

    # Domain Q: Free-Energy Calculations
    CapabilityGap(
        capability="Alchemical Free Energy Network Analysis (OpenFE)",
        domain="Q",
        current_mocs_status="OpenFE registered as optional library",
        best_open_source="OpenFE / alchemlyb / pymbar",
        license="MIT / BSD-3",
        scientific_maturity="Tier A (Leading open free energy tool)",
        integration_mode="Optional Python library",
        oracle="OpenFE / MBAR",
        ui_access="Free Energy Network View",
        priority="P1",
        status="ACTIVE",
        decision=GapDecision.OPTIONAL,
        decision_rationale="Permissive MIT license; executes alchemical perturbation networks with pymbar statistical estimators.",
    ),

    # Domain R: Sequence-to-Structure Mapping
    CapabilityGap(
        capability="PDBe-SIFTS UniProt-to-PDB Residue Mapping",
        domain="R",
        current_mocs_status="SIFTSMappingAdapter (Native In-Process)",
        best_open_source="PDBe-SIFTS",
        license="CC0-1.0",
        scientific_maturity="Tier S (Official EBI SIFTS resource)",
        integration_mode="In-process native parser",
        oracle="PDBe SIFTS API",
        ui_access="Residue Mapping Inspector",
        priority="P0",
        status="ACTIVE",
        decision=GapDecision.INTEGRATE,
        decision_rationale="Public Domain CC0-1.0; bridges UniProt canonical sequences to PDB 3D coordinates while preserving author numbering.",
    ),

    # Domain S: Benchmark Datasets & Split Integrity
    CapabilityGap(
        capability="Benchmark Split Protection & Data Leakage Check",
        domain="S",
        current_mocs_status="BenchmarkLeakageDetector (Native MOCS)",
        best_open_source="ProteinNet / SidechainNet / PDBBind",
        license="CC-BY / BSD-3 / Academic",
        scientific_maturity="Tier S (Scientific ML integrity standard)",
        integration_mode="In-process native engine",
        oracle="Benchmark Split Rules",
        ui_access="Benchmark Audit View",
        priority="P0",
        status="ACTIVE",
        decision=GapDecision.NATIVE_IMPLEMENTATION,
        decision_rationale="Enforces split protection, release cutoff dates, and sequence homology filtering to prevent data leakage.",
    ),

    # Domain T: Molecular Visualization & 3D Media
    CapabilityGap(
        capability="Blender MolecularNodes Scene Export",
        domain="T",
        current_mocs_status="MolecularNodes registered as external provider",
        best_open_source="MolecularNodes",
        license="GPL-3.0",
        scientific_maturity="Tier A (Premier 3D molecular animation)",
        integration_mode="External Provider / Script Generator",
        oracle="Blender 4.x + MolecularNodes",
        ui_access="Export -> Blender Scene",
        priority="P2",
        status="ACTIVE",
        decision=GapDecision.DELEGATE,
        decision_rationale="GPL-3.0 Blender addon; MOCS generates clean Python/USD scene definitions without bundling copyleft code.",
    ),

    # Domain V: Single-Cell & Spatial Omics
    CapabilityGap(
        capability="Single-Cell Spatial Transcriptomics Streaming (Scanpy)",
        domain="V",
        current_mocs_status="Scanpy registered as optional adjacent library",
        best_open_source="Scanpy / AnnData",
        license="BSD-3-Clause",
        scientific_maturity="Tier S (Standard single-cell ecosystem)",
        integration_mode="Optional Python library",
        oracle="Scanpy 1.10",
        ui_access="Single-Cell Spatial View",
        priority="P2",
        status="ACTIVE",
        decision=GapDecision.OPTIONAL,
        decision_rationale="Permissive BSD-3-Clause; allows MOCS to visualize macromolecular targets within cellular and tissue spatial contexts.",
    ),

    # Domain A: Data Sources
    CapabilityGap(
        capability="RCSB PDB API Ingestion",
        domain="A",
        current_mocs_status="Native REST client + Local cache",
        best_open_source="rcsbsearch / Biopython",
        license="BSD-3-Clause",
        scientific_maturity="Tier S (PDB official)",
        integration_mode="Direct HTTP / Local",
        oracle="RCSB Data Portal",
        ui_access="Catalog / Loader",
        priority="P0",
        status="ACTIVE",
        decision=GapDecision.INTEGRATE,
        decision_rationale="Core requirement for experimental structural ground truth.",
    ),
    CapabilityGap(
        capability="AlphaFold DB Structure Ingestion",
        domain="A",
        current_mocs_status="Native REST client with explicit PREDICTED badge",
        best_open_source="EBI AlphaFold API",
        license="CC-BY 4.0",
        scientific_maturity="Tier S (EMBL-EBI)",
        integration_mode="Direct HTTP",
        oracle="AlphaFold DB v4",
        ui_access="Catalog / Loader",
        priority="P0",
        status="ACTIVE",
        decision=GapDecision.INTEGRATE,
        decision_rationale="Essential for high-throughput structural coverage; strictly badge-isolated.",
    ),

    # Domain B: Structure Formats
    CapabilityGap(
        capability="PDB / mmCIF Parsing & Normalization",
        domain="B",
        current_mocs_status="Native parser + Mol* engine",
        best_open_source="Gemmi / Biopython",
        license="MPL-2.0 / BSD-3",
        scientific_maturity="Tier S (Industry standard)",
        integration_mode="In-process native + WebGL",
        oracle="Gemmi / MDAnalysis",
        ui_access="3D Viewport / Inspector",
        priority="P0",
        status="ACTIVE",
        decision=GapDecision.NATIVE_IMPLEMENTATION,
        decision_rationale="Zero-latency client-side parsing with strict chemical component validation.",
    ),
    CapabilityGap(
        capability="Cryo-EM MRC2014 / CCP4 Map Reading",
        domain="B",
        current_mocs_status="In-process MRCMapAdapter via mrcfile",
        best_open_source="mrcfile",
        license="BSD-3-Clause",
        scientific_maturity="Tier S (CCPEM standard)",
        integration_mode="In-process Python library",
        oracle="mrcfile / Gemmi",
        ui_access="Map Inspector / Metadata Strip",
        priority="P1",
        status="ACTIVE",
        decision=GapDecision.INTEGRATE,
        decision_rationale="Permissive BSD library provides authoritative density grid and unit cell extraction.",
    ),

    # Domain C: Structural Biology
    CapabilityGap(
        capability="Ramachandran & Rotamer Quality Validation",
        domain="C",
        current_mocs_status="Native phi/psi dihedrals + MolProbity criteria",
        best_open_source="MolProbity",
        license="MIT / Academic",
        scientific_maturity="Tier S (PDB validation standard)",
        integration_mode="Optional / Subprocess Oracle",
        oracle="MolProbity",
        ui_access="Structure Quality View",
        priority="P1",
        status="ACTIVE",
        decision=GapDecision.ORACLE_ONLY,
        decision_rationale="Complex Java/C codebase isolated behind oracle validation boundary.",
    ),

    # Domain D: Molecular Dynamics
    CapabilityGap(
        capability="Streaming Trajectory Parsing (GRO/XTC/TRR/DCD)",
        domain="D",
        current_mocs_status="Native streaming index + MDAnalysis oracle",
        best_open_source="MDAnalysis / MDTraj",
        license="GPL-2.0 / LGPL-2.1",
        scientific_maturity="Tier S (Standard trajectory engines)",
        integration_mode="MCI spatial index + Subprocess oracle",
        oracle="MDAnalysis Universe",
        ui_access="Timeline / Trajectory Scrub",
        priority="P0",
        status="ACTIVE",
        decision=GapDecision.NATIVE_IMPLEMENTATION,
        decision_rationale="Native MCI spatial radix tree achieves sub-linear query times; MDAnalysis serves as oracle.",
    ),
    CapabilityGap(
        capability="Topology Conversion (Amber, CHARMM, Gromacs)",
        domain="D",
        current_mocs_status="Studied; optional adapter interface",
        best_open_source="ParmEd",
        license="LGPL-2.1-or-later",
        scientific_maturity="Tier A (Community standard)",
        integration_mode="Optional Python adapter",
        oracle="ParmEd",
        ui_access="Import Modal",
        priority="P2",
        status="ACTIVE",
        decision=GapDecision.OPTIONAL,
        decision_rationale="Permits cross-format topology migration without GPL copyleft viral contamination.",
    ),

    # Domain E: Chemistry
    CapabilityGap(
        capability="Small-Molecule RDKit Cheminformatics & SMARTS",
        domain="E",
        current_mocs_status="Optional adapter + canonical smiles",
        best_open_source="RDKit",
        license="BSD-3-Clause",
        scientific_maturity="Tier S (Premier cheminformatics)",
        integration_mode="In-process Python adapter",
        oracle="RDKit Chem",
        ui_access="Ligand Inspector",
        priority="P1",
        status="ACTIVE",
        decision=GapDecision.OPTIONAL,
        decision_rationale="Premier open-source cheminformatics toolkit; BSD permissive license.",
    ),

    # Domain F: Protein-Ligand
    CapabilityGap(
        capability="Non-Covalent Interaction Profiling (PLIP)",
        domain="F",
        current_mocs_status="Subprocess oracle adapter",
        best_open_source="PLIP",
        license="GPL-2.0",
        scientific_maturity="Tier S (Well-benchmarked)",
        integration_mode="CLI Subprocess JSON pipe",
        oracle="PLIP CLI",
        ui_access="Interaction Inspector",
        priority="P1",
        status="ACTIVE",
        decision=GapDecision.EXTERNAL_WORKER,
        decision_rationale="GPL-2.0 license strictly quarantined behind CLI process boundary.",
    ),
    CapabilityGap(
        capability="Pocket & Cavity Detection (fpocket)",
        domain="F",
        current_mocs_status="Subprocess oracle adapter",
        best_open_source="fpocket",
        license="GPL-3.0",
        scientific_maturity="Tier A (Voronoi tessellation standard)",
        integration_mode="CLI Subprocess pipe",
        oracle="fpocket CLI",
        ui_access="Pocket Grid View",
        priority="P1",
        status="ACTIVE",
        decision=GapDecision.EXTERNAL_WORKER,
        decision_rationale="GPL-3.0 license isolated to subprocess; prevents false active-site claims.",
    ),

    # Domain G: Protein Structure Prediction
    CapabilityGap(
        capability="Biomolecular Multi-Entity Complex Cofolding",
        domain="G",
        current_mocs_status="BoltzAdapter + Canonical ComplexPredictionResult",
        best_open_source="Boltz-1",
        license="MIT (code) / CC-BY-4.0 (weights)",
        scientific_maturity="Tier A (State-of-the-art open complex model)",
        integration_mode="Optional / Worker Adapter",
        oracle="Boltz-1 / OpenFold",
        ui_access="Prediction Explorer",
        priority="P1",
        status="ACTIVE",
        decision=GapDecision.OPTIONAL,
        decision_rationale="Permissive MIT code and open CC-BY weights enable full biomolecular complex cofolding.",
    ),
    CapabilityGap(
        capability="Trainable AlphaFold2 PyTorch Reproduction",
        domain="G",
        current_mocs_status="OpenFold evaluated and registered",
        best_open_source="OpenFold",
        license="Apache-2.0 (code) / CC0 (weights)",
        scientific_maturity="Tier S (Validated reproduction)",
        integration_mode="Optional Adapter",
        oracle="OpenFold",
        ui_access="Model Settings",
        priority="P2",
        status="ACTIVE",
        decision=GapDecision.OPTIONAL,
        decision_rationale="Fully permissive Apache-2.0/CC0 code and weights suitable for open verification.",
    ),

    # Domain H: Protein Design
    CapabilityGap(
        capability="Fixed-Backbone Sequence Design (ProteinMPNN)",
        domain="H",
        current_mocs_status="Integrated ProteinMPNNAdapter + Canonical DesignResult",
        best_open_source="ProteinMPNN",
        license="MIT",
        scientific_maturity="Tier S (Experimental gold standard)",
        integration_mode="Native interface + Model adapter",
        oracle="ProteinMPNN vanilla",
        ui_access="Design Studio",
        priority="P1",
        status="ACTIVE",
        decision=GapDecision.INTEGRATE,
        decision_rationale="Fully permissive MIT code and weights; provides deterministic inverse folding.",
    ),
    CapabilityGap(
        capability="De Novo Backbone Generation (RFdiffusion)",
        domain="H",
        current_mocs_status="Quarantined & REJECTED from core distribution",
        best_open_source="RFdiffusion",
        license="BSD-3 (code) / Non-Commercial (weights)",
        scientific_maturity="Tier A (SOTA diffusion design)",
        integration_mode="Studied / Research-Only (Excluded from distribution)",
        oracle="RFdiffusion",
        ui_access="None (Quarantined)",
        priority="P3",
        status="QUARANTINED",
        decision=GapDecision.REJECT,
        decision_rationale="RosettaCommons non-commercial weights license violates Apache-2.0 open distribution.",
    ),

    # Domain I: Molecular Docking
    CapabilityGap(
        capability="Receptor-Ligand Empirical Docking (AutoDock Vina)",
        domain="I",
        current_mocs_status="AutoDockVinaAdapter (Subprocess boundary)",
        best_open_source="AutoDock Vina 1.2+",
        license="Apache-2.0",
        scientific_maturity="Tier S (Widely cited docking standard)",
        integration_mode="Subprocess / Optional Python bindings",
        oracle="AutoDock Vina",
        ui_access="Docking Panel",
        priority="P1",
        status="ACTIVE",
        decision=GapDecision.EXTERNAL_WORKER,
        decision_rationale="Permissive Apache-2.0 license; isolated worker prevents blocking main workstation.",
    ),
    CapabilityGap(
        capability="Custom Scoring Function Docking (smina)",
        domain="I",
        current_mocs_status="SminaDockingAdapter (Isolated CLI worker)",
        best_open_source="smina",
        license="GPL-2.0",
        scientific_maturity="Tier A (Vinardo scoring)",
        integration_mode="Subprocess CLI pipe",
        oracle="smina binary",
        ui_access="Docking Panel",
        priority="P2",
        status="ACTIVE",
        decision=GapDecision.EXTERNAL_WORKER,
        decision_rationale="GPL-2.0 copyleft isolated behind CLI boundary.",
    ),

    # Domain J: Crystallography
    CapabilityGap(
        capability="Unit Cell & Space Group Symmetry Operations",
        domain="J",
        current_mocs_status="GemmiBackendAdapter + CrystallographicResult",
        best_open_source="Gemmi / cctbx",
        license="MPL-2.0 / BSD-3",
        scientific_maturity="Tier S (PDB official validation)",
        integration_mode="Optional in-process adapter",
        oracle="Gemmi / cctbx",
        ui_access="Crystallography Inspector",
        priority="P1",
        status="ACTIVE",
        decision=GapDecision.OPTIONAL,
        decision_rationale="Weak copyleft MPL-2.0 dynamically linked; provides authoritative symmetry operations.",
    ),

    # Domain K: Cryo-EM
    CapabilityGap(
        capability="Cryo-EM 3D Density Map Inspection & Statistics",
        domain="K",
        current_mocs_status="MRCMapAdapter via mrcfile (In-process)",
        best_open_source="mrcfile",
        license="BSD-3-Clause",
        scientific_maturity="Tier S (CCPEM standard)",
        integration_mode="Core in-process adapter",
        oracle="mrcfile / ChimeraX",
        ui_access="Density Map Strip",
        priority="P1",
        status="ACTIVE",
        decision=GapDecision.INTEGRATE,
        decision_rationale="Permissive BSD-3-Clause library already installed and operational.",
    ),
    CapabilityGap(
        capability="Cryo-EM Map-to-Model Local Quality Fitting (SMOC)",
        domain="K",
        current_mocs_status="TemPy registered as subprocess oracle",
        best_open_source="TemPy",
        license="GPL-3.0",
        scientific_maturity="Tier A (Published validation metric)",
        integration_mode="Subprocess CLI pipe",
        oracle="TemPy CLI",
        ui_access="Density Fit Score",
        priority="P2",
        status="ACTIVE",
        decision=GapDecision.EXTERNAL_WORKER,
        decision_rationale="GPL-3.0 copyleft isolated to external subprocess; compute-heavy density correlation.",
    ),

    # Domain L: NMR
    CapabilityGap(
        capability="Multi-Model NMR Ensemble Analysis & Variance",
        domain="L",
        current_mocs_status="Native ensemble model iteration + Biopython/ProDy",
        best_open_source="Biopython / ProDy",
        license="BSD-3 / MIT",
        scientific_maturity="Tier S (PDB standard)",
        integration_mode="Native iteration + Optional adapter",
        oracle="ProDy / MDAnalysis",
        ui_access="Ensemble Inspector",
        priority="P1",
        status="ACTIVE",
        decision=GapDecision.NATIVE_IMPLEMENTATION,
        decision_rationale="Native PDB/mmCIF model block iteration handles multi-model coordinate ensembles.",
    ),

    # Domain M: Structural Dynamics
    CapabilityGap(
        capability="Anisotropic Network Models (ANM/GNM) & NMA",
        domain="M",
        current_mocs_status="ProDyBackendAdapter (Optional)",
        best_open_source="ProDy",
        license="MIT",
        scientific_maturity="Tier A (Leading normal mode tool)",
        integration_mode="Optional Python adapter",
        oracle="ProDy ANM",
        ui_access="Dynamics View",
        priority="P1",
        status="ACTIVE",
        decision=GapDecision.OPTIONAL,
        decision_rationale="Permissive MIT license; provides elastic network normal mode decomposition.",
    ),

    # Domain N: Machine-Learning Biology
    CapabilityGap(
        capability="Neural Network Potentials for Forces & Energy (ANI)",
        domain="N",
        current_mocs_status="TorchANI registered as optional adapter",
        best_open_source="TorchANI",
        license="MIT",
        scientific_maturity="Tier A (Accurate quantum potentials)",
        integration_mode="Optional Python adapter",
        oracle="TorchANI",
        ui_access="Energy Telemetry",
        priority="P2",
        status="ACTIVE",
        decision=GapDecision.OPTIONAL,
        decision_rationale="Permissive MIT license; enables DFT-accuracy organic molecular potentials.",
    ),

    # Domain O: Bioinformatics
    CapabilityGap(
        capability="Profile Hidden Markov Model Search (HMMER)",
        domain="O",
        current_mocs_status="PyHMMER registered as optional adapter",
        best_open_source="PyHMMER",
        license="BSD-3-Clause",
        scientific_maturity="Tier S (Biological homology gold standard)",
        integration_mode="Optional Cython library",
        oracle="HMMER3",
        ui_access="Sequence Domain View",
        priority="P1",
        status="ACTIVE",
        decision=GapDecision.OPTIONAL,
        decision_rationale="Permissive BSD-3-Clause Cython bindings avoid invoking CLI subprocesses for HMMs.",
    ),

    # Domain P: Data Visualization
    CapabilityGap(
        capability="3D Biopolymer Cartoon, Surface, & Caliper Viewport",
        domain="P",
        current_mocs_status="Mol* + 3Dmol.js dual engine integration",
        best_open_source="Mol* / 3Dmol.js",
        license="MIT / BSD-3",
        scientific_maturity="Tier S (PDB & web standard)",
        integration_mode="Direct WebGL / Canvas",
        oracle="Mol* Viewer",
        ui_access="Molecular Viewport",
        priority="P0",
        status="ACTIVE",
        decision=GapDecision.INTEGRATE,
        decision_rationale="Mol* delivers production biopolymer rendering; 3Dmol.js delivers fast overlay calipers.",
    ),
]


class GapAnalysisRegistry:
    """Query and reporting engine for PASS 32 capability gap analysis."""

    @classmethod
    def all_gaps(cls) -> List[CapabilityGap]:
        return list(CAPABILITY_GAPS)

    @classmethod
    def get_all_gaps(cls) -> List[CapabilityGap]:
        return list(CAPABILITY_GAPS)

    @classmethod
    def get_by_domain(cls, domain_key: str) -> List[CapabilityGap]:
        domain_key_upper = domain_key.upper()
        return [g for g in CAPABILITY_GAPS if g.domain.upper() == domain_key_upper]

    @classmethod
    def get_by_decision(cls, decision: GapDecision | str) -> List[CapabilityGap]:
        target = decision.value if isinstance(decision, GapDecision) else str(decision).upper()
        return [g for g in CAPABILITY_GAPS if g.decision.value == target or g.decision == target]

    @classmethod
    def get_gap_statistics(cls) -> Dict[str, Any]:
        from collections import Counter
        decision_counts = Counter(g.decision.value for g in CAPABILITY_GAPS)
        domain_counts = Counter(g.domain for g in CAPABILITY_GAPS)
        return {
            "total_capabilities_tracked": len(CAPABILITY_GAPS),
            "domains_covered": len(domain_counts),
            "decisions": dict(decision_counts),
            "domain_breakdown": dict(domain_counts),
            "quarantined_count": len([g for g in CAPABILITY_GAPS if g.decision == GapDecision.REJECT]),
        }
