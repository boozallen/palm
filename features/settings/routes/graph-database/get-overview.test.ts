import { UserRole } from '@/features/shared/types/user';
import { ContextType } from '@/server/trpc-context';
import settingsRouter from '@/features/settings/routes';
import { getGraphDatabaseSource } from '@/features/graph-database';

jest.mock('@/features/graph-database');

describe('getOverview route', () => {
  let ctx: ContextType;
  
  const mockSession = {
    run: jest.fn(),
    close: jest.fn(),
  };

  const mockGraphDb = {
    getSession: jest.fn().mockResolvedValue(mockSession),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userRole: UserRole.Admin,
      logger: {
        debug: jest.fn(),
      },
    } as unknown as ContextType;

    (getGraphDatabaseSource as jest.Mock).mockResolvedValue(mockGraphDb);

    // Mock the different query results
    mockSession.run
      .mockResolvedValueOnce({
        records: [{ get: () => ({ toNumber: () => 150 }) }], // totalNodes
      })
      .mockResolvedValueOnce({
        records: [{ get: () => ({ toNumber: () => 75 }) }], // totalRelationships
      })
      .mockResolvedValueOnce({
        records: [
          {
            get: (key: string) => {
              if (key === 'nodeLabels') {
                return ['Document'];
              }
              if (key === 'nodeCount') {
                return { toNumber: () => 100 };
              }
              return null;
            },
          },
          {
            get: (key: string) => {
              if (key === 'nodeLabels') {
                return ['Entity'];
              }
              if (key === 'nodeCount') {
                return { toNumber: () => 50 };
              }
              return null;
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        records: [
          {
            get: (key: string) => {
              if (key === 'relationshipType') {
                return 'CONTAINS';
              }
              if (key === 'relationshipCount') {
                return { toNumber: () => 45 };
              }
              return null;
            },
          },
          {
            get: (key: string) => {
              if (key === 'relationshipType') {
                return 'RELATES_TO';
              }
              if (key === 'relationshipCount') {
                return { toNumber: () => 30 };
              }
              return null;
            },
          },
        ],
      });
  });

  it('should return overview statistics for admin user', async () => {
    const caller = settingsRouter.createCaller(ctx);

    const result = await caller.graphDatabase.getOverview();

    expect(result.success).toBe(true);
    expect(result.overview).toEqual({
      totalNodes: 150,
      totalRelationships: 75,
      nodeTypes: [
        { labels: ['Document'], count: 100 },
        { labels: ['Entity'], count: 50 },
      ],
      relationshipTypes: [
        { type: 'CONTAINS', count: 45 },
        { type: 'RELATES_TO', count: 30 },
      ],
    });
    expect(getGraphDatabaseSource).toHaveBeenCalledTimes(1);
    expect(mockSession.close).toHaveBeenCalledTimes(1);
    expect(mockSession.run).toHaveBeenCalledTimes(4);
  });

  it('should throw an error if user is not an admin', async () => {
    ctx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.graphDatabase.getOverview()).rejects.toThrow(
      'You do not have permission to access this resource'
    );

    expect(getGraphDatabaseSource).not.toHaveBeenCalled();
    expect(mockSession.run).not.toHaveBeenCalled();
  });

  it('should handle empty database gracefully', async () => {
    // Reset mocks for empty database scenario
    mockSession.run.mockReset();
    mockSession.run
      .mockResolvedValueOnce({
        records: [{ get: () => 0 }], // totalNodes
      })
      .mockResolvedValueOnce({
        records: [{ get: () => 0 }], // totalRelationships
      })
      .mockResolvedValueOnce({
        records: [], // nodeTypes
      })
      .mockResolvedValueOnce({
        records: [], // relationshipTypes
      });

    const caller = settingsRouter.createCaller(ctx);

    const result = await caller.graphDatabase.getOverview();

    expect(result.success).toBe(true);
    expect(result.overview).toEqual({
      totalNodes: 0,
      totalRelationships: 0,
      nodeTypes: [],
      relationshipTypes: [],
    });
  });

  it('should handle non-integer counts correctly', async () => {
    // Test with regular numbers (not Neo4j integer objects)
    mockSession.run.mockReset();
    mockSession.run
      .mockResolvedValueOnce({
        records: [{ get: () => 100 }], // totalNodes as regular number
      })
      .mockResolvedValueOnce({
        records: [{ get: () => 50 }], // totalRelationships as regular number
      })
      .mockResolvedValueOnce({
        records: [
          {
            get: (key: string) => {
              if (key === 'nodeLabels') {
                return ['Test'];
              }
              if (key === 'nodeCount') {
                return 25; // regular number
              }
              return null;
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        records: [
          {
            get: (key: string) => {
              if (key === 'relationshipType') {
                return 'TEST_REL';
              }
              if (key === 'relationshipCount') {
                return 15; // regular number
              }
              return null;
            },
          },
        ],
      });

    const caller = settingsRouter.createCaller(ctx);

    const result = await caller.graphDatabase.getOverview();

    expect(result.overview.totalNodes).toBe(100);
    expect(result.overview.totalRelationships).toBe(50);
    expect(result.overview.nodeTypes[0].count).toBe(25);
    expect(result.overview.relationshipTypes[0].count).toBe(15);
  });
});
