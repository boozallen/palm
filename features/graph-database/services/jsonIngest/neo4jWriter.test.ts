import { writeNodes, writeEdges, writeDocumentMentions, EMBED_BATCH_SIZE } from '@/features/graph-database/services/jsonIngest/neo4jWriter';
import type { ValidRelation, InternalEntity } from '@/features/graph-database/services/jsonIngest/types';

const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
} as any;

const createMockDb = () => ({
  run: jest.fn(),
  runTransaction: jest.fn().mockResolvedValue([]),
  connect: jest.fn(),
  disconnect: jest.fn(),
  healthCheck: jest.fn(),
  getSession: jest.fn(),
  getProviderType: jest.fn(),
});

describe('writeNodes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('produces :Entity MERGE queries for label Entity', async () => {
    const db = createMockDb();
    const entities: InternalEntity[] = [
      { id: 'uuid-a', externalId: 'company:a', label: 'Entity', type: 'company', name: 'A' },
    ];
    const result = await writeNodes(db as any, entities, 'doc-1', 'user-1', mockLogger);
    expect(result).toEqual({ entityCount: 1, conceptCount: 0 });
    expect(db.runTransaction).toHaveBeenCalledTimes(1);
    const queries = db.runTransaction.mock.calls[0][0];
    expect(queries[0].query).toContain('MERGE (n:Entity');
    expect(queries[0].parameters.batch[0].props.type).toBe('company');
    expect(queries[0].parameters.batch[0].props.userId).toBe('user-1');
    expect(queries[0].parameters.batch[0].props.documentId).toBe('doc-1');
    expect(queries[0].parameters.batch[0].props.needsEmbedding).toBe(false);
  });

  it('produces :Concept MERGE queries using category instead of type', async () => {
    const db = createMockDb();
    const entities: InternalEntity[] = [
      { id: 'uuid-cap-ai', externalId: 'cap:ai', label: 'Concept', type: 'capability', name: 'AI' },
    ];
    const result = await writeNodes(db as any, entities, 'doc-1', 'user-1', mockLogger);
    expect(result).toEqual({ entityCount: 0, conceptCount: 1 });
    const queries = db.runTransaction.mock.calls[0][0];
    expect(queries[0].query).toContain('MERGE (n:Concept');
    expect(queries[0].parameters.batch[0].props.category).toBe('capability');
    expect(queries[0].parameters.batch[0].props.type).toBeUndefined();
  });

  it('produces two separate batches for mixed labels', async () => {
    const db = createMockDb();
    const entities: InternalEntity[] = [
      { id: 'uuid-a', externalId: 'company:a', label: 'Entity', type: 'company', name: 'A' },
      { id: 'uuid-cap-ai', externalId: 'cap:ai', label: 'Concept', type: 'capability', name: 'AI' },
    ];
    await writeNodes(db as any, entities, 'doc-1', 'user-1', mockLogger);
    const queries = db.runTransaction.mock.calls[0][0];
    expect(queries.length).toBe(2);
    expect(queries[0].query).toContain(':Entity');
    expect(queries[1].query).toContain(':Concept');
  });

  it('stringifies object property values but passes primitives through', async () => {
    const db = createMockDb();
    const entities: InternalEntity[] = [
      {
        id: 'uuid-a',
        externalId: 'company:a',
        label: 'Entity',
        type: 'company',
        name: 'A',
        properties: {
          hq: 'DC',
          score: 0.9,
          active: true,
          nested: { ceo: 'Jane' },
          tags: ['x', 'y'],
          mixed: ['x', { y: 1 }],
        },
      },
    ];
    await writeNodes(db as any, entities, 'doc-1', 'user-1', mockLogger);
    const batch = db.runTransaction.mock.calls[0][0][0].parameters.batch;
    const props = batch[0].props;
    expect(props.hq).toBe('DC');
    expect(props.score).toBe(0.9);
    expect(props.active).toBe(true);
    expect(props.nested).toBe('{"ceo":"Jane"}');
    expect(props.tags).toEqual(['x', 'y']);
    expect(props.mixed).toBe('["x",{"y":1}]');
  });

  it('respects EMBED_BATCH_SIZE by splitting large groups into multiple batches', async () => {
    const db = createMockDb();
    const entities: InternalEntity[] = Array.from({ length: 120 }, (_, i) => ({
      id: `uuid-${i}`,
      externalId: `company:${i}`,
      label: 'Entity' as const,
      type: 'company',
      name: `C${i}`,
    }));
    await writeNodes(db as any, entities, 'doc-1', 'user-1', mockLogger);
    const queries = db.runTransaction.mock.calls[0][0];
    expect(queries.length).toBe(Math.ceil(120 / EMBED_BATCH_SIZE));
  });

  it('sets needsEmbedding=false on every node', async () => {
    const db = createMockDb();
    const entities: InternalEntity[] = [
      { id: 'uuid-a', externalId: 'company:a', label: 'Entity', type: 'company', name: 'A' },
      { id: 'uuid-cap-ai', externalId: 'cap:ai', label: 'Concept', type: 'capability', name: 'AI' },
    ];
    await writeNodes(db as any, entities, 'doc-1', 'user-1', mockLogger);
    const queries = db.runTransaction.mock.calls[0][0];
    for (const q of queries) {
      for (const row of q.parameters.batch) {
        expect(row.props.needsEmbedding).toBe(false);
      }
    }
  });

  it('stamps userId and documentId on every node', async () => {
    const db = createMockDb();
    const entities: InternalEntity[] = [
      { id: 'uuid-a', externalId: 'company:a', label: 'Entity', type: 'company', name: 'A' },
    ];
    await writeNodes(db as any, entities, 'doc-XYZ', 'user-ABC', mockLogger);
    const batch = db.runTransaction.mock.calls[0][0][0].parameters.batch;
    expect(batch[0].props.userId).toBe('user-ABC');
    expect(batch[0].props.documentId).toBe('doc-XYZ');
  });

  it('sets externalId on node props and id stays as the supplied UUID', async () => {
    const db = createMockDb();
    const entities: InternalEntity[] = [
      { id: 'uuid-a', externalId: 'company:a', label: 'Entity', type: 'company', name: 'A' },
    ];
    await writeNodes(db as any, entities, 'doc-1', 'user-1', mockLogger);
    const row = db.runTransaction.mock.calls[0][0][0].parameters.batch[0];
    expect(row.id).toBe('uuid-a');
    expect(row.props.id).toBe('uuid-a');
    expect(row.props.externalId).toBe('company:a');
  });

  it('writes the entity description to the node and defaults to empty string when absent', async () => {
    const db = createMockDb();
    const entities: InternalEntity[] = [
      {
        id: 'uuid-with',
        externalId: 'company:with',
        label: 'Entity',
        type: 'company',
        name: 'With',
        description: 'Primary supplier of drones.',
      },
      {
        id: 'uuid-without',
        externalId: 'company:without',
        label: 'Entity',
        type: 'company',
        name: 'Without',
      },
    ];
    await writeNodes(db as any, entities, 'doc-1', 'user-1', mockLogger);
    const batch = db.runTransaction.mock.calls[0][0][0].parameters.batch;
    expect(batch[0].props.description).toBe('Primary supplier of drones.');
    expect(batch[1].props.description).toBe('');
  });
});

describe('writeEdges', () => {
  beforeEach(() => jest.clearAllMocks());

  it('produces one batch query per unique relation type', async () => {
    const db = createMockDb();
    const relations: ValidRelation[] = [
      { source: 'company:a', target: 'agency:x', type: 'RELEVANT_TO_AGENCY' },
      { source: 'company:a', target: 'cap:ai', type: 'HAS_CAPABILITY' },
      { source: 'company:b', target: 'cap:ai', type: 'HAS_CAPABILITY' },
    ];
    const result = await writeEdges(db as any, relations, 'doc-1', 'user-1', mockLogger);
    expect(result).toEqual({ edgeCount: 3 });
    const queries = db.runTransaction.mock.calls[0][0];
    expect(queries.length).toBe(2);
  });

  it('stamps userId and documentId on every edge row', async () => {
    const db = createMockDb();
    const relations: ValidRelation[] = [
      { source: 'a', target: 'b', type: 'REL', properties: { weight: 0.5 } },
    ];
    await writeEdges(db as any, relations, 'doc-1', 'user-1', mockLogger);
    const batch = db.runTransaction.mock.calls[0][0][0].parameters.batch;
    expect(batch[0].props.userId).toBe('user-1');
    expect(batch[0].props.documentId).toBe('doc-1');
    expect(batch[0].props.weight).toBe(0.5);
  });

  it('is a no-op when relations is empty', async () => {
    const db = createMockDb();
    const result = await writeEdges(db as any, [], 'doc-1', 'user-1', mockLogger);
    expect(result.edgeCount).toBe(0);
    expect(db.runTransaction).not.toHaveBeenCalled();
  });
});

describe('writeDocumentMentions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is a no-op when both entity and concept lists are empty', async () => {
    const db = createMockDb();
    await writeDocumentMentions(db as any, 'doc-1', 'user-1', [], [], mockLogger);
    expect(db.runTransaction).not.toHaveBeenCalled();
  });

  it('writes a MENTIONS query when only entity IDs are supplied', async () => {
    const db = createMockDb();
    await writeDocumentMentions(
      db as any,
      'doc-1',
      'user-1',
      ['e1', 'e2'],
      [],
      mockLogger
    );
    expect(db.runTransaction).toHaveBeenCalledTimes(1);
    const queries = db.runTransaction.mock.calls[0][0];
    expect(queries.length).toBe(1);
    expect(queries[0].query).toContain('MERGE (d)-[r:MENTIONS]->(e)');
    expect(queries[0].parameters.userId).toBe('user-1');
    expect(queries[0].parameters.batch).toEqual([
      { documentId: 'doc-1', entityId: 'e1' },
      { documentId: 'doc-1', entityId: 'e2' },
    ]);
  });

  it('writes a DISCUSSES query when only concept IDs are supplied', async () => {
    const db = createMockDb();
    await writeDocumentMentions(
      db as any,
      'doc-1',
      'user-1',
      [],
      ['c1'],
      mockLogger
    );
    const queries = db.runTransaction.mock.calls[0][0];
    expect(queries.length).toBe(1);
    expect(queries[0].query).toContain('MERGE (d)-[r:DISCUSSES]->(c)');
    expect(queries[0].parameters.batch).toEqual([
      { documentId: 'doc-1', conceptId: 'c1' },
    ]);
  });

  it('writes both MENTIONS and DISCUSSES queries for mixed input', async () => {
    const db = createMockDb();
    await writeDocumentMentions(
      db as any,
      'doc-1',
      'user-1',
      ['e1'],
      ['c1'],
      mockLogger
    );
    const queries = db.runTransaction.mock.calls[0][0];
    expect(queries.length).toBe(2);
    expect(queries[0].query).toContain('MERGE (d)-[r:MENTIONS]->(e)');
    expect(queries[1].query).toContain('MERGE (d)-[r:DISCUSSES]->(c)');
  });

  it('splits entity IDs into batches of EMBED_BATCH_SIZE', async () => {
    const db = createMockDb();
    const entityIds = Array.from({ length: EMBED_BATCH_SIZE * 2 + 5 }, (_, i) => `e${i}`);
    await writeDocumentMentions(
      db as any,
      'doc-1',
      'user-1',
      entityIds,
      [],
      mockLogger
    );
    const queries = db.runTransaction.mock.calls[0][0];
    expect(queries.length).toBe(Math.ceil(entityIds.length / EMBED_BATCH_SIZE));
  });
});
