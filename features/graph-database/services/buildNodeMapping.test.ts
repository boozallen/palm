import { buildNodeMapping } from './buildNodeMapping';

describe('buildNodeMapping', () => {
  it('returns empty mapping for empty input', () => {
    expect(buildNodeMapping([])).toEqual([]);
  });

  it('maps cell-level _nodeId_<col> columns with their colKey', () => {
    const rows = [{ _nodeId_name: 'id-1', name: 'Alpha', type: 'PERSON' }];
    expect(buildNodeMapping(rows)).toEqual([{ rowIndex: 0, colKey: 'name', entityIds: ['id-1'] }]);
  });

  it('maps both endpoints of a relationship row as separate cell entries', () => {
    const rows = [
      { _nodeId_source: 'id-a', source: 'A', _nodeId_target: 'id-b', target: 'B', relationship: 'RELATED' },
    ];
    expect(buildNodeMapping(rows)).toEqual([
      { rowIndex: 0, colKey: 'source', entityIds: ['id-a'] },
      { rowIndex: 0, colKey: 'target', entityIds: ['id-b'] },
    ]);
  });

  it('handles array-valued _nodeId_ columns (collect(DISTINCT e.id))', () => {
    const rows = [{ _nodeId_name: ['id-1', 'id-2'], name: 'Shared', documents: ['a.pdf', 'b.pdf'] }];
    expect(buildNodeMapping(rows)).toEqual([{ rowIndex: 0, colKey: 'name', entityIds: ['id-1', 'id-2'] }]);
  });

  it('falls back to row-level _nodeId when no cell-level columns are present', () => {
    const rows = [{ _nodeId: 'id-1', Name: 'Alpha' }];
    expect(buildNodeMapping(rows)).toEqual([{ rowIndex: 0, entityIds: ['id-1'] }]);
  });

  it('falls back to row-level _nodeIds array when no cell-level columns are present', () => {
    const rows = [{ _nodeIds: ['id-1', 'id-2'], Name: 'Alpha' }];
    expect(buildNodeMapping(rows)).toEqual([{ rowIndex: 0, entityIds: ['id-1', 'id-2'] }]);
  });

  it('prefers cell-level mapping over row-level fallback when both exist', () => {
    const rows = [{ _nodeId_name: 'cell-id', name: 'Alpha', _nodeId: 'row-id' }];
    expect(buildNodeMapping(rows)).toEqual([{ rowIndex: 0, colKey: 'name', entityIds: ['cell-id'] }]);
  });

  it('produces no entry for pure aggregation rows (no _nodeId_ columns)', () => {
    const rows = [{ type: 'PERSON', count: 12 }];
    expect(buildNodeMapping(rows)).toEqual([]);
  });

  it('tracks the correct rowIndex across multiple rows', () => {
    const rows = [
      { _nodeId_name: 'id-1', name: 'A' },
      { type: 'X', count: 3 },
      { _nodeId_name: 'id-3', name: 'C' },
    ];
    expect(buildNodeMapping(rows)).toEqual([
      { rowIndex: 0, colKey: 'name', entityIds: ['id-1'] },
      { rowIndex: 2, colKey: 'name', entityIds: ['id-3'] },
    ]);
  });

  it('ignores empty-string and non-string id values', () => {
    const rows = [{ _nodeId_name: '', name: 'Empty' }];
    expect(buildNodeMapping(rows)).toEqual([]);
  });
});
