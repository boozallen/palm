import db from '@/server/db';
import logger from '@/server/logger';
import getPromptStats from './getPromptStats';
import { TimeRange } from '@/features/context-studio/types/context-studio';

jest.mock('@/server/db', () => ({
  $queryRaw: jest.fn(),
  userGroup: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
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

describe('getPromptStats', () => {
  const userGroupId = 'all';
  const userId = 'all';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic stats retrieval', () => {
    it('should fetch prompt stats successfully', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(50) }]) // library created
        .mockResolvedValueOnce([{ count: BigInt(10) }]) // workflow created
        .mockResolvedValueOnce([{ count: BigInt(5) }]) // generated
        .mockResolvedValueOnce([{ count: BigInt(30) }]) // chatted
        .mockResolvedValueOnce([{ count: BigInt(200) }]) // llm calls
        .mockResolvedValueOnce([ // llm calls by source
          { source: 'Chat', method: 'POST', model: 'gpt-4', count: BigInt(150) },
          { source: 'API', method: 'POST', model: 'claude-3', count: BigInt(50) },
        ])
        .mockResolvedValueOnce([{ count: BigInt(20) }]) // bookmarked
        .mockResolvedValueOnce([{ count: BigInt(15) }]) // unique tags
        .mockResolvedValueOnce([ // by tag
          { tag: 'development', count: BigInt(25) },
          { tag: 'testing', count: BigInt(15) },
        ])
        .mockResolvedValueOnce([{ count: BigInt(5) }]); // tagless

      const result = await getPromptStats(TimeRange.Month, userGroupId, userId);

      expect(result.library.created).toBe(50);
      expect(result.library.chatted).toBe(30);
      expect(result.library.bookmarked).toBe(20);
      expect(result.library.uniqueTags).toBe(15);
      expect(result.library.byTag).toEqual([
        { tag: 'development', count: 25 },
        { tag: 'testing', count: 15 },
      ]);
      expect(result.workflow.created).toBe(10);
      expect(result.generated).toBe(5);
      expect(result.llmCalls).toBe(200);
      expect(result.llmCallsBySource).toEqual([
        { source: 'Chat', method: 'POST', model: 'gpt-4', count: 150 },
        { source: 'API', method: 'POST', model: 'claude-3', count: 50 },
      ]);
      expect(result.timeRange).toBe(TimeRange.Month);
    });
  });

  describe('User context retrieval', () => {
    it('should include user group label when specified', async () => {
      const specificUserGroupId = '123e4567-e89b-12d3-a456-426614174001';
      (db.userGroup.findUnique as jest.Mock).mockResolvedValue({ label: 'Test Group' });

      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(2) }])
        .mockResolvedValueOnce([{ count: BigInt(8) }])
        .mockResolvedValueOnce([{ count: BigInt(50) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(3) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(2) }]);

      const result = await getPromptStats(TimeRange.Month, specificUserGroupId, userId);

      expect(result.userGroupLabel).toBe('Test Group');
      expect(db.userGroup.findUnique).toHaveBeenCalledWith({
        where: { id: specificUserGroupId },
        select: { label: true },
      });
    });

    it('should include user name when specified', async () => {
      const specificUserId = '123e4567-e89b-12d3-a456-426614174000';
      (db.user.findUnique as jest.Mock).mockResolvedValue({ name: 'John Doe' });

      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(2) }])
        .mockResolvedValueOnce([{ count: BigInt(8) }])
        .mockResolvedValueOnce([{ count: BigInt(50) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(3) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(2) }]);

      const result = await getPromptStats(TimeRange.Month, userGroupId, specificUserId);

      expect(result.userName).toBe('John Doe');
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { id: specificUserId },
        select: { name: true },
      });
    });
  });

  describe('TimeRange filtering', () => {
    it('should fetch stats for week time range', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(2) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([{ count: BigInt(3) }])
        .mockResolvedValueOnce([{ count: BigInt(20) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(2) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }]);

      const result = await getPromptStats(TimeRange.Week, userGroupId, userId);

      expect(result.library.created).toBe(5);
      expect(result.workflow.created).toBe(2);
    });

    it('should fetch stats for forever time range', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(500) }])
        .mockResolvedValueOnce([{ count: BigInt(100) }])
        .mockResolvedValueOnce([{ count: BigInt(50) }])
        .mockResolvedValueOnce([{ count: BigInt(300) }])
        .mockResolvedValueOnce([{ count: BigInt(2000) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(200) }])
        .mockResolvedValueOnce([{ count: BigInt(50) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }]);

      const result = await getPromptStats(TimeRange.Forever, userGroupId, userId);

      expect(result.library.created).toBe(500);
      expect(result.llmCalls).toBe(2000);
    });
  });

  describe('User filtering', () => {
    it('should filter by specific user', async () => {
      const specificUserId = '123e4567-e89b-12d3-a456-426614174000';
      (db.user.findUnique as jest.Mock).mockResolvedValue({ name: 'Test User' });

      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(2) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([{ count: BigInt(3) }])
        .mockResolvedValueOnce([{ count: BigInt(15) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(2) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }]);

      const result = await getPromptStats(TimeRange.Month, userGroupId, specificUserId);

      expect(result.library.created).toBe(5);
    });

    it('should filter by user group', async () => {
      const specificUserGroupId = '123e4567-e89b-12d3-a456-426614174001';
      (db.userGroup.findUnique as jest.Mock).mockResolvedValue({ label: 'Test Group' });

      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(30) }])
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(20) }])
        .mockResolvedValueOnce([{ count: BigInt(150) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(15) }])
        .mockResolvedValueOnce([{ count: BigInt(8) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }]);

      const result = await getPromptStats(TimeRange.Year, specificUserGroupId, 'all');

      expect(result.library.created).toBe(30);
    });
  });

  describe('Error handling', () => {
    it('should log error and throw when database query fails', async () => {
      const error = new Error('Database error');
      (db.$queryRaw as jest.Mock).mockRejectedValue(error);

      await expect(getPromptStats(TimeRange.Week, userGroupId, userId))
        .rejects.toThrow('Failed to fetch prompt statistics');

      expect(logger.error).toHaveBeenCalledWith('Error fetching prompt stats', { error });
    });
  });

  describe('Edge cases', () => {
    it('should handle zero prompts', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }]);

      const result = await getPromptStats(TimeRange.Week, userGroupId, userId);

      expect(result.library.created).toBe(0);
      expect(result.workflow.created).toBe(0);
      expect(result.generated).toBe(0);
      expect(result.llmCalls).toBe(0);
    });

    it('should handle null count values', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getPromptStats(TimeRange.Month, userGroupId, userId);

      expect(result.library.created).toBe(0);
      expect(result.llmCalls).toBe(0);
    });

    it('should handle missing user group', async () => {
      const specificUserGroupId = '123e4567-e89b-12d3-a456-426614174001';
      (db.userGroup.findUnique as jest.Mock).mockResolvedValue(null);

      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(2) }])
        .mockResolvedValueOnce([{ count: BigInt(8) }])
        .mockResolvedValueOnce([{ count: BigInt(50) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(3) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(2) }]);

      const result = await getPromptStats(TimeRange.Month, specificUserGroupId, userId);

      expect(result.userGroupLabel).toBeUndefined();
    });

    it('should handle missing user', async () => {
      const specificUserId = '123e4567-e89b-12d3-a456-426614174000';
      (db.user.findUnique as jest.Mock).mockResolvedValue(null);

      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(2) }])
        .mockResolvedValueOnce([{ count: BigInt(8) }])
        .mockResolvedValueOnce([{ count: BigInt(50) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(3) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(2) }]);

      const result = await getPromptStats(TimeRange.Month, userGroupId, specificUserId);

      expect(result.userName).toBeUndefined();
    });
  });
});
