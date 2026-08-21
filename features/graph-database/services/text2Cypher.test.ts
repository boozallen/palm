// PATTERN: Follow graphQueries.test.ts mocking approach

import { text2CypherSearch } from './text2Cypher';
import { getGraphDatabaseSource } from '@/features/graph-database';
import { AIFactory } from '@/features/ai-provider/factory';

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

describe('text2CypherSearch', () => {
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

  describe('security validation', () => {
    it('rejects queries without $documentIds filter', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.name = "foo" RETURN e',
          queryType: 'enumeration',
          suggestedFormat: 'table',
        }),
      });

      const result = await text2CypherSearch({
        query: 'list entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toContain('Missing $documentIds filter');
      expect(mockGraphDb.run).not.toHaveBeenCalled();
    });

    it('rejects CREATE operations', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'CREATE (e:Entity) SET e.userId = $userId, e.documentId IN $documentIds',
          queryType: 'enumeration',
          suggestedFormat: 'table',
        }),
      });

      const result = await text2CypherSearch({
        query: 'create entity',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toContain('Write operation detected');
    });

    it('rejects MERGE operations', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MERGE (e:Entity {userId: $userId}) WHERE e.documentId IN $documentIds',
          queryType: 'enumeration',
          suggestedFormat: 'table',
        }),
      });

      const result = await text2CypherSearch({
        query: 'merge entity',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toContain('Write operation detected');
    });

    it('rejects SET operations', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds SET e.name = "hacked"',
          queryType: 'enumeration',
          suggestedFormat: 'table',
        }),
      });

      const result = await text2CypherSearch({
        query: 'update entity',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toContain('Write operation detected');
    });

    it('rejects DELETE operations', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds DELETE e',
          queryType: 'enumeration',
          suggestedFormat: 'table',
        }),
      });

      const result = await text2CypherSearch({
        query: 'delete entity',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toContain('Write operation detected');
    });

    it('rejects a conversation label even when $documentIds is present', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (d:Document) WHERE d.id IN $documentIds MATCH (m:Message)-[:REFERENCED]->(e:Entity) RETURN m',
          queryType: 'enumeration',
          suggestedFormat: 'table',
        }),
      });

      const result = await text2CypherSearch({
        query: 'list messages',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toContain('message');
      expect(mockGraphDb.run).not.toHaveBeenCalled();
    });

    it('does not reject an entity named message in a string literal', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.documentId IN $documentIds AND e.name = \'message\' RETURN e.name',
          queryType: 'enumeration',
          suggestedFormat: 'table',
        }),
      });
      mockGraphDb.run.mockResolvedValue({ records: [] });

      const result = await text2CypherSearch({
        query: 'find the message entity',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toBeUndefined();
      expect(mockGraphDb.run).toHaveBeenCalled();
    });

    it('allows an entity named message when the query also returns type()', async () => {
      const cypher = 'MATCH (e:Entity)-[r]-(o) WHERE e.documentId IN $documentIds AND e.name = \'message\' RETURN type(r)';
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher,
          queryType: 'enumeration',
          suggestedFormat: 'table',
        }),
      });
      mockGraphDb.run.mockResolvedValue({ records: [] });

      const result = await text2CypherSearch({
        query: 'find connections for the message entity',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toBeUndefined();
      expect(mockGraphDb.run).toHaveBeenCalledWith(cypher, {
        documentIds: mockDocumentIds,
      });
    });

    it('rejects a forbidden label named through labels()', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (d:Document) WHERE d.id IN $documentIds MATCH (m) WHERE \'Message\' IN labels(m) RETURN m',
          queryType: 'enumeration',
          suggestedFormat: 'table',
        }),
      });

      const result = await text2CypherSearch({
        query: 'list messages',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toContain('message');
      expect(mockGraphDb.run).not.toHaveBeenCalled();
    });

    it('rejects a forbidden relationship type named through type()', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity)-[r]-(o) WHERE e.documentId IN $documentIds AND type(r) = \'REFERENCED\' RETURN e',
          queryType: 'enumeration',
          suggestedFormat: 'table',
        }),
      });

      const result = await text2CypherSearch({
        query: 'find referenced entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toContain('referenced');
      expect(mockGraphDb.run).not.toHaveBeenCalled();
    });

    it('rejects a variable-length relationship pattern without the denylist guard', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH path = shortestPath((e1:Entity)-[*..8]-(e2:Entity)) WHERE e1.documentId IN $documentIds AND e2.documentId IN $documentIds RETURN path',
          queryType: 'explanation',
          suggestedFormat: 'prose',
        }),
      });

      const result = await text2CypherSearch({
        query: 'how is A related to B?',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toContain('must exclude forbidden relationship types');
      expect(mockGraphDb.run).not.toHaveBeenCalled();
    });

    it('allows a variable-length relationship pattern with the denylist guard', async () => {
      const cypher = 'MATCH path = shortestPath((e1:Entity)-[*..8]-(e2:Entity)) WHERE none(r IN relationships(path) WHERE type(r) IN [\'REFERENCED\', \'IN_CHAT\', \'PRODUCED\']) AND e1.documentId IN $documentIds AND e2.documentId IN $documentIds RETURN path';
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher,
          queryType: 'explanation',
          suggestedFormat: 'prose',
        }),
      });
      mockGraphDb.run.mockResolvedValue({ records: [] });

      const result = await text2CypherSearch({
        query: 'how is A related to B?',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toBeUndefined();
      expect(mockGraphDb.run).toHaveBeenCalledWith(cypher, {
        documentIds: mockDocumentIds,
      });
    });

    it('rejects a whitespace-separated variable-length pattern without the denylist guard', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH path = (a:Entity)- [*1..2] -(b:Entity) WHERE a.documentId IN $documentIds AND b.documentId IN $documentIds RETURN path',
          queryType: 'explanation',
          suggestedFormat: 'prose',
        }),
      });

      const result = await text2CypherSearch({
        query: 'find a path',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toContain('must exclude forbidden relationship types');
      expect(mockGraphDb.run).not.toHaveBeenCalled();
    });

    it('allows a whitespace-separated variable-length pattern with the denylist guard', async () => {
      const cypher = 'MATCH path = (a:Entity)- [*1..2] -(b:Entity) WHERE none(r IN relationships(path) WHERE type(r) IN [\'REFERENCED\', \'IN_CHAT\', \'PRODUCED\']) AND a.documentId IN $documentIds AND b.documentId IN $documentIds RETURN path';
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher,
          queryType: 'explanation',
          suggestedFormat: 'prose',
        }),
      });
      mockGraphDb.run.mockResolvedValue({ records: [] });

      const result = await text2CypherSearch({
        query: 'find a path',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toBeUndefined();
      expect(mockGraphDb.run).toHaveBeenCalledWith(cypher, {
        documentIds: mockDocumentIds,
      });
    });

    it('rejects a denylist encoded as one inert relationship type', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH path = (a:Entity)-[*1..3]-(b:Entity) WHERE none(r IN relationships(path) WHERE type(r) IN [\'REFERENCED IN_CHAT PRODUCED\']) AND a.documentId IN $documentIds RETURN path',
          queryType: 'explanation',
          suggestedFormat: 'prose',
        }),
      });

      const result = await text2CypherSearch({
        query: 'find a path',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toContain('Security validation failed');
      expect(mockGraphDb.run).not.toHaveBeenCalled();
    });

    it('allows whitespace and mixed quoting in the exact relationship denylist', async () => {
      const cypher = 'MATCH path = (a:Entity)-[*1..3]-(b:Entity) WHERE none(r IN relationships(path) WHERE type(r) IN [ "REFERENCED" , \'IN_CHAT\' ,"PRODUCED" ]) AND a.documentId IN $documentIds RETURN path';
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher,
          queryType: 'explanation',
          suggestedFormat: 'prose',
        }),
      });
      mockGraphDb.run.mockResolvedValue({ records: [] });

      const result = await text2CypherSearch({
        query: 'find a path',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toBeUndefined();
      expect(mockGraphDb.run).toHaveBeenCalled();
    });

    it('rejects a relationship denylist missing one required type', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH path = (a:Entity)-[*1..3]-(b:Entity) WHERE none(r IN relationships(path) WHERE type(r) IN [\'REFERENCED\', \'IN_CHAT\']) AND a.documentId IN $documentIds RETURN path',
          queryType: 'explanation',
          suggestedFormat: 'prose',
        }),
      });

      const result = await text2CypherSearch({
        query: 'find a path',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toContain('Security validation failed');
      expect(mockGraphDb.run).not.toHaveBeenCalled();
    });

    it('rejects two variable-length paths when only one has a guard', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH firstPath = (a:Entity)-[*1..3]-(b:Entity), secondPath = (c:Entity)-[*1..3]-(d:Entity) WHERE none(r IN relationships(firstPath) WHERE type(r) IN [\'REFERENCED\', \'IN_CHAT\', \'PRODUCED\']) AND a.documentId IN $documentIds RETURN firstPath, secondPath',
          queryType: 'explanation',
          suggestedFormat: 'prose',
        }),
      });

      const result = await text2CypherSearch({
        query: 'find two paths',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toContain('secondpath');
      expect(mockGraphDb.run).not.toHaveBeenCalled();
    });

    it('allows two variable-length paths when each has its own guard', async () => {
      const cypher = 'MATCH firstPath = (a:Entity)-[*1..3]-(b:Entity), secondPath = (c:Entity)-[*1..3]-(d:Entity) WHERE none(r IN relationships(firstPath) WHERE type(r) IN [\'REFERENCED\', \'IN_CHAT\', \'PRODUCED\']) AND none(r IN relationships(secondPath) WHERE type(r) IN [\'REFERENCED\', \'IN_CHAT\', \'PRODUCED\']) AND a.documentId IN $documentIds RETURN firstPath, secondPath';
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher,
          queryType: 'explanation',
          suggestedFormat: 'prose',
        }),
      });
      mockGraphDb.run.mockResolvedValue({ records: [] });

      const result = await text2CypherSearch({
        query: 'find two paths',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toBeUndefined();
      expect(mockGraphDb.run).toHaveBeenCalled();
    });

    it('rejects an anonymous variable-length relationship pattern', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (a:Entity)-[*1..3]-(b:Entity) WHERE a.documentId IN $documentIds RETURN b',
          queryType: 'explanation',
          suggestedFormat: 'prose',
        }),
      });

      const result = await text2CypherSearch({
        query: 'find a path',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toContain('require a path variable');
      expect(mockGraphDb.run).not.toHaveBeenCalled();
    });

    it('rejects a guard that names a different path variable', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH expectedPath = (a:Entity)-[*1..3]-(b:Entity) WHERE none(r IN relationships(otherPath) WHERE type(r) IN [\'REFERENCED\', \'IN_CHAT\', \'PRODUCED\']) AND a.documentId IN $documentIds RETURN expectedPath',
          queryType: 'explanation',
          suggestedFormat: 'prose',
        }),
      });

      const result = await text2CypherSearch({
        query: 'find a path',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toContain('expectedpath');
      expect(mockGraphDb.run).not.toHaveBeenCalled();
    });

    it('emits a shortestPath prompt example that passes security validation', async () => {
      mockChatCompletion.mockImplementation(async (messages) => {
        const prompt = messages[0].content as string;
        const exampleMatch = prompt.match(/\{ "cypher": "([^"]*shortestPath[^\"]*)", "queryType": "explanation", "suggestedFormat": "prose" \}/);

        expect(exampleMatch).not.toBeNull();
        return {
          text: JSON.stringify({
            cypher: exampleMatch?.[1],
            queryType: 'explanation',
            suggestedFormat: 'prose',
          }),
        };
      });
      mockGraphDb.run.mockResolvedValue({ records: [] });

      const result = await text2CypherSearch({
        query: 'how is A related to B?',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toBeUndefined();
      expect(result.generatedCypher).toContain('shortestPath');
      expect(mockGraphDb.run).toHaveBeenCalled();
    });
  });

  describe('successful queries', () => {
    it('executes valid count query with aggregation type', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN count(e) as total',
          queryType: 'aggregation',
          suggestedFormat: 'prose',
        }),
      });

      mockGraphDb.run.mockResolvedValue({
        records: [
          {
            keys: ['total'],
            get: () => ({ toNumber: () => 42 }),
          },
        ],
      });

      const result = await text2CypherSearch({
        query: 'how many entities?',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toBeUndefined();
      expect(result.results).toEqual([{ total: 42 }]);
      expect(result.rowCount).toBe(1);
      expect(result.queryType).toBe('aggregation');
      expect(result.suggestedFormat).toBe('prose');
      expect(mockGraphDb.run).toHaveBeenCalledWith(
        expect.stringContaining('count(e)'),
        { documentIds: mockDocumentIds }
      );
    });

    it('returns enumeration type for list queries', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN e.name',
          queryType: 'enumeration',
          suggestedFormat: 'table',
        }),
      });

      mockGraphDb.run.mockResolvedValue({
        records: [
          {
            keys: ['name'],
            get: () => 'TestEntity',
          },
        ],
      });

      const result = await text2CypherSearch({
        query: 'list all entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.queryType).toBe('enumeration');
      expect(result.suggestedFormat).toBe('table');
    });

    it('returns explanation type for detail queries', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds AND toLower(e.name) CONTAINS "acme" RETURN e.name, e.description',
          queryType: 'explanation',
          suggestedFormat: 'prose',
        }),
      });

      mockGraphDb.run.mockResolvedValue({
        records: [
          {
            keys: ['name', 'description'],
            get: (key: string) => (key === 'name' ? 'ACME Corp' : 'A description'),
          },
        ],
      });

      const result = await text2CypherSearch({
        query: 'What is ACME?',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.queryType).toBe('explanation');
      expect(result.suggestedFormat).toBe('prose');
    });

    it('passes documentIds to Neo4j query', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.documentId IN $documentIds RETURN e.name',
          queryType: 'enumeration',
          suggestedFormat: 'table',
        }),
      });

      mockGraphDb.run.mockResolvedValue({ records: [] });

      await text2CypherSearch({
        query: 'list entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(mockGraphDb.run).toHaveBeenCalledWith(
        expect.any(String),
        { documentIds: mockDocumentIds }
      );
    });

    it('handles raw cypher response as fallback (backward compatibility)', async () => {
      mockChatCompletion.mockResolvedValue({
        text: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN e',
      });

      mockGraphDb.run.mockResolvedValue({ records: [] });

      const result = await text2CypherSearch({
        query: 'list entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.generatedCypher).toContain('MATCH');
      expect(result.queryType).toBe('explanation'); // Default fallback
      expect(result.suggestedFormat).toBe('prose'); // Default fallback
    });

    it('strips markdown code blocks from JSON response', async () => {
      mockChatCompletion.mockResolvedValue({
        text: '```json\n{"cypher": "MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN e", "queryType": "enumeration", "suggestedFormat": "table"}\n```',
      });

      mockGraphDb.run.mockResolvedValue({ records: [] });

      const result = await text2CypherSearch({
        query: 'list entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.generatedCypher).not.toContain('```');
      expect(result.generatedCypher).toContain('MATCH');
      expect(result.queryType).toBe('enumeration');
    });

    it('converts Neo4j Integer objects to JS numbers', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN e.name, e.count',
          queryType: 'enumeration',
          suggestedFormat: 'table',
        }),
      });

      mockGraphDb.run.mockResolvedValue({
        records: [
          {
            keys: ['name', 'count'],
            get: (key: string) => {
              if (key === 'name') {
                return 'TestEntity';
              }
              if (key === 'count') {
                return { toNumber: () => 5 };
              }
              return null;
            },
          },
        ],
      });

      const result = await text2CypherSearch({
        query: 'list entities with count',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.results[0]).toEqual({ name: 'TestEntity', count: 5 });
    });
  });

  describe('error handling', () => {
    it('returns error when LLM call fails', async () => {
      mockChatCompletion.mockRejectedValue(new Error('LLM unavailable'));

      const result = await text2CypherSearch({
        query: 'list entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toBe('LLM unavailable');
      expect(result.results).toEqual([]);
      expect(result.queryType).toBe('explanation'); // Default on error
      expect(result.suggestedFormat).toBe('prose'); // Default on error
    });

    it('returns error when Neo4j query fails', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN e',
          queryType: 'enumeration',
          suggestedFormat: 'table',
        }),
      });

      mockGraphDb.run.mockRejectedValue(new Error('Neo4j connection failed'));

      const result = await text2CypherSearch({
        query: 'list entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toBe('Neo4j connection failed');
      expect(result.results).toEqual([]);
    });

    it('tracks execution time even on error', async () => {
      mockChatCompletion.mockRejectedValue(new Error('LLM unavailable'));

      const result = await text2CypherSearch({
        query: 'list entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('preserves queryType on security validation failure', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.name = "x" RETURN e', // Missing documentIds
          queryType: 'enumeration',
          suggestedFormat: 'table',
        }),
      });

      const result = await text2CypherSearch({
        query: 'list entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toContain('Missing $documentIds filter');
      expect(result.queryType).toBe('enumeration'); // Preserved from parsed response
      expect(result.suggestedFormat).toBe('table'); // Preserved from parsed response
    });
  });

  describe('syntax error retry', () => {
    it('retries once on syntax error and succeeds', async () => {
      // First call: bad cypher with variable reference error
      // Second call: fixed cypher
      mockChatCompletion
        .mockResolvedValueOnce({
          text: JSON.stringify({
            cypher:
              'MATCH (d:Document) WHERE d.userId = $userId AND d.id IN $documentIds WITH d.filename as doc, collect(DISTINCT doc) as docs RETURN docs',
            queryType: 'enumeration',
            suggestedFormat: 'table',
          }),
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            cypher:
              'MATCH (d:Document) WHERE d.userId = $userId AND d.id IN $documentIds WITH collect(DISTINCT d.filename) as docs RETURN docs',
            queryType: 'enumeration',
            suggestedFormat: 'table',
          }),
        });

      // First run: syntax error
      // Second run: success
      mockGraphDb.run
        .mockRejectedValueOnce(new Error('Variable `doc` not defined (line 1, column 85)'))
        .mockResolvedValueOnce({
          records: [
            {
              keys: ['docs'],
              get: () => ['doc1.pdf', 'doc2.pdf'],
            },
          ],
        });

      const result = await text2CypherSearch({
        query: 'list documents',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toBeUndefined();
      expect(result.results).toEqual([{ docs: ['doc1.pdf', 'doc2.pdf'] }]);
      expect(mockChatCompletion).toHaveBeenCalledTimes(2);
      expect(mockGraphDb.run).toHaveBeenCalledTimes(2);
    });

    it('returns error after retry exhausted', async () => {
      // Both attempts produce bad cypher
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher:
            'MATCH (d:Document) WHERE d.userId = $userId AND d.id IN $documentIds WITH d.filename as doc, collect(DISTINCT doc) as docs RETURN docs',
          queryType: 'enumeration',
          suggestedFormat: 'table',
        }),
      });

      mockGraphDb.run.mockRejectedValue(new Error('Variable `doc` not defined (line 1, column 85)'));

      const result = await text2CypherSearch({
        query: 'list documents',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toContain('not defined');
      expect(result.results).toEqual([]);
      expect(mockChatCompletion).toHaveBeenCalledTimes(2); // Initial + 1 retry
      expect(mockGraphDb.run).toHaveBeenCalledTimes(2);
    });

    it('does not retry on non-syntax errors', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({
          cypher: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN e',
          queryType: 'enumeration',
          suggestedFormat: 'table',
        }),
      });

      mockGraphDb.run.mockRejectedValue(new Error('Connection refused'));

      const result = await text2CypherSearch({
        query: 'list entities',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      expect(result.error).toBe('Connection refused');
      expect(mockChatCompletion).toHaveBeenCalledTimes(1); // No retry
      expect(mockGraphDb.run).toHaveBeenCalledTimes(1);
    });

    it('includes error message in retry prompt', async () => {
      const syntaxError = 'Variable `doc` not defined (line 1, column 85)';

      mockChatCompletion
        .mockResolvedValueOnce({
          text: JSON.stringify({
            cypher:
              'MATCH (d:Document) WHERE d.userId = $userId AND d.id IN $documentIds WITH d.filename as doc, collect(DISTINCT doc) as docs RETURN docs',
            queryType: 'enumeration',
            suggestedFormat: 'table',
          }),
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            cypher:
              'MATCH (d:Document) WHERE d.userId = $userId AND d.id IN $documentIds WITH collect(DISTINCT d.filename) as docs RETURN docs',
            queryType: 'enumeration',
            suggestedFormat: 'table',
          }),
        });

      mockGraphDb.run
        .mockRejectedValueOnce(new Error(syntaxError))
        .mockResolvedValueOnce({ records: [] });

      await text2CypherSearch({
        query: 'list documents',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      // Check that the second call includes the error message
      const secondCallPrompt = mockChatCompletion.mock.calls[1][0][0].content;
      expect(secondCallPrompt).toContain(syntaxError);
      expect(secondCallPrompt).toContain('PREVIOUS ATTEMPT (FAILED)');
      expect(secondCallPrompt).toContain('CYPHER PITFALLS TO AVOID');
    });

    it('preserves queryType from first attempt on retry', async () => {
      // First call: enumeration classification with bad cypher
      // Second call: LLM returns aggregation but we should preserve enumeration
      mockChatCompletion
        .mockResolvedValueOnce({
          text: JSON.stringify({
            cypher:
              'MATCH (d:Document) WHERE d.userId = $userId AND d.id IN $documentIds WITH d.filename as doc, collect(DISTINCT doc) as docs RETURN docs',
            queryType: 'enumeration',
            suggestedFormat: 'table',
          }),
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            cypher:
              'MATCH (d:Document) WHERE d.userId = $userId AND d.id IN $documentIds WITH collect(DISTINCT d.filename) as docs RETURN docs',
            queryType: 'aggregation', // LLM changed classification on retry
            suggestedFormat: 'prose',
          }),
        });

      mockGraphDb.run
        .mockRejectedValueOnce(new Error('Variable `doc` not defined'))
        .mockResolvedValueOnce({ records: [] });

      const result = await text2CypherSearch({
        query: 'list documents',
        documentIds: mockDocumentIds,
        userId: mockUserId,
      });

      // Should preserve enumeration from first attempt, not aggregation from retry
      expect(result.queryType).toBe('enumeration');
      expect(result.suggestedFormat).toBe('table');
    });
  });
});
