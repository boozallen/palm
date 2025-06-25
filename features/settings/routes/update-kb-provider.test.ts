import { ContextType } from '@/server/trpc-context';
import settingsRouter from '@/features/settings/routes';
import updateKbProvider from '@/features/settings/dal/updateKbProvider';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { KbProviderType } from '@/features/shared/types';
import updateSystemConfigDocumentLibraryKbProvider from '@/features/settings/dal/updateSystemConfigDocumentLibraryKbProvider';

jest.mock('@/features/settings/dal/updateKbProvider');
jest.mock('@/features/settings/dal/updateSystemConfigDocumentLibraryKbProvider');

describe('update-kb-provider', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const mockKbProviderId = 'd9776d52-42d2-4a5c-9db2-b422478a1f5c';
  let ctx: ContextType;

  const mockInput = {
    id: mockKbProviderId,
    label: 'new-kb-provider',
    writeAccess: true,
    config: {
      apiKey: 'sk-3d88220dd1d1444b9e4f044ee220f181',
      apiEndpoint: 'https://api.example.com/v1',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;
  });

  it('allows a UserRole.Admin user to update KB provider', async () => {
    ctx.userRole = UserRole.Admin;

    const mockUpdatedProvider = {
      id: mockKbProviderId,
      kbProviderType: KbProviderType.KbProviderPalm,
      label: 'new-kb-provider',
      writeAccess: mockInput.writeAccess,
      config: {
        apiKey: 'sk-3d88220dd1d1444b9e4f044ee220f181',
        apiEndpoint: 'https://api.example.com/v1',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (updateKbProvider as jest.Mock).mockResolvedValueOnce(mockUpdatedProvider);

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.updateKbProvider(mockInput);

    expect(result).toEqual({
      provider: {
        ...mockUpdatedProvider,
        config: {
          apiEndpoint: 'https://api.example.com/v1',
        },
      },
    });
    expect(updateKbProvider).toBeCalledWith(mockInput);
    expect(updateSystemConfigDocumentLibraryKbProvider).not.toBeCalled();
  });

  it('does not allow a UserRole.User user to update KB provider', async () => {
    const error = Forbidden('You do not have permission to access this resource');

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateKbProvider(mockInput)).rejects.toThrow(error);

    expect(updateKbProvider).not.toBeCalled();
    expect(updateSystemConfigDocumentLibraryKbProvider).not.toBeCalled();
  });

  it('throws an error if the config does not match the expected schema after omitting API keys', async () => {
    ctx.userRole = UserRole.Admin;

    const mockUpdatedProvider = {
      id: mockKbProviderId,
      kbProviderType: KbProviderType.KbProviderPalm,
      label: mockInput.label,
      writeAccess: mockInput.writeAccess,
      config: {
        apiKey: 'secret-key',
        unexpectedField: 'unexpected value',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (updateKbProvider as jest.Mock).mockResolvedValueOnce(mockUpdatedProvider);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateKbProvider(mockInput)).rejects.toThrow();
    expect(updateSystemConfigDocumentLibraryKbProvider).not.toBeCalled();
  });

  it('calls updateSystemConfigDocumentLibraryKbProvider when writeAccess of updated provider is false', async () => {
    ctx.userRole = UserRole.Admin;

    const mockUpdatedProvider = {
      id: mockKbProviderId,
      kbProviderType: KbProviderType.KbProviderPalm,
      label: 'new-kb-provider',
      writeAccess: false,
      config: {
        apiKey: 'sk-3d88220dd1d1444b9e4f044ee220f181',
        apiEndpoint: 'https://api.example.com/v1',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (updateKbProvider as jest.Mock).mockResolvedValueOnce(mockUpdatedProvider);

    const caller = settingsRouter.createCaller(ctx);
    await caller.updateKbProvider(mockInput);

    expect(updateKbProvider).toBeCalledWith(mockInput);
    expect(updateSystemConfigDocumentLibraryKbProvider).toBeCalledWith(mockUpdatedProvider.id);
  });
});
