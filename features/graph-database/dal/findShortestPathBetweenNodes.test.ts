import { findShortestPathBetweenNodes } from '@/features/graph-database/dal/findShortestPathBetweenNodes';
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

/** Neo4j record whose .get(field) reads from a plain object. */
const record = (data: Record<string, unknown>) => ({ get: (key: string) => data[key] });

describe('findShortestPathBetweenNodes', () => {
  const mockGraphDb = { run: jest.fn(), getSession: jest.fn() };
  const mockSession = { run: jest.fn(), close: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    jest.clearAllMocks();
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue(mockGraphDb);
    mockGraphDb.getSession.mockResolvedValue(mockSession);
    // Default: no clusters — every node maps only to itself.
    mockExpandIdentityClusters.mockResolvedValue(new Map());
  });

  it('maps Neo4j internal ids to id properties before calling expandIdentityClusters', async () => {
    mockGraphDb.run.mockImplementation(async (query: string) => {
      if (query.includes('id(n) AS neoId, n.id AS nodeId')) {
        return {
          records: [
            record({ neoId: 1, nodeId: 'e1' }),
            record({ neoId: 2, nodeId: 'e2' }),
          ],
        };
      }
      return { records: [] };
    });
    mockSession.run.mockResolvedValue({ records: [] });

    await findShortestPathBetweenNodes({ documentIds: ['doc-1'], nodeNeoIds: [1, 2] });

    expect(mockExpandIdentityClusters).toHaveBeenCalledWith(
      expect.arrayContaining(['e1', 'e2']),
      ['doc-1']
    );
  });

  it('expands the search to every cluster member and maps back to Neo4j ids', async () => {
    mockGraphDb.run.mockImplementation(async (query: string) => {
      if (query.includes('id(n) AS neoId, n.id AS nodeId')) {
        return {
          records: [record({ neoId: 1, nodeId: 'e1' }), record({ neoId: 2, nodeId: 'e2' })],
        };
      }
      if (query.includes('n.id IN $nodeIds RETURN n.id AS nodeId, id(n) AS neoId')) {
        // e1's cluster also contains e1b, which lives at Neo4j internal id 99
        return {
          records: [
            record({ nodeId: 'e1', neoId: 1 }),
            record({ nodeId: 'e1b', neoId: 99 }),
            record({ nodeId: 'e2', neoId: 2 }),
          ],
        };
      }
      return { records: [] };
    });
    mockExpandIdentityClusters.mockResolvedValue(
      new Map([
        ['e1', ['e1', 'e1b']],
        ['e2', ['e2']],
      ])
    );
    mockSession.run.mockResolvedValue({ records: [] });

    await findShortestPathBetweenNodes({ documentIds: ['doc-1'], nodeNeoIds: [1, 2] });

    const [, params] = mockSession.run.mock.calls[0];
    expect(params.startNeoIds.sort()).toEqual([1, 99]);
    expect(params.endNeoIds).toEqual([2]);
  });

  it('falls back to searching just the original node when it has no cluster mapping', async () => {
    mockGraphDb.run.mockResolvedValue({ records: [] }); // id-resolution query finds nothing
    mockSession.run.mockResolvedValue({ records: [] });

    await findShortestPathBetweenNodes({ documentIds: ['doc-1'], nodeNeoIds: [1, 2] });

    const [, params] = mockSession.run.mock.calls[0];
    expect(params.startNeoIds).toEqual([1]);
    expect(params.endNeoIds).toEqual([2]);
  });

  it('reports a no-path pair using the original requested neo ids, not expanded ones', async () => {
    mockGraphDb.run.mockResolvedValue({ records: [] });
    mockSession.run.mockResolvedValue({ records: [] });

    const result = await findShortestPathBetweenNodes({ documentIds: ['doc-1'], nodeNeoIds: [1, 2] });

    expect(result.paths).toEqual([]);
    expect(result.noPathPairs).toEqual([{ startNeoId: 1, endNeoId: 2 }]);
  });

  it('excludes conversation relationships from both shortest-path traversals', async () => {
    mockGraphDb.run.mockResolvedValue({ records: [] });
    mockSession.run.mockImplementation(async (query: string) => {
      const hasConversationDenylist = query.includes('none(r IN relationships(p) WHERE type(r) IN')
        && ['REFERENCED', 'IN_CHAT', 'PRODUCED', 'IN_CLUSTER'].every((relationshipType) =>
          query.includes(`'${relationshipType}'`)
        );

      if (hasConversationDenylist) {
        return { records: [] };
      }

      return {
        records: [record({ pathNodes: [{ neoId: 1 }], pathEdges: [{ type: 'REFERENCED' }] })],
      };
    });

    const result = await findShortestPathBetweenNodes({ documentIds: ['doc-1'], nodeNeoIds: [1, 2] });

    expect(mockSession.run).toHaveBeenCalledTimes(2);
    for (const [query] of mockSession.run.mock.calls) {
      expect(query).toContain('none(r IN relationships(p) WHERE type(r) IN');
      expect(query).toContain('\'REFERENCED\'');
      expect(query).toContain('\'IN_CHAT\'');
      expect(query).toContain('\'PRODUCED\'');
      expect(query).toContain('\'IN_CLUSTER\'');
    }
    expect(result.paths).toEqual([]);
    expect(result.noPathPairs).toEqual([{ startNeoId: 1, endNeoId: 2 }]);
  });

  it('parses a found path into deduplicated nodes and edges', async () => {
    mockGraphDb.run.mockResolvedValue({ records: [] });
    mockSession.run.mockResolvedValueOnce({
      records: [
        record({
          pathNodes: [
            { neoId: 1, labels: ['Entity'], properties: { name: 'A' } },
            { neoId: 2, labels: ['Entity'], properties: { name: 'B' } },
          ],
          pathEdges: [
            { fromNeoId: 1, toNeoId: 2, type: 'RELATED', properties: {} },
          ],
        }),
      ],
    });

    const result = await findShortestPathBetweenNodes({ documentIds: ['doc-1'], nodeNeoIds: [1, 2] });

    expect(result.noPathPairs).toEqual([]);
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0]).toMatchObject({ startNeoId: 1, endNeoId: 2 });
    expect(result.paths[0].nodes).toHaveLength(2);
    expect(result.paths[0].edges).toHaveLength(1);
  });
});
