import { describe, it, expect } from 'vitest';
import {
  parseAtomQuery,
  resolveAtomQuery,
  resolveExactAtom,
  ScientificAmbiguityError,
  CanonicalStructure,
} from '@mocs/core';

describe('Gate G3: Selection Query Parser & Fail-Closed Resolver', () => {
  const mockStructure: CanonicalStructure = {
    datasetId: 'test-dataset',
    topology: {
      atomCount: 3,
      atoms: [
        { index: 0, name: 'NE2', element: 'N', chain: 'A', resSeq: 87, resName: 'HIS', entityId: '1' },
        { index: 1, name: 'FE', element: 'FE', chain: 'A', resSeq: 142, resName: 'HEM', entityId: '1' },
        { index: 2, name: 'NE2', element: 'N', chain: 'C', resSeq: 87, resName: 'HIS', entityId: '2' },
      ],
      bonds: [],
    },
    models: [
      {
        modelNum: 1,
        atomCount: 3,
        coordinates: new Float64Array([
          -4.116, 12.183, 4.316,
          -2.253, 13.064, 4.316,
          10.0, 20.0, 30.0,
        ]),
      },
    ],
    components: [],
    assemblies: [],
    defaultModelIndex: 0,
  };

  it('parses atom queries accurately', () => {
    const q1 = parseAtomQuery('A:87:NE2');
    expect(q1.chain).toBe('A');
    expect(q1.resSeq).toBe(87);
    expect(q1.atomName).toBe('NE2');

    const q2 = parseAtomQuery('HEM:142:FE');
    expect(q2.resName).toBe('HEM');
    expect(q2.resSeq).toBe(142);
    expect(q2.atomName).toBe('FE');

    const q3 = parseAtomQuery('A:87:NE2@B');
    expect(q3.altLoc).toBe('B');
  });

  it('resolves unique atom queries to exact coordinates and canonical identity', () => {
    const match = resolveExactAtom(mockStructure, 'A:87:NE2');
    expect(match.atomIndex).toBe(0);
    expect(match.sourceAtomId.chain).toBe('A');
    expect(match.sourceAtomId.atom).toBe('NE2');
    expect(match.position).toEqual([-4.116, 12.183, 4.316]);

    const hemeMatch = resolveExactAtom(mockStructure, 'HEM:142:FE');
    expect(hemeMatch.atomIndex).toBe(1);
    expect(hemeMatch.sourceAtomId.component).toBe('HEM');
  });

  it('fails closed when query is ambiguous across multiple chains', () => {
    // There is NE2 at res 87 on both Chain A and Chain C
    expect(() => resolveExactAtom(mockStructure, 'HIS:87:NE2')).toThrow(ScientificAmbiguityError);
  });
});
