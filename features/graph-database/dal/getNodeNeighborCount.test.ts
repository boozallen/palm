import { getNodeNeighborCount } from './getNodeNeighborCount';
import { getGraphDatabaseSource } from '@/features/graph-database';

jest.mock('@/features/graph-database');

describe('getNodeNeighborCount', () => {
  const mockSession = {
    run: jest.fn(),
    close: jest.fn(),
  };

  const mockGraphDb = {
    getSession: jest.fn(() => mockSession),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue(mockGraphDb);
  });

  it('should return count of neighbors for a node', async () => {
    const mockResult = {
      records: [
        {
          get: jest.fn((field: string) => {
            if (field === 'totalNeighbors') {
              return 5;
            }
            return null;
          }),
        },
      ],
    };

    mockSession.run.mockResolvedValue(mockResult);

    const result = await getNodeNeighborCount({
      documentIds: ['doc-1', 'doc-2'],
      nodeNeoId: 100,
    });

    expect(result.totalNeighbors).toBe(5);
    expect(mockSession.run).toHaveBeenCalledWith(
      expect.stringContaining('count(DISTINCT neighbor)'),
      {
        documentIds: ['doc-1', 'doc-2'],
        nodeNeoId: 100,
      }
    );
    expect(mockSession.close).toHaveBeenCalled();
  });

  it('should handle Neo4j integer objects', async () => {
    const mockNeo4jInt = {
      toNumber: () => 10,
    };

    const mockResult = {
      records: [
        {
          get: jest.fn(() => mockNeo4jInt),
        },
      ],
    };

    mockSession.run.mockResolvedValue(mockResult);

    const result = await getNodeNeighborCount({
      documentIds: ['doc-1'],
      nodeNeoId: 200,
    });

    expect(result.totalNeighbors).toBe(10);
  });

  it('should return 0 when node has no neighbors', async () => {
    const mockResult = {
      records: [],
    };

    mockSession.run.mockResolvedValue(mockResult);

    const result = await getNodeNeighborCount({
      documentIds: ['doc-1'],
      nodeNeoId: 300,
    });

    expect(result.totalNeighbors).toBe(0);
  });

  it('should not include userId predicates (read paths are authorized by documentIds)', async () => {
    mockSession.run.mockResolvedValue({ records: [] });

    await getNodeNeighborCount({
      documentIds: ['doc-1'],
      nodeNeoId: 400,
    });

    const query = mockSession.run.mock.calls[0][0];
    expect(query).not.toContain('userId');
  });

  it('should close session even if query fails', async () => {
    mockSession.run.mockRejectedValue(new Error('Query failed'));

    await expect(
      getNodeNeighborCount({
        documentIds: ['doc-1'],
        nodeNeoId: 500,
      })
    ).rejects.toThrow('Query failed');

    expect(mockSession.close).toHaveBeenCalled();
  });

  it('should filter by documentIds', async () => {
    mockSession.run.mockResolvedValue({ records: [] });

    await getNodeNeighborCount({
      documentIds: ['doc-1', 'doc-2', 'doc-3'],
      nodeNeoId: 600,
    });

    const query = mockSession.run.mock.calls[0][0];
    expect(query).toContain('source.documentId IN $documentIds');
    expect(query).toContain('neighbor.documentId IN $documentIds');
  });

  it('counts zero conversation neighbors for a document-scoped read', async () => {
    const documentIds = ['doc-1'];
    const graphNeighbors = [
      { labels: ['Message'], properties: { id: 'message-1' } },
    ];
    const scopedNeighbors = graphNeighbors.filter(({ properties }) => (
      'documentId' in properties && documentIds.includes(properties.documentId as string)
    ));
    mockSession.run.mockResolvedValue({
      records: [{
        get: () => scopedNeighbors.length,
      }],
    });

    const result = await getNodeNeighborCount({ documentIds, nodeNeoId: 100 });

    expect(result.totalNeighbors).toBe(0);
  });
});
