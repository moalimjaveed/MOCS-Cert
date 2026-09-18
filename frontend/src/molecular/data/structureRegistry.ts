import type { StructureMetadata, StructureCategory } from '../types';

export const STRUCTURE_CATEGORIES: Array<{
  id: StructureCategory;
  label: string;
  description: string;
}> = [
  {
    id: 'existing_experimental',
    label: 'Experimental Structures',
    description: 'High-resolution crystallographic, cryo-EM, and NMR structures from RCSB PDB & PDB-REDO',
  },
  {
    id: 'computed_predicted',
    label: 'Computed & Predicted',
    description: 'Whole-proteome structure predictions from AlphaFold DB, 3D-Beacons & ModelArchive',
  },
  {
    id: 'designed_candidate',
    label: 'De Novo Designed Candidates',
    description: 'Generative protein design models from RFdiffusion, ProteinMPNN, ESMFold & Boltz-1',
  },
  {
    id: 'trajectory_dataset',
    label: 'Molecular Trajectories',
    description: 'Time-resolved molecular dynamics simulations (GROMACS, XTC, multi-frame coordinates)',
  },
  {
    id: 'user_supplied',
    label: 'User-Supplied & Custom',
    description: 'Locally uploaded PDB/CIF coordinates and de novo FASTA sequence folding runs',
  },
];

export const STRUCTURE_REGISTRY: Record<string, StructureMetadata> = {
  // 1. Experimental: Blood oxygen transport tetramer with heme cofactors
  '4HHB': {
    id: '4HHB',
    name: '4HHB (Hemoglobin Tetramer)',
    kind: 'experimental',
    category: 'existing_experimental',
    provider: 'RCSB PDB',
    description: 'Human Deoxyhemoglobin Tetramer (α₂β₂)',
    organism: 'Homo sapiens',
    method: 'X-Ray Diffraction',
    resolution: '1.74 Å',
    tags: ['Protein', 'Tetramer', 'Allosteric', 'Heme Cofactor', 'Experimental'],
    defaultSelA: 'A:87:NE2',
    defaultSelB: 'HEM:142:FE',
    defaultDistance: 2.14,
  },

  // 2. Experimental: Canonical B-DNA Dodecamer Duplex
  '1BNA': {
    id: '1BNA',
    name: '1BNA (B-DNA Dodecamer)',
    kind: 'experimental',
    category: 'existing_experimental',
    provider: 'RCSB PDB',
    description: 'B-DNA Dodecamer (CGCGAATTCGCG) Duplex · High-resolution crystal',
    organism: 'Synthetic Duplex',
    method: 'X-Ray Diffraction',
    resolution: '1.90 Å',
    tags: ['DNA', 'Duplex', 'Double Helix', 'Nucleic', 'Experimental'],
    defaultSelA: "A:1:O5'",
    defaultSelB: "B:24:O3'",
    defaultDistance: 33.8,
  },

  // 3. Experimental: Protein / DNA Complex (Tumor suppressor p53 core domain bound to DNA)
  '1TUP': {
    id: '1TUP',
    name: '1TUP (p53 / DNA Complex)',
    kind: 'experimental',
    category: 'existing_experimental',
    provider: 'RCSB PDB',
    description: 'Tumor Suppressor p53 Bound to DNA · 2.20 Å crystal complex with Zn ions',
    organism: 'Homo sapiens',
    method: 'X-Ray Diffraction',
    resolution: '2.20 Å',
    tags: ['Protein-DNA Complex', 'Transcription Factor', 'Zinc Finger', 'Cancer Target'],
    defaultSelA: 'A:248:ARG',
    defaultSelB: 'E:11:DT',
    defaultDistance: 3.2,
  },

  // 4. Experimental: High-affinity Protein / Small Molecule Ligand Complex
  '1STP': {
    id: '1STP',
    name: '1STP (Streptavidin / Biotin)',
    kind: 'experimental',
    category: 'existing_experimental',
    provider: 'RCSB PDB',
    description: 'Streptavidin complex with Biotin · Femtomolar affinity protein-ligand benchmark',
    organism: 'Streptomyces avidinii',
    method: 'X-Ray Diffraction',
    resolution: '1.40 Å',
    tags: ['Protein-Ligand Complex', 'High-Affinity', 'Enzyme', 'Drug Target'],
    defaultSelA: 'A:49:ASN',
    defaultSelB: 'BTN:300:O2',
    defaultDistance: 2.78,
  },

  // 5. Experimental: Ultra-high resolution hydrophobic plant seed protein
  '1CRN': {
    id: '1CRN',
    name: '1CRN (Crambin)',
    kind: 'experimental',
    category: 'existing_experimental',
    provider: 'RCSB PDB',
    description: 'Crambin hydrophobic seed protein · Ultra-high atomic resolution (0.54 Å)',
    organism: 'Crambe hispanica',
    method: 'X-Ray Diffraction',
    resolution: '0.54 Å',
    tags: ['Protein', 'Ultra-High Resolution', 'Plant Seed', 'Disulfide-Rich'],
    defaultSelA: 'A:1:THR',
    defaultSelB: 'A:46:ASN',
    defaultDistance: 24.6,
  },

  // 6. Predicted: AlphaFold Human Hemoglobin Subunit Alpha (P69905)
  'AF-P69905-F1': {
    id: 'AF-P69905-F1',
    displayId: 'AF-P69905-F1',
    accession: 'P69905',
    modelId: 'AF-P69905-F1',
    modelVersion: 6,
    name: 'AF-P69905-F1 (AlphaFold HBA1)',
    kind: 'predicted',
    category: 'computed_predicted',
    provider: 'AlphaFold DB',
    description: 'AlphaFold v6 Prediction · Human Hemoglobin subunit alpha (UniProt P69905)',
    organism: 'Homo sapiens',
    method: 'AlphaFold2 Deep Learning',
    resolution: 'pLDDT 98.4 (Very High)',
    computationalMetric: 'pLDDT 98.4 (Very High)',
    tags: ['AlphaFold DB', 'Predicted', 'Monomer', 'High-pLDDT', 'UniProt:P69905'],
    defaultSelA: 'A:1:VAL',
    defaultSelB: 'A:141:ARG',
    defaultDistance: 39.2,
    confidenceMetrics: {
      plddtAvg: 98.4,
      ptmScore: 0.94,
    },
  },

  // 7. Predicted: AlphaFold Human Tumor Protein p53 (P04637)
  'AF-P04637-F1': {
    id: 'AF-P04637-F1',
    displayId: 'AF-P04637-F1',
    accession: 'P04637',
    modelId: 'AF-P04637-F1',
    modelVersion: 6,
    name: 'AF-P04637-F1 (AlphaFold TP53)',
    kind: 'predicted',
    category: 'computed_predicted',
    provider: 'AlphaFold DB',
    description: 'AlphaFold v6 Prediction · Human Cellular tumor antigen p53 (UniProt P04637)',
    organism: 'Homo sapiens',
    method: 'AlphaFold2 Deep Learning',
    computationalMetric: 'pLDDT 75.1 (Core Domain >90)',
    tags: ['AlphaFold DB', 'Predicted', 'Cancer Suppressor', 'UniProt:P04637'],
    defaultSelA: 'A:100:GLN',
    defaultSelB: 'A:290:ARG',
    defaultDistance: 28.5,
    confidenceMetrics: {
      plddtAvg: 75.1,
      ptmScore: 0.88,
    },
  },

  // 8. Predicted: ModelArchive Computed Homology / Target Model
  'MA-CP-001': {
    id: 'MA-CP-001',
    name: 'MA-CP-001 (ModelArchive CaM)',
    kind: 'predicted',
    category: 'computed_predicted',
    provider: 'ModelArchive',
    description: 'ModelArchive Calmodulin EF-hand calcium-sensor conformation model',
    organism: 'Synthetic / Homology',
    method: 'Comparative Modeling / Rosetta',
    computationalMetric: 'Confidence 0.91',
    tags: ['ModelArchive', 'Computed', 'Calcium Sensor', 'EF-Hand'],
    defaultSelA: 'A:20:ASP',
    defaultSelB: 'A:120:GLU',
    defaultDistance: 31.4,
  },

  // 9. Designed: RFdiffusion De Novo Target Binder Candidate
  'RFD-BINDER-01': {
    id: 'RFD-BINDER-01',
    name: 'RFD-BINDER-01 (RFdiffusion Helical Binder)',
    kind: 'designed',
    category: 'designed_candidate',
    provider: 'RFdiffusion / IPD',
    description: 'De novo designed 3-helix bundle engineered to engage target receptor interface',
    organism: 'De Novo Engineered',
    method: 'SE(3) Diffusion Generative Model',
    computationalMetric: 'scTM 0.94 · pAE 4.1 Å',
    tags: ['RFdiffusion', 'De Novo Design', 'Helical Bundle', 'Binder Candidate'],
    defaultSelA: 'A:1:MET',
    defaultSelB: 'A:65:LEU',
    defaultDistance: 27.2,
    confidenceMetrics: {
      plddtAvg: 93.8,
      ptmScore: 0.92,
      paeMax: 4.1,
    },
  },

  // 10. Designed: ProteinMPNN Sequence-Engineered Fold Candidate
  'PMPNN-DES-42': {
    id: 'PMPNN-DES-42',
    name: 'PMPNN-DES-42 (ProteinMPNN Scaffold)',
    kind: 'designed',
    category: 'designed_candidate',
    provider: 'ProteinMPNN',
    description: 'Message-passing neural network sequence redesigned for optimized thermal stability',
    organism: 'De Novo Engineered',
    method: 'Autoregressive GNN Sequence Design',
    computationalMetric: 'Sequence Recovery 48.2%',
    tags: ['ProteinMPNN', 'Sequence Design', 'Thermal Stability', 'TIM-Barrel'],
    defaultSelA: 'A:10:LEU',
    defaultSelB: 'A:120:VAL',
    defaultDistance: 22.8,
  },

  // 11. Designed: Boltz-1 Biomolecular Complex Design Candidate
  'BOLTZ-COMP-01': {
    id: 'BOLTZ-COMP-01',
    name: 'BOLTZ-COMP-01 (Boltz-1 Complex)',
    kind: 'designed',
    category: 'designed_candidate',
    provider: 'Boltz-1',
    description: 'All-atom co-folding prediction of designed peptide-protein regulatory complex',
    organism: 'De Novo Complex',
    method: 'Boltz-1 All-Atom Biopolymer Model',
    computationalMetric: 'Interface ipTM 0.89',
    tags: ['Boltz-1', 'Complex Prediction', 'Peptide-Protein', 'All-Atom'],
    defaultSelA: 'A:15:PHE',
    defaultSelB: 'B:8:TYR',
    defaultDistance: 4.8,
  },

  // 12. Trajectory: Synthetic MD Benchmark Dataset with MOCS Block 41 Proof Witness
  'synth_500f': {
    id: 'synth_500f',
    name: 'synth_500f (MD Benchmark)',
    kind: 'trajectory',
    category: 'trajectory_dataset',
    provider: 'GROMACS / XTC',
    description: 'Block 41 [410 - 420 ns] · Frame 414 · 3.72 Å A:155:CA - LIG:1:O2 MOCS proof witness',
    organism: 'Synthetic Test Topology',
    method: 'Synthetic MD Benchmark (Deterministic Step Trajectory)',
    resolution: '500 frames · 5.0 ns (10 ps/frame)',
    tags: ['Trajectory', 'GROMACS', 'XTC', 'Witness Frame', 'MOCS Proof Block 41', 'Synthetic Benchmark'],
    defaultSelA: 'A:155:CA',
    defaultSelB: 'LIG:1:O2',
    defaultDistance: 3.72,
  },

  // SARS-CoV-2 Spike Glycoprotein
  '6VXX': {
    id: '6VXX',
    name: '6VXX (SARS-CoV-2 Spike)',
    kind: 'experimental',
    category: 'existing_experimental',
    provider: 'RCSB PDB',
    description: 'SARS-CoV-2 S Glycoprotein (Closed State) · Cryo-EM 2.80 Å trimer',
    organism: 'SARS-CoV-2',
    method: 'Cryo-EM Single Particle',
    resolution: '2.80 Å',
    tags: ['Viral Glycoprotein', 'Trimer', 'Cryo-EM', 'Vaccine Target'],
    defaultSelA: 'A:500:CA',
    defaultSelB: 'B:500:CA',
    defaultDistance: 45.2,
  },
};

// Dynamic registry state supporting runtime user additions
const dynamicRegistry: Record<string, StructureMetadata> = { ...STRUCTURE_REGISTRY };

export function registerCustomStructure(entry: StructureMetadata): void {
  dynamicRegistry[entry.id] = entry;
}

export function getAllStructures(): StructureMetadata[] {
  return Object.values(dynamicRegistry);
}

export function searchRegistry(query: string, category?: StructureCategory | 'all'): StructureMetadata[] {
  const q = query.trim().toLowerCase();
  return Object.values(dynamicRegistry).filter((item) => {
    if (category && category !== 'all' && item.category !== category) return false;
    if (!q) return true;
    return (
      item.id.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.provider.toLowerCase().includes(q) ||
      (item.organism && item.organism.toLowerCase().includes(q)) ||
      (item.tags && item.tags.some((t) => t.toLowerCase().includes(q)))
    );
  });
}

export function getStructureMetadata(id: string): StructureMetadata {
  return (
    dynamicRegistry[id] ||
    STRUCTURE_REGISTRY[id] || {
      id,
      name: `${id} (RCSB)`,
      kind: 'experimental',
      category: 'existing_experimental',
      provider: 'RCSB PDB',
      description: `RCSB PDB Entry ${id}`,
      defaultSelA: 'A:1:CA',
      defaultSelB: 'A:2:CA',
      defaultDistance: 3.8,
    }
  );
}
