import { getGraphDatabaseSource } from '@/features/graph-database';
import getOverview from './getOverview';

jest.mock('@/features/graph-database', () => ({
  getGraphDatabaseSource: jest.fn(),
}));

const mockSession = {
  run: jest.fn(),
  close: jest.fn(),
};

const mockGraphSource = {
  getSession: jest.fn().mockResolvedValue(mockSession),
};

(getGraphDatabaseSource as jest.Mock).mockResolvedValue(mockGraphSource);

const makeMockRecord = (data: Record<string, unknown>) => ({
  get: (key: string) => data[key],
});

describe('getOverview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue(mockGraphSource);
    mockGraphSource.getSession.mockResolvedValue(mockSession);
  });

  it('should return overview statistics', async () => {
    mockSession.run
      .mockResolvedValueOnce({ records: [makeMockRecord({ totalNodes: 100 })] })
      .mockResolvedValueOnce({ records: [makeMockRecord({ totalRelationships: 50 })] })
      .mockResolvedValueOnce({
        records: [
          makeMockRecord({ nodeLabels: ['Person'], nodeCount: 60 }),
          makeMockRecord({ nodeLabels: ['Company'], nodeCount: 40 }),
        ],
      })
      .mockResolvedValueOnce({
        records: [
          makeMockRecord({ relationshipType: 'WORKS_AT', relationshipCount: 30 }),
          makeMockRecord({ relationshipType: 'KNOWS', relationshipCount: 20 }),
        ],
      });

    const result = await getOverview();

    expect(result).toEqual({
      totalNodes: 100,
      totalRelationships: 50,
      nodeTypes: [
        { labels: ['Person'], count: 60 },
        { labels: ['Company'], count: 40 },
      ],
      relationshipTypes: [
        { type: 'WORKS_AT', count: 30 },
        { type: 'KNOWS', count: 20 },
      ],
    });
    expect(mockSession.run).toHaveBeenCalledTimes(4);
    expect(mockSession.close).toHaveBeenCalled();
  });

  it('should handle Neo4j Integer objects with toNumber()', async () => {
    mockSession.run
      .mockResolvedValueOnce({ records: [makeMockRecord({ totalNodes: { toNumber: () => 100 } })] })
      .mockResolvedValueOnce({ records: [makeMockRecord({ totalRelationships: { toNumber: () => 50 } })] })
      .mockResolvedValueOnce({
        records: [makeMockRecord({ nodeLabels: ['Person'], nodeCount: { toNumber: () => 100 } })],
      })
      .mockResolvedValueOnce({
        records: [makeMockRecord({ relationshipType: 'KNOWS', relationshipCount: { toNumber: () => 50 } })],
      });

    const result = await getOverview();

    expect(result.totalNodes).toBe(100);
    expect(result.totalRelationships).toBe(50);
    expect(result.nodeTypes[0].count).toBe(100);
    expect(result.relationshipTypes[0].count).toBe(50);
  });

  it('should return empty arrays when no nodes or relationships exist', async () => {
    mockSession.run
      .mockResolvedValueOnce({ records: [makeMockRecord({ totalNodes: 0 })] })
      .mockResolvedValueOnce({ records: [makeMockRecord({ totalRelationships: 0 })] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    const result = await getOverview();

    expect(result).toEqual({
      totalNodes: 0,
      totalRelationships: 0,
      nodeTypes: [],
      relationshipTypes: [],
    });
  });

  it('should close the session even if a query fails', async () => {
    mockSession.run.mockRejectedValue(new Error('Neo4j error'));

    await expect(getOverview()).rejects.toThrow('Error fetching graph overview data');

    expect(mockSession.close).toHaveBeenCalled();
  });

  it('should default to 0 when node count record is missing', async () => {
    mockSession.run
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    const result = await getOverview();

    expect(result.totalNodes).toBe(0);
    expect(result.totalRelationships).toBe(0);
  });
});
