import { cypherSpecialistSearch, dropRowsOutsideDocumentScope } from './cypherSpecialist';
import { getGraphDatabaseSource } from '@/features/graph-database';
import { AIFactory } from '@/features/ai-provider/factory';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';
import type { GraphDatabaseSource } from '@/features/graph-database/sources/types';

jest.mock('@/features/graph-database', () => ({
  getGraphDatabaseSource: jest.fn(),
}));

jest.mock('@/features/ai-provider/factory');

jest.mock('@/features/graph-database/dal/getGraphSchema', () => ({
  getScopedGraphSchema: jest.fn().mockResolvedValue('Node Types:\n- Entity: {name, type}\n'),
}));

jest.mock('@/features/shared/dal/getSystemConfig', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({ knowledgeGraphAiProviderModelId: 'model-1' }),
}));

jest.mock('@/features/shared/dal/getAccessibleDocumentIds', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(new Set(['docA', 'docB'])),
}));

jest.mock('@/server/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

// A5 relevance filter is exercised in its own test; keep it a pass-through here.
jest.mock('./filterCypherRowsForRelevance', () => ({
  filterCypherRowsForRelevance: jest.fn(async ({ rows }: { rows: unknown[] }) => ({ rows })),
}));

/** Neo4j record adapter shape consumed by executeCypher / the tenancy lookup. */
const rec = (obj: Record<string, unknown>) => ({ keys: Object.keys(obj), get: (k: string) => obj[k] });

const accessibleDocIds = new Set(['docA', 'docB']) as unknown as AccessibleDocIds;
const userId = 'user-123';

describe('dropRowsOutsideDocumentScope (per-cell tenancy filter)', () => {
  it('drops a row whose unconstrained neighbor is outside the selected docs AND keeps the in-scope control row', async () => {
    const rows = [
      { _nodeId_a: 'id-a', a: 'NodeA', _nodeId_b: 'id-b', b: 'FromUnselectedDoc' }, // b not in selected docs
      { _nodeId_a: 'id-a', a: 'NodeA', _nodeId_b: 'id-c', b: 'NodeC' },             // c in a selected doc (control)
    ];
    // Scoped re-resolution returns ONLY ids in the selected documentIds — id-b absent.
    const mockGraphDb = { run: jest.fn().mockResolvedValue({ records: [rec({ id: 'id-a' }), rec({ id: 'id-c' })] }) };

    const out = await dropRowsOutsideDocumentScope(rows, ['docA'], mockGraphDb as unknown as GraphDatabaseSource);

    expect(out).toHaveLength(1); // out-of-scope row dropped (scope + security)
    expect(out[0]['_nodeId_b']).toBe('id-c'); // control row survived (no over-drop)
  });

  it('drops the whole row when ANY endpoint is out of scope (never half-redacts)', async () => {
    const rows = [{ _nodeId_source: 'id-1', source: 'S', _nodeId_target: 'id-2', target: 'T' }];
    const mockGraphDb = { run: jest.fn().mockResolvedValue({ records: [rec({ id: 'id-1' })] }) }; // id-2 absent
    const out = await dropRowsOutsideDocumentScope(rows, ['docA'], mockGraphDb as unknown as GraphDatabaseSource);
    expect(out).toHaveLength(0);
  });

  it('handles array-valued _nodeId_ cells — every collected id must be accessible', async () => {
    const rows = [
      { _nodeId_name: ['id-1', 'id-2'], name: 'AllAccessible' },
      { _nodeId_name: ['id-3', 'id-x'], name: 'OneInaccessible' },
    ];
    const mockGraphDb = {
      run: jest.fn().mockResolvedValue({ records: [rec({ id: 'id-1' }), rec({ id: 'id-2' }), rec({ id: 'id-3' })] }),
    };
    const out = await dropRowsOutsideDocumentScope(rows, ['docA'], mockGraphDb as unknown as GraphDatabaseSource);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('AllAccessible');
  });

  it('passes aggregation rows through untouched (no _nodeId_ columns, no lookup)', async () => {
    const rows = [{ type: 'PERSON', count: 5 }];
    const mockGraphDb = { run: jest.fn() };
    const out = await dropRowsOutsideDocumentScope(rows, ['docA'], mockGraphDb as unknown as GraphDatabaseSource);
    expect(out).toEqual(rows);
    expect(mockGraphDb.run).not.toHaveBeenCalled();
  });
});

describe('cypherSpecialistSearch', () => {
  const mockGraphDb = { run: jest.fn() };
  const mockChatCompletion = jest.fn();
  let execRecords: ReturnType<typeof rec>[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    execRecords = [];
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue(mockGraphDb);
    (AIFactory as jest.Mock).mockImplementation(() => ({
      buildKnowledgeGraphSource: jest.fn().mockResolvedValue({
        source: { chatCompletion: mockChatCompletion },
        model: { externalId: 'test-model' },
      }),
    }));
    // Default: EXPLAIN passes; tenancy accepts every queried id; execution returns execRecords.
    mockGraphDb.run.mockImplementation((q: string, params: { ids?: string[] }) => {
      if (typeof q === 'string' && q.includes('WHERE n.id IN $ids')) {
        return Promise.resolve({ records: (params.ids ?? []).map((id) => rec({ id })) });
      }
      if (typeof q === 'string' && q.startsWith('EXPLAIN')) {
        return Promise.resolve({ records: [] });
      }
      return Promise.resolve({ records: execRecords });
    });
  });

  it('executes an enumeration query end-to-end and returns scoped rows with _nodeId_ intact', async () => {
    mockChatCompletion.mockResolvedValue({
      text: JSON.stringify({
        cypher: 'MATCH (e:Entity) WHERE e.documentId IN $documentIds RETURN e.id AS _nodeId_name, e.name AS name',
        queryType: 'enumeration',
        suggestedFormat: 'table',
      }),
    });
    execRecords = [rec({ _nodeId_name: 'id-1', name: 'Alpha' }), rec({ _nodeId_name: 'id-2', name: 'Beta' })];

    const result = await cypherSpecialistSearch({ query: 'list all entities', userId, documentIds: ['docA'], accessibleDocIds });

    expect(result.error).toBeUndefined();
    expect(result.rowCount).toBe(2);
    expect(result.results).toEqual([
      { _nodeId_name: 'id-1', name: 'Alpha' },
      { _nodeId_name: 'id-2', name: 'Beta' },
    ]);
    expect(result.queryType).toBe('enumeration');
  });

  it('drops a tenancy-violating row before returning (integration of pipeline + filter)', async () => {
    mockChatCompletion.mockResolvedValue({
      text: JSON.stringify({
        cypher: 'MATCH (e:Entity)-[r]-(o) WHERE e.documentId IN $documentIds RETURN e.id AS _nodeId_e, e.name AS e, o.id AS _nodeId_o, o.name AS o',
        queryType: 'enumeration',
        suggestedFormat: 'table',
      }),
    });
    execRecords = [
      rec({ _nodeId_e: 'id-e', e: 'E', _nodeId_o: 'id-ok', o: 'InScope' }),
      rec({ _nodeId_e: 'id-e', e: 'E', _nodeId_o: 'id-leak', o: 'OutOfScope' }),
    ];
    // Tenancy lookup: only id-e and id-ok are in the selected docs; id-leak omitted.
    mockGraphDb.run.mockImplementation((q: string) => {
      if (q.includes('WHERE n.id IN $ids')) {
        return Promise.resolve({ records: [rec({ id: 'id-e' }), rec({ id: 'id-ok' })] });
      }
      if (q.startsWith('EXPLAIN')) {return Promise.resolve({ records: [] });}
      return Promise.resolve({ records: execRecords });
    });

    const result = await cypherSpecialistSearch({ query: 'list connected entities', userId, documentIds: ['docA'], accessibleDocIds });

    expect(result.rowCount).toBe(1);
    expect(result.results.map((r) => r.o)).toEqual(['InScope']); // leak dropped, control survives
  });

  it('retries when a node-returning query is missing _nodeId_, then succeeds', async () => {
    mockChatCompletion
      .mockResolvedValueOnce({
        text: JSON.stringify({ cypher: 'MATCH (e:Entity) WHERE e.documentId IN $documentIds RETURN e.name AS name', queryType: 'enumeration', suggestedFormat: 'table' }),
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({ cypher: 'MATCH (e:Entity) WHERE e.documentId IN $documentIds RETURN e.id AS _nodeId_name, e.name AS name', queryType: 'enumeration', suggestedFormat: 'table' }),
      });
    execRecords = [rec({ _nodeId_name: 'id-1', name: 'Alpha' })];

    const result = await cypherSpecialistSearch({ query: 'list all entities', userId, documentIds: ['docA'], accessibleDocIds });

    expect(mockChatCompletion).toHaveBeenCalledTimes(2); // first attempt retried for missing _nodeId_
    expect(result.error).toBeUndefined();
    expect(result.rowCount).toBe(1);
  });

  it('repairs a query that fails EXPLAIN, then executes the corrected one', async () => {
    mockChatCompletion
      .mockResolvedValueOnce({
        text: JSON.stringify({ cypher: 'MATCH (e:BadLabel) WHERE e.documentId IN $documentIds RETURN e.id AS _nodeId_name, e.name AS name', queryType: 'enumeration', suggestedFormat: 'table' }),
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({ cypher: 'MATCH (e:Entity) WHERE e.documentId IN $documentIds RETURN e.id AS _nodeId_name, e.name AS name', queryType: 'enumeration', suggestedFormat: 'table' }),
      });
    execRecords = [rec({ _nodeId_name: 'id-1', name: 'Alpha' })];
    mockGraphDb.run.mockImplementation((q: string, params: { ids?: string[] }) => {
      if (q.includes('WHERE n.id IN $ids')) {
        return Promise.resolve({ records: (params.ids ?? []).map((id) => rec({ id })) });
      }
      if (q.startsWith('EXPLAIN')) {
        return q.includes('BadLabel')
          ? Promise.reject(new Error('SyntaxError: Invalid input'))
          : Promise.resolve({ records: [] });
      }
      return Promise.resolve({ records: execRecords });
    });

    const result = await cypherSpecialistSearch({ query: 'list all entities', userId, documentIds: ['docA'], accessibleDocIds });

    expect(mockChatCompletion).toHaveBeenCalledTimes(2);
    expect(result.error).toBeUndefined();
    expect(result.rowCount).toBe(1);
    expect(result.generatedCypher).toContain(':Entity');
  });

  it('restates the _nodeId_ contract when self-correcting a 0-result query (keeps the repair linkable)', async () => {
    // First node-returning query has _nodeId_ but matches nothing → self-correction;
    // the repaired query must still carry _nodeId_ so the result stays graph-linkable.
    mockChatCompletion
      .mockResolvedValueOnce({
        text: JSON.stringify({ cypher: 'MATCH (e:Entity) WHERE e.documentId IN $documentIds AND e.degree > 9999 RETURN e.id AS _nodeId_name, e.name AS name', queryType: 'enumeration', suggestedFormat: 'table' }),
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({ cypher: 'MATCH (e:Entity) WHERE e.documentId IN $documentIds RETURN e.id AS _nodeId_name, e.name AS name', queryType: 'enumeration', suggestedFormat: 'table' }),
      });
    mockGraphDb.run.mockImplementation((q: string, params: { ids?: string[] }) => {
      if (q.includes('WHERE n.id IN $ids')) {
        return Promise.resolve({ records: (params.ids ?? []).map((id) => rec({ id })) });
      }
      if (q.startsWith('EXPLAIN')) {return Promise.resolve({ records: [] });}
      if (q.includes('e.degree > 9999')) {return Promise.resolve({ records: [] });} // first attempt: 0 results
      return Promise.resolve({ records: [rec({ _nodeId_name: 'id-1', name: 'Alpha' })] }); // repaired: 1 row
    });

    const result = await cypherSpecialistSearch({ query: 'list all entities', userId, documentIds: ['docA'], accessibleDocIds });

    expect(result.rowCount).toBe(1);
    // The self-correction (2nd) generation prompt must carry BOTH the 0-result
    // instruction AND the _nodeId_ contract, so the repair stays graph-linkable.
    const selfCorrectionPrompt = mockChatCompletion.mock.calls[1][0][0].content as string;
    expect(selfCorrectionPrompt).toContain('0 results');
    expect(selfCorrectionPrompt).toContain('_nodeId_');
  });

  it('reminds the model to project _relType_ when repairing a relationship query', async () => {
    // First query is missing the graph-linking columns → retry; the repair prompt must carry
    // BOTH contracts so relationship rows surface their edge type as _relType_.
    mockChatCompletion
      .mockResolvedValueOnce({
        text: JSON.stringify({ cypher: 'MATCH (a:Entity)-[r]-(b:Entity) WHERE a.documentId IN $documentIds AND b.documentId IN $documentIds RETURN a.name AS source, type(r) AS rel, b.name AS target', queryType: 'enumeration', suggestedFormat: 'table' }),
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({ cypher: 'MATCH (a:Entity)-[r]-(b:Entity) WHERE a.documentId IN $documentIds AND b.documentId IN $documentIds RETURN a.id AS _nodeId_source, a.name AS source, type(r) AS _relType_link, b.id AS _nodeId_target, b.name AS target', queryType: 'enumeration', suggestedFormat: 'table' }),
      });
    execRecords = [rec({ _nodeId_source: 'id-a', source: 'A', _relType_link: 'REL', _nodeId_target: 'id-b', target: 'B' })];

    const result = await cypherSpecialistSearch({ query: 'how is A connected to B', userId, documentIds: ['docA'], accessibleDocIds });

    expect(mockChatCompletion).toHaveBeenCalledTimes(2);
    const repairPrompt = mockChatCompletion.mock.calls[1][0][0].content as string;
    expect(repairPrompt).toContain('_relType_');
    expect(result.rowCount).toBe(1);
  });

  it('does not require _nodeId_ for aggregation (count) queries', async () => {
    mockChatCompletion.mockResolvedValue({
      text: JSON.stringify({ cypher: 'MATCH (e:Entity) WHERE e.documentId IN $documentIds RETURN count(DISTINCT e) AS total', queryType: 'aggregation', suggestedFormat: 'prose' }),
    });
    execRecords = [rec({ total: { toNumber: () => 42 } })];

    const result = await cypherSpecialistSearch({ query: 'how many entities', userId, documentIds: ['docA'], accessibleDocIds });

    expect(mockChatCompletion).toHaveBeenCalledTimes(1); // no _nodeId_ retry
    expect(result.results).toEqual([{ total: 42 }]);
    expect(result.queryType).toBe('aggregation');
  });

  it('returns a sanitized security error when $documentIds is never included', async () => {
    mockChatCompletion.mockResolvedValue({
      text: JSON.stringify({ cypher: 'MATCH (e:Entity) RETURN e.id AS _nodeId_name, e.name AS name', queryType: 'enumeration', suggestedFormat: 'table' }),
    });

    const result = await cypherSpecialistSearch({ query: 'list all', userId, documentIds: ['docA'], accessibleDocIds });

    expect(result.error).toContain('Security validation failed');
    expect(result.results).toEqual([]);
    // never reached execution
    expect(mockGraphDb.run).not.toHaveBeenCalled();
  });
});
