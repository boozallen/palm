import { ContextType } from '@/server/trpc-context';
import graphRouter from '@/features/graph-database/routes';
import db from '@/server/db';
import { getGraphDatabaseSource } from '@/features/graph-database';

jest.mock('@/server/db', () => ({
  $queryRaw: jest.fn(),
  document: {
    findMany: jest.fn(),
  },
}));

jest.mock('@/features/graph-database', () => ({
  getGraphDatabaseSource: jest.fn(),
}));

const mockDb = db as jest.Mocked<typeof db>;
const mockGetGraphDatabaseSource = getGraphDatabaseSource as jest.MockedFunction<typeof getGraphDatabaseSource>;
describe('get-graphed-documents route', () => {
  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';

  const mockCtx = {
    userId: mockUserId,
    logger: {
      warn: jest.fn(),
    },
  } as unknown as ContextType;

  const mockNeo4jSession = {
    run: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGraphDatabaseSource.mockResolvedValue(mockNeo4jSession as any);
    // Default: no admin documents accessible to this user
    (mockDb.document.findMany as jest.Mock).mockResolvedValue([]);
  });

  describe('Basic functionality', () => {
    it('should return documentIds and ungraphableDocumentIds when Neo4j succeeds', async () => {
      // Mock PostgreSQL queries for completed and building graphed docs
      const completedDocs = [
        { documentId: '550e8400-e29b-41d4-a716-446655440011' },
        { documentId: '550e8400-e29b-41d4-a716-446655440012' },
        { documentId: '550e8400-e29b-41d4-a716-446655440013' },
      ];
      const buildingDocs: { documentId: string }[] = [];
      mockDb.$queryRaw
        .mockResolvedValueOnce(completedDocs)
        .mockResolvedValueOnce(buildingDocs);

      // Mock Neo4j query for docs with entities
      const neo4jRecords = [
        { get: jest.fn().mockReturnValue('550e8400-e29b-41d4-a716-446655440011') },
        { get: jest.fn().mockReturnValue('550e8400-e29b-41d4-a716-446655440012') },
      ];
      mockNeo4jSession.run.mockResolvedValue({
        records: neo4jRecords,
      });

      const caller = graphRouter.createCaller(mockCtx);
      const response = await caller.getGraphedDocuments();

      expect(response.documentIds).toEqual(['550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440012']);
      expect(response.ungraphableDocumentIds).toEqual(['550e8400-e29b-41d4-a716-446655440013']);
    });

    it('should handle empty result sets', async () => {
      // No graphed docs (both completed and building)
      mockDb.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Empty Neo4j result
      mockNeo4jSession.run.mockResolvedValue({
        records: [],
      });

      const caller = graphRouter.createCaller(mockCtx);
      const response = await caller.getGraphedDocuments();

      expect(response.documentIds).toEqual([]);
      expect(response.ungraphableDocumentIds).toEqual([]);
    });

    it('should handle case where all docs have entities', async () => {
      const completedDocs = [
        { documentId: '550e8400-e29b-41d4-a716-446655440011' },
        { documentId: '550e8400-e29b-41d4-a716-446655440012' },
      ];
      const buildingDocs: { documentId: string }[] = [];
      mockDb.$queryRaw
        .mockResolvedValueOnce(completedDocs)
        .mockResolvedValueOnce(buildingDocs);

      const neo4jRecords = [
        { get: jest.fn().mockReturnValue('550e8400-e29b-41d4-a716-446655440011') },
        { get: jest.fn().mockReturnValue('550e8400-e29b-41d4-a716-446655440012') },
      ];
      mockNeo4jSession.run.mockResolvedValue({
        records: neo4jRecords,
      });

      const caller = graphRouter.createCaller(mockCtx);
      const response = await caller.getGraphedDocuments();

      expect(response.documentIds).toEqual(['550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440012']);
      expect(response.ungraphableDocumentIds).toEqual([]);
    });

    it('should handle case where no docs have entities', async () => {
      const completedDocs = [
        { documentId: '550e8400-e29b-41d4-a716-446655440011' },
        { documentId: '550e8400-e29b-41d4-a716-446655440012' },
      ];
      const buildingDocs: { documentId: string }[] = [];
      mockDb.$queryRaw
        .mockResolvedValueOnce(completedDocs)
        .mockResolvedValueOnce(buildingDocs);

      // Empty Neo4j result - no docs with entities
      mockNeo4jSession.run.mockResolvedValue({
        records: [],
      });

      const caller = graphRouter.createCaller(mockCtx);
      const response = await caller.getGraphedDocuments();

      expect(response.documentIds).toEqual([]);
      expect(response.ungraphableDocumentIds).toEqual(['550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440012']);
    });
  });

  describe('PostgreSQL queries', () => {
    it('should query for documents in Completed and Building status graphs', async () => {
      mockDb.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockNeo4jSession.run.mockResolvedValue({ records: [] });

      const caller = graphRouter.createCaller(mockCtx);
      await caller.getGraphedDocuments();

      // Verify the first query is for Completed status
      const completedQueryCall = mockDb.$queryRaw.mock.calls[0];
      const completedQuery = Array.isArray(completedQueryCall[0]) ? completedQueryCall[0].join('') : completedQueryCall[0];
      expect(completedQuery).toContain('SELECT DISTINCT unnest(gm."documentIds")::text as "documentId"');
      expect(completedQuery).toContain('FROM graph_metadata gm');
      expect(completedQuery).toContain('WHERE gm."userId" = ');
      expect(completedQuery).toContain('AND gm."status" IN (\'Completed\', \'Cancelling\')');

      // Verify the second query is for Building status
      const buildingQueryCall = mockDb.$queryRaw.mock.calls[1];
      const buildingQuery = Array.isArray(buildingQueryCall[0]) ? buildingQueryCall[0].join('') : buildingQueryCall[0];
      expect(buildingQuery).toContain('AND gm."status" = \'Building\'');

      expect(mockDb.$queryRaw).toHaveBeenCalledTimes(2);
    });
  });

  describe('Neo4j queries', () => {
    it('should query for documents via both chunk-mediated and direct MENTIONS paths', async () => {
      mockDb.$queryRaw
        .mockResolvedValueOnce([{ documentId: '550e8400-e29b-41d4-a716-446655440011' }])
        .mockResolvedValueOnce([]);
      mockNeo4jSession.run.mockResolvedValue({ records: [] });

      const caller = graphRouter.createCaller(mockCtx);
      await caller.getGraphedDocuments();

      const runArgs = mockNeo4jSession.run.mock.calls[0];
      const queryText = runArgs[0] as string;
      expect(queryText).toContain('(d:Document {userId: $userId})-[:CONTAINS]->(:Chunk)-[:MENTIONS]->(:Entity)');
      expect(queryText).toContain('(d:Document {userId: $userId})-[:MENTIONS]->(:Entity)');
      expect(queryText).toContain('UNION');
      expect(runArgs[1]).toEqual({ userId: mockUserId });
    });

    it('includes docs that are connected via the direct :MENTIONS edge only', async () => {
      const completedDocs = [
        { documentId: '550e8400-e29b-41d4-a716-446655440011' },
      ];
      const buildingDocs: { documentId: string }[] = [];
      mockDb.$queryRaw
        .mockResolvedValueOnce(completedDocs)
        .mockResolvedValueOnce(buildingDocs);

      // Neo4j returns the doc only via the direct MENTIONS path (UNION handles dedup)
      const neo4jRecords = [
        { get: jest.fn().mockReturnValue('550e8400-e29b-41d4-a716-446655440011') },
      ];
      mockNeo4jSession.run.mockResolvedValue({ records: neo4jRecords });

      const caller = graphRouter.createCaller(mockCtx);
      const response = await caller.getGraphedDocuments();

      expect(response.documentIds).toEqual(['550e8400-e29b-41d4-a716-446655440011']);
      expect(response.ungraphableDocumentIds).toEqual([]);
    });

    it('should handle Neo4j connection issues and fallback to PostgreSQL', async () => {
      mockDb.$queryRaw
        .mockResolvedValueOnce([{ documentId: '550e8400-e29b-41d4-a716-446655440011' }, { documentId: '550e8400-e29b-41d4-a716-446655440012' }]) // Completed docs
        .mockResolvedValueOnce([]) // Building docs
        .mockResolvedValueOnce([{ documentId: '550e8400-e29b-41d4-a716-446655440011' }]); // PostgreSQL fallback - docs with embeddings

      // Neo4j fails
      mockNeo4jSession.run.mockRejectedValue(new Error('Neo4j connection failed'));

      const caller = graphRouter.createCaller(mockCtx);
      const response = await caller.getGraphedDocuments();

      expect(response.documentIds).toEqual(['550e8400-e29b-41d4-a716-446655440011']);
      expect(response.ungraphableDocumentIds).toEqual(['550e8400-e29b-41d4-a716-446655440012']);
      expect(mockCtx.logger.warn).toHaveBeenCalledWith(
        '[GET-GRAPHED-DOCS] Neo4j query failed, falling back to PostgreSQL',
        expect.any(Error)
      );
    });
  });

  describe('PostgreSQL fallback', () => {
    it('should use graph_entity_embeddings table when Neo4j fails', async () => {
      mockDb.$queryRaw
        .mockResolvedValueOnce([{ documentId: '550e8400-e29b-41d4-a716-446655440011' }]) // Completed docs
        .mockResolvedValueOnce([]) // Building docs
        .mockResolvedValueOnce([{ documentId: '550e8400-e29b-41d4-a716-446655440011' }]); // PostgreSQL fallback

      // Neo4j fails
      mockNeo4jSession.run.mockRejectedValue(new Error('Neo4j unavailable'));

      const caller = graphRouter.createCaller(mockCtx);
      await caller.getGraphedDocuments();

      // Should call PostgreSQL fallback query (3rd call after completed and building queries)
      expect(mockDb.$queryRaw).toHaveBeenCalledTimes(3);
      const fallbackQueryCall = mockDb.$queryRaw.mock.calls[2][0];
      const fallbackQuery = Array.isArray(fallbackQueryCall) ? fallbackQueryCall.join('') : fallbackQueryCall;
      expect(fallbackQuery).toContain('SELECT DISTINCT ee."documentId"::text as "documentId"');
      expect(fallbackQuery).toContain('FROM graph_entity_embeddings ee');
      expect(fallbackQuery).toContain('JOIN "Document" d ON ee."documentId" = d.id');
      expect(fallbackQuery).toContain('WHERE d."userId" = ');
      expect(mockDb.$queryRaw).toHaveBeenNthCalledWith(3, expect.anything(), mockUserId);
    });

    it('should handle PostgreSQL fallback with different results than Neo4j would provide', async () => {
      const completedDocs = [
        { documentId: '550e8400-e29b-41d4-a716-446655440011' },
        { documentId: '550e8400-e29b-41d4-a716-446655440012' },
        { documentId: '550e8400-e29b-41d4-a716-446655440013' },
      ];

      mockDb.$queryRaw
        .mockResolvedValueOnce(completedDocs) // Completed docs
        .mockResolvedValueOnce([]) // Building docs
        .mockResolvedValueOnce([{ documentId: '550e8400-e29b-41d4-a716-446655440012' }]); // Only doc-2 has embeddings

      // Neo4j fails
      mockNeo4jSession.run.mockRejectedValue(new Error('Neo4j down'));

      const caller = graphRouter.createCaller(mockCtx);
      const response = await caller.getGraphedDocuments();

      expect(response.documentIds).toEqual(['550e8400-e29b-41d4-a716-446655440012']);
      expect(response.ungraphableDocumentIds).toEqual(['550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440013']);
    });
  });

  describe('Data filtering and processing', () => {
    it('should only include documents that are both graphed AND have entities', async () => {
      const completedDocs = [
        { documentId: '550e8400-e29b-41d4-a716-446655440011' },
        { documentId: '550e8400-e29b-41d4-a716-446655440012' },
        { documentId: '550e8400-e29b-41d4-a716-446655440013' },
        { documentId: '550e8400-e29b-41d4-a716-446655440014' },
      ];
      const buildingDocs: { documentId: string }[] = [];
      mockDb.$queryRaw
        .mockResolvedValueOnce(completedDocs)
        .mockResolvedValueOnce(buildingDocs);

      // Only some docs have entities in Neo4j
      const neo4jRecords = [
        { get: jest.fn().mockReturnValue('550e8400-e29b-41d4-a716-446655440011') },
        { get: jest.fn().mockReturnValue('550e8400-e29b-41d4-a716-446655440013') },
        { get: jest.fn().mockReturnValue('550e8400-e29b-41d4-a716-446655440015') }, // This doc has entities but isn't graphed
      ];
      mockNeo4jSession.run.mockResolvedValue({
        records: neo4jRecords,
      });

      const caller = graphRouter.createCaller(mockCtx);
      const response = await caller.getGraphedDocuments();

      // Should only include docs that are BOTH graphed AND have entities
      expect(response.documentIds).toEqual(['550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440013']);
      expect(response.ungraphableDocumentIds).toEqual(['550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440014']);
    });

    it('should handle duplicate document IDs from database queries', async () => {
      const completedDocsWithDupes = [
        { documentId: '550e8400-e29b-41d4-a716-446655440011' },
        { documentId: '550e8400-e29b-41d4-a716-446655440011' }, // Duplicate
        { documentId: '550e8400-e29b-41d4-a716-446655440012' },
      ];
      const buildingDocs: { documentId: string }[] = [];
      mockDb.$queryRaw
        .mockResolvedValueOnce(completedDocsWithDupes)
        .mockResolvedValueOnce(buildingDocs);

      const neo4jRecordsWithDupes = [
        { get: jest.fn().mockReturnValue('550e8400-e29b-41d4-a716-446655440011') },
        { get: jest.fn().mockReturnValue('550e8400-e29b-41d4-a716-446655440011') }, // Duplicate
      ];
      mockNeo4jSession.run.mockResolvedValue({
        records: neo4jRecordsWithDupes,
      });

      const caller = graphRouter.createCaller(mockCtx);
      const response = await caller.getGraphedDocuments();

      // Should deduplicate results
      expect(response.documentIds).toEqual(['550e8400-e29b-41d4-a716-446655440011']);
      expect(response.ungraphableDocumentIds).toEqual(['550e8400-e29b-41d4-a716-446655440012']);
    });
  });

  describe('Output schema validation', () => {
    it('should return arrays of valid UUID strings', async () => {
      const validUuids = [
        '550e8400-e29b-41d4-a716-446655440011',
        '550e8400-e29b-41d4-a716-446655440012',
      ];

      mockDb.$queryRaw
        .mockResolvedValueOnce(validUuids.map(id => ({ documentId: id })))
        .mockResolvedValueOnce([]);
      
      mockNeo4jSession.run.mockResolvedValue({
        records: [
          { get: jest.fn().mockReturnValue(validUuids[0]) },
        ],
      });

      const caller = graphRouter.createCaller(mockCtx);
      const response = await caller.getGraphedDocuments();

      expect(Array.isArray(response.documentIds)).toBe(true);
      expect(Array.isArray(response.ungraphableDocumentIds)).toBe(true);
      
      response.documentIds.forEach(id => {
        expect(typeof id).toBe('string');
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });
      
      response.ungraphableDocumentIds.forEach(id => {
        expect(typeof id).toBe('string');
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });
    });

    it('should validate that documentIds and ungraphableDocumentIds are mutually exclusive', async () => {
      const completedDocs = [
        { documentId: '550e8400-e29b-41d4-a716-446655440011' },
        { documentId: '550e8400-e29b-41d4-a716-446655440012' },
        { documentId: '550e8400-e29b-41d4-a716-446655440013' },
      ];
      const buildingDocs: { documentId: string }[] = [];
      mockDb.$queryRaw
        .mockResolvedValueOnce(completedDocs)
        .mockResolvedValueOnce(buildingDocs);

      const neo4jRecords = [
        { get: jest.fn().mockReturnValue('550e8400-e29b-41d4-a716-446655440011') },
        { get: jest.fn().mockReturnValue('550e8400-e29b-41d4-a716-446655440012') },
      ];
      mockNeo4jSession.run.mockResolvedValue({
        records: neo4jRecords,
      });

      const caller = graphRouter.createCaller(mockCtx);
      const response = await caller.getGraphedDocuments();

      const documentIdsSet = new Set(response.documentIds);
      const ungraphableIdsSet = new Set(response.ungraphableDocumentIds);
      
      // Ensure no overlap between the two arrays
      const intersection = [...documentIdsSet].filter(id => ungraphableIdsSet.has(id));
      expect(intersection).toHaveLength(0);
    });
  });

  describe('Error handling', () => {
    it('should propagate PostgreSQL errors', async () => {
      mockDb.$queryRaw.mockRejectedValueOnce(new Error('PostgreSQL connection failed'));

      const caller = graphRouter.createCaller(mockCtx);

      await expect(caller.getGraphedDocuments()).rejects.toThrow('PostgreSQL connection failed');
    });

    it('should handle Neo4j errors gracefully but still propagate PostgreSQL fallback errors', async () => {
      mockDb.$queryRaw
        .mockResolvedValueOnce([{ documentId: '550e8400-e29b-41d4-a716-446655440011' }]) // Completed query succeeds
        .mockResolvedValueOnce([]) // Building query succeeds
        .mockRejectedValueOnce(new Error('PostgreSQL fallback failed')); // Fallback fails

      mockNeo4jSession.run.mockRejectedValue(new Error('Neo4j failed'));

      const caller = graphRouter.createCaller(mockCtx);

      await expect(caller.getGraphedDocuments()).rejects.toThrow('PostgreSQL fallback failed');
      expect(mockCtx.logger.warn).toHaveBeenCalledWith(
        '[GET-GRAPHED-DOCS] Neo4j query failed, falling back to PostgreSQL',
        expect.any(Error)
      );
    });
  });

  describe('State management fix - ungraphableDocumentIds handling', () => {
    it('should safely handle undefined ungraphableDocumentIds when data is loading', async () => {
      // This test verifies the fix for the state management bug where
      // ungraphableDocumentIds could be undefined during loading state

      mockDb.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockNeo4jSession.run.mockResolvedValue({ records: [] });

      const caller = graphRouter.createCaller(mockCtx);
      const response = await caller.getGraphedDocuments();

      // The response should always contain arrays, never undefined
      expect(Array.isArray(response.ungraphableDocumentIds)).toBe(true);
      expect(Array.isArray(response.documentIds)).toBe(true);
      
      // Even when empty, these should be defined arrays
      expect(response.ungraphableDocumentIds).toEqual([]);
      expect(response.documentIds).toEqual([]);
    });

    it('should consistently return ungraphableDocumentIds as array even with partial data', async () => {
      // Test the case where some data exists but ungraphableDocumentIds might be empty
      const completedDocs = [{ documentId: '550e8400-e29b-41d4-a716-446655440011' }];
      const buildingDocs: { documentId: string }[] = [];
      mockDb.$queryRaw
        .mockResolvedValueOnce(completedDocs)
        .mockResolvedValueOnce(buildingDocs);
      
      // All docs have entities, so ungraphableDocumentIds should be empty but defined
      const neo4jRecords = [{ get: jest.fn().mockReturnValue('550e8400-e29b-41d4-a716-446655440011') }];
      mockNeo4jSession.run.mockResolvedValue({ records: neo4jRecords });

      const caller = graphRouter.createCaller(mockCtx);
      const response = await caller.getGraphedDocuments();

      expect(response.documentIds).toEqual(['550e8400-e29b-41d4-a716-446655440011']);
      expect(response.ungraphableDocumentIds).toEqual([]); // Should be empty array, not undefined
      expect(Array.isArray(response.ungraphableDocumentIds)).toBe(true);
    });

    it('should handle mixed state correctly for state management', async () => {
      // This specifically tests the scenario that was failing in the UI
      // where ungraphableDocumentIds would be undefined when graphedDocumentsLoading was true

      const completedDocs = [
        { documentId: '550e8400-e29b-41d4-a716-446655440011' },
        { documentId: '550e8400-e29b-41d4-a716-446655440012' },
        { documentId: '550e8400-e29b-41d4-a716-446655440013' },
      ];
      const buildingDocs: { documentId: string }[] = [];
      mockDb.$queryRaw
        .mockResolvedValueOnce(completedDocs)
        .mockResolvedValueOnce(buildingDocs);
      
      // Only some docs have entities
      const neo4jRecords = [
        { get: jest.fn().mockReturnValue('550e8400-e29b-41d4-a716-446655440011') },
        { get: jest.fn().mockReturnValue('550e8400-e29b-41d4-a716-446655440012') },
      ];
      mockNeo4jSession.run.mockResolvedValue({ records: neo4jRecords });

      const caller = graphRouter.createCaller(mockCtx);
      const response = await caller.getGraphedDocuments();

      // Both arrays should always be defined and properly typed
      expect(Array.isArray(response.documentIds)).toBe(true);
      expect(Array.isArray(response.ungraphableDocumentIds)).toBe(true);
      
      // Verify the correct distribution
      expect(response.documentIds).toEqual(['550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440012']);
      expect(response.ungraphableDocumentIds).toEqual(['550e8400-e29b-41d4-a716-446655440013']);
      
      // Ensure no overlap (this was part of the state management issue)
      const documentIdsSet = new Set(response.documentIds);
      const ungraphableIdsSet = new Set(response.ungraphableDocumentIds);
      const intersection = [...documentIdsSet].filter(id => ungraphableIdsSet.has(id));
      expect(intersection).toHaveLength(0);
    });

    it('should handle Neo4j fallback state management correctly', async () => {
      // Test state management when falling back to PostgreSQL
      const completedDocs = [
        { documentId: '550e8400-e29b-41d4-a716-446655440011' },
        { documentId: '550e8400-e29b-41d4-a716-446655440012' },
      ];

      mockDb.$queryRaw
        .mockResolvedValueOnce(completedDocs) // Completed docs
        .mockResolvedValueOnce([]) // Building docs
        .mockResolvedValueOnce([{ documentId: '550e8400-e29b-41d4-a716-446655440011' }]); // PostgreSQL fallback - only doc-1 has embeddings

      // Neo4j fails
      mockNeo4jSession.run.mockRejectedValue(new Error('Neo4j connection failed'));

      const caller = graphRouter.createCaller(mockCtx);
      const response = await caller.getGraphedDocuments();

      // Even during fallback, arrays should be properly defined
      expect(Array.isArray(response.documentIds)).toBe(true);
      expect(Array.isArray(response.ungraphableDocumentIds)).toBe(true);
      
      expect(response.documentIds).toEqual(['550e8400-e29b-41d4-a716-446655440011']);
      expect(response.ungraphableDocumentIds).toEqual(['550e8400-e29b-41d4-a716-446655440012']);
      
      // Verify warning was logged
      expect(mockCtx.logger.warn).toHaveBeenCalledWith(
        '[GET-GRAPHED-DOCS] Neo4j query failed, falling back to PostgreSQL',
        expect.any(Error)
      );
    });
  });

  describe('Shared-document copy regression coverage', () => {
    it('copied palm-graph doc shows as graphed, not ungraphable', async () => {
      const copiedDocId = '550e8400-e29b-41d4-a716-4466554400a1';
      mockDb.$queryRaw
        .mockResolvedValueOnce([{ documentId: copiedDocId }])
        .mockResolvedValueOnce([]);
      // Neo4j returns the doc via the direct Document->MENTIONS->Entity path
      // (palm-graph topology — no chunks).
      mockNeo4jSession.run.mockResolvedValue({
        records: [{ get: jest.fn().mockReturnValue(copiedDocId) }],
      });

      const caller = graphRouter.createCaller(mockCtx);
      const response = await caller.getGraphedDocuments();

      expect(response.documentIds).toEqual([copiedDocId]);
      expect(response.ungraphableDocumentIds).toEqual([]);
    });

    it('copied PDF doc shows as graphed, not ungraphable', async () => {
      const copiedDocId = '550e8400-e29b-41d4-a716-4466554400a2';
      mockDb.$queryRaw
        .mockResolvedValueOnce([{ documentId: copiedDocId }])
        .mockResolvedValueOnce([]);
      // Neo4j returns the doc via the chunk-anchored Document->CONTAINS->Chunk->MENTIONS->Entity path.
      mockNeo4jSession.run.mockResolvedValue({
        records: [{ get: jest.fn().mockReturnValue(copiedDocId) }],
      });

      const caller = graphRouter.createCaller(mockCtx);
      const response = await caller.getGraphedDocuments();

      expect(response.documentIds).toEqual([copiedDocId]);
      expect(response.ungraphableDocumentIds).toEqual([]);
    });

    it('Completed graph_metadata with truly empty Neo4j subgraph stays ungraphable', async () => {
      const docId = '550e8400-e29b-41d4-a716-4466554400a3';
      mockDb.$queryRaw
        .mockResolvedValueOnce([{ documentId: docId }])
        .mockResolvedValueOnce([]);
      // Neo4j returns no rows on either UNION branch.
      mockNeo4jSession.run.mockResolvedValue({ records: [] });

      const caller = graphRouter.createCaller(mockCtx);
      const response = await caller.getGraphedDocuments();

      expect(response.documentIds).toEqual([]);
      expect(response.ungraphableDocumentIds).toEqual([docId]);
    });
  });

  describe('Graph status filtering', () => {
    it('should include documents from both Completed and Building graphs', async () => {
      // This test verifies separate queries for Completed and Building statuses
      mockDb.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockNeo4jSession.run.mockResolvedValue({ records: [] });

      const caller = graphRouter.createCaller(mockCtx);
      await caller.getGraphedDocuments();

      // Check that first query is for Completed (and Cancelling — badge stability) status
      const completedQueryCall = mockDb.$queryRaw.mock.calls[0][0];
      const completedQuery = Array.isArray(completedQueryCall) ? completedQueryCall.join('') : completedQueryCall;
      expect(completedQuery).toContain('AND gm."status" IN (\'Completed\', \'Cancelling\')');

      // Check that second query is for Building status
      const buildingQueryCall = mockDb.$queryRaw.mock.calls[1][0];
      const buildingQuery = Array.isArray(buildingQueryCall) ? buildingQueryCall.join('') : buildingQueryCall;
      expect(buildingQuery).toContain('AND gm."status" = \'Building\'');

      expect(mockDb.$queryRaw).toHaveBeenCalledTimes(2);
    });
  });

  describe('Admin document support', () => {
    const adminUserId = '660e8400-e29b-41d4-a716-446655440001';
    const adminDocId = '770e8400-e29b-41d4-a716-446655440002';

    it('should include admin documents graphed by their owner', async () => {
      (mockDb.document.findMany as jest.Mock).mockResolvedValue([
        { id: adminDocId, userId: adminUserId },
      ]);

      // User's own completed/building graphs (empty)
      mockDb.$queryRaw
        .mockResolvedValueOnce([]) // user completed
        .mockResolvedValueOnce([]) // user building
        .mockResolvedValueOnce([{ documentId: adminDocId }]) // admin completed
        .mockResolvedValueOnce([]); // admin building

      // Neo4j: own docs (empty), then admin docs (has entities)
      mockNeo4jSession.run
        .mockResolvedValueOnce({ records: [] })
        .mockResolvedValueOnce({
          records: [{ get: jest.fn().mockReturnValue(adminDocId) }],
        });

      const caller = graphRouter.createCaller(mockCtx);
      const response = await caller.getGraphedDocuments();

      expect(response.documentIds).toContain(adminDocId);
      expect(response.ungraphableDocumentIds).not.toContain(adminDocId);
    });

    it('should mark admin document as ungraphable when graphed but has no entities', async () => {
      (mockDb.document.findMany as jest.Mock).mockResolvedValue([
        { id: adminDocId, userId: adminUserId },
      ]);

      mockDb.$queryRaw
        .mockResolvedValueOnce([]) // user completed
        .mockResolvedValueOnce([]) // user building
        .mockResolvedValueOnce([{ documentId: adminDocId }]) // admin completed
        .mockResolvedValueOnce([]); // admin building

      // Neo4j: both queries return empty (no entities)
      mockNeo4jSession.run
        .mockResolvedValueOnce({ records: [] })
        .mockResolvedValueOnce({ records: [] });

      const caller = graphRouter.createCaller(mockCtx);
      const response = await caller.getGraphedDocuments();

      expect(response.documentIds).not.toContain(adminDocId);
      expect(response.ungraphableDocumentIds).toContain(adminDocId);
    });

    it('should not include admin document when admin has not graphed it yet', async () => {
      (mockDb.document.findMany as jest.Mock).mockResolvedValue([
        { id: adminDocId, userId: adminUserId },
      ]);

      // Admin's graph metadata does not contain the document
      mockDb.$queryRaw
        .mockResolvedValueOnce([]) // user completed
        .mockResolvedValueOnce([]) // user building
        .mockResolvedValueOnce([]) // admin completed (empty)
        .mockResolvedValueOnce([]); // admin building (empty)

      mockNeo4jSession.run
        .mockResolvedValueOnce({ records: [] })
        .mockResolvedValueOnce({ records: [] });

      const caller = graphRouter.createCaller(mockCtx);
      const response = await caller.getGraphedDocuments();

      expect(response.documentIds).not.toContain(adminDocId);
      expect(response.ungraphableDocumentIds).not.toContain(adminDocId);
    });

    it('should combine own graphed docs and admin graphed docs', async () => {
      const ownDocId = '880e8400-e29b-41d4-a716-446655440003';

      (mockDb.document.findMany as jest.Mock).mockResolvedValue([
        { id: adminDocId, userId: adminUserId },
      ]);

      mockDb.$queryRaw
        .mockResolvedValueOnce([{ documentId: ownDocId }]) // user completed
        .mockResolvedValueOnce([]) // user building
        .mockResolvedValueOnce([{ documentId: adminDocId }]) // admin completed
        .mockResolvedValueOnce([]); // admin building

      mockNeo4jSession.run
        .mockResolvedValueOnce({ records: [{ get: jest.fn().mockReturnValue(ownDocId) }] })
        .mockResolvedValueOnce({ records: [{ get: jest.fn().mockReturnValue(adminDocId) }] });

      const caller = graphRouter.createCaller(mockCtx);
      const response = await caller.getGraphedDocuments();

      expect(response.documentIds).toContain(ownDocId);
      expect(response.documentIds).toContain(adminDocId);
    });

    it('should skip admin Neo4j query when no admin docs are accessible', async () => {
      // Default beforeEach already sets findMany to []
      mockDb.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockNeo4jSession.run.mockResolvedValue({ records: [] });

      const caller = graphRouter.createCaller(mockCtx);
      await caller.getGraphedDocuments();

      // Only one Neo4j call (for user's own docs)
      expect(mockNeo4jSession.run).toHaveBeenCalledTimes(1);
    });
  });
});