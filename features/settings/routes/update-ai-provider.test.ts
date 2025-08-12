import { ContextType } from '@/server/trpc-context';
import settingsRouter from '@/features/settings/routes';
import updateAiProvider from '@/features/settings/dal/updateAiProvider';
import { TRPCError } from '@trpc/server';
import { UserRole } from '@/features/shared/types/user';
import { AiProviderType } from '@/features/shared/types';
import { TOKEN_COST_RATE } from '@/features/shared/utils';

jest.mock('@/features/settings/dal/updateAiProvider');

describe('update-ai-provider', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const mockAiProviderId = 'd9776d52-42d2-4a5c-9db2-b422478a1f5c';
  const mockConfigId = '3d88220d-d1d1-444b-9e4f-044ee220f181';
  let ctx: ContextType;

  const mockInput = {
    id: mockAiProviderId,
    label: 'new-ai-provider',
    apiKey: 'sk-3d88220dd1d1444b9e4f044ee220f181',
    accessKeyId: '',
    secretAccessKey: '',
    sessionToken: '',
    apiEndpoint: 'https://azureopenai.microsoft.com/api/v1/openai/text/completions',
    region: '',
  };

  const mockUpdatedProvider = {
    id: mockAiProviderId,
    typeId: AiProviderType.AzureOpenAi,
    label: mockInput.label,
    config: {
      id: mockConfigId,
      apiEndpoint: mockInput.apiEndpoint,
      region: null,
    },
    inputCostPerMillionTokens: 0,
    outputCostPerMillionTokens: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;
  });

  it('allows a UserRole.Admin user to update AI provider', async () => {

    ctx.userRole = UserRole.Admin;

    (updateAiProvider as jest.Mock).mockResolvedValueOnce({
      id: mockUpdatedProvider.id,
      typeId: mockUpdatedProvider.typeId,
      label: mockUpdatedProvider.label,
      config: mockUpdatedProvider.config,
      costPerInputToken: mockUpdatedProvider.inputCostPerMillionTokens / TOKEN_COST_RATE,
      costPerOutputToken: mockUpdatedProvider.outputCostPerMillionTokens / TOKEN_COST_RATE,
      createdAt: mockUpdatedProvider.createdAt,
      updatedAt: mockUpdatedProvider.updatedAt,
    });

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateAiProvider(mockInput)).resolves.toEqual({ provider: mockUpdatedProvider });

    expect(updateAiProvider).toBeCalledWith({
      id: mockInput.id,
      label: mockInput.label,
      apiEndpoint: mockInput.apiEndpoint,
      apiKey: mockInput.apiKey,
      accessKeyId: mockInput.accessKeyId,
      secretAccessKey: mockInput.secretAccessKey,
      sessionToken: mockInput.sessionToken,
      region: mockInput.region,
      costPerInputToken: undefined,
      costPerOutputToken: undefined,
    });
  });

  it('does not allow a UserRole.User user to update AI provider', async () => {
    const error = new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this resource',
    });

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateAiProvider(mockInput)).rejects.toThrow(error);

    expect(updateAiProvider).not.toBeCalled();
  });
});
