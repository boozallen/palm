import fixture from '@/features/graph-database/data/palm-graph-fixtures/small-valid-palm-graph.json';
import { ingestPalmGraph } from '@/features/graph-database/services/jsonIngest/ingestPalmGraph';

jest.mock('@/features/graph-database', () => ({
  getGraphDatabaseSource: jest.fn(),
}));

jest.mock('@/features/shared/dal/document-library/upload/embedContent', () => ({
  embedContent: jest.fn(),
}));

jest.mock('@/features/graph-database/services/graphBuilder', () => ({
  createGraphEntityEmbedding: jest.fn().mockResolvedValue(undefined),
  createGraphConceptEmbedding: jest.fn().mockResolvedValue(undefined),
  createDocumentNode: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/graph-database/services/jsonIngest/neo4jWriter', () => {
  const actual = jest.requireActual(
    '@/features/graph-database/services/jsonIngest/neo4jWriter'
  );
  return {
    ...actual,
    writeDocumentMentions: jest.fn().mockResolvedValue(undefined),
  };
});

import { getGraphDatabaseSource } from '@/features/graph-database';
import { embedContent } from '@/features/shared/dal/document-library/upload/embedContent';
import {
  createGraphEntityEmbedding,
  createGraphConceptEmbedding,
  createDocumentNode,
} from '@/features/graph-database/services/graphBuilder';
import { writeDocumentMentions } from '@/features/graph-database/services/jsonIngest/neo4jWriter';

const mockGetGraphDatabaseSource = getGraphDatabaseSource as jest.Mock;
const mockEmbedContent = embedContent as jest.Mock;
const mockCreateEntityEmbedding = createGraphEntityEmbedding as jest.Mock;
const mockCreateConceptEmbedding = createGraphConceptEmbedding as jest.Mock;
const mockCreateDocumentNode = createDocumentNode as jest.Mock;
const mockWriteDocumentMentions = writeDocumentMentions as jest.Mock;

const logger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
} as any;

const mockNeo4j = () => ({
  run: jest.fn(),
  runTransaction: jest.fn().mockResolvedValue([]),
  connect: jest.fn(),
  disconnect: jest.fn(),
  healthCheck: jest.fn(),
  getSession: jest.fn(),
  getProviderType: jest.fn(),
});

const makeDocInput = () => ({
  id: 'doc-1',
  filename: 'palm-graph.json',
  uploadStatus: 'Completed',
  createdAt: new Date('2026-04-23T00:00:00Z'),
  userId: 'user-1',
  documentUploadProviderId: 'provider-1',
  totalChunks: 3,
  totalTokens: 0,
});

describe('ingestPalmGraph', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGraphDatabaseSource.mockResolvedValue(mockNeo4j());
    mockEmbedContent.mockImplementation(async (content: string[]) => ({
      embeddings: content.map(() => ({ embedding: [0.1, 0.2, 0.3] })),
    }));
  });

  it('orchestrates full ingest, returning expected counts on happy path', async () => {
    const result = await ingestPalmGraph({
      palmGraph: fixture as any,
      document: makeDocInput(),
      userId: 'user-1',
      logger,
    });

    // 4 Entity-label input entities + 1 synthesized parent (Bamboo Health) = 5 entity-label total
    expect(result.entityCount).toBe(5);
    // 3 Concept-label input entities (partnering_posture, market, capability) = 3
    expect(result.conceptCount).toBe(3);
    // 5 user relations + 1 synthesized CONTROLLED_BY = 6
    expect(result.edgeCount).toBe(6);
    expect(result.embeddingSkippedCount).toBe(0);
    expect(result.embeddingCount).toBe(5 + 3);
    expect(result.documentCount).toBe(1);
  });

  it('calls createDocumentNode exactly once with the document input', async () => {
    await ingestPalmGraph({
      palmGraph: fixture as any,
      document: makeDocInput(),
      userId: 'user-1',
      logger,
    });

    expect(mockCreateDocumentNode).toHaveBeenCalledTimes(1);
    const arg = mockCreateDocumentNode.mock.calls[0][0];
    expect(arg.id).toBe('doc-1');
    expect(arg.filename).toBe('palm-graph.json');
    expect(arg.userId).toBe('user-1');
    expect(arg.totalChunks).toBe(3);
  });

  it('calls writeDocumentMentions with the entity and concept IDs from the palm-graph', async () => {
    await ingestPalmGraph({
      palmGraph: fixture as any,
      document: makeDocInput(),
      userId: 'user-1',
      logger,
    });

    expect(mockWriteDocumentMentions).toHaveBeenCalledTimes(1);
    const [, documentId, userId, entityIds, conceptIds] =
      mockWriteDocumentMentions.mock.calls[0];
    expect(documentId).toBe('doc-1');
    expect(userId).toBe('user-1');
    expect(entityIds.length).toBe(5);
    expect(conceptIds.length).toBe(3);
  });

  it('attaches match_hits to the HAS_PARTNERING_POSTURE edge', async () => {
    const graphDb = mockNeo4j();
    mockGetGraphDatabaseSource.mockResolvedValue(graphDb);

    await ingestPalmGraph({
      palmGraph: fixture as any,
      document: makeDocInput(),
      userId: 'user-1',
      logger,
    });

    // Look through the edge write transaction for a HAS_PARTNERING_POSTURE batch
    const edgeCall = graphDb.runTransaction.mock.calls.find((call: any[]) =>
      (call[0] as any[]).some((q: any) => q.query.includes('HAS_PARTNERING_POSTURE'))
    );
    expect(edgeCall).toBeDefined();
    const hpp = (edgeCall![0] as any[]).find((q: any) =>
      q.query.includes('HAS_PARTNERING_POSTURE')
    );
    expect(hpp.parameters.batch[0].props.match_hits).toEqual([
      'integration-friendly',
      'open api',
    ]);
  });

  it('rewrites palm-graph semantic IDs to UUIDs and preserves originals as externalId', async () => {
    const graphDb = mockNeo4j();
    mockGetGraphDatabaseSource.mockResolvedValue(graphDb);

    await ingestPalmGraph({
      palmGraph: fixture as any,
      document: makeDocInput(),
      userId: 'user-1',
      logger,
    });

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const externalIdRe = /^(company|agency|claim|partnering_posture|market|capability|parent):/;

    const nodeBatches = graphDb.runTransaction.mock.calls
      .flatMap((call: any[]) => call[0] as any[])
      .filter((q: any) => q.query.includes('MERGE (n:'));

    let rowsChecked = 0;
    for (const q of nodeBatches) {
      for (const row of q.parameters.batch) {
        expect(row.id).toMatch(uuidRe);
        expect(row.props.id).toMatch(uuidRe);
        expect(row.props.externalId).toMatch(externalIdRe);
        rowsChecked++;
      }
    }
    expect(rowsChecked).toBe(5 + 3); // 5 entity-label + 3 concept-label
  });

  it('translates relation endpoints from semantic IDs to UUIDs before writeEdges', async () => {
    const graphDb = mockNeo4j();
    mockGetGraphDatabaseSource.mockResolvedValue(graphDb);

    await ingestPalmGraph({
      palmGraph: fixture as any,
      document: makeDocInput(),
      userId: 'user-1',
      logger,
    });

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const edgeBatches = graphDb.runTransaction.mock.calls
      .flatMap((call: any[]) => call[0] as any[])
      .filter((q: any) => q.query.includes('MERGE (s)-[r:'));

    let rowsChecked = 0;
    for (const q of edgeBatches) {
      for (const row of q.parameters.batch) {
        expect(row.source).toMatch(uuidRe);
        expect(row.target).toMatch(uuidRe);
        rowsChecked++;
      }
    }
    expect(rowsChecked).toBe(6); // 5 user relations + 1 synthesized CONTROLLED_BY
  });

  it('passes UUIDs (not external ids) to writeDocumentMentions', async () => {
    const graphDb = mockNeo4j();
    mockGetGraphDatabaseSource.mockResolvedValue(graphDb);

    await ingestPalmGraph({
      palmGraph: fixture as any,
      document: makeDocInput(),
      userId: 'user-1',
      logger,
    });

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const [, , , entityIds, conceptIds] = mockWriteDocumentMentions.mock.calls[0];
    for (const id of entityIds) {
      expect(id).toMatch(uuidRe);
    }
    for (const id of conceptIds) {
      expect(id).toMatch(uuidRe);
    }
  });

  it('uses the same UUID for Neo4j Entity id and Postgres graph_entity_embeddings id', async () => {
    const graphDb = mockNeo4j();
    mockGetGraphDatabaseSource.mockResolvedValue(graphDb);

    await ingestPalmGraph({
      palmGraph: fixture as any,
      document: makeDocInput(),
      userId: 'user-1',
      logger,
    });

    const entityNodeIds = graphDb.runTransaction.mock.calls
      .flatMap((call: any[]) => call[0] as any[])
      .filter((q: any) => q.query.includes('MERGE (n:Entity'))
      .flatMap((q: any) => q.parameters.batch.map((r: any) => r.id));
    const entityEmbeddingIds = mockCreateEntityEmbedding.mock.calls.map(
      (c: any[]) => c[0].id
    );

    expect(entityEmbeddingIds.sort()).toEqual(entityNodeIds.sort());
  });

  it('batches embedding calls: one batch for entities, one for concepts (counts < 50)', async () => {
    await ingestPalmGraph({
      palmGraph: fixture as any,
      document: makeDocInput(),
      userId: 'user-1',
      logger,
    });
    // One call per label group
    expect(mockEmbedContent).toHaveBeenCalledTimes(2);
  });

  it('continues ingest when an embedding batch throws, incrementing embeddingSkippedCount', async () => {
    mockEmbedContent.mockImplementationOnce(async () => {
      throw new Error('transient 5xx');
    });
    // Second call (concepts) succeeds
    mockEmbedContent.mockImplementation(async (content: string[]) => ({
      embeddings: content.map(() => ({ embedding: [0.1, 0.2, 0.3] })),
    }));

    const result = await ingestPalmGraph({
      palmGraph: fixture as any,
      document: makeDocInput(),
      userId: 'user-1',
      logger,
    });

    // 5 entity-label embeddings skipped (the failed batch), 3 concept-label stored
    expect(result.embeddingSkippedCount).toBe(5);
    expect(result.embeddingCount).toBe(3);
    // Ingest still resolved successfully
    expect(result.entityCount).toBe(5);
  });

  it('writes embeddings via createGraphEntityEmbedding and createGraphConceptEmbedding', async () => {
    await ingestPalmGraph({
      palmGraph: fixture as any,
      document: makeDocInput(),
      userId: 'user-1',
      logger,
    });
    expect(mockCreateEntityEmbedding).toHaveBeenCalledTimes(5);
    expect(mockCreateConceptEmbedding).toHaveBeenCalledTimes(3);
  });

  it('embeds "${name} - ${description}" when description is provided, name only when absent', async () => {
    await ingestPalmGraph({
      palmGraph: fixture as any,
      document: makeDocInput(),
      userId: 'user-1',
      logger,
    });

    const embeddedTexts = mockEmbedContent.mock.calls.flatMap((c) => c[0] as string[]);

    // With description — matches LLM path pattern `${name} - ${description}`
    expect(embeddedTexts).toContain(
      'ACME Defense - Defense contractor focused on AI-enabled autonomy.'
    );
    expect(embeddedTexts).toContain('PatientPing - Healthcare coordination platform.');
    // Without description (claim, agency, synthesized parent, concepts) — name only
    expect(embeddedTexts).toContain('ACME fits DoD');
    expect(embeddedTexts).toContain('U.S. Army');
    expect(embeddedTexts).toContain('Bamboo Health');
    expect(embeddedTexts).toContain('Integrator-friendly');
  });

  it('persists description on the entity embedding row (empty string when absent)', async () => {
    await ingestPalmGraph({
      palmGraph: fixture as any,
      document: makeDocInput(),
      userId: 'user-1',
      logger,
    });

    const byName = new Map(
      mockCreateEntityEmbedding.mock.calls.map((c) => [c[0].entityName, c[0].description])
    );
    expect(byName.get('ACME Defense')).toBe(
      'Defense contractor focused on AI-enabled autonomy.'
    );
    expect(byName.get('PatientPing')).toBe('Healthcare coordination platform.');
    expect(byName.get('ACME fits DoD')).toBe('');
    expect(byName.get('U.S. Army')).toBe('');
  });
});
