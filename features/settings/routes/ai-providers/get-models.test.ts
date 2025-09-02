import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { getModels } from '@/features/settings/dal/ai-providers/getModels';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/settings/dal/ai-providers/getModels');

describe('getModels route', () => {
  const mockModelFromDb = {
    id: '10e0eba0-b782-491b-b609-b5c84cb0e17a',
    aiProviderId: 'provider1',
    providerLabel: 'Provider 1',
    name: 'Model 1',
    externalId: 'ext1',
    costPerInputToken: 0,
    costPerOutputToken: 0,
  };

  const mockError = Forbidden(
    'You do not have permission to access this resource.',
  );

  const ctx = {
    userRole: UserRole.Admin,
    userId: 'user-id',
  } as unknown as ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    (getModels as jest.Mock).mockResolvedValue([mockModelFromDb]);
  });

  it('should return models if user is Admin', async () => {
    ctx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.getModels()).resolves.toEqual({
      models: [
        {
          id: '10e0eba0-b782-491b-b609-b5c84cb0e17a',
          aiProviderId: 'provider1',
          providerLabel: 'Provider 1',
          name: 'Model 1',
          externalId: 'ext1',
          costPerMillionInputTokens: 0,
          costPerMillionOutputTokens: 0,
        },
      ],
    });

    expect(getModels).toHaveBeenCalled();
  });

  it('should throw an error if user is not Admin', async () => {
    ctx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getModels()).rejects.toThrow(mockError);

    expect(getModels).not.toHaveBeenCalled();
  });

  it('should handle errors from getModels', async () => {
    const mockDbError = new Error('Database error');
    (getModels as jest.Mock).mockRejectedValue(mockDbError);

    ctx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getModels()).rejects.toThrow('Database error');

    expect(getModels).toHaveBeenCalled();
  });
});
