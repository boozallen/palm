import { ContextType } from '@/server/trpc-context';
import contextStudioRouter from '@/features/context-studio/routes';
import getPageTransitions from '@/features/context-studio/dal/getPageTransitions';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import { PageTransitionStats, TimeRange } from '@/features/context-studio/types/context-studio';
import { UserRole } from '@/features/shared/types/user';

jest.mock('@/features/context-studio/dal/getPageTransitions');
jest.mock('@/features/context-studio/services/scopeStudioQuery');

describe('get-page-transitions route', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const mockUserGroupId = '7b91f044-da78-43d4-91aa-5fbeffcb3e76';

  const mockCtx = {
    userId: mockUserId,
    userRole: UserRole.User,
  } as unknown as ContextType;

  const mockPageTransitionStats: PageTransitionStats = {
    pages: ['Chat', 'Library', 'Documents', 'Other'],
    shortLabels: {
      Chat: 'CH',
      Library: 'LIB',
      Documents: 'DOC',
      Other: 'OTH',
    },
    matrix: {
      Chat: { Library: 12, Documents: 3 },
      Library: { Chat: 9 },
      Documents: { Chat: 2, Other: 1 },
      Other: {},
    },
    totalTransitions: 27,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // This route only calls scopeStudioQuery for its throw-if-disallowed side
    // effect and always forwards the raw input to the DAL, so the resolved
    // value itself is irrelevant to every test below except the rejection case.
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: 'all' });
  });

  it('returns page transitions for a specific time range and user group', async () => {
    (getPageTransitions as jest.Mock).mockResolvedValue(mockPageTransitionStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getPageTransitions(input);

    expect(response).toEqual(mockPageTransitionStats);
    expect(getPageTransitions).toHaveBeenCalledWith(
      TimeRange.Week,
      mockUserGroupId,
      'all',
      false,
    );
  });

  it('returns page transitions for a specific user', async () => {
    (getPageTransitions as jest.Mock).mockResolvedValue(mockPageTransitionStats);

    const input = {
      timeRange: TimeRange.Month,
      userGroupId: 'all',
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getPageTransitions(input);

    expect(response).toEqual(mockPageTransitionStats);
    expect(getPageTransitions).toHaveBeenCalledWith(
      TimeRange.Month,
      'all',
      mockUserId,
      false,
    );
  });

  it('passes excludeAdmins through when enabled', async () => {
    (getPageTransitions as jest.Mock).mockResolvedValue(mockPageTransitionStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: true,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getPageTransitions(input);

    expect(getPageTransitions).toHaveBeenCalledWith(
      TimeRange.Week,
      'all',
      'all',
      true,
    );
  });

  it('defaults excludeAdmins to false when omitted', async () => {
    (getPageTransitions as jest.Mock).mockResolvedValue(mockPageTransitionStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getPageTransitions(input);

    expect(getPageTransitions).toHaveBeenCalledWith(
      TimeRange.Week,
      'all',
      'all',
      false,
    );
  });

  it('handles all time range options', async () => {
    (getPageTransitions as jest.Mock).mockResolvedValue(mockPageTransitionStats);

    for (const timeRange of [TimeRange.Week, TimeRange.Month, TimeRange.Year, TimeRange.Forever]) {
      const input = {
        timeRange,
        userGroupId: 'all',
        userId: 'all',
        excludeAdmins: false,
      };

      const caller = contextStudioRouter.createCaller(mockCtx);
      await caller.getPageTransitions(input);

      expect(getPageTransitions).toHaveBeenCalledWith(
        timeRange,
        'all',
        'all',
        false,
      );
    }
  });

  it('returns an empty matrix when no navigations match', async () => {
    const emptyStats: PageTransitionStats = {
      pages: [],
      shortLabels: {},
      matrix: {},
      totalTransitions: 0,
    };
    (getPageTransitions as jest.Mock).mockResolvedValue(emptyStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getPageTransitions(input);

    expect(response).toEqual(emptyStats);
  });

  it('throws an error if getPageTransitions fails', async () => {
    const mockError = new Error('Failed to fetch page transition statistics');
    (getPageTransitions as jest.Mock).mockRejectedValue(mockError);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getPageTransitions(input),
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
      caller.getPageTransitions(input),
    ).rejects.toThrow();

    expect(getPageTransitions).not.toHaveBeenCalled();
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
      caller.getPageTransitions(input),
    ).rejects.toThrow();

    expect(getPageTransitions).not.toHaveBeenCalled();
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
      caller.getPageTransitions(input),
    ).rejects.toThrow();

    expect(getPageTransitions).not.toHaveBeenCalled();
  });

  it('calls scopeStudioQuery with the request context and raw filter input', async () => {
    (getPageTransitions as jest.Mock).mockResolvedValue(mockPageTransitionStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getPageTransitions(input);

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
      caller.getPageTransitions(input),
    ).rejects.toThrow(mockError.message);

    expect(getPageTransitions).not.toHaveBeenCalled();
  });
});
