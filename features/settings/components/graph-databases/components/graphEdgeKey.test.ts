import { allEdgeKeys, edgeToKey, evidenceEdgeKey, EdgeKeyNode } from './graphEdgeKey';

const node = (id: number, uuid: string): EdgeKeyNode => ({ id, properties: { id: uuid } });

describe('evidenceEdgeKey', () => {
  it('joins src, relType, tgt in UUID space', () => {
    expect(evidenceEdgeKey('a', 'AGENCY_FIT', 'b')).toBe('a|AGENCY_FIT|b');
  });
});

describe('edgeToKey', () => {
  const byNeoId = new Map<number, EdgeKeyNode>([
    [10, node(10, 'uuid-cisa')],
    [20, node(20, 'uuid-acme')],
  ]);

  it('uses properties.relationType when present', () => {
    const edge = { from: 10, to: 20, type: 'RELATED', properties: { relationType: 'AGENCY_FIT' } };
    expect(edgeToKey(edge, byNeoId)).toBe('uuid-cisa|AGENCY_FIT|uuid-acme');
  });

  it('falls back to type when relationType is absent', () => {
    const edge = { from: 10, to: 20, type: 'CONTRACTS_WITH' };
    expect(edgeToKey(edge, byNeoId)).toBe('uuid-cisa|CONTRACTS_WITH|uuid-acme');
  });

  it('returns null when an endpoint is not in the node set (no synthetic id)', () => {
    const edge = { from: 10, to: 99, type: 'DANGLING' };
    expect(edgeToKey(edge, byNeoId)).toBeNull();
  });
});

describe('allEdgeKeys', () => {
  const nodes = [node(10, 'uuid-cisa'), node(20, 'uuid-acme'), node(30, 'uuid-globex')];

  it('maps every edge to a UUID-space key, dedupes, and drops dangling edges', () => {
    const edges = [
      { from: 10, to: 20, type: 'CONTRACTS_WITH', properties: {} },
      { from: 10, to: 20, type: 'CONTRACTS_WITH', properties: {} }, // duplicate
      { from: 10, to: 30, type: 'RELATED', properties: { relationType: 'AGENCY_FIT' } },
      { from: 10, to: 99, type: 'DANGLING', properties: {} }, // endpoint missing
    ];
    expect(allEdgeKeys({ nodes, edges })).toEqual([
      'uuid-cisa|CONTRACTS_WITH|uuid-acme',
      'uuid-cisa|AGENCY_FIT|uuid-globex',
    ]);
  });

  it('returns an empty list when there are no edges', () => {
    expect(allEdgeKeys({ nodes, edges: [] })).toEqual([]);
  });
});
