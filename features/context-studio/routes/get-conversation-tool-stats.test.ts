import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import contextStudioRouter from '@/features/context-studio/routes';
import getConversationToolStats from '@/features/context-studio/dal/getConversationToolStats';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import { TimeRange, ConversationToolStats } from '@/features/context-studio/types/context-studio';

jest.mock('@/features/context-studio/dal/getConversationToolStats');
jest.mock('@/features/context-studio/services/scopeStudioQuery');

describe('get-conversation-tool-stats route', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const mockUserGroupId = '7b91f044-da78-43d4-91aa-5fbeffcb3e76';

  const mockCtx = {
    userId: mockUserId,
    userRole: UserRole.User,
  } as unknown as ContextType;

  const mockConversationToolStats: ConversationToolStats = {
    totalToolCalls: 80,
    byAgentService: [
      { agentService: 'LangGraph', totalToolCalls: 50, toolCallsByType: [{ toolName: 'search', count: 50 }] },
      { agentService: 'Claude', totalToolCalls: 30, toolCallsByType: [{ toolName: 'Read', count: 30 }] },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: 'all' });
  });

  it('returns conversation tool stats for a specific time range and user group', async () => {
    (getConversationToolStats as jest.Mock).mockResolvedValue(mockConversationToolStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getConversationToolStats(input);

    expect(response).toEqual(mockConversationToolStats);
    expect(getConversationToolStats).toHaveBeenCalledWith(
      TimeRange.Week,
      mockUserGroupId,
      'all',
      false,
    );
  });

  it('forwards excludeAdmins to the DAL', async () => {
    (getConversationToolStats as jest.Mock).mockResolvedValue(mockConversationToolStats);
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: mockUserId });

    const input = {
      timeRange: TimeRange.Month,
      userGroupId: 'all',
      userId: mockUserId,
      excludeAdmins: true,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getConversationToolStats(input);

    expect(getConversationToolStats).toHaveBeenCalledWith(
      TimeRange.Month,
      'all',
      mockUserId,
      true,
    );
  });

  it('throws an error if getConversationToolStats fails', async () => {
    const mockError = new Error('Failed to fetch conversation tool statistics');
    (getConversationToolStats as jest.Mock).mockRejectedValue(mockError);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getConversationToolStats(input),
    ).rejects.toThrow(mockError.message);
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
      caller.getConversationToolStats(input),
    ).rejects.toThrow();

    expect(getConversationToolStats).not.toHaveBeenCalled();
  });

  it('passes the restricted userId from scopeStudioQuery to the DAL, not the raw input', async () => {
    (getConversationToolStats as jest.Mock).mockResolvedValue(mockConversationToolStats);
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: mockUserId });

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getConversationToolStats(input);

    expect(getConversationToolStats).toHaveBeenCalledWith(
      TimeRange.Week,
      mockUserGroupId,
      mockUserId,
      false,
    );
  });

  it('requests the studio scope for the caller\'s group and user filters', async () => {
    (getConversationToolStats as jest.Mock).mockResolvedValue(mockConversationToolStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getConversationToolStats(input);

    expect(scopeStudioQuery).toHaveBeenCalledWith(mockCtx, mockUserGroupId, mockUserId);
  });

  it('throws and does not call the DAL when the studio scope check rejects', async () => {
    const mockError = new Error('You do not have permission to access this resource');
    (scopeStudioQuery as jest.Mock).mockRejectedValue(mockError);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getConversationToolStats(input),
    ).rejects.toThrow(mockError.message);

    expect(getConversationToolStats).not.toHaveBeenCalled();
  });
});
