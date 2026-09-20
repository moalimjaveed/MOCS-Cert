import type { StructureCandidate } from '../types';

export function rankStructureCandidates(candidates: StructureCandidate[]): StructureCandidate[] {
  return [...candidates].sort((a, b) => {
    // 1. Source priority: local (4) > rcsb (3) > alphafold (2) > computed (1)
    const sourceWeight = (s: StructureCandidate['source']) => {
      switch (s) {
        case 'local':
          return 4;
        case 'rcsb':
          return 3;
        case 'alphafold':
          return 2;
        case 'computed':
          return 1;
        default:
          return 0;
      }
    };

    const diffSource = sourceWeight(b.source) - sourceWeight(a.source);
    if (diffSource !== 0) return diffSource;

    // 2. Experimental vs. Predicted
    if (a.experimental !== b.experimental) {
      return a.experimental ? -1 : 1;
    }

    // 3. Format priority: bcif > mmcif > pdb
    const formatWeight = (f: StructureCandidate['format']) => {
      switch (f) {
        case 'bcif':
          return 3;
        case 'mmcif':
        case 'cif':
          return 2;
        case 'pdb':
          return 1;
        default:
          return 0;
      }
    };

    const diffFormat = formatWeight(b.format) - formatWeight(a.format);
    if (diffFormat !== 0) return diffFormat;

    // 4. Resolution (lower is better for crystallographic resolution)
    if (a.resolution != null && b.resolution != null) {
      return a.resolution - b.resolution;
    }

    return 0;
  });
}
