import { ContextType } from '@/server/trpc-context';
import contextStudioRouter from '@/features/context-studio/routes';
import getPromptStats from '@/features/context-studio/dal/getPromptStats';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import { TimeRange, PromptStats } from '@/features/context-studio/types/context-studio';
import { UserRole } from '@/features/shared/types/user';

jest.mock('@/features/context-studio/dal/getPromptStats');
jest.mock('@/features/context-studio/services/scopeStudioQuery');

describe('get-prompt-stats route', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const mockUserGroupId = '7b91f044-da78-43d4-91aa-5fbeffcb3e76';

  const mockCtx = {
    userId: mockUserId,
    userRole: UserRole.User,
  } as unknown as ContextType;

  const mockPromptStats: PromptStats = {
    timeRange: TimeRange.Week,
    library: {
      created: 12,
      chatted: 8,
      bookmarked: 3,
      uniqueTags: 5,
      byTag: [{ tag: 'finance', count: 4 }],
      tagless: 2,
    },
    workflow: {
      created: 6,
    },
    generated: 20,
    llmCalls: 100,
    llmCallsBySource: [{ source: 'chat', method: 'turn', model: 'gpt', count: 40 }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no restriction, so 'all' passes through unchanged. Tests that
    // name a specific user override this to return that user's restrictedUserId.
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: 'all' });
  });

  it('returns prompt stats for a specific time range and user group', async () => {
    (getPromptStats as jest.Mock).mockResolvedValue(mockPromptStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getPromptStats(input);

    expect(response).toEqual(mockPromptStats);
    expect(getPromptStats).toHaveBeenCalledWith(
      TimeRange.Week,
      mockUserGroupId,
      'all',
      false,
    );
  });

  it('returns prompt stats for a specific user', async () => {
    (getPromptStats as jest.Mock).mockResolvedValue(mockPromptStats);
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: mockUserId });

    const input = {
      timeRange: TimeRange.Month,
      userGroupId: 'all',
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getPromptStats(input);

    expect(response).toEqual(mockPromptStats);
    expect(getPromptStats).toHaveBeenCalledWith(
      TimeRange.Month,
      'all',
      mockUserId,
      false,
    );
  });

  it('passes excludeAdmins through when enabled', async () => {
    (getPromptStats as jest.Mock).mockResolvedValue(mockPromptStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: true,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getPromptStats(input);

    expect(getPromptStats).toHaveBeenCalledWith(
      TimeRange.Week,
      'all',
      'all',
      true,
    );
  });

  it('defaults excludeAdmins to false when omitted', async () => {
    (getPromptStats as jest.Mock).mockResolvedValue(mockPromptStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getPromptStats(input);

    expect(getPromptStats).toHaveBeenCalledWith(
      TimeRange.Week,
      'all',
      'all',
      false,
    );
  });

  it('handles all time range options', async () => {
    (getPromptStats as jest.Mock).mockResolvedValue(mockPromptStats);

    for (const timeRange of [TimeRange.Week, TimeRange.Month, TimeRange.Year, TimeRange.Forever]) {
      const input = {
        timeRange,
        userGroupId: 'all',
        userId: 'all',
        excludeAdmins: false,
      };

      const caller = contextStudioRouter.createCaller(mockCtx);
      await caller.getPromptStats(input);

      expect(getPromptStats).toHaveBeenCalledWith(
        timeRange,
        'all',
        'all',
        false,
      );
    }
  });

  it('throws an error if getPromptStats fails', async () => {
    const mockError = new Error('Failed to fetch prompt statistics');
    (getPromptStats as jest.Mock).mockRejectedValue(mockError);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getPromptStats(input),
    ).rejects.toThrow(mockError.message);

    expect(getPromptStats).toHaveBeenCalledWith(
      TimeRange.Week,
      'all',
      'all',
      false,
    );
  });

  it('rejects invalid timeRange input', async () => {
    const input = {
      timeRange: 'invalid' as TimeRange,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getPromptStats(input),
    ).rejects.toThrow();

    expect(getPromptStats).not.toHaveBeenCalled();
  });

  it('rejects invalid userGroupId input', async () => {
    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'not-a-uuid',
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getPromptStats(input),
    ).rejects.toThrow();

    expect(getPromptStats).not.toHaveBeenCalled();
  });

  it('rejects invalid userId input', async () => {
    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'not-a-uuid',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getPromptStats(input),
    ).rejects.toThrow();

    expect(getPromptStats).not.toHaveBeenCalled();
  });

  it('passes the restricted userId from scopeStudioQuery to the DAL, not the raw input', async () => {
    (getPromptStats as jest.Mock).mockResolvedValue(mockPromptStats);
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: mockUserId });

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getPromptStats(input);

    expect(getPromptStats).toHaveBeenCalledWith(
      TimeRange.Week,
      mockUserGroupId,
      mockUserId,
      false,
    );
  });

  it('calls scopeStudioQuery with the request context and raw filter input', async () => {
    (getPromptStats as jest.Mock).mockResolvedValue(mockPromptStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getPromptStats(input);

    expect(scopeStudioQuery).toHaveBeenCalledWith(mockCtx, mockUserGroupId, mockUserId);
  });

  it('throws and never calls the DAL when scopeStudioQuery rejects', async () => {
    const mockError = new Error('You do not have permission to access this resource');
    (scopeStudioQuery as jest.Mock).mockRejectedValue(mockError);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getPromptStats(input),
    ).rejects.toThrow(mockError.message);

    expect(getPromptStats).not.toHaveBeenCalled();
  });
});
