import {
  validateCypherSecurity,
  parseCypherResponse,
  executeCypher,
  isSyntaxError,
} from './cypherUtils';
import { getGraphDatabaseSource } from '@/features/graph-database';

jest.mock('@/features/graph-database', () => ({
  getGraphDatabaseSource: jest.fn(),
}));

jest.mock('@/server/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('cypherUtils', () => {
  describe('validateCypherSecurity', () => {
    it('returns valid for properly secured query', () => {
      const cypher = 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN e';
      const result = validateCypherSecurity(cypher);
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('rejects query missing $documentIds filter', () => {
      const cypher = 'MATCH (e:Entity) WHERE e.name = "foo" RETURN e';
      const result = validateCypherSecurity(cypher);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Missing $documentIds filter');
    });

    it('rejects CREATE operations', () => {
      const cypher = 'CREATE (e:Entity) SET e.userId = $userId, e.documentId IN $documentIds';
      const result = validateCypherSecurity(cypher);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Write operation detected');
    });

    it('rejects MERGE operations', () => {
      const cypher = 'MERGE (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds';
      const result = validateCypherSecurity(cypher);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Write operation detected');
    });

    it('rejects SET operations', () => {
      const cypher = 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds SET e.name = "hacked"';
      const result = validateCypherSecurity(cypher);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Write operation detected');
    });

    it('rejects DELETE operations', () => {
      const cypher = 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds DELETE e';
      const result = validateCypherSecurity(cypher);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Write operation detected');
    });

    it('rejects DETACH DELETE operations', () => {
      const cypher = 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds DETACH DELETE e';
      const result = validateCypherSecurity(cypher);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Write operation detected');
    });

    it('allows write keywords inside string literals', () => {
      // "process asset library" contains "set" but it's a string value, not Cypher keyword
      const cypher = 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds AND e.name = \'process asset library\' RETURN e';
      const result = validateCypherSecurity(cypher);
      expect(result.valid).toBe(true);
    });

    it('is case-insensitive for parameter names', () => {
      const cypher = 'MATCH (e:Entity) WHERE e.userId = $USERID AND e.documentId IN $DOCUMENTIDS RETURN e';
      const result = validateCypherSecurity(cypher);
      expect(result.valid).toBe(true);
    });

    it('rejects a conversation label even when $documentIds is present', () => {
      const cypher = 'MATCH (d:Document) WHERE d.id IN $documentIds MATCH (m:Message)-[:REFERENCED]->(e:Entity) RETURN m';

      const result = validateCypherSecurity(cypher);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('message');
    });

    it('allows a legitimate document query', () => {
      const cypher = 'MATCH (e:Entity) WHERE e.documentId IN $documentIds RETURN e.name';

      expect(validateCypherSecurity(cypher)).toEqual({ valid: true });
    });

    it('allows an entity named message in a string literal', () => {
      const cypher = 'MATCH (e:Entity) WHERE e.documentId IN $documentIds AND e.name = \'message\' RETURN e';

      expect(validateCypherSecurity(cypher)).toEqual({ valid: true });
    });

    it('allows an entity named message when the query also returns type()', () => {
      const cypher = 'MATCH (e:Entity)-[r]-(o) WHERE e.documentId IN $documentIds AND e.name = \'message\' RETURN type(r)';

      expect(validateCypherSecurity(cypher)).toEqual({ valid: true });
    });

    it('rejects a forbidden label named through labels()', () => {
      const cypher = 'MATCH (d:Document) WHERE d.id IN $documentIds MATCH (m) WHERE \'Message\' IN labels(m) RETURN m';

      const result = validateCypherSecurity(cypher);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('message');
    });

    it('rejects a forbidden relationship type named through type()', () => {
      const cypher = 'MATCH (e:Entity)-[r]-(o) WHERE e.documentId IN $documentIds AND type(r) = \'REFERENCED\' RETURN e';

      const result = validateCypherSecurity(cypher);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('referenced');
    });

    it('rejects a query that hops through an identity cluster hub', () => {
      const cypher = 'MATCH (e:Entity)-[:IN_CLUSTER]->(:IdentityCluster)<-[:IN_CLUSTER]-(other) WHERE e.documentId IN $documentIds RETURN other.name';

      const result = validateCypherSecurity(cypher);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('identitycluster');
    });

    it('rejects an IN_CLUSTER relationship reference on its own', () => {
      const cypher = 'MATCH (e:Entity)-[r:IN_CLUSTER]->(h) WHERE e.documentId IN $documentIds RETURN h';

      const result = validateCypherSecurity(cypher);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('in_cluster');
    });

    it('allows a property named chatId', () => {
      const cypher = 'MATCH (e:Entity) WHERE e.documentId IN $documentIds RETURN e.chatId';

      expect(validateCypherSecurity(cypher)).toEqual({ valid: true });
    });

    it('rejects a variable-length relationship pattern without the denylist guard', () => {
      const cypher = 'MATCH path = shortestPath((e1:Entity)-[*..8]-(e2:Entity)) WHERE e1.documentId IN $documentIds AND e2.documentId IN $documentIds RETURN path';

      const result = validateCypherSecurity(cypher);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('path');
    });

    it('rejects a typed variable-length relationship pattern without the denylist guard', () => {
      const cypher = 'MATCH path = shortestPath((e1:Entity)-[:MENTIONS|RELATED*..8]-(e2:Entity)) WHERE e1.documentId IN $documentIds AND e2.documentId IN $documentIds RETURN path';

      const result = validateCypherSecurity(cypher);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('path');
    });

    it('allows a variable-length relationship pattern with the denylist guard', () => {
      const cypher = 'MATCH path = shortestPath((e1:Entity)-[*..8]-(e2:Entity)) WHERE NONE(r IN relationships(path) WHERE type(r) IN [\'REFERENCED\', \'IN_CHAT\', \'PRODUCED\', \'IN_CLUSTER\']) AND e1.documentId IN $documentIds AND e2.documentId IN $documentIds RETURN path';

      expect(validateCypherSecurity(cypher)).toEqual({ valid: true });
    });

    it('rejects a whitespace-separated variable-length pattern without the denylist guard', () => {
      const cypher = 'MATCH path = (a:Entity)- [*1..2] -(b:Entity) WHERE a.documentId IN $documentIds AND b.documentId IN $documentIds RETURN path';

      const result = validateCypherSecurity(cypher);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('path');
    });

    it('allows a whitespace-separated variable-length pattern with the denylist guard', () => {
      const cypher = 'MATCH path = (a:Entity)- [*1..2] -(b:Entity) WHERE none(r IN relationships(path) WHERE type(r) IN [\'REFERENCED\', \'IN_CHAT\', \'PRODUCED\', \'IN_CLUSTER\']) AND a.documentId IN $documentIds AND b.documentId IN $documentIds RETURN path';

      expect(validateCypherSecurity(cypher)).toEqual({ valid: true });
    });

    it('rejects a denylist encoded as one inert relationship type', () => {
      const cypher = 'MATCH path = shortestPath((e1:Entity)-[*..8]-(e2:Entity)) WHERE none(r IN relationships(path) WHERE type(r) IN [\'REFERENCED IN_CHAT PRODUCED\']) AND e1.documentId IN $documentIds RETURN path';

      expect(validateCypherSecurity(cypher).valid).toBe(false);
    });

    it('allows whitespace and mixed quoting in the exact relationship denylist', () => {
      const cypher = 'MATCH path = shortestPath((e1:Entity)-[*..8]-(e2:Entity)) WHERE none(r IN relationships(path) WHERE type(r) IN [ "REFERENCED" , \'IN_CHAT\' ,"PRODUCED" , \'IN_CLUSTER\' ]) AND e1.documentId IN $documentIds RETURN path';

      expect(validateCypherSecurity(cypher)).toEqual({ valid: true });
    });

    it('rejects a relationship denylist missing one required type', () => {
      const cypher = 'MATCH path = shortestPath((e1:Entity)-[*..8]-(e2:Entity)) WHERE none(r IN relationships(path) WHERE type(r) IN [\'REFERENCED\', \'IN_CHAT\']) AND e1.documentId IN $documentIds RETURN path';

      expect(validateCypherSecurity(cypher).valid).toBe(false);
    });

    it('rejects two variable-length paths when only one has a guard', () => {
      const cypher = 'MATCH firstPath = (a:Entity)-[*1..3]-(b:Entity), secondPath = (c:Entity)-[*1..3]-(d:Entity) WHERE none(r IN relationships(firstPath) WHERE type(r) IN [\'REFERENCED\', \'IN_CHAT\', \'PRODUCED\', \'IN_CLUSTER\']) AND a.documentId IN $documentIds RETURN firstPath, secondPath';

      const result = validateCypherSecurity(cypher);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('secondpath');
    });

    it('allows two variable-length paths when each has its own guard', () => {
      const cypher = 'MATCH firstPath = (a:Entity)-[*1..3]-(b:Entity), secondPath = (c:Entity)-[*1..3]-(d:Entity) WHERE none(r IN relationships(firstPath) WHERE type(r) IN [\'REFERENCED\', \'IN_CHAT\', \'PRODUCED\', \'IN_CLUSTER\']) AND none(r IN relationships(secondPath) WHERE type(r) IN [\'REFERENCED\', \'IN_CHAT\', \'PRODUCED\', \'IN_CLUSTER\']) AND a.documentId IN $documentIds RETURN firstPath, secondPath';

      expect(validateCypherSecurity(cypher)).toEqual({ valid: true });
    });

    it('rejects an anonymous variable-length relationship pattern', () => {
      const cypher = 'MATCH (a:Entity)-[*1..3]-(b:Entity) WHERE a.documentId IN $documentIds RETURN b';

      const result = validateCypherSecurity(cypher);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('require a path variable');
    });

    it('rejects a guard that names a different path variable', () => {
      const cypher = 'MATCH expectedPath = (a:Entity)-[*1..3]-(b:Entity) WHERE none(r IN relationships(otherPath) WHERE type(r) IN [\'REFERENCED\', \'IN_CHAT\', \'PRODUCED\', \'IN_CLUSTER\']) AND a.documentId IN $documentIds RETURN expectedPath';

      const result = validateCypherSecurity(cypher);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('expectedpath');
    });

    it('still rejects labels() introspection outside a valid path denylist guard', () => {
      const cypher = 'MATCH path = shortestPath((e1:Entity)-[*..8]-(e2:Entity)) WHERE none(r IN relationships(path) WHERE type(r) IN [\'REFERENCED\', \'IN_CHAT\', \'PRODUCED\', \'IN_CLUSTER\']) AND \'Message\' IN labels(e1) AND e1.documentId IN $documentIds RETURN path';

      const result = validateCypherSecurity(cypher);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('message');
    });
  });

  describe('parseCypherResponse', () => {
    it('parses valid JSON response', () => {
      const response = '{"cypher": "MATCH (e:Entity) RETURN e", "suggestedFormat": "table"}';
      const result = parseCypherResponse(response);
      expect(result.cypher).toBe('MATCH (e:Entity) RETURN e');
      expect(result.suggestedFormat).toBe('table');
    });

    it('strips markdown code blocks from JSON', () => {
      const response = '```json\n{"cypher": "MATCH (e:Entity) RETURN e", "suggestedFormat": "table"}\n```';
      const result = parseCypherResponse(response);
      expect(result.cypher).toBe('MATCH (e:Entity) RETURN e');
      expect(result.suggestedFormat).toBe('table');
    });

    it('strips cypher code blocks', () => {
      const response = '```cypher\nMATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN e\n```';
      const result = parseCypherResponse(response);
      expect(result.cypher).toContain('MATCH (e:Entity)');
      expect(result.suggestedFormat).toBe('prose'); // default fallback
    });

    it('handles raw cypher as fallback', () => {
      const response = 'MATCH (e:Entity) RETURN e';
      const result = parseCypherResponse(response);
      expect(result.cypher).toBe('MATCH (e:Entity) RETURN e');
      expect(result.suggestedFormat).toBe('prose');
    });

    it('defaults suggestedFormat to prose when missing', () => {
      const response = '{"cypher": "MATCH (e:Entity) RETURN e"}';
      const result = parseCypherResponse(response);
      expect(result.suggestedFormat).toBe('prose');
    });

    it('uses cleaned response as cypher when cypher field is missing in JSON', () => {
      const response = '{"suggestedFormat": "table"}';
      const result = parseCypherResponse(response);
      expect(result.cypher).toBe('{"suggestedFormat": "table"}');
    });
  });

  describe('executeCypher', () => {
    const mockGraphDb = {
      run: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      (getGraphDatabaseSource as jest.Mock).mockResolvedValue(mockGraphDb);
    });

    it('executes query and returns results', async () => {
      mockGraphDb.run.mockResolvedValue({
        records: [
          {
            keys: ['name', 'type'],
            get: (key: string) => (key === 'name' ? 'TestEntity' : 'Person'),
          },
        ],
      });

      const result = await executeCypher(
        'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN e.name, e.type',
        { documentIds: ['doc-1'] }
      );

      expect(result.error).toBeUndefined();
      expect(result.results).toEqual([{ name: 'TestEntity', type: 'Person' }]);
      expect(result.rowCount).toBe(1);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('converts Neo4j integers to JS numbers', async () => {
      mockGraphDb.run.mockResolvedValue({
        records: [
          {
            keys: ['count'],
            get: () => ({ toNumber: () => 42 }),
          },
        ],
      });

      const result = await executeCypher(
        'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN count(e) as count',
        { documentIds: ['doc-1'] }
      );

      expect(result.results).toEqual([{ count: 42 }]);
    });

    it('handles empty results', async () => {
      mockGraphDb.run.mockResolvedValue({ records: [] });

      const result = await executeCypher(
        'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN e',
        { documentIds: ['doc-1'] }
      );

      expect(result.error).toBeUndefined();
      expect(result.results).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it('returns error on query failure', async () => {
      mockGraphDb.run.mockRejectedValue(new Error('Connection refused'));

      const result = await executeCypher(
        'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN e',
        { documentIds: ['doc-1'] }
      );

      expect(result.error).toBe('Connection refused');
      expect(result.results).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it('tracks execution time even on error', async () => {
      mockGraphDb.run.mockRejectedValue(new Error('Timeout'));

      const result = await executeCypher(
        'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN e',
        { documentIds: ['doc-1'] }
      );

      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('isSyntaxError', () => {
    it('returns true for SyntaxError', () => {
      expect(isSyntaxError('Neo.ClientError.Statement.SyntaxError: Invalid syntax')).toBe(true);
    });

    it('returns true for variable not defined', () => {
      expect(isSyntaxError('Variable `doc` not defined (line 1, column 85)')).toBe(true);
    });

    it('returns true for invalid input', () => {
      expect(isSyntaxError('Invalid input \'x\': expected whitespace')).toBe(true);
    });

    it('returns false for connection errors', () => {
      expect(isSyntaxError('Connection refused')).toBe(false);
    });

    it('returns false for timeout errors', () => {
      expect(isSyntaxError('Query execution timeout')).toBe(false);
    });
  });
});
