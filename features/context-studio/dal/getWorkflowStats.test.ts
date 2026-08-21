import db from '@/server/db';
import logger from '@/server/logger';
import getWorkflowStats from './getWorkflowStats';
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

describe('getWorkflowStats', () => {
  const userGroupId = 'all';
  const userId = 'all';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic stats retrieval', () => {
    it('should fetch workflow stats successfully', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(50) }]) // workflows
        .mockResolvedValueOnce([{ count: BigInt(10) }]) // shared
        .mockResolvedValueOnce([{ count: BigInt(7) }]) // accepted
        .mockResolvedValueOnce([{ count: BigInt(2) }]) // rejected
        .mockResolvedValueOnce([
          {
            total: BigInt(100),
            successful: BigInt(80),
            failed: BigInt(15),
            paused: BigInt(3),
            cancelled: BigInt(2),
          },
        ]); // executions

      const result = await getWorkflowStats(TimeRange.Month, userGroupId, userId);

      expect(result.total).toBe(50);
      expect(result.shared).toBe(10);
      expect(result.accepted).toBe(7);
      expect(result.rejected).toBe(2);
      expect(result.executions).toBe(100);
      expect(result.successful).toBe(80);
      expect(result.failed).toBe(15);
      expect(result.paused).toBe(3);
      expect(result.cancelled).toBe(2);
    });
  });

  describe('TimeRange filtering', () => {
    it('should fetch stats for week time range', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([{ count: BigInt(2) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([
          {
            total: BigInt(20),
            successful: BigInt(18),
            failed: BigInt(1),
            paused: BigInt(1),
            cancelled: BigInt(0),
          },
        ]);

      const result = await getWorkflowStats(TimeRange.Week, userGroupId, userId);

      expect(result.total).toBe(10);
      expect(result.executions).toBe(20);
    });

    it('should fetch stats for forever time range', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(500) }])
        .mockResolvedValueOnce([{ count: BigInt(50) }])
        .mockResolvedValueOnce([{ count: BigInt(40) }])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([
          {
            total: BigInt(1000),
            successful: BigInt(900),
            failed: BigInt(80),
            paused: BigInt(15),
            cancelled: BigInt(5),
          },
        ]);

      const result = await getWorkflowStats(TimeRange.Forever, userGroupId, userId);

      expect(result.total).toBe(500);
      expect(result.executions).toBe(1000);
    });
  });

  describe('User filtering', () => {
    it('should filter by specific user', async () => {
      const specificUserId = '123e4567-e89b-12d3-a456-426614174000';

      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([
          {
            total: BigInt(10),
            successful: BigInt(9),
            failed: BigInt(1),
            paused: BigInt(0),
            cancelled: BigInt(0),
          },
        ]);

      const result = await getWorkflowStats(TimeRange.Month, userGroupId, specificUserId);

      expect(result.total).toBe(5);
    });

    it('should filter by user group', async () => {
      const specificUserGroupId = '123e4567-e89b-12d3-a456-426614174001';

      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(30) }])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(4) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([
          {
            total: BigInt(60),
            successful: BigInt(55),
            failed: BigInt(4),
            paused: BigInt(1),
            cancelled: BigInt(0),
          },
        ]);

      const result = await getWorkflowStats(TimeRange.Year, specificUserGroupId, 'all');

      expect(result.total).toBe(30);
    });
  });

  describe('Error handling', () => {
    it('should log error and throw when database query fails', async () => {
      const error = new Error('Database error');
      (db.$queryRaw as jest.Mock).mockRejectedValue(error);

      await expect(getWorkflowStats(TimeRange.Week, userGroupId, userId))
        .rejects.toThrow('Failed to fetch workflow statistics');

      expect(logger.error).toHaveBeenCalledWith('Error fetching workflow stats', { error });
    });

    it('should handle shared workflow tables not found gracefully', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(50) }]) // workflows
        .mockRejectedValueOnce(new Error('Table not found')) // shared
        .mockRejectedValueOnce(new Error('Table not found')) // accepted
        .mockRejectedValueOnce(new Error('Table not found')) // rejected
        .mockResolvedValueOnce([
          {
            total: BigInt(100),
            successful: BigInt(80),
            failed: BigInt(15),
            paused: BigInt(3),
            cancelled: BigInt(2),
          },
        ]);

      const result = await getWorkflowStats(TimeRange.Month, userGroupId, userId);

      expect(result.total).toBe(50);
      expect(result.shared).toBe(0);
      expect(result.accepted).toBe(0);
      expect(result.rejected).toBe(0);
      expect(logger.debug).toHaveBeenCalledWith('SharedWorkflow tables not found, skipping workflow share stats');
    });
  });

  describe('Edge cases', () => {
    it('should handle zero workflows', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([
          {
            total: BigInt(0),
            successful: BigInt(0),
            failed: BigInt(0),
            paused: BigInt(0),
            cancelled: BigInt(0),
          },
        ]);

      const result = await getWorkflowStats(TimeRange.Week, userGroupId, userId);

      expect(result.total).toBe(0);
      expect(result.executions).toBe(0);
    });

    it('should handle null count values', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getWorkflowStats(TimeRange.Month, userGroupId, userId);

      expect(result.total).toBe(0);
      expect(result.executions).toBe(0);
    });
  });
});
