import { KbProviderType } from '@/features/shared/types';
import { UserRole } from '@/features/shared/types/user';
import getIsUserGroupLead from '@/features/shared/dal/getIsUserGroupLead';
import { TRPCError } from '@trpc/server';
import getKbProviders from '@/features/settings/dal/kb-providers/getKbProviders';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/shared/dal/getIsUserGroupLead');
jest.mock('@/features/settings/dal/kb-providers/getKbProviders');

describe('getKbProviders route', () => {
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

  const mockError = new TRPCError({
    code: 'FORBIDDEN',
    message: 'You do not have permission to access this resource.',
  });

  const ctx = {
    userRole: UserRole.Admin,
    userId: 'user-id',
  } as unknown as ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    (getKbProviders as jest.Mock).mockResolvedValue([mockKbProviderFromDb]);
    (getIsUserGroupLead as jest.Mock).mockResolvedValue(true);
  });

  it('should return sanitized KB providers if user is Admin', async () => {
    ctx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.getKbProviders();

    expect(result).toEqual({
      kbProviders: [mockKbProviderSanitized],
    });

    // Check that apiKey is not present in the config
    result.kbProviders.forEach(provider => {
      expect(provider.config).not.toHaveProperty('apiKey');
    });

    expect(getKbProviders).toHaveBeenCalled();
  });

  it('should return sanitized KB providers if user is a group lead', async () => {
    ctx.userRole = UserRole.User;
    (getIsUserGroupLead as jest.Mock).mockResolvedValue(true);

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.getKbProviders();

    expect(result).toEqual({
      kbProviders: [mockKbProviderSanitized],
    });

    // Check that apiKey is not present in the config
    result.kbProviders.forEach(provider => {
      expect(provider.config).not.toHaveProperty('apiKey');
    });

    expect(getKbProviders).toHaveBeenCalled();
  });

  it('should throw an error if user is not Admin and not a group lead', async () => {
    ctx.userRole = UserRole.User;
    (getIsUserGroupLead as jest.Mock).mockResolvedValue(false);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getKbProviders()).rejects.toThrow(mockError);

    expect(getKbProviders).not.toHaveBeenCalled();
  });
});
