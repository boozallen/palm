import { aggregationQuery } from './aggregationQuery';
import { getGraphDatabaseSource } from '@/features/graph-database';
import { AIFactory } from '@/features/ai-provider/factory';

jest.mock('@/features/graph-database', () => ({
  getGraphDatabaseSource: jest.fn(),
}));

jest.mock('@/features/ai-provider/factory');

jest.mock('@/features/shared/dal/getSystemConfig', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({ knowledgeGraphAiProviderModelId: 'model-1' }),
}));

jest.mock('@/features/graph-database/dal/getGraphSchema', () => ({
  getGraphSchema: jest.fn().mockResolvedValue('Node Types:\n- Entity: {name, type}\n'),
  getScopedGraphSchema: jest.fn().mockResolvedValue('Node Types:\n- Entity: {name, type}\n'),
}));

jest.mock('@/features/shared/dal/getAccessibleDocumentIds', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(new Set(['doc-1', 'doc-2'])),
}));

jest.mock('@/server/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('aggregationQuery', () => {
  const mockUserId = 'user-123';
  const mockDocumentIds = ['doc-1', 'doc-2'];

  const mockGraphDb = {
    run: jest.fn(),
  };

  const mockChatCompletion = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue(mockGraphDb);
    (AIFactory as jest.Mock).mockImplementation(() => ({
      buildKnowledgeGraphSource: jest.fn().mockResolvedValue({
        source: { chatCompletion: mockChatCompletion },
        model: { externalId: 'test-model' },
      }),
    }));
  });

  describe('successful queries', () => {
    it('executes valid count query and returns results', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN count(DISTINCT e) as entityCount',
          suggestedFormat: 'prose',
        }),
      });

      mockGraphDb.run.mockResolvedValue({
        records: [
          {
            keys: ['entityCount'],
            get: () => ({ toNumber: () => 42 }),
          },
        ],
      });

      const result = await aggregationQuery({
        query: 'How many entities?',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toBeUndefined();
      expect(result.results).toEqual([{ entityCount: 42 }]);
      expect(result.rowCount).toBe(1);
      expect(result.queryType).toBe('aggregation');
      expect(result.suggestedFormat).toBe('prose');
    });

    it('handles multi-count queries', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds WITH count(DISTINCT e) as entityCount MATCH (c:Concept) WHERE c.userId = $userId AND c.documentId IN $documentIds RETURN entityCount, count(DISTINCT c) as conceptCount',
          suggestedFormat: 'prose',
        }),
      });

      mockGraphDb.run.mockResolvedValue({
        records: [
          {
            keys: ['entityCount', 'conceptCount'],
            get: (key: string) => ({ toNumber: () => (key === 'entityCount' ? 42 : 15) }),
          },
        ],
      });

      const result = await aggregationQuery({
        query: 'How many entities and concepts?',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toBeUndefined();
      expect(result.results).toEqual([{ entityCount: 42, conceptCount: 15 }]);
    });

    it('passes userId and documentIds to Neo4j query', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN count(e) as count',
          suggestedFormat: 'prose',
        }),
      });

      mockGraphDb.run.mockResolvedValue({
        records: [{ keys: ['count'], get: () => ({ toNumber: () => 0 }) }],
      });

      await aggregationQuery({
        query: 'Count entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(mockGraphDb.run).toHaveBeenCalledWith(
        expect.any(String),
        { documentIds: mockDocumentIds }
      );
    });

    it('converts Neo4j integers to JS numbers', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN count(e) as count',
          suggestedFormat: 'prose',
        }),
      });

      mockGraphDb.run.mockResolvedValue({
        records: [
          {
            keys: ['count'],
            get: () => ({ toNumber: () => 100 }),
          },
        ],
      });

      const result = await aggregationQuery({
        query: 'Count entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.results[0]).toEqual({ count: 100 });
    });
  });

  describe('security validation', () => {
    it('rejects queries without $documentIds filter', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.name = "x" RETURN count(e)',
          suggestedFormat: 'prose',
        }),
      });

      const result = await aggregationQuery({
        query: 'Count entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toContain('Missing $documentIds filter');
      expect(mockGraphDb.run).not.toHaveBeenCalled();
    });
  });

  describe('syntax error retry', () => {
    it('retries once on syntax error and succeeds', async () => {
      mockChatCompletion
        .mockResolvedValueOnce({
          text: JSON.stringify({
            cypher: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds WITH count(e) as c, c + 1 as c2 RETURN c2',
            suggestedFormat: 'prose',
          }),
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            cypher: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN count(e) as count',
            suggestedFormat: 'prose',
          }),
        });

      mockGraphDb.run
        .mockRejectedValueOnce(new Error('Variable `c` not defined'))
        .mockResolvedValueOnce({
          records: [{ keys: ['count'], get: () => ({ toNumber: () => 5 }) }],
        });

      const result = await aggregationQuery({
        query: 'Count entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toBeUndefined();
      expect(result.results).toEqual([{ count: 5 }]);
      expect(mockChatCompletion).toHaveBeenCalledTimes(2);
    });

    it('returns error after retry exhausted', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds WITH count(e) as c, c + 1 as c2 RETURN c2',
          suggestedFormat: 'prose',
        }),
      });

      mockGraphDb.run.mockRejectedValue(new Error('Variable `c` not defined'));

      const result = await aggregationQuery({
        query: 'Count entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toContain('not defined');
      expect(mockChatCompletion).toHaveBeenCalledTimes(2);
    });

    it('does not retry on non-syntax errors', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN count(e)',
          suggestedFormat: 'prose',
        }),
      });

      mockGraphDb.run.mockRejectedValue(new Error('Connection refused'));

      const result = await aggregationQuery({
        query: 'Count entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toBe('Connection refused');
      expect(mockChatCompletion).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('returns error when LLM call fails', async () => {
      mockChatCompletion.mockRejectedValue(new Error('LLM unavailable'));

      const result = await aggregationQuery({
        query: 'Count entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toBe('LLM unavailable');
      expect(result.results).toEqual([]);
    });

    it('returns error when knowledge graph AI provider not configured', async () => {
      const getSystemConfig = require('@/features/shared/dal/getSystemConfig').default;
      getSystemConfig.mockResolvedValueOnce({ knowledgeGraphAiProviderModelId: null });

      const result = await aggregationQuery({
        query: 'Count entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toBe('Knowledge graph AI provider not configured');
      expect(result.results).toEqual([]);
    });

    it('tracks execution time even on error', async () => {
      mockChatCompletion.mockRejectedValue(new Error('LLM unavailable'));

      const result = await aggregationQuery({
        query: 'Count entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('result format', () => {
    it('always returns queryType aggregation and suggestedFormat prose', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN count(e)',
          suggestedFormat: 'table', // Even if LLM returns table
        }),
      });

      mockGraphDb.run.mockResolvedValue({
        records: [{ keys: ['count'], get: () => ({ toNumber: () => 0 }) }],
      });

      const result = await aggregationQuery({
        query: 'Count entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.queryType).toBe('aggregation');
      expect(result.suggestedFormat).toBe('prose');
    });
  });

  it('attributes usage to the caller\'s selected user group', async () => {
    mockChatCompletion.mockResolvedValue({
      text: JSON.stringify({ cypher: 'MATCH (e:Entity) RETURN count(e)', suggestedFormat: 'prose' }),
    });
    mockGraphDb.run.mockResolvedValue({ records: [] });

    await aggregationQuery({
      query: 'Count entities',
      documentIds: mockDocumentIds,
      userId: mockUserId,
      userGroupId: 'group-9',
    });

    expect(AIFactory).toHaveBeenCalledWith({ userId: mockUserId, userGroupId: 'group-9' });
  });
});
