import { enumerationQuery } from './enumerationQuery';
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

describe('enumerationQuery', () => {
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
    it('executes valid enumeration query and returns results', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN DISTINCT e.id AS _nodeId, e.name as name, e.type as type',
          suggestedFormat: 'table',
        }),
      });

      mockGraphDb.run.mockResolvedValue({
        records: [
          {
            keys: ['_nodeId', 'name', 'type'],
            get: (key: string) => {
              if (key === '_nodeId') {return 'entity-1';}
              if (key === 'name') {return 'TestEntity';}
              return 'Person';
            },
          },
        ],
      });

      const result = await enumerationQuery({
        query: 'List all entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toBeUndefined();
      expect(result.results).toEqual([{ _nodeId: 'entity-1', name: 'TestEntity', type: 'Person' }]);
      expect(result.rowCount).toBe(1);
      expect(result.queryType).toBe('enumeration');
      expect(result.suggestedFormat).toBe('table');
    });

    it('passes documentIds to Neo4j query', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.documentId IN $documentIds RETURN e.id AS _nodeId, e.name',
          suggestedFormat: 'table',
        }),
      });

      mockGraphDb.run.mockResolvedValue({
        records: [
          {
            keys: ['_nodeId', 'name'],
            get: (key: string) => (key === '_nodeId' ? 'entity-1' : 'TestEntity'),
          },
        ],
      });

      await enumerationQuery({
        query: 'List entities',
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
          cypher: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN e.id AS _nodeId, e.name as name, count(e) as count',
          suggestedFormat: 'table',
        }),
      });

      mockGraphDb.run.mockResolvedValue({
        records: [
          {
            keys: ['_nodeId', 'name', 'count'],
            get: (key: string) => {
              if (key === '_nodeId') {return 'entity-1';}
              if (key === 'name') {return 'TestEntity';}
              if (key === 'count') {return { toNumber: () => 5 };}
              return null;
            },
          },
        ],
      });

      const result = await enumerationQuery({
        query: 'List entities with count',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.results[0]).toEqual({ _nodeId: 'entity-1', name: 'TestEntity', count: 5 });
    });
  });

  describe('security validation', () => {

    it('rejects queries without $documentIds filter', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.userId = $userId RETURN e',
          suggestedFormat: 'table',
        }),
      });

      const result = await enumerationQuery({
        query: 'List entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toContain('Missing $documentIds filter');
      expect(mockGraphDb.run).not.toHaveBeenCalled();
    });

    it('rejects write operations', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'CREATE (e:Entity) SET e.userId = $userId, e.documentId IN $documentIds',
          suggestedFormat: 'table',
        }),
      });

      const result = await enumerationQuery({
        query: 'Create entity',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toContain('Write operation detected');
    });
  });

  describe('syntax error retry', () => {
    it('retries on syntax error and succeeds', async () => {
      mockChatCompletion
        .mockResolvedValueOnce({
          text: JSON.stringify({
            cypher: 'MATCH (d:Document) WHERE d.userId = $userId AND d.id IN $documentIds WITH d.filename as doc, collect(DISTINCT doc) as docs, collect(DISTINCT d.id) as _nodeIds RETURN _nodeIds, docs',
            suggestedFormat: 'table',
          }),
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            cypher: 'MATCH (d:Document) WHERE d.userId = $userId AND d.id IN $documentIds WITH collect(DISTINCT d.filename) as docs, collect(DISTINCT d.id) as _nodeIds RETURN _nodeIds, docs',
            suggestedFormat: 'table',
          }),
        });

      mockGraphDb.run
        .mockRejectedValueOnce(new Error('Variable `doc` not defined (line 1, column 85)'))
        .mockResolvedValueOnce({
          records: [
            {
              keys: ['_nodeIds', 'docs'],
              get: (key: string) => (key === '_nodeIds' ? ['d-1', 'd-2'] : ['doc1.pdf', 'doc2.pdf']),
            },
          ],
        });

      const result = await enumerationQuery({
        query: 'List documents',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toBeUndefined();
      expect(result.results).toEqual([{ _nodeIds: ['d-1', 'd-2'], docs: ['doc1.pdf', 'doc2.pdf'] }]);
    });

    it('returns error after retries exhausted', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (d:Document) WHERE d.userId = $userId AND d.id IN $documentIds WITH d.filename as doc, collect(DISTINCT doc) as docs, collect(DISTINCT d.id) as _nodeIds RETURN _nodeIds, docs',
          suggestedFormat: 'table',
        }),
      });

      mockGraphDb.run.mockRejectedValue(new Error('Variable `doc` not defined (line 1, column 85)'));

      const result = await enumerationQuery({
        query: 'List documents',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toContain('not defined');
      expect(result.results).toEqual([]);
    });

    it('does not retry on non-syntax errors', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN e.id AS _nodeId, e.name',
          suggestedFormat: 'table',
        }),
      });

      mockGraphDb.run.mockRejectedValue(new Error('Connection refused'));

      const result = await enumerationQuery({
        query: 'List entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toBe('Connection refused');
    });
  });

  describe('_nodeId validation', () => {
    it('retries when first cypher is missing _nodeId and succeeds on retry', async () => {
      mockChatCompletion
        .mockResolvedValueOnce({
          text: JSON.stringify({
            cypher: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN e.name as name, e.type as type',
            suggestedFormat: 'table',
          }),
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            cypher: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN e.id AS _nodeId, e.name as name, e.type as type',
            suggestedFormat: 'table',
          }),
        });

      mockGraphDb.run.mockResolvedValue({
        records: [
          {
            keys: ['_nodeId', 'name', 'type'],
            get: (key: string) => {
              if (key === '_nodeId') {return 'entity-1';}
              if (key === 'name') {return 'TestEntity';}
              return 'Person';
            },
          },
        ],
      });

      const result = await enumerationQuery({
        query: 'List all entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toBeUndefined();
      expect(result.results).toEqual([{ _nodeId: 'entity-1', name: 'TestEntity', type: 'Person' }]);
      expect(mockChatCompletion).toHaveBeenCalledTimes(2);
      expect(mockGraphDb.run).toHaveBeenCalledTimes(1);
    });

    it('proceeds without graph linking after MAX_RETRIES of missing _nodeId', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN e.name as name',
          suggestedFormat: 'table',
        }),
      });

      mockGraphDb.run.mockResolvedValue({
        records: [
          {
            keys: ['name'],
            get: (key: string) => (key === 'name' ? 'TestEntity' : null),
          },
        ],
      });

      const result = await enumerationQuery({
        query: 'List all entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toBeUndefined();
      expect(result.results).toEqual([{ name: 'TestEntity' }]);
      expect(mockChatCompletion).toHaveBeenCalledTimes(3);
      expect(mockGraphDb.run).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('returns error when LLM call fails', async () => {
      mockChatCompletion.mockRejectedValue(new Error('LLM unavailable'));

      const result = await enumerationQuery({
        query: 'List entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toBe('LLM unavailable');
      expect(result.results).toEqual([]);
    });

    it('returns error when knowledge graph AI provider not configured', async () => {
      const getSystemConfig = require('@/features/shared/dal/getSystemConfig').default;
      getSystemConfig.mockResolvedValueOnce({ knowledgeGraphAiProviderModelId: null });

      const result = await enumerationQuery({
        query: 'List entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toBe('Knowledge graph AI provider not configured');
      expect(result.results).toEqual([]);
    });

    it('tracks execution time even on error', async () => {
      mockChatCompletion.mockRejectedValue(new Error('LLM unavailable'));

      const result = await enumerationQuery({
        query: 'List entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('result format', () => {
    it('always returns queryType enumeration and suggestedFormat table', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN e.id AS _nodeId, e.name',
          suggestedFormat: 'prose', // Even if LLM returns prose
        }),
      });

      mockGraphDb.run.mockResolvedValue({
        records: [
          {
            keys: ['_nodeId', 'name'],
            get: (key: string) => (key === '_nodeId' ? 'entity-1' : 'TestEntity'),
          },
        ],
      });

      const result = await enumerationQuery({
        query: 'List entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.queryType).toBe('enumeration');
      expect(result.suggestedFormat).toBe('table');
    });
  });

  it('attributes usage to the caller\'s selected user group', async () => {
    mockChatCompletion.mockResolvedValue({
      text: JSON.stringify({ cypher: 'MATCH (e:Entity) RETURN e.id AS _nodeId', suggestedFormat: 'table' }),
    });
    mockGraphDb.run.mockResolvedValue({ records: [] });

    await enumerationQuery({
      query: 'List entities',
      documentIds: mockDocumentIds,
      userId: mockUserId,
      userGroupId: 'group-9',
    });

    expect(AIFactory).toHaveBeenCalledWith({ userId: mockUserId, userGroupId: 'group-9' });
  });
});
