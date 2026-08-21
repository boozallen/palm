import { mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { getPromptStats, getAllPromptStats } from './getPromptStats';

const mockPrisma = mockDeep<PrismaClient>();

describe('getPromptStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty object when promptIds array is empty', async () => {
    const result = await getPromptStats(mockPrisma, []);
    expect(result).toEqual({});
    expect(mockPrisma.promptBookmark.groupBy).not.toHaveBeenCalled();
    expect(mockPrisma.chat.groupBy).not.toHaveBeenCalled();
  });

  it('should return prompt statistics for given prompts', async () => {
    const promptIds = ['prompt-1', 'prompt-2', 'prompt-3'];

    // Mock bookmark counts
    (mockPrisma.promptBookmark.groupBy as jest.Mock).mockResolvedValue([
      { promptId: 'prompt-1', _count: { userId: 5 } },
      { promptId: 'prompt-3', _count: { userId: 2 } },
      // Note: prompt-2 has no bookmarks
    ]);

    // Mock usage counts  
    (mockPrisma.chat.groupBy as jest.Mock).mockResolvedValue([
      { promptId: 'prompt-1', _count: { id: 10 } },
      { promptId: 'prompt-2', _count: { id: 3 } },
      // Note: prompt-3 has no usage
    ]);

    const result = await getPromptStats(mockPrisma, promptIds);

    expect(result).toEqual({
      'prompt-1': { bookmarkCount: 5, usageCount: 10 },
      'prompt-2': { bookmarkCount: 0, usageCount: 3 },
      'prompt-3': { bookmarkCount: 2, usageCount: 0 },
    });
  });

  it('should initialize all prompt IDs with zero stats', async () => {
    const promptIds = ['prompt-1', 'prompt-2'];

    // No bookmarks or usage found
    (mockPrisma.promptBookmark.groupBy as jest.Mock).mockResolvedValue([]);
    (mockPrisma.chat.groupBy as jest.Mock).mockResolvedValue([]);

    const result = await getPromptStats(mockPrisma, promptIds);

    expect(result).toEqual({
      'prompt-1': { bookmarkCount: 0, usageCount: 0 },
      'prompt-2': { bookmarkCount: 0, usageCount: 0 },
    });
  });

  it('should call Prisma with correct parameters for bookmarks', async () => {
    const promptIds = ['prompt-1', 'prompt-2'];

    (mockPrisma.promptBookmark.groupBy as jest.Mock).mockResolvedValue([]);
    (mockPrisma.chat.groupBy as jest.Mock).mockResolvedValue([]);

    await getPromptStats(mockPrisma, promptIds);

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
  });

  it('should call Prisma with correct parameters for usage counts', async () => {
    const promptIds = ['prompt-1', 'prompt-2'];

    (mockPrisma.promptBookmark.groupBy as jest.Mock).mockResolvedValue([]);
    (mockPrisma.chat.groupBy as jest.Mock).mockResolvedValue([]);

    await getPromptStats(mockPrisma, promptIds);

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

  it('should handle null promptId in usage counts gracefully', async () => {
    const promptIds = ['prompt-1'];

    (mockPrisma.promptBookmark.groupBy as jest.Mock).mockResolvedValue([]);
    (mockPrisma.chat.groupBy as jest.Mock).mockResolvedValue([
      { promptId: null, _count: { id: 5 } }, // This should be ignored
      { promptId: 'prompt-1', _count: { id: 3 } },
    ]);

    const result = await getPromptStats(mockPrisma, promptIds);

    expect(result).toEqual({
      'prompt-1': { bookmarkCount: 0, usageCount: 3 },
    });
  });
});

describe('getAllPromptStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch all prompt IDs and call getPromptStats', async () => {
    const mockPrompts = [
      { id: 'prompt-1' },
      { id: 'prompt-2' },
      { id: 'prompt-3' },
    ];

    (mockPrisma.prompt.findMany as jest.Mock).mockResolvedValue(mockPrompts);
    (mockPrisma.promptBookmark.groupBy as jest.Mock).mockResolvedValue([]);
    (mockPrisma.chat.groupBy as jest.Mock).mockResolvedValue([]);

    const result = await getAllPromptStats(mockPrisma);

    expect(mockPrisma.prompt.findMany).toHaveBeenCalledWith({
      select: { id: true },
    });

    expect(result).toEqual({
      'prompt-1': { bookmarkCount: 0, usageCount: 0 },
      'prompt-2': { bookmarkCount: 0, usageCount: 0 },
      'prompt-3': { bookmarkCount: 0, usageCount: 0 },
    });
  });

  it('should return empty object when no prompts exist', async () => {
    mockPrisma.prompt.findMany.mockResolvedValue([]);

    const result = await getAllPromptStats(mockPrisma);

    expect(result).toEqual({});
    expect(mockPrisma.promptBookmark.groupBy).not.toHaveBeenCalled();
    expect(mockPrisma.chat.groupBy).not.toHaveBeenCalled();
  });
});