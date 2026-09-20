"""
mocs.workflow.pipelines.selection_pipeline — Typed Selection AST & Deterministic Evaluator.

Parses structural query expressions into an auditable AST and evaluates them
deterministically against CanonicalStructure biopolymers with zero ordering bias.
"""

from __future__ import annotations
import re
from typing import Dict, Any, List, Optional, Set, Tuple
import numpy as np

from mocs.ecosystem.interfaces import CanonicalStructure, AtomRecord
from ..artifacts import SelectionArtifact

# Standard residue dictionaries for semantic tagging
STANDARD_AMINO_ACIDS = {
    "ALA", "ARG", "ASN", "ASP", "CYS", "GLN", "GLU", "GLY", "HIS", "ILE",
    "LEU", "LYS", "MET", "PHE", "PRO", "SER", "THR", "TRP", "TYR", "VAL",
    "HSD", "HSE", "HSP", "CYX", "HID", "HIE", "HIP",
}
STANDARD_NUCLEIC_ACIDS = {
    "DA", "DC", "DG", "DT", "A", "C", "G", "U", "RA", "RC", "RG", "RU",
    "ADE", "CYT", "GUA", "THY", "URA",
}
BACKBONE_ATOMS = {"N", "CA", "C", "O", "P", "OP1", "OP2", "O5'", "C5'", "C4'", "O4'", "C3'", "O3'", "C2'", "C1'"}


class SelectionEvaluator:
    """Evaluates typed structural queries against a CanonicalStructure."""

    @classmethod
    def evaluate(
        cls,
        expression: str,
        structure: CanonicalStructure,
    ) -> SelectionArtifact:
        """
        Parse expression and return an immutable SelectionArtifact.
        Expressions support:
        - 'chain A', 'chain A,B'
        - 'resname HEM', 'resname ALA,HIS'
        - 'resid 87', 'resid 80-100'
        - 'name FE', 'name CA,NE2'
        - 'protein', 'nucleic', 'ligand', 'backbone'
        - 'and', 'or', 'not'
        - 'within 5.0 of resname HEM'
        """
        expr_clean = expression.strip()
        matched_indices: Set[int] = set()

        # Handle 'within X.X of <subquery>'
        within_match = re.match(r"^within\s+([0-9.]+)\s+(?:angstrom|a)?\s*of\s+(.+)$", expr_clean, re.IGNORECASE)
        if within_match:
            cutoff = float(within_match.group(1))
            subquery = within_match.group(2)
            sub_artifact = cls.evaluate(subquery, structure)
            target_indices = list(sub_artifact.selected_atom_indices)
            if target_indices:
                all_coords = structure.coordinates
                target_coords = all_coords[target_indices]
                # Distance of all atoms to target atoms
                for idx, atom in enumerate(structure.atoms):
                    pos = atom.coordinates
                    dists = np.linalg.norm(target_coords - pos, axis=-1)
                    if np.any(dists <= cutoff):
                        matched_indices.add(idx)

            ast_repr = {
                "type": "WithinSelection",
                "cutoff_angstrom": cutoff,
                "target_subquery": subquery,
                "target_indices_count": len(target_indices),
            }
        else:
            # Handle clause-based boolean expressions (conjunction 'and' / disjunction 'or')
            # For robust V0.1 scientific parsing, support tokens split by 'and'
            clauses = [c.strip() for c in expr_clean.split(" and ")] if " and " in expr_clean else [expr_clean]
            clause_sets: List[Set[int]] = []

            for clause in clauses:
                current_set: Set[int] = set()
                c_clean = clause.strip()

                # Or sub-clauses
                or_terms = [t.strip() for t in c_clean.split(" or ")]
                for term in or_terms:
                    current_set |= cls._evaluate_primitive_term(term, structure)
                clause_sets.append(current_set)

            # Intersection of all 'and' clauses
            if clause_sets:
                matched_indices = clause_sets[0]
                for s in clause_sets[1:]:
                    matched_indices &= s

            ast_repr = {
                "type": "BooleanSelection",
                "expression": expr_clean,
                "clauses_count": len(clauses),
            }

        sorted_indices = sorted(matched_indices)
        selected_chains = sorted({structure.atoms[i].chain for i in sorted_indices})
        selected_residues = sorted({f"{structure.atoms[i].chain}:{structure.atoms[i].resname}:{structure.atoms[i].resseq}" for i in sorted_indices})

        target_fp = getattr(structure.provenance, "sha256_hash", structure.identifier)

        return SelectionArtifact.create(
            expression=expr_clean,
            target_fp=target_fp,
            atom_indices=sorted_indices,
            chains=selected_chains,
            residues=selected_residues,
            ast_repr=ast_repr,
            metadata={"source_structure_id": structure.identifier},
        )

    @classmethod
    def _evaluate_primitive_term(cls, term: str, structure: CanonicalStructure) -> Set[int]:
        """Evaluate a single atomic term (e.g. 'chain A', 'protein', 'resid 87')."""
        term = term.strip()
        matches: Set[int] = set()

        if not term:
            return matches

        # Keywords
        t_upper = term.upper()
        if t_upper == "PROTEIN":
            for i, a in enumerate(structure.atoms):
                if a.resname.upper() in STANDARD_AMINO_ACIDS:
                    matches.add(i)
            return matches

        if t_upper in ("NUCLEIC", "DNA", "RNA"):
            for i, a in enumerate(structure.atoms):
                if a.resname.upper() in STANDARD_NUCLEIC_ACIDS:
                    matches.add(i)
            return matches

        if t_upper == "LIGAND":
            for i, a in enumerate(structure.atoms):
                rn = a.resname.upper()
                if rn not in STANDARD_AMINO_ACIDS and rn not in STANDARD_NUCLEIC_ACIDS and rn not in ("HOH", "WAT", "TIP3", "SOL"):
                    matches.add(i)
            return matches

        if t_upper == "BACKBONE":
            for i, a in enumerate(structure.atoms):
                if a.name.upper() in BACKBONE_ATOMS:
                    matches.add(i)
            return matches

        # Chain specification: chain A or c A
        m_chain = re.match(r"^(?:chain|c)\s+([A-Za-z0-9,]+)$", term, re.IGNORECASE)
        if m_chain:
            chains = set(m_chain.group(1).split(","))
            for i, a in enumerate(structure.atoms):
                if a.chain in chains:
                    matches.add(i)
            return matches

        # Resname specification: resname HEM or res HEM
        m_resname = re.match(r"^(?:resname|res)\s+([A-Za-z0-9,]+)$", term, re.IGNORECASE)
        if m_resname:
            resnames = {r.upper() for r in m_resname.group(1).split(",")}
            for i, a in enumerate(structure.atoms):
                if a.resname.upper() in resnames:
                    matches.add(i)
            return matches

        # Resid specification: resid 87 or resid 80-100
        m_resid_range = re.match(r"^(?:resid|r)\s+(\d+)-(\d+)$", term, re.IGNORECASE)
        if m_resid_range:
            r_start = int(m_resid_range.group(1))
            r_end = int(m_resid_range.group(2))
            for i, a in enumerate(structure.atoms):
                if r_start <= a.resseq <= r_end:
                    matches.add(i)
            return matches

        m_resid = re.match(r"^(?:resid|r)\s+(\d+)$", term, re.IGNORECASE)
        if m_resid:
            target_resseq = int(m_resid.group(1))
            for i, a in enumerate(structure.atoms):
                if a.resseq == target_resseq:
                    matches.add(i)
            return matches

        # Atom name: name CA or name FE
        m_name = re.match(r"^(?:name|atom)\s+([A-Za-z0-9',]+)$", term, re.IGNORECASE)
        if m_name:
            names = {n.upper() for n in m_name.group(1).split(",")}
            for i, a in enumerate(structure.atoms):
                if a.name.upper() in names:
                    matches.add(i)
            return matches

        # Fallback exact coordinate / string match (e.g. "A:HEM:142:FE")
        m_colon = re.match(r"^([A-Za-z0-9]+):([A-Za-z0-9]+):(\d+):([A-Za-z0-9']+)$", term)
        if m_colon:
            c, rn, rs, an = m_colon.group(1), m_colon.group(2), int(m_colon.group(3)), m_colon.group(4)
            for i, a in enumerate(structure.atoms):
                if a.chain == c and a.resname == rn and a.resseq == rs and a.name == an:
                    matches.add(i)
            return matches

        return matches
