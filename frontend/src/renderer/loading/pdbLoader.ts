import {
  CanonicalStructure,
  Topology,
  TopologyAtom,
  StructureModel,
  StructuralComponent,
} from '@mocs/core';

const STANDARD_AMINO_ACIDS = new Set([
  'ALA', 'ARG', 'ASN', 'ASP', 'CYS', 'GLN', 'GLU', 'GLY', 'HIS', 'ILE',
  'LEU', 'LYS', 'MET', 'PHE', 'PRO', 'SER', 'THR', 'TRP', 'TYR', 'VAL',
  'MSE', 'SEC', 'PYL'
]);

const STANDARD_NUCLEIC_ACIDS = new Set([
  'DA', 'DT', 'DC', 'DG', 'DI', 'A', 'U', 'C', 'G', 'I'
]);

const SOLVENT_RESIDUES = new Set([
  'HOH', 'WAT', 'DOD', 'TIP', 'TIP3', 'SOL'
]);

const COMMON_IONS = new Set([
  'NA', 'CL', 'MG', 'ZN', 'CA', 'K', 'MN', 'CU', 'FE2', 'FE3', 'CO', 'NI'
]);

export function parsePDB(pdbText: string, datasetId: string): CanonicalStructure {
  const lines = pdbText.split(/\r?\n/);
  const atoms: TopologyAtom[] = [];
  const coordsList: number[] = [];
  const proteinIndices: number[] = [];
  const ligandIndices: number[] = [];
  const nucleicIndices: number[] = [];
  const solventIndices: number[] = [];
  const ionIndices: number[] = [];
  const otherIndices: number[] = [];

  let currentModel = 1;
  let hasModels = false;
  const modelsMap = new Map<number, number[]>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const record = line.slice(0, 6).trim();

    if (record === 'MODEL') {
      hasModels = true;
      const num = parseInt(line.slice(10, 14).trim(), 10);
      currentModel = Number.isNaN(num) ? currentModel + 1 : num;
      if (!modelsMap.has(currentModel)) {
        modelsMap.set(currentModel, []);
      }
      continue;
    }

    if (record === 'ENDMDL') {
      continue;
    }

    if (record === 'ATOM' || record === 'HETATM') {
      const atomName = line.slice(12, 16).trim();
      const altLoc = line.slice(16, 17).trim() || undefined;
      const resName = line.slice(17, 20).trim();
      const chain = line.slice(21, 22).trim() || 'A';
      const resSeq = parseInt(line.slice(22, 26).trim(), 10);
      const insCode = line.slice(26, 27).trim() || undefined;

      const x = parseFloat(line.slice(30, 38).trim());
      const y = parseFloat(line.slice(38, 46).trim());
      const z = parseFloat(line.slice(46, 54).trim());

      let element = line.slice(76, 78).trim();
      if (!element) {
        // Infer from atomName
        element = atomName.replace(/[^A-Za-z]/g, '').slice(0, 2);
        if (element.length === 2 && !['FE', 'MG', 'ZN', 'CA', 'CL', 'NA'].includes(element.toUpperCase())) {
          element = element[0];
        }
      }

      // If we haven't registered the atom in topology yet (first model only for topology)
      if (!hasModels || currentModel === 1) {
        const atomIdx = atoms.length;
        atoms.push({
          index: atomIdx,
          name: atomName,
          element: element.toUpperCase(),
          chain,
          resSeq: Number.isNaN(resSeq) ? 1 : resSeq,
          resName: resName.toUpperCase(),
          insCode,
          altLoc,
          entityId: chain,
        });

        // Classify component
        const upperRes = resName.toUpperCase();
        if (SOLVENT_RESIDUES.has(upperRes)) {
          solventIndices.push(atomIdx);
        } else if (COMMON_IONS.has(upperRes) || (record === 'HETATM' && COMMON_IONS.has(element.toUpperCase()))) {
          ionIndices.push(atomIdx);
        } else if (STANDARD_AMINO_ACIDS.has(upperRes)) {
          proteinIndices.push(atomIdx);
        } else if (STANDARD_NUCLEIC_ACIDS.has(upperRes)) {
          nucleicIndices.push(atomIdx);
        } else if (record === 'HETATM') {
          ligandIndices.push(atomIdx);
        } else {
          otherIndices.push(atomIdx);
        }
      }

      if (hasModels) {
        let mCoords = modelsMap.get(currentModel);
        if (!mCoords) {
          mCoords = [];
          modelsMap.set(currentModel, mCoords);
        }
        mCoords.push(x, y, z);
      } else {
        coordsList.push(x, y, z);
      }
    }
  }

  const topology: Topology = {
    atomCount: atoms.length,
    atoms,
    bonds: [],
  };

  const models: StructureModel[] = [];

  if (hasModels && modelsMap.size > 0) {
    for (const [mNum, cList] of modelsMap.entries()) {
      models.push({
        modelNum: mNum,
        atomCount: Math.floor(cList.length / 3),
        coordinates: new Float64Array(cList),
      });
    }
  } else {
    models.push({
      modelNum: 1,
      atomCount: atoms.length,
      coordinates: new Float64Array(coordsList),
    });
  }

  const components: StructuralComponent[] = [
    { id: 'protein', kind: 'protein', name: 'Protein', atomIndices: new Uint32Array(proteinIndices) },
    { id: 'ligand', kind: 'ligand', name: 'Ligand', atomIndices: new Uint32Array(ligandIndices) },
    { id: 'nucleic', kind: 'nucleic', name: 'Nucleic Acid', atomIndices: new Uint32Array(nucleicIndices) },
    { id: 'solvent', kind: 'solvent', name: 'Water / Solvent', atomIndices: new Uint32Array(solventIndices) },
    { id: 'ions', kind: 'ion', name: 'Ions', atomIndices: new Uint32Array(ionIndices) },
  ];

  return {
    datasetId,
    topology,
    models,
    components,
    assemblies: [],
    defaultModelIndex: 0,
  };
}
