# MOCS-Cert Method Registry
## Authoritative Directory of Formal Mathematical & Biophysical Methods

This registry indexes all formal methods implemented, standardized, or audited within MOCS-Cert.

| Method ID | Method Title | Mathematical / Scientific Foundation | Canonical Module | Documentation |
|:---|:---|:---|:---|:---|
| **METH-001** | PBC Minimum-Image Convention | Periodic boundary vector wrapping in orthorhombic & triclinic lattices | `mocs.core.pbc` | [pbc_minimum_image.md](./methods/pbc_minimum_image.md) |
| **METH-002** | Kleene 3-Valued Logic | Strict ternary evaluation (TRUE, FALSE, UNKNOWN) for bounding bounds | `mocs.core.kleene` | [kleene_three_valued_logic.md](./methods/kleene_three_valued_logic.md) |
| **METH-003** | Trajectory Spatial Indexing | Conservative AABB bounding and seek-table chunking | `mocs.core.spatial` | [trajectory_spatial_indexing.md](./methods/trajectory_spatial_indexing.md) |
| **METH-004** | Pocket Detection & Ranking | Machine learning surface scoring & Voronoi alpha spheres | `mocs.ecosystem.backends` | [pocket_detection_ranking.md](./methods/pocket_detection_ranking.md) |
| **METH-005** | Interaction Fingerprints | Non-covalent geometric contact bitvectors | `mocs.ecosystem.backends` | [interaction_fingerprints.md](./methods/interaction_fingerprints.md) |
| **METH-006** | Structure Homology Search | 3Di structural alphabet & DP structural alignment | `mocs.ecosystem.backends` | [structure_homology_search.md](./methods/structure_homology_search.md) |
| **METH-007** | Ligand Pose Validation | Physical-chemistry sanity checks (bonds, angles, clashes) | `mocs.ecosystem.backends` | [ligand_pose_validation.md](./methods/ligand_pose_validation.md) |
| **METH-008** | Ensemble Consensus Prediction | C-alpha Kabsch superposition without coordinate averaging | `mocs.ecosystem.backends` | [ensemble_consensus_prediction.md](./methods/ensemble_consensus_prediction.md) |
| **METH-009** | Benchmark Leakage Protection | Release date temporal filtering & sequence homology cutoffs | `mocs.ecosystem.backends` | [benchmark_leakage_protection.md](./methods/benchmark_leakage_protection.md) |
