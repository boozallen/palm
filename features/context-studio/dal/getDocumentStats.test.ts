import db from '@/server/db';
import logger from '@/server/logger';
import getDocumentStats from './getDocumentStats';
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

describe('getDocumentStats', () => {
  const userGroupId = 'all';
  const userId = 'all';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic stats retrieval', () => {
    it('should fetch document stats successfully', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(100) }]) // documents
        .mockResolvedValueOnce([{ count: BigInt(10) }]) // shared
        .mockResolvedValueOnce([{ count: BigInt(7) }]) // accepted
        .mockResolvedValueOnce([{ count: BigInt(2) }]) // rejected
        .mockResolvedValueOnce([{ count: BigInt(500) }]); // embeddings

      const result = await getDocumentStats(TimeRange.Month, userGroupId, userId);

      expect(result.total).toBe(100);
      expect(result.shared).toBe(10);
      expect(result.accepted).toBe(7);
      expect(result.rejected).toBe(2);
      expect(result.embeddings.total).toBe(500);
    });
  });

  describe('TimeRange filtering', () => {
    it('should fetch stats for week time range', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(20) }])
        .mockResolvedValueOnce([{ count: BigInt(2) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(100) }]);

      const result = await getDocumentStats(TimeRange.Week, userGroupId, userId);

      expect(result.total).toBe(20);
      expect(result.embeddings.total).toBe(100);
    });

    it('should fetch stats for forever time range', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(1000) }])
        .mockResolvedValueOnce([{ count: BigInt(50) }])
        .mockResolvedValueOnce([{ count: BigInt(40) }])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(5000) }]);

      const result = await getDocumentStats(TimeRange.Forever, userGroupId, userId);

      expect(result.total).toBe(1000);
    });
  });

  describe('User filtering', () => {
    it('should filter by specific user', async () => {
      const specificUserId = '123e4567-e89b-12d3-a456-426614174000';

      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(50) }]);

      const result = await getDocumentStats(TimeRange.Month, userGroupId, specificUserId);

      expect(result.total).toBe(10);
    });

    it('should filter by user group', async () => {
      const specificUserGroupId = '123e4567-e89b-12d3-a456-426614174001';

      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(50) }])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(4) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([{ count: BigInt(250) }]);

      const result = await getDocumentStats(TimeRange.Year, specificUserGroupId, 'all');

      expect(result.total).toBe(50);
    });
  });

  describe('Error handling', () => {
    it('should log error and throw when database query fails', async () => {
      const error = new Error('Database error');
      (db.$queryRaw as jest.Mock).mockRejectedValue(error);

      await expect(getDocumentStats(TimeRange.Week, userGroupId, userId))
        .rejects.toThrow('Failed to fetch document statistics');

      expect(logger.error).toHaveBeenCalledWith('Error fetching document stats', { error });
    });
  });

  describe('Edge cases', () => {
    it('should handle zero documents', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }]);

      const result = await getDocumentStats(TimeRange.Week, userGroupId, userId);

      expect(result.total).toBe(0);
      expect(result.embeddings.total).toBe(0);
    });

    it('should handle null count values', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getDocumentStats(TimeRange.Month, userGroupId, userId);

      expect(result.total).toBe(0);
      expect(result.embeddings.total).toBe(0);
    });
  });
});
