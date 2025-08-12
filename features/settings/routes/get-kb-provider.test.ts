import getKbProvider from '@/features/settings/dal/getKbProvider';
import { KbProviderType } from '@/features/shared/types';
import { ContextType } from '@/server/trpc-context';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';
import settingsRouter from '@/features/settings/routes';

jest.mock('@/features/settings/dal/getKbProvider');

describe('getKbProvider route', () => {
  const ctx = {
    userRole: UserRole.Admin,
  } as unknown as ContextType;

  const mockKbProviderFromDb = {
    id: '10e0eba0-b782-491b-b609-b5c84cb0e17a',
    label: 'mockLabel',
    kbProviderType: KbProviderType.KbProviderPalm,
    config: { apiKey: '123', apiEndpoint: 'https://www.endpoint.com' }, // Include apiKey in the mock DB response
    createdAt: new Date('2024-02-02T00:00:00.000Z'),
    updatedAt: new Date('2024-04-04T00:00:00.000Z'),
  };

  const mockKbProviderSanitized = {
    id: '10e0eba0-b782-491b-b609-b5c84cb0e17a',
    label: 'mockLabel',
    kbProviderType: KbProviderType.KbProviderPalm,
    config: { apiEndpoint: 'https://www.endpoint.com' }, // Exclude apiKey in the expected sanitized response
    createdAt: new Date('2024-02-02T00:00:00.000Z'),
    updatedAt: new Date('2024-04-04T00:00:00.000Z'),
  };

  const mockError = Forbidden('You do not have permission to access this resource');

  beforeEach(() => {
    jest.clearAllMocks();
    (getKbProvider as jest.Mock).mockResolvedValue(mockKbProviderFromDb);
  });

  it('should return the sanitized KB provider if user\'s Role is Admin', async () => {
    ctx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.getKbProvider({ id: mockKbProviderFromDb.id });

    expect(result).toEqual({ kbProvider: mockKbProviderSanitized });

    // Check that apiKey is not present in the config
    expect(result.kbProvider.config).not.toHaveProperty('apiKey');

    expect(getKbProvider).toHaveBeenCalledWith(mockKbProviderFromDb.id);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('should throw an error if user\'s Role is NOT Admin', async () => {
    ctx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getKbProvider({ id: mockKbProviderFromDb.id })).rejects.toThrow(mockError);

    expect(getKbProvider).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('Unauthorized user trpc.profile.getKbProvider', { userId: ctx.userId });
  });
});
