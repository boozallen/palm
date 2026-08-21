import { mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import libraryRouter from '@/features/library/routes';
import logger from '@/server/logger';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';

jest.mock('@/server/logger');

const mockPrisma = mockDeep<PrismaClient>();

const mockCtx = {
  userId: 'test-user-id',
  userRole: UserRole.User,
  prisma: mockPrisma,
  logger,
} as unknown as ContextType;

describe('getPromptStats route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return prompt statistics successfully', async () => {
    const promptIds = ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001'];
    
    // Mock bookmark counts
    (mockPrisma.promptBookmark.groupBy as jest.Mock).mockResolvedValue([
      { promptId: '550e8400-e29b-41d4-a716-446655440000', _count: { userId: 3 } },
      { promptId: '550e8400-e29b-41d4-a716-446655440001', _count: { userId: 1 } },
    ]);

    // Mock usage counts
    (mockPrisma.chat.groupBy as jest.Mock).mockResolvedValue([
      { promptId: '550e8400-e29b-41d4-a716-446655440000', _count: { id: 5 } },
      { promptId: '550e8400-e29b-41d4-a716-446655440001', _count: { id: 2 } },
    ]);

    const caller = libraryRouter.createCaller(mockCtx);
    const result = await caller.getPromptStats({ promptIds });

    expect(result).toEqual({
      '550e8400-e29b-41d4-a716-446655440000': { bookmarkCount: 3, usageCount: 5 },
      '550e8400-e29b-41d4-a716-446655440001': { bookmarkCount: 1, usageCount: 2 },
    });

    expect(mockPrisma.promptBookmark.groupBy).toHaveBeenCalledWith({
      by: ['promptId'],
      where: {
        promptId: {
          in: promptIds,
        },
      },
      _count: {
        userId: true,
      },
    });

    expect(mockPrisma.chat.groupBy).toHaveBeenCalledWith({
      by: ['promptId'],
      where: {
        promptId: {
          in: promptIds,
          not: null,
        },
      },
      _count: {
        id: true,
      },
    });
  });

  it('should return empty object for empty prompt IDs array', async () => {
    const caller = libraryRouter.createCaller(mockCtx);
    const result = await caller.getPromptStats({ promptIds: [] });

    expect(result).toEqual({});
    expect(mockPrisma.promptBookmark.groupBy).not.toHaveBeenCalled();
    expect(mockPrisma.chat.groupBy).not.toHaveBeenCalled();
  });

  it('should handle database errors and throw generic error', async () => {
    const promptIds = ['550e8400-e29b-41d4-a716-446655440000'];
    const dbError = new Error('Database connection failed');

    mockPrisma.promptBookmark.groupBy.mockRejectedValue(dbError);

    const caller = libraryRouter.createCaller(mockCtx);
    await expect(
      caller.getPromptStats({ promptIds })
    ).rejects.toThrow('Error fetching prompt statistics');

    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching prompt statistics',
      dbError
    );
  });

  it('should handle prompts with no stats', async () => {
    const promptIds = ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001'];
    
    // No bookmarks or usage for these prompts
    (mockPrisma.promptBookmark.groupBy as jest.Mock).mockResolvedValue([]);
    (mockPrisma.chat.groupBy as jest.Mock).mockResolvedValue([]);

    const caller = libraryRouter.createCaller(mockCtx);
    const result = await caller.getPromptStats({ promptIds });

    expect(result).toEqual({
      '550e8400-e29b-41d4-a716-446655440000': { bookmarkCount: 0, usageCount: 0 },
      '550e8400-e29b-41d4-a716-446655440001': { bookmarkCount: 0, usageCount: 0 },
    });
  });

  it('should validate input with invalid UUID format', async () => {
    const caller = libraryRouter.createCaller(mockCtx);
    await expect(
      caller.getPromptStats({ promptIds: ['invalid-uuid'] })
    ).rejects.toThrow();
  });

  it('should validate input with valid UUID format', async () => {
    (mockPrisma.promptBookmark.groupBy as jest.Mock).mockResolvedValue([]);
    (mockPrisma.chat.groupBy as jest.Mock).mockResolvedValue([]);

    const validInput = {
      promptIds: ['550e8400-e29b-41d4-a716-446655440000'],
    };

    const caller = libraryRouter.createCaller(mockCtx);
    await expect(
      caller.getPromptStats(validInput)
    ).resolves.toBeDefined();
  });
});