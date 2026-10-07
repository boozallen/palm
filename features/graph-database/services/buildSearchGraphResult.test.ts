import { buildSearchGraphResult, EntityAnchor, ConceptAnchor } from './buildSearchGraphResult';

const entity = (overrides: Partial<EntityAnchor> = {}): EntityAnchor => ({
  id: 'entity-id-1',
  name: 'Acme Corp',
  description: 'A company',
  aliases: ['Acme'],
  documentId: 'doc-1',
  score: 0.9,
  ...overrides,
});

const concept = (overrides: Partial<ConceptAnchor> = {}): ConceptAnchor => ({
  id: 'concept-id-1',
  name: 'Supply Chain',
  description: 'Logistics concept',
  category: 'Operations',
  documentId: 'doc-1',
  score: 0.8,
  ...overrides,
});

describe('buildSearchGraphResult', () => {
  it('returns null when there are no entities and no concepts', () => {
    expect(buildSearchGraphResult([], [], 'anything')).toBeNull();
  });

  it('builds one row per anchor with rowCount equal to the anchor total', () => {
    const result = buildSearchGraphResult([entity()], [concept()], 'how do they relate');
    expect(result).not.toBeNull();
    expect(result!.rows).toHaveLength(2);
    expect(result!.rowCount).toBe(2);
    expect(result!.nodeMapping).toHaveLength(2);
  });

  it('aligns every rowIndex with its anchor id in nodeMapping (entities first, then concepts)', () => {
    const result = buildSearchGraphResult(
      [entity({ id: 'e-a' }), entity({ id: 'e-b' })],
      [concept({ id: 'c-a' })],
      'q',
    )!;
    expect(result.nodeMapping).toEqual([
      { rowIndex: 0, entityIds: ['e-a'] },
      { rowIndex: 1, entityIds: ['e-b'] },
      { rowIndex: 2, entityIds: ['c-a'] },
    ]);
    // Each nodeMapping entry points at the kind sitting at that row index.
    expect(result.rows[0].kind).toBe('Entity');
    expect(result.rows[1].kind).toBe('Entity');
    expect(result.rows[2].kind).toBe('Concept');
  });

  it('handles entities-only input', () => {
    const result = buildSearchGraphResult([entity({ id: 'e-only' })], [], 'q')!;
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].kind).toBe('Entity');
    expect(result.nodeMapping).toEqual([{ rowIndex: 0, entityIds: ['e-only'] }]);
  });

  it('handles concepts-only input', () => {
    const result = buildSearchGraphResult([], [concept({ id: 'c-only' })], 'q')!;
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].kind).toBe('Concept');
    expect(result.nodeMapping).toEqual([{ rowIndex: 0, entityIds: ['c-only'] }]);
  });

  it('keeps the raw Neo4j id out of the visible rows but present in nodeMapping', () => {
    const result = buildSearchGraphResult([entity({ id: 'secret-node-id' })], [], 'q')!;
    const row = result.rows[0];
    // No id-bearing column leaks into the rendered table.
    expect(row).not.toHaveProperty('id');
    expect(row).not.toHaveProperty('__id');
    expect(row).not.toHaveProperty('_nodeId');
    expect(Object.values(row)).not.toContain('secret-node-id');
    // ...but the mapping still carries it for graph brushing.
    expect(result.nodeMapping[0].entityIds).toEqual(['secret-node-id']);
  });

  it('omits the RRF score and documentId from the visible columns', () => {
    const result = buildSearchGraphResult([entity()], [concept()], 'q')!;
    for (const row of result.rows) {
      expect(row).not.toHaveProperty('score');
      expect(row).not.toHaveProperty('documentId');
    }
    // Only the user-facing columns remain.
    expect(Object.keys(result.rows[0])).toEqual(['kind', 'name', 'type', 'description']);
  });

  it('maps concept category into the shared type column and entity type to empty', () => {
    const result = buildSearchGraphResult(
      [entity()],
      [concept({ category: 'Operations' })],
      'q',
    )!;
    expect(result.rows[0].type).toBe('');
    expect(result.rows[1].type).toBe('Operations');
  });

  it('passes the query through and sets generatedCypher to an empty string', () => {
    const result = buildSearchGraphResult([entity()], [], 'what are the key concepts')!;
    expect(result.query).toBe('what are the key concepts');
    expect(result.generatedCypher).toBe('');
  });
});
