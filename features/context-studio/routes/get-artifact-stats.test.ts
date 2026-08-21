import { ContextType } from '@/server/trpc-context';
import contextStudioRouter from '@/features/context-studio/routes';
import getArtifactStats from '@/features/context-studio/dal/getArtifactStats';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import { TimeRange, ArtifactStats } from '@/features/context-studio/types/context-studio';
import { UserRole } from '@/features/shared/types/user';

jest.mock('@/features/context-studio/dal/getArtifactStats');
jest.mock('@/features/context-studio/services/scopeStudioQuery');

describe('get-artifact-stats route', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const mockUserGroupId = '7b91f044-da78-43d4-91aa-5fbeffcb3e76';

  const mockCtx = {
    userId: mockUserId,
    userRole: UserRole.User,
  } as unknown as ContextType;

  const mockArtifactStats: ArtifactStats = {
    total: 60,
    chat: 40,
    workflow: 20,
    byType: [
      { type: 'document', count: 35 },
      { type: 'code', count: 25 },
    ],
    chatArtifacts: {
      total: 40,
      byType: [
        { type: 'document', count: 25 },
        { type: 'code', count: 15 },
      ],
      byCreationMethod: {
        modelOnly: {
          total: 30,
          byModel: [
            { modelId: 'gpt-4', modelName: 'GPT-4', count: 20 },
            { modelId: 'claude-3', modelName: 'Claude 3', count: 10 },
          ],
        },
        agentProvider: {
          total: 10,
          byAgentProvider: [
            { agentProviderId: 'openai', agentProviderName: 'OpenAI', count: 6 },
            { agentProviderId: 'anthropic', agentProviderName: 'Anthropic', count: 4 },
          ],
        },
      },
    },
    workflowArtifacts: {
      total: 20,
      byType: [
        { type: 'document', count: 10 },
        { type: 'code', count: 10 },
      ],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // This route only calls scopeStudioQuery for its throw-if-disallowed side
    // effect and always forwards the raw input to the DAL, so the resolved
    // value itself is irrelevant to every test below except the rejection case.
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: 'all' });
  });

  it('returns artifact stats for a specific time range and user group', async () => {
    (getArtifactStats as jest.Mock).mockResolvedValue(mockArtifactStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getArtifactStats(input);

    expect(response).toEqual(mockArtifactStats);
    expect(getArtifactStats).toHaveBeenCalledWith(
      TimeRange.Week,
      mockUserGroupId,
      'all',
      false,
    );
  });

  it('returns artifact stats for a specific user', async () => {
    (getArtifactStats as jest.Mock).mockResolvedValue(mockArtifactStats);

    const input = {
      timeRange: TimeRange.Month,
      userGroupId: 'all',
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getArtifactStats(input);

    expect(response).toEqual(mockArtifactStats);
    expect(getArtifactStats).toHaveBeenCalledWith(
      TimeRange.Month,
      'all',
      mockUserId,
      false,
    );
  });

  it('passes excludeAdmins through when enabled', async () => {
    (getArtifactStats as jest.Mock).mockResolvedValue(mockArtifactStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: true,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getArtifactStats(input);

    expect(getArtifactStats).toHaveBeenCalledWith(
      TimeRange.Week,
      'all',
      'all',
      true,
    );
  });

  it('defaults excludeAdmins to false when omitted', async () => {
    (getArtifactStats as jest.Mock).mockResolvedValue(mockArtifactStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getArtifactStats(input);

    expect(getArtifactStats).toHaveBeenCalledWith(
      TimeRange.Week,
      'all',
      'all',
      false,
    );
  });

  it('handles all time range options', async () => {
    (getArtifactStats as jest.Mock).mockResolvedValue(mockArtifactStats);

    for (const timeRange of [TimeRange.Week, TimeRange.Month, TimeRange.Year, TimeRange.Forever]) {
      const input = {
        timeRange,
        userGroupId: 'all',
        userId: 'all',
        excludeAdmins: false,
      };

      const caller = contextStudioRouter.createCaller(mockCtx);
      await caller.getArtifactStats(input);

      expect(getArtifactStats).toHaveBeenCalledWith(
        timeRange,
        'all',
        'all',
        false,
      );
    }
  });

  it('throws an error if getArtifactStats fails', async () => {
    const mockError = new Error('Failed to fetch artifact statistics');
    (getArtifactStats as jest.Mock).mockRejectedValue(mockError);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getArtifactStats(input),
    ).rejects.toThrow(mockError.message);

    expect(getArtifactStats).toHaveBeenCalledWith(
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
      caller.getArtifactStats(input),
    ).rejects.toThrow();

    expect(getArtifactStats).not.toHaveBeenCalled();
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
      caller.getArtifactStats(input),
    ).rejects.toThrow();

    expect(getArtifactStats).not.toHaveBeenCalled();
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
      caller.getArtifactStats(input),
    ).rejects.toThrow();

    expect(getArtifactStats).not.toHaveBeenCalled();
  });

  it('calls scopeStudioQuery with the requested scope', async () => {
    (getArtifactStats as jest.Mock).mockResolvedValue(mockArtifactStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getArtifactStats(input);

    expect(scopeStudioQuery).toHaveBeenCalledWith(mockCtx, mockUserGroupId, mockUserId);
  });

  it('throws and never calls getArtifactStats when scopeStudioQuery rejects', async () => {
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
      caller.getArtifactStats(input),
    ).rejects.toThrow(mockError.message);

    expect(getArtifactStats).not.toHaveBeenCalled();
  });
});
