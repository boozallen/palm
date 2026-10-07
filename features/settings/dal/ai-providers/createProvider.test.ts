import db from '@/server/db';
import createProvider from '@/features/settings/dal/ai-providers/createProvider';
import { createProviderConfigWithDB } from '@/features/settings/dal/ai-providers/createProviderConfig';
import { AiProviderType, ProviderConfig } from '@/features/shared/types';

jest.mock('@/server/db', () => ({
  $transaction: jest.fn(),
}));

jest.mock('@/features/settings/dal/ai-providers/createProviderConfig', () => ({
  createProviderConfigWithDB: jest.fn(),
}));

const mockProviderCreate = jest.fn();
const mockModelCreate = jest.fn();

(db.$transaction as jest.Mock).mockImplementation(async (callback) => {
  return callback({
    aiProvider: { create: mockProviderCreate },
    model: { create: mockModelCreate },
  });
});

describe('createProvider', () => {
  const mockProviderId = 'ec1f5b0e-6f2f-4a4f-9a6a-1c1a5a5d5b5e';
  const mockConfigId = '79128cd8-8c5e-44f2-a451-331fad28925c';

  beforeEach(() => {
    jest.clearAllMocks();

    (createProviderConfigWithDB as jest.Mock).mockResolvedValue({
      id: mockConfigId,
      type: AiProviderType.Bedrock,
    });

    mockProviderCreate.mockResolvedValue({
      id: mockProviderId,
      label: 'Bedrock',
      aiProviderTypeId: AiProviderType.Bedrock,
      costPerInputToken: 0,
      costPerOutputToken: 0,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
  });

  const buildInput = (type: AiProviderType) => ({
    label: 'Provider',
    type,
    config: { type } as Exclude<ProviderConfig, 'id'>,
  });

  it('creates the provider and returns it', async () => {
    const result = await createProvider(buildInput(AiProviderType.Bedrock));

    expect(result).toEqual({
      id: mockProviderId,
      typeId: AiProviderType.Bedrock,
      label: 'Bedrock',
      configTypeId: AiProviderType.Bedrock,
      config: { id: mockConfigId, type: AiProviderType.Bedrock },
      costPerInputToken: 0,
      costPerOutputToken: 0,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
  });

  // Models are hand-configured now, including the embedding model, which an admin
  // adds and designates from the provider table.
  it('does not create any model alongside a Bedrock provider', async () => {
    await createProvider(buildInput(AiProviderType.Bedrock));

    expect(mockModelCreate).not.toBeCalled();
  });

  it('does not create any model alongside a non-Bedrock provider', async () => {
    (createProviderConfigWithDB as jest.Mock).mockResolvedValue({
      id: mockConfigId,
      type: AiProviderType.OpenAi,
    });

    await createProvider(buildInput(AiProviderType.OpenAi));

    expect(mockModelCreate).not.toBeCalled();
  });

  it('throws a sanitized error when the provider cannot be created', async () => {
    mockProviderCreate.mockRejectedValueOnce(new Error('insert failed'));

    await expect(createProvider(buildInput(AiProviderType.Bedrock))).rejects.toThrow(
      'Error creating provider'
    );
  });
});
