import { ContextType } from '@/server/trpc-context';
import contextStudioRouter from '@/features/context-studio/routes';
import getUserActivity from '@/features/context-studio/dal/getUserActivity';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import { TimeRange, UserTrailStats } from '@/features/context-studio/types/context-studio';
import { UserRole } from '@/features/shared/types/user';

jest.mock('@/features/context-studio/dal/getUserActivity');
jest.mock('@/features/context-studio/services/scopeStudioQuery');

describe('get-user-activity route', () => {
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

  const mockUserTrailStats: UserTrailStats = {
    userId: mockUserId,
    userName: 'Ada Lovelace',
    totalRecords: 120,
    meaningfulRecords: 34,
    errorRecords: 2,
    entries: [
      {
        kind: 'event',
        id: 'entry-1',
        event: 'CHAT_CREATED',
        label: 'Chat created',
        description: 'Started a new chat',
        outcome: 'SUCCESS',
        timestamp: '2026-07-21T09:00:00.000Z',
        idleBeforeMs: 0,
      },
      {
        kind: 'run',
        id: 'entry-2',
        count: 14,
        hrefs: ['/chat', '/library'],
        startedAt: '2026-07-21T09:01:00.000Z',
        endedAt: '2026-07-21T09:06:00.000Z',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Most tests below name a specific user, so the default mock mirrors that;
    // the 'all' test overrides it to match.
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: mockUserId });
  });

  it('returns the audit trail for a specific user', async () => {
    (getUserActivity as jest.Mock).mockResolvedValue(mockUserTrailStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getUserActivity(input);

    expect(response).toEqual(mockUserTrailStats);
    expect(getUserActivity).toHaveBeenCalledWith(
      TimeRange.Week,
      mockUserGroupId,
      mockUserId,
      false,
    );
  });

  it('forwards a userId of all so the DAL can return the empty trail', async () => {
    const emptyTrail: UserTrailStats = {
      userId: 'all',
      userName: null,
      totalRecords: 0,
      meaningfulRecords: 0,
      errorRecords: 0,
      entries: [],
    };
    (getUserActivity as jest.Mock).mockResolvedValue(emptyTrail);
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: 'all' });

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getUserActivity(input);

    expect(response).toEqual(emptyTrail);
    expect(getUserActivity).toHaveBeenCalledWith(
      TimeRange.Week,
      'all',
      'all',
      false,
    );
  });

  it('passes excludeAdmins through when enabled', async () => {
    (getUserActivity as jest.Mock).mockResolvedValue(mockUserTrailStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: mockUserId,
      excludeAdmins: true,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getUserActivity(input);

    expect(getUserActivity).toHaveBeenCalledWith(
      TimeRange.Week,
      'all',
      mockUserId,
      true,
    );
  });

  it('defaults excludeAdmins to false when omitted', async () => {
    (getUserActivity as jest.Mock).mockResolvedValue(mockUserTrailStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: mockUserId,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getUserActivity(input);

    expect(getUserActivity).toHaveBeenCalledWith(
      TimeRange.Week,
      'all',
      mockUserId,
      false,
    );
  });

  it('handles all time range options', async () => {
    (getUserActivity as jest.Mock).mockResolvedValue(mockUserTrailStats);

    for (const timeRange of [TimeRange.Week, TimeRange.Month, TimeRange.Year, TimeRange.Forever]) {
      const input = {
        timeRange,
        userGroupId: 'all',
        userId: mockUserId,
        excludeAdmins: false,
      };

      const caller = contextStudioRouter.createCaller(mockCtx);
      await caller.getUserActivity(input);

      expect(getUserActivity).toHaveBeenCalledWith(
        timeRange,
        'all',
        mockUserId,
        false,
      );
    }
  });

  it('throws an error if getUserActivity fails', async () => {
    const mockError = new Error('Failed to fetch user activity');
    (getUserActivity as jest.Mock).mockRejectedValue(mockError);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getUserActivity(input),
    ).rejects.toThrow(mockError.message);
  });

  it('rejects invalid timeRange input', async () => {
    const input = {
      timeRange: 'invalid' as TimeRange,
      userGroupId: 'all',
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getUserActivity(input),
    ).rejects.toThrow();

    expect(getUserActivity).not.toHaveBeenCalled();
  });

  it('rejects invalid userGroupId input', async () => {
    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'not-a-uuid',
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getUserActivity(input),
    ).rejects.toThrow();

    expect(getUserActivity).not.toHaveBeenCalled();
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
      caller.getUserActivity(input),
    ).rejects.toThrow();

    expect(getUserActivity).not.toHaveBeenCalled();
  });

  it('calls scopeStudioQuery with the request context and raw filter input', async () => {
    (getUserActivity as jest.Mock).mockResolvedValue(mockUserTrailStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getUserActivity(input);

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
      caller.getUserActivity(input),
    ).rejects.toThrow(mockError.message);

    expect(getUserActivity).not.toHaveBeenCalled();
  });

  it('rejects a non-Admin caller before touching the DAL', async () => {
    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockNonAdminCtx);

    await expect(
      caller.getUserActivity(input),
    ).rejects.toThrow();

    expect(scopeStudioQuery).not.toHaveBeenCalled();
    expect(getUserActivity).not.toHaveBeenCalled();
  });
});
