import { getOneHopExpansion, findShortestPaths, getChunkWithContext } from '@/features/graph-database/services/graphQueries';
import { getGraphDatabaseSource } from '@/features/graph-database';
import { expandIdentityClusters } from '@/features/graph-database/dal/expandIdentityClusters';

jest.mock('@/features/graph-database', () => ({
  getGraphDatabaseSource: jest.fn(),
}));

jest.mock('@/features/graph-database/dal/expandIdentityClusters');

jest.mock('@/server/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockExpandIdentityClusters = expandIdentityClusters as jest.MockedFunction<
  typeof expandIdentityClusters
>;

describe('graphQueries', () => {
  const mockGraphDb = {
    run: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue(mockGraphDb);
    // Default: no expansion — every seed maps to itself. Individual tests can
    // override this to exercise multi-member cluster behaviour.
    mockExpandIdentityClusters.mockImplementation(async (nodeIds) =>
      new Map(nodeIds.map((id) => [id, [id]]))
    );
  });

  describe('getOneHopExpansion', () => {
    const mockDocumentIds = ['doc-1', 'doc-2'];
    const mockEntityIds = ['entity-1', 'entity-2'];
    const mockConceptIds = ['concept-1'];

    it('should return empty array when no anchor IDs provided', async () => {
      const result = await getOneHopExpansion([], [], mockDocumentIds);

      expect(result).toEqual([]);
      expect(mockGraphDb.run).not.toHaveBeenCalled();
    });

    it('should NOT include userId predicates (read paths authorized by documentIds)', async () => {
      mockGraphDb.run.mockResolvedValue({ records: [] });

      await getOneHopExpansion(mockEntityIds, mockConceptIds, mockDocumentIds);

      const entityCall = mockGraphDb.run.mock.calls[0];
      expect(entityCall[0]).not.toContain('userId');
    });

    it('should include documentIds filter (including Document node check)', async () => {
      mockGraphDb.run.mockResolvedValue({ records: [] });

      await getOneHopExpansion(mockEntityIds, mockConceptIds, mockDocumentIds);

      const entityCall = mockGraphDb.run.mock.calls[0];
      expect(entityCall[0]).toContain('neighbor.documentId IN $documentIds OR (neighbor:Document AND neighbor.id IN $documentIds)');
      expect(entityCall[1].documentIds).toEqual(mockDocumentIds);
    });

    it('should throw when documentIds is empty', async () => {
      await expect(
        getOneHopExpansion(mockEntityIds, mockConceptIds, [])
      ).rejects.toThrow();
    });

    it('should pass all parameters to Neo4j query', async () => {
      mockGraphDb.run.mockResolvedValue({ records: [] });

      await getOneHopExpansion(mockEntityIds, mockConceptIds, mockDocumentIds);

      const entityCall = mockGraphDb.run.mock.calls[0];
      expect(entityCall[1]).toMatchObject({
        anchorEntityIds: mockEntityIds,
        allAnchorIds: [...mockEntityIds, ...mockConceptIds],
        documentIds: mockDocumentIds,
      });

      const conceptCall = mockGraphDb.run.mock.calls[1];
      expect(conceptCall[1]).toMatchObject({
        anchorConceptIds: mockConceptIds,
        allAnchorIds: [...mockEntityIds, ...mockConceptIds],
        documentIds: mockDocumentIds,
      });
    });

    it('should skip entity query when no entity IDs provided', async () => {
      mockGraphDb.run.mockResolvedValue({ records: [] });

      await getOneHopExpansion([], mockConceptIds, mockDocumentIds);

      expect(mockGraphDb.run).toHaveBeenCalledTimes(1);
      const call = mockGraphDb.run.mock.calls[0];
      expect(call[0]).toContain('anchor:Concept');
    });

    it('should skip concept query when no concept IDs provided', async () => {
      mockGraphDb.run.mockResolvedValue({ records: [] });

      await getOneHopExpansion(mockEntityIds, [], mockDocumentIds);

      expect(mockGraphDb.run).toHaveBeenCalledTimes(1);
      const call = mockGraphDb.run.mock.calls[0];
      expect(call[0]).toContain('anchor:Entity');
    });

    it('should map Neo4j records to OneHopResult format', async () => {
      const mockRecord = {
        get: jest.fn((key: string) => {
          const data: Record<string, unknown> = {
            anchorId: 'entity-1',
            anchorName: 'GraphRAG',
            anchorType: 'ENTITY',
            relationType: 'DEVELOPED_BY',
            relationshipDescription: 'Microsoft developed GraphRAG',
            confidence: 0.9,
            sourceName: 'GraphRAG',
            targetName: 'Microsoft',
            neighborId: 'entity-ms',
            neighborName: 'Microsoft',
            neighborDescription: 'Tech company',
            neighborType: 'Entity',
          };
          return data[key];
        }),
      };

      mockGraphDb.run.mockResolvedValue({ records: [mockRecord] });

      const result = await getOneHopExpansion(mockEntityIds, [], mockDocumentIds);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        anchor: {
          id: 'entity-1',
          name: 'GraphRAG',
          type: 'ENTITY',
        },
        relationship: {
          type: 'DEVELOPED_BY',
          description: 'Microsoft developed GraphRAG',
          confidence: 0.9,
          sourceName: 'GraphRAG',
          targetName: 'Microsoft',
        },
        neighbor: {
          id: 'entity-ms',
          name: 'Microsoft',
          description: 'Tech company',
          type: 'Entity',
        },
      });
    });

    it('should return empty array and log error when query fails', async () => {
      mockGraphDb.run.mockRejectedValue(new Error('Neo4j connection failed'));

      const result = await getOneHopExpansion(mockEntityIds, mockConceptIds, mockDocumentIds);

      expect(result).toEqual([]);
    });

    it('should limit results to specified limit', async () => {
      // Create 100 mock records
      const mockRecords = Array.from({ length: 100 }, (_, i) => ({
        get: jest.fn((key: string) => {
          const data: Record<string, unknown> = {
            anchorId: `entity-${i}`,
            anchorName: `Entity ${i}`,
            anchorType: 'ENTITY',
            relationType: 'RELATED',
            relationshipDescription: 'Related',
            confidence: 0.5,
            sourceName: `Entity ${i}`,
            targetName: `Neighbor ${i}`,
            neighborId: `neighbor-${i}`,
            neighborName: `Neighbor ${i}`,
            neighborDescription: 'A neighbor',
            neighborType: 'Entity',
          };
          return data[key];
        }),
      }));

      mockGraphDb.run.mockResolvedValue({ records: mockRecords });

      const customLimit = 10;
      const result = await getOneHopExpansion(
        mockEntityIds,
        [],
        mockDocumentIds,
        customLimit
      );

      expect(result.length).toBeLessThanOrEqual(customLimit);
    });

    it('expands anchors to their full IDENTITY cluster before querying neighbors', async () => {
      // entity-1 is in a 3-member cluster; the query should be issued for all
      // 3 members, not just the original anchor.
      mockExpandIdentityClusters.mockResolvedValue(
        new Map([
          ['entity-1', ['entity-1', 'entity-1b', 'entity-1c']],
          ['entity-2', ['entity-2']],
        ])
      );
      mockGraphDb.run.mockResolvedValue({ records: [] });

      await getOneHopExpansion(mockEntityIds, [], mockDocumentIds);

      expect(mockExpandIdentityClusters).toHaveBeenCalledWith(mockEntityIds, mockDocumentIds);
      const entityCall = mockGraphDb.run.mock.calls[0];
      expect(entityCall[1].anchorEntityIds).toEqual(['entity-1', 'entity-1b', 'entity-1c', 'entity-2']);
      expect(entityCall[1].allAnchorIds).toEqual(['entity-1', 'entity-1b', 'entity-1c', 'entity-2']);
    });

    it('orders results by confidence desc, then neighbor id, before truncating', async () => {
      const record = (neighborId: string, confidence: number) => ({
        get: jest.fn((key: string) => {
          const data: Record<string, unknown> = {
            anchorId: 'entity-1',
            anchorName: 'Entity 1',
            anchorType: 'ENTITY',
            relationType: 'RELATED',
            confidence,
            sourceName: 'Entity 1',
            targetName: `Neighbor ${neighborId}`,
            neighborId,
            neighborName: `Neighbor ${neighborId}`,
            neighborType: 'Entity',
          };
          return data[key];
        }),
      });

      mockGraphDb.run.mockResolvedValue({
        records: [record('low', 0.2), record('high', 0.9), record('mid-b', 0.5), record('mid-a', 0.5)],
      });

      const result = await getOneHopExpansion(mockEntityIds, [], mockDocumentIds);

      expect(result.map((r) => r.neighbor.id)).toEqual(['high', 'mid-a', 'mid-b', 'low']);
    });
  });

  describe('findShortestPaths', () => {
    const documentIds = ['doc-1'];

    it('expands endpoints to full clusters and searches with no identity slack in the depth budget', async () => {
      mockExpandIdentityClusters.mockResolvedValue(
        new Map([
          ['e1', ['e1', 'e1b']],
          ['e2', ['e2']],
        ])
      );

      mockGraphDb.run.mockImplementation(async (query: string) => {
        if (query.includes('n.name AS name')) {
          return {
            records: [
              { get: (k: string) => ({ id: 'e1', name: 'Entity One' } as Record<string, unknown>)[k] },
              { get: (k: string) => ({ id: 'e2', name: 'Entity Two' } as Record<string, unknown>)[k] },
            ],
          };
        }
        // pathQuery — default maxDepth is 5; there should be no +2 identity slack.
        expect(query).toContain('*1..5]-');
        expect(query).not.toContain('*1..7]-');
        expect(query).toContain('none(r IN relationships(p) WHERE type(r) IN');
        expect(query).toContain('\'REFERENCED\'');
        expect(query).toContain('\'IN_CHAT\'');
        expect(query).toContain('\'PRODUCED\'');
        expect(query).toContain('\'IN_CLUSTER\'');
        return {
          records: [
            {
              get: (k: string) =>
                ({
                  pathNodes: [
                    { id: 'e1', name: 'Entity One', type: 'Entity', description: '' },
                    { id: 'e2', name: 'Entity Two', type: 'Entity', description: '' },
                  ],
                  pathEdges: [
                    { rawType: 'RELATED', type: 'RELATED', description: '', direction: 'outgoing' },
                  ],
                } as Record<string, unknown>)[k],
            },
          ],
        };
      });

      const results = await findShortestPaths(['e1', 'e2'], documentIds);

      expect(mockExpandIdentityClusters).toHaveBeenCalledWith(['e1', 'e2'], documentIds);
      expect(results).toHaveLength(1);
      expect(results[0].startName).toBe('Entity One');
      expect(results[0].endName).toBe('Entity Two');

      const pathCall = mockGraphDb.run.mock.calls.find(([q]: [string]) => q.includes('shortestPath'));
      expect(pathCall[1].startIds).toEqual(['e1', 'e1b']);
      expect(pathCall[1].endIds).toEqual(['e2']);
    });

    it('returns no path when the only route uses a conversation relationship', async () => {
      mockGraphDb.run.mockImplementation(async (query: string) => {
        if (query.includes('n.name AS name')) {
          return {
            records: [
              { get: (key: string) => ({ id: 'e1', name: 'Entity One' } as Record<string, unknown>)[key] },
              { get: (key: string) => ({ id: 'e2', name: 'Entity Two' } as Record<string, unknown>)[key] },
            ],
          };
        }

        const hasConversationDenylist = query.includes('none(r IN relationships(p) WHERE type(r) IN')
          && ['REFERENCED', 'IN_CHAT', 'PRODUCED', 'IN_CLUSTER'].every((relationshipType) =>
            query.includes(`'${relationshipType}'`)
          );
        if (hasConversationDenylist) {
          return { records: [] };
        }

        return {
          records: [
            {
              get: (key: string) => ({
                pathNodes: [{ id: 'e1' }, { id: 'message-1' }, { id: 'e2' }],
                pathEdges: [{ rawType: 'REFERENCED' }, { rawType: 'RELATED' }],
              } as Record<string, unknown>)[key],
            },
          ],
        };
      });

      await expect(findShortestPaths(['e1', 'e2'], documentIds)).resolves.toEqual([]);
    });
  });

  describe('getChunkWithContext', () => {
    const documentIds = ['doc-1'];

    const contextRecord = (overrides: Partial<Record<string, unknown>> = {}) => {
      const data: Record<string, unknown> = {
        c: { properties: { id: 'chunk-1', content: 'text', contentNum: 0 } },
        prev: undefined,
        next: undefined,
        entityDetails: [],
        conceptDetails: [],
        topics: [],
        ...overrides,
      };
      return { get: (key: string) => data[key] };
    };

    const relationshipRecord = (source: string, target: string, relType: string) => ({
      get: (key: string) =>
        ({ source, target, relType, description: null, confidence: null } as Record<string, unknown>)[key],
    });

    it('returns null when the chunk is not found', async () => {
      mockGraphDb.run.mockResolvedValue({ records: [] });

      const result = await getChunkWithContext('missing-chunk', documentIds);

      expect(result).toBeNull();
    });

    it('returns direct RELATED/SIMILAR relationships without querying IDENTITY clusters for a single mention', async () => {
      mockGraphDb.run.mockImplementation(async (query: string) => {
        if (query.includes('RETURN c, prev, next')) {
          return {
            records: [
              contextRecord({
                entityDetails: [{ id: 'e1', name: 'Entity One', type: 'ORG', description: '', aliases: [] }],
              }),
            ],
          };
        }
        return { records: [] };
      });

      const result = await getChunkWithContext('chunk-1', documentIds);

      expect(result?.entityDetails).toHaveLength(1);
      expect(mockExpandIdentityClusters).not.toHaveBeenCalled();
    });

    it('excludes IDENTITY from the direct relationship query (cluster-expanded separately)', async () => {
      mockGraphDb.run.mockImplementation(async (query: string) => {
        if (query.includes('RETURN c, prev, next')) {
          return { records: [contextRecord()] };
        }
        // relationshipQuery
        expect(query).not.toContain('IDENTITY');
        expect(query).toContain('type(r) = \'SIMILAR\'');
        return { records: [] };
      });

      await getChunkWithContext('chunk-1', documentIds);
    });

    it('synthesizes an IDENTITY relationship for two co-cluster mentions with no direct edge', async () => {
      mockGraphDb.run.mockImplementation(async (query: string) => {
        if (query.includes('RETURN c, prev, next')) {
          return {
            records: [
              contextRecord({
                entityDetails: [
                  { id: 'e1', name: 'FedRAMP Compliance', type: 'CONCEPT', description: '', aliases: [] },
                  { id: 'e2', name: 'FedRAMP compliance', type: 'CONCEPT', description: '', aliases: [] },
                ],
              }),
            ],
          };
        }
        // No direct RELATED/SIMILAR edge between e1 and e2
        return { records: [] };
      });
      mockExpandIdentityClusters.mockResolvedValue(new Map([['e1', ['e1', 'e2']]]));

      const result = await getChunkWithContext('chunk-1', documentIds);

      expect(mockExpandIdentityClusters).toHaveBeenCalledWith(['e1', 'e2'], documentIds);
      expect(result?.relationships).toEqual([
        { source: 'FedRAMP Compliance', target: 'FedRAMP compliance', type: 'IDENTITY' },
      ]);
    });

    it('keeps direct RELATED relationships alongside synthesized IDENTITY ones', async () => {
      mockGraphDb.run.mockImplementation(async (query: string) => {
        if (query.includes('RETURN c, prev, next')) {
          return {
            records: [
              contextRecord({
                entityDetails: [
                  { id: 'e1', name: 'Acme Corp', type: 'ORG', description: '', aliases: [] },
                  { id: 'e2', name: 'Acme Inc', type: 'ORG', description: '', aliases: [] },
                ],
                conceptDetails: [{ id: 'c1', name: 'Merger', category: 'BUSINESS', description: '' }],
              }),
            ],
          };
        }
        return { records: [relationshipRecord('Acme Corp', 'Merger', 'DISCUSSES')] };
      });
      mockExpandIdentityClusters.mockResolvedValue(new Map([['e1', ['e1', 'e2']], ['c1', ['c1']]]));

      const result = await getChunkWithContext('chunk-1', documentIds);

      expect(result?.relationships).toEqual(
        expect.arrayContaining([
          { source: 'Acme Corp', target: 'Merger', type: 'DISCUSSES', description: null, confidence: null },
          { source: 'Acme Corp', target: 'Acme Inc', type: 'IDENTITY' },
        ])
      );
    });
  });
});
