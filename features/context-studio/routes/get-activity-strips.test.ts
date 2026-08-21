import { ContextType } from '@/server/trpc-context';
import contextStudioRouter from '@/features/context-studio/routes';
import getActivityStrips from '@/features/context-studio/dal/getActivityStrips';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import { ActivityStats, TimeRange } from '@/features/context-studio/types/context-studio';
import { UserRole } from '@/features/shared/types/user';

jest.mock('@/features/context-studio/dal/getActivityStrips');
jest.mock('@/features/context-studio/services/scopeStudioQuery');

describe('get-activity-strips route', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const mockUserGroupId = '7b91f044-da78-43d4-91aa-5fbeffcb3e76';
  const mockViewerId = '2c1f6b0e-8d4a-4c1b-9f2e-3a5d7c9b1e4f';

  const mockCtx = {
    userId: mockViewerId,
    userRole: UserRole.User,
  } as unknown as ContextType;

  const mockActivityStats: ActivityStats = {
    rangeStart: '2026-07-20T00:00:00.000Z',
    rangeEnd: '2026-07-27T00:00:00.000Z',
    users: [
      { id: mockViewerId, name: 'Viewer', isSelf: true },
      { id: mockUserId, name: 'Other User' },
    ],
    sessions: [
      {
        id: 'session-1',
        userId: mockViewerId,
        userName: 'Viewer',
        startedAt: '2026-07-21T09:00:00.000Z',
        endedAt: '2026-07-21T09:20:00.000Z',
        eventCount: 12,
        path: ['Chat', 'Library', 'Context Studio'],
        startedBySignIn: true,
        endedBySignOut: true,
      },
      {
        id: 'session-2',
        userId: mockUserId,
        userName: 'Other User',
        startedAt: '2026-07-22T13:00:00.000Z',
        endedAt: '2026-07-22T13:05:00.000Z',
        eventCount: 3,
        path: ['Documents'],
        startedBySignIn: true,
        endedBySignOut: false,
      },
    ],
    totalSessions: 2,
    totalEvents: 15,
    userCount: 2,
    signedInSessions: 2,
    signedOutSessions: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (scopeStudioQuery as jest.Mock).mockImplementation((ctx, userGroupId, userId) => Promise.resolve({ isLead: false, restrictedUserId: userId }));
  });

  it('returns activity strips for a specific time range and user group', async () => {
    (getActivityStrips as jest.Mock).mockResolvedValue(mockActivityStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getActivityStrips(input);

    expect(response).toEqual(mockActivityStats);
    expect(getActivityStrips).toHaveBeenCalledWith(
      TimeRange.Week,
      mockUserGroupId,
      'all',
      false,
      mockViewerId,
    );
  });

  it('returns activity strips for a specific user', async () => {
    (getActivityStrips as jest.Mock).mockResolvedValue(mockActivityStats);

    const input = {
      timeRange: TimeRange.Month,
      userGroupId: 'all',
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getActivityStrips(input);

    expect(response).toEqual(mockActivityStats);
    expect(getActivityStrips).toHaveBeenCalledWith(
      TimeRange.Month,
      'all',
      mockUserId,
      false,
      mockViewerId,
    );
  });

  it('passes excludeAdmins through when enabled', async () => {
    (getActivityStrips as jest.Mock).mockResolvedValue(mockActivityStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: true,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getActivityStrips(input);

    expect(getActivityStrips).toHaveBeenCalledWith(
      TimeRange.Week,
      'all',
      'all',
      true,
      mockViewerId,
    );
  });

  it('defaults excludeAdmins to false when omitted', async () => {
    (getActivityStrips as jest.Mock).mockResolvedValue(mockActivityStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getActivityStrips(input);

    expect(getActivityStrips).toHaveBeenCalledWith(
      TimeRange.Week,
      'all',
      'all',
      false,
      mockViewerId,
    );
  });

  it('pins the signed-in viewer from the request context, not from the input', async () => {
    (getActivityStrips as jest.Mock).mockResolvedValue(mockActivityStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getActivityStrips(input);

    expect(getActivityStrips).toHaveBeenCalledWith(
      TimeRange.Week,
      'all',
      mockUserId,
      false,
      mockViewerId,
    );
  });

  it('handles all time range options', async () => {
    (getActivityStrips as jest.Mock).mockResolvedValue(mockActivityStats);

    for (const timeRange of [TimeRange.Week, TimeRange.Month, TimeRange.Year, TimeRange.Forever]) {
      const input = {
        timeRange,
        userGroupId: 'all',
        userId: 'all',
        excludeAdmins: false,
      };

      const caller = contextStudioRouter.createCaller(mockCtx);
      await caller.getActivityStrips(input);

      expect(getActivityStrips).toHaveBeenCalledWith(
        timeRange,
        'all',
        'all',
        false,
        mockViewerId,
      );
    }
  });

  it('throws an error if getActivityStrips fails', async () => {
    const mockError = new Error('Failed to fetch activity strips');
    (getActivityStrips as jest.Mock).mockRejectedValue(mockError);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getActivityStrips(input),
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
      caller.getActivityStrips(input),
    ).rejects.toThrow();

    expect(getActivityStrips).not.toHaveBeenCalled();
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
      caller.getActivityStrips(input),
    ).rejects.toThrow();

    expect(getActivityStrips).not.toHaveBeenCalled();
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
      caller.getActivityStrips(input),
    ).rejects.toThrow();

    expect(getActivityStrips).not.toHaveBeenCalled();
  });

  it('calls scopeStudioQuery with the request context and raw filter input', async () => {
    (getActivityStrips as jest.Mock).mockResolvedValue(mockActivityStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getActivityStrips(input);

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
      caller.getActivityStrips(input),
    ).rejects.toThrow(mockError.message);

    expect(getActivityStrips).not.toHaveBeenCalled();
  });

  it('passes the restrictedUserId scopeStudioQuery resolved, not the raw userId, to the DAL', async () => {
    const scopedRestrictedUserId = 'b2c3d4e5-f6a7-48b9-a0a1-23456789abcd';
    (scopeStudioQuery as jest.Mock).mockResolvedValue({
      isLead: false,
      restrictedUserId: scopedRestrictedUserId,
    });
    (getActivityStrips as jest.Mock).mockResolvedValue(mockActivityStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getActivityStrips(input);

    expect(getActivityStrips).toHaveBeenCalledWith(
      TimeRange.Week,
      mockUserGroupId,
      scopedRestrictedUserId,
      false,
      mockViewerId,
    );
  });
});
