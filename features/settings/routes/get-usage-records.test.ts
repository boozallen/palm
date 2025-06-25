import { UserRole } from '@/features/shared/types/user';
import { ContextType } from '@/server/trpc-context';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getUsageRecords from '@/features/settings/dal/getUsageRecords';
import settingsRouter from '@/features/settings/routes/index';
import { InitiatedBy, TimeRange } from '@/features/settings/types/analytics';

jest.mock('@/features/settings/dal/getUsageRecords');

describe('getUsageRecordsProcedure', () => {
  const ctx = {
    userRole: UserRole.Admin,
  } as unknown as ContextType;

  const mockTimeRange = TimeRange.Week;
  const mockResult = {
    initiatedBy: InitiatedBy.Any,
    aiProvider: 'OpenAI',
    model: undefined,
    timeRange: mockTimeRange,
    totalCost: 1000,
    providers: [
      {
        id: '29acc27f-07e9-4d84-be34-586f68f7afb7',
        label: 'Provider 1',
        cost: 500,
        models: [
          { id: '7c5a5f3c-14e9-4a23-b307-4bf4ddcfda84', label: 'Model A', cost: 300 },
          { id: 'c5c7165b-f5c9-40fa-b860-75b2e75dc9e1', label: 'Model B', cost: 200 },
        ],
      },
      {
        id: '51f9523f-cc65-4580-8626-65894927cbfd',
        label: 'Provider 2',
        cost: 500,
        models: [
          { id: 'ef720a6d-0f0c-4a89-a0ee-27af40177c10', label: 'Model C', cost: 500 },
        ],
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getUsageRecords as jest.Mock).mockResolvedValue(mockResult);
  });

  const mockError = Forbidden('You do not have permission to access this resource');
  const mockAiProvider = '6de3d2d5-1918-4288-993a-7445a2c8dbf9';

  it('should get usage records if user is Admin', async () => {
    ctx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.getUsageRecords({
        initiatedBy: InitiatedBy.Any,
        aiProvider: mockAiProvider,
        model: 'all',
        timeRange: mockTimeRange,
      })
    ).resolves.toEqual(
      mockResult
    );
    expect(getUsageRecords).toHaveBeenCalled();
  });

  it('should throw error if user is not an Admin', async () => {
    ctx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.getUsageRecords({
        initiatedBy: InitiatedBy.Any,
        aiProvider: mockAiProvider,
        model: 'all',
        timeRange: mockTimeRange,
      })
    ).rejects.toThrow(mockError);
    expect(getUsageRecords).not.toHaveBeenCalled();
  });
});
