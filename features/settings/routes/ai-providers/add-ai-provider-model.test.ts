import { ContextType } from '@/server/trpc-context';
import settingsRouter from '@/features/settings/routes';
import addAiProviderModel from '@/features/settings/dal/ai-providers/addAiProviderModel';
import updateSystemConfigDefaultModel from '@/features/settings/dal/system-configurations/updateSystemConfigDefaultModel';
import updateSystemConfigKnowledgeGraphModel from '@/features/settings/dal/system-configurations/updateSystemConfigKnowledgeGraphModel';
import updateSystemConfigFastModel from '@/features/settings/dal/system-configurations/updateSystemConfigFastModel';
import { TRPCError } from '@trpc/server';
import { UserRole } from '@/features/shared/types/user';
import { DuplicateEmbeddingsModelError } from '@/features/shared/errors/duplicateEmbeddingsModelError';

jest.mock('@/features/settings/dal/ai-providers/addAiProviderModel');
jest.mock('@/features/settings/dal/system-configurations/updateSystemConfigDefaultModel');
jest.mock('@/features/settings/dal/system-configurations/updateSystemConfigKnowledgeGraphModel');
jest.mock('@/features/settings/dal/system-configurations/updateSystemConfigFastModel');

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
      auditor: { createAuditRecord: jest.fn() },
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
      embeddingsOnly: false,
    });

    expect(addAiProviderModel).toBeCalledWith({
      name: mockName,
      aiProviderId: mockAiProviderId,
      externalId: mockExternalId,
      costPerInputToken: 0,
      costPerOutputToken: 0,
    });
    expect(updateSystemConfigDefaultModel).toBeCalledWith(mockDBValue.id);
    expect(updateSystemConfigFastModel).toBeCalledWith(mockDBValue.id);
    expect(updateSystemConfigKnowledgeGraphModel).toBeCalledWith(mockDBValue.id);
  });

  it('does not make an embeddings-only model the system or knowledge graph model', async () => {
    (addAiProviderModel as jest.Mock).mockResolvedValueOnce({
      id: '9a2b467e-36ba-4d8f-ae5b-5eac0a62ac7e',
      name: mockName,
      externalId: mockExternalId,
      aiProviderId: mockAiProviderId,
      providerLabel: mockAiProviderLabel,
      costPerInputToken: mockCostPerInputToken,
      costPerOutputToken: mockCostPerOutputToken,
      embeddingsOnly: true,
    });

    ctx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.addAiProviderModel(mockInput);

    expect(result.embeddingsOnly).toBe(true);
    expect(updateSystemConfigDefaultModel).not.toBeCalled();
    expect(updateSystemConfigFastModel).not.toBeCalled();
    expect(updateSystemConfigKnowledgeGraphModel).not.toBeCalled();
  });

  // The DAL's error class cannot survive serialization, so the route converts it
  // into a code the client can key on instead of leaving the client to match the
  // message text.
  it('translates a duplicate embeddings model into a CONFLICT', async () => {
    ctx.userRole = UserRole.Admin;

    (addAiProviderModel as jest.Mock).mockRejectedValueOnce(
      new DuplicateEmbeddingsModelError('Titan Text Embeddings V1'),
    );

    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.addAiProviderModel({ ...mockInput, embeddingsOnly: true }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message:
        'This provider already uses "Titan Text Embeddings V1" for embeddings. Delete that model first.',
    });
  });

  // Only the uniqueness rejection gets a specific code; anything else must keep
  // being sanitized by the error middleware rather than reaching the admin.
  it('does not turn an unrelated failure into a CONFLICT', async () => {
    ctx.userRole = UserRole.Admin;

    (addAiProviderModel as jest.Mock).mockRejectedValueOnce(
      new Error('Error creating AI provider model'),
    );

    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.addAiProviderModel(mockInput),
    ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
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
