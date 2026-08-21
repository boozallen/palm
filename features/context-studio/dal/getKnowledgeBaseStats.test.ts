import db from '@/server/db';
import logger from '@/server/logger';
import getKnowledgeBaseStats from './getKnowledgeBaseStats';
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

describe('getKnowledgeBaseStats', () => {
  const userGroupId = 'all';
  const userId = 'all';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic stats retrieval', () => {
    it('should fetch knowledge base stats successfully', async () => {
      (db.$queryRaw as jest.Mock).mockResolvedValueOnce([{ count: BigInt(25) }]);

      const result = await getKnowledgeBaseStats(TimeRange.Month, userGroupId, userId);

      expect(result.total).toBe(25);
    });
  });

  describe('TimeRange filtering', () => {
    it('should fetch stats for week time range', async () => {
      (db.$queryRaw as jest.Mock).mockResolvedValueOnce([{ count: BigInt(5) }]);

      const result = await getKnowledgeBaseStats(TimeRange.Week, userGroupId, userId);

      expect(result.total).toBe(5);
    });

    it('should fetch stats for forever time range', async () => {
      (db.$queryRaw as jest.Mock).mockResolvedValueOnce([{ count: BigInt(100) }]);

      const result = await getKnowledgeBaseStats(TimeRange.Forever, userGroupId, userId);

      expect(result.total).toBe(100);
    });
  });

  describe('User filtering', () => {
    it('should filter by specific user', async () => {
      const specificUserId = '123e4567-e89b-12d3-a456-426614174000';

      (db.$queryRaw as jest.Mock).mockResolvedValueOnce([{ count: BigInt(3) }]);

      const result = await getKnowledgeBaseStats(TimeRange.Month, userGroupId, specificUserId);

      expect(result.total).toBe(3);
    });

    it('should filter by user group', async () => {
      const specificUserGroupId = '123e4567-e89b-12d3-a456-426614174001';

      (db.$queryRaw as jest.Mock).mockResolvedValueOnce([{ count: BigInt(15) }]);

      const result = await getKnowledgeBaseStats(TimeRange.Year, specificUserGroupId, 'all');

      expect(result.total).toBe(15);
    });
  });

  describe('Error handling', () => {
    it('should log error and throw when database query fails', async () => {
      const error = new Error('Database error');
      (db.$queryRaw as jest.Mock).mockRejectedValue(error);

      await expect(getKnowledgeBaseStats(TimeRange.Week, userGroupId, userId))
        .rejects.toThrow('Failed to fetch knowledge base statistics');

      expect(logger.error).toHaveBeenCalledWith('Error fetching knowledge base stats', { error });
    });
  });

  describe('Edge cases', () => {
    it('should handle zero knowledge bases', async () => {
      (db.$queryRaw as jest.Mock).mockResolvedValueOnce([{ count: BigInt(0) }]);

      const result = await getKnowledgeBaseStats(TimeRange.Week, userGroupId, userId);

      expect(result.total).toBe(0);
    });

    it('should handle null count values', async () => {
      (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

      const result = await getKnowledgeBaseStats(TimeRange.Month, userGroupId, userId);

      expect(result.total).toBe(0);
    });
  });
});
