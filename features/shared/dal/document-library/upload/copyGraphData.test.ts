import { getGraphDatabaseSource } from '@/features/graph-database';
import deleteGraphNodes from '@/features/graph-database/dal/deleteGraphNodes';
import copyGraphData from './copyGraphData';
import db from '@/server/db';

jest.mock('@/features/graph-database', () => ({
  getGraphDatabaseSource: jest.fn(),
}));

jest.mock('@/features/graph-database/dal/deleteGraphNodes', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    graphEntityEmbedding: {
      findMany: jest.fn(),
    },
    graphConceptEmbedding: {
      findMany: jest.fn(),
    },
    embedding: {
      findMany: jest.fn(),
    },
  },
}));

type MockGraphDb = {
  run: jest.Mock;
  runTransaction: jest.Mock;
};

type RunCall = { query: string; parameters?: Record<string, unknown> };
type TransactionCall = Array<{ query: string; parameters?: Record<string, unknown> }>;

const SOURCE_DOC_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TARGET_DOC_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const TARGET_USER_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

function makeRecord(values: Record<string, unknown>) {
  return {
    get: (key: string) => values[key],
    keys: Object.keys(values),
    toObject: () => values,
  };
}

function buildMockGraphDb(): MockGraphDb {
  return {
    run: jest.fn(),
    runTransaction: jest.fn().mockResolvedValue([]),
  };
}

function getRunQueries(mockGraphDb: MockGraphDb): RunCall[] {
  return mockGraphDb.run.mock.calls.map((call: unknown[]) => ({
    query: call[0] as string,
    parameters: call[1] as Record<string, unknown> | undefined,
  }));
}

function getTransactionBatches(mockGraphDb: MockGraphDb): TransactionCall[] {
  return mockGraphDb.runTransaction.mock.calls.map((call: unknown[]) => call[0] as TransactionCall);
}

function flattenedTransactionQueries(mockGraphDb: MockGraphDb): RunCall[] {
  const result: RunCall[] = [];
  for (const batch of getTransactionBatches(mockGraphDb)) {
    for (const q of batch) {
      result.push(q);
    }
  }
  return result;
}

describe('copyGraphData', () => {
  let mockGraphDb: MockGraphDb;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGraphDb = buildMockGraphDb();
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue(mockGraphDb);
    (deleteGraphNodes as jest.Mock).mockResolvedValue(undefined);
    (db.graphEntityEmbedding.findMany as jest.Mock).mockResolvedValue([]);
    (db.graphConceptEmbedding.findMany as jest.Mock).mockResolvedValue([]);
    (db.embedding.findMany as jest.Mock).mockResolvedValue([]);
  });

  it('returns false when source Document missing', async () => {
    mockGraphDb.run.mockResolvedValueOnce({ records: [] }); // source doc check returns nothing

    const result = await copyGraphData({
      sourceDocumentId: SOURCE_DOC_ID,
      targetDocumentId: TARGET_DOC_ID,
      targetUserId: TARGET_USER_ID,
    });

    expect(result).toBe(false);
    expect(mockGraphDb.run).toHaveBeenCalledTimes(1);
    expect(mockGraphDb.run.mock.calls[0][0]).toContain(
      'MATCH (d:Document {id: $sourceDocumentId})'
    );
    expect(mockGraphDb.runTransaction).not.toHaveBeenCalled();
  });

  it('returns false when source has Document but no non-Document nodes', async () => {
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] }) // source doc exists
      .mockResolvedValueOnce({ records: [] }); // node read returns 0

    const result = await copyGraphData({
      sourceDocumentId: SOURCE_DOC_ID,
      targetDocumentId: TARGET_DOC_ID,
      targetUserId: TARGET_USER_ID,
    });

    expect(result).toBe(false);
    expect(mockGraphDb.run).toHaveBeenCalledTimes(2);
    expect(mockGraphDb.run.mock.calls[1][0]).toContain('NOT n:Document');
    expect(mockGraphDb.runTransaction).not.toHaveBeenCalled();
  });

  it('returns true when at least one non-Document node is copied', async () => {
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] }) // source doc exists
      .mockResolvedValueOnce({
        records: [
          makeRecord({
            sourceId: 'src-entity-1',
            labels: ['Entity'],
            props: { name: 'A', normalizedName: 'a' },
          }),
        ],
      }) // node read
      .mockResolvedValueOnce({ records: [makeRecord({ props: { filename: 'f.pdf' } })] }) // doc props
      .mockResolvedValueOnce({ records: [] }) // inter-node edges
      .mockResolvedValueOnce({ records: [] }) // doc edges out
      .mockResolvedValueOnce({ records: [] }) // doc edges in
      .mockResolvedValueOnce({ records: [] }) // existing doc check
      .mockResolvedValueOnce({ records: [] }); // create target doc

    const result = await copyGraphData({
      sourceDocumentId: SOURCE_DOC_ID,
      targetDocumentId: TARGET_DOC_ID,
      targetUserId: TARGET_USER_ID,
    });

    expect(result).toBe(true);
    // node write happens via runTransaction
    expect(mockGraphDb.runTransaction).toHaveBeenCalled();
    // cleanup must NOT fire on the success path
    expect(deleteGraphNodes).not.toHaveBeenCalled();
  });

  it('preserves multi-label nodes', async () => {
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({
            sourceId: 'src-multi-1',
            labels: ['Entity', 'Person'],
            props: { name: 'Bob', normalizedName: 'bob' },
          }),
        ],
      })
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await copyGraphData({
      sourceDocumentId: SOURCE_DOC_ID,
      targetDocumentId: TARGET_DOC_ID,
      targetUserId: TARGET_USER_ID,
    });

    const txQueries = flattenedTransactionQueries(mockGraphDb);
    const nodeMerge = txQueries.find((q) => q.query.includes('MERGE (n:'));
    expect(nodeMerge).toBeDefined();
    expect(nodeMerge!.query).toContain(':Entity:Person');
  });

  it('preserves arbitrary edge types', async () => {
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceId: 'src-1', labels: ['Entity'], props: {} }),
          makeRecord({ sourceId: 'src-2', labels: ['Entity'], props: {} }),
        ],
      })
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceFromId: 'src-1', sourceToId: 'src-2', relType: 'WORKS_FOR', props: {}, aLabels: ['Entity'], bLabels: ['Entity'] }),
          makeRecord({ sourceFromId: 'src-1', sourceToId: 'src-2', relType: 'OWNED_BY_TEAM', props: {}, aLabels: ['Entity'], bLabels: ['Entity'] }),
          makeRecord({ sourceFromId: 'src-2', sourceToId: 'src-1', relType: 'CONTROLLED_BY', props: {}, aLabels: ['Entity'], bLabels: ['Entity'] }),
        ],
      })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await copyGraphData({
      sourceDocumentId: SOURCE_DOC_ID,
      targetDocumentId: TARGET_DOC_ID,
      targetUserId: TARGET_USER_ID,
    });

    const txQueries = flattenedTransactionQueries(mockGraphDb);
    const edgeMerges = txQueries.filter((q) => q.query.includes('MERGE (a)-['));
    expect(edgeMerges.length).toBeGreaterThan(0);
    // Every edge merge query must use a label-scoped MATCH for both endpoints,
    // never a label-less `MATCH (a {documentId` form.
    for (const q of edgeMerges) {
      expect(q.query).toContain('MATCH (a:');
      expect(q.query).toContain('MATCH (b:');
      expect(q.query).not.toMatch(/MATCH \(a \{documentId/);
      expect(q.query).not.toMatch(/MATCH \(b \{documentId/);
    }
    const types = edgeMerges.map((q) => q.query.match(/MERGE \(a\)-\[r:(\w+)\]/)?.[1]);
    expect(types).toContain('WORKS_FOR');
    expect(types).toContain('OWNED_BY_TEAM');
    expect(types).toContain('CONTROLLED_BY');
  });

  it('rejects unsafe label and throws', async () => {
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({
            sourceId: 'src-1',
            labels: ['Bad`Label'],
            props: {},
          }),
        ],
      })
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await expect(
      copyGraphData({
        sourceDocumentId: SOURCE_DOC_ID,
        targetDocumentId: TARGET_DOC_ID,
        targetUserId: TARGET_USER_ID,
      })
    ).rejects.toThrow('Error copying graph data');

    // No node-write transaction should have been issued
    const txQueries = flattenedTransactionQueries(mockGraphDb);
    expect(txQueries.find((q) => q.query.includes('MERGE (n:'))).toBeUndefined();
  });

  it('rejects unsafe relationship type and throws', async () => {
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceId: 'src-1', labels: ['Entity'], props: {} }),
          makeRecord({ sourceId: 'src-2', labels: ['Entity'], props: {} }),
        ],
      })
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceFromId: 'src-1', sourceToId: 'src-2', relType: 'BAD TYPE', props: {}, aLabels: ['Entity'], bLabels: ['Entity'] }),
        ],
      })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await expect(
      copyGraphData({
        sourceDocumentId: SOURCE_DOC_ID,
        targetDocumentId: TARGET_DOC_ID,
        targetUserId: TARGET_USER_ID,
      })
    ).rejects.toThrow('Error copying graph data');
  });

  it('rejects Cypher reserved-word label and throws', async () => {
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({
            sourceId: 'src-1',
            labels: ['MATCH'],
            props: {},
          }),
        ],
      })
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await expect(
      copyGraphData({
        sourceDocumentId: SOURCE_DOC_ID,
        targetDocumentId: TARGET_DOC_ID,
        targetUserId: TARGET_USER_ID,
      })
    ).rejects.toThrow('Error copying graph data');

    const txQueries = flattenedTransactionQueries(mockGraphDb);
    expect(txQueries.find((q) => q.query.includes('MERGE (n:'))).toBeUndefined();
  });

  it('rejects Cypher reserved-word relationship type and throws', async () => {
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceId: 'src-1', labels: ['Entity'], props: {} }),
          makeRecord({ sourceId: 'src-2', labels: ['Entity'], props: {} }),
        ],
      })
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceFromId: 'src-1', sourceToId: 'src-2', relType: 'RETURN', props: {}, aLabels: ['Entity'], bLabels: ['Entity'] }),
        ],
      })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await expect(
      copyGraphData({
        sourceDocumentId: SOURCE_DOC_ID,
        targetDocumentId: TARGET_DOC_ID,
        targetUserId: TARGET_USER_ID,
      })
    ).rejects.toThrow('Error copying graph data');
  });

  it('invokes deleteGraphNodes for the target when write phase fails', async () => {
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({
            sourceId: 'src-1',
            labels: ['MATCH'],
            props: {},
          }),
        ],
      })
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await expect(
      copyGraphData({
        sourceDocumentId: SOURCE_DOC_ID,
        targetDocumentId: TARGET_DOC_ID,
        targetUserId: TARGET_USER_ID,
      })
    ).rejects.toThrow('Error copying graph data');

    expect(deleteGraphNodes).toHaveBeenCalledWith(TARGET_DOC_ID);
    expect(deleteGraphNodes).toHaveBeenCalledTimes(1);
  });

  it('does not mask the original error when cleanup itself fails', async () => {
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceId: 'src-1', labels: ['MATCH'], props: {} }),
        ],
      })
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    (deleteGraphNodes as jest.Mock).mockRejectedValueOnce(new Error('cleanup blew up'));

    // The original write error (sanitized) is what bubbles up — not the
    // cleanup error.
    await expect(
      copyGraphData({
        sourceDocumentId: SOURCE_DOC_ID,
        targetDocumentId: TARGET_DOC_ID,
        targetUserId: TARGET_USER_ID,
      })
    ).rejects.toThrow('Error copying graph data');

    expect(deleteGraphNodes).toHaveBeenCalledWith(TARGET_DOC_ID);
  });

  it('excludes IDENTITY and IN_CLUSTER edges from copy at the read layer', async () => {
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceId: 'src-1', labels: ['Entity'], props: {} }),
          makeRecord({ sourceId: 'src-2', labels: ['Entity'], props: {} }),
        ],
      })
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await copyGraphData({
      sourceDocumentId: SOURCE_DOC_ID,
      targetDocumentId: TARGET_DOC_ID,
      targetUserId: TARGET_USER_ID,
    });

    const runs = getRunQueries(mockGraphDb);
    const interNodeRead = runs.find(
      (r) => r.query.includes('MATCH (a)-[r]->(b)') && r.query.includes('type(r) <> \'IDENTITY\'')
    );
    expect(interNodeRead).toBeDefined();
    // :IN_CLUSTER is derived state the recipient's own resolution flow
    // re-derives, same rationale as IDENTITY — excluded from the same query.
    expect(interNodeRead!.query).toContain('type(r) <> \'IN_CLUSTER\'');
    const docOutRead = runs.find(
      (r) => r.query.includes('Document {id: $sourceDocumentId})-[r]->(n)') && r.query.includes('type(r) <> \'IDENTITY\'')
    );
    expect(docOutRead).toBeDefined();
    const docInRead = runs.find(
      (r) => r.query.includes('(n)-[r]->(d:Document {id: $sourceDocumentId})') && r.query.includes('type(r) <> \'IDENTITY\'')
    );
    expect(docInRead).toBeDefined();
  });

  it('batches respect EMBED_BATCH_SIZE (130 nodes => 3 batches)', async () => {
    const nodes = Array.from({ length: 130 }, (_, i) => makeRecord({
      sourceId: `src-${i}`,
      labels: ['Entity'],
      props: { name: `n${i}`, normalizedName: `n${i}` },
    }));

    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({ records: nodes })
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await copyGraphData({
      sourceDocumentId: SOURCE_DOC_ID,
      targetDocumentId: TARGET_DOC_ID,
      targetUserId: TARGET_USER_ID,
    });

    const txBatches = getTransactionBatches(mockGraphDb);
    // Find the call where node MERGE batches were issued
    const nodeMergeCall = txBatches.find(
      (batch) => batch.length > 0 && batch.every((q) => q.query.includes('MERGE (n:'))
    );
    expect(nodeMergeCall).toBeDefined();
    expect(nodeMergeCall!.length).toBe(3); // 50 + 50 + 30
  });

  it('overwrites reserved properties on copied nodes', async () => {
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({
            sourceId: 'src-1',
            labels: ['Entity'],
            props: {
              id: 'should-be-overwritten',
              userId: 'old-user',
              documentId: 'old-doc',
              name: 'Foo',
            },
          }),
        ],
      })
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await copyGraphData({
      sourceDocumentId: SOURCE_DOC_ID,
      targetDocumentId: TARGET_DOC_ID,
      targetUserId: TARGET_USER_ID,
    });

    const txBatches = getTransactionBatches(mockGraphDb);
    const nodeBatch = txBatches.find((batch) => batch.some((q) => q.query.includes('MERGE (n:')));
    expect(nodeBatch).toBeDefined();
    const batchParams = nodeBatch![0].parameters as { batch: Array<{ props: Record<string, unknown> }> };
    expect(batchParams.batch[0].props.id).toBeUndefined();
    expect(batchParams.batch[0].props.userId).toBeUndefined();
    expect(batchParams.batch[0].props.documentId).toBeUndefined();
    expect(batchParams.batch[0].props.name).toBe('Foo');
  });

  it('syncs Entity ids with PG graph_entity_embeddings rows', async () => {
    (db.graphEntityEmbedding.findMany as jest.Mock).mockResolvedValue([
      { id: 'pg-entity-1', entityName: 'Acme Corp' },
      { id: 'pg-entity-2', entityName: 'Bob' },
    ]);
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceId: 'src-1', labels: ['Entity'], props: { normalizedName: 'acme corp' } }),
        ],
      })
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await copyGraphData({
      sourceDocumentId: SOURCE_DOC_ID,
      targetDocumentId: TARGET_DOC_ID,
      targetUserId: TARGET_USER_ID,
    });

    const txQueries = flattenedTransactionQueries(mockGraphDb);
    const entitySyncs = txQueries.filter(
      (q) => q.query.includes('MATCH (e:Entity') && q.query.includes('SET e.id = $postgresId')
    );
    expect(entitySyncs.length).toBe(2);
    const params = entitySyncs.map((q) => q.parameters);
    expect(params).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ normalizedName: 'acme corp', postgresId: 'pg-entity-1' }),
        expect.objectContaining({ normalizedName: 'bob', postgresId: 'pg-entity-2' }),
      ])
    );
  });

  it('syncs Concept ids with PG graph_concept_embeddings rows by (name, category)', async () => {
    (db.graphConceptEmbedding.findMany as jest.Mock).mockResolvedValue([
      { id: 'pg-concept-1', conceptName: 'Tax Strategy', category: 'BUSINESS' },
    ]);
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({
            sourceId: 'src-1',
            labels: ['Concept'],
            props: { normalizedName: 'tax strategy', category: 'BUSINESS' },
          }),
        ],
      })
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await copyGraphData({
      sourceDocumentId: SOURCE_DOC_ID,
      targetDocumentId: TARGET_DOC_ID,
      targetUserId: TARGET_USER_ID,
    });

    const txQueries = flattenedTransactionQueries(mockGraphDb);
    const conceptSync = txQueries.find(
      (q) => q.query.includes('MATCH (c:Concept') && q.query.includes('SET c.id = $postgresId')
    );
    expect(conceptSync).toBeDefined();
    expect(conceptSync!.parameters).toEqual(
      expect.objectContaining({
        normalizedName: 'tax strategy',
        category: 'BUSINESS',
        postgresId: 'pg-concept-1',
      })
    );
  });

  it('remaps Chunk.embeddingId to new PG Embedding ids by (documentId, contentNum)', async () => {
    (db.embedding.findMany as jest.Mock).mockResolvedValue([
      { id: 'pg-emb-1', contentNum: 0 },
      { id: 'pg-emb-2', contentNum: 1 },
    ]);
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceId: 'src-chunk-1', labels: ['Chunk'], props: { contentNum: 0 } }),
          makeRecord({ sourceId: 'src-chunk-2', labels: ['Chunk'], props: { contentNum: 1 } }),
        ],
      })
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await copyGraphData({
      sourceDocumentId: SOURCE_DOC_ID,
      targetDocumentId: TARGET_DOC_ID,
      targetUserId: TARGET_USER_ID,
    });

    const txQueries = flattenedTransactionQueries(mockGraphDb);
    const chunkRemaps = txQueries.filter((q) => q.query.includes('SET c.embeddingId = $embeddingId'));
    expect(chunkRemaps.length).toBe(2);
    const params = chunkRemaps.map((q) => q.parameters);
    expect(params).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ contentNum: 0, embeddingId: 'pg-emb-1' }),
        expect.objectContaining({ contentNum: 1, embeddingId: 'pg-emb-2' }),
      ])
    );
  });

  it('strips _sourceId marker before marking copy complete', async () => {
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceId: 'src-1', labels: ['Entity'], props: {} }),
        ],
      })
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await copyGraphData({
      sourceDocumentId: SOURCE_DOC_ID,
      targetDocumentId: TARGET_DOC_ID,
      targetUserId: TARGET_USER_ID,
    });

    // Strip is now a runTransaction with one label-scoped REMOVE per indexed
    // label (Entity, Concept, Chunk). markCopyComplete remains a `run`.
    const stripBatch = getTransactionBatches(mockGraphDb).find(
      (batch) => batch.length > 0 && batch.every((q) => q.query.includes('REMOVE n._sourceId'))
    );
    expect(stripBatch).toBeDefined();
    expect(stripBatch!.length).toBe(3);
    const stripLabels = stripBatch!.map((q) => q.query.match(/MATCH \(n:(\w+)/)?.[1]);
    expect(stripLabels).toEqual(expect.arrayContaining(['Entity', 'Concept', 'Chunk']));
    for (const q of stripBatch!) {
      expect(q.parameters).toEqual({ targetDocumentId: TARGET_DOC_ID });
    }

    const runs = getRunQueries(mockGraphDb);
    const completeCall = runs[runs.length - 1];
    expect(completeCall.query).toContain('SET d.copyComplete = true');
    expect(completeCall.parameters).toEqual({ targetDocumentId: TARGET_DOC_ID });

    // Strip must run BEFORE markCopyComplete — otherwise a worker that crashed
    // mid-strip would mark the copy complete with leftover _sourceId props.
    const stripTxIndex = mockGraphDb.runTransaction.mock.calls.findIndex(
      (call: unknown[]) => {
        const batch = call[0] as Array<{ query: string }>;
        return batch.length > 0 && batch.every((q) => q.query.includes('REMOVE n._sourceId'));
      }
    );
    expect(stripTxIndex).toBeGreaterThan(-1);
    const stripOrder = mockGraphDb.runTransaction.mock.invocationCallOrder[stripTxIndex];
    const completeRunIndex = mockGraphDb.run.mock.calls.findIndex(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('SET d.copyComplete = true')
    );
    expect(completeRunIndex).toBeGreaterThan(-1);
    const completeOrder = mockGraphDb.run.mock.invocationCallOrder[completeRunIndex];
    expect(stripOrder).toBeLessThan(completeOrder);
  });

  it('does not query for source Chunks first (no chunk-keyed prereq)', async () => {
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceId: 'src-1', labels: ['Entity'], props: {} }),
        ],
      })
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await copyGraphData({
      sourceDocumentId: SOURCE_DOC_ID,
      targetDocumentId: TARGET_DOC_ID,
      targetUserId: TARGET_USER_ID,
    });

    const runs = getRunQueries(mockGraphDb);
    // No query should refer to (:Chunk)-[:MENTIONS]->(:Entity) anchored on chunks
    expect(runs.find((r) => r.query.includes('Chunk)-[:MENTIONS]->'))).toBeUndefined();
    expect(runs.find((r) => r.query.includes('sourceChunk:Chunk'))).toBeUndefined();
  });

  it('throws idempotency guard when target already has a complete copy (copyComplete=true)', async () => {
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] }) // source check
      .mockResolvedValueOnce({
        records: [makeRecord({ sourceId: 'src-1', labels: ['Entity'], props: {} })],
      }) // node read
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] }) // doc props
      .mockResolvedValueOnce({ records: [] }) // inter-node edges
      .mockResolvedValueOnce({ records: [] }) // doc out edges
      .mockResolvedValueOnce({ records: [] }) // doc in edges
      .mockResolvedValueOnce({ records: [makeRecord({ copyComplete: true })] }); // target exists, fully complete

    await expect(
      copyGraphData({
        sourceDocumentId: SOURCE_DOC_ID,
        targetDocumentId: TARGET_DOC_ID,
        targetUserId: TARGET_USER_ID,
      })
    ).rejects.toThrow(/already has graph data/);

    // Idempotency guard fires before the inner try/catch — cleanup must NOT
    // run, since we didn't write anything to clean up.
    expect(deleteGraphNodes).not.toHaveBeenCalled();
  });

  it('detects stale orphan target (no copyComplete flag) and runs cleanup before retry-writing', async () => {
    // Simulates a previous attempt that died after writeTargetDocument but
    // before markCopyComplete — leaves a Document with no copyComplete flag.
    // The smart guard should detect this, run cleanup, then proceed with a
    // fresh write so the share recovers instead of dead-ending.
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] }) // source check
      .mockResolvedValueOnce({
        records: [makeRecord({ sourceId: 'src-1', labels: ['Entity'], props: {} })],
      }) // node read
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] }) // doc props
      .mockResolvedValueOnce({ records: [] }) // inter-node edges
      .mockResolvedValueOnce({ records: [] }) // doc out edges
      .mockResolvedValueOnce({ records: [] }) // doc in edges
      .mockResolvedValueOnce({ records: [makeRecord({ copyComplete: null })] }) // stale orphan: Document exists, no flag
      .mockResolvedValueOnce({ records: [] }) // CREATE target Document (after cleanup)
      .mockResolvedValueOnce({ records: [] }); // mark copyComplete

    const result = await copyGraphData({
      sourceDocumentId: SOURCE_DOC_ID,
      targetDocumentId: TARGET_DOC_ID,
      targetUserId: TARGET_USER_ID,
    });

    expect(result).toBe(true);
    // Cleanup ran exactly once — pre-write recovery, not post-write rollback.
    expect(deleteGraphNodes).toHaveBeenCalledWith(TARGET_DOC_ID);
    expect(deleteGraphNodes).toHaveBeenCalledTimes(1);

    // Cleanup must precede the new CREATE — otherwise the existing orphan
    // would still be there and the new write would violate the Document.id
    // uniqueness constraint.
    const deleteOrder = (deleteGraphNodes as jest.Mock).mock.invocationCallOrder[0];
    const createCall = mockGraphDb.run.mock.calls.findIndex(
      (call) => typeof call[0] === 'string' && call[0].includes('CREATE (target:Document)')
    );
    expect(createCall).toBeGreaterThan(-1);
    const createOrder = mockGraphDb.run.mock.invocationCallOrder[createCall];
    expect(deleteOrder).toBeLessThan(createOrder);
  });

  it('surfaces sanitized error and skips CREATE when pre-write cleanup of stale orphan fails', async () => {
    // Stale-orphan path where deleteGraphNodes itself throws. We must NOT
    // proceed to CREATE — the orphan still exists and the Document.id
    // uniqueness constraint would reject the write anyway. The error is
    // sanitized; BullMQ's retry will re-detect the orphan and try again.
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] }) // source check
      .mockResolvedValueOnce({
        records: [makeRecord({ sourceId: 'src-1', labels: ['Entity'], props: {} })],
      }) // node read
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] }) // doc props
      .mockResolvedValueOnce({ records: [] }) // inter-node edges
      .mockResolvedValueOnce({ records: [] }) // doc out edges
      .mockResolvedValueOnce({ records: [] }) // doc in edges
      .mockResolvedValueOnce({ records: [makeRecord({ copyComplete: null })] }); // stale orphan detected

    (deleteGraphNodes as jest.Mock).mockRejectedValueOnce(new Error('Neo4j cleanup tx timeout'));

    await expect(
      copyGraphData({
        sourceDocumentId: SOURCE_DOC_ID,
        targetDocumentId: TARGET_DOC_ID,
        targetUserId: TARGET_USER_ID,
      })
    ).rejects.toThrow('Error copying graph data');

    // Cleanup was attempted exactly once (the failing pre-write call).
    expect(deleteGraphNodes).toHaveBeenCalledTimes(1);

    // No CREATE was issued — the orphan blocks the write.
    const createCall = mockGraphDb.run.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('CREATE (target:Document)')
    );
    expect(createCall).toBeUndefined();
  });

  it('does not inherit copyComplete from source Document properties (re-share safety)', async () => {
    // Source Document carries copyComplete=true (because it was itself a
    // recipient of a previous share). The new target must NOT inherit it,
    // otherwise the next attempt's guard would treat a never-attempted target
    // as a complete copy and refuse to write.
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({
        records: [makeRecord({ sourceId: 'src-1', labels: ['Entity'], props: {} })],
      })
      .mockResolvedValueOnce({
        records: [makeRecord({ props: { filename: 'f.pdf', copyComplete: true } })],
      }) // doc props include copyComplete=true (inherited from source)
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] }) // existing check: no Document
      .mockResolvedValueOnce({ records: [] }) // CREATE target
      .mockResolvedValueOnce({ records: [] }); // mark complete

    await copyGraphData({
      sourceDocumentId: SOURCE_DOC_ID,
      targetDocumentId: TARGET_DOC_ID,
      targetUserId: TARGET_USER_ID,
    });

    const createCall = getRunQueries(mockGraphDb).find((q) => q.query.includes('CREATE (target:Document)'));
    expect(createCall).toBeDefined();
    const props = createCall?.parameters?.props as Record<string, unknown>;
    expect(props).not.toHaveProperty('copyComplete');
  });

  it('does not invoke cleanup when a read-phase query throws', async () => {
    // Read-phase failures happen before writeTargetDocument creates any orphan,
    // so cleanup should not fire. Outer try/catch still sanitizes the error.
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] }) // source check passes
      .mockRejectedValueOnce(new Error('Neo4j read timeout during readSourceNodes'));

    await expect(
      copyGraphData({
        sourceDocumentId: SOURCE_DOC_ID,
        targetDocumentId: TARGET_DOC_ID,
        targetUserId: TARGET_USER_ID,
      })
    ).rejects.toThrow('Error copying graph data');

    expect(deleteGraphNodes).not.toHaveBeenCalled();
  });

  it('wraps unknown errors with sanitized message', async () => {
    mockGraphDb.run.mockRejectedValueOnce(new Error('Neo4j connection failed'));

    await expect(
      copyGraphData({
        sourceDocumentId: SOURCE_DOC_ID,
        targetDocumentId: TARGET_DOC_ID,
        targetUserId: TARGET_USER_ID,
      })
    ).rejects.toThrow('Error copying graph data');
  });

  it('uses MERGE keyed on (documentId, _sourceId) for non-Document nodes', async () => {
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceId: 'src-1', labels: ['Entity'], props: { name: 'A' } }),
        ],
      })
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await copyGraphData({
      sourceDocumentId: SOURCE_DOC_ID,
      targetDocumentId: TARGET_DOC_ID,
      targetUserId: TARGET_USER_ID,
    });

    const txQueries = flattenedTransactionQueries(mockGraphDb);
    const nodeWrite = txQueries.find((q) => q.query.includes('MERGE (n:'));
    expect(nodeWrite).toBeDefined();
    expect(nodeWrite!.query).toContain('documentId: $targetDocumentId');
    expect(nodeWrite!.query).toContain('_sourceId: row.sourceId');
    expect(nodeWrite!.query).toContain('ON CREATE SET');
    // Guard against the regression: no plain CREATE of a non-Document node.
    expect(nodeWrite!.query).not.toMatch(/CREATE \(n:/);
  });

  it('uses MERGE for inter-node edges instead of CREATE', async () => {
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceId: 'src-1', labels: ['Entity'], props: {} }),
          makeRecord({ sourceId: 'src-2', labels: ['Entity'], props: {} }),
        ],
      })
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceFromId: 'src-1', sourceToId: 'src-2', relType: 'WORKS_FOR', props: {}, aLabels: ['Entity'], bLabels: ['Entity'] }),
        ],
      })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await copyGraphData({
      sourceDocumentId: SOURCE_DOC_ID,
      targetDocumentId: TARGET_DOC_ID,
      targetUserId: TARGET_USER_ID,
    });

    const txQueries = flattenedTransactionQueries(mockGraphDb);
    const edgeWrite = txQueries.find((q) => q.query.includes('MERGE (a)-[r:'));
    expect(edgeWrite).toBeDefined();
    expect(edgeWrite!.query).toContain('ON CREATE SET');
    expect(edgeWrite!.query).not.toMatch(/CREATE \(a\)-\[/);
  });

  it('uses MERGE for Document-anchored edges instead of CREATE', async () => {
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceId: 'src-1', labels: ['Entity'], props: {} }),
        ],
      })
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ otherId: 'src-1', relType: 'MENTIONS', props: {}, otherLabels: ['Entity'] }),
        ],
      })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ otherId: 'src-1', relType: 'BELONGS_TO', props: {}, otherLabels: ['Entity'] }),
        ],
      })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await copyGraphData({
      sourceDocumentId: SOURCE_DOC_ID,
      targetDocumentId: TARGET_DOC_ID,
      targetUserId: TARGET_USER_ID,
    });

    const txQueries = flattenedTransactionQueries(mockGraphDb);
    const docOutEdge = txQueries.find((q) => q.query.includes('MERGE (d)-[r:'));
    const docInEdge = txQueries.find((q) => q.query.includes('MERGE (n)-[r:'));
    expect(docOutEdge).toBeDefined();
    expect(docInEdge).toBeDefined();
    expect(docOutEdge!.query).toContain('ON CREATE SET');
    expect(docInEdge!.query).toContain('ON CREATE SET');
    expect(docOutEdge!.query).not.toMatch(/CREATE \(d\)-\[/);
    expect(docInEdge!.query).not.toMatch(/CREATE \(n\)-\[/);
  });

  it('rejects edge whose endpoint label is not in INDEXED_LABELS', async () => {
    // Source returns an inter-node edge whose `aLabels` contains only
    // non-indexed labels. The matching node fixture has the same labels so
    // the read phase succeeds; the throw must come from the write-site
    // precondition in writeTargetInterNodeEdges.
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceId: 'src-1', labels: ['UnknownLabel'], props: {} }),
          makeRecord({ sourceId: 'src-2', labels: ['Entity'], props: {} }),
        ],
      })
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceFromId: 'src-1', sourceToId: 'src-2', relType: 'WORKS_FOR', props: {}, aLabels: ['UnknownLabel'], bLabels: ['Entity'] }),
        ],
      })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await expect(
      copyGraphData({
        sourceDocumentId: SOURCE_DOC_ID,
        targetDocumentId: TARGET_DOC_ID,
        targetUserId: TARGET_USER_ID,
      })
    ).rejects.toThrow('Error copying graph data');

    // Cleanup-on-failure path triggered (write-phase throw).
    expect(deleteGraphNodes).toHaveBeenCalledWith(TARGET_DOC_ID);

    // No inter-node-edge MERGE was issued — the throw happens before
    // grouping and Cypher generation.
    const txQueries = flattenedTransactionQueries(mockGraphDb);
    expect(txQueries.find((q) => q.query.includes('MERGE (a)-[r:'))).toBeUndefined();
  });

  it('inter-node edge MATCHes are label-scoped (regression for label-less perf bug)', async () => {
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceId: 'src-1', labels: ['Entity'], props: {} }),
          makeRecord({ sourceId: 'src-2', labels: ['Entity'], props: {} }),
          makeRecord({ sourceId: 'src-3', labels: ['Chunk'], props: {} }),
        ],
      })
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceFromId: 'src-1', sourceToId: 'src-2', relType: 'WORKS_FOR', props: {}, aLabels: ['Entity'], bLabels: ['Entity'] }),
          makeRecord({ sourceFromId: 'src-1', sourceToId: 'src-3', relType: 'DISCUSSES', props: {}, aLabels: ['Entity'], bLabels: ['Chunk'] }),
        ],
      })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await copyGraphData({
      sourceDocumentId: SOURCE_DOC_ID,
      targetDocumentId: TARGET_DOC_ID,
      targetUserId: TARGET_USER_ID,
    });

    const txQueries = flattenedTransactionQueries(mockGraphDb);
    // Negative assertion: NO query may use the label-less form on the
    // (documentId, _sourceId) endpoint MATCH. This is the regression guard.
    for (const q of txQueries) {
      expect(q.query).not.toMatch(/MATCH \(a \{documentId/);
      expect(q.query).not.toMatch(/MATCH \(b \{documentId/);
    }
    // Positive sanity: at least one edge MERGE was issued and used label-scoped MATCH.
    const edgeMerges = txQueries.filter((q) => q.query.includes('MERGE (a)-[r:'));
    expect(edgeMerges.length).toBeGreaterThan(0);
    for (const q of edgeMerges) {
      expect(q.query).toContain('MATCH (a:');
      expect(q.query).toContain('MATCH (b:');
    }
  });

  it('inter-node edge with indexed + non-indexed labels picks the indexed label for MATCH', async () => {
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceId: 'src-1', labels: ['Entity', 'Person'], props: {} }),
          makeRecord({ sourceId: 'src-2', labels: ['Chunk'], props: {} }),
        ],
      })
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceFromId: 'src-1', sourceToId: 'src-2', relType: 'DISCUSSES', props: {}, aLabels: ['Entity', 'Person'], bLabels: ['Chunk'] }),
        ],
      })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await copyGraphData({
      sourceDocumentId: SOURCE_DOC_ID,
      targetDocumentId: TARGET_DOC_ID,
      targetUserId: TARGET_USER_ID,
    });

    const txQueries = flattenedTransactionQueries(mockGraphDb);
    const edgeMerge = txQueries.find((q) => q.query.includes('MERGE (a)-[r:DISCUSSES]'));
    expect(edgeMerge).toBeDefined();
    expect(edgeMerge!.query).toContain('MATCH (a:Entity {');
    expect(edgeMerge!.query).not.toContain('MATCH (a:Person');
    expect(edgeMerge!.query).toContain('MATCH (b:Chunk {');

    // labelClause-membership invariant: the corresponding node MERGE labelClause
    // contains the same canonical label picked for the edge MATCH. Catches a
    // future drift between byLabelKey grouping and pickCanonicalLabel priority.
    const nodeMerge = txQueries.find((q) => q.query.includes('MERGE (n:Entity:Person'));
    expect(nodeMerge).toBeDefined();
  });

  it('inter-node edge with two indexed labels picks the higher-priority one (Entity > Concept)', async () => {
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceId: 'src-1', labels: ['Concept', 'Entity'], props: {} }),
          makeRecord({ sourceId: 'src-2', labels: ['Chunk'], props: {} }),
        ],
      })
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceFromId: 'src-1', sourceToId: 'src-2', relType: 'DISCUSSES', props: {}, aLabels: ['Concept', 'Entity'], bLabels: ['Chunk'] }),
        ],
      })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await copyGraphData({
      sourceDocumentId: SOURCE_DOC_ID,
      targetDocumentId: TARGET_DOC_ID,
      targetUserId: TARGET_USER_ID,
    });

    const txQueries = flattenedTransactionQueries(mockGraphDb);
    const edgeMerge = txQueries.find((q) => q.query.includes('MERGE (a)-[r:DISCUSSES]'));
    expect(edgeMerge).toBeDefined();
    expect(edgeMerge!.query).toContain('MATCH (a:Entity {');
    expect(edgeMerge!.query).not.toContain('MATCH (a:Concept');
  });

  it('document-edge MATCH for the non-Document side is label-scoped', async () => {
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceId: 'src-chunk', labels: ['Chunk'], props: {} }),
          makeRecord({ sourceId: 'src-concept', labels: ['Concept'], props: {} }),
        ],
      })
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ otherId: 'src-chunk', relType: 'CONTAINS', props: {}, otherLabels: ['Chunk'] }),
        ],
      })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ otherId: 'src-concept', relType: 'BELONGS_TO', props: {}, otherLabels: ['Concept'] }),
        ],
      })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await copyGraphData({
      sourceDocumentId: SOURCE_DOC_ID,
      targetDocumentId: TARGET_DOC_ID,
      targetUserId: TARGET_USER_ID,
    });

    const txQueries = flattenedTransactionQueries(mockGraphDb);
    // Negative assertion: no doc-edge query may use a label-less form on the
    // non-Document endpoint.
    const docEdgeQueries = txQueries.filter(
      (q) => q.query.includes('MERGE (d)-[r:') || q.query.includes('MERGE (n)-[r:')
    );
    expect(docEdgeQueries.length).toBeGreaterThan(0);
    for (const q of docEdgeQueries) {
      expect(q.query).not.toMatch(/MATCH \(n \{documentId/);
    }
    // Positive: each direction was emitted with its expected label scoping.
    const outQuery = txQueries.find((q) => q.query.includes('MERGE (d)-[r:CONTAINS]'));
    expect(outQuery).toBeDefined();
    expect(outQuery!.query).toContain('MATCH (n:Chunk {');
    const inQuery = txQueries.find((q) => q.query.includes('MERGE (n)-[r:BELONGS_TO]'));
    expect(inQuery).toBeDefined();
    expect(inQuery!.query).toContain('MATCH (n:Concept {');
  });

  it('rejects unsafe endpoint label and throws', async () => {
    mockGraphDb.run
      .mockResolvedValueOnce({ records: [makeRecord({ d: 'doc' })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceId: 'src-1', labels: ['Entity'], props: {} }),
          makeRecord({ sourceId: 'src-2', labels: ['Entity'], props: {} }),
        ],
      })
      .mockResolvedValueOnce({ records: [makeRecord({ props: {} })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({ sourceFromId: 'src-1', sourceToId: 'src-2', relType: 'WORKS_FOR', props: {}, aLabels: ['Bad`Label'], bLabels: ['Entity'] }),
        ],
      })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await expect(
      copyGraphData({
        sourceDocumentId: SOURCE_DOC_ID,
        targetDocumentId: TARGET_DOC_ID,
        targetUserId: TARGET_USER_ID,
      })
    ).rejects.toThrow('Error copying graph data');

    const txQueries = flattenedTransactionQueries(mockGraphDb);
    expect(txQueries.find((q) => q.query.includes('MERGE (a)-[r:'))).toBeUndefined();
  });
});
