/**
 * MOCS-Cert Protein-Ligand, Binding-Site & Molecular-Interaction Types
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: IUPAC / PDB / Biophysical Chemistry Standards
 */

import type { ComponentClassification, ValidatedAtom } from '../geometry/structuralIdentity';
import type { StructureProvenance } from '../types';

export type InteractionProvenance =
  | 'EXPERIMENTAL_DEPOSITED'
  | 'PREDICTED_POSE'
  | 'GENERATED_DESIGN'
  | 'USER_UPLOADED';

export type EpistemicInteractionLevel =
  | 'OBSERVED_STRUCTURAL_CONTACT'                // Experimentally deposited atomic proximity
  | 'GEOMETRIC_PROXIMITY'                        // Non-specific Euclidean contact (no chemical assertion)
  | 'INFERRED_INTERACTION'                       // Rule-based biochemical inference (heuristic)
  | 'PREDICTED_INTERACTION'                      // Derived from predicted complex model
  | 'EXPERIMENTALLY_VALIDATED_BIOLOGICAL_INTERACTION'; // Backed by external biochemical assay (Kd, ITC, etc.)

export type InteractionClassification =
  | 'HYDROGEN_BOND_EXPLICIT'     // Full donor-H-acceptor geometry (theta >= 120 deg, d(D,A) <= 3.5 A)
  | 'HYDROGEN_BOND_PUTATIVE'     // Heavy-atom geometric proxy: D-A <= 3.5 A, unobserved hydrogens
  | 'SALT_BRIDGE'                // Heavy-atom charged pair (cationic Arg/Lys/His <-> anionic Asp/Glu/ligand <= 4.0 A)
  | 'HYDROPHOBIC_HEURISTIC'      // Non-polar carbon-carbon geometric proximity (<= 4.5 A)
  | 'PI_STACKING_PARALLEL'       // Aromatic ring centroid <= 4.5 A, normal vector angle <= 30 deg
  | 'PI_STACKING_T_SHAPED'       // Aromatic ring centroid <= 5.5 A, normal vector angle 60-90 deg
  | 'METAL_COORDINATION'         // Biological metal coordinating N, O, S heteroatom (<= 2.8 A)
  | 'COVALENT_BOND'              // Explicit covalent connectivity (mmCIF _struct_conn or chemical link)
  | 'GEOMETRIC_PROXIMITY';       // General contact within distance cutoff

export interface LigandInstanceIdentity {
  structureId: string;
  modelId: string | number;
  chainId: string;
  entityId?: string | number;
  residueName: string;
  residueNumber: number;
  insertionCode?: string;
  instanceKey: string;           // Globally unique: `${structureId}:${modelId}:${chainId}:${residueName}:${residueNumber}${insCode ? ':' + insCode : ''}`
  classification: ComponentClassification;
  isCofactor: boolean;
  isProstheticGroup: boolean;
  isMetalIon: boolean;
  provenance: InteractionProvenance;
  formula?: string;
  chemicalName?: string;
  atomCount: number;
  centroid: [number, number, number];
}

export interface ContactAtomDetail {
  chainId: string;
  residueNumber: number;
  residueName: string;
  insertionCode?: string;
  atomName: string;
  element: string;
  coordinates: [number, number, number];
  isHetero: boolean;
  altLoc?: string;
}

export interface MolecularContact {
  contactId: string;
  source: ContactAtomDetail; // Typically protein atom
  target: ContactAtomDetail; // Typically ligand atom
  distance: number;          // In Angstroms (two decimal places)
  type: InteractionClassification;
  epistemicLevel: EpistemicInteractionLevel;
  isInterChain: boolean;
  geometryDetails?: {
    donorAcceptorAngleDeg?: number;
    ringCentroidDistance?: number;
    ringNormalAngleDeg?: number;
    metalElement?: string;
    coordinationBondLength?: number;
  };
  provenance: InteractionProvenance;
  label: string;             // Human-readable: e.g. "A:HIS:87:NE2 <-> A:HEM:142:FE (2.14 A)"
}

export interface ContactingResidueSummary {
  chainId: string;
  residueNumber: number;
  residueName: string;
  insertionCode?: string;
  minDistance: number;
  contactCount: number;
  interactionTypes: InteractionClassification[];
  proximityRank: number;     // 1-indexed proximity rank (lowest distance = 1)
  isInterfacial: boolean;    // True if residue is on a chain different from the primary ligand chain
}

export interface BindingSiteNeighborhood {
  ligand: LigandInstanceIdentity;
  cutoffAngstroms: number;
  definition: 'GEOMETRIC_CONTACT_NEIGHBORHOOD';
  contactingChains: string[];
  contactingResidues: ContactingResidueSummary[];
  contacts: MolecularContact[];
  interactionsByType: {
    hydrogenBonds: MolecularContact[];
    saltBridges: MolecularContact[];
    hydrophobicContacts: MolecularContact[];
    piStackings: MolecularContact[];
    metalCoordinations: MolecularContact[];
    covalentBonds: MolecularContact[];
    geometricProximities: MolecularContact[];
  };
  isInterfacial: boolean;    // Ligand contacts multiple protein chains
  isPredicted: boolean;
  hasMissingCoordinates: boolean;
  disclaimer: string;
}

export interface TrajectoryContactOccupancy {
  pairKey: string;
  sourceLabel: string;
  targetLabel: string;
  contactCount: number;
  totalFrames: number;
  occupancyFraction: number; // N / M (0.0 to 1.0)
  minDistance: number;
  maxDistance: number;
  meanDistance: number;
  disclaimer: string;
}
