jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import getEntitiesForQuery, {
  EntitySearchResult,
  GetEntitiesForQueryParams,
} from './getEntitiesForQuery';
import db from '@/server/db';
import logger from '@/server/logger';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

const mockQueryRaw = (db as any).$queryRaw as jest.Mock;

describe('getEntitiesForQuery DAL', () => {
  const mockEmbeddedQuery = [0.1, 0.2, 0.3, 0.4, 0.5];
  const mockDocumentIds = [
    '7324a58e-3757-47a2-bacf-d4efdd85a32e',
    '6213f47d-3757-47a2-bacf-d4efdd85a32e',
  ];
  const mockAccessibleDocIds = new Set(mockDocumentIds) as unknown as AccessibleDocIds;

  const mockEntityResults: EntitySearchResult[] = [
    {
      id: '1435b69e-3757-47a2-bacf-d4efdd85a32e',
      entityName: 'John Smith',
      description: 'A software engineer',
      aliases: ['Johnny', 'J. Smith'],
      documentId: '7324a58e-3757-47a2-bacf-d4efdd85a32e',
      score: 0.85,
    },
    {
      id: '2435b69e-3757-47a2-bacf-d4efdd85a32e',
      entityName: 'Acme Corp',
      description: 'A technology company',
      aliases: ['Acme', 'Acme Corporation'],
      documentId: '6213f47d-3757-47a2-bacf-d4efdd85a32e',
      score: 0.72,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful queries', () => {
    it('should return entities above threshold', async () => {
      mockQueryRaw.mockResolvedValue(mockEntityResults);

      const params: GetEntitiesForQueryParams = {
        embeddedQuery: mockEmbeddedQuery,
        documentIds: mockDocumentIds,
        accessibleDocIds: mockAccessibleDocIds,
      };

      const result = await getEntitiesForQuery(params);

      expect(result).toEqual(mockEntityResults);
      expect(logger.info).toHaveBeenCalledWith(
        `[GRAPH-RAG] Searching entities for query across ${mockDocumentIds.length} documents`
      );
      expect(logger.info).toHaveBeenCalledWith(
        `[GRAPH-RAG] Found ${mockEntityResults.length} relevant entities`
      );
    });

    it('should return empty array when no document IDs provided', async () => {
      const params: GetEntitiesForQueryParams = {
        embeddedQuery: mockEmbeddedQuery,
        documentIds: [],
        accessibleDocIds: mockAccessibleDocIds,
      };

      const result = await getEntitiesForQuery(params);

      expect(result).toEqual([]);
      expect(logger.info).toHaveBeenCalledWith(
        '[GRAPH-RAG] No document IDs provided for entity search, returning empty results'
      );
      expect(mockQueryRaw).not.toHaveBeenCalled();
    });

    it('should handle empty results gracefully', async () => {
      mockQueryRaw.mockResolvedValue([]);

      const params: GetEntitiesForQueryParams = {
        embeddedQuery: mockEmbeddedQuery,
        documentIds: mockDocumentIds,
        accessibleDocIds: mockAccessibleDocIds,
      };

      const result = await getEntitiesForQuery(params);

      expect(result).toEqual([]);
      expect(logger.info).toHaveBeenCalledWith('[GRAPH-RAG] Found 0 relevant entities');
    });

    it('should use custom threshold and matchCount', async () => {
      mockQueryRaw.mockResolvedValue(mockEntityResults);

      const params: GetEntitiesForQueryParams = {
        embeddedQuery: mockEmbeddedQuery,
        documentIds: mockDocumentIds,
        accessibleDocIds: mockAccessibleDocIds,
        minThreshold: 0.5,
        matchCount: 5,
      };

      const result = await getEntitiesForQuery(params);

      expect(result).toEqual(mockEntityResults);
      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error handling', () => {
    it('should return empty array on database error', async () => {
      const dbError = new Error('Database connection failed');
      mockQueryRaw.mockRejectedValue(dbError);

      const params: GetEntitiesForQueryParams = {
        embeddedQuery: mockEmbeddedQuery,
        documentIds: mockDocumentIds,
        accessibleDocIds: mockAccessibleDocIds,
      };

      const result = await getEntitiesForQuery(params);

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith('[GRAPH-RAG] Entity search failed:', dbError);
    });
  });

  describe('SQL query validation', () => {
    it('should execute query with correct structure', async () => {
      mockQueryRaw.mockResolvedValue(mockEntityResults);

      const params: GetEntitiesForQueryParams = {
        embeddedQuery: mockEmbeddedQuery,
        documentIds: mockDocumentIds,
        accessibleDocIds: mockAccessibleDocIds,
      };

      await getEntitiesForQuery(params);

      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
      const queryCall = mockQueryRaw.mock.calls[0];

      expect(Array.isArray(queryCall[0])).toBe(true);
      const sqlTemplate = queryCall[0].join('${...}');

      // Check query structure
      expect(sqlTemplate).toContain('SELECT');
      expect(sqlTemplate).toContain('FROM graph_entity_embeddings e');
      expect(sqlTemplate).toContain('WHERE e."documentId" = ANY(');
      expect(sqlTemplate).toContain('AND e."documentId" = ANY(');
      expect(sqlTemplate).not.toContain('"userId"');
      expect(sqlTemplate).toContain('::vector');
      expect(sqlTemplate).toContain('LIMIT');
    });
  });
});
