import { ContextType } from '@/server/trpc-context';
import contextStudioRouter from '@/features/context-studio/routes';
import getKnowledgeBaseStats from '@/features/context-studio/dal/getKnowledgeBaseStats';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import { TimeRange, KnowledgeBaseStats } from '@/features/context-studio/types/context-studio';
import { UserRole } from '@/features/shared/types/user';

jest.mock('@/features/context-studio/dal/getKnowledgeBaseStats');
jest.mock('@/features/context-studio/services/scopeStudioQuery');

describe('get-knowledge-base-stats route', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const mockUserGroupId = '7b91f044-da78-43d4-91aa-5fbeffcb3e76';

  const mockCtx = {
    userId: mockUserId,
    userRole: UserRole.User,
  } as unknown as ContextType;

  const mockKnowledgeBaseStats: KnowledgeBaseStats = {
    total: 24,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no restriction, so 'all' passes through unchanged. Tests that
    // name a specific user override this to return that user's restrictedUserId.
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: 'all' });
  });

  it('returns knowledge base stats for a specific time range and user group', async () => {
    (getKnowledgeBaseStats as jest.Mock).mockResolvedValue(mockKnowledgeBaseStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getKnowledgeBaseStats(input);

    expect(response).toEqual(mockKnowledgeBaseStats);
    expect(getKnowledgeBaseStats).toHaveBeenCalledWith(
      TimeRange.Week,
      mockUserGroupId,
      'all',
    );
  });

  it('returns knowledge base stats for a specific user', async () => {
    (getKnowledgeBaseStats as jest.Mock).mockResolvedValue(mockKnowledgeBaseStats);
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: mockUserId });

    const input = {
      timeRange: TimeRange.Month,
      userGroupId: 'all',
      userId: mockUserId,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getKnowledgeBaseStats(input);

    expect(response).toEqual(mockKnowledgeBaseStats);
    expect(getKnowledgeBaseStats).toHaveBeenCalledWith(
      TimeRange.Month,
      'all',
      mockUserId,
    );
  });

  it('handles all time range options', async () => {
    (getKnowledgeBaseStats as jest.Mock).mockResolvedValue(mockKnowledgeBaseStats);

    for (const timeRange of [TimeRange.Week, TimeRange.Month, TimeRange.Year, TimeRange.Forever]) {
      const input = {
        timeRange,
        userGroupId: 'all',
        userId: 'all',
      };

      const caller = contextStudioRouter.createCaller(mockCtx);
      await caller.getKnowledgeBaseStats(input);

      expect(getKnowledgeBaseStats).toHaveBeenCalledWith(
        timeRange,
        'all',
        'all',
      );
    }
  });

  it('throws an error if getKnowledgeBaseStats fails', async () => {
    const mockError = new Error('Failed to fetch knowledge base statistics');
    (getKnowledgeBaseStats as jest.Mock).mockRejectedValue(mockError);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getKnowledgeBaseStats(input),
    ).rejects.toThrow(mockError.message);

    expect(getKnowledgeBaseStats).toHaveBeenCalledWith(
      TimeRange.Week,
      'all',
      'all',
    );
  });

  it('rejects invalid timeRange input', async () => {
    const input = {
      timeRange: 'invalid' as TimeRange,
      userGroupId: 'all',
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getKnowledgeBaseStats(input),
    ).rejects.toThrow();

    expect(getKnowledgeBaseStats).not.toHaveBeenCalled();
  });

  it('rejects invalid userGroupId input', async () => {
    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'not-a-uuid',
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getKnowledgeBaseStats(input),
    ).rejects.toThrow();

    expect(getKnowledgeBaseStats).not.toHaveBeenCalled();
  });

  it('rejects invalid userId input', async () => {
    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'not-a-uuid',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getKnowledgeBaseStats(input),
    ).rejects.toThrow();

    expect(getKnowledgeBaseStats).not.toHaveBeenCalled();
  });

  it('passes the restricted userId from scopeStudioQuery to the DAL, not the raw input', async () => {
    (getKnowledgeBaseStats as jest.Mock).mockResolvedValue(mockKnowledgeBaseStats);
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: mockUserId });

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getKnowledgeBaseStats(input);

    expect(getKnowledgeBaseStats).toHaveBeenCalledWith(
      TimeRange.Week,
      mockUserGroupId,
      mockUserId,
    );
  });

  it('calls scopeStudioQuery with the request context and raw filter input', async () => {
    (getKnowledgeBaseStats as jest.Mock).mockResolvedValue(mockKnowledgeBaseStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: mockUserId,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getKnowledgeBaseStats(input);

    expect(scopeStudioQuery).toHaveBeenCalledWith(mockCtx, mockUserGroupId, mockUserId);
  });

  it('throws and never calls the DAL when scopeStudioQuery rejects', async () => {
    const mockError = new Error('You do not have permission to access this resource');
    (scopeStudioQuery as jest.Mock).mockRejectedValue(mockError);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: mockUserId,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getKnowledgeBaseStats(input),
    ).rejects.toThrow(mockError.message);

    expect(getKnowledgeBaseStats).not.toHaveBeenCalled();
  });
});
