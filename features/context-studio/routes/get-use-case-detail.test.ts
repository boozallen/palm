import { ContextType } from '@/server/trpc-context';
import contextStudioRouter from '@/features/context-studio/routes';
import getUseCaseDetail from '@/features/context-studio/dal/getUseCaseDetail';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { UseCase } from '@/features/shared/types/use-case';
import { UserRole } from '@/features/shared/types/user';
import { UseCaseDetail } from '@/features/context-studio/types/use-case-detail';

jest.mock('@/features/context-studio/dal/getUseCaseDetail');
jest.mock('@/features/context-studio/services/scopeStudioQuery');

describe('get-use-case-detail route', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const mockUserGroupId = '7b91f044-da78-43d4-91aa-5fbeffcb3e76';

  const mockCtx = {
    userId: mockUserId,
    userRole: UserRole.User,
  } as unknown as ContextType;

  const mockDetail: UseCaseDetail = {
    useCase: UseCase.Engineering,
    cost: 150.5,
    artifacts: 42,
    putToWork: 28,
    totalChats: 15,
    chats: [],
    people: [],
    teams: [],
    artifactList: [],
    weekly: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Pass-through by default so argument-forwarding assertions below see the scope
    // unchanged; individual tests override this to exercise scoping.
    (scopeStudioQuery as jest.Mock).mockImplementation((_ctx, _userGroupId, userId) =>
      Promise.resolve({ isLead: false, restrictedUserId: userId }));
    (getUseCaseDetail as jest.Mock).mockResolvedValue(mockDetail);
  });

  it('scopes the query to the caller before reading', async () => {
    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getUseCaseDetail({
      timeRange: TimeRange.Month,
      userGroupId: mockUserGroupId,
      userId: 'all',
      excludeAdmins: false,
      useCase: UseCase.Engineering,
    });

    expect(scopeStudioQuery).toHaveBeenCalledWith(mockCtx, mockUserGroupId, 'all');
  });

  it('excludes admin users regardless of what the client sent', async () => {
    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getUseCaseDetail({
      timeRange: TimeRange.Month,
      userGroupId: mockUserGroupId,
      userId: 'all',
      excludeAdmins: false,
      useCase: UseCase.Engineering,
    });

    expect(getUseCaseDetail).toHaveBeenCalledWith(
      UseCase.Engineering,
      TimeRange.Month,
      mockUserGroupId,
      'all',
      true,
    );
  });

  it('passes the clicked category through to the DAL', async () => {
    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getUseCaseDetail({
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: mockUserId,
      excludeAdmins: true,
      useCase: UseCase.Engineering,
    });

    expect(getUseCaseDetail).toHaveBeenCalledWith(
      UseCase.Engineering,
      TimeRange.Week,
      mockUserGroupId,
      mockUserId,
      true,
    );
  });

  it('returns the detail payload', async () => {
    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getUseCaseDetail({
      timeRange: TimeRange.Month,
      userGroupId: mockUserGroupId,
      userId: 'all',
      excludeAdmins: false,
      useCase: UseCase.Engineering,
    });

    expect(response).toEqual(mockDetail);
  });

  // The drawer names chats, owners and emails, so a plain member asking for 'all'
  // must see only their own rows rather than the whole org's.
  it('passes the scoped restrictedUserId, not the raw input, to the DAL', async () => {
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: mockUserId });

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getUseCaseDetail({
      timeRange: TimeRange.Month,
      userGroupId: mockUserGroupId,
      userId: 'all',
      excludeAdmins: false,
      useCase: UseCase.Engineering,
    });

    expect(getUseCaseDetail).toHaveBeenCalledWith(
      UseCase.Engineering,
      TimeRange.Month,
      mockUserGroupId,
      mockUserId,
      true,
    );
  });

  it('does not query when scoping rejects', async () => {
    (scopeStudioQuery as jest.Mock).mockRejectedValue(new Error('Forbidden'));

    const caller = contextStudioRouter.createCaller(mockCtx);
    await expect(
      caller.getUseCaseDetail({
        timeRange: TimeRange.Month,
        userGroupId: mockUserGroupId,
        userId: 'all',
        excludeAdmins: true,
        useCase: UseCase.Engineering,
      }),
    ).rejects.toThrow();

    expect(getUseCaseDetail).not.toHaveBeenCalled();
  });
});
