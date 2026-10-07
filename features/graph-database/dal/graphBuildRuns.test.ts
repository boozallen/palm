import {
  createBuildRun,
  completeBuildRun,
  failBuildRun,
  cancelBuildRun,
  cancelRunningBuildRunsForGraph,
  getBuildRunsForGraph,
  getLatestBuildRun,
  getBuildRunsForUser,
  countRunsWithWarnings,
} from '@/features/graph-database/dal/graphBuildRuns';

// Mock the Prisma client
jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    graphBuildRun: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

// Mock the logger
jest.mock('@/server/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import db from '@/server/db';

const mockDb = db as jest.Mocked<typeof db>;

describe('graphBuildRuns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createBuildRun', () => {
    it('should create a build run and return the ID', async () => {
      const mockRunId = 'test-run-id-1234';
      (mockDb.graphBuildRun.create as jest.Mock).mockResolvedValue({
        id: mockRunId,
      });

      const result = await createBuildRun({
        graphId: 'graph-123',
        userId: 'user-456',
        runType: 'extraction',
        documentIds: ['doc-1', 'doc-2'],
        isIncremental: false,
        newDocumentIds: ['doc-1', 'doc-2'],
        existingDocumentIds: [],
      });

      expect(result).toBe(mockRunId);
      expect(mockDb.graphBuildRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          graphId: 'graph-123',
          userId: 'user-456',
          runType: 'extraction',
          status: 'running',
        }),
      });
    });

    it('should throw on database error', async () => {
      (mockDb.graphBuildRun.create as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(createBuildRun({
        graphId: 'graph-123',
        userId: 'user-456',
        runType: 'extraction',
        documentIds: [],
        isIncremental: false,
        newDocumentIds: [],
        existingDocumentIds: [],
      })).rejects.toThrow('Failed to create build run');
    });
  });

  describe('completeBuildRun', () => {
    it('should update run with stats and warnings', async () => {
      const startTime = new Date(Date.now() - 5000);
      (mockDb.graphBuildRun.findUnique as jest.Mock).mockResolvedValue({
        startedAt: startTime,
      });
      (mockDb.graphBuildRun.update as jest.Mock).mockResolvedValue({});

      const mockStats = {
        chunksProcessed: 10,
        entitiesCreated: 5,
        entitiesMerged: 2,
        conceptsCreated: 3,
        relationshipsCreated: 4,
        byDocument: {},
      };

      await completeBuildRun({
        runId: 'run-123',
        stats: mockStats,
        warnings: [],
      });

      expect(mockDb.graphBuildRun.update).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        data: expect.objectContaining({
          status: 'completed',
          stats: mockStats,
          warnings: [],
        }),
      });
    });

    it('should throw if run not found', async () => {
      (mockDb.graphBuildRun.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(completeBuildRun({
        runId: 'nonexistent',
        stats: {
          chunksProcessed: 0,
          entitiesCreated: 0,
          entitiesMerged: 0,
          conceptsCreated: 0,
          relationshipsCreated: 0,
          byDocument: {},
        },
        warnings: [],
      })).rejects.toThrow('Failed to complete build run');
    });
  });

  describe('failBuildRun', () => {
    it('should update run with failed status and error message', async () => {
      const startTime = new Date(Date.now() - 5000);
      (mockDb.graphBuildRun.findUnique as jest.Mock).mockResolvedValue({
        startedAt: startTime,
      });
      (mockDb.graphBuildRun.update as jest.Mock).mockResolvedValue({});

      await failBuildRun('run-123', 'Something went wrong');

      expect(mockDb.graphBuildRun.update).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: 'Something went wrong',
        }),
      });
    });

    it('should not throw on update error (error handling code)', async () => {
      (mockDb.graphBuildRun.findUnique as jest.Mock).mockRejectedValue(new Error('DB error'));

      // Should not throw
      await failBuildRun('run-123', 'Error message');
    });
  });

  describe('cancelBuildRun', () => {
    it('should update run with cancelled status and error message', async () => {
      const startTime = new Date(Date.now() - 5000);
      (mockDb.graphBuildRun.findUnique as jest.Mock).mockResolvedValue({
        startedAt: startTime,
      });
      (mockDb.graphBuildRun.update as jest.Mock).mockResolvedValue({});

      await cancelBuildRun('run-123');

      expect(mockDb.graphBuildRun.update).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        data: expect.objectContaining({
          status: 'cancelled',
          errorMessage: 'Build cancelled by user',
        }),
      });
    });

    it('should not throw on update error (error handling code)', async () => {
      (mockDb.graphBuildRun.findUnique as jest.Mock).mockRejectedValue(new Error('DB error'));

      await cancelBuildRun('run-123');
    });
  });

  describe('cancelRunningBuildRunsForGraph', () => {
    it('should sweep only running rows of that graph to cancelled', async () => {
      (mockDb.graphBuildRun.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

      await cancelRunningBuildRunsForGraph('graph-123');

      expect(mockDb.graphBuildRun.updateMany).toHaveBeenCalledWith({
        where: { graphId: 'graph-123', status: 'running' },
        data: expect.objectContaining({
          status: 'cancelled',
          errorMessage: 'Build cancelled by user',
        }),
      });
    });

    it('should not throw on update error (error handling code)', async () => {
      (mockDb.graphBuildRun.updateMany as jest.Mock).mockRejectedValue(new Error('DB error'));

      await cancelRunningBuildRunsForGraph('graph-123');
    });
  });

  describe('getBuildRunsForGraph', () => {
    it('should return formatted build runs', async () => {
      const mockRuns = [
        {
          id: 'run-1',
          runType: 'extraction',
          isIncremental: false,
          startedAt: new Date(),
          completedAt: new Date(),
          durationMs: 5000,
          status: 'completed',
          stats: { chunksProcessed: 10 },
          warnings: [{ code: 'LOW_ENTITY_COUNT', severity: 'info', message: 'test', details: {} }],
          errorMessage: null,
        },
      ];
      (mockDb.graphBuildRun.findMany as jest.Mock).mockResolvedValue(mockRuns);

      const result = await getBuildRunsForGraph('graph-123', 10);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('run-1');
      expect(result[0].warnings[0].code).toBe('LOW_ENTITY_COUNT');
    });
  });

  describe('getLatestBuildRun', () => {
    it('should return the latest run of specified type', async () => {
      const mockRun = {
        id: 'run-1',
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 5000,
        status: 'completed',
        stats: { chunksProcessed: 10 },
        warnings: [],
      };
      (mockDb.graphBuildRun.findFirst as jest.Mock).mockResolvedValue(mockRun);

      const result = await getLatestBuildRun('graph-123', 'extraction');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('run-1');
      expect(mockDb.graphBuildRun.findFirst).toHaveBeenCalledWith({
        where: { graphId: 'graph-123', runType: 'extraction' },
        orderBy: { startedAt: 'desc' },
        select: expect.any(Object),
      });
    });

    it('should return null if no run found', async () => {
      (mockDb.graphBuildRun.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await getLatestBuildRun('graph-123', 'extraction');

      expect(result).toBeNull();
    });
  });

  describe('getBuildRunsForUser', () => {
    it('should return user runs with warnings count', async () => {
      const mockRuns = [
        {
          id: 'run-1',
          graphId: 'graph-123',
          runType: 'extraction',
          isIncremental: false,
          startedAt: new Date(),
          completedAt: new Date(),
          status: 'completed',
          warnings: [{ code: 'test' }, { code: 'test2' }],
        },
      ];
      (mockDb.graphBuildRun.findMany as jest.Mock).mockResolvedValue(mockRuns);

      const result = await getBuildRunsForUser('user-123');

      expect(result.length).toBe(1);
      expect(result[0].warningsCount).toBe(2);
    });
  });

  describe('countRunsWithWarnings', () => {
    it('should count runs with warnings above threshold', async () => {
      const mockRuns = [
        { warnings: [{ code: 'w1' }, { code: 'w2' }] },
        { warnings: [] },
        { warnings: [{ code: 'w1' }] },
      ];
      (mockDb.graphBuildRun.findMany as jest.Mock).mockResolvedValue(mockRuns);

      const result = await countRunsWithWarnings('graph-123', 1);

      expect(result).toBe(2); // Two runs have >= 1 warning
    });

    it('should return 0 when no runs have warnings', async () => {
      (mockDb.graphBuildRun.findMany as jest.Mock).mockResolvedValue([
        { warnings: [] },
        { warnings: [] },
      ]);

      const result = await countRunsWithWarnings('graph-123');

      expect(result).toBe(0);
    });
  });
});
