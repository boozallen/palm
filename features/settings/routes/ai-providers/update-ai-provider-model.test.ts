import { ContextType } from '@/server/trpc-context';
import settingsRouter from '@/features/settings/routes';
import updateAiProviderModel from '@/features/settings/dal/ai-providers/updateAiProviderModel';
import { UserRole } from '@/features/shared/types/user';

jest.mock('@/features/settings/dal/ai-providers/updateAiProviderModel');

describe('update-ai-provider-model', () => {
  const mockUserId = 'f48c262b-435c-47db-97f2-5f7e4c3b34a6';
  const mockModelId = '9a2b467e-36ba-4d8f-ae5b-5eac0a62ac7e';
  const mockAiProviderId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';
  const mockAiProviderLabel = 'Some AI provider label';
  const mockName = 'updated ai provider model';
  const mockExternalId = 'external-5357698f8c09-example';

  let ctx: ContextType;

  const mockInput = {
    id: mockModelId,
    name: mockName,
    externalId: mockExternalId,
    costPerMillionInputTokens: 10,
    costPerMillionOutputTokens: 20,
  };

  const mockDBValue = {
    id: mockModelId,
    name: mockName,
    externalId: mockExternalId,
    aiProviderId: mockAiProviderId,
    providerLabel: mockAiProviderLabel,
    costPerInputToken: 0.00001,
    costPerOutputToken: 0.00002,
    embeddingsOnly: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
      auditor: { createAuditRecord: jest.fn() },
    } as unknown as ContextType;

    (updateAiProviderModel as jest.Mock).mockResolvedValue(mockDBValue);
  });

  it('allows a UserRole.Admin user to update an AI provider model', async () => {
    ctx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateAiProviderModel(mockInput)).resolves.toEqual({
      id: mockModelId,
      name: mockName,
      externalId: mockExternalId,
      aiProviderId: mockAiProviderId,
      providerLabel: mockAiProviderLabel,
      costPerMillionInputTokens: 10,
      costPerMillionOutputTokens: 20,
      embeddingsOnly: false,
    });

    expect(updateAiProviderModel).toBeCalledWith({
      id: mockModelId,
      name: mockName,
      externalId: mockExternalId,
      costPerInputToken: 0.00001,
      costPerOutputToken: 0.00002,
    });
  });

  it('returns the embeddings-only flag the DAL derived from the external id', async () => {
    (updateAiProviderModel as jest.Mock).mockResolvedValue({
      ...mockDBValue,
      embeddingsOnly: true,
    });

    ctx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.updateAiProviderModel(mockInput);

    expect(result.embeddingsOnly).toBe(true);
  });

  it('does not allow a UserRole.User user to update an AI provider model', async () => {
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateAiProviderModel(mockInput)).rejects.toThrow(
      'You do not have permission to update a model',
    );

    expect(updateAiProviderModel).not.toBeCalled();
  });

  it('propagates errors from the DAL', async () => {
    (updateAiProviderModel as jest.Mock).mockRejectedValue(
      new Error('Error updating AI provider model'),
    );

    ctx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateAiProviderModel(mockInput)).rejects.toThrow(
      'Error updating AI provider model',
    );
  });
});
