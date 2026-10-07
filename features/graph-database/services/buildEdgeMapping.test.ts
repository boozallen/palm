import { buildEdgeMapping } from './buildEdgeMapping';

describe('buildEdgeMapping', () => {
  it('returns empty mapping for empty input', () => {
    expect(buildEdgeMapping([])).toEqual([]);
  });

  it('emits one edge for a relationship row with two node ids and a relType', () => {
    const rows = [
      { _nodeId_source: 'id-a', source: 'A', _nodeId_target: 'id-b', target: 'B', relationship: 'AGENCY_FIT', _relType_link: 'AGENCY_FIT' },
    ];
    expect(buildEdgeMapping(rows)).toEqual([{ rowIndex: 0, src: 'id-a', relType: 'AGENCY_FIT', tgt: 'id-b' }]);
  });

  it('emits no edge when the relType column is missing', () => {
    const rows = [{ _nodeId_source: 'id-a', source: 'A', _nodeId_target: 'id-b', target: 'B' }];
    expect(buildEdgeMapping(rows)).toEqual([]);
  });

  it('emits no edge for a single-node row (only one node id)', () => {
    const rows = [{ _nodeId_name: 'id-a', name: 'A', _relType_x: 'REL' }];
    expect(buildEdgeMapping(rows)).toEqual([]);
  });

  it('emits adjacent-pair edges for a path row with >2 ids, reusing the single relType', () => {
    const rows = [
      {
        _nodeId_a: 'id-1', a: 'N1',
        _nodeId_b: 'id-2', b: 'N2',
        _nodeId_c: 'id-3', c: 'N3',
        _relType_link: 'RELATED',
      },
    ];
    expect(buildEdgeMapping(rows)).toEqual([
      { rowIndex: 0, src: 'id-1', relType: 'RELATED', tgt: 'id-2' },
      { rowIndex: 0, src: 'id-2', relType: 'RELATED', tgt: 'id-3' },
    ]);
  });

  it('zips per-hop relTypes when their count matches the hop count', () => {
    const rows = [
      {
        _nodeId_a: 'id-1', a: 'N1',
        _nodeId_b: 'id-2', b: 'N2',
        _nodeId_c: 'id-3', c: 'N3',
        _relType_ab: 'FUNDS',
        _relType_bc: 'OVERSEES',
      },
    ];
    expect(buildEdgeMapping(rows)).toEqual([
      { rowIndex: 0, src: 'id-1', relType: 'FUNDS', tgt: 'id-2' },
      { rowIndex: 0, src: 'id-2', relType: 'OVERSEES', tgt: 'id-3' },
    ]);
  });

  it('skips array-valued _nodeId_ cells (enumerations, not endpoints)', () => {
    const rows = [{ _nodeId_name: ['id-1', 'id-2'], name: 'Shared', _relType_x: 'REL' }];
    expect(buildEdgeMapping(rows)).toEqual([]);
  });

  it('dedupes identical triples within a row', () => {
    const rows = [
      { _nodeId_a: 'id-1', a: 'N1', _nodeId_b: 'id-2', b: 'N2', _nodeId_c: 'id-1', c: 'N1', _relType_link: 'REL' },
    ];
    // hops: (id-1 -> id-2) and (id-2 -> id-1) are distinct directed triples, both kept.
    expect(buildEdgeMapping(rows)).toEqual([
      { rowIndex: 0, src: 'id-1', relType: 'REL', tgt: 'id-2' },
      { rowIndex: 0, src: 'id-2', relType: 'REL', tgt: 'id-1' },
    ]);
  });

  it('tracks the correct rowIndex across mixed rows', () => {
    const rows = [
      { type: 'PERSON', count: 3 },
      { _nodeId_source: 'id-a', source: 'A', _nodeId_target: 'id-b', target: 'B', _relType_link: 'REL' },
    ];
    expect(buildEdgeMapping(rows)).toEqual([{ rowIndex: 1, src: 'id-a', relType: 'REL', tgt: 'id-b' }]);
  });
});
