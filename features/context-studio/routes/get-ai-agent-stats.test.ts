import { ContextType } from '@/server/trpc-context';
import contextStudioRouter from '@/features/context-studio/routes';
import getAiAgentStats from '@/features/context-studio/dal/getAiAgentStats';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import { TimeRange, AiAgentStats } from '@/features/context-studio/types/context-studio';
import { UserRole } from '@/features/shared/types/user';

jest.mock('@/features/context-studio/dal/getAiAgentStats');
jest.mock('@/features/context-studio/services/scopeStudioQuery');

describe('get-ai-agent-stats route', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const mockUserGroupId = '7b91f044-da78-43d4-91aa-5fbeffcb3e76';

  const mockCtx = {
    userId: mockUserId,
    userRole: UserRole.Admin,
  } as unknown as ContextType;

  const mockNonAdminCtx = {
    userId: mockUserId,
    userRole: UserRole.User,
  } as unknown as ContextType;

  const mockAiAgentStats: AiAgentStats = {
    configured: 4,
    reportsGenerated: 20,
    uniqueUsers: 6,
    prismJobs: 12,
    prismCompleted: 10,
    prismInProgress: 2,
    odramJobs: 8,
    odramCompleted: 7,
    odramInProgress: 1,
    marginAnalyses: 5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: 'all' });
  });

  it('returns AI agent stats for a specific time range and user group', async () => {
    (getAiAgentStats as jest.Mock).mockResolvedValue(mockAiAgentStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getAiAgentStats(input);

    expect(response).toEqual(mockAiAgentStats);
    expect(getAiAgentStats).toHaveBeenCalledWith(
      TimeRange.Week,
      mockUserGroupId,
      'all',
    );
  });

  it('returns AI agent stats for a specific user', async () => {
    (getAiAgentStats as jest.Mock).mockResolvedValue(mockAiAgentStats);
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: mockUserId });

    const input = {
      timeRange: TimeRange.Month,
      userGroupId: 'all',
      userId: mockUserId,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getAiAgentStats(input);

    expect(response).toEqual(mockAiAgentStats);
    expect(getAiAgentStats).toHaveBeenCalledWith(
      TimeRange.Month,
      'all',
      mockUserId,
    );
  });

  it('handles all time range options', async () => {
    (getAiAgentStats as jest.Mock).mockResolvedValue(mockAiAgentStats);

    for (const timeRange of [TimeRange.Week, TimeRange.Month, TimeRange.Year, TimeRange.Forever]) {
      const input = {
        timeRange,
        userGroupId: 'all',
        userId: 'all',
      };

      const caller = contextStudioRouter.createCaller(mockCtx);
      await caller.getAiAgentStats(input);

      expect(getAiAgentStats).toHaveBeenCalledWith(
        timeRange,
        'all',
        'all',
      );
    }
  });

  it('throws an error if getAiAgentStats fails', async () => {
    const mockError = new Error('Failed to fetch AI agent statistics');
    (getAiAgentStats as jest.Mock).mockRejectedValue(mockError);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getAiAgentStats(input),
    ).rejects.toThrow(mockError.message);

    expect(getAiAgentStats).toHaveBeenCalledWith(
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
      caller.getAiAgentStats(input),
    ).rejects.toThrow();

    expect(getAiAgentStats).not.toHaveBeenCalled();
  });

  it('rejects invalid userGroupId input', async () => {
    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'not-a-uuid',
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getAiAgentStats(input),
    ).rejects.toThrow();

    expect(getAiAgentStats).not.toHaveBeenCalled();
  });

  it('rejects invalid userId input', async () => {
    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'not-a-uuid',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getAiAgentStats(input),
    ).rejects.toThrow();

    expect(getAiAgentStats).not.toHaveBeenCalled();
  });

  it('calls scopeStudioQuery with the requested scope', async () => {
    (getAiAgentStats as jest.Mock).mockResolvedValue(mockAiAgentStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: mockUserId,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getAiAgentStats(input);

    expect(scopeStudioQuery).toHaveBeenCalledWith(mockCtx, mockUserGroupId, mockUserId);
  });

  it('throws and never calls getAiAgentStats when scopeStudioQuery rejects', async () => {
    const mockError = new Error('You do not have permission to access this resource');
    (scopeStudioQuery as jest.Mock).mockRejectedValue(mockError);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getAiAgentStats(input),
    ).rejects.toThrow(mockError.message);

    expect(getAiAgentStats).not.toHaveBeenCalled();
  });

  it('rejects a non-Admin caller before touching the DAL', async () => {
    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockNonAdminCtx);

    await expect(
      caller.getAiAgentStats(input),
    ).rejects.toThrow();

    expect(scopeStudioQuery).not.toHaveBeenCalled();
    expect(getAiAgentStats).not.toHaveBeenCalled();
  });
});
