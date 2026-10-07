import { getEdgesBetween } from './getEdgesBetween';
import { getGraphDatabaseSource } from '@/features/graph-database';

jest.mock('@/features/graph-database');

describe('getEdgesBetween', () => {
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

  it('should return edges between new and existing nodes', async () => {
    const mockResult = {
      records: [
        {
          get: jest.fn((field: string) => {
            const data: Record<string, any> = {
              rType: 'RELATED',
              rProps: { weight: 0.9 },
              rFromNeoId: 1,
              rToNeoId: 2,
            };
            return data[field];
          }),
        },
        {
          get: jest.fn((field: string) => {
            const data: Record<string, any> = {
              rType: 'MENTIONS',
              rProps: {},
              rFromNeoId: 1,
              rToNeoId: 3,
            };
            return data[field];
          }),
        },
      ],
    };

    mockSession.run.mockResolvedValue(mockResult);

    const result = await getEdgesBetween({
      documentIds: ['doc-1'],
      newNodeNeoIds: [1],
      existingNodeNeoIds: [2, 3],
    });

    expect(result.edges).toHaveLength(2);
    expect(result.metadata.edgeCount).toBe(2);
    expect(result.edges[0]).toEqual({
      from: 1,
      to: 2,
      label: 'RELATED',
      type: 'RELATED',
      properties: { weight: 0.9 },
    });

    const query = mockSession.run.mock.calls[0][0];
    expect(query).not.toContain('userId');
    expect(query).toContain('a.documentId IN $documentIds');
    expect(query).toContain('b.documentId IN $documentIds');

    expect(mockSession.close).toHaveBeenCalled();
  });

  it('should return empty when no new nodes provided', async () => {
    const result = await getEdgesBetween({
      documentIds: ['doc-1'],
      newNodeNeoIds: [],
      existingNodeNeoIds: [2, 3],
    });

    expect(result.edges).toHaveLength(0);
    expect(mockSession.run).not.toHaveBeenCalled();
  });

  it('should return empty when no existing nodes provided', async () => {
    const result = await getEdgesBetween({
      documentIds: ['doc-1'],
      newNodeNeoIds: [1],
      existingNodeNeoIds: [],
    });

    expect(result.edges).toHaveLength(0);
    expect(mockSession.run).not.toHaveBeenCalled();
  });

  it('should deduplicate bidirectional edges', async () => {
    const mockResult = {
      records: [
        {
          get: jest.fn((field: string) => {
            const data: Record<string, any> = {
              rType: 'RELATED',
              rProps: {},
              rFromNeoId: 1,
              rToNeoId: 2,
            };
            return data[field];
          }),
        },
        {
          get: jest.fn((field: string) => {
            const data: Record<string, any> = {
              rType: 'RELATED',
              rProps: {},
              rFromNeoId: 2,
              rToNeoId: 1,
            };
            return data[field];
          }),
        },
      ],
    };

    mockSession.run.mockResolvedValue(mockResult);

    const result = await getEdgesBetween({
      documentIds: ['doc-1'],
      newNodeNeoIds: [1],
      existingNodeNeoIds: [2],
    });

    expect(result.edges).toHaveLength(1);
  });

  it('should handle Neo4j integer objects', async () => {
    const mockResult = {
      records: [
        {
          get: jest.fn((field: string) => {
            const data: Record<string, any> = {
              rType: 'RELATED',
              rProps: {},
              rFromNeoId: { toNumber: () => 10 },
              rToNeoId: { toNumber: () => 20 },
            };
            return data[field];
          }),
        },
      ],
    };

    mockSession.run.mockResolvedValue(mockResult);

    const result = await getEdgesBetween({
      documentIds: ['doc-1'],
      newNodeNeoIds: [10],
      existingNodeNeoIds: [20],
    });

    expect(result.edges[0].from).toBe(10);
    expect(result.edges[0].to).toBe(20);
  });

  it('should always close the session', async () => {
    mockSession.run.mockRejectedValue(new Error('DB error'));

    await expect(
      getEdgesBetween({
        documentIds: ['doc-1'],
        newNodeNeoIds: [1],
        existingNodeNeoIds: [2],
      })
    ).rejects.toThrow('DB error');

    expect(mockSession.close).toHaveBeenCalled();
  });

  it('returns zero conversation edges for a document-scoped read', async () => {
    const documentIds = ['doc-1'];
    const graphEdges = [{
      type: 'REFERENCED',
      from: { labels: ['Message'], properties: { id: 'message-1' } },
      to: { labels: ['Entity'], properties: { id: 'entity-1', documentId: 'doc-1' } },
    }];
    const scopedEdges = graphEdges.filter(({ from, to }) => (
      'documentId' in from.properties
      && documentIds.includes(from.properties.documentId as string)
      && 'documentId' in to.properties
      && documentIds.includes(to.properties.documentId as string)
    ));
    mockSession.run.mockResolvedValue({
      records: scopedEdges.map(() => ({ get: jest.fn() })),
    });

    const result = await getEdgesBetween({
      documentIds,
      newNodeNeoIds: [1],
      existingNodeNeoIds: [2],
    });

    expect(result.edges).toHaveLength(0);
  });
});
