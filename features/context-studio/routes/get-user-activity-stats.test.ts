import { ContextType } from '@/server/trpc-context';
import contextStudioRouter from '@/features/context-studio/routes';
import getUserActivityStats from '@/features/context-studio/dal/getUserActivityStats';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import { TimeRange, UserActivityStats } from '@/features/context-studio/types/context-studio';
import { UserRole } from '@/features/shared/types/user';

jest.mock('@/features/context-studio/dal/getUserActivityStats');
jest.mock('@/features/context-studio/services/scopeStudioQuery');

describe('get-user-activity-stats route', () => {
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

  const mockUserActivityStats: UserActivityStats = {
    totalUsers: 50,
    userGroups: 4,
    logins: 200,
    totalSessions: 220,
    newUsersThisWeek: 3,
    newUsersPreviousWeek: 2,
    auditLogins: 200,
    auditUniqueUsers: 45,
    auditLoginsBlocked: 1,
    joinCodeUses: 5,
    userCreatedCount: 50,
    earliestUserCreatedDate: '2026-01-01T00:00:00.000Z',
    userActivityTimeSeries: [{ date: '2026-07-21', logins: 10, sessions: 12, newUsers: 1 }],
    auditLoginTimeSeries: [{ date: '2026-07-21', loginCount: 10 }],
    auditLoginBlockedTimeSeries: [{ date: '2026-07-21', loginCount: 0 }],
    userCreatedTimeSeries: [{ date: '2026-07-21', count: 1 }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: 'all' });
  });

  it('returns user activity stats for a specific time range and user group', async () => {
    (getUserActivityStats as jest.Mock).mockResolvedValue(mockUserActivityStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getUserActivityStats(input);

    expect(response).toEqual(mockUserActivityStats);
    expect(getUserActivityStats).toHaveBeenCalledWith(
      TimeRange.Week,
      mockUserGroupId,
      'all',
      false,
    );
  });

  it('returns user activity stats for a specific user', async () => {
    (getUserActivityStats as jest.Mock).mockResolvedValue(mockUserActivityStats);
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: mockUserId });

    const input = {
      timeRange: TimeRange.Month,
      userGroupId: 'all',
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getUserActivityStats(input);

    expect(response).toEqual(mockUserActivityStats);
    expect(getUserActivityStats).toHaveBeenCalledWith(
      TimeRange.Month,
      'all',
      mockUserId,
      false,
    );
  });

  it('passes excludeAdmins through when enabled', async () => {
    (getUserActivityStats as jest.Mock).mockResolvedValue(mockUserActivityStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: true,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getUserActivityStats(input);

    expect(getUserActivityStats).toHaveBeenCalledWith(
      TimeRange.Week,
      'all',
      'all',
      true,
    );
  });

  it('defaults excludeAdmins to false when omitted', async () => {
    (getUserActivityStats as jest.Mock).mockResolvedValue(mockUserActivityStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getUserActivityStats(input);

    expect(getUserActivityStats).toHaveBeenCalledWith(
      TimeRange.Week,
      'all',
      'all',
      false,
    );
  });

  it('handles all time range options', async () => {
    (getUserActivityStats as jest.Mock).mockResolvedValue(mockUserActivityStats);

    for (const timeRange of [TimeRange.Week, TimeRange.Month, TimeRange.Year, TimeRange.Forever]) {
      const input = {
        timeRange,
        userGroupId: 'all',
        userId: 'all',
        excludeAdmins: false,
      };

      const caller = contextStudioRouter.createCaller(mockCtx);
      await caller.getUserActivityStats(input);

      expect(getUserActivityStats).toHaveBeenCalledWith(
        timeRange,
        'all',
        'all',
        false,
      );
    }
  });

  it('throws an error if getUserActivityStats fails', async () => {
    const mockError = new Error('Failed to fetch user activity statistics');
    (getUserActivityStats as jest.Mock).mockRejectedValue(mockError);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getUserActivityStats(input),
    ).rejects.toThrow(mockError.message);

    expect(getUserActivityStats).toHaveBeenCalledWith(
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
      caller.getUserActivityStats(input),
    ).rejects.toThrow();

    expect(getUserActivityStats).not.toHaveBeenCalled();
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
      caller.getUserActivityStats(input),
    ).rejects.toThrow();

    expect(getUserActivityStats).not.toHaveBeenCalled();
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
      caller.getUserActivityStats(input),
    ).rejects.toThrow();

    expect(getUserActivityStats).not.toHaveBeenCalled();
  });

  it('calls scopeStudioQuery with the request context and raw filter input', async () => {
    (getUserActivityStats as jest.Mock).mockResolvedValue(mockUserActivityStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getUserActivityStats(input);

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
      caller.getUserActivityStats(input),
    ).rejects.toThrow(mockError.message);

    expect(getUserActivityStats).not.toHaveBeenCalled();
  });

  it('rejects a non-Admin caller before touching the DAL', async () => {
    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockNonAdminCtx);

    await expect(
      caller.getUserActivityStats(input),
    ).rejects.toThrow();

    expect(scopeStudioQuery).not.toHaveBeenCalled();
    expect(getUserActivityStats).not.toHaveBeenCalled();
  });
});
