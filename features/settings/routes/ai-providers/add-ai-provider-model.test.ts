import { ContextType } from '@/server/trpc-context';
import settingsRouter from '@/features/settings/routes';
import addAiProviderModel from '@/features/settings/dal/ai-providers/addAiProviderModel';
import updateSystemConfigDefaultModel from '@/features/settings/dal/system-configurations/updateSystemConfigDefaultModel';
import { TRPCError } from '@trpc/server';
import { UserRole } from '@/features/shared/types/user';

jest.mock('@/features/settings/dal/ai-providers/addAiProviderModel');
jest.mock('@/features/settings/dal/system-configurations/updateSystemConfigDefaultModel');

describe('add-ai-provider-model', () => {
  const mockUserId = 'f48c262b-435c-47db-97f2-5f7e4c3b34a6';
  const mockAiProviderId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';
  const mockAiProviderLabel = 'Some AI provider label';
  const mockName = 'new ai provider model';
  const mockExternalId = 'external-5357698f8c09-example';
  const mockCostPerInputToken = 0;
  const mockCostPerOutputToken = 0;

  let ctx: ContextType;

  const mockInput = {
    name: mockName,
    aiProviderId: mockAiProviderId,
    externalId: mockExternalId,
    costPerMillionInputTokens: mockCostPerInputToken,
    costPerMillionOutputTokens: mockCostPerOutputToken,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;
  });

  it('allows a UserRole.Admin user to add a new AI provider model', async () => {
    const mockDBValue = {
      id: '9a2b467e-36ba-4d8f-ae5b-5eac0a62ac7e',
      name: mockName,
      externalId: mockExternalId,
      aiProviderId: mockAiProviderId,
      providerLabel: mockAiProviderLabel,
      costPerInputToken: mockCostPerInputToken,
      costPerOutputToken: mockCostPerOutputToken,
    };

    ctx.userRole = UserRole.Admin;

    (addAiProviderModel as jest.Mock).mockResolvedValueOnce(mockDBValue);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.addAiProviderModel(mockInput)).resolves.toEqual({
      id: '9a2b467e-36ba-4d8f-ae5b-5eac0a62ac7e',
      name: mockName,
      externalId: mockExternalId,
      aiProviderId: mockAiProviderId,
      providerLabel: mockAiProviderLabel,
      costPerMillionInputTokens: mockCostPerInputToken * 1_000_000,
      costPerMillionOutputTokens: mockCostPerOutputToken * 1_000_000,
    });

    expect(addAiProviderModel).toBeCalledWith({
      name: mockName,
      aiProviderId: mockAiProviderId,
      externalId: mockExternalId,
      costPerInputToken: 0,
      costPerOutputToken: 0,
    });
    expect(updateSystemConfigDefaultModel).toBeCalledWith(mockDBValue.id);
  });

  it('does not allow a UserRole.User user to add a new AI provider model', async () => {
    const error = new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to add a new model',
    });

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.addAiProviderModel(mockInput)).rejects.toThrow(error);

    expect(addAiProviderModel).not.toBeCalled();
  });
});
