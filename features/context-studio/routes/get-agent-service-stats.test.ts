import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import contextStudioRouter from '@/features/context-studio/routes';
import getAgentServiceStats from '@/features/context-studio/dal/getAgentServiceStats';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import { TimeRange, AgentServiceStats } from '@/features/context-studio/types/context-studio';

jest.mock('@/features/context-studio/dal/getAgentServiceStats');
jest.mock('@/features/context-studio/services/scopeStudioQuery');

describe('get-agent-service-stats route', () => {
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

  const mockAgentServiceStats: AgentServiceStats = {
    totalThreads: 42,
    threadsByStatus: [
      { status: 'completed', count: 30 },
      { status: 'failed', count: 10 },
      { status: 'pending', count: 2 },
    ],
    threadsByGraphType: [
      { graphType: 'react', count: 25 },
      { graphType: 'basic', count: 17 },
    ],
    chatsWithAgentProvider: 15,
    chatsByAgentProvider: [
      { provider: 'openai', count: 10 },
      { provider: 'anthropic', count: 5 },
    ],
    toolCallsByType: [
      { toolType: 'web_search', count: 50 },
      { toolType: 'calculator', count: 30 },
    ],
    totalToolCalls: 80,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: 'all' });
  });

  it('returns agent service stats for a specific time range and user group', async () => {
    (getAgentServiceStats as jest.Mock).mockResolvedValue(mockAgentServiceStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getAgentServiceStats(input);

    expect(response).toEqual(mockAgentServiceStats);
    expect(getAgentServiceStats).toHaveBeenCalledWith(
      TimeRange.Week,
      mockUserGroupId,
      'all',
    );
  });

  it('returns agent service stats for a specific user', async () => {
    (getAgentServiceStats as jest.Mock).mockResolvedValue(mockAgentServiceStats);
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: mockUserId });

    const input = {
      timeRange: TimeRange.Month,
      userGroupId: 'all',
      userId: mockUserId,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getAgentServiceStats(input);

    expect(response).toEqual(mockAgentServiceStats);
    expect(getAgentServiceStats).toHaveBeenCalledWith(
      TimeRange.Month,
      'all',
      mockUserId,
    );
  });

  it('returns agent service stats for all users and groups', async () => {
    (getAgentServiceStats as jest.Mock).mockResolvedValue(mockAgentServiceStats);

    const input = {
      timeRange: TimeRange.Forever,
      userGroupId: 'all',
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getAgentServiceStats(input);

    expect(response).toEqual(mockAgentServiceStats);
    expect(getAgentServiceStats).toHaveBeenCalledWith(
      TimeRange.Forever,
      'all',
      'all',
    );
  });

  it('handles all time range options', async () => {
    (getAgentServiceStats as jest.Mock).mockResolvedValue(mockAgentServiceStats);

    for (const timeRange of [TimeRange.Week, TimeRange.Month, TimeRange.Year, TimeRange.Forever]) {
      const input = {
        timeRange,
        userGroupId: 'all',
        userId: 'all',
      };

      const caller = contextStudioRouter.createCaller(mockCtx);
      await caller.getAgentServiceStats(input);

      expect(getAgentServiceStats).toHaveBeenCalledWith(
        timeRange,
        'all',
        'all',
      );
    }
  });

  it('throws an error if getAgentServiceStats fails', async () => {
    const mockError = new Error('Failed to fetch agent service statistics');
    (getAgentServiceStats as jest.Mock).mockRejectedValue(mockError);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getAgentServiceStats(input),
    ).rejects.toThrow(mockError.message);

    expect(getAgentServiceStats).toHaveBeenCalledWith(
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
      caller.getAgentServiceStats(input),
    ).rejects.toThrow();

    expect(getAgentServiceStats).not.toHaveBeenCalled();
  });

  it('rejects invalid userGroupId input', async () => {
    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'not-a-uuid',
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getAgentServiceStats(input),
    ).rejects.toThrow();

    expect(getAgentServiceStats).not.toHaveBeenCalled();
  });

  it('rejects invalid userId input', async () => {
    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'not-a-uuid',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getAgentServiceStats(input),
    ).rejects.toThrow();

    expect(getAgentServiceStats).not.toHaveBeenCalled();
  });

  it('requests the studio scope for the caller\'s group and user filters', async () => {
    (getAgentServiceStats as jest.Mock).mockResolvedValue(mockAgentServiceStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: mockUserId,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getAgentServiceStats(input);

    expect(scopeStudioQuery).toHaveBeenCalledWith(mockCtx, mockUserGroupId, mockUserId);
  });

  it('throws and does not call the DAL when the studio scope check rejects', async () => {
    const mockError = new Error('You do not have permission to access this resource');
    (scopeStudioQuery as jest.Mock).mockRejectedValue(mockError);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getAgentServiceStats(input),
    ).rejects.toThrow(mockError.message);

    expect(getAgentServiceStats).not.toHaveBeenCalled();
  });

  it('rejects a non-Admin caller before touching the DAL', async () => {
    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockNonAdminCtx);

    await expect(
      caller.getAgentServiceStats(input),
    ).rejects.toThrow();

    expect(scopeStudioQuery).not.toHaveBeenCalled();
    expect(getAgentServiceStats).not.toHaveBeenCalled();
  });
});
