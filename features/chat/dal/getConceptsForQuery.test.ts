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

import getConceptsForQuery, {
  ConceptSearchResult,
  GetConceptsForQueryParams,
} from './getConceptsForQuery';
import db from '@/server/db';
import logger from '@/server/logger';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

const mockQueryRaw = (db as any).$queryRaw as jest.Mock;

describe('getConceptsForQuery DAL', () => {
  const mockEmbeddedQuery = [0.1, 0.2, 0.3, 0.4, 0.5];
  const mockDocumentIds = [
    '7324a58e-3757-47a2-bacf-d4efdd85a32e',
    '6213f47d-3757-47a2-bacf-d4efdd85a32e',
  ];
  const mockAccessibleDocIds = new Set(mockDocumentIds) as unknown as AccessibleDocIds;

  const mockConceptResults: ConceptSearchResult[] = [
    {
      id: '1435b69e-3757-47a2-bacf-d4efdd85a32e',
      conceptName: 'Machine Learning',
      description: 'A branch of artificial intelligence',
      category: 'Technology',
      documentId: '7324a58e-3757-47a2-bacf-d4efdd85a32e',
      score: 0.88,
    },
    {
      id: '2435b69e-3757-47a2-bacf-d4efdd85a32e',
      conceptName: 'Data Privacy',
      description: 'Protection of personal information',
      category: 'Security',
      documentId: '6213f47d-3757-47a2-bacf-d4efdd85a32e',
      score: 0.75,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful queries', () => {
    it('should return concepts above threshold', async () => {
      mockQueryRaw.mockResolvedValue(mockConceptResults);

      const params: GetConceptsForQueryParams = {
        embeddedQuery: mockEmbeddedQuery,
        documentIds: mockDocumentIds,
        accessibleDocIds: mockAccessibleDocIds,
      };

      const result = await getConceptsForQuery(params);

      expect(result).toEqual(mockConceptResults);
      expect(logger.info).toHaveBeenCalledWith(
        `[GRAPH-RAG] Searching concepts for query across ${mockDocumentIds.length} documents`
      );
      expect(logger.info).toHaveBeenCalledWith(
        `[GRAPH-RAG] Found ${mockConceptResults.length} relevant concepts`
      );
    });

    it('should return empty array when no document IDs provided', async () => {
      const params: GetConceptsForQueryParams = {
        embeddedQuery: mockEmbeddedQuery,
        documentIds: [],
        accessibleDocIds: mockAccessibleDocIds,
      };

      const result = await getConceptsForQuery(params);

      expect(result).toEqual([]);
      expect(logger.info).toHaveBeenCalledWith(
        '[GRAPH-RAG] No document IDs provided for concept search, returning empty results'
      );
      expect(mockQueryRaw).not.toHaveBeenCalled();
    });

    it('should handle empty results gracefully', async () => {
      mockQueryRaw.mockResolvedValue([]);

      const params: GetConceptsForQueryParams = {
        embeddedQuery: mockEmbeddedQuery,
        documentIds: mockDocumentIds,
        accessibleDocIds: mockAccessibleDocIds,
      };

      const result = await getConceptsForQuery(params);

      expect(result).toEqual([]);
      expect(logger.info).toHaveBeenCalledWith('[GRAPH-RAG] Found 0 relevant concepts');
    });

    it('should use custom threshold and matchCount', async () => {
      mockQueryRaw.mockResolvedValue(mockConceptResults);

      const params: GetConceptsForQueryParams = {
        embeddedQuery: mockEmbeddedQuery,
        documentIds: mockDocumentIds,
        accessibleDocIds: mockAccessibleDocIds,
        minThreshold: 0.5,
        matchCount: 5,
      };

      const result = await getConceptsForQuery(params);

      expect(result).toEqual(mockConceptResults);
      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error handling', () => {
    it('should return empty array on database error', async () => {
      const dbError = new Error('Database connection failed');
      mockQueryRaw.mockRejectedValue(dbError);

      const params: GetConceptsForQueryParams = {
        embeddedQuery: mockEmbeddedQuery,
        documentIds: mockDocumentIds,
        accessibleDocIds: mockAccessibleDocIds,
      };

      const result = await getConceptsForQuery(params);

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith('[GRAPH-RAG] Concept search failed:', dbError);
    });
  });

  describe('SQL query validation', () => {
    it('should execute query with correct structure', async () => {
      mockQueryRaw.mockResolvedValue(mockConceptResults);

      const params: GetConceptsForQueryParams = {
        embeddedQuery: mockEmbeddedQuery,
        documentIds: mockDocumentIds,
        accessibleDocIds: mockAccessibleDocIds,
      };

      await getConceptsForQuery(params);

      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
      const queryCall = mockQueryRaw.mock.calls[0];

      expect(Array.isArray(queryCall[0])).toBe(true);
      const sqlTemplate = queryCall[0].join('${...}');

      // Check query structure
      expect(sqlTemplate).toContain('SELECT');
      expect(sqlTemplate).toContain('FROM graph_concept_embeddings c');
      expect(sqlTemplate).toContain('WHERE c."documentId" = ANY(');
      expect(sqlTemplate).toContain('AND c."documentId" = ANY(');
      expect(sqlTemplate).not.toContain('"userId"');
      expect(sqlTemplate).toContain('::vector');
      expect(sqlTemplate).toContain('LIMIT');
    });
  });
});
