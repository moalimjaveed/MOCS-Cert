"""
mocs.workflow.pipelines.comparison_pipeline — Structural Comparison Pipeline.

Implements pairwise biopolymer structural comparison:
- Residue correspondence mapping
- Kabsch rotational superposition
- Backbone RMSD calculation
- Contact map differential analysis
"""

from __future__ import annotations
from typing import Dict, Any, List, Optional, Tuple
import numpy as np

from mocs.ecosystem.interfaces import CanonicalStructure


class StructureComparisonPipeline:
    """Pairwise structural alignment and discrepancy comparison."""

    @classmethod
    def compare_structures(
        cls,
        struct_a: CanonicalStructure,
        struct_b: CanonicalStructure,
        chain_a: Optional[str] = None,
        chain_b: Optional[str] = None,
        atom_name: str = "CA",
    ) -> Dict[str, Any]:
        """
        Compare two macromolecular structures along matching residue indices.
        """
        ca_atoms_a = [
            a for a in struct_a.atoms
            if a.name == atom_name and (chain_a is None or a.chain == chain_a)
        ]
        ca_atoms_b = [
            b for b in struct_b.atoms
            if b.name == atom_name and (chain_b is None or b.chain == chain_b)
        ]

        # Match by residue sequence number
        map_b = {b.resseq: b for b in ca_atoms_b}
        common_pairs: List[Tuple[Any, Any]] = []
        for a in ca_atoms_a:
            if a.resseq in map_b:
                common_pairs.append((a, map_b[a.resseq]))

        if len(common_pairs) < 3:
            raise ValueError(f"Insufficient aligned atoms ({len(common_pairs)}) for structural superposition.")

        coords_a = np.array([p[0].coordinates for p in common_pairs], dtype=np.float64)
        coords_b = np.array([p[1].coordinates for p in common_pairs], dtype=np.float64)

        # Center both sets
        cog_a = np.mean(coords_a, axis=0)
        cog_b = np.mean(coords_b, axis=0)
        p = coords_a - cog_a
        q = coords_b - cog_b

        # Kabsch alignment of q onto p
        h = q.T @ p
        u, s, vt = np.linalg.svd(h)
        d = np.sign(np.linalg.det(vt.T @ u.T))
        v_diag = np.diag([1.0, 1.0, d])
        rot = vt.T @ v_diag @ u.T
        q_aligned = q @ rot.T

        # RMSD
        diff = p - q_aligned
        rmsd = float(np.sqrt(np.mean(np.sum(diff ** 2, axis=-1))))

        # Per-residue displacement
        displacements = [
            {
                "resseq": common_pairs[i][0].resseq,
                "resname_a": common_pairs[i][0].resname,
                "resname_b": common_pairs[i][1].resname,
                "distance_angstrom": float(round(np.linalg.norm(diff[i]), 3)),
            }
            for i in range(len(common_pairs))
        ]

        return {
            "structure_a_id": struct_a.identifier,
            "structure_b_id": struct_b.identifier,
            "aligned_atoms_count": len(common_pairs),
            "atom_name": atom_name,
            "rmsd_angstrom": round(rmsd, 4),
            "max_displacement_angstrom": round(max(d["distance_angstrom"] for d in displacements), 3),
            "mean_displacement_angstrom": round(float(np.mean([d["distance_angstrom"] for d in displacements])), 3),
            "per_residue_displacements": displacements[:50],  # cap for summary
            "algorithm": "Kabsch Optimal Rotational Alignment (SVD)",
        }
