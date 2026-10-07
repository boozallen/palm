import { UserRole } from '@/features/shared/types/user';
import { ContextType } from '@/server/trpc-context';
import getUsageRecords from '@/features/context-studio/dal/getUsageRecords';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import contextStudioRouter from '@/features/context-studio/routes/index';
import { InitiatedBy } from '@/features/context-studio/types/cost';
import { TimeRange } from '@/features/context-studio/types/context-studio';

jest.mock('@/features/context-studio/dal/getUsageRecords');
jest.mock('@/features/context-studio/services/scopeStudioQuery');

describe('getUsageRecordsProcedure', () => {
  const mockUserId = 'd3a4a1f2-6c1e-4a2b-9f0d-2c8e5b7a1c34';
  const mockUserGroupId = 'b003fe12-5138-4ab5-bb64-a4a1ca8f775a';

  const ctx = {
    userId: mockUserId,
    userRole: UserRole.User,
  } as unknown as ContextType;

  const mockTimeRange = TimeRange.Week;
  const mockAiProvider = '6de3d2d5-1918-4288-993a-7445a2c8dbf9';

  const mockResult = {
    initiatedBy: InitiatedBy.Any,
    aiProvider: 'OpenAI',
    model: undefined,
    timeRange: mockTimeRange,
    userGroupLabel: undefined,
    userName: undefined,
    totalCost: 1000,
    totalInputTokens: 2000000,
    totalOutputTokens: 1000000,
    providers: [
      {
        id: '29acc27f-07e9-4d84-be34-586f68f7afb7',
        label: 'Provider 1',
        cost: 500,
        inputTokens: 1200000,
        outputTokens: 600000,
        models: [
          { id: '7c5a5f3c-14e9-4a23-b307-4bf4ddcfda84', label: 'Model A', cost: 300, inputTokens: 700000, outputTokens: 350000 },
          { id: 'c5c7165b-f5c9-40fa-b860-75b2e75dc9e1', label: 'Model B', cost: 200, inputTokens: 500000, outputTokens: 250000 },
        ],
      },
      {
        id: '51f9523f-cc65-4580-8626-65894927cbfd',
        label: 'Provider 2',
        cost: 500,
        inputTokens: 800000,
        outputTokens: 400000,
        models: [
          { id: 'ef720a6d-0f0c-4a89-a0ee-27af40177c10', label: 'Model C', cost: 500, inputTokens: 800000, outputTokens: 400000 },
        ],
      },
    ],
  };

  const callRoute = (timeRange: TimeRange = mockTimeRange, userGroupId = 'all', userId = 'all') =>
    contextStudioRouter.createCaller(ctx).getUsageRecords({
      initiatedBy: InitiatedBy.Any,
      aiProvider: mockAiProvider,
      model: 'all',
      timeRange,
      userGroupId,
      userId,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    (getUsageRecords as jest.Mock).mockResolvedValue(mockResult);
    // Pass-through by default so argument-forwarding assertions below see the
    // scope unchanged; individual tests override this to exercise scoping.
    (scopeStudioQuery as jest.Mock).mockImplementation((_ctx, _userGroupId, userId) =>
      Promise.resolve({ isLead: false, restrictedUserId: userId }));
  });

  it('returns usage records for the caller\'s group and user filters', async () => {
    await expect(callRoute(mockTimeRange, mockUserGroupId, mockUserId)).resolves.toEqual(mockResult);

    expect(getUsageRecords).toHaveBeenCalledWith(
      InitiatedBy.Any, mockAiProvider, 'all', mockTimeRange, mockUserGroupId, mockUserId,
    );
  });

  it.each([TimeRange.YearToDate, TimeRange.Forever])(
    'accepts the %s preset',
    async (timeRange) => {
      (getUsageRecords as jest.Mock).mockResolvedValue({ ...mockResult, timeRange });

      await expect(callRoute(timeRange)).resolves.toMatchObject({ timeRange });
    },
  );

  it('requests the studio scope for the caller\'s group and user filters', async () => {
    await callRoute(mockTimeRange, mockUserGroupId, mockUserId);

    expect(scopeStudioQuery).toHaveBeenCalledWith(ctx, mockUserGroupId, mockUserId);
  });

  it('throws and does not call the DAL when the studio scope check rejects', async () => {
    const mockError = new Error('You do not have permission to access this resource');
    (scopeStudioQuery as jest.Mock).mockRejectedValue(mockError);

    await expect(callRoute()).rejects.toThrow(mockError.message);

    expect(getUsageRecords).not.toHaveBeenCalled();
  });

  // Selecting a group always breaks spend out by member, so the DAL must
  // receive the scope's restrictedUserId, not the raw requested userId, or a
  // non-Lead member's 'all' would still leak every member's individual spend.
  it('passes the scoped restrictedUserId, not the raw input, to the DAL', async () => {
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: mockUserId });

    await callRoute(mockTimeRange, mockUserGroupId, 'all');

    expect(getUsageRecords).toHaveBeenCalledWith(
      InitiatedBy.Any, mockAiProvider, 'all', mockTimeRange, mockUserGroupId, mockUserId,
    );
  });
});
