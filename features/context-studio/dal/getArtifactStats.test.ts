import db from '@/server/db';
import logger from '@/server/logger';
import getArtifactStats from './getArtifactStats';
import { TimeRange } from '@/features/context-studio/types/context-studio';

jest.mock('@/server/db', () => ({
  $queryRaw: jest.fn(),
}));
jest.mock('@/server/logger');

// Mock Prisma.sql and Prisma.raw
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

describe('getArtifactStats', () => {
  const userGroupId = 'all';
  const userId = 'all';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TimeRange filtering', () => {
    it('should fetch stats for week time range', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(5) }]) // chatArtifactCount
        .mockResolvedValueOnce([{ count: BigInt(3) }]) // workflowArtifactCount
        .mockResolvedValueOnce([]) // chatArtifactsByType
        .mockResolvedValueOnce([]) // workflowArtifactsByType
        .mockResolvedValueOnce([{ count: BigInt(2) }]) // modelOnlyTotal
        .mockResolvedValueOnce([]) // modelOnlyByModel
        .mockResolvedValueOnce([{ count: BigInt(1) }]) // agentProviderTotal
        .mockResolvedValueOnce([]); // agentProviderByAgent

      const result = await getArtifactStats(TimeRange.Week, userGroupId, userId);

      expect(result.total).toBe(8);
      expect(result.chat).toBe(5);
      expect(result.workflow).toBe(3);
    });

    it('should fetch stats for forever time range', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(100) }])
        .mockResolvedValueOnce([{ count: BigInt(50) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(40) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(30) }])
        .mockResolvedValueOnce([]);

      const result = await getArtifactStats(TimeRange.Forever, userGroupId, userId);

      expect(result.total).toBe(150);
      expect(result.chat).toBe(100);
      expect(result.workflow).toBe(50);
    });
  });

  describe('User filtering', () => {
    it('should filter by specific user', async () => {
      const specificUserId = '123e4567-e89b-12d3-a456-426614174000';

      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(2) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([]);

      const result = await getArtifactStats(TimeRange.Month, userGroupId, specificUserId);

      expect(result.total).toBe(3);
    });

    it('should filter by user group', async () => {
      const specificUserGroupId = '123e4567-e89b-12d3-a456-426614174001';

      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(8) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(2) }])
        .mockResolvedValueOnce([]);

      const result = await getArtifactStats(TimeRange.Year, specificUserGroupId, 'all');

      expect(result.total).toBe(15);
    });
  });

  describe('Artifact breakdown', () => {
    it('should return artifact type breakdown', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([
          { type: 'tsx', count: BigInt(5) },
          { type: 'ts', count: BigInt(3) },
        ])
        .mockResolvedValueOnce([
          { type: 'tsx', count: BigInt(2) },
          { type: 'json', count: BigInt(3) },
        ])
        .mockResolvedValueOnce([{ count: BigInt(8) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(2) }])
        .mockResolvedValueOnce([]);

      const result = await getArtifactStats(TimeRange.Month, userGroupId, userId);

      expect(result.byType).toEqual([
        { type: 'tsx', count: 7 },
        { type: 'ts', count: 3 },
        { type: 'json', count: 3 },
      ]);
      expect(result.chatArtifacts.byType).toEqual([
        { type: 'tsx', count: 5 },
        { type: 'ts', count: 3 },
      ]);
      expect(result.workflowArtifacts.byType).toEqual([
        { type: 'json', count: 3 },
        { type: 'tsx', count: 2 },
      ]);
    });

    it('should return chat artifacts by creation method', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(20) }])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(15) }])
        .mockResolvedValueOnce([
          { modelId: 'model-1', modelName: 'GPT-4', count: BigInt(10) },
          { modelId: 'model-2', modelName: 'Claude', count: BigInt(5) },
        ])
        .mockResolvedValueOnce([{ count: BigInt(3) }])
        .mockResolvedValueOnce([
          { agentProviderId: 'agent-1', agentProviderName: 'Agent Provider 1', count: BigInt(3) },
        ]);

      const result = await getArtifactStats(TimeRange.Month, userGroupId, userId);

      expect(result.chatArtifacts.total).toBe(20);
      expect(result.chatArtifacts.byCreationMethod.modelOnly.total).toBe(15);
      expect(result.chatArtifacts.byCreationMethod.modelOnly.byModel).toEqual([
        { modelId: 'model-1', modelName: 'GPT-4', count: 10 },
        { modelId: 'model-2', modelName: 'Claude', count: 5 },
      ]);
      expect(result.chatArtifacts.byCreationMethod.agentProvider.total).toBe(3);
      expect(result.chatArtifacts.byCreationMethod.agentProvider.byAgentProvider).toEqual([
        { agentProviderId: 'agent-1', agentProviderName: 'Agent Provider 1', count: 3 },
      ]);
    });
  });

  describe('Error handling', () => {
    it('should log error and throw when database query fails', async () => {
      const error = new Error('Database error');
      (db.$queryRaw as jest.Mock).mockRejectedValue(error);

      await expect(getArtifactStats(TimeRange.Week, userGroupId, userId))
        .rejects.toThrow('Failed to fetch artifact statistics');

      expect(logger.error).toHaveBeenCalledWith('Error fetching artifact stats', { error });
    });
  });

  describe('Edge cases', () => {
    it('should handle zero artifacts', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([]);

      const result = await getArtifactStats(TimeRange.Week, userGroupId, userId);

      expect(result.total).toBe(0);
      expect(result.chat).toBe(0);
      expect(result.workflow).toBe(0);
      expect(result.byType).toEqual([]);
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
        .mockResolvedValueOnce([]);

      const result = await getArtifactStats(TimeRange.Month, userGroupId, userId);

      expect(result.total).toBe(0);
      expect(result.chat).toBe(0);
      expect(result.workflow).toBe(0);
    });
  });
});
