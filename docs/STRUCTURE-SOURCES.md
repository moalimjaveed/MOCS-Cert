# MOCS-Cert — Universal Structure Registry & Resolver Specification
**Subsystem:** Universal Molecular Structure Registry & Extensible Source Resolvers  
**Document Index:** 39  
**Epistemic Baseline:** Transparent Provenance & Zero Mocked Coordinates  

---

## 1. Overview & Architectural Goal

MOCS-Cert has evolved beyond hardcoded static structure presets. The Universal Structure Registry provides an open, decoupled pipeline capable of resolving, downloading, validating, and displaying 10 distinct molecular structural categories:

1. **Experimental Crystallography & Cryo-EM:** RCSB PDB (`https://data.rcsb.org/rest/v1/core/entry/{id}`).
2. **Computed Structural Models:** AlphaFold Protein Structure Database (EBI AFDB).
3. **Federated Structural Providers:** 3D-Beacons Network (`https://www.ebi.ac.uk/pdbe/pdbe-kb/3dbeacons/`).
4. **Curated Molecular Archives:** ModelArchive (`https://modelarchive.org/`).
5. **Local User Files:** Drag-and-drop or file picker for `.pdb`, `.cif`, `.gro`, and `.xtc`.
6. **Primary FASTA Sequences:** ESMFold API / local sequence-to-structure inference.
7. **De Novo Artificial Protein Candidates:** Computational backbone designs from RFdiffusion / ProteinMPNN providers.
8. **Nucleic Acid & Ribonucleoprotein Complexes:** B-DNA duplexes (e.g. 1BNA), transfer RNA, and ribozymes.
9. **Protein-Ligand & Protein-DNA Complexes:** Crystallographic holo-complexes (e.g. 1TUP p53-DNA core domain).
10. **Trajectory Streams:** Multi-frame molecular dynamics ensembles with conservative spatial indexing.

---

## 2. Resolver Architecture & Provider Interfaces

The resolution layer is defined in `frontend/src/molecular/intelligence/providerInterfaces.ts` through decoupled TypeScript contracts:

```typescript
export interface StructureSourceProvider {
  id: string;
  name: string;
  category: 'rcsb' | 'alphafold' | 'modelarchive' | 'local' | 'trajectory' | 'design';
  canResolve(identifier: string): boolean;
  resolve(identifier: string): Promise<ResolvedStructurePayload>;
}

export interface ProteinStructurePredictionProvider {
  id: string;
  name: string;
  predictFromSequence(sequence: string): Promise<ResolvedStructurePayload>;
}

export interface ProteinDesignProvider {
  id: string;
  name: string;
  generateCandidate(parameters: Record<string, any>): Promise<ResolvedStructurePayload>;
}
```

---

## 3. Resolution Lifecycle & Provenance Tracking

When a user requests a structure identifier or uploads raw coordinate data:

```
[User Input / URI]
       │
       ▼
[Identifier Parser] ─── (4-char PDB ID, UniProt AC, FASTA, or Local File)
       │
       ├──► RCSB Rest Service (mmCIF / PDB)
       ├──► AlphaFold EBI Service (CIF / PDB)
       ├──► Local FileReader (ArrayBuffer)
       └──► Prediction Provider (ESMFold)
       │
       ▼
[Sanitization & Security Filter]
  - Disallow script tags, executable payloads, and path traversal
  - Validate atom count, residue continuity, and coordinate finiteness
       │
       ▼
[Mol* Coordinate Cell Ingestion]
  - Parse PDB/mmCIF/GRO into Mol* Data Trajectory
  - Compute StructureDerivedBounds (AABB, atom counts, center)
       │
       ▼
[Cryptographic Provenance Checksum]
  - Compute SHA-256 digest of original raw data payload
  - Register in MOCS Evidence Store
```

---

## 4. Error Handling & Scientific Resilience

1. **Missing or Corrupted Coordinate Data:**
   - If an external REST endpoint returns 404 or incomplete atom coordinates, the UI renders an informative error banner without crashing the WebGL context.
2. **Missing Hydrogen Atoms:**
   - Crystallographic PDB entries often omit hydrogen atoms. Mol* handles standard hydrogen valence reconstruction for geometric calculations without altering heavy atom positions.
3. **Large Trajectories:**
   - Trajectory files exceeding 100 MB stream indices asynchronously; Mol* loads models on-demand using frame slicing to maintain sub-60fps responsiveness.
