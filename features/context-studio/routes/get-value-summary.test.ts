import { ContextType } from '@/server/trpc-context';
import contextStudioRouter from '@/features/context-studio/routes';
import getValueSummary from '@/features/context-studio/dal/getValueSummary';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import getStudioUserGroups from '@/features/context-studio/dal/getStudioUserGroups';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { ValueSummary } from '@/features/context-studio/types/value';
import { UseCase } from '@/features/shared/types/use-case';
import { UserRole } from '@/features/shared/types/user';

jest.mock('@/features/context-studio/dal/getValueSummary');
jest.mock('@/features/context-studio/services/scopeStudioQuery');
jest.mock('@/features/context-studio/dal/getStudioUserGroups');

describe('get-value-summary route', () => {
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

  const mockSummary: ValueSummary = {
    provisionedPeople: 40,
    activePeople: { value: 28, previous: 25 },
    returningPeople: { value: 19, previous: 16 },
    artifacts: { value: 214, previous: 160 },
    putToWork: { value: 96, previous: 71 },
    totalCost: 649.2,
    chatCost: 649.2,
    remainder: {
      platform: 0,
      workflow: 0,
      customAgent: 0,
      unattributed: 0,
    },
    systemCost: 0,
    costPerPutToWork: 6.7625,
    hoursInTool: 312.5,
    hoursPerPersonPerWeek: 2.8,
    byUseCase: [
      { useCase: UseCase.ProposalCapture, cost: 401.1, artifacts: 120, putToWork: 62 },
      { useCase: UseCase.PolicyCompliance, cost: 150.0, artifacts: 54, putToWork: 20 },
      { useCase: UseCase.ResearchAnalysis, cost: 80.1, artifacts: 30, putToWork: 9 },
      { useCase: UseCase.Unclassified, cost: 18.0, artifacts: 10, putToWork: 5 },
    ],
    byTeam: [
      {
        userGroupId: mockUserGroupId,
        label: 'Capture Team',
        activePeople: 12,
        members: 12,
        artifacts: 140,
        putToWork: 62,
        cost: 401.1,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: 'all' });
    (getStudioUserGroups as jest.Mock).mockResolvedValue([
      { id: mockUserGroupId, label: 'Capture Team', isLead: false },
    ]);
    (getValueSummary as jest.Mock).mockResolvedValue(mockSummary);
  });

  it('returns the value summary for a time range and user group', async () => {
    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getValueSummary({
      timeRange: TimeRange.Month,
      userGroupId: mockUserGroupId,
      userId: 'all',
      excludeAdmins: false,
    });

    expect(response).toEqual(mockSummary);
  });

  it('always excludes admins, whatever the input asks for', async () => {
    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getValueSummary({
      timeRange: TimeRange.Month,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: false,
    });

    expect(getValueSummary).toHaveBeenCalledWith(TimeRange.Month, 'all', 'all', true, [mockUserGroupId]);
  });

  it('forwards a single-user scope to the DAL', async () => {
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: mockUserId });

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getValueSummary({
      timeRange: TimeRange.Week,
      userGroupId: mockUserGroupId,
      userId: mockUserId,
      excludeAdmins: true,
    });

    expect(getValueSummary).toHaveBeenCalledWith(
      TimeRange.Week,
      mockUserGroupId,
      mockUserId,
      true,
      [mockUserGroupId],
    );
  });

  it('scopes the query before touching the DAL', async () => {
    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getValueSummary({
      timeRange: TimeRange.Month,
      userGroupId: mockUserGroupId,
      userId: 'all',
      excludeAdmins: true,
    });

    expect(scopeStudioQuery).toHaveBeenCalledWith(mockCtx, mockUserGroupId, 'all');
  });

  // getStudioUserGroups returns EVERY group in the org when told the viewer is an
  // Admin. Since Value is now Admin-only, the viewer reaching this line is always
  // an Admin, so the real role — not a hardcoded flag — has to reach the call.
  it('resolves visible groups with the viewer own admin status, not a hardcoded flag', async () => {
    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getValueSummary({
      timeRange: TimeRange.Month,
      userGroupId: 'all',
      userId: 'all',
      excludeAdmins: true,
    });

    expect(getStudioUserGroups).toHaveBeenCalledWith(mockCtx.userId, true);
  });

  it('rejects a non-Admin caller before touching the DAL', async () => {
    const caller = contextStudioRouter.createCaller(mockNonAdminCtx);

    await expect(
      caller.getValueSummary({
        timeRange: TimeRange.Month,
        userGroupId: 'all',
        userId: 'all',
        excludeAdmins: true,
      }),
    ).rejects.toThrow();

    expect(scopeStudioQuery).not.toHaveBeenCalled();
    expect(getValueSummary).not.toHaveBeenCalled();
  });

  it('does not query when scoping rejects', async () => {
    (scopeStudioQuery as jest.Mock).mockRejectedValue(new Error('Forbidden'));

    const caller = contextStudioRouter.createCaller(mockCtx);
    await expect(
      caller.getValueSummary({
        timeRange: TimeRange.Month,
        userGroupId: mockUserGroupId,
        userId: 'all',
        excludeAdmins: true,
      }),
    ).rejects.toThrow();

    expect(getValueSummary).not.toHaveBeenCalled();
  });

  it('propagates a DAL failure', async () => {
    (getValueSummary as jest.Mock).mockRejectedValue(
      new Error('Failed to fetch the Context Studio value summary'),
    );

    const caller = contextStudioRouter.createCaller(mockCtx);
    await expect(
      caller.getValueSummary({
        timeRange: TimeRange.Month,
        userGroupId: 'all',
        userId: 'all',
        excludeAdmins: true,
      }),
    ).rejects.toThrow('Failed to fetch the Context Studio value summary');
  });
});
