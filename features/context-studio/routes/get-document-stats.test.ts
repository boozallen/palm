import { ContextType } from '@/server/trpc-context';
import contextStudioRouter from '@/features/context-studio/routes';
import getDocumentStats from '@/features/context-studio/dal/getDocumentStats';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import { TimeRange, DocumentStats } from '@/features/context-studio/types/context-studio';
import { UserRole } from '@/features/shared/types/user';

jest.mock('@/features/context-studio/dal/getDocumentStats');
jest.mock('@/features/context-studio/services/scopeStudioQuery');

describe('get-document-stats route', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const mockUserGroupId = '7b91f044-da78-43d4-91aa-5fbeffcb3e76';

  const mockCtx = {
    userId: mockUserId,
    userRole: UserRole.User,
  } as unknown as ContextType;

  const mockDocumentStats: DocumentStats = {
    total: 30,
    shared: 12,
    accepted: 9,
    rejected: 3,
    embeddings: {
      total: 18,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // This route only calls scopeStudioQuery for its throw-if-disallowed side
    // effect and always forwards the raw input to the DAL, so the resolved
    // value itself is irrelevant to every test below except the rejection case.
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: 'all' });
  });

  it('returns document stats for a specific time range and user group', async () => {
    (getDocumentStats as jest.Mock).mockResolvedValue(mockDocumentStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getDocumentStats(input);

    expect(response).toEqual(mockDocumentStats);
    expect(getDocumentStats).toHaveBeenCalledWith(
      TimeRange.Week,
      mockUserGroupId,
      'all',
      false,
    );
  });

  it('returns document stats for a specific user', async () => {
    (getDocumentStats as jest.Mock).mockResolvedValue(mockDocumentStats);

    const input = {
      timeRange: TimeRange.Month,
      userGroupId: 'all',
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getDocumentStats(input);

    expect(response).toEqual(mockDocumentStats);
    expect(getDocumentStats).toHaveBeenCalledWith(
      TimeRange.Month,
      'all',
      mockUserId,
      false,
    );
  });

  it('passes excludeAdmins through when enabled', async () => {
    (getDocumentStats as jest.Mock).mockResolvedValue(mockDocumentStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: true,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getDocumentStats(input);

    expect(getDocumentStats).toHaveBeenCalledWith(
      TimeRange.Week,
      'all',
      'all',
      true,
    );
  });

  it('defaults excludeAdmins to false when omitted', async () => {
    (getDocumentStats as jest.Mock).mockResolvedValue(mockDocumentStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getDocumentStats(input);

    expect(getDocumentStats).toHaveBeenCalledWith(
      TimeRange.Week,
      'all',
      'all',
      false,
    );
  });

  it('handles all time range options', async () => {
    (getDocumentStats as jest.Mock).mockResolvedValue(mockDocumentStats);

    for (const timeRange of [TimeRange.Week, TimeRange.Month, TimeRange.Year, TimeRange.Forever]) {
      const input = {
        timeRange,
        userGroupId: 'all',
        userId: 'all',
        excludeAdmins: false,
      };

      const caller = contextStudioRouter.createCaller(mockCtx);
      await caller.getDocumentStats(input);

      expect(getDocumentStats).toHaveBeenCalledWith(
        timeRange,
        'all',
        'all',
        false,
      );
    }
  });

  it('throws an error if getDocumentStats fails', async () => {
    const mockError = new Error('Failed to fetch document statistics');
    (getDocumentStats as jest.Mock).mockRejectedValue(mockError);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);

    await expect(
      caller.getDocumentStats(input),
    ).rejects.toThrow(mockError.message);

    expect(getDocumentStats).toHaveBeenCalledWith(
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
      caller.getDocumentStats(input),
    ).rejects.toThrow();

    expect(getDocumentStats).not.toHaveBeenCalled();
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
      caller.getDocumentStats(input),
    ).rejects.toThrow();

    expect(getDocumentStats).not.toHaveBeenCalled();
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
      caller.getDocumentStats(input),
    ).rejects.toThrow();

    expect(getDocumentStats).not.toHaveBeenCalled();
  });

  it('calls scopeStudioQuery with the requested scope', async () => {
    (getDocumentStats as jest.Mock).mockResolvedValue(mockDocumentStats);

    const input = {
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: mockUserId,
      excludeAdmins: false,
    };

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getDocumentStats(input);

    expect(scopeStudioQuery).toHaveBeenCalledWith(mockCtx, mockUserGroupId, mockUserId);
  });

  it('throws and never calls getDocumentStats when scopeStudioQuery rejects', async () => {
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
      caller.getDocumentStats(input),
    ).rejects.toThrow(mockError.message);

    expect(getDocumentStats).not.toHaveBeenCalled();
  });
});
