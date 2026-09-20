import { CanonicalStructure } from '@mocs/core';
import { parsePDB } from './pdbLoader.js';

export interface DatasetBundle {
  readonly id: string;
  readonly name: string;
  readonly structureUrl: string;
  readonly format: 'pdb' | 'mmcif' | 'gro';
}

export const PRESET_DATASETS: readonly DatasetBundle[] = [
  {
    id: '4hhb',
    name: '4HHB (Human Deoxyhemoglobin)',
    structureUrl: '/structures/4HHB.pdb',
    format: 'pdb',
  },
  {
    id: '1bna',
    name: '1BNA (B-DNA Dodecamer)',
    structureUrl: '/structures/1BNA.pdb',
    format: 'pdb',
  },
  {
    id: 'synth-500f',
    name: 'Synthetic 500-Frame Trajectory',
    structureUrl: '/structures/synth_500f.pdb',
    format: 'pdb',
  },
];

export async function fetchAndLoadPDB(url: string, datasetId: string): Promise<{ structure: CanonicalStructure; rawText: string }> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to fetch structure from '${url}': HTTP ${resp.status} ${resp.statusText}`);
  }
  const rawText = await resp.text();
  const structure = parsePDB(rawText, datasetId);
  return { structure, rawText };
}
