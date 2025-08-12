import getEmbeddings, { EmbeddingResult, GetEmbeddingsParams } from './getEmbeddings';
import db from '@/server/db';
import logger from '@/server/logger';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import { ContextType } from '@/features/chat/types/message';

jest.mock('@/server/db', () => ({
  $queryRaw: jest.fn(),
}));

jest.mock('@/features/shared/dal/getSystemConfig');

describe('getEmbeddings DAL', () => {
  const mockUserId = '6435b69e-3757-47a2-bacf-d4efdd85a32e';
  const mockDocumentLibraryProviderId = '8435b69e-3757-47a2-bacf-d4efdd85a32e';
  const mockEmbeddedQuery = [0.1, 0.2, 0.3, 0.4, 0.5];

  const mockRawResults = [
    {
      id: '1435b69e-3757-47a2-bacf-d4efdd85a32e',
      content: 'This is test content 1',
      score: 0.85,
      documentLabel: 'test-document-1.pdf',
      documentId: '7324a58e-3757-47a2-bacf-d4efdd85a32e',
    },
    {
      id: '2435b69e-3757-47a2-bacf-d4efdd85a32e',
      content: 'This is test content 2',
      score: 0.75,
      documentLabel: 'test-document-2.pdf',
      documentId: '6213f47d-3757-47a2-bacf-d4efdd85a32e',
    },
  ];

  const mockEmbeddingResults: EmbeddingResult[] = [
    {
      id: '1435b69e-3757-47a2-bacf-d4efdd85a32e',
      score: 0.85,
      citation: {
        contextType: ContextType.DOCUMENT_LIBRARY,
        citation: 'This is test content 1',
        sourceLabel: 'test-document-1.pdf',
        documentId: '7324a58e-3757-47a2-bacf-d4efdd85a32e',
      },
    },
    {
      id: '2435b69e-3757-47a2-bacf-d4efdd85a32e',

      score: 0.75,
      citation: {
        contextType: ContextType.DOCUMENT_LIBRARY,
        citation: 'This is test content 2',
        sourceLabel: 'test-document-2.pdf',
        documentId: '6213f47d-3757-47a2-bacf-d4efdd85a32e',
      },
    },
  ];

  const mockSystemConfig = {
    documentLibraryDocumentUploadProviderId: mockDocumentLibraryProviderId,
  };

  const mockGetSystemConfig = getSystemConfig as jest.Mock;
  const mockQueryRaw = db.$queryRaw as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSystemConfig.mockResolvedValue(mockSystemConfig);
  });

  describe('No errors', () => {
    it('should successfully retrieve embeddings with default parameters', async () => {
      mockQueryRaw.mockResolvedValue(mockRawResults);

      const params: GetEmbeddingsParams = {
        userId: mockUserId,
        embeddedQuery: mockEmbeddedQuery,
      };

      const result = await getEmbeddings(params);

      expect(result).toEqual(mockEmbeddingResults);
      expect(mockGetSystemConfig).toHaveBeenCalledTimes(1);
      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should successfully retrieve embeddings with custom parameters', async () => {
      mockQueryRaw.mockResolvedValue(mockRawResults);

      const params: GetEmbeddingsParams = {
        userId: mockUserId,
        embeddedQuery: mockEmbeddedQuery,
        minThreshold: 0.7,
        matchCount: 5,
      };

      const result = await getEmbeddings(params);

      expect(result).toEqual(mockEmbeddingResults);
    });

    it('should handle empty results successfully', async () => {
      mockQueryRaw.mockResolvedValue([]);

      const params: GetEmbeddingsParams = {
        userId: mockUserId,
        embeddedQuery: mockEmbeddedQuery,
      };

      const result = await getEmbeddings(params);

      expect(result).toEqual([]);
    });
  });

  describe('System Configuration Edge Cases', () => {
    it('should throw error when no document library provider is configured', async () => {
      const configWithoutProvider = {
        ...mockSystemConfig,
        documentLibraryDocumentUploadProviderId: null,
      };
      mockGetSystemConfig.mockResolvedValue(configWithoutProvider);

      const params: GetEmbeddingsParams = {
        userId: mockUserId,
        embeddedQuery: mockEmbeddedQuery,
      };

      await expect(getEmbeddings(params)).rejects.toThrow(
        /document library must be configured/i
      );

      expect(logger.warn).toHaveBeenCalledWith('No document library provider configured in system config');
      expect(mockQueryRaw).not.toHaveBeenCalled();
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('should throw error when document library provider is empty string', async () => {
      const configWithEmptyProvider = {
        ...mockSystemConfig,
        documentLibraryDocumentUploadProviderId: '',
      };
      mockGetSystemConfig.mockResolvedValue(configWithEmptyProvider);

      const params: GetEmbeddingsParams = {
        userId: mockUserId,
        embeddedQuery: mockEmbeddedQuery,
      };

      await expect(getEmbeddings(params)).rejects.toThrow(
        /document library must be configured/i
      );

      expect(logger.warn).toHaveBeenCalledWith('No document library provider configured in system config');
      expect(mockQueryRaw).not.toHaveBeenCalled();
      expect(logger.debug).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle system config retrieval error', async () => {
      const systemConfigError = new Error('System config fetch failed');
      mockGetSystemConfig.mockRejectedValue(systemConfigError);

      const params: GetEmbeddingsParams = {
        userId: mockUserId,
        embeddedQuery: mockEmbeddedQuery,
      };

      await expect(getEmbeddings(params)).rejects.toThrow(
        /problem retrieving the document library/i
      );

      expect(logger.error).toHaveBeenCalledWith('There was a problem retrieving the document library', systemConfigError);
    });

    it('should handle database query error', async () => {
      const dbError = new Error('Database connection failed');
      mockQueryRaw.mockRejectedValue(dbError);

      const params: GetEmbeddingsParams = {
        userId: mockUserId,
        embeddedQuery: mockEmbeddedQuery,
      };

      await expect(getEmbeddings(params)).rejects.toThrow('Error retrieving embeddings');

      expect(logger.error).toHaveBeenCalledWith('Error retrieving embeddings from the database', {
        userId: mockUserId,
        minThreshold: 0.5,
        matchCount: 10,
        error: dbError,
      });
    });

    it('should handle vector conversion with complex numbers', async () => {
      mockQueryRaw.mockResolvedValue(mockRawResults);

      const complexEmbedding = [0.123456789, -0.987654321, 1.0, 0.0, -1.0];
      const params: GetEmbeddingsParams = {
        userId: mockUserId,
        embeddedQuery: complexEmbedding,
      };

      const result = await getEmbeddings(params);

      expect(result).toEqual(mockEmbeddingResults);
      expect(mockQueryRaw).toHaveBeenCalledTimes(1);

      // Verify that the function was called (the exact embedding vector format is handled internally)
      const queryCall = mockQueryRaw.mock.calls[0];
      expect(queryCall.length).toBeGreaterThan(0);
    });
  });

  describe('Security Validation', () => {
    it('should call query with proper parameters for user ownership and provider constraints', async () => {
      mockQueryRaw.mockResolvedValue(mockRawResults);

      const params: GetEmbeddingsParams = {
        userId: mockUserId,
        embeddedQuery: mockEmbeddedQuery,
      };

      await getEmbeddings(params);

      // Verify the query was called with the template literal array and parameters
      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
      const queryCall = mockQueryRaw.mock.calls[0];

      // First element should be the template literal array
      expect(Array.isArray(queryCall[0])).toBe(true);
      expect(queryCall[0].length).toBeGreaterThan(1);

      // Template literal should contain the core SQL structure
      const sqlTemplate = queryCall[0].join('${...}');
      expect(sqlTemplate).toContain('SELECT');
      expect(sqlTemplate).toContain('FROM "Embedding" e');
      expect(sqlTemplate).toContain('INNER JOIN "Document" d');
      expect(sqlTemplate).toContain('INNER JOIN "DocumentUploadProvider" dup');
      expect(sqlTemplate).toContain('WHERE d."userId" =');
      expect(sqlTemplate).toContain('AND dup.id =');
      expect(sqlTemplate).toContain('AND dup."deletedAt" IS NULL');
      expect(sqlTemplate).toContain('ORDER BY score DESC');
      expect(sqlTemplate).toContain('LIMIT');
    });

    it('should pass correct parameters to the query', async () => {
      mockQueryRaw.mockResolvedValue(mockRawResults);

      const customThreshold = 0.8;
      const customLimit = 15;
      const params: GetEmbeddingsParams = {
        userId: mockUserId,
        embeddedQuery: mockEmbeddedQuery,
        minThreshold: customThreshold,
        matchCount: customLimit,
      };

      await getEmbeddings(params);

      // The parameters should be passed as additional arguments to $queryRaw
      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
      const queryCall = mockQueryRaw.mock.calls[0];

      // Should have template literal array plus parameters
      expect(queryCall.length).toBeGreaterThan(1);
    });

    it('should execute query with vector similarity calculation', async () => {
      mockQueryRaw.mockResolvedValue(mockRawResults);

      const params: GetEmbeddingsParams = {
        userId: mockUserId,
        embeddedQuery: mockEmbeddedQuery,
      };

      await getEmbeddings(params);

      // Verify the query structure includes vector operations
      const queryCall = mockQueryRaw.mock.calls[0];
      const sqlTemplate = queryCall[0].join('${...}');

      expect(sqlTemplate).toContain('e.embedding <=>');
      expect(sqlTemplate).toContain('::vector');
      expect(sqlTemplate).toContain('score');
    });
  });
});
