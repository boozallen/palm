import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import { AiProviderType } from '@/features/shared/types';
import { UserRole } from '@/features/shared/types/user';
import { TRPCError } from '@trpc/server';
import createProvider from '@/features/settings/dal/createProvider';
import { TOKEN_COST_RATE } from '@/features/shared/utils';

jest.mock('@/features/settings/dal/createProvider', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('add-ai-provider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUserId = 'f48c262b-435c-47db-97f2-5f7e4c3b34a6';
  const mockAiProviderId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';
  const mockConfigId = 'a255fa0d-6c50-4e81-bc71-4c87a3767bf4';
  const mockName = 'Test Provider';
  const mockApiKey = 'test-api-key';

  const mockInput = {
    label: mockName,
    type: AiProviderType.OpenAi,
    apiKey: mockApiKey,
    apiEndpoint: 'https://api.openai.com',
    accessKeyId: '',
    secretAccessKey: '',
    sessionToken: '',
    region: '',
  };

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
      prisma: {
        aiProvider: {
          create: { id: mockAiProviderId },
        },
      },
    } as unknown as ContextType;
  });

  it('allows a UserRole.Admin user to add a new AI provider', async () => {
    ctx.userRole = UserRole.Admin;

    const mockProvider = {
      id: mockAiProviderId,
      typeId: AiProviderType.OpenAi,
      label: mockName,
      inputCostPerMillionTokens: 0,
      outputCostPerMillionTokens: 0,
      config: { id: mockConfigId, apiEndpoint: null, region: null },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (createProvider as jest.Mock).mockResolvedValue({
      id: mockProvider.id,
      typeId: mockProvider.typeId,
      label: mockProvider.label,
      costPerInputToken: mockProvider.inputCostPerMillionTokens / TOKEN_COST_RATE,
      costPerOutputToken: mockProvider.outputCostPerMillionTokens / TOKEN_COST_RATE,
      config: mockProvider.config,
      createdAt: mockProvider.createdAt,
      updatedAt: mockProvider.updatedAt,
    });

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.addAiProvider(mockInput)).resolves.toEqual({ provider: mockProvider });
    expect(createProvider).toHaveBeenCalledWith({
      label: mockName,
      type: AiProviderType.OpenAi,
      config: expect.any(Object),
      costPerInputToken: undefined,
      costPerOutputToken: undefined,
    });
  });

  it('does not allow a UserRole.User user to add an AI provider', async () => {
    const error = new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to add an AI provider',
    });

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.addAiProvider(mockInput)).rejects.toThrow(error);

    expect(createProvider).not.toBeCalled();
  });

  it('should throw an error when the DAL throws an error', async () => {
    const errorMessage = 'Error adding AI provider';
    (createProvider as jest.Mock).mockRejectedValue(new Error(errorMessage));

    const input = {
      label: mockName,
      type: AiProviderType.OpenAi,
      apiKey: mockApiKey,
      apiEndpoint: '',
      accessKeyId: '',
      secretAccessKey: '',
      sessionToken: '',
      region: '',
    };

    const createProviderInput = {
      config: {
        apiKey: mockApiKey,
        orgKey: '',
        type: 1,
      },
      label: mockName,
      type: 1,
    };

    const ctx = {
      userRole: UserRole.Admin,
      prisma: {
        aiProvider: {
          create: jest.fn(),
        },
      },
      logger: {
        debug: jest.fn(),
        error: jest.fn(),
      },
    } as unknown as ContextType;

    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.addAiProvider(input)).rejects.toThrow(errorMessage);
    expect(createProvider).toHaveBeenCalledWith(createProviderInput);
  });
});
