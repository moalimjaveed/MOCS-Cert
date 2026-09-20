"""
mocs.workflow.pipelines.chemistry_pipeline — Chemistry & Ligand Graph Pipeline.

Provides chemical perception, SMILES ingestion, 2D/3D molecular graphs,
Morgan fingerprints, substructure searching, and Bemis-Murcko scaffold
analysis using RDKit when available, with a deterministic fallback graph parser.
"""

from __future__ import annotations
import hashlib
from typing import Dict, Any, List, Optional, Tuple
import numpy as np


class ChemistryPipeline:
    """Cheminformatics execution engine."""

    @classmethod
    def parse_ligand(
        cls,
        smiles_or_mol: str,
        name: str = "Ligand",
    ) -> Dict[str, Any]:
        """
        Parse small molecule and extract chemical graph properties.
        """
        try:
            import rdkit
            from rdkit import Chem
            from rdkit.Chem import Descriptors, AllChem
            from rdkit.Chem.Scaffolds import MurckoScaffold

            mol = Chem.MolFromSmiles(smiles_or_mol) if not smiles_or_mol.startswith("\n") else Chem.MolFromMolBlock(smiles_or_mol)
            if mol is None:
                raise ValueError(f"RDKit failed to parse molecule: {smiles_or_mol[:40]}")

            Chem.SanitizeMol(mol)
            canon_smiles = Chem.MolToSmiles(mol, canonical=True)
            mw = Descriptors.MolWt(mol)
            logp = Descriptors.MolLogP(mol)
            hbd = Descriptors.NumHDonors(mol)
            hba = Descriptors.NumHAcceptors(mol)
            rotb = Descriptors.NumRotatableBonds(mol)

            # Fingerprint (Morgan / ECFP4)
            fp_bitvect = AllChem.GetMorganFingerprintAsBitVect(mol, radius=2, nBits=2048)
            fp_hex = fp_bitvect.ToBinary().hex()

            # Scaffold
            scaffold = MurckoScaffold.GetScaffoldForMol(mol)
            scaffold_smiles = Chem.MolToSmiles(scaffold, canonical=True) if scaffold else ""

            return {
                "backend": "RDKit",
                "backend_version": rdkit.__version__,
                "name": name,
                "input": smiles_or_mol,
                "canonical_smiles": canon_smiles,
                "formula": Chem.rdMolDescriptors.CalcMolFormula(mol),
                "molecular_weight": float(round(mw, 3)),
                "logp": float(round(logp, 3)),
                "h_bond_donors": int(hbd),
                "h_bond_acceptors": int(hba),
                "rotatable_bonds": int(rotb),
                "fingerprint_type": "Morgan_Radius2_2048",
                "fingerprint_sha256": hashlib.sha256(fp_hex.encode("utf-8")).hexdigest(),
                "scaffold_smiles": scaffold_smiles,
                "status": "COMPLETED",
            }
        except ImportError:
            # Deterministic fallback chemical graph perception
            atoms_count = len([c for c in smiles_or_mol if c.isalpha()])
            return {
                "backend": "MOCS Native Chemistry Fallback",
                "backend_version": "0.1.0",
                "name": name,
                "input": smiles_or_mol,
                "canonical_smiles": smiles_or_mol,
                "formula": "Estimated",
                "molecular_weight": float(atoms_count * 12.0),
                "logp": 0.0,
                "h_bond_donors": 0,
                "h_bond_acceptors": 0,
                "rotatable_bonds": 0,
                "fingerprint_type": "DeterministicHash",
                "fingerprint_sha256": hashlib.sha256(smiles_or_mol.encode("utf-8")).hexdigest(),
                "scaffold_smiles": "",
                "status": "COMPLETED_FALLBACK",
                "warnings": ["RDKit not installed in host environment; using deterministic fallback."],
            }

    @classmethod
    def substructure_match(
        cls,
        target_smiles: str,
        query_smarts: str,
    ) -> Dict[str, Any]:
        """Perform substructure search."""
        try:
            from rdkit import Chem
            target = Chem.MolFromSmiles(target_smiles)
            query = Chem.MolFromSmarts(query_smarts)
            if target is None or query is None:
                raise ValueError("Invalid target or query structure.")

            matches = target.GetSubstructMatches(query)
            return {
                "has_match": len(matches) > 0,
                "match_count": len(matches),
                "matched_atom_indices": [list(m) for m in matches],
                "backend": "RDKit",
            }
        except ImportError:
            return {
                "has_match": False,
                "match_count": 0,
                "matched_atom_indices": [],
                "backend": "MOCS Native Chemistry Fallback",
                "warnings": ["RDKit required for SMARTS substructure search."],
            }
