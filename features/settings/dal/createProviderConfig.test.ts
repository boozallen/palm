import db from '@/server/db';
import { createProviderConfigWithDB } from './createProviderConfig';
import { AiProviderType, BedrockConfig, ProviderConfig } from '@/features/shared/types';

jest.mock('@/server/db', () => {
  return {
    apiConfigBedrock: {
      create: jest.fn(),
    },
  };
});

describe('createProviderConfigWithDB', () => {
  const mockId = '79128cd8-8c5e-44f2-a451-331fad28925c';
  const mockBedrockConfig: Omit<BedrockConfig, 'type'> = {
    accessKeyId: 'access-key-id',
    secretAccessKey: 'secret-access-key',
    sessionToken: 'session-token',
    region: 'region',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (db.apiConfigBedrock.create as jest.Mock).mockResolvedValue({
      id: mockId,
      deletedAt: null,
      ...mockBedrockConfig,
    });
  });

  it('creates bedrock config record', async () => {
    const result = await createProviderConfigWithDB(
      db,
      {
        type: AiProviderType.Bedrock,
        ...mockBedrockConfig,
      } as Exclude<ProviderConfig, 'id'>
    );

    expect(result).toEqual({
      id: mockId,
      type: AiProviderType.Bedrock,
      ...mockBedrockConfig,
    });
  });
});
