import db from '@/server/db';
import logger from '@/server/logger';
import getGraphStats from './getGraphStats';
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

describe('getGraphStats', () => {
  const userGroupId = 'all';
  const userId = 'all';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic stats retrieval', () => {
    it('should fetch graph stats successfully', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(150) }]) // entities
        .mockResolvedValueOnce([{ count: BigInt(75) }]) // concepts
        .mockResolvedValueOnce([{ count: BigInt(10) }]); // graphs built

      const result = await getGraphStats(TimeRange.Month, userGroupId, userId);

      expect(result.entities).toBe(150);
      expect(result.concepts).toBe(75);
      expect(result.graphsBuilt).toBe(10);
    });
  });

  describe('TimeRange filtering', () => {
    it('should fetch stats for week time range', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(30) }])
        .mockResolvedValueOnce([{ count: BigInt(15) }])
        .mockResolvedValueOnce([{ count: BigInt(2) }]);

      const result = await getGraphStats(TimeRange.Week, userGroupId, userId);

      expect(result.entities).toBe(30);
      expect(result.concepts).toBe(15);
      expect(result.graphsBuilt).toBe(2);
    });

    it('should fetch stats for forever time range', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(1000) }])
        .mockResolvedValueOnce([{ count: BigInt(500) }])
        .mockResolvedValueOnce([{ count: BigInt(50) }]);

      const result = await getGraphStats(TimeRange.Forever, userGroupId, userId);

      expect(result.entities).toBe(1000);
      expect(result.concepts).toBe(500);
      expect(result.graphsBuilt).toBe(50);
    });
  });

  describe('User filtering', () => {
    it('should filter by specific user', async () => {
      const specificUserId = '123e4567-e89b-12d3-a456-426614174000';

      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(20) }])
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }]);

      const result = await getGraphStats(TimeRange.Month, userGroupId, specificUserId);

      expect(result.entities).toBe(20);
      expect(result.concepts).toBe(10);
      expect(result.graphsBuilt).toBe(1);
    });

    it('should filter by user group', async () => {
      const specificUserGroupId = '123e4567-e89b-12d3-a456-426614174001';

      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(100) }])
        .mockResolvedValueOnce([{ count: BigInt(50) }])
        .mockResolvedValueOnce([{ count: BigInt(5) }]);

      const result = await getGraphStats(TimeRange.Year, specificUserGroupId, 'all');

      expect(result.entities).toBe(100);
      expect(result.concepts).toBe(50);
      expect(result.graphsBuilt).toBe(5);
    });
  });

  describe('Error handling', () => {
    it('should log error and throw when database query fails', async () => {
      const error = new Error('Database error');
      (db.$queryRaw as jest.Mock).mockRejectedValue(error);

      await expect(getGraphStats(TimeRange.Week, userGroupId, userId))
        .rejects.toThrow('Failed to fetch graph statistics');

      expect(logger.error).toHaveBeenCalledWith('Error fetching graph stats', { error });
    });
  });

  describe('Edge cases', () => {
    it('should handle zero graph data', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }]);

      const result = await getGraphStats(TimeRange.Week, userGroupId, userId);

      expect(result.entities).toBe(0);
      expect(result.concepts).toBe(0);
      expect(result.graphsBuilt).toBe(0);
    });

    it('should handle null count values', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getGraphStats(TimeRange.Month, userGroupId, userId);

      expect(result.entities).toBe(0);
      expect(result.concepts).toBe(0);
      expect(result.graphsBuilt).toBe(0);
    });
  });
});
