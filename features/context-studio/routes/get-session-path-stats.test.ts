import { ContextType } from '@/server/trpc-context';
import contextStudioRouter from '@/features/context-studio/routes';
import getSessionPathStats from '@/features/context-studio/dal/getSessionPathStats';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import { SessionPathStats, TimeRange } from '@/features/context-studio/types/context-studio';
import { UserRole } from '@/features/shared/types/user';

jest.mock('@/features/context-studio/dal/getSessionPathStats');
jest.mock('@/features/context-studio/services/scopeStudioQuery');

describe('get-session-path-stats route', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const mockUserGroupId = '7b91f044-da78-43d4-91aa-5fbeffcb3e76';

  const mockCtx = {
    userId: mockUserId,
    userRole: UserRole.User,
  } as unknown as ContextType;

  const mockSessionPathStats: SessionPathStats = {
    paths: [
      {
        id: 'path-1',
        count: 18,
        steps: ['Chat', 'Library', 'Chat'],
        sampleUser: 'Ada Lovelace',
        window: '09:12–09:41',
      },
      {
        id: 'path-2',
        count: 7,
        steps: ['Documents', 'Context Studio'],
        sampleUser: 'Grace Hopper',
        window: '13:02–13:20',
      },
      {
        id: 'other',
        count: 4,
        steps: [],
        sampleUser: '',
        window: '',
        isOther: true,
      },
    ],
    totalSessions: 29,
    totalEvents: 310,
    totalNavigations: 145,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (scopeStudioQuery as jest.Mock).mockImplementation((ctx, userGroupId, userId) => Promise.resolve({ isLead: false, restrictedUserId: userId }));
  });

  it('returns session path stats for a specific time range and user group', async () => {
    (getSessionPathStats as jest.Mock).mockResolvedValue(mockSessionPathStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getSessionPathStats(input);

    expect(response).toEqual(mockSessionPathStats);
    expect(getSessionPathStats).toHaveBeenCalledWith(
      TimeRange.Week,
      mockUserGroupId,
      'all',
      false,
    );
  });

  it('returns session path stats for a specific user', async () => {
    (getSessionPathStats as jest.Mock).mockResolvedValue(mockSessionPathStats);

    const input = {
      timeRange: TimeRange.Month,
      userGroupId: 'all',
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getSessionPathStats(input);

    expect(response).toEqual(mockSessionPathStats);
    expect(getSessionPathStats).toHaveBeenCalledWith(
      TimeRange.Month,
      'all',
      mockUserId,
      false,
    );
  });

  it('passes excludeAdmins through when enabled', async () => {
    (getSessionPathStats as jest.Mock).mockResolvedValue(mockSessionPathStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: true,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getSessionPathStats(input);

    expect(getSessionPathStats).toHaveBeenCalledWith(
      TimeRange.Week,
      'all',
      'all',
      true,
    );
  });

  it('defaults excludeAdmins to false when omitted', async () => {
    (getSessionPathStats as jest.Mock).mockResolvedValue(mockSessionPathStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getSessionPathStats(input);

    expect(getSessionPathStats).toHaveBeenCalledWith(
      TimeRange.Week,
      'all',
      'all',
      false,
    );
  });

  it('handles all time range options', async () => {
    (getSessionPathStats as jest.Mock).mockResolvedValue(mockSessionPathStats);

    for (const timeRange of [TimeRange.Week, TimeRange.Month, TimeRange.Year, TimeRange.Forever]) {
      const input = {
        timeRange,
        userGroupId: 'all',
        userId: 'all',
        excludeAdmins: false,
      };

      const caller = contextStudioRouter.createCaller(mockCtx);
      await caller.getSessionPathStats(input);

      expect(getSessionPathStats).toHaveBeenCalledWith(
        timeRange,
        'all',
        'all',
        false,
      );
    }
  });

  it('returns empty path stats when no sessions match', async () => {
    const emptyStats: SessionPathStats = {
      paths: [],
      totalSessions: 0,
      totalEvents: 0,
      totalNavigations: 0,
    };
    (getSessionPathStats as jest.Mock).mockResolvedValue(emptyStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getSessionPathStats(input);

    expect(response).toEqual(emptyStats);
  });

  it('throws an error if getSessionPathStats fails', async () => {
    const mockError = new Error('Failed to fetch session path statistics');
    (getSessionPathStats as jest.Mock).mockRejectedValue(mockError);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getSessionPathStats(input),
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
      caller.getSessionPathStats(input),
    ).rejects.toThrow();

    expect(getSessionPathStats).not.toHaveBeenCalled();
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
      caller.getSessionPathStats(input),
    ).rejects.toThrow();

    expect(getSessionPathStats).not.toHaveBeenCalled();
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
      caller.getSessionPathStats(input),
    ).rejects.toThrow();

    expect(getSessionPathStats).not.toHaveBeenCalled();
  });

  it('calls scopeStudioQuery with the request context and raw filter input', async () => {
    (getSessionPathStats as jest.Mock).mockResolvedValue(mockSessionPathStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getSessionPathStats(input);

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
      caller.getSessionPathStats(input),
    ).rejects.toThrow(mockError.message);

    expect(getSessionPathStats).not.toHaveBeenCalled();
  });

  it('passes the restrictedUserId scopeStudioQuery resolved, not the raw userId, to the DAL', async () => {
    const scopedRestrictedUserId = 'b2c3d4e5-f6a7-48b9-a0a1-23456789abcd';
    (scopeStudioQuery as jest.Mock).mockResolvedValue({
      isLead: false,
      restrictedUserId: scopedRestrictedUserId,
    });
    (getSessionPathStats as jest.Mock).mockResolvedValue(mockSessionPathStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getSessionPathStats(input);

    expect(getSessionPathStats).toHaveBeenCalledWith(
      TimeRange.Week,
      mockUserGroupId,
      scopedRestrictedUserId,
      false,
    );
  });
});
