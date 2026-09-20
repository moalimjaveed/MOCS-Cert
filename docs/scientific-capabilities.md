# MOCS-Cert Scientific Capabilities Handbook
## Comprehensive Reference for Experimental, Algorithmic & Evaluative Operations

---

## 1. Structural ground truth & Normalization
- **Cartesian Coordinate Validation:** Verifies finite IEEE 754 floats, non-overlapping atomic coordinates, and chemical component definitions.
- **SIFTS Mapping:** Seamlessly connects UniProt sequence indices with PDB chain IDs, author residue numbers, and label numbers.

## 2. Periodic Boundary Conditions (PBC) & Minimum Image
- Rigorous minimum-image coordinate unwrapping in cuboid and triclinic boxes.
- Analytical derivation of conservative AABB bounds guaranteeing zero false negatives during spatial indexing.

## 3. Binding Cavity & Pocket Detection
- **P2Rank:** Random forest machine learning pocket ranking based on Connolly surface points.
- **fpocket:** Voronoi alpha-sphere cavity volume and druggability estimation.
- **PocketEnsembleEngine:** Cross-method pocket correspondence mapping and residue Jaccard index computation.

## 4. Non-Covalent Interactions & Fingerprints
- **ProLIF:** Trajectory-wide interaction bitvectors for hydrogen bonds, hydrophobic contacts, pi-stacking, and salt bridges.
- Exact angle and distance cutoffs with geometric provenance.

## 5. Macromolecular Search & Sequence Homology
- **Foldseek:** 3Di structural alphabet search across millions of AlphaFold structures.
- **MMseqs2:** Ultra-fast protein sequence searching, clustering, and multiple sequence alignment.

## 6. Structure Prediction Consensus
- Superimposes predicted models (Boltz-1, Chai-1, Protenix, OpenFold) via C-alpha Kabsch rotation.
- Strictly prohibits coordinate averaging; detects consensus spans (< 1.5 Å) and flexible loops.

## 7. Ligand Pose Quality & Sanity Validation
- **PoseBusters:** Verifies 18 physical-chemistry tests on docked or generated small molecules to eliminate unphysical artifacts.

## 8. Benchmark Data Governance
- Enforces release date cutoffs and sequence homology filtering (< 30% identity) to prevent data leakage in ML evaluation.
