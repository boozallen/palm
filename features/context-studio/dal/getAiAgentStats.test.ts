import db from '@/server/db';
import logger from '@/server/logger';
import getAiAgentStats from './getAiAgentStats';
import { TimeRange } from '@/features/context-studio/types/context-studio';

jest.mock('@/server/db', () => ({
  $queryRaw: jest.fn(),
}));
jest.mock('@/server/logger');

jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
    })),
    raw: jest.fn((value: string) => value),
    empty: Symbol('empty'),
  },
}));

describe('getAiAgentStats', () => {
  const userGroupId = 'all';
  const userId = 'all';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic stats retrieval', () => {
    it('should fetch AI agent stats successfully', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(5) }]) // configured agents
        .mockResolvedValueOnce([{ count: BigInt(10) }]) // prism jobs
        .mockResolvedValueOnce([{ completed: BigInt(7), inProgress: BigInt(3) }]) // prism status
        .mockResolvedValueOnce([{ count: BigInt(8) }]) // odram jobs
        .mockResolvedValueOnce([{ completed: BigInt(5), inProgress: BigInt(2) }]) // odram status
        .mockResolvedValueOnce([{ count: BigInt(3) }]) // margin analyses
        .mockResolvedValueOnce([{ count: BigInt(12) }]); // unique users

      const result = await getAiAgentStats(TimeRange.Month, userGroupId, userId);

      expect(result.configured).toBe(5);
      expect(result.prismJobs).toBe(10);
      expect(result.prismCompleted).toBe(7);
      expect(result.prismInProgress).toBe(3);
      expect(result.odramJobs).toBe(8);
      expect(result.odramCompleted).toBe(5);
      expect(result.odramInProgress).toBe(2);
      expect(result.marginAnalyses).toBe(3);
      expect(result.uniqueUsers).toBe(12);
      expect(result.reportsGenerated).toBe(12); // sum of completed
    });
  });

  describe('TimeRange filtering', () => {
    it('should fetch stats for week time range', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(2) }])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ completed: BigInt(4), inProgress: BigInt(1) }])
        .mockResolvedValueOnce([{ count: BigInt(3) }])
        .mockResolvedValueOnce([{ completed: BigInt(2), inProgress: BigInt(1) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([{ count: BigInt(6) }]);

      const result = await getAiAgentStats(TimeRange.Week, userGroupId, userId);

      expect(result.configured).toBe(2);
      expect(result.reportsGenerated).toBe(6);
    });

    it('should fetch stats for forever time range', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([{ count: BigInt(50) }])
        .mockResolvedValueOnce([{ completed: BigInt(40), inProgress: BigInt(10) }])
        .mockResolvedValueOnce([{ count: BigInt(30) }])
        .mockResolvedValueOnce([{ completed: BigInt(25), inProgress: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(15) }])
        .mockResolvedValueOnce([{ count: BigInt(20) }]);

      const result = await getAiAgentStats(TimeRange.Forever, userGroupId, userId);

      expect(result.reportsGenerated).toBe(65);
    });
  });

  describe('User filtering', () => {
    it('should filter by specific user', async () => {
      const specificUserId = '123e4567-e89b-12d3-a456-426614174000';

      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(3) }])
        .mockResolvedValueOnce([{ count: BigInt(2) }])
        .mockResolvedValueOnce([{ completed: BigInt(2), inProgress: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([{ completed: BigInt(1), inProgress: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }]);

      const result = await getAiAgentStats(TimeRange.Month, userGroupId, specificUserId);

      expect(result.uniqueUsers).toBe(1);
    });

    it('should filter by user group', async () => {
      const specificUserGroupId = '123e4567-e89b-12d3-a456-426614174001';

      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(15) }])
        .mockResolvedValueOnce([{ completed: BigInt(10), inProgress: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([{ completed: BigInt(8), inProgress: BigInt(2) }])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(8) }]);

      const result = await getAiAgentStats(TimeRange.Year, specificUserGroupId, 'all');

      expect(result.prismJobs).toBe(15);
      expect(result.odramJobs).toBe(10);
    });
  });

  describe('Error handling', () => {
    it('should log error and throw when database query fails', async () => {
      const error = new Error('Database error');
      (db.$queryRaw as jest.Mock).mockRejectedValue(error);

      await expect(getAiAgentStats(TimeRange.Week, userGroupId, userId))
        .rejects.toThrow('Failed to fetch AI agent statistics');

      expect(logger.error).toHaveBeenCalledWith('Error fetching AI agent stats', { error });
    });

    it('should handle margin analysis table not found gracefully', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([{ completed: BigInt(7), inProgress: BigInt(3) }])
        .mockResolvedValueOnce([{ count: BigInt(8) }])
        .mockResolvedValueOnce([{ completed: BigInt(5), inProgress: BigInt(2) }])
        .mockRejectedValueOnce(new Error('Table not found')) // margin analyses
        .mockResolvedValueOnce([{ count: BigInt(12) }]);

      const result = await getAiAgentStats(TimeRange.Month, userGroupId, userId);

      expect(result.marginAnalyses).toBe(0);
      expect(logger.debug).toHaveBeenCalledWith('MarginAnalysis table not found, skipping margin analysis stats');
    });

    it('should handle unique users query failure gracefully', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([{ completed: BigInt(7), inProgress: BigInt(3) }])
        .mockResolvedValueOnce([{ count: BigInt(8) }])
        .mockResolvedValueOnce([{ completed: BigInt(5), inProgress: BigInt(2) }])
        .mockResolvedValueOnce([{ count: BigInt(3) }])
        .mockRejectedValueOnce(new Error('Query error')); // unique users

      const result = await getAiAgentStats(TimeRange.Month, userGroupId, userId);

      expect(result.uniqueUsers).toBe(0);
      expect(logger.debug).toHaveBeenCalledWith('Error fetching unique agent users, potentially due to missing tables');
    });
  });

  describe('Edge cases', () => {
    it('should handle zero stats', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ completed: BigInt(0), inProgress: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ completed: BigInt(0), inProgress: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }]);

      const result = await getAiAgentStats(TimeRange.Week, userGroupId, userId);

      expect(result.configured).toBe(0);
      expect(result.prismJobs).toBe(0);
      expect(result.odramJobs).toBe(0);
      expect(result.reportsGenerated).toBe(0);
    });

    it('should handle null count values', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getAiAgentStats(TimeRange.Month, userGroupId, userId);

      expect(result.configured).toBe(0);
      expect(result.reportsGenerated).toBe(0);
    });
  });
});
