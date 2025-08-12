import settingsRouter from '@/features/settings/routes';
import { UserRole } from '@/features/shared/types/user';
import { KbProviderType } from '@/features/shared/types';
import createKbProvider from '@/features/settings/dal/createKbProvider';
import { TRPCError } from '@trpc/server';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/settings/dal/createKbProvider', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('add-kb-provider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockProvider = {
    id: '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09',
    label: 'Test Provider',
    kbProviderType: KbProviderType.KbProviderPalm,
    config: {
      apiKey: '123',
      apiEndpoint: 'http://endpoint.com',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let ctx: ContextType;

  beforeEach(() => {
    ctx = {
      userId: 'f48c262b-435c-47db-97f2-5f7e4c3b34a6',
      userRole: UserRole.User,
      prisma: {
        kbProvider: {
          create: jest.fn(),
        },
      },
    } as unknown as ContextType;
  });

  it('allows a UserRole.Admin user to add a new KB provider', async () => {
    ctx.userRole = UserRole.Admin;

    (createKbProvider as jest.Mock).mockResolvedValue(mockProvider);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.addKbProvider(mockProvider)).resolves.toEqual({
      kbProvider: {
        id: mockProvider.id,
        label: mockProvider.label,
        kbProviderType: mockProvider.kbProviderType,
        config: {
          apiEndpoint: mockProvider.config.apiEndpoint,
        },
        createdAt: mockProvider.createdAt,
        updatedAt: mockProvider.updatedAt,
      },
    });
    expect(createKbProvider).toHaveBeenCalledWith({
      label: mockProvider.label,
      kbProviderType: KbProviderType.KbProviderPalm,
      config: mockProvider.config,
    });
  });

  it('does not allow a UserRole.User user to add a KB provider', async () => {
    const error = new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You do not have permission to add a knowledge base provider',
    });

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.addKbProvider(mockProvider)).rejects.toThrow(error);
    expect(createKbProvider).not.toBeCalled();
  });

  it('should throw an error when the DAL throws an error', async () => {
    ctx.userRole = UserRole.Admin;
    const errorMessage = 'Error adding KB provider';
    (createKbProvider as jest.Mock).mockRejectedValue(new Error(errorMessage));

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.addKbProvider(mockProvider)).rejects.toThrow(errorMessage);
    expect(createKbProvider).toHaveBeenCalledWith({
      label: mockProvider.label,
      kbProviderType: KbProviderType.KbProviderPalm,
      config: mockProvider.config,
    });
  });
  describe('config validation', () => {

    let mockInput: any;

    const errorMessage = 'There was a problem adding the knowledge base provider';

    beforeEach(() => {
      mockInput = {
        id: '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09',
        label: 'Test Provider',
        kbProviderType: 0,
        config: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    it('handles invalid config for PALM', async () => {
      ctx.userRole = UserRole.Admin;

      mockInput.kbProviderType = KbProviderType.KbProviderPalm;
      // invalid API key
      mockInput.config = {
        apiEndpoint: 'http://endpoint.com',
        apiKey: '',
      };

      const caller = settingsRouter.createCaller(ctx);
      await expect(
        caller.addKbProvider(mockInput)
      ).rejects.toThrow(errorMessage);

      expect(createKbProvider).not.toBeCalled();
    });

    it('handles invalid config for bedrock', async () => {
      ctx.userRole = UserRole.Admin;

      mockInput.kbProviderType = KbProviderType.KbProviderBedrock;
      // missing required fields
      mockInput.config = {};

      const caller = settingsRouter.createCaller(ctx);
      await expect(
        caller.addKbProvider(mockInput)
      ).rejects.toThrowError();
      expect(createKbProvider).not.toBeCalled();
    });
  });
});
