import { ContextType } from '@/server/trpc-context';
import contextStudioRouter from '@/features/context-studio/routes';
import getChatStats from '@/features/context-studio/dal/getChatStats';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import { TimeRange, ChatStats } from '@/features/context-studio/types/context-studio';
import { UserRole } from '@/features/shared/types/user';

jest.mock('@/features/context-studio/dal/getChatStats');
jest.mock('@/features/context-studio/services/scopeStudioQuery');

describe('get-chat-stats route', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const mockUserGroupId = '7b91f044-da78-43d4-91aa-5fbeffcb3e76';

  const mockCtx = {
    userId: mockUserId,
    userRole: UserRole.User,
  } as unknown as ContextType;

  const mockChatStats: ChatStats = {
    total: 42,
    withPrompt: 10,
    withAgent: 5,
    withUploadedSources: 3,
    withKnowledgeBaseSources: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no restriction, so 'all' passes through unchanged. Tests that
    // name a specific user override this to return that user's restrictedUserId.
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: 'all' });
  });

  it('returns chat stats for a specific time range and user group', async () => {
    (getChatStats as jest.Mock).mockResolvedValue(mockChatStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getChatStats(input);

    expect(response).toEqual(mockChatStats);
    expect(getChatStats).toHaveBeenCalledWith(
      TimeRange.Week,
      mockUserGroupId,
      'all',
      false,
    );
  });

  it('returns chat stats for a specific user', async () => {
    (getChatStats as jest.Mock).mockResolvedValue(mockChatStats);
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: mockUserId });

    const input = {
      timeRange: TimeRange.Month,
      userGroupId: 'all',
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getChatStats(input);

    expect(response).toEqual(mockChatStats);
    expect(getChatStats).toHaveBeenCalledWith(
      TimeRange.Month,
      'all',
      mockUserId,
      false,
    );
  });

  it('passes excludeAdmins through when enabled', async () => {
    (getChatStats as jest.Mock).mockResolvedValue(mockChatStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: true,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getChatStats(input);

    expect(getChatStats).toHaveBeenCalledWith(
      TimeRange.Week,
      'all',
      'all',
      true,
    );
  });

  it('defaults excludeAdmins to false when omitted', async () => {
    (getChatStats as jest.Mock).mockResolvedValue(mockChatStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getChatStats(input);

    expect(getChatStats).toHaveBeenCalledWith(
      TimeRange.Week,
      'all',
      'all',
      false,
    );
  });

  it('handles all time range options', async () => {
    (getChatStats as jest.Mock).mockResolvedValue(mockChatStats);

    for (const timeRange of [TimeRange.Week, TimeRange.Month, TimeRange.Year, TimeRange.Forever]) {
      const input = {
        timeRange,
        userGroupId: 'all',
        userId: 'all',
        excludeAdmins: false,
      };

      const caller = contextStudioRouter.createCaller(mockCtx);
      await caller.getChatStats(input);

      expect(getChatStats).toHaveBeenCalledWith(
        timeRange,
        'all',
        'all',
        false,
      );
    }
  });

  it('throws an error if getChatStats fails', async () => {
    const mockError = new Error('Failed to fetch chat statistics');
    (getChatStats as jest.Mock).mockRejectedValue(mockError);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getChatStats(input),
    ).rejects.toThrow(mockError.message);

    expect(getChatStats).toHaveBeenCalledWith(
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
      caller.getChatStats(input),
    ).rejects.toThrow();

    expect(getChatStats).not.toHaveBeenCalled();
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
      caller.getChatStats(input),
    ).rejects.toThrow();

    expect(getChatStats).not.toHaveBeenCalled();
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
      caller.getChatStats(input),
    ).rejects.toThrow();

    expect(getChatStats).not.toHaveBeenCalled();
  });

  it('passes the restricted userId from scopeStudioQuery to the DAL, not the raw input', async () => {
    (getChatStats as jest.Mock).mockResolvedValue(mockChatStats);
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: mockUserId });

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getChatStats(input);

    expect(getChatStats).toHaveBeenCalledWith(
      TimeRange.Week,
      mockUserGroupId,
      mockUserId,
      false,
    );
  });

  it('calls scopeStudioQuery with the requested scope', async () => {
    (getChatStats as jest.Mock).mockResolvedValue(mockChatStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getChatStats(input);

    expect(scopeStudioQuery).toHaveBeenCalledWith(mockCtx, mockUserGroupId, mockUserId);
  });

  it('throws and never calls getChatStats when scopeStudioQuery rejects', async () => {
    const mockError = new Error('You do not have permission to access this resource');
    (scopeStudioQuery as jest.Mock).mockRejectedValue(mockError);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getChatStats(input),
    ).rejects.toThrow(mockError.message);

    expect(getChatStats).not.toHaveBeenCalled();
  });
});
