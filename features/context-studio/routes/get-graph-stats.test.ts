import { ContextType } from '@/server/trpc-context';
import contextStudioRouter from '@/features/context-studio/routes';
import getGraphStats from '@/features/context-studio/dal/getGraphStats';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import { TimeRange, GraphStats } from '@/features/context-studio/types/context-studio';
import { UserRole } from '@/features/shared/types/user';

jest.mock('@/features/context-studio/dal/getGraphStats');
jest.mock('@/features/context-studio/services/scopeStudioQuery');

describe('get-graph-stats route', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const mockUserGroupId = '7b91f044-da78-43d4-91aa-5fbeffcb3e76';

  const mockCtx = {
    userId: mockUserId,
    userRole: UserRole.User,
  } as unknown as ContextType;

  const mockGraphStats: GraphStats = {
    entities: 120,
    concepts: 45,
    graphsBuilt: 8,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // This route only calls scopeStudioQuery for its throw-if-disallowed side
    // effect and always forwards the raw input to the DAL, so the resolved
    // value itself is irrelevant to every test below except the rejection case.
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: 'all' });
  });

  it('returns graph stats for a specific time range and user group', async () => {
    (getGraphStats as jest.Mock).mockResolvedValue(mockGraphStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getGraphStats(input);

    expect(response).toEqual(mockGraphStats);
    expect(getGraphStats).toHaveBeenCalledWith(
      TimeRange.Week,
      mockUserGroupId,
      'all',
    );
  });

  it('returns graph stats for a specific user', async () => {
    (getGraphStats as jest.Mock).mockResolvedValue(mockGraphStats);

    const input = {
      timeRange: TimeRange.Month,
      userGroupId: 'all',
      userId: mockUserId,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getGraphStats(input);

    expect(response).toEqual(mockGraphStats);
    expect(getGraphStats).toHaveBeenCalledWith(
      TimeRange.Month,
      'all',
      mockUserId,
    );
  });

  it('handles all time range options', async () => {
    (getGraphStats as jest.Mock).mockResolvedValue(mockGraphStats);

    for (const timeRange of [TimeRange.Week, TimeRange.Month, TimeRange.Year, TimeRange.Forever]) {
      const input = {
        timeRange,
        userGroupId: 'all',
        userId: 'all',
      };

      const caller = contextStudioRouter.createCaller(mockCtx);
      await caller.getGraphStats(input);

      expect(getGraphStats).toHaveBeenCalledWith(
        timeRange,
        'all',
        'all',
      );
    }
  });

  it('throws an error if getGraphStats fails', async () => {
    const mockError = new Error('Failed to fetch graph statistics');
    (getGraphStats as jest.Mock).mockRejectedValue(mockError);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getGraphStats(input),
    ).rejects.toThrow(mockError.message);

    expect(getGraphStats).toHaveBeenCalledWith(
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
      caller.getGraphStats(input),
    ).rejects.toThrow();

    expect(getGraphStats).not.toHaveBeenCalled();
  });

  it('rejects invalid userGroupId input', async () => {
    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'not-a-uuid',
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getGraphStats(input),
    ).rejects.toThrow();

    expect(getGraphStats).not.toHaveBeenCalled();
  });

  it('rejects invalid userId input', async () => {
    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'not-a-uuid',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getGraphStats(input),
    ).rejects.toThrow();

    expect(getGraphStats).not.toHaveBeenCalled();
  });

  it('calls scopeStudioQuery with the requested scope', async () => {
    (getGraphStats as jest.Mock).mockResolvedValue(mockGraphStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: mockUserId,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getGraphStats(input);

    expect(scopeStudioQuery).toHaveBeenCalledWith(mockCtx, mockUserGroupId, mockUserId);
  });

  it('throws and never calls getGraphStats when scopeStudioQuery rejects', async () => {
    const mockError = new Error('You do not have permission to access this resource');
    (scopeStudioQuery as jest.Mock).mockRejectedValue(mockError);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getGraphStats(input),
    ).rejects.toThrow(mockError.message);

    expect(getGraphStats).not.toHaveBeenCalled();
  });
});
